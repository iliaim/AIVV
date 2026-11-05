#!/usr/bin/env node
import crypto from "node:crypto";
import { withExistingStorageReadLock, resolveStorage, readStorageContext, ensureStorage, withStorageLock, validateContainedPath, ensurePrivateDirectory } from "./storage-paths.mjs";
import { isImportPathVisible } from "./state-import.mjs";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Dual-path schema resolution: sibling-first (`<root>/.aivv/schemas`, correct when this
// script lives at `<ship-root>/tools/` — plugin payload and Codex aivv-runtime bundle),
// falling back to the legacy repo-root layout (`<repo>/plugin/.aivv/schemas`).
const SCHEMA_DIR_CANDIDATES = [
  path.join(REPO_ROOT, ".aivv", "schemas"),
  path.join(REPO_ROOT, "plugin", ".aivv", "schemas")
];
const SCHEMA_DIR = SCHEMA_DIR_CANDIDATES.find((dir) => fs.existsSync(dir)) || SCHEMA_DIR_CANDIDATES[0];
const INCIDENT_ID_RE = /^INC-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[A-Za-z0-9][A-Za-z0-9-]*$/;
const PROBLEM_ID_RE = /^PROB-[A-Za-z0-9][A-Za-z0-9._-]*$/;
const LOCAL_ISSUE_ID_RE = /^ISS-[A-Za-z0-9][A-Za-z0-9._-]*$/;
const EVIDENCE_ID_RE = /^EVID-[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const LIFECYCLE_RECORD_ID_RE = /^(?:INC-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[A-Za-z0-9][A-Za-z0-9-]*|PROB-[A-Za-z0-9][A-Za-z0-9._-]*|ISS-[A-Za-z0-9][A-Za-z0-9._-]*)$/;
const CROSS_EVIDENCE_RE = new RegExp(`^(${LIFECYCLE_RECORD_ID_RE.source.slice(1, -1)})#(${EVIDENCE_ID_RE.source.slice(1, -1)})$`);
const DEDUPE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const TERMINAL_GATE_OK = new Set(["satisfied", "accepted-exception"]);
const STATUSES = new Set(["detected", "triaged", "mitigating", "resolved", "review-needed", "actions-open", "closed"]);
const PROBLEM_STATUSES = new Set(["candidate", "investigating", "prevention-active", "monitoring", "closed"]);
const LOCAL_ISSUE_STATUSES = new Set(["drafted", "rca-pending", "rca-reviewed", "fix-planned", "fix-implemented", "prevention-verified", "closed"]);
const RCA_STATUSES = new Set(["not-started", "draft", "reviewed", "confirmed", "blocked", "accepted-unverified"]);
const RCA_MATURE_STATUSES = new Set(["reviewed", "confirmed"]);
const ALLOWED_TRANSITIONS = new Set([
  "detected->triaged",
  "triaged->mitigating",
  "mitigating->resolved",
  "resolved->review-needed",
  "review-needed->actions-open",
  "resolved->closed",
  "review-needed->closed",
  "actions-open->closed"
]);
const PROBLEM_TRANSITIONS = new Set(["null->candidate", "candidate->investigating", "candidate->prevention-active", "investigating->prevention-active", "prevention-active->monitoring", "monitoring->closed"]);
const LOCAL_ISSUE_TRANSITIONS = new Set(["null->drafted", "drafted->rca-pending", "rca-pending->rca-reviewed", "rca-reviewed->fix-planned", "fix-planned->fix-implemented", "fix-implemented->prevention-verified", "prevention-verified->closed"]);
const PROBLEM_CLOSURE_GATES = ["linked_incidents_closed", "retirement_criteria_met", "recurrence_monitoring_documented"];
const LOCAL_ISSUE_CLOSURE_GATES = ["acceptance_criteria_met", "verification_evidence", "linked_lifecycle_records_current"];
const LINK_TYPES = new Set([
  "github_issue",
  "github_pr",
  "task_issue",
  "problem_cluster",
  "incident",
  "review_log",
  "fix_log",
  "finding",
  "external_url"
]);
const LINK_ROLES = new Set([
  "reported-by",
  "fixes",
  "caused-by",
  "related",
  "supersedes",
  "blocked-by",
  "evidence-for",
  "created-from"
]);

const REDACTION_PATTERNS = [
  ["anthropic-token", /\bsk-ant-[A-Za-z0-9._-]+\b/g],
  ["openai-token", /\bsk-proj-[A-Za-z0-9._-]+\b/g],
  ["api-key", /\b[A-Z0-9_]*API_KEY=([^\s]+)/g],
  ["github-token", /\b(?:ghp|github_pat)_[A-Za-z0-9_]+\b/g],
  ["oauth-token", /\boauth[_-]?token=([^\s&]+)/gi],
  ["bearer-token", /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/gi],
  ["env-assignment-secret", /\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY)=([^\s]+)/g],
  ["secret-query-param", /([?&](?:token|access_token|api_key|secret)=)[^&\s]+/gi],
  ["email-address", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  ["home-directory-path", /\/Users\/[^\s]+/g]
];

export function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function redactText(input, maxChars = 4000) {
  let text = String(input);
  const applied = new Set();
  for (const [label, re] of REDACTION_PATTERNS) {
    text = text.replace(re, (match, group1) => {
      applied.add(label);
      if (label === "secret-query-param" && group1) return `${group1}[REDACTED:${label}]`;
      if ((label === "api-key" || label === "env-assignment-secret" || label === "oauth-token") && group1) {
        if (group1.includes("[REDACTED:")) return group1;
        return match.replace(group1, `[REDACTED:${label}]`);
      }
      return `[REDACTED:${label}]`;
    });
  }
  const truncated = text.length > maxChars;
  const redacted_excerpt = truncated ? text.slice(0, maxChars) : text;
  return {
    status: "redacted",
    redacted_excerpt,
    redactions_applied: [...applied].sort(),
    sha256: sha256(redacted_excerpt),
    truncated,
    sensitive: applied.size > 0
  };
}

function invalid(reason, detail) {
  return { status: "invalid", reason, detail };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonFile(file) {
  try {
    return { value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (error) {
    return { error };
  }
}

const schemaCache = new Map();

function loadJsonSchema(name) {
  if (!schemaCache.has(name)) {
    schemaCache.set(name, JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, name), "utf8")));
  }
  return schemaCache.get(name);
}

function decodeJsonPointerPart(part) {
  return part.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveJsonPointer(root, pointer) {
  if (pointer === "#") return root;
  if (!pointer.startsWith("#/")) throw new Error(`Unsupported schema ref: ${pointer}`);
  return pointer
    .slice(2)
    .split("/")
    .map(decodeJsonPointerPart)
    .reduce((value, key) => value?.[key], root);
}

function schemaTypeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isObject(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function schemaValueEquals(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const RFC3339_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function isStrictRfc3339DateTime(value) {
  const match = RFC3339_DATE_TIME_RE.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (hour > 23 || minute > 59) return false;
  // Incident timestamps intentionally reject leap seconds; generated values use ordinary ISO seconds.
  if (second > 59) return false;

  if (!/^[Zz]$/.test(offsetText)) {
    const offsetHour = Number(offsetText.slice(1, 3));
    const offsetMinute = Number(offsetText.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return true;
}

function validateStringFormat(value, format, dataPath) {
  if (format === "date-time" && !isStrictRfc3339DateTime(value)) {
    return `${dataPath} must be a valid date-time`;
  }
  if (format === "uri") {
    try {
      new URL(value);
    } catch {
      return `${dataPath} must be a valid uri`;
    }
  }
  return null;
}

function resolveSchemaRef(ref, rootSchema) {
  const hashIndex = ref.indexOf("#");
  const filePart = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const pointer = hashIndex === -1 ? "#" : `#${ref.slice(hashIndex + 1)}`;
  if (!filePart) {
    return { schema: resolveJsonPointer(rootSchema, pointer), rootSchema };
  }
  const externalRoot = loadJsonSchema(path.basename(filePart));
  return { schema: resolveJsonPointer(externalRoot, pointer), rootSchema: externalRoot };
}

function validateSchemaValue(value, schema, dataPath, rootSchema) {
  if (!isObject(schema)) return [];
  if (schema.$ref) {
    const resolved = resolveSchemaRef(schema.$ref, rootSchema);
    return validateSchemaValue(value, resolved.schema, dataPath, resolved.rootSchema);
  }

  const errors = [];
  if (schema.allOf) {
    for (const subschema of schema.allOf) {
      errors.push(...validateSchemaValue(value, subschema, dataPath, rootSchema));
    }
  }
  if (schema.if) {
    const ifErrors = validateSchemaValue(value, schema.if, dataPath, rootSchema);
    if (ifErrors.length === 0 && schema.then) {
      errors.push(...validateSchemaValue(value, schema.then, dataPath, rootSchema));
    }
  }
  if (schema.anyOf) {
    const anyOfResults = schema.anyOf.map((subschema) => validateSchemaValue(value, subschema, dataPath, rootSchema));
    if (!anyOfResults.some((result) => result.length === 0)) {
      errors.push(`${dataPath} must match at least one allowed schema`);
    }
  }

  if (schema.const !== undefined && !schemaValueEquals(value, schema.const)) {
    errors.push(`${dataPath} must equal ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => schemaValueEquals(value, entry))) {
    errors.push(`${dataPath} must be one of ${schema.enum.map((entry) => JSON.stringify(entry)).join(", ")}`);
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => schemaTypeMatches(value, type))) {
      errors.push(`${dataPath} must be ${types.join("|")}`);
      return errors;
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${dataPath} must be at least ${schema.minLength} characters`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${dataPath} must match ${schema.pattern}`);
    }
    if (schema.format !== undefined) {
      const formatError = validateStringFormat(value, schema.format, dataPath);
      if (formatError) errors.push(formatError);
    }
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${dataPath} must be >= ${schema.minimum}`);
  }
  if (Array.isArray(value) && schema.items) {
    for (const [index, item] of value.entries()) {
      errors.push(...validateSchemaValue(item, schema.items, `${dataPath}[${index}]`, rootSchema));
    }
  }
  if (isObject(value)) {
    const properties = isObject(schema.properties) ? schema.properties : {};
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.hasOwn(value, key)) errors.push(`${dataPath}.${key} is required`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) errors.push(`${dataPath}.${key} is not allowed`);
      }
    }
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) {
        errors.push(...validateSchemaValue(value[key], propertySchema, `${dataPath}.${key}`, rootSchema));
      }
    }
  }
  return errors;
}

function validateSchemaShape(record, schemaName) {
  const schema = loadJsonSchema(schemaName);
  const errors = validateSchemaValue(record, schema, "$", schema);
  if (errors.length > 0) return invalid("schema-shape-invalid", errors[0]);
  return null;
}

function evidenceIdsFor(record) {
  return new Set(Array.isArray(record.evidence) ? record.evidence.map((entry) => entry?.id).filter(Boolean) : []);
}

function hasSecretLikeText(text) {
  return REDACTION_PATTERNS.some(([, re]) => {
    re.lastIndex = 0;
    return re.test(String(text));
  });
}

function visibilityContext(options, file = options.file) {
  if (options.storageContext) return options.storageContext;
  let stateDir = options.stateDir ? path.resolve(options.stateDir) : path.dirname(path.resolve(file));
  if (["incidents", "problems", "issues"].includes(path.basename(stateDir))) stateDir = path.dirname(stateDir);
  if (path.basename(stateDir) === "archive") stateDir = path.dirname(stateDir);
  return { target_dir: path.dirname(stateDir) };
}
function importVisibilityError(options) {
  return options.file && !isImportPathVisible(visibilityContext(options), options.file)
    ? invalid("state-import-pending", "Selected lifecycle record is historical until explicit import recovery completes") : null;
}

function lifecycleSearchDirs(stateDir, file, subdir) {
  const dirs = [];
  if (stateDir) { dirs.push(path.resolve(stateDir, subdir)); dirs.push(path.resolve(stateDir, "archive", subdir)); }
  if (file) {
    const parent = path.dirname(path.resolve(file));
    dirs.push(path.join(parent, subdir));
    if (["incidents", "problems", "issues"].includes(path.basename(parent))) {
      const container = path.dirname(parent);
      const state = path.basename(container) === "archive" ? path.dirname(container) : container;
      dirs.push(path.join(state, subdir), path.join(state, "archive", subdir));
    }
  }
  return [...new Set(dirs)];
}

function lifecycleSubdirForId(id) {
  if (INCIDENT_ID_RE.test(id)) return "incidents";
  if (PROBLEM_ID_RE.test(id)) return "problems";
  if (LOCAL_ISSUE_ID_RE.test(id)) return "issues";
  return null;
}

function lifecycleRecordSearchDirs(id, options) {
  const subdir = lifecycleSubdirForId(id);
  const dirs = subdir ? lifecycleSearchDirs(options.stateDir, options.file, subdir) : [];
  // Preserve Slice 1A incident fixture behavior where peer incidents lived in
  // the state root/current fixture directory before subdir loading existed.
  if (INCIDENT_ID_RE.test(id)) {
    if (options.stateDir) dirs.push(path.resolve(options.stateDir));
    if (options.file) dirs.push(path.dirname(path.resolve(options.file)));
  }
  return [...new Set(dirs)];
}

function loadLifecycleRecordById(id, options) {
  for (const dir of lifecycleRecordSearchDirs(id, options)) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    for (const name of fs.readdirSync(dir).filter((entry) => entry.endsWith(".json")).sort()) {
      const file = path.join(dir, name);
      if (!isImportPathVisible(visibilityContext(options, file), file)) continue;
      const parsed = parseJsonFile(file);
      if (!parsed.error && parsed.value?.id === id) return parsed.value;
    }
  }
  return null;
}

function evidenceRefResolves(ref, record, options) {
  if (EVIDENCE_ID_RE.test(ref)) return evidenceIdsFor(record).has(ref);
  const match = CROSS_EVIDENCE_RE.exec(ref);
  if (!match) return false;
  const [, recordId, evidenceId] = match;
  const linked = loadLifecycleRecordById(recordId, options);
  return Boolean(linked && evidenceIdsFor(linked).has(evidenceId));
}

function collectEvidenceRefs(record) {
  const refs = [];
  if (Array.isArray(record.lifecycle_evidence_refs)) refs.push(...record.lifecycle_evidence_refs);
  if (isObject(record.promotion_decision) && Array.isArray(record.promotion_decision.evidence_links)) {
    refs.push(...record.promotion_decision.evidence_links);
  }
  if (isObject(record.closure_gates)) {
    for (const [gateName, gate] of Object.entries(record.closure_gates)) {
      if (!Array.isArray(gate?.evidence_links)) continue;
      for (const ref of gate.evidence_links) refs.push(ref);
      if (gateName === "") refs.push("");
    }
  }
  if (isObject(record.closure_decision) && Array.isArray(record.closure_decision.evidence_links)) {
    refs.push(...record.closure_decision.evidence_links);
  }
  return refs;
}

function validateLinks(record) {
  if (!Array.isArray(record.links)) return invalid("invalid-links", "links must be an array");
  for (const [index, link] of record.links.entries()) {
    if (!isObject(link)) return invalid("invalid-link", `links[${index}] must be an object`);
    if (!LINK_TYPES.has(link.type)) return invalid("invalid-link-type", `links[${index}].type=${link.type}`);
    if (!LINK_ROLES.has(link.role)) return invalid("invalid-link-role", `links[${index}].role=${link.role}`);
    if ((link.type === "github_issue" || link.type === "github_pr") && !link.url && !isObject(link.github)) {
      return invalid("invalid-github-link", `links[${index}] needs url or github object`);
    }
  }
  return null;
}

function validateTransitions(record, statuses = STATUSES, transitions = ALLOWED_TRANSITIONS, initialStatus = "detected") {
  if (!Array.isArray(record.timeline)) return invalid("invalid-timeline", "timeline must be an array");
  let previousTo = null;
  for (const [index, entry] of record.timeline.entries()) {
    if (!isObject(entry)) return invalid("invalid-timeline-entry", `timeline[${index}] must be an object`);
    const isTransition = entry.kind === "transition" || "from_status" in entry || "to_status" in entry;
    if (!isTransition) continue;
    if (!statuses.has(entry.to_status)) {
      return invalid("invalid-transition-status", `timeline[${index}].to_status=${entry.to_status}`);
    }
    if (entry.from_status !== null && !statuses.has(entry.from_status)) {
      return invalid("invalid-transition-status", `timeline[${index}].from_status=${entry.from_status}`);
    }
    if (entry.from_status !== previousTo) {
      return invalid("invalid-transition-chain", `timeline[${index}] from_status ${entry.from_status} does not match previous ${previousTo}`);
    }
    const edge = `${entry.from_status}->${entry.to_status}`;
    if (entry.from_status === null && entry.to_status !== initialStatus) {
      return invalid("invalid-transition-edge", `initial transition must go to ${initialStatus}, got ${entry.to_status}`);
    }
    if (entry.from_status !== null && !transitions.has(edge)) {
      return invalid("invalid-transition-edge", edge);
    }
    previousTo = entry.to_status;
  }
  if (previousTo !== null && previousTo !== record.status) {
    return invalid("transition-final-status-mismatch", `timeline ends at ${previousTo}, record.status is ${record.status}`);
  }
  return null;
}

function validateClosure(record) {
  if (!isObject(record.closure_gates)) return invalid("invalid-closure-gates", "closure_gates must be an object");
  for (const [name, gate] of Object.entries(record.closure_gates)) {
    if (!isObject(gate)) return invalid("invalid-closure-gate", `${name} must be an object`);
    if (gate.status === "accepted-exception") {
      if (!gate.accepted_by || !gate.accepted_at || !gate.rationale) {
        return invalid("accepted-exception-missing-fields", `${name} requires accepted_by, accepted_at, and rationale`);
      }
    }
  }
  if (record.status !== "closed") return null;
  if (!isObject(record.closure_decision)) {
    return invalid("closed-without-closure-decision", "closed incidents require closure_decision");
  }
  for (const [name, gate] of Object.entries(record.closure_gates)) {
    if (!TERMINAL_GATE_OK.has(gate?.status)) {
      return invalid("closed-gate-not-terminal", `${name} status is ${gate?.status}`);
    }
  }
  return null;
}

function isNonEmptyValue(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return false;
}

function gateHasEvidenceOrAcceptedException(gate) {
  return Array.isArray(gate?.evidence_links) && gate.evidence_links.length > 0 || gate?.status === "accepted-exception";
}

function validateRequiredClosureGates(record, requiredGates, label) {
  if (!isObject(record.closure_gates)) return invalid("closure-gates-required", `${label} closure_gates must be an object`);
  for (const name of requiredGates) {
    const gate = record.closure_gates[name];
    if (!isObject(gate)) return invalid("closure-gate-missing", `${label} requires closure gate ${name}`);
    if (!TERMINAL_GATE_OK.has(gate.status)) return invalid("closed-gate-not-terminal", `${name} status is ${gate.status}`);
    if (!gateHasEvidenceOrAcceptedException(gate)) return invalid("closure-gate-evidence-required", `${name} requires evidence_links or accepted-exception`);
  }
  return null;
}

function transitionEntries(record) {
  return Array.isArray(record.timeline)
    ? record.timeline.filter((entry) => isObject(entry) && (entry.kind === "transition" || "from_status" in entry || "to_status" in entry))
    : [];
}

function validateSensitivity(record) {
  if (typeof record.sensitive !== "boolean") return invalid("invalid-sensitive", "sensitive must be boolean");
  const evidence = Array.isArray(record.evidence) ? record.evidence : [];
  for (const [index, entry] of evidence.entries()) {
    if (!isObject(entry)) return invalid("invalid-evidence", `evidence[${index}] must be an object`);
    if (typeof entry.redacted_excerpt !== "string") {
      return invalid("invalid-evidence", `evidence[${index}].redacted_excerpt must be a string`);
    }
    if (hasSecretLikeText(entry.redacted_excerpt)) {
      return invalid("raw-secret-in-evidence", `evidence[${index}].redacted_excerpt contains unredacted sensitive content`);
    }
  }
  const shouldBeSensitive = evidence.some((entry) =>
    entry?.local_only === true || (Array.isArray(entry?.redactions_applied) && entry.redactions_applied.length > 0)
  );
  if (record.sensitive !== shouldBeSensitive) {
    return invalid("sensitive-flag-inconsistent", `sensitive must be ${shouldBeSensitive} for current evidence`);
  }
  return null;
}

export function validateIncidentRecord(record, options = {}) {
  const pending = importVisibilityError(options);
  if (pending) return pending;
  if (!isObject(record)) return invalid("invalid-record", "record must be an object");
  const schemaError = validateSchemaShape(record, "incident.json");
  if (schemaError) return schemaError;
  if (record.schema_version !== 1) return invalid("unsupported-version", "schema_version must be 1");
  if (!INCIDENT_ID_RE.test(record.id ?? "")) return invalid("invalid-id", "id must match INC timestamp format");
  if (!STATUSES.has(record.status)) return invalid("invalid-status", `status=${record.status}`);
  if (!RCA_STATUSES.has(record.rca_status)) return invalid("invalid-rca-status", `rca_status=${record.rca_status}`);
  if (isObject(record.root_cause_analysis) && Object.hasOwn(record.root_cause_analysis, "why_chain")) {
    return invalid("why-chain-not-allowed", "root_cause_analysis must use why_1 through why_5, not why_chain");
  }
  const linkError = validateLinks(record);
  if (linkError) return linkError;
  const closureError = validateClosure(record);
  if (closureError) return closureError;
  for (const ref of collectEvidenceRefs(record)) {
    if (typeof ref !== "string" || !evidenceRefResolves(ref, record, options)) {
      return invalid("evidence-ref-unresolved", String(ref));
    }
  }
  const transitionError = validateTransitions(record);
  if (transitionError) return transitionError;
  const sensitivityError = validateSensitivity(record);
  if (sensitivityError) return sensitivityError;
  return { status: "valid" };
}

export function validateProblemRecord(record, options = {}) {
  const pending = importVisibilityError(options);
  if (pending) return pending;
  if (!isObject(record)) return invalid("invalid-record", "record must be an object");
  const schemaError = validateSchemaShape(record, "problem.json");
  if (schemaError) return schemaError;
  if (record.schema_version !== 1) return invalid("unsupported-version", "schema_version must be 1");
  if (!PROBLEM_ID_RE.test(record.id ?? "")) return invalid("invalid-id", "id must match PROB format");
  if (!PROBLEM_STATUSES.has(record.status)) return invalid("invalid-status", `status=${record.status}`);
  if (!RCA_STATUSES.has(record.rca_status)) return invalid("invalid-rca-status", `rca_status=${record.rca_status}`);
  if (isObject(record.root_cause_analysis) && Object.hasOwn(record.root_cause_analysis, "why_chain")) {
    return invalid("why-chain-not-allowed", "root_cause_analysis must use why_1 through why_5, not why_chain");
  }
  const linkError = validateLinks(record);
  if (linkError) return linkError;
  const closureError = validateClosure(record);
  if (closureError) return closureError;
  for (const ref of collectEvidenceRefs(record)) {
    if (typeof ref !== "string" || !evidenceRefResolves(ref, record, options)) {
      return invalid("evidence-ref-unresolved", String(ref));
    }
  }
  const transitionError = validateTransitions(record, PROBLEM_STATUSES, PROBLEM_TRANSITIONS, "candidate");
  if (transitionError) return transitionError;
  if (["prevention-active", "monitoring", "closed"].includes(record.status)) {
    if (!RCA_MATURE_STATUSES.has(record.rca_status)) return invalid("rca-not-mature", record.status);
    if (!isNonEmptyValue(record.prevention_plan)) return invalid("prevention-plan-required", record.status);
  }
  for (const entry of transitionEntries(record)) {
    const edge = `${entry.from_status}->${entry.to_status}`;
    if ((edge === "candidate->investigating" || edge === "candidate->prevention-active") && !isObject(record.promotion_decision)) {
      return invalid("promotion-decision-required", edge);
    }
    if (edge === "investigating->prevention-active") {
      if (!RCA_MATURE_STATUSES.has(record.rca_status)) return invalid("rca-not-mature", edge);
      if (!isNonEmptyValue(record.prevention_plan)) return invalid("prevention-plan-required", edge);
    }
    if (edge === "prevention-active->monitoring" && !gateHasEvidenceOrAcceptedException(record.closure_gates?.retirement_criteria_met)) {
      return invalid("retirement-criteria-evidence-required", edge);
    }
    if (edge === "monitoring->closed") {
      if (!isObject(record.closure_decision)) return invalid("closed-without-closure-decision", edge);
      const requiredClosureError = validateRequiredClosureGates(record, PROBLEM_CLOSURE_GATES, edge);
      if (requiredClosureError) return requiredClosureError;
      if (!Array.isArray(record.retire_when) || record.retire_when.length === 0) return invalid("retire-when-required", edge);
    }
  }
  if (record.status === "closed") {
    if (!isObject(record.closure_decision)) return invalid("closed-without-closure-decision", "closed problems require closure_decision");
    const requiredClosureError = validateRequiredClosureGates(record, PROBLEM_CLOSURE_GATES, "closed problems");
    if (requiredClosureError) return requiredClosureError;
  }
  return { status: "valid" };
}

function hasGithubIssueSyncLink(record) {
  return Array.isArray(record.links) && record.links.some((link) =>
    link?.type === "github_issue" && (typeof link.url === "string" || isObject(link.github))
  );
}

function hasLifecycleContextLink(record) {
  return Array.isArray(record.links) && record.links.some((link) =>
    ["incident", "problem_cluster", "finding", "fix_log"].includes(link?.type)
  );
}

export function validateLocalIssueRecord(record, options = {}) {
  const pending = importVisibilityError(options);
  if (pending) return pending;
  if (!isObject(record)) return invalid("invalid-record", "record must be an object");
  const schemaError = validateSchemaShape(record, "local-issue.json");
  if (schemaError) return schemaError;
  if (record.schema_version !== 1) return invalid("unsupported-version", "schema_version must be 1");
  if (!LOCAL_ISSUE_ID_RE.test(record.id ?? "")) return invalid("invalid-id", "id must match ISS format");
  if (record.external_id !== `aivv:issue:${record.id}`) return invalid("invalid-external-id", "external_id must match aivv:issue:<id>");
  if (!LOCAL_ISSUE_STATUSES.has(record.status)) return invalid("invalid-status", `status=${record.status}`);
  if (!RCA_STATUSES.has(record.rca_status)) return invalid("invalid-rca-status", `rca_status=${record.rca_status}`);
  const linkError = validateLinks(record);
  if (linkError) return linkError;
  if (record.sync?.status === "synced" && (!record.sync.sync_hash || (!isObject(record.sync.github) && !hasGithubIssueSyncLink(record)))) {
    return invalid("github-sync-missing-key", "synced local issues require sync_hash and github metadata or link");
  }
  const closureError = validateClosure(record);
  if (closureError) return closureError;
  if (record.status === "closed") {
    const requiredClosureError = validateRequiredClosureGates(record, LOCAL_ISSUE_CLOSURE_GATES, "closed local issues");
    if (requiredClosureError) return requiredClosureError;
  }
  for (const ref of collectEvidenceRefs(record)) {
    if (typeof ref !== "string" || !evidenceRefResolves(ref, record, options)) {
      return invalid("evidence-ref-unresolved", String(ref));
    }
  }
  const transitionError = validateTransitions(record, LOCAL_ISSUE_STATUSES, LOCAL_ISSUE_TRANSITIONS, "drafted");
  if (transitionError) return transitionError;
  for (const entry of transitionEntries(record)) {
    const edge = `${entry.from_status}->${entry.to_status}`;
    if (edge === "drafted->rca-pending" && !hasLifecycleContextLink(record)) {
      return invalid("lifecycle-context-link-required", edge);
    }
    if (edge === "rca-pending->rca-reviewed") {
      const acceptedUnverified = record.rca_status === "accepted-unverified" && isNonEmptyValue(record.accepted_unverified_rationale);
      if (!RCA_MATURE_STATUSES.has(record.rca_status) && !acceptedUnverified) return invalid("rca-not-mature", edge);
    }
    if (edge === "rca-reviewed->fix-planned" && (!Array.isArray(record.acceptance_criteria) || record.acceptance_criteria.length === 0)) {
      return invalid("acceptance-criteria-required", edge);
    }
    if (edge === "fix-planned->fix-implemented" && !gateHasEvidenceOrAcceptedException(record.closure_gates?.verification_evidence)) {
      return invalid("verification-evidence-required", edge);
    }
    if (edge === "fix-implemented->prevention-verified" && !TERMINAL_GATE_OK.has(record.closure_gates?.verification_evidence?.status)) {
      return invalid("verification-evidence-not-terminal", edge);
    }
  }
  if (record.status === "closed") {
    if (!isObject(record.closure_decision)) return invalid("closed-without-closure-decision", "closed local issues require closure_decision");
    const requiredClosureError = validateRequiredClosureGates(record, LOCAL_ISSUE_CLOSURE_GATES, "closed local issues");
    if (requiredClosureError) return requiredClosureError;
  }
  return { status: "valid" };
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = value;
    i += 1;
  }
  return parsed;
}

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: node <AIVV_ROOT>/tools/incident-state.mjs <validate|redact|record-viewer-render-error> [options]");
  process.exit(64);
}

