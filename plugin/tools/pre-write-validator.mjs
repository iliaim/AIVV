#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReviewRuntimeEvidence } from "./runtime-evidence.mjs";

export const ASSERTION_KINDS = new Set([
  "jq-parses",
  "schema-coherence",
  "line-cite-valid",
  "shell-syntax-valid"
]);

const UNSUPPORTED_SHAPES = new Set(["unsupported-risky-shape"]);

const REVIEW_LOG_SCOPE_KIND_ENUM = new Set(["process", "session", "artifact", "user-journey", "project"]);
const REVIEW_LOG_EVIDENCE_KIND_ENUM = new Set(["internal-repo", "websearch", "webfetch", "runtime", "command", "state-log", "thread", "unverified", "unverifiable"]);
const REVIEW_LOG_RECOMMENDED_NEXT_STEP_ENUM = new Set(["fix-now", "investigate-first", "document", "defer-with-rationale", "accept-risk"]);
const REVIEW_LOG_STATUS_ENUM = new Set(["in-progress", "completed", "failed", "abandoned", "voided-workspace-drift"]);
const REVIEW_LOG_TRUST_AGREEMENT_ENUM = new Set(["single", "converged", "mixed", "unique_findings", "clean"]);
const REVIEW_LOG_CHECKPOINT_OUTCOME_ENUM = new Set(["continue", "dry-run", "select-findings", "stop"]);
const REVIEW_LOG_ASSURANCE_CRITICALITY_ENUM = new Set(["low", "medium", "high"]);
const REVIEW_LOG_ASSURANCE_EVIDENCE_KIND_ENUM = new Set(["command-output", "schema-validation", "grep", "runtime-evidence", "source-citation", "verifier-result", "test-output"]);
const REVIEW_LOG_RFC3339_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const AIVV_INVOCATION_ID_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9a-f]{4}$/;
const REVIEW_LOG_SUBJECT_TYPE_ENUM = new Set(["session", "file", "idea", "project", "artifact", "user-journey", "plan"]);
const REVIEW_LOG_LENS_ENUM = new Set(["general", "code", "sec", "visual", "ux", "polish", "compliance", "i18n", "user-journey", "perf", "a11y"]);
const REVIEW_LOG_ROSTER_STATUS_ENUM = new Set(["completed", "failed", "skipped", "degraded", "unfilled"]);
const REVIEW_LOG_SHA256_RE = /^[0-9a-f]{64}$/;
const REVIEW_LOG_FINDING_REF_RE = /^F[0-9]{3,}$/;
const REVIEW_LOG_MODERN_REQUIRED_FIELDS = [
  "quality_profile",
  "evidence",
  "impact",
  "severity_rationale",
  "recommended_next_step",
  "verification_path",
  "proportional_remediation",
  "fingerprint"
];
const FIX_LOG_STATUS_ENUM = new Set(["in-progress", "completed", "failed", "abandoned"]);
const FIX_LOG_SOURCE_ENUM = new Set(["conversation", "review_id", "literal", "task_file"]);
const FIX_LOG_LIFECYCLE_SELECTOR_TYPE_ENUM = new Set(["incident", "problem", "issue", "github_issue"]);
const FIX_LOG_LIFECYCLE_RECORD_KIND_ENUM = new Set(["incident", "problem", "issue"]);
const FIX_LOG_LIFECYCLE_SOURCE_MODE_ENUM = new Set(["review-sourced", "finding-sourced", "investigation-only"]);
const FIX_LOG_READINESS_RISK_ENUM = new Set(["low", "medium", "high"]);
const FIX_LOG_READINESS_APPROVAL_ENUM = new Set(["auto", "user-confirmed", "dry-run", "dangerous-override", "skipped"]);
const FIX_LOG_READINESS_GO_ENUM = new Set(["go", "no-go", "dry-run-only"]);
const FIX_LOG_GENERATED_VERIFICATION_POLICY_ENUM = new Set(["inspect-only", "existing-step-5.7-enabled", "external-ci-only"]);
const FIX_LOG_DANGEROUS_CONFIRMATION_SOURCE_ENUM = new Set(["interactive-exact-phrase", "env:AIVV_DANGEROUSLY_AUTO_APPLY"]);
const FIX_LOG_OBJECTIVE_EVIDENCE_KIND_ENUM = new Set(["test-output", "command-output", "schema-validation", "grep", "runtime-evidence", "source-citation", "verifier-result"]);
const FIX_LOG_FINAL_DISPOSITION_ENUM = new Set(["closed", "closed_with_residual_risk", "deferred", "false_positive", "accepted_risk", "reopened", "needs_rework", "needs_evidence"]);
const FIX_LOG_TERMINAL_EVIDENCE_DISPOSITIONS = new Set(["closed", "closed_with_residual_risk", "false_positive"]);

export function sha256(text) {
  return crypto.createHash("sha256").update(text ?? "", "utf8").digest("hex");
}

export function byteLen(text) {
  return Buffer.byteLength(text ?? "", "utf8");
}

export function editFrame(edit) {
  return `old_bytes=${byteLen(edit.old_string)}\n${edit.old_string ?? ""}\nnew_bytes=${byteLen(edit.new_string)}\n${edit.new_string ?? ""}`;
}

export function multiEditSha(edits) {
  return sha256((edits ?? []).map(editFrame).join("\n--aivv-edit-boundary--\n"));
}

export function intentContent(intent) {
  if (!intent) return "";
  if (typeof intent.exact_content === "string") return intent.exact_content;
  if (typeof intent.exact_content_or_patch === "string") return intent.exact_content_or_patch;
  if (Array.isArray(intent.proposed_edits)) {
    return intent.proposed_edits.map((edit) => `${edit.old_string ?? ""}\n${edit.new_string ?? ""}`).join("\n");
  }
  return "";
}

export function assertionKinds(fixture) {
  const explicit = new Set();
  for (const intent of fixture.write_intents ?? []) {
    for (const item of intent.pre_write_assertions ?? []) {
      const kind = typeof item === "string" ? item : item.kind;
      if (kind) explicit.add(kind);
    }
  }
  const single = fixture.assertion?.kind;
  if (single) explicit.add(single);
  return explicit;
}

function assertionRecords(fixture) {
  const records = [];
  for (const intent of fixture.write_intents ?? []) {
    for (const item of intent.pre_write_assertions ?? []) {
      records.push(typeof item === "string" ? { kind: item, args: {}, intent } : { ...item, intent });
    }
  }
  if (fixture.assertion?.kind) {
    records.push({ kind: fixture.assertion.kind, args: fixture.assertion, intent: fixture.write_intents?.[0] });
  }
  return records;
}

export function collectShapes(fixture) {
  return [
    fixture.content_shape,
    ...(fixture.write_intents ?? []).flatMap((intent) => [
      intent.content_shape,
      ...(intent.detector_result?.content_shapes ?? [])
    ])
  ].filter(Boolean);
}

export function requiredAssertions(fixture) {
  const required = new Set();
  const text = JSON.stringify(fixture);
  const shapes = collectShapes(fixture);
  const contents = [fixture.exact_content, ...(fixture.write_intents ?? []).map(intentContent)]
    .filter(Boolean)
    .join("\n");

  if (
    shapes.includes("jsonschema") ||
    fixture.schema_coherence_case ||
    /```(?:jsonschema|json)\b/i.test(contents) ||
    /"\$schema"\s*:|"properties"\s*:|"required"\s*:/i.test(contents)
  ) {
    required.add("jq-parses");
    required.add("schema-coherence");
  }
  if (shapes.includes("shell") || fixture.language || /```(?:bash|sh|zsh|shell)\b/i.test(contents)) {
    required.add("shell-syntax-valid");
  }
  if (fixture.assertion?.kind === "line-cite-valid" || /L<N>|L[0-9]+(?:-L[0-9]+)?/.test(text)) {
    required.add("line-cite-valid");
  }
  return required;
}

export function hasAllRequiredAssertions(fixture) {
  const provided = assertionKinds(fixture);
  for (const required of requiredAssertions(fixture)) {
    if (!provided.has(required)) return false;
  }
  return true;
}

function targetProjectPathVerdict(targetFile, targetProject) {
  const relative = canonicalProjectRelativePath(targetFile);
  if (relative === null || !nonBlankString(targetProject) || !path.isAbsolute(targetProject)) {
    return { status: "halt", reason: "unsupported-risky-path" };
  }

  let projectRoot;
  try {
    projectRoot = fs.realpathSync(targetProject);
    if (!fs.statSync(projectRoot).isDirectory()) {
      return { status: "halt", reason: "unsupported-risky-path" };
    }
  } catch {
    return { status: "halt", reason: "unsupported-risky-path" };
  }

  const absoluteTarget = path.resolve(projectRoot, ...relative.split("/"));
  if (absoluteTarget !== projectRoot && !absoluteTarget.startsWith(`${projectRoot}${path.sep}`)) {
    return { status: "halt", reason: "unsupported-risky-path" };
  }

  // Reject every existing symlink component. This also covers a final target
  // symlink and directory symlinks that would redirect an otherwise in-scope
  // relative path outside the selected project tree.
  let current = projectRoot;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        return { status: "halt", reason: "unsupported-risky-path" };
      }
    } catch (error) {
      if (error?.code === "ENOENT") break;
      return { status: "halt", reason: "unsupported-risky-path" };
    }
  }
  return { status: "pass", reason: "pass" };
}

export function targetPathVerdict(targetFile, targetProject) {
  if (!targetFile) return { status: "pass", reason: "pass" };
  const normalized = path.posix.normalize(targetFile.replaceAll("\\", "/"));
  const segments = normalized.split("/");
  if (
    path.isAbsolute(targetFile) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    segments.includes("..") ||
    segments.includes(".git") ||
    segments.includes(".ssh") ||
    segments.includes("node_modules") ||
    segments.includes("secrets") ||
    segments.some((segment) => segment.startsWith(".env") || segment.startsWith("id_rsa"))
  ) {
    return { status: "halt", reason: "unsupported-risky-path" };
  }
  if (targetProject !== undefined) {
    return targetProjectPathVerdict(normalized, targetProject);
  }
  return { status: "pass", reason: "pass" };
}

function bypassApproval(fixture, intent) {
  return intent?.detector_result?.bypass_approval;
}

export function detectorVerdict(fixture) {
  for (const intent of fixture.write_intents ?? []) {
    const pathVerdict = targetPathVerdict(
      intent.target_file ?? fixture.target_file,
      fixture.command === "aivv-fix" ? fixture.target_project : undefined,
    );
    if (pathVerdict.status === "halt") return pathVerdict;
  }
  const rootPathVerdict = targetPathVerdict(
    fixture.target_file,
    fixture.command === "aivv-fix" ? fixture.target_project : undefined,
  );
  if (rootPathVerdict.status === "halt") return rootPathVerdict;

  const shapes = collectShapes(fixture);
  const containsNul = value => typeof value === "string" ? value.includes("\u0000")
    : value !== null && typeof value === "object" && Object.values(value).some(containsNul);
  if (containsNul(fixture)) {
    return { status: "halt", reason: "unsupported-risky-shape" };
  }
  // Prompt-shaped content is data in an inspectable write intent. The
  // challenger evaluates its meaning; it is not an independent per-byte
  // authorization gate. Process-rule authority uses the existing Branch D
  // decision route.
  for (const intent of fixture.write_intents ?? [fixture]) {
    const intentShapes = [
      intent.content_shape,
      ...(intent.detector_result?.content_shapes ?? [])
    ].filter(Boolean);
    if (!intentShapes.some((shape) => UNSUPPORTED_SHAPES.has(shape))) continue;
    const approval = bypassApproval(fixture, intent);
    if (
      approval?.approved_by === "user" &&
      approval?.approval_source === "host-user-input-event" &&
      approval?.content_sha === intent.content_sha &&
      approval?.write_intent_id === intent.id &&
      !fixture.intent_regenerated
    ) {
      continue;
    }
    return { status: "halt", reason: "unsupported-risky-shape" };
  }
  return { status: "pass", reason: "pass" };
}

