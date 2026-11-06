#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  bypassVerdict,
  detectorVerdict,
  editFrame,
  requiredAssertions,
  sha256,
  staleVerdict,
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

console.log("pre-write validator policy tests passed");
