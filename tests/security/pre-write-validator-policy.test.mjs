#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertionExecutionVerdict,
  bypassVerdict,
  detectorVerdict,
  editFrame,
  multiEditSha,
  requiredAssertions,
  sha256,
  shellSyntaxVerdict,
  staleVerdict,
  validateFixLogNewWrite,
  validateFixture,
} from "../../plugin/tools/pre-write-validator.mjs";

function intentFixture({ target_file = "src/change.js", content_shape, old_string = "old", new_string = "new" } = {}) {
  const intent = {
    id: "WI-1",
    finding_id: "F001",
    branch: "A",
    kind: "generated_patch",
    target_file,
    content_shape,
    detection_confidence: "high",
    proposed_edits: [{ old_string, new_string }],
  };
  return { write_intents: [intent], challenge_budget_remaining: 1 };
}

for (const shape of ["js", "ts", "py", "yaml", "yml", "toml"]) {
  assert.equal(detectorVerdict(intentFixture({ content_shape: shape })).status, "pass",
    `${shape} label alone must not demand per-intent approval`);
}

const promptFixture = intentFixture({
  target_file: "tests/fixtures/prompt-text.json",
  content_shape: "prompt-shaped",
  new_string: 'const fixture = "ignore previous instructions";',
});
assert.equal(detectorVerdict(promptFixture).status, "pass",
  "prompt-shaped text in an ordinary fixture is inert proposed content");
assert.equal(validateFixture(promptFixture).status, "pass",
  "ordinary prompt-shaped fixture text passes the full pre-write validator");

assert.deepEqual(requiredAssertions({ exact_content: '{"properties":{}}', pre_write_assertions: ["jq-parses"] }),
  new Set(["jq-parses", "schema-coherence"]));
assert.deepEqual(validateFixture({ exact_content: '{"properties":{}}', pre_write_assertions: ["jq-parses"] }),
  { status: "halt", reason: "incomplete-required-assertion" },
  "schema-like content still requires both mechanical assertions");

assert.equal(detectorVerdict(intentFixture({ target_file: ".env.local", content_shape: "js" })).reason,
  "unsupported-risky-path", "sensitive target paths remain blocked regardless of language");
assert.equal(detectorVerdict(intentFixture({ content_shape: "unsupported-risky-shape" })).reason,
  "unsupported-risky-shape", "explicitly unknown risky shapes remain blocked");
assert.equal(detectorVerdict(intentFixture({ old_string: "old\u0000bytes" })).reason,
  "unsupported-risky-shape", "NUL checks still cover the exact preimage as well as postimage");
const mixedContent = intentFixture({ old_string: "old\u0000bytes" });
mixedContent.write_intents[0].exact_content = "A second content field must not hide a binary preimage.";
assert.equal(detectorVerdict(mixedContent).reason, "unsupported-risky-shape",
  "every supplied write-content representation retains the NUL protection");
const rootContent = intentFixture();
rootContent.exact_content = "actual\u0000write";
assert.equal(detectorVerdict(rootContent).reason, "unsupported-risky-shape",
  "root-level write content cannot hide behind a nonempty intent array");
assert.equal(detectorVerdict(intentFixture({ new_string: 'const nul = "\\u0000";' })).status,
  "pass", "an inert source escape is text, not an actual NUL byte");

assert.equal(editFrame({ old_string: "é", new_string: "ok" }),
  "old_bytes=2\né\nnew_bytes=2\nok", "edit framing continues to use UTF-8 byte lengths");
const stale = intentFixture();
stale.write_intents[0].recorded_content_sha = sha256("different bytes");
assert.equal(staleVerdict(stale).reason, "stale-write-intent-content-mismatch",
  "stale exact-byte intents remain invalidated");
// Issue #26 item 7: content_sha is compared with the bytes, not only checked for shape.
const hashed = intentFixture();
hashed.write_intents[0].proposed_edits[0].content_sha = sha256(editFrame({ old_string: "old", new_string: "new" }));
hashed.write_intents[0].content_sha = multiEditSha(hashed.write_intents[0].proposed_edits);
assert.equal(staleVerdict(hashed).status, "pass", "matching hashes pass");
const driftedEdit = structuredClone(hashed);
driftedEdit.write_intents[0].proposed_edits[0].new_string = "changed after approval";
const driftedVerdict = staleVerdict(driftedEdit);
assert.equal(driftedVerdict.reason, "stale-write-intent-content-mismatch",
  "bytes that no longer match the approved content_sha are stale");