export function branchIntentVerdict(fixture) {
  const intents = fixture.write_intents;
  if (Array.isArray(intents) && intents.length === 0) {
    return { status: "halt", reason: "no-pre-write-inspectable-intent" };
  }
  if (intents?.some((intent) => {
    const branch = intent.branch ?? fixture.branch;
    return (
      ((branch === "A" || branch === "C-fallthrough-A") && intent.kind && intent.kind !== "generated_patch") ||
      (branch === "B" && intent.kind && intent.kind !== "verbatim_doc_content") ||
      (branch === "D" && intent.kind && intent.kind !== "process_rule_content")
    );
  })) {
    return { status: "halt", reason: "branch-kind-mismatch" };
  }
  if (intents?.some((intent) => intent.kind === "generated_patch" && (!Array.isArray(intent.proposed_edits) || intent.proposed_edits.length === 0))) {
    return { status: "halt", reason: "missing-proposed-edits" };
  }
  return { status: "pass", reason: "pass" };
}

export function staleVerdict(fixture) {
  for (const intent of fixture.write_intents ?? []) {
    if (intent.recorded_content_sha) {
      const live = intent.proposed_edits ? multiEditSha(intent.proposed_edits) : sha256(intentContent(intent));
      if (live !== intent.recorded_content_sha) {
        return { status: "halt", reason: "stale-write-intent-content-mismatch" };
      }
    }
  }
  if (fixture.recorded_content_sha && fixture.exact_content && sha256(fixture.exact_content) !== fixture.recorded_content_sha) {
    return { status: "halt", reason: "stale-write-intent-content-mismatch" };
  }
  return { status: "pass", reason: "pass" };
}

export function bypassVerdict(fixture) {
  for (const intent of fixture.write_intents ?? [fixture]) {
    const approval = bypassApproval(fixture, intent);
    if (!approval) continue;
    if (fixture.intent_regenerated) {
      return { status: "halt", reason: "bypass-invalidated-after-regeneration" };
    }
    if (
      approval.write_intent_id !== intent.id ||
      approval.shape !== "unsupported-risky-shape" ||
      approval.approved_by !== "user" ||
      approval.approval_source !== "host-user-input-event" ||
      !approval.approval_event_id ||
      !approval.user_approved_at ||
      !approval.reason ||
      !approval.scope ||
      (!approval.expires_at && !approval.expires_condition)
    ) {
      return { status: "halt", reason: "model-authored-bypass-rejected" };
    }
    if (!approval.content_sha || approval.content_sha !== intent.content_sha) {
      return { status: "halt", reason: "bypass-content-sha-mismatch" };
    }
  }
  return { status: "pass", reason: "pass" };
}

function checkerFor(language) {
  if (language === "bash") return commandExists("bash") ? ["bash", ["-n"]] : null;
  if (language === "zsh") return commandExists("zsh") ? ["zsh", ["-n"]] : null;
  if (language === "sh") {
    if (commandExists("dash")) return ["dash", ["-n"]];
    if (commandExists("busybox")) return ["busybox", ["sh", "-n"]];
    return commandExists("sh") ? ["sh", ["-n"]] : null;
  }
  return null;
}

