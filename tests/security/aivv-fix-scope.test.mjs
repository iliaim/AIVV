#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  validateFixture,
  validateFixLogNewWrite,
  validateFixLogTransition,
} from '../../plugin/tools/pre-write-validator.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STORAGE_HELPER = path.join(REPO_ROOT, 'plugin/tools/storage-paths.mjs');
const validator = path.join(REPO_ROOT, 'plugin/tools/pre-write-validator.mjs');
// macOS commonly exposes the temp root through /var while realpath resolves /private/var.
const TEMP_ROOT = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'aivv-fix-scope-')));
const TARGET = path.join(TEMP_ROOT, 'target');
const HOME = path.join(TEMP_ROOT, 'home');
const CONTEXT_FILE = path.join(TEMP_ROOT, 'storage-context.json');
const INVOCATION_ID = '2026-11-07T12-00-00-a001';
const originalEnvironment = Object.fromEntries(['HOME', 'LOCALAPPDATA', 'XDG_STATE_HOME', 'XDG_CACHE_HOME']
  .map((name) => [name, process.env[name]]));
const env = {
  ...process.env,
  HOME,
  LOCALAPPDATA: path.join(HOME, 'AppData/Local'),
  XDG_STATE_HOME: path.join(HOME, 'state'),
  XDG_CACHE_HOME: path.join(HOME, 'cache'),
};