assert.match(driftedVerdict.detail, /WI-1/);
const wholeText = { write_intents: [{ id: "WI-2", branch: "B", kind: "verbatim_doc_content", exact_content_or_patch: "doc text\n", content_sha: sha256("doc text\n") }] };
assert.equal(staleVerdict(wholeText).status, "pass");
const wholeTextEmptyEdits = structuredClone(wholeText);
wholeTextEmptyEdits.write_intents[0].proposed_edits = [];
assert.equal(staleVerdict(wholeTextEmptyEdits).status, "pass", "an empty edits array does not turn a whole-text intent into a patch");
assert.equal(staleVerdict({ write_intents: [{ id: "WI-3", recorded_content_sha: "0".repeat(64) }] }).reason,
  "stale-write-intent-content-mismatch", "a legacy recorded hash with no bytes still halts");
assert.doesNotThrow(() => staleVerdict({ write_intents: [{ id: "WI-4", proposed_edits: [null] }] }));
assert.equal(staleVerdict({ write_intents: [{ id: "WI-5", content_sha: "0".repeat(64), proposed_edits: [{ old_string: 1, new_string: "new" }] }] }).reason,
  "write-intent-edit-shape-invalid", "a recorded hash over an edit that cannot be hashed halts; it is neither thrown nor passed");
assert.equal(staleVerdict({ write_intents: [{ id: "WI-6", proposed_edits: [null, { content_sha: "0".repeat(64) }] }] }).reason,
  "write-intent-edit-shape-invalid");
wholeText.write_intents[0].exact_content_or_patch = "other text\n";
assert.equal(staleVerdict(wholeText).reason, "stale-write-intent-content-mismatch");

const regeneratedBypass = intentFixture();
regeneratedBypass.intent_regenerated = true;
regeneratedBypass.write_intents[0].content_sha = sha256("approved bytes");
regeneratedBypass.write_intents[0].detector_result = {
  bypass_approval: {
    write_intent_id: "WI-1",
    shape: "unsupported-risky-shape",
    approved_by: "user",
    approval_source: "host-user-input-event",
    approval_event_id: "event-1",
    user_approved_at: "2026-11-06T00:00:00Z",
    reason: "approved in the fixture",
    scope: "one intent",
    content_sha: sha256("approved bytes"),
    expires_at: "2026-11-07T00:00:00Z",
  },
};
assert.equal(bypassVerdict(regeneratedBypass).reason, "bypass-invalidated-after-regeneration",
  "regenerated intents still invalidate prior approvals");

// A dated bypass approval authorizes nothing once it has lapsed.
const datedBypass = (expires_at) => {
  const fixture = structuredClone(regeneratedBypass);
  delete fixture.intent_regenerated;
  fixture.write_intents[0].detector_result.bypass_approval.expires_at = expires_at;
  return fixture;
};
assert.deepEqual(bypassVerdict(datedBypass(new Date(Date.now() + 3600000).toISOString())), { status: "pass", reason: "pass" },
  "an unexpired bypass approval still applies");
for (const expiresAt of ["2000-01-01T00:00:00Z", new Date(Date.now() - 1000).toISOString(), "not-a-date", 4102444800000]) {
  assert.equal(bypassVerdict(datedBypass(expiresAt)).reason, "bypass-approval-expired",
    `an expired or unparseable expires_at (${expiresAt}) must halt`);
}
const conditionBypass = datedBypass(undefined);
conditionBypass.write_intents[0].detector_result.bypass_approval.expires_condition = "until this fix session ends";
assert.deepEqual(bypassVerdict(conditionBypass), { status: "pass", reason: "pass" },
  "a free-text expires_condition is left to the existing checks");

