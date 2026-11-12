#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bypassVerdict,
  detectorVerdict,
  editFrame,
  multiEditSha,
  requiredAssertions,
  sha256,
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
assert.doesNotThrow(() => staleVerdict({ write_intents: [{ id: "WI-5", content_sha: "0".repeat(64), proposed_edits: [{ old_string: 1 }] }] }),
  "a non-string edit field is left to the shape checks, not thrown");
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
  const absent = cli(validatorCli, ["--fixture", path.join(scratch, "absent.json")]);
  assert.equal(absent.status, 1);
  assert.equal(JSON.parse(absent.stdout).reason, "input-file-unreadable");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log("pre-write validator policy tests passed");