function storage(args) {
  const result = spawnSync(process.execPath, [STORAGE_HELPER, ...args], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function storeJson(relative, value) {
  const source = path.join(TEMP_ROOT, `source-${path.basename(relative)}`);
  writeFileSync(source, `${JSON.stringify(value)}\n`);
  storage(['write', '--context', CONTEXT_FILE, '--area', 'state', '--relative', relative, '--source', source]);
}

function scope() {
  return {
    source: 'conversation',
    goal: 'Fix the selected finding without changing the authorized task.',
    finding_ids: ['F001'],
    included: ['F001'],
    excluded: [],
    included_paths: ['.'],
    excluded_paths: ['private'],
  };
}

function fixture(targetFile = 'src/change.js') {
  return {
    command: 'aivv-fix',
    invocation_id: INVOCATION_ID,
    target_project: TARGET,
    authorized_scope: scope(),
    rework_retry_count: 0,
    max_rework_retries: 3,
    challenge_budget_remaining: 1,
    write_intents: [{
      id: 'WI-1',
      finding_id: 'F001',
      branch: 'A',
      kind: 'generated_patch',
      target_file: targetFile,
      detection_confidence: 'high',
      proposed_edits: [{ old_string: 'old', new_string: 'new' }],
    }],
  };
}

function baseLog() {
  return {
    schema_version: 2,
    id: INVOCATION_ID,
    command: 'aivv-fix',
    status: 'in-progress',
    source: 'conversation',
    invoked_at: '2026-11-07T12:00:00Z',
    target_project: TARGET,
    cycle_count: 1,
    authorized_scope: scope(),
    rework_retry_count: 0,
    max_rework_retries: 3,
    rework_retry_history: [],
  };
}

try {
  Object.assign(process.env, {
    HOME,
    LOCALAPPDATA: env.LOCALAPPDATA,
    XDG_STATE_HOME: env.XDG_STATE_HOME,
    XDG_CACHE_HOME: env.XDG_CACHE_HOME,
  });
  mkdirSync(path.join(TARGET, 'src'), { recursive: true });
  mkdirSync(path.join(TARGET, 'private'), { recursive: true });
  mkdirSync(HOME, { recursive: true });
  const context = JSON.parse(storage(['ensure', '--target', TARGET]));
  writeFileSync(CONTEXT_FILE, `${JSON.stringify(context)}\n`);

  const newRunProposal = validateFixture(fixture(), { contextFile: CONTEXT_FILE, proposalOnly: true });
  assert.equal(newRunProposal.status, 'pass');
  assert.equal(newRunProposal.proposal_only, true);
  assert.equal(newRunProposal.write_authorized, false,
    'a proposal-only pass must not be confused with a write authorization');

  const baseline = baseLog();
  baseline.storage_context = {
    instance_key: context.instance_key,
    target_project: context.target,
    policy_target: context.policy_target,
  };
  storeJson(`fix-${INVOCATION_ID}.json`, baseline);

  assert.deepEqual(validateFixture(fixture(), { contextFile: CONTEXT_FILE }),
    { status: 'pass', reason: 'pass' },
    'a write fixture passes only when its scope matches the persisted invocation snapshot');

  const narrowedBoundary = fixture('private/change.js');
  narrowedBoundary.authorized_scope.excluded_paths = [];
  assert.equal(validateFixture(narrowedBoundary, { contextFile: CONTEXT_FILE }).reason,
    'fix-log-authorized-scope-changed-before-write',
    'a fixture cannot remove an explicit exclusion and authorize its own target');

  const excludedTarget = validateFixture(fixture('private/change.js'), { contextFile: CONTEXT_FILE });
  assert.equal(excludedTarget.reason, 'fix-log-write-target-explicitly-excluded');

  if (process.platform !== 'win32') {
    const outside = path.join(TEMP_ROOT, 'outside');
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, path.join(TARGET, 'redirect'), 'dir');
    assert.equal(validateFixture(fixture('redirect/change.js'), { contextFile: CONTEXT_FILE }).reason,
      'unsupported-risky-path',
      'existing symlink traversal must be rejected before a host write');
  }

  let current = baseLog();
  assert.deepEqual(validateFixLogTransition(current, undefined), { status: 'pass', reason: 'pass' });
  const outOfScopeFinding = baseLog();
  outOfScopeFinding.findings_addressed = ['F999'];
  assert.equal(validateFixLogNewWrite(outOfScopeFinding).reason,
    'fix-log-finding-outside-authorized-scope',
    'a selected invocation cannot record work against an unauthorized finding');
  const retryEvent = (retry_number, gate) => ({
    retry_number,
    gate,
    finding_ids: ['F001'],
    defect: `Specific ${gate} defect in the proposed correction.`,
    evidence: `Observed evidence for retry ${retry_number} at src/change.js.`,
  });
  for (const [gate, cycleCount] of [['challenge', 1], ['verification', 2], ['pre-write', 2]]) {
    const next = structuredClone(current);
    next.rework_retry_count += 1;
    next.rework_retry_history.push(retryEvent(next.rework_retry_count, gate));
    next.cycle_count = cycleCount;
    assert.deepEqual(validateFixLogTransition(next, current), { status: 'pass', reason: 'pass' },
      `${gate} rework consumes the same invocation-wide retry count`);
    current = next;
  }
  const overBudget = structuredClone(current);
  overBudget.rework_retry_count = 4;
  overBudget.rework_retry_history.push(retryEvent(4, 'verification'));
  overBudget.cycle_count = 3;
  // Issue #26 item 2: the limit is a setting and is soft. Past it, one more rework needs a recorded reason.
  const pastLimit = validateFixLogTransition(overBudget, current);
  assert.equal(pastLimit.reason, 'fix-log-rework-retry-history-invalid',
    'a rework past the limit without a recorded reason is refused');
  assert.match(pastLimit.detail, /rework_retry_history\[3\]\.beyond_limit_reason/);
  const justified = structuredClone(overBudget);
  justified.rework_retry_history[3].beyond_limit_reason =
    'Retry 3 produced a right-reason failing test that isolates the defect to one call site; one more correction is expected to pass it.';
  assert.deepEqual(validateFixLogTransition(justified, current), { status: 'pass', reason: 'pass' },
    'past the limit the agent may continue on its recorded judgement');
  const raisedLimit = structuredClone(overBudget);
  raisedLimit.max_rework_retries = 5;
  assert.equal(validateFixLogTransition(raisedLimit, current).reason, 'fix-log-max-rework-retries-mutated',
    'the limit is read from settings once and cannot be raised mid-run');
  const configured = { ...baseLog(), max_rework_retries: 1, rework_retry_count: 1, rework_retry_history: [retryEvent(1, 'challenge')] };
  assert.deepEqual(validateFixLogNewWrite(configured), { status: 'pass', reason: 'pass' }, 'the limit is a setting, not a fixed 3');
  assert.equal(validateFixLogNewWrite({ ...baseLog(), max_rework_retries: 0 }).reason, 'fix-log-rework-retry-state-invalid');
  assert.equal(validateFixLogNewWrite({ ...baseLog(), max_rework_retries: undefined }).reason, 'fix-log-rework-retry-state-invalid',
    'a log without the limit is still refused');
  const configSchema = JSON.parse(readFileSync(path.join(REPO_ROOT, 'plugin/.aivv/schemas/config.schema.json'), 'utf8'));
  assert.equal(configSchema.properties.max_rework_retries.default, 3);
  const fixLogSchema = JSON.parse(readFileSync(path.join(REPO_ROOT, 'plugin/.aivv/schemas/fix-log.json'), 'utf8'));
  assert.equal(fixLogSchema.properties.max_rework_retries.const, undefined);
  assert.equal(fixLogSchema.properties.rework_retry_count.maximum, undefined);

  // Plan-stage persistence (issue #26 item 9): the fix log exists from Step 4.4,
  // before any change, carrying the write intents and the decision ledger.
  const planIntent = {
    id: 'WI-1', finding_id: 'F001', branch: 'A', target_file: 'src/change.js', operation: 'edit',
    kind: 'generated_patch', content_sha: 'a'.repeat(64), source_step: 'Step 4.4',
    pre_write_assertions: [], detector_result: { verdict: 'pass', content_shapes: [], detection_confidence: 'high' },
    proposed_edits: [{ old_string: 'old', new_string: 'new', content_sha: 'b'.repeat(64) }],
  };
  const planLog = { ...baseLog(), write_intents: [planIntent], decision_ledger: [{ finding_id: 'F001', challenge_status: 'not-triggered' }] };
  assert.deepEqual(validateFixLogTransition(planLog, undefined), { status: 'pass', reason: 'pass' },
    'a plan-stage fix log with intents and ledger but no change is a valid first write');
  const ledgerUpdate = structuredClone(planLog);
  ledgerUpdate.decision_ledger[0].challenge_status = 'approved';
  assert.deepEqual(validateFixLogTransition(ledgerUpdate, planLog), { status: 'pass', reason: 'pass' },
    'recording a later decision is an ordinary update of the same invocation');
  const redRecorded = structuredClone(ledgerUpdate);
  redRecorded.decision_ledger[0].red_run = { status: 'failed-right-reason', test_intent_id: 'WI-1', command_argv: ['node', 'src/change.test.js'], exit: 1 };
  redRecorded.files_created = ['src/change.test.js'];
  assert.deepEqual(validateFixLogTransition(redRecorded, ledgerUpdate), { status: 'pass', reason: 'pass' },
    'the red run and its early test write are recorded before any fix change exists');
  assert.equal(validateFixLogNewWrite({ ...redRecorded, files_created: ['private/change.test.js'] }).reason,
    'fix-log-write-target-explicitly-excluded',
    'an early test write is held to the authorized path boundary');
  const strayLedger = structuredClone(planLog);
  strayLedger.decision_ledger.push({ finding_id: 'F999' });
  assert.equal(validateFixLogNewWrite(strayLedger).reason, 'fix-log-finding-outside-authorized-scope',
    'a ledger entry cannot record decisions for an unauthorized finding');
  const badLedger = { ...planLog, decision_ledger: { finding_id: 'F001' } };
  assert.equal(validateFixLogNewWrite(badLedger).reason, 'fix-log-decision-ledger-invalid');

  const skill = readFileSync(path.join(REPO_ROOT, 'plugin/skills/aivv-fix/SKILL.md'), 'utf8');
  const decisioning = readFileSync(path.join(REPO_ROOT, 'plugin/skills/aivv-fix/references/execution-decisioning.md'), 'utf8');
  assert.match(skill, /### Step 4\.4:[\s\S]*?persist[\s\S]*?`write_intents\[\]`[\s\S]*?### Step 4\.5/,
    'Step 4.4 must persist the plan before the challenge');
  assert.doesNotMatch(decisioning, /in-memory decision ledger/,
    'the decision ledger must not live only in memory');

  // Order (issue #26 item 1): the failing test runs before the plan challenge,
  // and the challenger is given the test bytes and the red output.
  const reference = (name) => readFileSync(path.join(REPO_ROOT, 'plugin/skills/aivv-fix/references', name), 'utf8');
  const redStep = skill.indexOf('### Step 4.4.5: RED-GREEN TEST GATE');
  const challengeStep = skill.indexOf('### Step 4.5: CHALLENGE');
  assert.ok(redStep > skill.indexOf('### Step 4.4: MATERIALIZE') && redStep < challengeStep,
    'the red run must sit between write-intent materialization and the plan challenge');
  assert.match(skill, /4\.4\.5 RED[^\n]*?→ 4\.5 CHALLENGE[^\n]*?→ 5 EXECUTE/, 'the quick-reference flow must show red before challenge');
  assert.match(skill, /remediation boundary: no fix is written before Step 5 EXECUTE; the only earlier project write is a failing reproduction test/);
  const redGate = reference('red-green-gate.md');
  assert.match(redGate, /Run the test now, before Step 4\.5/);
  assert.match(redGate, /Write early only when no user decision is pending:\*\* readiness for this finding would record `approval_mode: "auto"`/,
    'the early test write is an allow-list tied to the readiness outcome');
  assert.match(redGate, /would route the finding `dangerously-auto-approved`[^\n]*?not policy-skipped, no architecture approval outstanding/,
    'the dangerous route does not by itself permit the early write');
  assert.match(redGate, /In every other case \(policy `ask` or `skip`[^\n]*do not write the test early/,
    'a pending user decision still comes before any project write');
  assert.match(redGate, /Undo the early test write\*\* whenever the fix for its finding is not applied in this invocation/,
    'a failing test must not be left behind');
  assert.match(redGate, /first run the finding's read-only class-verdict scan[^\n]*?write early only if the verdict gate passes and the scan leaves the finding's confidence and route unchanged\. Record the result on the finding's decision-ledger entry as `class_scan`/,
    'a decision that only the Step 5 class scan can raise must be known before the early write');
  assert.match(redGate, /only while the file still matches the content this run wrote/,
    'undo must not delete a file the user changed after the run stopped');
  assert.match(reference('fix-log-contract.md'), /On "Restart": first undo any early test write as in item 2/);
  assert.match(reference('fix-log-contract.md'), /reuse the result recorded as `class_scan` on its `decision_ledger\[\]` entry and do not run those steps again/,
    'Step 5 and a resumed run must not rescan with the failing test already on disk');
  assert.match(reference('fix-log-contract.md'), /confirm the file still holds the content this run wrote/);
  assert.match(redGate, /Before the early write, add the test path to `files_created` or `files_modified`/,
    'an early test write must be visible to recovery before it happens');
  assert.match(reference('fix-log-contract.md'), /files created: \{files_created\}/, 'the recovery prompt shows created files');
  const challengeLoop = reference('challenge-loop.md');
  assert.match(challengeLoop, /`\{red_run_evidence\}`/);
  assert.match(challengeLoop, /\*\*APPROVE:\*\* proceed to Step 5 EXECUTE/);
  const challengerPrompt = reference('fix-challenger-prompt-template.md');
  assert.match(challengerPrompt, /\{red_run_evidence/);
  assert.match(challengerPrompt, /setup error/, 'the challenger must check the test fails for the right reason');
  const pluginRoot = path.join(REPO_ROOT, 'plugin');
  const stale = readdirSync(pluginRoot, { recursive: true })
    .filter((file) => /\.(md|json|mjs|toml)$/.test(file))
    .filter((file) => /Step 4\.6/.test(readFileSync(path.join(pluginRoot, file), 'utf8')));
  assert.deepEqual(stale, [], 'nothing may point at the removed Step 4.6');

  // The references must give one answer on when the investigator or the verifier may be skipped.
  const dispatch = reference('investigation-dispatch.md');
  assert.doesNotMatch(dispatch, /\*\*Skip the investigator\*\*/, 'the fast path is the only investigator skip route');
  assert.match(dispatch, /there is no other skip route/);
  assert.doesNotMatch(reference('triage.md'), /investigator skip is permitted/);
  const fastPath = reference('fast-path.md');
  assert.doesNotMatch(fastPath, /trivially checked/, 'the fast path may not carry its own verifier exemption');
  assert.match(fastPath, /decided only by the conditions in \[verifier-dispatch\.md\]/);

  const challengePolicy = readFileSync(path.join(REPO_ROOT, 'plugin/skills/aivv-fix/references/challenge-loop.md'), 'utf8');
  assert.match(challengePolicy, /Uncertainty-only output[\s\S]*?does not trigger another investigation[\s\S]*?does not consume a retry/);
  assert.match(challengePolicy, /At `rework_retry_count == max_rework_retries`[\s\S]*?continue only\s+when another try is clearly justified[\s\S]*?`beyond_limit_reason`[\s\S]*?Without such a reason, do not re-investigate, re-author,[\s\S]*?Report them as unresolved/);
  assert.match(challengePolicy, /setting `max_rework_retries` \(default 3\)/);
  assert.match(reference('red-green-gate.md'), /setup repair and does not use a rework only while the fix plan, its write intents, and production code are unchanged/,
    'a test-setup repair is free only while nothing else moves');

  const reviewId = '2026-11-07T12-01-00-a002';
  const reviewRelative = `review-${reviewId}.json`;
  const legacyReview = {
    schema_version: 2,
    id: reviewId,
    command: 'aivv',
    status: 'completed',
    invoked_at: '2026-11-07T12:01:00Z',
    target_project: TARGET,
    findings: [{ ref: 'F001', summary: 'Legacy finding without modern evidence fields.' }],
  };
  storeJson(reviewRelative, legacyReview);
  const reviewPlanLog = {
    ...baseLog(),
    id: '2026-11-07T12-03-00-a004',
    source: 'review_id',
    source_review_id: reviewId,
    source_review_relative_path: reviewRelative,
    authorized_scope: { ...scope(), source: 'review_id' },
  };
  assert.deepEqual(validateFixLogTransition(reviewPlanLog, undefined, { contextFile: CONTEXT_FILE }),
    { status: 'pass', reason: 'pass' },
    'a review-sourced run can persist its plan before the first change');
  // The same sequence through the command an agent runs: --new at Step 4.4, then
  // --update recording the early test path and the red run at Step 4.4.5.
  const cliLog = { ...reviewPlanLog, storage_context: { instance_key: context.instance_key, target_project: context.target, policy_target: context.target } };
  const fixLogCli = (candidate, mode) => {
    const file = path.join(TEMP_ROOT, 'fix-log-candidate.json');
    writeFileSync(file, `${JSON.stringify(candidate)}\n`);
    const result = spawnSync(process.execPath, [validator, '--fix-log', file, '--context', CONTEXT_FILE, mode], { encoding: 'utf8', env });
    return JSON.parse(result.stdout);
  };
  assert.deepEqual(fixLogCli(cliLog, '--new'), { status: 'pass', reason: 'pass' });
  storeJson(`fix-${cliLog.id}.json`, cliLog);
  const cliRed = structuredClone(cliLog);
  cliRed.files_created = ['src/change.test.js'];
  cliRed.decision_ledger = [{ finding_id: 'F001', red_run: { status: 'failed-right-reason', test_intent_id: 'WI-1' } }];
  assert.deepEqual(fixLogCli(cliRed, '--update'), { status: 'pass', reason: 'pass' },
    'a review-sourced run can record its early test write and red run before any fix change');
  assert.equal(fixLogCli({ ...cliRed, lifecycle_context: { selector_type: 'issue', selector: 'ISS-1', record_kind: 'issue', record_id: 'ISS-1', record_path: 'issues/x.json', source_mode: 'review-sourced' } }, '--update').reason,
    'fix-log-lifecycle-context-mutated',
    'identity fields must be in the first write; adding them later is rejected');

  assert.equal(validateFixLogNewWrite({ ...reviewPlanLog, status: 'completed' }, { contextFile: CONTEXT_FILE }).reason,
    'fix-log-findings-addressed-invalid',
    'a completed review-sourced log still has to join findings to changes');
  assert.equal(validateFixLogNewWrite({ ...reviewPlanLog, findings_addressed: ['F001'] }, { contextFile: CONTEXT_FILE }).reason,
    'fix-log-changes-summary-invalid',
    'a finding cannot be recorded as addressed without a change');
  const linkedFix = {
    id: '2026-11-07T12-02-00-a003',
    source: 'review_id',
    source_review_id: reviewId,
    source_review_relative_path: reviewRelative,
  };
  storeJson(`fix-${linkedFix.id}.json`, linkedFix);
  const backfillCandidate = path.join(TEMP_ROOT, 'review-backfill.json');
  writeFileSync(backfillCandidate, `${JSON.stringify({ ...legacyReview, fix_invocation_id: linkedFix.id })}\n`);
  const backfill = spawnSync(process.execPath, [
    validator,
    '--review-log-backfill', backfillCandidate,
    '--context', CONTEXT_FILE,
    '--relative', reviewRelative,
  ], { encoding: 'utf8', env });
  assert.equal(backfill.status, 0, backfill.stderr || backfill.stdout);
  assert.deepEqual(JSON.parse(backfill.stdout), { status: 'pass', reason: 'pass' },
    'backfill may link an unchanged valid legacy review without new-write finding fields');
} finally {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(TEMP_ROOT, { recursive: true, force: true });
}

process.stdout.write('AIVV fix scope: persisted scope, path boundaries, symlink checks, shared retries, and legacy backfill passed\n');