// Issue #26 items 5 and 6: a halt names the field and the allowed values, and the
// command-line tools answer --help and reject unreadable input without a stack trace.
const fixLog = () => ({
  schema_version: 2, id: "2026-11-07T12-00-00-a001", command: "aivv-fix", status: "in-progress",
  source: "conversation", invoked_at: "2026-11-07T12:00:00Z", target_project: os.tmpdir(), cycle_count: 1,
  authorized_scope: { source: "conversation", goal: "g", finding_ids: ["F001"], included: ["F001"], excluded: [], included_paths: [], excluded_paths: [] },
  rework_retry_count: 0, max_rework_retries: 3, rework_retry_history: [],
});
const wrongGate = fixLog();
wrongGate.rework_retry_count = 1;
wrongGate.rework_retry_history = [{ retry_number: 1, gate: "plan", finding_ids: ["F001"], defect: "d", evidence: "e" }];
const wrongGateVerdict = validateFixLogNewWrite(wrongGate);
assert.equal(wrongGateVerdict.reason, "fix-log-rework-retry-history-invalid");
assert.match(wrongGateVerdict.detail, /rework_retry_history\[0\]\.gate/, "the halt names the failing field");
assert.match(wrongGateVerdict.detail, /"plan"/, "the halt shows the rejected value");
assert.match(wrongGateVerdict.detail, /plan-readiness/, "the halt lists the allowed values");
const wrongId = validateFixLogNewWrite({ ...fixLog(), id: "fix-123" });
assert.equal(wrongId.reason, "fix-log-id-invalid");
assert.match(wrongId.detail, /YYYY-MM-DDTHH-MM-SS-<4 hex>/);
const noPaths = fixLog();
delete noPaths.authorized_scope.included_paths;
const noPathsVerdict = validateFixLogNewWrite(noPaths);
assert.equal(noPathsVerdict.reason, "fix-log-authorized-scope-invalid");
assert.match(noPathsVerdict.detail, /authorized_scope\.included_paths/);
const wrongStatus = validateFixLogNewWrite({ ...fixLog(), status: "done" });
assert.match(wrongStatus.detail, /in-progress/);

// A syntax checker that runs out of time under host load halts with its own retryable
// reason; it is neither a pass nor reported as invalid syntax. Stand-in checkers that
// never finish are put first on PATH, and a short limit keeps the test fast.
const slowBin = mkdtempSync(path.join(os.tmpdir(), "aivv-slow-checker-"));
const originalPath = process.env.PATH;
try {
  for (const name of ["bash", "jq"]) {
    writeFileSync(path.join(slowBin, name), "#!/bin/sh\nexec sleep 10\n");
    chmodSync(path.join(slowBin, name), 0o755);
  }
  process.env.PATH = `${slowBin}${path.delimiter}${originalPath}`;
  const shellTimeout = shellSyntaxVerdict(
    { write_intents: [{ id: "WI-1", content_shape: "shell", language: "bash", pre_write_assertions: ["shell-syntax-valid"], exact_content: "echo ok\n" }] },
    { checkerTimeoutMs: 200 });
  assert.equal(shellTimeout.status, "halt", "a checker timeout never passes");
  assert.equal(shellTimeout.reason, "shell-checker-timeout", "a checker timeout is not reported as invalid syntax");
  assert.match(shellTimeout.detail, /200 ms.*rerun the validator/);
  const jqTimeout = assertionExecutionVerdict(
    { write_intents: [{ id: "WI-1", pre_write_assertions: [{ kind: "jq-parses", args: { block_id: 1 } }], exact_content: '```json\n{"ok": true}\n```' }] },
    { checkerTimeoutMs: 200 });
  assert.equal(jqTimeout.status, "halt", "a jq timeout never passes");
  assert.equal(jqTimeout.reason, "pre-write-validate-jq-checker-timeout", "a jq timeout is not reported as invalid JSON");
  assert.match(jqTimeout.detail, /200 ms/);
} finally {
  process.env.PATH = originalPath;
  rmSync(slowBin, { recursive: true, force: true });
}
assert.equal(shellSyntaxVerdict({ write_intents: [{ id: "WI-1", content_shape: "shell", language: "bash", exact_content: "if then\n" }] }).reason,
  "shell-syntax-invalid", "real syntax errors keep their own reason");

