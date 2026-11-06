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

export function targetPathVerdict(targetFile) {
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
  return { status: "pass", reason: "pass" };
}

function bypassApproval(fixture, intent) {
  return intent?.detector_result?.bypass_approval;
}

export function detectorVerdict(fixture) {
  for (const intent of fixture.write_intents ?? []) {
    const pathVerdict = targetPathVerdict(intent.target_file ?? fixture.target_file);
    if (pathVerdict.status === "halt") return pathVerdict;
  }
  const rootPathVerdict = targetPathVerdict(fixture.target_file);
  if (rootPathVerdict.status === "halt") return rootPathVerdict;

  const shapes = collectShapes(fixture);
  const intents = fixture.write_intents?.length ? fixture.write_intents : [fixture];
  const intentBytes = intents.flatMap((intent) => [intent.exact_content, intent.exact_content_or_patch,
    ...(Array.isArray(intent.proposed_edits) ? intent.proposed_edits.flatMap((edit) => [edit.old_string, edit.new_string]) : [])])
    .filter((content) => typeof content === "string");

  if (intentBytes.some((content) => content.includes("\u0000"))) {
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

export function validateFixture(fixture) {
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
  if (fixture.pre_write_validation_iterations >= fixture.max_pre_write_validation_iterations) {
    return { status: "halt", reason: "pre-write-iterations-exceeded" };
  }
  if (fixture.stale_intent_regenerations >= fixture.max_stale_intent_regenerations) {
    return { status: "halt", reason: "stale-intent-regeneration-cap-exceeded" };
  }
  if (fixture.challenge_budget_remaining === 0 && fixture.write_intents?.some((intent) => intent.content_shape !== "plain-prose")) {
    return { status: "halt", reason: "challenge-budget-halted-risky-write-intent" };
  }
  const confidence = confidenceVerdict(fixture);
  if (confidence.status === "halt") return confidence;
  return { status: "pass", reason: "pass" };
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

// Provenance preserves the original policy lookup across handoffs; it grants no
// authority. The receiver still resolves its current storage instance and policy.
function validateStorageContext(context, targetProject, prefix) {
  if (context === undefined) return { status: "pass", reason: "pass" };
  const fields = ["instance_key", "target_project", "policy_target"];
  const absolutePath = (value) => nonBlankString(value) && !value.includes("\0") &&
    /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(value);
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

function validReviewScopeConfirmation(value) {
  if (value === undefined) return true;
  return plainObject(value) &&
    optionalNonBlankString(value.mode) &&
    optionalNonBlankString(value.classification_reason) &&
    optionalNonBlankString(value.user_choice);
}

function validateReviewScope(reviewLog) {
  const scope = reviewLog.review_scope;
  if (scope === undefined) return { status: "pass", reason: "pass" };
  if (
    !plainObject(scope) ||
    !REVIEW_LOG_SUBJECT_TYPE_ENUM.has(scope.subject_type) ||
    !nonBlankString(scope.final_scope) ||
    !optionalNonBlankString(scope.target_project) ||
    !optionalNonBlankString(scope.state_target) ||
    !optionalStringArray(scope.included_files) ||
    !optionalStringArray(scope.excluded_or_dropped_scope) ||
    !validReviewScopeConfirmation(scope.scope_confirmation)
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
    optionalNullableString(entry.status_reason) &&
    (entry.finding_refs === undefined || (
      Array.isArray(entry.finding_refs) &&
      entry.finding_refs.every((ref) => typeof ref === "string" && REVIEW_LOG_FINDING_REF_RE.test(ref))
    ));
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

export function validateReviewLogNewWrite(reviewLog) {
  if (!reviewLog || typeof reviewLog !== "object" || Array.isArray(reviewLog)) {
    return { status: "halt", reason: "review-log-object-invalid" };
  }
  const storageContextVerdict = validateStorageContext(reviewLog.storage_context, reviewLog.target_project, "review-log");
  if (storageContextVerdict.status === "halt") return storageContextVerdict;
  if (reviewLog.schema_version !== 2) {
    return { status: "halt", reason: "review-log-schema-version-invalid" };
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
    validateReviewScope,
    validateReviewerRoster,
    validatePlanReview,
    validateReviewPromptProfile,
    validateReviewerEvidencePacket,
    validateProviderTrust,
  ]) {
    const verdict = check(reviewLog);
    if (verdict.status === "halt") return verdict;
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

export function validateFixLogNewWrite(fixLog) {
  if (!fixLog || typeof fixLog !== "object" || Array.isArray(fixLog)) {
    return { status: "halt", reason: "fix-log-object-invalid" };
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

export function validateFile(file) {
  return validateFixture(JSON.parse(fs.readFileSync(file, "utf8")));
}

function main(argv) {
  const fixLogIndex = argv.indexOf("--fix-log");
  if (fixLogIndex >= 0) {
    const fixLogFile = argv[fixLogIndex + 1];
    if (!fixLogFile) {
      console.error("usage: node <AIVV_ROOT>/tools/pre-write-validator.mjs --fix-log <candidate-fix-log.json>");
      return 2;
    }
    const verdict = validateFixLogNewWrite(JSON.parse(fs.readFileSync(fixLogFile, "utf8")));
    console.log(JSON.stringify(verdict));
    return verdict.status === "pass" ? 0 : 1;
  }

  const reviewLogIndex = argv.indexOf("--review-log");
  if (reviewLogIndex >= 0) {
    const reviewLogFile = argv[reviewLogIndex + 1];
    if (!reviewLogFile) {
      console.error("usage: node <AIVV_ROOT>/tools/pre-write-validator.mjs --review-log <candidate-review-log.json>");
      return 2;
    }
    const verdict = validateReviewLogNewWrite(JSON.parse(fs.readFileSync(reviewLogFile, "utf8")));
    console.log(JSON.stringify(verdict));
    return verdict.status === "pass" ? 0 : 1;
  }

  const fileIndex = argv.indexOf("--fixture");
  const file = fileIndex >= 0 ? argv[fileIndex + 1] : argv[0];
  if (!file) {
    console.error("usage: node <AIVV_ROOT>/tools/pre-write-validator.mjs --fixture <fixture.json>");
    console.error("   or: node <AIVV_ROOT>/tools/pre-write-validator.mjs --review-log <candidate-review-log.json>");
    console.error("   or: node <AIVV_ROOT>/tools/pre-write-validator.mjs --fix-log <candidate-fix-log.json>");
    return 2;
  }
  const verdict = validateFile(file);
  console.log(JSON.stringify(verdict));
  return verdict.status === "pass" ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