function commandExists(command) {
  if (!/^[a-z0-9_-]+$/i.test(command)) return false;
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function shellSyntaxVerdict(fixture) {
  if (!requiredAssertions(fixture).has("shell-syntax-valid")) return { status: "pass", reason: "pass" };
  const candidates = (fixture.write_intents?.length ? fixture.write_intents : [fixture])
    .filter((intent) => intent.content_shape === "shell" || intent.language || /```(?:bash|sh|zsh|shell)\b/i.test(intentContent(intent) || fixture.exact_content || ""));
  for (const intent of candidates) {
    const language = intent.language ?? fixture.language ?? "sh";
    if (fixture.host_has_zsh === false && language === "zsh") {
      return { status: "halt", reason: "shell-checker-unavailable" };
    }
    const checker = checkerFor(language);
    if (!checker) return { status: "halt", reason: "shell-checker-unavailable" };
    const content = intentContent(intent) || fixture.exact_content || "";
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aivv-prewrite-"));
    const file = path.join(dir, `check.${language}`);
    try {
      fs.writeFileSync(file, stripShellFence(content), "utf8");
      execFileSync(checker[0], [...checker[1], file], { stdio: "ignore", timeout: 5000 });
    } catch {
      return { status: "halt", reason: language === "sh" ? "shell-syntax-invalid-posix" : "shell-syntax-invalid" };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  return { status: "pass", reason: "pass" };
}

export function confidenceVerdict(fixture) {
  const candidates = fixture.write_intents?.length ? fixture.write_intents : [fixture];
  for (const intent of candidates) {
    const intentShapes = [
      intent.content_shape,
      ...(intent.detector_result?.content_shapes ?? [])
    ].filter(Boolean);
    if (!intentShapes.length && !intent.exact_content && !intent.exact_content_or_patch) continue;
    if (intentShapes.some((shape) => UNSUPPORTED_SHAPES.has(shape))) continue;
    const confidence = intent.detection_confidence ?? intent.detector_result?.detection_confidence ?? fixture.detection_confidence;
    if (confidence === "low") return { status: "halt", reason: "detector-default-deny" };
    if (confidence === "medium" && fixture.challenge_budget_remaining === 0) {
      return { status: "halt", reason: "medium-confidence-no-budget-skip" };
    }
    if (!confidence) return { status: "halt", reason: "detector-confidence-missing" };
  }
  return { status: "pass", reason: "pass" };
}

function stripShellFence(content) {
  const match = content.match(/```(?:bash|sh|zsh|shell)\b\n([\s\S]*?)\n```/i);
  return match ? match[1] : content;
}

function jsonBlocks(fixture, intent) {
  const text = intentContent(intent) || fixture.exact_content || fixture.exact_content_or_patch || JSON.stringify(fixture);
  const blocks = [...text.matchAll(/```(?:json|jsonschema)\b\n([\s\S]*?)\n```/gi)].map((match) => match[1]);
  return blocks.length ? blocks : [text].filter((candidate) => /^\s*[{[]/.test(candidate));
}

function parseJsonBlock(fixture, assertion) {
  const blocks = jsonBlocks(fixture, assertion.intent);
  const blockId = Number(assertion.args?.block_id ?? assertion.block_id ?? 1);
  const block = blocks[Math.max(0, blockId - 1)];
  if (!block) return { ok: false, reason: "pre-write-validate-json-block-missing" };
  try {
    if (commandExists("jq")) {
      execFileSync("jq", ["empty"], { input: block, stdio: ["pipe", "ignore", "ignore"], timeout: 5000 });
    } else {
      JSON.parse(block);
    }
    return { ok: true, value: JSON.parse(block) };
  } catch {
    return { ok: false, reason: "pre-write-validate-jq-empty-failed" };
  }
}

function getPath(object, dottedPath) {
  if (!dottedPath) return object;
  return dottedPath.split(".").reduce((current, segment) => current?.[segment], object);
}

function findRefs(object, refs = []) {
  if (!object || typeof object !== "object") return refs;
  if (typeof object.$ref === "string" && object.$ref.startsWith("#/")) refs.push(object.$ref);
  for (const value of Object.values(object)) findRefs(value, refs);
  return refs;
}

function hasJsonPointer(object, pointer) {
  const parts = pointer.slice(2).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  let current = object;
  for (const part of parts) {
    current = current?.[part];
    if (current === undefined) return false;
  }
  return true;
}

function logicalPaths(object, prefix = "", seen = new Map()) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return seen;
  for (const [key, value] of Object.entries(object)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    const normalized = pathKey.split(".").join("/");
    seen.set(normalized, (seen.get(normalized) ?? 0) + 1);
    logicalPaths(value, pathKey, seen);
  }
  return seen;
}

function hasDottedKey(object) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return false;
  return Object.entries(object).some(([key, value]) => key.includes(".") || hasDottedKey(value));
}

export function assertionExecutionVerdict(fixture) {
  for (const assertion of assertionRecords(fixture)) {
    if (assertion.kind === "jq-parses") {
      const parsed = parseJsonBlock(fixture, assertion);
      if (!parsed.ok) return { status: "halt", reason: parsed.reason };
    }
    if (assertion.kind === "schema-coherence") {
      if (fixture.schema_coherence_case) return { status: "halt", reason: "schema-coherence-failed" };
      const parsed = parseJsonBlock(fixture, assertion);
      if (!parsed.ok) return { status: "halt", reason: parsed.reason };
      const proposed = parsed.value;
      if (hasDottedKey(proposed)) return { status: "halt", reason: "schema-coherence-failed" };
      if ([...logicalPaths(proposed).values()].some((count) => count > 1)) return { status: "halt", reason: "schema-coherence-failed" };
      for (const ref of findRefs(proposed)) {
        if (!hasJsonPointer(proposed, ref)) return { status: "halt", reason: "schema-coherence-failed" };
      }
      for (const required of proposed.required ?? []) {
        if (!proposed.properties?.[required]) return { status: "halt", reason: "schema-coherence-failed" };
      }
      const parentPath = assertion.args?.parent_schema_path;
      const expectedPath = assertion.args?.expected_nest_path;
      if (parentPath && expectedPath) {
        const parent = JSON.parse(fs.readFileSync(parentPath, "utf8"));
        if (!getPath(parent, expectedPath)) return { status: "halt", reason: "schema-coherence-failed" };
      }
    }
    if (assertion.kind === "line-cite-valid") {
      const args = assertion.args ?? assertion;
      if (!args.temporal_target) return { status: "halt", reason: "missing-temporal-target" };
      const file = args.file;
      const expected = args.expected_snippet;
      if (!file || !expected || !fs.existsSync(file)) return { status: "halt", reason: "pre-write-validate-l-n-citation-mismatch" };
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      const cite = args.cite_form?.match(/^L(\d+)(?:-L(\d+))?$/);
      const range = cite ? lines.slice(Number(cite[1]) - 1, Number(cite[2] ?? cite[1])) : lines;
      if (!range.join("\n").includes(expected)) return { status: "halt", reason: "pre-write-validate-l-n-citation-mismatch" };
    }
  }
  return { status: "pass", reason: "pass" };
}

function validateFixtureAuthorizedScopeBinding(fixture, contextFile, proposalOnly = false) {
  if (!nonBlankString(fixture.invocation_id) || !AIVV_INVOCATION_ID_RE.test(fixture.invocation_id)) {
    return { status: "halt", reason: "fix-log-authorized-scope-invocation-invalid" };
  }
  if (!nonBlankString(contextFile)) {
    return { status: "halt", reason: "fix-log-authorized-scope-context-missing" };
  }

  let storageContext;
  try {
    storageContext = JSON.parse(fs.readFileSync(contextFile, "utf8"));
  } catch {
    return { status: "halt", reason: "fix-log-authorized-scope-context-invalid" };
  }

  let targetProject;
  if (!absolutePath(fixture.target_project)) {
    return { status: "halt", reason: "fix-log-authorized-scope-target-invalid" };
  }
  try {
    targetProject = fs.realpathSync(fixture.target_project);
  } catch {
    return { status: "halt", reason: "fix-log-authorized-scope-target-invalid" };
  }
  if (!plainObject(storageContext) ||
      !absolutePath(storageContext.target) || targetProject !== storageContext.target ||
      !REVIEW_LOG_SHA256_RE.test(storageContext.instance_key ?? "")) {
    return { status: "halt", reason: "fix-log-authorized-scope-target-invalid" };
  }

  let persistedContent;
  try {
    persistedContent = storageRead(contextFile, "state", `fix-${fixture.invocation_id}.json`);
  } catch (error) {
    const stderr = typeof error?.stderr === "string" ? error.stderr : error?.stderr?.toString("utf8") ?? "";
    if (proposalOnly && stderr.includes("STORAGE_NOT_FOUND")) return { status: "pass", reason: "pass" };
    return { status: "halt", reason: "fix-log-authorized-scope-baseline-unavailable" };
  }
  let persistedFixLog;
  try {
    persistedFixLog = JSON.parse(persistedContent);
  } catch {
    return { status: "halt", reason: "fix-log-authorized-scope-baseline-unavailable" };
  }
  if (!plainObject(persistedFixLog) ||
      persistedFixLog.id !== fixture.invocation_id ||
      persistedFixLog.command !== "aivv-fix" || persistedFixLog.status !== "in-progress" ||
      persistedFixLog.target_project !== storageContext.target ||
      !plainObject(persistedFixLog.storage_context) ||
      persistedFixLog.storage_context.instance_key !== storageContext.instance_key ||
      persistedFixLog.storage_context.target_project !== storageContext.target) {
    return { status: "halt", reason: "fix-log-authorized-scope-baseline-mismatch" };
  }

  const baselineScopeVerdict = validateAuthorizedScopeAndRetryState(persistedFixLog);
  if (baselineScopeVerdict.status === "halt") {
    return { status: "halt", reason: "fix-log-authorized-scope-baseline-invalid" };
  }
  if (stableJson(fixture.authorized_scope) !== stableJson(persistedFixLog.authorized_scope)) {
    return { status: "halt", reason: "fix-log-authorized-scope-changed-before-write" };
  }
  return { status: "pass", reason: "pass" };
}

export function validateFixture(fixture, { contextFile, proposalOnly = false } = {}) {
  if (fixture?.command === "aivv-fix" && !plainObject(fixture.authorized_scope)) {
    return { status: "halt", reason: "fix-log-authorized-scope-missing" };
  }
  if (fixture?.command === "aivv-fix") {
    const scopeBindingVerdict = validateFixtureAuthorizedScopeBinding(fixture, contextFile, proposalOnly);
    if (scopeBindingVerdict.status === "halt") return scopeBindingVerdict;
  }
  if (fixture?.authorized_scope !== undefined) {
    if (!plainObject(fixture.authorized_scope) ||
        !validStringArray(fixture.authorized_scope.included_paths) ||
        !validStringArray(fixture.authorized_scope.excluded_paths)) {
      return { status: "halt", reason: "fix-log-authorized-path-boundary-invalid" };
    }
    const scopePathVerdict = validateAuthorizedWritePaths(fixture);
    if (scopePathVerdict.status === "halt") return scopePathVerdict;
  }
  for (const check of [branchIntentVerdict, staleVerdict, bypassVerdict, detectorVerdict]) {
    const verdict = check(fixture);
    if (verdict.status === "halt") return verdict;
  }
  const required = requiredAssertions(fixture);
  if (required.size > 0 && !hasAllRequiredAssertions(fixture)) {
    if (required.has("schema-coherence")) return { status: "halt", reason: "incomplete-required-assertion" };
    if (required.has("shell-syntax-valid")) return { status: "halt", reason: "missing-required-assertion:shell-syntax-valid" };
    if (required.has("line-cite-valid")) return { status: "halt", reason: "missing-required-assertion:line-cite-valid" };
    return { status: "halt", reason: "missing-required-assertion" };
  }
  if (fixture.assertion?.kind === "line-cite-valid" && !fixture.assertion.temporal_target) {
    return { status: "halt", reason: "missing-temporal-target" };
  }
  const assertionExecution = assertionExecutionVerdict(fixture);
  if (assertionExecution.status === "halt") return assertionExecution;
  const shell = shellSyntaxVerdict(fixture);
  if (shell.status === "halt") return shell;
  if (fixture.challenge_budget_remaining === 0 && fixture.write_intents?.some((intent) => intent.content_shape !== "plain-prose")) {
    return { status: "halt", reason: "challenge-budget-halted-risky-write-intent" };
  }
  const confidence = confidenceVerdict(fixture);
  if (confidence.status === "halt") return confidence;
  return proposalOnly && fixture.command === "aivv-fix"
    ? { status: "pass", reason: "pass", proposal_only: true, write_authorized: false }
    : { status: "pass", reason: "pass" };
}

function nonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validProportionalRemediation(value) {
  const fields = ["present_problem", "simplest_viable_correction", "net_complexity", "why_current_shape_insufficient"];
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((field) => typeof value[field] === "string" && value[field].trim().length >= 8)
  );
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (plainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function absolutePath(value) {
  return nonBlankString(value) && !value.includes("\0") &&
    /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(value);
}

// Provenance preserves the original policy lookup across handoffs; it grants no
// authority. The receiver still resolves its current storage instance and policy.
function validateStorageContext(context, targetProject, prefix) {
  if (context === undefined) return { status: "pass", reason: "pass" };
  const fields = ["instance_key", "target_project", "policy_target"];
  if (
    !plainObject(context) || Object.keys(context).length !== fields.length ||
    !fields.every((field) => Object.hasOwn(context, field)) ||
    typeof context.instance_key !== "string" || !/^[0-9a-f]{64}$/.test(context.instance_key) ||
    !absolutePath(context.target_project) || !absolutePath(context.policy_target)
  ) return { status: "halt", reason: `${prefix}-storage-context-invalid` };
  if (context.target_project !== targetProject) {
    return { status: "halt", reason: `${prefix}-storage-context-target-mismatch` };
  }
  return { status: "pass", reason: "pass" };
}

function validateFixLogLifecycleContext(fixLog) {
  const context = fixLog.lifecycle_context;
  if (context === undefined) return { status: "pass", reason: "pass" };
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return { status: "halt", reason: "fix-log-lifecycle-context-invalid" };
  }
  if (
    !FIX_LOG_LIFECYCLE_SELECTOR_TYPE_ENUM.has(context.selector_type) ||
    !FIX_LOG_LIFECYCLE_RECORD_KIND_ENUM.has(context.record_kind) ||
    !FIX_LOG_LIFECYCLE_SOURCE_MODE_ENUM.has(context.source_mode) ||
    !nonBlankString(context.selector) ||
    !nonBlankString(context.record_id) ||
    !nonBlankString(context.record_path)
  ) {
    return { status: "halt", reason: "fix-log-lifecycle-context-invalid" };
  }
  if (fixLog.source !== "review_id" && context.source_mode !== "investigation-only") {
    return { status: "halt", reason: "fix-log-lifecycle-context-source-mismatch" };
  }
  if (
    fixLog.source === "review_id" &&
    nonBlankString(context.source_review_id) &&
    nonBlankString(fixLog.source_review_id) &&
    context.source_review_id !== fixLog.source_review_id
  ) {
    return { status: "halt", reason: "fix-log-lifecycle-context-source-review-id-mismatch" };
  }
  return { status: "pass", reason: "pass" };
}

function validReviewLogLocation(finding) {
  const hasFile = nonBlankString(finding.file);
  const hasScope = finding.scope_ref && typeof finding.scope_ref === "object" && !Array.isArray(finding.scope_ref);
  if (hasFile === Boolean(hasScope)) return false;
  if (hasFile) return finding.scope_ref === undefined;
  if (finding.line !== undefined) return false;
  return (
    REVIEW_LOG_SCOPE_KIND_ENUM.has(finding.scope_ref.kind) &&
    nonBlankString(finding.scope_ref.ref)
  );
}

function validReviewLogEvidence(value) {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      REVIEW_LOG_EVIDENCE_KIND_ENUM.has(item.kind) &&
      nonBlankString(item.ref) &&
      (item.excerpt === undefined || typeof item.excerpt === "string" || item.excerpt === null)
    ));
}

function findingRefs(reviewLog) {
  return new Set((reviewLog.findings ?? [])
    .map((finding) => finding?.ref)
    .filter(nonBlankString));
}

function validStringArray(value) {
  return Array.isArray(value) && value.every(nonBlankString);
}

function validNonEmptyStringArray(value) {
  return validStringArray(value) && value.length > 0;
}

function validReviewLogDateTime(value) {
  const match = typeof value === "string" ? REVIEW_LOG_RFC3339_DATE_TIME_RE.exec(value) : null;
  if (!match) return false;
  const normalized = value.replace("t", "T").replace("z", "Z");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return false;
  const [, year, month, day, hour, minute, second] = match;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  const localDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return localDate.getUTCFullYear() === Number(year) &&
    localDate.getUTCMonth() + 1 === Number(month) &&
    localDate.getUTCDate() === Number(day);
}

function refsJoinFindings(refs, knownRefs) {
  if (refs === undefined) return true;
  return validStringArray(refs) && refs.every((ref) => knownRefs.has(ref));
}

function requiredRefsJoinFindings(refs, knownRefs) {
  return validNonEmptyStringArray(refs) && refs.every((ref) => knownRefs.has(ref));
}

function sameStringSet(left, right) {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== left.length) return false;
  return leftSet.size === rightSet.size && [...leftSet].every((item) => rightSet.has(item));
}

function trustSummaryMatchesTopLevel(reviewLog, trust) {
  if (nonBlankString(reviewLog.review_mode) && trust.review_mode !== reviewLog.review_mode) return false;
  if (Number.isInteger(reviewLog.reviewers) && trust.reviewers.count !== reviewLog.reviewers) return false;
  if (typeof reviewLog.lens === "string") return sameStringSet(trust.lenses.applied, [reviewLog.lens]);
  if (Array.isArray(reviewLog.lens)) return sameStringSet(trust.lenses.applied, [...new Set(reviewLog.lens)]);
  return true;
}

function validateTrustSummary(reviewLog) {
  const trust = reviewLog.trust_summary;
  if (reviewLog.status === "completed" && trust === undefined) {
    return { status: "halt", reason: "review-log-trust-summary-missing" };
  }
  if (trust === undefined) return { status: "pass", reason: "pass" };
  if (!plainObject(trust)) {
    return { status: "halt", reason: "review-log-trust-summary-invalid" };
  }
  if (
    !nonBlankString(trust.review_mode) ||
    !plainObject(trust.reviewers) ||
    !Number.isInteger(trust.reviewers.count) ||
    trust.reviewers.count < 1 ||
    !validStringArray(trust.reviewers.labels) ||
    !plainObject(trust.lenses) ||
    !validStringArray(trust.lenses.applied) ||
    !validStringArray(trust.lenses.detected) ||
    !REVIEW_LOG_TRUST_AGREEMENT_ENUM.has(trust.agreement) ||
    !plainObject(trust.filtering) ||
    !Number.isInteger(trust.filtering.hidden_count) ||
    trust.filtering.hidden_count < 0 ||
    !Number.isInteger(trust.filtering.forced_show_count) ||
    trust.filtering.forced_show_count < 0 ||
    !validStringArray(trust.evidence_posture) ||
    !validStringArray(trust.high_risk_not_applied ?? []) ||
    !validStringArray(trust.capability_degradations ?? [])
  ) {
    return { status: "halt", reason: "review-log-trust-summary-invalid" };
  }
  if (!trustSummaryMatchesTopLevel(reviewLog, trust)) {
    return { status: "halt", reason: "review-log-trust-summary-invalid" };
  }
  return { status: "pass", reason: "pass" };
}

function validateDecisionCheckpoint(reviewLog) {
  const checkpoint = reviewLog.decision_checkpoint;
  if (reviewLog.status === "completed" && checkpoint === undefined) {
    return { status: "halt", reason: "review-log-decision-checkpoint-missing" };
  }
  if (checkpoint === undefined) return { status: "pass", reason: "pass" };
  if (!plainObject(checkpoint) || typeof checkpoint.required !== "boolean") {
    return { status: "halt", reason: "review-log-decision-checkpoint-invalid" };
  }
  if (typeof checkpoint.interactive !== "boolean") {
    return { status: "halt", reason: "review-log-decision-checkpoint-invalid" };
  }
  if (!validStringArray(checkpoint.reason_codes)) {
    return { status: "halt", reason: "review-log-decision-checkpoint-invalid" };
  }
  if (!validReviewLogDateTime(checkpoint.recorded_at)) {
    return { status: "halt", reason: "review-log-decision-checkpoint-invalid" };
  }
  if (checkpoint.required && !REVIEW_LOG_CHECKPOINT_OUTCOME_ENUM.has(checkpoint.outcome)) {
    return { status: "halt", reason: "review-log-decision-checkpoint-invalid" };
  }
  if (!checkpoint.required && checkpoint.outcome !== undefined && !REVIEW_LOG_CHECKPOINT_OUTCOME_ENUM.has(checkpoint.outcome)) {
    return { status: "halt", reason: "review-log-decision-checkpoint-invalid" };
  }
  const knownRefs = findingRefs(reviewLog);
  if (!refsJoinFindings(checkpoint.selected_finding_refs, knownRefs)) {
    return { status: "halt", reason: "review-log-decision-checkpoint-join-invalid" };
  }
  if (checkpoint.outcome === "select-findings" && !requiredRefsJoinFindings(checkpoint.selected_finding_refs, knownRefs)) {
    return { status: "halt", reason: "review-log-decision-checkpoint-join-invalid" };
  }
  return { status: "pass", reason: "pass" };
}

function validAssuranceRefItem(item) {
  return plainObject(item) &&
    nonBlankString(item.id) &&
    validNonEmptyStringArray(item.applies_to_finding_refs);
}

function validateAssurancePlan(reviewLog) {
  const assurance = reviewLog.assurance_plan;
  if (reviewLog.status === "completed" && reviewLog.findings.length > 0 && assurance === undefined) {
    return { status: "halt", reason: "review-log-assurance-plan-missing" };
  }
  if (assurance === undefined) return { status: "pass", reason: "pass" };
  const knownRefs = findingRefs(reviewLog);
  if (
    !plainObject(assurance) ||
    !nonBlankString(assurance.scope) ||
    !REVIEW_LOG_ASSURANCE_CRITICALITY_ENUM.has(assurance.criticality) ||
    !Array.isArray(assurance.required_evidence) ||
    assurance.required_evidence.length === 0 ||
    !Array.isArray(assurance.acceptance_criteria) ||
    assurance.acceptance_criteria.length === 0
  ) {
    return { status: "halt", reason: "review-log-assurance-plan-invalid" };
  }
  for (const item of assurance.required_evidence) {
    if (
      !validAssuranceRefItem(item) ||
      !REVIEW_LOG_ASSURANCE_EVIDENCE_KIND_ENUM.has(item.kind) ||
      typeof item.required !== "boolean"
    ) {
      return { status: "halt", reason: "review-log-assurance-plan-invalid" };
    }
    if (!requiredRefsJoinFindings(item.applies_to_finding_refs, knownRefs)) {
      return { status: "halt", reason: "review-log-assurance-plan-join-invalid" };
    }
  }
  for (const item of assurance.acceptance_criteria) {
    if (!validAssuranceRefItem(item) || !nonBlankString(item.statement)) {
      return { status: "halt", reason: "review-log-assurance-plan-invalid" };
    }
    if (!requiredRefsJoinFindings(item.applies_to_finding_refs, knownRefs)) {
      return { status: "halt", reason: "review-log-assurance-plan-join-invalid" };
    }
  }
  return { status: "pass", reason: "pass" };
}

// Structured audit blocks below are optional for historical logs, but when present they
// must match .aivv/schemas/review-log.json — a shape the durable schema allows and this
// gate skipped is a schema-invalid log written to durable state (). Absence stays
// valid; only malformed presence halts. tools/validate.sh Stage 47 backstops drift here.

function optionalNonBlankString(value) {
  return value === undefined || nonBlankString(value);
}

function optionalNullableString(value) {
  return value === undefined || value === null || typeof value === "string";
}

function optionalBoolean(value) {
  return value === undefined || typeof value === "boolean";
}

function optionalSha256(value) {
  return value === undefined || (typeof value === "string" && REVIEW_LOG_SHA256_RE.test(value));
}

function optionalStringArray(value) {
  return value === undefined || validStringArray(value);
}

function optionalNonNegativeInteger(value) {
  return value === undefined || (Number.isInteger(value) && value >= 0);
}

function validReviewScopeEvidenceSource(item) {
  return plainObject(item) &&
    nonBlankString(item.kind) &&
    nonBlankString(item.summary) &&
    optionalNonBlankString(item.ref);
}

function validReviewScopeConfirmation(value, invocationId, finalScope, requireBinding = false) {
  if (value === undefined) return true;
  if (!plainObject(value)) return false;
  if (!requireBinding && (
    !optionalNonBlankString(value.mode) ||
    !optionalNonBlankString(value.classification_reason) ||
    !optionalNonBlankString(value.user_choice)
  )) return false;
  const bindingFieldsPresent = value.proposal_id !== undefined ||
    value.proposal_revision !== undefined || value.resolved_method !== undefined ||
    value.invocation_id !== undefined || value.confirmed_scope !== undefined;
  if (!bindingFieldsPresent) return !requireBinding;
  if (requireBinding && (
    !["announce", "ask"].includes(value.mode) ||
    !nonBlankString(value.classification_reason) ||
    typeof value.was_trivial !== "boolean" ||
    !nonBlankString(value.proposed_scope) ||
    !validStringArray(value.options_offered) ||
    !nonBlankString(value.user_choice)
  )) return false;
  return nonBlankString(value.invocation_id) && value.invocation_id === invocationId &&
    Number.isInteger(value.proposal_revision) && value.proposal_revision >= 1 &&
    value.proposal_id === `${invocationId}:scope:${value.proposal_revision}` &&
    nonBlankString(value.confirmed_scope) && value.confirmed_scope === finalScope &&
    (requireBinding ? plainObject(value.resolved_method) : (value.resolved_method === undefined || optionalNonBlankString(value.resolved_method) || plainObject(value.resolved_method)));
}

function validateReviewScope(reviewLog, { requireConfirmationBinding = false } = {}) {
  const scope = reviewLog.review_scope;
  if (scope === undefined) {
    return requireConfirmationBinding
      ? { status: "halt", reason: "review-log-scope-confirmation-missing" }
      : { status: "pass", reason: "pass" };
  }
  if (
    !plainObject(scope) ||
    !REVIEW_LOG_SUBJECT_TYPE_ENUM.has(scope.subject_type) ||
    !nonBlankString(scope.final_scope) ||
    !optionalNonBlankString(scope.target_project) ||
    !optionalNonBlankString(scope.state_target) ||
    !optionalStringArray(scope.included_files) ||
    !optionalStringArray(scope.excluded_or_dropped_scope) ||
    (requireConfirmationBinding && scope.scope_confirmation === undefined) ||
    !validReviewScopeConfirmation(
      scope.scope_confirmation,
      reviewLog.id,
      scope.final_scope,
      requireConfirmationBinding,
    )
  ) {
    return { status: "halt", reason: "review-log-review-scope-invalid" };
  }
  if (scope.evidence_sources !== undefined) {
    if (!Array.isArray(scope.evidence_sources) || !scope.evidence_sources.every(validReviewScopeEvidenceSource)) {
      return { status: "halt", reason: "review-log-review-scope-invalid" };
    }
  }
  return { status: "pass", reason: "pass" };
}

function validReviewerRosterEntry(entry) {
  return plainObject(entry) &&
    nonBlankString(entry.label) &&
    nonBlankString(entry.display_name) &&
    nonBlankString(entry.dispatch_path) &&
    REVIEW_LOG_LENS_ENUM.has(entry.lens) &&
    REVIEW_LOG_ROSTER_STATUS_ENUM.has(entry.status) &&
    optionalNullableString(entry.provider) &&
    optionalNullableString(entry.model) &&
    optionalNullableString(entry.model_source) &&
    optionalNullableString(entry.reasoning) &&
    optionalNullableString(entry.status_reason) &&
    (entry.finding_refs === undefined || (
      Array.isArray(entry.finding_refs) &&
      entry.finding_refs.every((ref) => typeof ref === "string" && REVIEW_LOG_FINDING_REF_RE.test(ref))
    ));
}

function sameJsonValue(left, right) {
  return stableJson(left) === stableJson(right);
}

function renderBoundReviewMethodDisplay(method) {
  const reviewers = method.reviewers.map((reviewer) => {
    const provider = reviewer.provider ?? "unreported";
    const model = reviewer.model === "inherited" ? "inherited/unreported" : (reviewer.model ?? "unreported");
    const reasoning = reviewer.reasoning ?? "unreported";
    return `${reviewer.label}/${reviewer.lens} via ${reviewer.dispatch_path} provider=${provider} model=${model} reasoning=${reasoning}`;
  });
  const reviewerNoun = method.reviewer_count === 1 ? "reviewer" : "reviewers";
  return `${method.reviewer_count} ${reviewerNoun}; mode ${method.review_mode}; lenses ${method.lenses.join(", ")}; ` +
    `${method.thoroughness} depth; ${method.replication_count} ${method.replication_count === 1 ? "reviewer" : "reviewers"} per lens; ` +
    `direction ${method.direction_enabled ? "on" : "off"}; severity model ${method.severity_model}; ${reviewers.join("; ")}`;
}

function validateBoundReviewMethod(reviewLog) {
  const method = reviewLog.review_scope?.scope_confirmation?.resolved_method;
  const profile = reviewLog.review_prompt_profile;
  const roster = reviewLog.reviewer_roster;
  if (!plainObject(method) || !Array.isArray(roster) || !plainObject(profile)) {
    return { status: "halt", reason: "review-log-bound-method-metadata-missing" };
  }
  if (!nonBlankString(method.display) ||
      !Number.isInteger(method.reviewer_count) || method.reviewer_count < 1 || method.reviewer_count > 16 ||
      !validStringArray(method.lenses) || method.lenses.length === 0 ||
      new Set(method.lenses).size !== method.lenses.length ||
      method.lenses.some((lens) => !REVIEW_LOG_LENS_ENUM.has(lens)) ||
      !["cold_single_review", "cold_multi_review", "cold_multi_model", "same_agent_review", "evidence_only_review"].includes(method.review_mode) ||
      !nonBlankString(method.thoroughness) || typeof method.direction_enabled !== "boolean" ||
      !nonBlankString(method.severity_model) ||
      !Number.isInteger(method.replication_count) || method.replication_count < 1 || method.replication_count > 16 ||
      !Array.isArray(method.reviewers) || method.reviewers.length !== method.reviewer_count ||
      roster.length !== method.reviewer_count || reviewLog.reviewers !== method.reviewer_count ||
      profile.reviewer_count !== method.reviewer_count || profile.thoroughness !== method.thoroughness ||
      profile.direction_enabled !== method.direction_enabled || profile.severity_model !== method.severity_model ||
      method.review_mode !== reviewLog.review_mode || !sameJsonValue(profile.lens, reviewLog.lens)) {
    return { status: "halt", reason: "review-log-bound-method-invalid" };
  }

  const assignedLenses = roster.map((entry) => entry.lens);
  const uniqueLenses = [...new Set(assignedLenses)];
  const topLevelLensMatches = Array.isArray(reviewLog.lens)
    ? sameJsonValue(reviewLog.lens, assignedLenses)
    : assignedLenses.every((lens) => lens === reviewLog.lens);
  if (!sameJsonValue(method.lenses, uniqueLenses) ||
      !topLevelLensMatches) {
    return { status: "halt", reason: "review-log-bound-method-lens-mismatch" };
  }

  const counts = new Map();
  for (const lens of assignedLenses) counts.set(lens, (counts.get(lens) || 0) + 1);
  const replications = [...counts.values()];
  if (replications.some((count) => count !== replications[0]) ||
      method.replication_count !== replications[0]) {
    return { status: "halt", reason: "review-log-bound-method-replication-mismatch" };
  }

  const reviewerSettings = roster.map((entry) => ({
    label: entry.label,
    lens: entry.lens,
    dispatch_path: entry.dispatch_path,
    provider: entry.provider ?? null,
    model: entry.model ?? null,
    reasoning: entry.reasoning ?? null,
  }));
  if (!Array.isArray(method.reviewers) || method.reviewers.some((entry) =>
    !plainObject(entry) || !Object.prototype.hasOwnProperty.call(entry, "provider") ||
    !Object.prototype.hasOwnProperty.call(entry, "model") ||
    !Object.prototype.hasOwnProperty.call(entry, "reasoning")) ||
    !sameJsonValue(method.reviewers, reviewerSettings)) {
    return { status: "halt", reason: "review-log-bound-method-reviewer-settings-mismatch" };
  }
  if (method.display !== renderBoundReviewMethodDisplay(method)) {
    return { status: "halt", reason: "review-log-bound-method-display-mismatch" };
  }
  return { status: "pass", reason: "pass" };
}

function validateReviewerRoster(reviewLog) {
  const roster = reviewLog.reviewer_roster;
  if (roster === undefined) return { status: "pass", reason: "pass" };
  if (!Array.isArray(roster) || !roster.every(validReviewerRosterEntry)) {
    return { status: "halt", reason: "review-log-reviewer-roster-invalid" };
  }
  return { status: "pass", reason: "pass" };
}

function validatePlanReview(reviewLog) {
  const planReview = reviewLog.plan_review;
  if (planReview === undefined) return { status: "pass", reason: "pass" };
  if (
    !plainObject(planReview) ||
    !nonBlankString(planReview.plan_path) ||
    typeof planReview.implementation_verified !== "boolean" ||
    !optionalNonBlankString(planReview.verify_skip_reason)
  ) {
    return { status: "halt", reason: "review-log-plan-review-invalid" };
  }
  return { status: "pass", reason: "pass" };
}

function validPromptProfileLens(value) {
  if (value === undefined) return true;
  if (typeof value === "string") return REVIEW_LOG_LENS_ENUM.has(value);
  return Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 16 &&
    value.every((lens) => REVIEW_LOG_LENS_ENUM.has(lens));
}

function validPromptProfileRedactionSummary(value) {
  if (value === undefined) return true;
  return plainObject(value) &&
    optionalNonNegativeInteger(value.redacted_values) &&
    optionalStringArray(value.blocked_paths) &&
    optionalStringArray(value.warnings);
}

function validateReviewPromptProfile(reviewLog) {
  const profile = reviewLog.review_prompt_profile;
  if (profile === undefined) return { status: "pass", reason: "pass" };
  if (
    !plainObject(profile) ||
    !nonBlankString(profile.prompt_name) ||
    !optionalNonBlankString(profile.prompt_version) ||
    !optionalSha256(profile.prompt_sha256) ||
    !optionalSha256(profile.methodology_sha256) ||
    !validPromptProfileLens(profile.lens) ||
    !optionalNonBlankString(profile.thoroughness) ||
    !optionalBoolean(profile.direction_enabled) ||
    !optionalNonBlankString(profile.severity_model) ||
    !optionalBoolean(profile.full_prompt_available) ||
    !validPromptProfileRedactionSummary(profile.redaction_summary) ||
    (profile.reviewer_count !== undefined && (
      !Number.isInteger(profile.reviewer_count) ||
      profile.reviewer_count < 1 ||
      profile.reviewer_count > 16
    ))
  ) {
    return { status: "halt", reason: "review-log-review-prompt-profile-invalid" };
  }
  return { status: "pass", reason: "pass" };
}

function validateReviewerEvidencePacket(reviewLog) {
  const packet = reviewLog.reviewer_evidence_packet;
  if (packet === undefined) return { status: "pass", reason: "pass" };
  if (
    !plainObject(packet) ||
    !nonBlankString(packet.format) ||
    !Number.isInteger(packet.bytes) ||
    packet.bytes < 0 ||
    typeof packet.sha256 !== "string" ||
    !REVIEW_LOG_SHA256_RE.test(packet.sha256) ||
    !optionalBoolean(packet.redacted) ||
    !optionalBoolean(packet.truncated) ||
    (packet.content !== undefined && typeof packet.content !== "string") ||
    !optionalNullableString(packet.omitted_reason)
  ) {
    return { status: "halt", reason: "review-log-reviewer-evidence-packet-invalid" };
  }
  return { status: "pass", reason: "pass" };
}

function validateProviderTrust(reviewLog) {
  const trust = reviewLog.provider_trust;
  if (trust === undefined) return { status: "pass", reason: "pass" };
  if (
    !plainObject(trust) ||
    typeof trust.allowed !== "boolean" ||
    typeof trust.provider !== "string" ||
    typeof trust.auth_mode !== "string" ||
    typeof trust.destination_shape !== "string" ||
    !optionalNullableString(trust.model) ||
    !validStringArray(trust.evidence_classes) ||
    !validStringArray(trust.source_classes) ||
    typeof trust.policy_sha256 !== "string" ||
    !REVIEW_LOG_SHA256_RE.test(trust.policy_sha256) ||
    typeof trust.trust_signature !== "string" ||
    !REVIEW_LOG_SHA256_RE.test(trust.trust_signature) ||
    !optionalSha256(trust.prompt_sha256) ||
    !optionalNonNegativeInteger(trust.prompt_bytes) ||
    !Array.isArray(trust.blocked_paths) ||
    !Array.isArray(trust.redactions) ||
    !Array.isArray(trust.warnings)
  ) {
    return { status: "halt", reason: "review-log-provider-trust-invalid" };
  }
  return { status: "pass", reason: "pass" };
}

function isRuntimeEvidenceIngestError(error) {
  return error.includes("runtime_evidence_ingest");
}

function normalizedFindingId(value) {
  if (!nonBlankString(value)) return null;
  const match = value.match(/^F-?[A-Z]?([0-9]+)(?:[-_].*)?$/i);
  if (!match) return value.trim();
  return `F${Number(match[1])}`;
}

function normalizedFindingIdentityKey(value) {
  if (!nonBlankString(value)) return null;
  const trimmed = value.trim();
  const numeric = trimmed.match(/^F0*([0-9]+)$/i);
  if (numeric) return `numeric:F${Number(numeric[1])}`;
  return `literal:${trimmed}`;
}

function canonicalProjectRelativePath(value, allowRoot = false) {
  if (!nonBlankString(value)) return null;
  const slashPath = value.trim().replaceAll("\\", "/");
  if (slashPath.startsWith("/") || /^[A-Za-z]:/.test(slashPath) ||
      slashPath.split("/").includes("..") || /[*?\[\]]/.test(slashPath)) return null;
  const normalized = path.posix.normalize(slashPath);
  if (normalized === ".") return allowRoot ? "." : null;
  if (normalized === ".." || normalized.startsWith("../")) return null;
  return normalized;
}

function pathMatchesScopeBoundary(target, boundary) {
  const comparableTarget = process.platform === "win32" ? target.toLowerCase() : target;
  const comparableBoundary = process.platform === "win32" ? boundary.toLowerCase() : boundary;
  return comparableBoundary === "." || comparableTarget === comparableBoundary ||
    comparableTarget.startsWith(`${comparableBoundary}/`);
}

function hasNormalizedFindingIdCollision(ids) {
  const identitiesByNormalized = new Map();
  for (const id of ids) {
    const normalized = normalizedFindingId(id);
    if (!normalized) continue;
    const identity = normalizedFindingIdentityKey(id);
    if (!identity) continue;
    if (!identitiesByNormalized.has(normalized)) {
      identitiesByNormalized.set(normalized, new Set());
    }
    identitiesByNormalized.get(normalized).add(identity);
  }
  return [...identitiesByNormalized.values()].some((identities) => identities.size > 1);
}

function hasAppliedChanges(fixLog) {
  return Array.isArray(fixLog.changes_summary) && fixLog.changes_summary.length > 0;
}

function dangerousChangeCount(fixLog) {
  return (fixLog.changes_summary ?? []).filter((change) =>
    change?.dangerously_auto_apply === true ||
    (Array.isArray(change?.bypassed_gates) && change.bypassed_gates.length > 0)
  ).length;
}

function validRequiredVerification(item) {
  return plainObject(item) &&
    nonBlankString(item.id) &&
    nonBlankString(item.kind) &&
    validNonEmptyStringArray(item.command_argv) &&
    typeof item.required === "boolean";
}

function validateGeneratedVerification(generated) {
  if (
    !plainObject(generated) ||
    typeof generated.present !== "boolean" ||
    typeof generated.execution_allowed !== "boolean" ||
    !FIX_LOG_GENERATED_VERIFICATION_POLICY_ENUM.has(generated.policy)
  ) {
    return { status: "halt", reason: "fix-log-change-readiness-generated-verification-invalid" };
  }
  if (!generated.present && (generated.execution_allowed || generated.policy !== "inspect-only")) {
    return { status: "halt", reason: "fix-log-change-readiness-generated-verification-invalid" };
  }
  if (generated.execution_allowed && generated.policy === "inspect-only") {
    return { status: "halt", reason: "fix-log-change-readiness-generated-verification-invalid" };
  }
  return { status: "pass", reason: "pass" };
}

function validateChangeReadiness(fixLog) {
  if (!hasAppliedChanges(fixLog)) return { status: "pass", reason: "pass" };
  const readiness = fixLog.change_readiness;
  if (readiness === undefined) {
    return { status: "halt", reason: "fix-log-change-readiness-missing" };
  }
  if (
    !plainObject(readiness) ||
    !FIX_LOG_READINESS_RISK_ENUM.has(readiness.risk_tier) ||
    !validNonEmptyStringArray(readiness.affected_surfaces) ||
    !FIX_LOG_READINESS_APPROVAL_ENUM.has(readiness.approval_mode) ||
    !Array.isArray(readiness.required_verification) ||
    readiness.required_verification.length === 0 ||
    readiness.required_verification.some((item) => !validRequiredVerification(item)) ||
    !nonBlankString(readiness.monitoring_plan) ||
    !FIX_LOG_READINESS_GO_ENUM.has(readiness.go_no_go)
  ) {
    return { status: "halt", reason: "fix-log-change-readiness-invalid" };
  }
  const generatedVerdict = validateGeneratedVerification(readiness.generated_verification);
  if (generatedVerdict.status === "halt") return generatedVerdict;
  if (readiness.risk_tier === "high" && readiness.approval_mode === "auto") {
    return { status: "halt", reason: "fix-log-change-readiness-approval-invalid" };
  }
  if (readiness.generated_verification.present && readiness.approval_mode === "auto") {
    return { status: "halt", reason: "fix-log-change-readiness-approval-invalid" };
  }
  if (readiness.go_no_go !== "go" || readiness.approval_mode === "dry-run" || readiness.approval_mode === "skipped") {
    return { status: "halt", reason: "fix-log-change-readiness-approval-invalid" };
  }
  const dangerousChanges = dangerousChangeCount(fixLog);
  if (dangerousChanges > 0 && readiness.approval_mode !== "dangerous-override") {
    return { status: "halt", reason: "fix-log-change-readiness-approval-invalid" };
  }
  if (
    readiness.approval_mode === "dangerous-override" &&
    (
      !plainObject(fixLog.dangerously_auto_apply) ||
      fixLog.dangerously_auto_apply.confirmed !== true ||
      !FIX_LOG_DANGEROUS_CONFIRMATION_SOURCE_ENUM.has(fixLog.dangerously_auto_apply.confirmation_source) ||
      !validNonEmptyStringArray(fixLog.dangerously_auto_apply.bypassed_gates) ||
      !Number.isInteger(fixLog.dangerously_auto_apply.applied_count) ||
      fixLog.dangerously_auto_apply.applied_count < 1 ||
      fixLog.dangerously_auto_apply.applied_count !== dangerousChanges
    )
  ) {
    return { status: "halt", reason: "fix-log-change-readiness-approval-invalid" };
  }
  if (
    readiness.risk_tier === "high" &&
    (!nonBlankString(readiness.rollback_plan) || !readiness.required_verification.some((item) => item.required))
  ) {
    return { status: "halt", reason: "fix-log-change-readiness-high-risk-incomplete" };
  }
  if (!nonBlankString(readiness.rollback_plan)) {
    return { status: "halt", reason: "fix-log-change-readiness-invalid" };
  }
  return { status: "pass", reason: "pass" };
}

function objectiveEvidenceById(fixLog) {
  const entries = new Map();
  for (const item of fixLog.objective_evidence ?? []) {
    if (plainObject(item) && nonBlankString(item.id)) entries.set(item.id, item);
  }
  return entries;
}

function objectiveEvidenceForDisposition(fixLog, disposition) {
  const evidence = objectiveEvidenceById(fixLog);
  return (disposition.evidence_refs ?? [])
    .map((ref) => evidence.get(ref))
    .filter((entry) => entry && entry.finding_id === disposition.finding_id);
}

function validateObjectiveEvidence(fixLog) {
  if (!hasAppliedChanges(fixLog)) return { status: "pass", reason: "pass" };
  if (!Array.isArray(fixLog.objective_evidence)) {
    return { status: "halt", reason: "fix-log-objective-evidence-missing" };
  }
  for (const entry of fixLog.objective_evidence) {
    if (
      !plainObject(entry) ||
      !nonBlankString(entry.id) ||
      !nonBlankString(entry.finding_id) ||
      !FIX_LOG_OBJECTIVE_EVIDENCE_KIND_ENUM.has(entry.kind) ||
      !nonBlankString(entry.ref) ||
      !nonBlankString(entry.outcome)
    ) {
      return { status: "halt", reason: "fix-log-objective-evidence-invalid" };
    }
  }
  return { status: "pass", reason: "pass" };
}

function changedFindingIds(fixLog) {
  return (fixLog.changes_summary ?? [])
    .map((change) => change?.finding_id)
    .filter(nonBlankString);
}

function requiredReadinessEvidenceIds(fixLog) {
  return (fixLog.change_readiness?.required_verification ?? [])
    .filter((item) => item?.required === true)
    .map((item) => item.id)
    .filter(nonBlankString);
}

function evidenceSatisfiesRequiredReadiness(joinedEvidence, requiredIds) {
  if (requiredIds.length === 0) return true;
  const satisfied = new Set(
    joinedEvidence.flatMap((entry) => Array.isArray(entry.satisfies) ? entry.satisfies : [])
  );
  return requiredIds.every((id) => satisfied.has(id));
}

function validateFinalDispositions(fixLog) {
  if (!hasAppliedChanges(fixLog)) return { status: "pass", reason: "pass" };
  if (!Array.isArray(fixLog.final_dispositions)) {
    return { status: "halt", reason: "fix-log-final-dispositions-missing" };
  }
  const dispositionByFinding = new Map();
  for (const disposition of fixLog.final_dispositions) {
    if (
      !plainObject(disposition) ||
      !nonBlankString(disposition.finding_id) ||
      !FIX_LOG_FINAL_DISPOSITION_ENUM.has(disposition.disposition)
    ) {
      return { status: "halt", reason: "fix-log-final-dispositions-invalid" };
    }
    dispositionByFinding.set(disposition.finding_id, disposition);
  }
  const coveredFindingIds = new Set([...(fixLog.findings_addressed ?? []), ...changedFindingIds(fixLog)]);
  for (const findingId of coveredFindingIds) {
    if (nonBlankString(findingId) && !dispositionByFinding.has(findingId)) {
      return { status: "halt", reason: "fix-log-final-disposition-coverage-missing" };
    }
  }
  const requiredEvidenceIds = requiredReadinessEvidenceIds(fixLog);
  for (const disposition of fixLog.final_dispositions) {
    if (!FIX_LOG_TERMINAL_EVIDENCE_DISPOSITIONS.has(disposition.disposition)) continue;
    const joinedEvidence = objectiveEvidenceForDisposition(fixLog, disposition);
    if (disposition.disposition === "false_positive") {
      if (!joinedEvidence.some((entry) => entry.outcome === "refuted")) {
        return { status: "halt", reason: "fix-log-final-disposition-evidence-missing" };
      }
    } else if (joinedEvidence.length === 0) {
      return { status: "halt", reason: "fix-log-final-disposition-evidence-missing" };
    }
    if (!evidenceSatisfiesRequiredReadiness(joinedEvidence, requiredEvidenceIds)) {
      return { status: "halt", reason: "fix-log-final-disposition-evidence-missing" };
    }
    if (disposition.disposition === "closed_with_residual_risk") {
      if (!nonBlankString(disposition.residual_risk)) {
        return { status: "halt", reason: "fix-log-final-disposition-residual-risk-missing" };
      }
      if (!nonBlankString(disposition.decided_by)) {
        return { status: "halt", reason: "fix-log-final-disposition-approver-missing" };
      }
    }
  }
  return { status: "pass", reason: "pass" };
}

export function validateReviewLogNewWrite(reviewLog, { requireBoundScopeConfirmation = false } = {}) {
  if (!reviewLog || typeof reviewLog !== "object" || Array.isArray(reviewLog)) {
    return { status: "halt", reason: "review-log-object-invalid" };
  }
  const storageContextVerdict = validateStorageContext(reviewLog.storage_context, reviewLog.target_project, "review-log");
  if (storageContextVerdict.status === "halt") return storageContextVerdict;
  if (reviewLog.schema_version !== 2) {
    return { status: "halt", reason: "review-log-schema-version-invalid" };
  }
  if (requireBoundScopeConfirmation &&
      (!nonBlankString(reviewLog.id) || !AIVV_INVOCATION_ID_RE.test(reviewLog.id))) {
    return { status: "halt", reason: "review-log-id-invalid" };
  }
  if (!REVIEW_LOG_STATUS_ENUM.has(reviewLog.status)) {
    return { status: "halt", reason: "review-log-status-invalid" };
  }
  if (
    reviewLog.fix_invocation_id !== undefined &&
    reviewLog.fix_invocation_id !== null &&
    (!nonBlankString(reviewLog.fix_invocation_id) || !AIVV_INVOCATION_ID_RE.test(reviewLog.fix_invocation_id))
  ) {
    return { status: "halt", reason: "review-log-fix-invocation-id-invalid" };
  }
  if (!Array.isArray(reviewLog.findings)) {
    return { status: "halt", reason: "review-log-findings-invalid" };
  }
  for (const finding of reviewLog.findings) {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
      return { status: "halt", reason: "review-log-finding-object-invalid" };
    }
    for (const field of REVIEW_LOG_MODERN_REQUIRED_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(finding, field)) {
        return { status: "halt", reason: "review-log-finding-modern-profile-missing" };
      }
    }
    if (finding.quality_profile !== "modern") {
      return { status: "halt", reason: "review-log-finding-modern-profile-missing" };
    }
    if (!validReviewLogLocation(finding)) {
      return { status: "halt", reason: "review-log-finding-location-invalid" };
    }
    if (!/^[0-9a-f]{40}$/i.test(finding.fingerprint)) {
      return { status: "halt", reason: "review-log-finding-fingerprint-invalid" };
    }
    if (!validReviewLogEvidence(finding.evidence)) {
      return { status: "halt", reason: "review-log-finding-modern-evidence-invalid" };
    }
    if (!nonBlankString(finding.impact)) {
      return { status: "halt", reason: "review-log-finding-impact-invalid" };
    }
    if (!nonBlankString(finding.severity_rationale)) {
      return { status: "halt", reason: "review-log-finding-severity-rationale-invalid" };
    }
    if (!REVIEW_LOG_RECOMMENDED_NEXT_STEP_ENUM.has(finding.recommended_next_step)) {
      return { status: "halt", reason: "review-log-finding-recommended-next-step-invalid" };
    }
    if (!nonBlankString(finding.verification_path)) {
      return { status: "halt", reason: "review-log-finding-verification-path-invalid" };
    }
    if (
      !validProportionalRemediation(finding.proportional_remediation)
    ) {
      return { status: "halt", reason: "review-log-finding-proportional-remediation-invalid" };
    }
    if (
      (finding.severity === "POLISH" || finding.category === "improvement") &&
      !["trivial", "moderate", "invasive"].includes(finding.effort)
    ) {
      return { status: "halt", reason: "review-log-finding-improvement-effort-invalid" };
    }
  }
  const findingRuntimeEvidenceVerdict = validateReviewRuntimeEvidence(reviewLog);
  if (
    findingRuntimeEvidenceVerdict.status !== "valid" &&
    findingRuntimeEvidenceVerdict.errors.some((error) => !isRuntimeEvidenceIngestError(error))
  ) {
    return { status: "halt", reason: "review-log-finding-runtime-evidence-invalid" };
  }
  for (const check of [
    validateTrustSummary,
    validateDecisionCheckpoint,
    validateAssurancePlan,
    (value) => validateReviewScope(value, { requireConfirmationBinding: requireBoundScopeConfirmation }),
    validateReviewerRoster,
    validatePlanReview,
    validateReviewPromptProfile,
    validateReviewerEvidencePacket,
    validateProviderTrust,
  ]) {
    const verdict = check(reviewLog);
    if (verdict.status === "halt") return verdict;
  }
  if (requireBoundScopeConfirmation) {
    const boundMethodVerdict = validateBoundReviewMethod(reviewLog);
    if (boundMethodVerdict.status === "halt") return boundMethodVerdict;
  }
  const runtimeEvidenceVerdict = validateReviewRuntimeEvidence(reviewLog);
  if (runtimeEvidenceVerdict.status !== "valid") {
    if (runtimeEvidenceVerdict.errors.some(isRuntimeEvidenceIngestError)) {
      return { status: "halt", reason: "review-log-runtime-evidence-ingest-invalid" };
    }
    return { status: "halt", reason: "review-log-finding-runtime-evidence-invalid" };
  }
  return { status: "pass", reason: "pass" };
}

function validateAuthorizedScopeAndRetryState(fixLog) {
  const scope = fixLog.authorized_scope;
  if (scope === undefined || (
    !plainObject(scope) ||
    !FIX_LOG_SOURCE_ENUM.has(scope.source) ||
    (fixLog.source !== undefined && scope.source !== fixLog.source) ||
    !nonBlankString(scope.goal) ||
    !validStringArray(scope.finding_ids) || scope.finding_ids.length === 0 ||
    !validStringArray(scope.included) || scope.included.length === 0 ||
    !validStringArray(scope.excluded) ||
    !validStringArray(scope.included_paths) ||
    !validStringArray(scope.excluded_paths) ||
    (scope.source_reference !== undefined && !nonBlankString(scope.source_reference))
  )) {
    return { status: "halt", reason: "fix-log-authorized-scope-invalid" };
  }

  if (!Number.isInteger(fixLog.rework_retry_count) ||
      fixLog.rework_retry_count < 0 || fixLog.rework_retry_count > 3 ||
      fixLog.max_rework_retries !== 3 ||
      !Array.isArray(fixLog.rework_retry_history) ||
      fixLog.rework_retry_history.length !== fixLog.rework_retry_count) {
    return { status: "halt", reason: "fix-log-rework-retry-state-invalid" };
  }
  const gates = new Set(["challenge", "pre-write", "stale-intent", "class-verdict", "verification", "red-green", "investigator-output", "duplicate-intent", "architecture-check", "plan-readiness"]);
  for (let index = 0; index < fixLog.rework_retry_history.length; index += 1) {
    const item = fixLog.rework_retry_history[index];
    if (!plainObject(item) || item.retry_number !== index + 1 || !gates.has(item.gate) ||
        !validStringArray(item.finding_ids) || item.finding_ids.length === 0 ||
        !nonBlankString(item.defect) || !nonBlankString(item.evidence)) {
      return { status: "halt", reason: "fix-log-rework-retry-history-invalid" };
    }
  }

  const authorizedIds = scope.finding_ids;
  const findingIdsIn = [];
  const collectArrayIds = (items, key) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (typeof item === "string") findingIdsIn.push(item);
      else if (plainObject(item) && typeof item[key] === "string") findingIdsIn.push(item[key]);
    }
  };
  for (const field of ["findings_addressed", "findings_deferred", "findings_wont_fix"]) {
    collectArrayIds(fixLog[field], "finding_id");
  }
  for (const field of ["write_intents", "changes_summary", "fix_plans", "verification_cycles", "objective_evidence", "final_dispositions"]) {
    collectArrayIds(fixLog[field], "finding_id");
  }
  for (const snapshot of fixLog.prior_cycle_snapshots ?? []) {
    if (plainObject(snapshot)) collectArrayIds(snapshot.changes_summary, "finding_id");
  }
  for (const item of fixLog.rework_retry_history) collectArrayIds(item.finding_ids, "finding_id");
  if (plainObject(fixLog.lifecycle_context) && typeof fixLog.lifecycle_context.finding_id === "string") {
    findingIdsIn.push(fixLog.lifecycle_context.finding_id);
  }

  const isWithinAuthorizedScope = (findingId) => authorizedIds.some((parentId) => {
    if (findingId === parentId) return true;
    if (!findingId.startsWith(`${parentId}-`)) return false;
    const suffix = findingId.slice(parentId.length + 1);
    return /^(?:cls(?:[1-9][0-9]*|overflow)|sib[1-9][0-9]*)$/.test(suffix);
  });
  if (findingIdsIn.some((findingId) => !isWithinAuthorizedScope(findingId))) {
    return { status: "halt", reason: "fix-log-finding-outside-authorized-scope" };
  }
  return { status: "pass", reason: "pass" };
}

function validateAuthorizedWritePaths(fixLog) {
  const scope = fixLog.authorized_scope;
  for (const field of ["write_intents", "changes_summary", "files_modified", "files_created", "fix_plans", "prior_cycle_snapshots"]) {
    if (fixLog[field] !== undefined && !Array.isArray(fixLog[field])) {
      return { status: "halt", reason: "fix-log-write-path-records-invalid" };
    }
  }
  const included = scope.included_paths.map((value) => canonicalProjectRelativePath(value, true));
  const excluded = scope.excluded_paths.map((value) => canonicalProjectRelativePath(value, true));
  if (included.some((value) => value === null) || excluded.some((value) => value === null)) {
    return { status: "halt", reason: "fix-log-authorized-path-boundary-invalid" };
  }
  if (fixLog.command === "aivv-fix" && !nonBlankString(fixLog.target_project)) {
    return { status: "halt", reason: "fix-log-target-project-missing" };
  }

  const targets = [];
  const addTarget = (value, required = false) => {
    if (value === undefined && !required) return null;
    const normalized = canonicalProjectRelativePath(value);
    if (normalized === null) return { status: "halt", reason: "fix-log-write-target-path-invalid" };
    targets.push(normalized);
    return null;
  };
  for (const intent of fixLog.write_intents ?? []) {
    if (plainObject(intent)) {
      const verdict = addTarget(intent.target_file, true);
      if (verdict) return verdict;
    }
  }
  for (const change of fixLog.changes_summary ?? []) {
    if (plainObject(change) && change.file !== undefined) {
      const verdict = addTarget(change.file);
      if (verdict) return verdict;
    }
  }
  for (const field of ["files_modified", "files_created"]) {
    for (const file of fixLog[field] ?? []) {
      const verdict = addTarget(file, true);
      if (verdict) return verdict;
    }
  }
  for (const plan of fixLog.fix_plans ?? []) {
    if (plainObject(plan)) {
      if (plan.expected_files !== undefined && !Array.isArray(plan.expected_files)) {
        return { status: "halt", reason: "fix-log-write-path-records-invalid" };
      }
      for (const file of plan.expected_files ?? []) {
        const verdict = addTarget(file, true);
        if (verdict) return verdict;
      }
    }
  }
  for (const snapshot of fixLog.prior_cycle_snapshots ?? []) {
    if (!plainObject(snapshot)) continue;
    if (snapshot.changes_summary !== undefined && !Array.isArray(snapshot.changes_summary)) {
      return { status: "halt", reason: "fix-log-write-path-records-invalid" };
    }
    for (const change of snapshot.changes_summary ?? []) {
      if (plainObject(change) && change.file !== undefined) {
        const verdict = addTarget(change.file);
        if (verdict) return verdict;
      }
    }
  }

  for (const target of targets) {
    if (excluded.some((boundary) => pathMatchesScopeBoundary(target, boundary))) {
      return { status: "halt", reason: "fix-log-write-target-explicitly-excluded" };
    }
    if (included.length > 0 && !included.some((boundary) => pathMatchesScopeBoundary(target, boundary))) {
      return { status: "halt", reason: "fix-log-write-target-outside-explicit-inclusions" };
    }
    if (fixLog.command === "aivv-fix") {
      const targetVerdict = targetPathVerdict(target, fixLog.target_project);
      if (targetVerdict.status === "halt") return targetVerdict;
    }
  }
  return { status: "pass", reason: "pass" };
}

function validateFixLogSourceReviewBinding(fixLog, contextFile) {
  if (fixLog.source !== "review_id") return { status: "pass", reason: "pass" };
  const relative = fixLog.source_review_relative_path;
  if (!nonBlankString(relative) || path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) {
    return { status: "halt", reason: "fix-log-source-review-path-invalid" };
  }
  if (!nonBlankString(contextFile)) {
    return { status: "halt", reason: "fix-log-source-review-context-missing" };
  }

  const storageHelper = path.join(path.dirname(fileURLToPath(import.meta.url)), "storage-paths.mjs");
  let sourceReview;
  try {
    const content = execFileSync(process.execPath, [
      storageHelper, "read", "--context", contextFile, "--area", "state",
      "--relative", relative,
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    sourceReview = JSON.parse(content);
  } catch {
    return { status: "halt", reason: "fix-log-source-review-read-failed" };
  }
  if (!plainObject(sourceReview) || sourceReview.id !== fixLog.source_review_id || !Array.isArray(sourceReview.findings)) {
    return { status: "halt", reason: "fix-log-source-review-mismatch" };
  }
  const sourceFindingIds = new Set(sourceReview.findings
    .filter((finding) => plainObject(finding) && nonBlankString(finding.ref))
    .map((finding) => finding.ref));
  if (fixLog.authorized_scope.finding_ids.some((id) => !sourceFindingIds.has(id))) {
    return { status: "halt", reason: "fix-log-scope-finding-not-in-source-review" };
  }
  return { status: "pass", reason: "pass" };
}

function storageRead(contextFile, area, relative) {
  const storageHelper = path.join(path.dirname(fileURLToPath(import.meta.url)), "storage-paths.mjs");
  return execFileSync(process.execPath, [
    storageHelper, "read", "--context", contextFile, "--area", area,
    "--relative", relative,
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function validateReviewLogBackfill(candidate, contextFile, relative) {
  if (!nonBlankString(contextFile) || !nonBlankString(relative) || path.isAbsolute(relative) ||
      relative.split(/[\\/]/).includes("..")) {
    return { status: "halt", reason: "review-log-backfill-location-invalid" };
  }
  let previous;
  try {
    previous = JSON.parse(storageRead(contextFile, "state", relative));
  } catch {
    return { status: "halt", reason: "review-log-backfill-prior-read-failed" };
  }
  if (!plainObject(previous) || !plainObject(candidate) || previous.id !== candidate.id ||
      previous.schema_version !== 2 || previous.command !== "aivv" ||
      !nonBlankString(previous.id) || !AIVV_INVOCATION_ID_RE.test(previous.id) ||
      !REVIEW_LOG_STATUS_ENUM.has(previous.status) ||
      !nonBlankString(previous.invoked_at) || !absolutePath(previous.target_project) ||
      !Array.isArray(previous.findings) || previous.findings.some((finding) => !plainObject(finding))) {
    return { status: "halt", reason: "review-log-backfill-identity-mismatch" };
  }
  const priorWithoutLink = { ...previous };
  const candidateWithoutLink = { ...candidate };
  delete priorWithoutLink.fix_invocation_id;
  delete candidateWithoutLink.fix_invocation_id;
  if (stableJson(priorWithoutLink) !== stableJson(candidateWithoutLink)) {
    return { status: "halt", reason: "review-log-backfill-mutates-historical-review" };
  }
  const fixId = candidate.fix_invocation_id;
  if (!nonBlankString(fixId) || !AIVV_INVOCATION_ID_RE.test(fixId)) {
    return { status: "halt", reason: "review-log-backfill-fix-id-invalid" };
  }
  if (previous.fix_invocation_id !== undefined && previous.fix_invocation_id !== null &&
      previous.fix_invocation_id !== fixId) {
    return { status: "halt", reason: "review-log-backfill-existing-fix-link-conflict" };
  }

  let fixPaths;
  try {
    const storageHelper = path.join(path.dirname(fileURLToPath(import.meta.url)), "storage-paths.mjs");
    fixPaths = JSON.parse(execFileSync(process.execPath, [
      storageHelper, "list", "--context", contextFile, "--area", "state",
      "--prefix", "fix-", "--archive",
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch {
    return { status: "halt", reason: "review-log-backfill-fix-list-failed" };
  }
  const expectedFixName = `fix-${fixId}.json`;
  const matches = Array.isArray(fixPaths)
    ? fixPaths.filter((candidatePath) => typeof candidatePath === "string" && candidatePath.split(/[\\/]/).at(-1) === expectedFixName)
    : [];
  const selectedFixPath = matches.includes(expectedFixName)
    ? expectedFixName
    : matches.length === 1 ? matches[0] : null;
  if (!selectedFixPath) return { status: "halt", reason: "review-log-backfill-fix-log-not-found-or-ambiguous" };
  let fixLog;
  try {
    fixLog = JSON.parse(storageRead(contextFile, "state", selectedFixPath));
  } catch {
    return { status: "halt", reason: "review-log-backfill-fix-log-read-failed" };
  }
  if (!plainObject(fixLog) || fixLog.id !== fixId || fixLog.source !== "review_id" ||
      fixLog.source_review_id !== candidate.id || fixLog.source_review_relative_path !== relative) {
    return { status: "halt", reason: "review-log-backfill-fix-source-mismatch" };
  }
  return { status: "pass", reason: "pass" };
}

export function validateFixLogNewWrite(fixLog, { contextFile } = {}) {
  if (!fixLog || typeof fixLog !== "object" || Array.isArray(fixLog)) {
    return { status: "halt", reason: "fix-log-object-invalid" };
  }
  if (!nonBlankString(fixLog.id) || !AIVV_INVOCATION_ID_RE.test(fixLog.id)) {
    return { status: "halt", reason: "fix-log-id-invalid" };
  }
  const storageContextVerdict = validateStorageContext(fixLog.storage_context, fixLog.target_project, "fix-log");
  if (storageContextVerdict.status === "halt") return storageContextVerdict;
  if (fixLog.schema_version !== 2) {
    return { status: "halt", reason: "fix-log-schema-version-invalid" };
  }
  if (fixLog.command !== "aivv-fix") {
    return { status: "halt", reason: "fix-log-command-invalid" };
  }
  if (!FIX_LOG_STATUS_ENUM.has(fixLog.status)) {
    return { status: "halt", reason: "fix-log-status-invalid" };
  }
  const scopeAndRetryVerdict = validateAuthorizedScopeAndRetryState(fixLog);
  if (scopeAndRetryVerdict.status === "halt") return scopeAndRetryVerdict;
  const scopePathsVerdict = validateAuthorizedWritePaths(fixLog);
  if (scopePathsVerdict.status === "halt") return scopePathsVerdict;
  const lifecycleContextVerdict = validateFixLogLifecycleContext(fixLog);
  if (lifecycleContextVerdict.status === "halt") return lifecycleContextVerdict;
  if (fixLog.source !== "review_id") {
    if (!hasAppliedChanges(fixLog)) {
      return { status: "pass", reason: "pass" };
    }
    if (fixLog.write_boundary_shown !== true) {
      return { status: "halt", reason: "fix-log-write-boundary-missing" };
    }
    for (const check of [validateChangeReadiness, validateObjectiveEvidence, validateFinalDispositions]) {
      const verdict = check(fixLog);
      if (verdict.status === "halt") return verdict;
    }
    return { status: "pass", reason: "pass" };
  }
  if (!nonBlankString(fixLog.source_review_id)) {
    return { status: "halt", reason: "fix-log-source-review-id-missing" };
  }
  if (fixLog.source_review_id.trim().startsWith("review-")) {
    return { status: "halt", reason: "fix-log-source-review-id-prefixed" };
  }
  const sourceReviewVerdict = validateFixLogSourceReviewBinding(fixLog, contextFile);
  if (sourceReviewVerdict.status === "halt") return sourceReviewVerdict;
  if (!Array.isArray(fixLog.findings_addressed) || fixLog.findings_addressed.length === 0 || fixLog.findings_addressed.some((id) => !nonBlankString(id))) {
    return { status: "halt", reason: "fix-log-findings-addressed-invalid" };
  }
  if (hasNormalizedFindingIdCollision(fixLog.findings_addressed)) {
    return { status: "halt", reason: "fix-log-finding-id-normalization-collision" };
  }
  if (!Array.isArray(fixLog.changes_summary) || fixLog.changes_summary.length === 0) {
    return { status: "halt", reason: "fix-log-changes-summary-invalid" };
  }
  const changedIds = [];
  for (const change of fixLog.changes_summary) {
    if (change && typeof change === "object" && !Array.isArray(change) && nonBlankString(change.finding_id)) {
      changedIds.push(change.finding_id);
    }
  }
  if (hasNormalizedFindingIdCollision([...fixLog.findings_addressed, ...changedIds])) {
    return { status: "halt", reason: "fix-log-finding-id-normalization-collision" };
  }
  const addressed = new Set(fixLog.findings_addressed.map(normalizedFindingId).filter(Boolean));
  const changed = new Set();
  for (const change of fixLog.changes_summary) {
    if (!change || typeof change !== "object" || Array.isArray(change)) {
      return { status: "halt", reason: "fix-log-changes-summary-invalid" };
    }
    if (!nonBlankString(change.finding_id)) {
      return { status: "halt", reason: "fix-log-change-finding-id-missing" };
    }
    const normalizedChangeId = normalizedFindingId(change.finding_id);
    if (!addressed.has(normalizedChangeId)) {
      return { status: "halt", reason: "fix-log-change-finding-id-unjoinable" };
    }
    changed.add(normalizedChangeId);
  }
  for (const findingId of addressed) {
    if (!changed.has(findingId)) {
      return { status: "halt", reason: "fix-log-addressed-finding-missing-change" };
    }
  }
  if (fixLog.write_boundary_shown !== true) {
    return { status: "halt", reason: "fix-log-write-boundary-missing" };
  }
  for (const check of [validateChangeReadiness, validateObjectiveEvidence, validateFinalDispositions]) {
    const verdict = check(fixLog);
    if (verdict.status === "halt") return verdict;
  }
  return { status: "pass", reason: "pass" };
}

export function validateFixLogTransition(fixLog, previousFixLog, { contextFile } = {}) {
  const candidateVerdict = validateFixLogNewWrite(fixLog, { contextFile });
  if (candidateVerdict.status === "halt") return candidateVerdict;
  if (!nonBlankString(fixLog.id)) {
    return { status: "halt", reason: "fix-log-transition-id-missing" };
  }

  if (previousFixLog === undefined) {
    const initialVerificationRetries = fixLog.rework_retry_history.filter((entry) => entry.gate === "verification").length;
    if (fixLog.status !== "in-progress" || fixLog.cycle_count !== 1 || initialVerificationRetries !== 0) {
      return { status: "halt", reason: "fix-log-initial-baseline-invalid" };
    }
    return { status: "pass", reason: "pass" };
  }

  if (!plainObject(previousFixLog) || previousFixLog.id !== fixLog.id) {
    return { status: "halt", reason: "fix-log-transition-invocation-mismatch" };
  }
  const candidateWarnings = Array.isArray(fixLog.warnings) ? fixLog.warnings : [];
  const reapedResume = previousFixLog.status === "abandoned" &&
    Array.isArray(previousFixLog.warnings) &&
    previousFixLog.warnings.some((warning) => plainObject(warning) && warning.code === "reaped-stale") &&
    fixLog.status === "in-progress" &&
    !candidateWarnings.some((warning) => plainObject(warning) && warning.code === "reaped-stale");
  if (previousFixLog.status !== "in-progress" && !reapedResume) {
    return { status: "halt", reason: "fix-log-transition-prior-state-not-in-progress" };
  }
  if (validateAuthorizedScopeAndRetryState(previousFixLog).status === "halt") {
    return { status: "halt", reason: "fix-log-transition-baseline-missing-or-invalid" };
  }
  if (stableJson(previousFixLog.authorized_scope) !== stableJson(fixLog.authorized_scope)) {
    return { status: "halt", reason: "fix-log-authorized-scope-mutated" };
  }
  for (const field of ["source", "source_review_id", "source_review_relative_path", "source_argument", "target_project", "storage_context", "lifecycle_context"]) {
    if (stableJson(previousFixLog[field]) !== stableJson(fixLog[field])) {
      return { status: "halt", reason: `fix-log-${field.replaceAll("_", "-")}-mutated` };
    }
  }
  const priorCount = previousFixLog.rework_retry_count;
  const nextCount = fixLog.rework_retry_count;
  if (nextCount < priorCount || nextCount > priorCount + 1) {
    return { status: "halt", reason: "fix-log-rework-retry-count-transition-invalid" };
  }
  const priorHistory = previousFixLog.rework_retry_history;
  const nextHistory = fixLog.rework_retry_history;
  if (priorHistory.some((entry, index) => stableJson(entry) !== stableJson(nextHistory[index]))) {
    return { status: "halt", reason: "fix-log-rework-retry-history-mutated" };
  }
  if (nextCount === priorCount && stableJson(priorHistory) !== stableJson(nextHistory)) {
    return { status: "halt", reason: "fix-log-rework-retry-history-mutated" };
  }
  const priorCycle = previousFixLog.cycle_count;
  const nextCycle = fixLog.cycle_count;
  const priorVerificationRetries = priorHistory.filter((entry) => entry.gate === "verification").length;
  const nextVerificationRetries = nextHistory.filter((entry) => entry.gate === "verification").length;
  const verificationRetryAdded = nextVerificationRetries === priorVerificationRetries + 1 &&
    nextHistory[nextHistory.length - 1]?.gate === "verification";
  const cycleAdvanced = nextCycle === priorCycle + 1;
  if (!Number.isInteger(priorCycle) || priorCycle < 1 ||
      !Number.isInteger(nextCycle) || (nextCycle !== priorCycle && !cycleAdvanced) ||
      cycleAdvanced !== verificationRetryAdded) {
    return { status: "halt", reason: "fix-log-verification-cycle-unbacked" };
  }
  return { status: "pass", reason: "pass" };
}

export function validateFile(file, options = {}) {
  const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  const verdict = validateFixture(fixture, options);
  if (verdict.status !== "halt") return verdict;
  if (!Number.isInteger(fixture.rework_retry_count) || fixture.rework_retry_count < 0 ||
      fixture.max_rework_retries !== 3) {
    return {
      status: "halt",
      reason: "rework-retry-budget-metadata-missing-or-invalid",
      blocked_reason: verdict.reason,
    };
  }
  if (fixture.rework_retry_count >= fixture.max_rework_retries) {
    return {
      status: "halt",
      reason: "rework-retry-budget-exhausted",
      blocked_reason: verdict.reason,
    };
  }
  return verdict;
}

function loadPersistedFixLog(contextFile, fixLog) {
  const storageContext = JSON.parse(fs.readFileSync(contextFile, "utf8"));
  if (!plainObject(storageContext) ||
      storageContext.target !== fixLog.target_project ||
      !plainObject(fixLog.storage_context) ||
      storageContext.instance_key !== fixLog.storage_context.instance_key) {
    return { error: "fix-log-transition-storage-context-mismatch" };
  }
  const storageHelper = path.join(path.dirname(fileURLToPath(import.meta.url)), "storage-paths.mjs");
  try {
    const content = execFileSync(process.execPath, [
      storageHelper, "read", "--context", contextFile, "--area", "state",
      "--relative", `fix-${fixLog.id}.json`,
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { previous: JSON.parse(content) };
  } catch (error) {
    const stderr = typeof error?.stderr === "string" ? error.stderr : error?.stderr?.toString("utf8") ?? "";
    if (stderr.includes("STORAGE_NOT_FOUND")) return { missing: true };
    return { error: "fix-log-transition-state-read-failed" };
  }
}

function main(argv) {
  const fixLogIndex = argv.indexOf("--fix-log");
  if (fixLogIndex >= 0) {
    const fixLogFile = argv[fixLogIndex + 1];
    const contextIndex = argv.indexOf("--context");
    const contextFile = contextIndex >= 0 ? argv[contextIndex + 1] : "";
    const newIndex = argv.indexOf("--new");
    const updateIndex = argv.indexOf("--update");
    if (!fixLogFile || !contextFile || (newIndex >= 0) === (updateIndex >= 0)) {
      console.error("usage: node <AIVV_ROOT>/tools/pre-write-validator.mjs --fix-log <candidate-fix-log.json> --context <storage-context.json> --new|--update");
      return 2;
    }
    const candidate = JSON.parse(fs.readFileSync(fixLogFile, "utf8"));
    if (!nonBlankString(candidate.id) || !AIVV_INVOCATION_ID_RE.test(candidate.id)) {
      console.log(JSON.stringify({ status: "halt", reason: "fix-log-id-invalid" }));
      return 1;
    }
    const persisted = loadPersistedFixLog(contextFile, candidate);
    let verdict;
    if (persisted.error) {
      verdict = { status: "halt", reason: persisted.error };
    } else if (newIndex >= 0) {
      verdict = persisted.previous
        ? { status: "halt", reason: "fix-log-invocation-already-exists" }
        : validateFixLogTransition(candidate, undefined, { contextFile });
    } else {
      verdict = persisted.missing
        ? { status: "halt", reason: "fix-log-transition-prior-log-missing" }
        : validateFixLogTransition(candidate, persisted.previous, { contextFile });
    }
    console.log(JSON.stringify(verdict));
    return verdict.status === "pass" ? 0 : 1;
  }

  const reviewLogIndex = argv.indexOf("--review-log");
  const reviewLogBackfillIndex = argv.indexOf("--review-log-backfill");
  if (reviewLogIndex >= 0 || reviewLogBackfillIndex >= 0) {
    if (reviewLogIndex >= 0 && reviewLogBackfillIndex >= 0) {
      console.error("usage: node <AIVV_ROOT>/tools/pre-write-validator.mjs --review-log <new-review-log.json> | --review-log-backfill <candidate-review-log.json> --context <storage-context.json> --relative <stored-review-path>");
      return 2;
    }
    const strictScopeBinding = reviewLogIndex >= 0;
    const reviewLogFile = argv[(strictScopeBinding ? reviewLogIndex : reviewLogBackfillIndex) + 1];
    const contextIndex = argv.indexOf("--context");
    const relativeIndex = argv.indexOf("--relative");
    const contextFile = contextIndex >= 0 ? argv[contextIndex + 1] : "";
    const relative = relativeIndex >= 0 ? argv[relativeIndex + 1] : "";
    if (!reviewLogFile) {
      console.error("usage: node <AIVV_ROOT>/tools/pre-write-validator.mjs --review-log <new-review-log.json> | --review-log-backfill <candidate-review-log.json> --context <storage-context.json> --relative <stored-review-path>");
      return 2;
    }
    if (!strictScopeBinding && (!contextFile || !relative)) {
      console.error("usage: node <AIVV_ROOT>/tools/pre-write-validator.mjs --review-log-backfill <candidate-review-log.json> --context <storage-context.json> --relative <stored-review-path>");
      return 2;
    }
    const candidate = JSON.parse(fs.readFileSync(reviewLogFile, "utf8"));
    const verdict = strictScopeBinding
      ? validateReviewLogNewWrite(candidate, { requireBoundScopeConfirmation: true })
      : validateReviewLogBackfill(candidate, contextFile, relative);
    console.log(JSON.stringify(verdict));
    return verdict.status === "pass" ? 0 : 1;
  }

  const fileIndex = argv.indexOf("--fixture");
  const file = fileIndex >= 0 ? argv[fileIndex + 1] : argv[0];
  if (!file) {
    console.error("usage: node <AIVV_ROOT>/tools/pre-write-validator.mjs --fixture <fixture.json> [--proposal-only | --context <storage-context.json>]");
    console.error("   or: node <AIVV_ROOT>/tools/pre-write-validator.mjs --review-log <candidate-review-log.json>");
    console.error("   or: node <AIVV_ROOT>/tools/pre-write-validator.mjs --fix-log <candidate-fix-log.json>");
    return 2;
  }
  const contextIndex = argv.indexOf("--context");
  const contextFile = contextIndex >= 0 ? argv[contextIndex + 1] : "";
  const proposalOnly = argv.includes("--proposal-only");
  const verdict = validateFile(file, { contextFile, proposalOnly });
  console.log(JSON.stringify(verdict));
  return verdict.status === "pass" ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