function writeJsonLine(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function inferLifecycleKind(record) {
  const id = typeof record?.id === "string" ? record.id : "";
  if (INCIDENT_ID_RE.test(id)) return "incident";
  if (PROBLEM_ID_RE.test(id)) return "problem";
  if (LOCAL_ISSUE_ID_RE.test(id)) return "local-issue";
  return null;
}

function validateLifecycleRecord(record, options) {
  const kind = options.kind ?? inferLifecycleKind(record);
  if (kind === "incident") return validateIncidentRecord(record, options);
  if (kind === "problem") return validateProblemRecord(record, options);
  if (kind === "local-issue") return validateLocalIssueRecord(record, options);
  return invalid("unsupported-lifecycle-kind", kind ?? String(record?.id ?? "<missing-id>"));
}

function nowIso() {
  return new Date().toISOString();
}

function incidentTimestamp(date = new Date()) {
  return date.toISOString().replace(/\.[0-9]{3}Z$/, "Z").replace(/:/g, "-").replace(/Z$/, "");
}

function atomicWriteJson(file, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  fs.renameSync(tmp, file);
}

function atomicCreateJson(file, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  try {
    fs.linkSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function incidentFileForId(incidentDir, id) {
  return path.join(incidentDir, `incident-${id.slice("INC-".length)}.json`);
}

function allocateNewIncidentTarget(incidentDir, incident, baseId = incident.id) {
  let id = baseId;
  let file = incidentFileForId(incidentDir, id);
  while (fs.existsSync(file)) {
    id = `${baseId}-${crypto.randomUUID().slice(0, 8)}`;
    file = incidentFileForId(incidentDir, id);
  }
  incident.id = id;
  return file;
}

function readTextFile(file) {
  return fs.readFileSync(file, "utf8");
}

function reviewIdFromRecord(record) {
  if (record.review_id !== undefined) return record.review_id;
  const link = Array.isArray(record.links)
    ? record.links.find((entry) => entry?.type === "review_log" && entry?.role === "created-from")
    : null;
  return link?.id ?? null;
}

function incidentsInDir(incidentDir) {
  if (!fs.existsSync(incidentDir)) return null;
  const records = [];
  for (const name of fs.readdirSync(incidentDir).filter((entry) => entry.endsWith(".json")).sort()) {
    const file = path.join(incidentDir, name);
    const parsed = parseJsonFile(file);
    if (parsed.error || !isObject(parsed.value)) continue;
    records.push({ file, record: parsed.value });
  }
  return records;
}

function sameDedupeKey(record, candidate) {
  return (
    record.trigger === candidate.trigger &&
    record.command === candidate.command &&
    String(record.exit_code) === String(candidate.exit_code) &&
    record.recurrence_key === candidate.recurrence_key &&
    (reviewIdFromRecord(record) ?? null) === (candidate.review_id ?? null)
  );
}

function withinDedupeCooldown(record, seenAt) {
  const lastSeen = Date.parse(record.last_seen_at);
  return Number.isFinite(lastSeen) && seenAt.getTime() - lastSeen <= DEDUPE_COOLDOWN_MS;
}

function findDedupeCandidate(incidentDir, candidate, seenAt) {
  for (const entry of incidentsInDir(incidentDir) ?? []) {
    if (entry.record.status === "closed") continue;
    if (sameDedupeKey(entry.record, candidate) && withinDedupeCooldown(entry.record, seenAt)) return entry;
  }
  return null;
}

function findClosedRelatedIncident(incidentDir, candidate, seenAt) {
  let newest = null;
  for (const entry of incidentsInDir(incidentDir) ?? []) {
    if (entry.record.status !== "closed") continue;
    if (!sameDedupeKey(entry.record, candidate) || !withinDedupeCooldown(entry.record, seenAt)) continue;
    const lastSeen = Date.parse(entry.record.last_seen_at);
    if (!newest || lastSeen > newest.lastSeen) newest = { ...entry, lastSeen };
  }
  return newest;
}

function evidenceRequiresSensitivity(evidence) {
  return (Array.isArray(evidence) ? evidence : []).some((entry) =>
    entry?.local_only === true || (Array.isArray(entry?.redactions_applied) && entry.redactions_applied.length > 0)
  );
}

function ensureValidIncidentForWrite(record, options) {
  const result = validateIncidentRecord(record, options);
  if (result.status !== "valid") {
    throw new Error(`refusing to write invalid incident ${record.id ?? "<missing-id>"}: ${result.reason}: ${result.detail}`);
  }
  return null;
}

function buildViewerIncident({ stateDir, reviewId, command, exitCode, stderrFile, stdoutFile, reportPath }) {
  const capturedAt = nowIso();
  const ts = incidentTimestamp(new Date(capturedAt));
  const stderr = readTextFile(stderrFile);
  const stdout = readTextFile(stdoutFile);
  const sourceKind = stderr.length > 0 ? "stderr" : "stdout";
  const sourceText = stderr.length > 0 ? stderr : stdout;
  const redacted = redactText(sourceText);
  const evidenceId = sourceKind === "stderr" ? "EVID-view-html-stderr" : "EVID-view-html-stdout";
  const sensitive = redacted.sensitive;
  const links = [];
  const normalizedReviewId = reviewId === "none" ? null : reviewId;
  if (normalizedReviewId) {
    links.push({
      type: "review_log",
      role: "created-from",
      id: normalizedReviewId,
      sync_status: "local-only"
    });
  }
  return {
    schema_version: 1,
    id: `INC-${ts}-viewer-render-error`,
    type: "runtime-tooling",
    status: "detected",
    severity: "medium",
    summary: "AIVV viewer failed while rendering an HTML report.",
    detected_at: capturedAt,
    last_seen_at: capturedAt,
    resolved_at: null,
    trigger: "viewer-render-error",
    command,
    exit_code: Number(exitCode),
    review_id: normalizedReviewId,
    report_path: reportPath === "none" ? null : reportPath,
    occurrence_count: 1,
    sensitive,
    impact: {
      user_visible: true,
      summary: "The requested static report was not generated."
    },
    timeline: [
      {
        ts: capturedAt,
        kind: "transition",
        summary: `HTML renderer exited with code ${exitCode}.`,
        transitioned_at: capturedAt,
        transitioned_by: "agent",
        transition_source: "auto",
        from_status: null,
        to_status: "detected"
      }
    ],
    evidence: [
      {
        id: evidenceId,
        kind: sourceKind,
        source_ref: command,
        redacted_excerpt: redacted.redacted_excerpt,
        sha256: redacted.sha256,
        redactions_applied: redacted.redactions_applied,
        publishable: !redacted.sensitive,
        local_only: redacted.sensitive,
        captured_at: capturedAt
      }
    ],
    recurrence_key: "viewer-render:aivv-html",
    rca_status: "draft",
    root_cause_analysis: {
      problem_specification: null,
      surface_symptom: "The static HTML report renderer exited non-zero.",
      why_1: null,
      why_2: null,
      why_3: null,
      why_4: null,
      why_5: null,
      root_cause: null,
      root_cause_category: null,
      confidence: "low",
      verification_method: "unable-to-verify",
      verification_evidence: null,
      confidence_gap: "Need renderer stderr/stdout and input report context.",
      confidence_gap_shape: "code-shaped"
    },
    incident_context: {
      detection_failure: null,
      contributing_factors: []
    },
    prevention_plan: null,
    source_fix_ref: null,
    lifecycle_evidence_refs: [evidenceId],
    closure_profile: "review-required",
    closure_gates: {
      rca_reviewed: { status: "pending", evidence_links: [], accepted_by: null, accepted_at: null, rationale: null },
      impact_mitigated: { status: "pending", evidence_links: [], accepted_by: null, accepted_at: null, rationale: null },
      prevention_defined: { status: "pending", evidence_links: [], accepted_by: null, accepted_at: null, rationale: null }
    },
    links
  };
}

function recordViewerRenderError(args) {
  for (const key of ["state-dir", "review-id", "command", "exit-code", "stderr-file", "stdout-file", "report-path"]) {
    if (!args[key]) usage(`Missing --${key}`);
  }
  const stateDir = path.resolve(args["state-dir"]);
  const incidentDir = path.join(stateDir, "incidents");
  ensurePrivateDirectory(incidentDir, stateDir);
  const incident = buildViewerIncident({
    stateDir,
    reviewId: args["review-id"],
    command: args.command,
    exitCode: args["exit-code"],
    stderrFile: args["stderr-file"],
    stdoutFile: args["stdout-file"],
    reportPath: args["report-path"]
  });
  const now = new Date(incident.last_seen_at);
  ensureValidIncidentForWrite(incident, { stateDir });
  const match = findDedupeCandidate(incidentDir, incident, now);
  if (match) {
    const existingHashes = new Set((match.record.evidence ?? []).map((entry) => entry.sha256));
    match.record.occurrence_count = Number(match.record.occurrence_count ?? 1) + 1;
    match.record.last_seen_at = incident.last_seen_at;
    match.record.timeline.push({
      ts: incident.last_seen_at,
      kind: "observed",
      summary: `Viewer render error observed again with exit code ${incident.exit_code}.`
    });
    if (!existingHashes.has(incident.evidence[0].sha256)) {
      match.record.evidence.push(incident.evidence[0]);
    }
    match.record.sensitive = evidenceRequiresSensitivity(match.record.evidence);
    ensureValidIncidentForWrite(match.record, { stateDir, file: match.file });
    validateContainedPath(match.file, stateDir);
    atomicWriteJson(match.file, match.record);
    return { status: "recorded", incident_id: match.record.id, path: match.file, deduped: true };
  }
  const related = findClosedRelatedIncident(incidentDir, incident, now);
  if (related) {
    incident.links.push({
      type: "incident",
      role: "related",
      id: related.record.id,
      sync_status: "local-only"
    });
  }
  const baseId = incident.id;
  while (true) {
    const file = allocateNewIncidentTarget(incidentDir, incident, baseId);
    ensureValidIncidentForWrite(incident, { stateDir, file });
    try {
      validateContainedPath(file, stateDir);
      atomicCreateJson(file, incident);
      return { status: "recorded", incident_id: incident.id, path: file, deduped: false };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  try {
    if (command === "validate") {
      if (!args.file) usage("Missing --file");
      const file = path.resolve(args.file);
      const snapshot = () => {
        const parsed = parseJsonFile(file);
        if (parsed.error) return invalid("json-parse-failed", parsed.error.message);
        return validateLifecycleRecord(parsed.value, {
          file, stateDir: args["state-dir"] ? path.resolve(args["state-dir"]) : undefined, kind: args.kind
        });
      };
      const context = visibilityContext({ file, stateDir: args["state-dir"] });
      const result = fs.existsSync(path.join(context.target_dir, "target.json"))
        ? withExistingStorageReadLock(context, snapshot) || invalid("record-missing", "Selected namespace disappeared") : snapshot();
      if (result.status === "valid") {
        writeJsonLine({ status: "valid", file: args.file });
        process.exit(0);
      }
      writeJsonLine(result);
      process.exit(2);
    }
    if (command === "redact") {
      if (!args["input-file"]) usage("Missing --input-file");
      const maxChars = args["max-chars"] === undefined ? 4000 : Number(args["max-chars"]);
      if (!Number.isInteger(maxChars) || maxChars < 0) usage("--max-chars must be a non-negative integer");
      writeJsonLine(redactText(readTextFile(args["input-file"]), maxChars));
      process.exit(0);
    }
    if (command === "record-viewer-render-error") {
      const context = args.context ? readStorageContext(args.context) : resolveStorage({ target: args.target });
      if (args.target && fs.realpathSync(path.resolve(args.target)) !== context.target) throw new Error("storage-context-target-mismatch");
      if (args["state-dir"] && path.resolve(args["state-dir"]) !== context.state_dir) throw new Error("state-dir-does-not-match-target");
      ensureStorage(context);
      args["state-dir"] = context.state_dir;
      writeJsonLine(await withStorageLock(context, () => recordViewerRenderError(args)));
      process.exit(0);
    }
    usage("Missing or unknown command");
  } catch (error) {
    writeJsonLine({ status: "error", reason: "unexpected-error", detail: error.message });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
