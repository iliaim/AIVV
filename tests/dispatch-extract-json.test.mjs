#!/usr/bin/env node
// extractJSONFromOutput turns a provider's raw CLI output into the findings object.
// Cases 1-5 are the ones the removed `dispatch.mjs --assert-extract-json` self-test
// checked; the fenced case covers the ```json stripping the function does first.
import assert from 'node:assert/strict';
import { extractJSONFromOutput } from '../plugin/tools/dispatch.mjs';

// Strategy 1: clean JSON parses directly.
assert.deepEqual(extractJSONFromOutput('{"id":"F001","severity":"MAJOR"}'), { id: 'F001', severity: 'MAJOR' });

// Markdown fences around the JSON are stripped before parsing.
assert.deepEqual(extractJSONFromOutput('```json\n{"findings":[]}\n```'), { findings: [] });

// Strategy 2: prose before the JSON; depth counting finds the balanced object.
assert.equal(extractJSONFromOutput('Here is the result:\n{"id":"F002","severity":"MINOR"}').id, 'F002');

// Strategy 3: an unbalanced { inside a string confuses depth counting; the
// first-{ to last-} slice lets JSON.parse handle it.
assert.equal(extractJSONFromOutput('Preamble text {"id":"F003","note":"has { inside string"} trailing').id, 'F003');

// Two adjacent objects: the first one wins.
assert.equal(extractJSONFromOutput('{"id":"F004"} {"id":"F005"}').id, 'F004');

// Documented limit: an unbalanced { in a string plus a } in the postamble defeats
// every strategy, and the function throws rather than guessing.
assert.throws(() => extractJSONFromOutput('{"id":"F006","note":"has { inside"} and postamble }'),
  /No complete JSON object found/);

console.log('dispatch extractJSONFromOutput tests passed');