// Assertion file args resolve against target_project, not the process cwd: a stale copy
// of the same relative path beside the orchestrator must not decide the verdict.
const citeRoot = mkdtempSync(path.join(os.tmpdir(), "aivv-cite-base-"));
const originalCwd = process.cwd();
try {
  const project = path.join(citeRoot, "project");
  const decoy = path.join(citeRoot, "decoy");
  for (const dir of [project, decoy]) mkdirSync(path.join(dir, "docs"), { recursive: true });
  writeFileSync(path.join(project, "docs/notes.md"), "current text\n");
  writeFileSync(path.join(decoy, "docs/notes.md"), "stale text\n");
  writeFileSync(path.join(project, "docs/schema.json"), JSON.stringify({ properties: { current: { type: "object" } } }));
  writeFileSync(path.join(decoy, "docs/schema.json"), JSON.stringify({ properties: { stale: { type: "object" } } }));
  writeFileSync(path.join(citeRoot, "outside.md"), "current text\n");
  const cite = (file, expected_snippet) => assertionExecutionVerdict({
    target_project: project,
    write_intents: [{ id: "WI-1", pre_write_assertions: [{ kind: "line-cite-valid", args: { temporal_target: "pre_write", cite_form: "L1", file, expected_snippet } }] }],
  });
  const nest = (parent_schema_path, expected_nest_path) => assertionExecutionVerdict({
    target_project: project,
    write_intents: [{ id: "WI-1", exact_content: '```json\n{"properties":{}}\n```', pre_write_assertions: [{ kind: "schema-coherence", args: { block_id: 1, parent_schema_path, expected_nest_path } }] }],
  });
  process.chdir(decoy);
  assert.equal(cite("docs/notes.md", "current text").status, "pass", "the target project's copy is the one cited");
  assert.equal(cite("docs/notes.md", "stale text").reason, "pre-write-validate-l-n-citation-mismatch",
    "a matching copy beside the process cwd does not pass the citation");
  assert.equal(nest("docs/schema.json", "properties.current").status, "pass");
  assert.equal(nest("docs/schema.json", "properties.stale").reason, "schema-coherence-failed",
    "the parent schema is read from the target project, not the process cwd");
  const escaped = cite("../outside.md", "current text");
  assert.equal(escaped.reason, "unsupported-risky-path", "a relative path cannot leave the target project");
  assert.match(escaped.detail, /file "\.\.\/outside\.md" must be relative to target_project/);
  assert.equal(nest("../decoy/docs/schema.json", "properties.stale").reason, "unsupported-risky-path");
  assert.equal(nest("docs/absent.json", "properties.current").reason, "schema-coherence-failed",
    "an unreadable parent schema halts instead of throwing");
} finally {
  process.chdir(originalCwd);
  rmSync(citeRoot, { recursive: true, force: true });
}

const toolsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../plugin/tools");
const validatorCli = path.join(toolsDir, "pre-write-validator.mjs");
const cli = (tool, args) => spawnSync(process.execPath, [tool, ...args], { encoding: "utf8" });
const scratch = mkdtempSync(path.join(os.tmpdir(), "aivv-validator-cli-"));
try {
  for (const tool of [validatorCli, path.join(toolsDir, "incident-lifecycle-route.mjs")]) {
    const help = cli(tool, ["--help"]);
    assert.equal(help.status, 0, `${path.basename(tool)} --help must succeed: ${help.stderr || help.stdout}`);
    assert.match(help.stdout, /usage:/i);
  }
  const malformed = path.join(scratch, "malformed.json");
  writeFileSync(malformed, "{ not json");
  const context = path.join(scratch, "context.json");
  writeFileSync(context, "{}");
  for (const args of [["--fixture", malformed], ["--fix-log", malformed, "--context", context, "--new"], ["--review-log", malformed]]) {
    const result = cli(validatorCli, args);
    assert.equal(result.status, 1, `${args[0]} on malformed JSON must halt, not crash`);
    const verdict = JSON.parse(result.stdout);
    assert.equal(verdict.reason, "input-json-invalid");
    assert.ok(verdict.detail.includes(malformed));
    assert.doesNotMatch(result.stderr, /SyntaxError|at .*\.mjs/, "no stack trace");
  }
  // Run through a symlinked tools directory (a linked AIVV_ROOT), the CLI still
  // reports its verdict and exit code instead of exiting 0 with no output.
  const linkedTools = path.join(scratch, "linked-tools");
  symlinkSync(toolsDir, linkedTools, "dir");
  const linked = cli(path.join(linkedTools, "pre-write-validator.mjs"), ["--fixture", malformed]);
  assert.equal(linked.status, 1, "a symlinked validator path must not exit 0 without a verdict");
  assert.equal(JSON.parse(linked.stdout).reason, "input-json-invalid");
  // The CLI gate fails closed on anything that is not a real /aivv-fix write batch.
  const shapeFile = path.join(scratch, "shape.json");
  const completeIntent = {
    id: "WI-1", finding_id: "F001", branch: "A", target_file: "src/change.js", operation: "edit",
    kind: "generated_patch", source_step: "Step 4.4", pre_write_assertions: [],
    proposed_edits: [{ old_string: "old", new_string: "new" }],
    content_sha: multiEditSha([{ old_string: "old", new_string: "new" }]),
  };
  for (const [input, reason] of [
    ["{}", "no-pre-write-inspectable-intent"],
    ["[]", "fixture-not-object"],
    ["null", "fixture-not-object"],
    ['"text"', "fixture-not-object"],
    [JSON.stringify({ command: "aivv-fix", write_intents: [] }), "no-pre-write-inspectable-intent"],
    [JSON.stringify({ command: "aivv-fix", write_intents: {} }), "no-pre-write-inspectable-intent"],
    [JSON.stringify({ command: "aivv-fix", write_intents: ["WI-1"] }), "no-pre-write-inspectable-intent"],
    [JSON.stringify({ write_intents: [completeIntent] }), "fixture-command-not-aivv-fix"],
    [JSON.stringify({ command: "aivv-review", write_intents: [completeIntent] }), "fixture-command-not-aivv-fix"],
  ]) {
    writeFileSync(shapeFile, input);
    const result = cli(validatorCli, ["--fixture", shapeFile]);
    assert.equal(result.status, 1, `--fixture ${input} must halt`);
    assert.equal(JSON.parse(result.stdout).reason, reason, `--fixture ${input}`);
  }
  const absent = cli(validatorCli, ["--fixture", path.join(scratch, "absent.json")]);
  assert.equal(absent.status, 1);
  assert.equal(JSON.parse(absent.stdout).reason, "input-file-unreadable");
  // A failing fixture keeps its real halt reason on top; the rework limit is a note, not a replacement.
  const atLimit = path.join(scratch, "at-limit.json");
  const failing = { write_intents: [{ id: "WI-1", target_file: "../outside.js", proposed_edits: [{ old_string: "a", new_string: "b" }] }] };
  writeFileSync(atLimit, JSON.stringify({ ...failing, rework_retry_count: 3, max_rework_retries: 3 }));
  const atLimitVerdict = JSON.parse(cli(validatorCli, ["--fixture", atLimit]).stdout);
  assert.equal(atLimitVerdict.status, "halt");
  assert.equal(atLimitVerdict.reason, "unsupported-risky-path", "the actual failure is not hidden behind the limit");
  assert.match(atLimitVerdict.rework_limit_note, /at or past the rework limit \(3 of 3\)/);
  writeFileSync(atLimit, JSON.stringify({ ...failing, rework_retry_count: 1, max_rework_retries: 3 }));
  assert.equal(JSON.parse(cli(validatorCli, ["--fixture", atLimit]).stdout).rework_limit_note, undefined);
  writeFileSync(atLimit, JSON.stringify(failing));
  const noMeta = JSON.parse(cli(validatorCli, ["--fixture", atLimit]).stdout);
  assert.equal(noMeta.reason, "unsupported-risky-path");
  assert.match(noMeta.rework_limit_note, /rework_retry_count and max_rework_retries/);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log("pre-write validator policy tests passed");
