#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeCheckout } from '../support/checkout-fixture.mjs';
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

// Markdown rule checks assert that a rule is present by its key tokens, not its exact
// sentence, so the instructions can be reworded. A block is one paragraph or one list
// item with whitespace collapsed; a string token matches case-insensitively.
const docBlocks = (text) => text.split(/\n\s*\n|\n(?=\s*(?:[-*•]|\d+\.)\s)/).map((block) => block.replace(/\s+/g, ' ').trim());
const mentions = (block, token) => (token instanceof RegExp ? token.test(block) : block.toLowerCase().includes(token.toLowerCase()));
const ruleBlocks = (text, tokens) => docBlocks(text).filter((block) => tokens.every((token) => mentions(block, token)));
function assertRule(text, tokens, message) {
  assert.ok(ruleBlocks(text, tokens).length > 0, `${message} (no paragraph or list item mentions all of: ${tokens.join(' | ')})`);
}
function section(text, heading) {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `missing heading: ${heading}`);
  const rest = text.slice(start + heading.length);
  const end = rest.search(new RegExp(`^#{1,${heading.match(/^#+/)[0].length}} `, 'm'));
  return end < 0 ? rest : rest.slice(0, end);
}

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
  // A plain mkdir can leave the target's storage identity unreliable on Linux
  // (birth time equal to change time), which makes it invocation-bound.
  makeCheckout(TARGET);
  mkdirSync(path.join(TARGET, 'src'), { recursive: true });
  mkdirSync(path.join(TARGET, 'private'), { recursive: true });
  mkdirSync(HOME, { recursive: true });
  const context = JSON.parse(storage(['ensure', '--target', TARGET]));
  writeFileSync(CONTEXT_FILE, `${JSON.stringify(context)}\n`);

  const newRunProposal = validateFixture(fixture(), { contextFile: CONTEXT_FILE, proposalOnly: true });
  assert.equal(newRunProposal.status, 'pass', JSON.stringify(newRunProposal));
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

  // Issue #26 (Nov 15 report): three independent fixes, each proven by its own check.
  const findingIds = ['F001', 'F002', 'F003'];
  const finishedLog = () => ({
    ...baseLog(),
    status: 'completed',
    completed_at: '2026-11-07T13:00:00Z',
    authorized_scope: { ...scope(), finding_ids: findingIds, included: findingIds },
    findings_addressed: ['F001', 'F002'],
    changes_summary: [
      { finding_id: 'F001', file: 'src/a.js', summary: 'Guard a.' },
      { finding_id: 'F002', file: 'src/b.js', summary: 'Guard b.' },
    ],
    files_modified: ['src/a.js', 'src/b.js'],
    write_boundary_shown: true,
    change_readiness: {
      risk_tier: 'low',
      affected_surfaces: ['code'],
      approval_mode: 'user-confirmed',
      rollback_plan: 'Revert src/a.js and src/b.js.',
      required_verification: [
        { id: 'check-a', kind: 'command', command_argv: ['node', 'a.test.js'], required: true },
        { id: 'check-b', kind: 'command', command_argv: ['node', 'b.test.js'], required: true },
      ],
      generated_verification: { present: false, execution_allowed: false, policy: 'inspect-only' },
      monitoring_plan: 'None needed.',
      go_no_go: 'go',
    },
    objective_evidence: [
      { id: 'ev-a', finding_id: 'F001', kind: 'test-output', satisfies: ['check-a'], ref: 'node a.test.js', outcome: 'pass' },
      { id: 'ev-b', finding_id: 'F002', kind: 'test-output', satisfies: ['check-b'], ref: 'node b.test.js', outcome: 'pass' },
    ],
    final_dispositions: [
      { finding_id: 'F001', disposition: 'closed', decided_by: 'aivv-fix-verifier', rationale: 'a.test.js passes.', evidence_refs: ['ev-a'] },
      { finding_id: 'F002', disposition: 'closed', decided_by: 'aivv-fix-verifier', rationale: 'b.test.js passes.', evidence_refs: ['ev-b'] },
      { finding_id: 'F003', disposition: 'deferred', decided_by: 'user', rationale: 'Deleting it needs the owner\'s approval.', reopen_trigger: 'The owner approves.' },
    ],
  });
  assert.deepEqual(validateFixLogNewWrite(finishedLog()), { status: 'pass', reason: 'pass' },
    'each finding carries only its own check; the required checks are proven once for the run');
  const unproven = finishedLog();
  unproven.objective_evidence[1].satisfies = [];
  const unprovenVerdict = validateFixLogNewWrite(unproven);
  assert.equal(unprovenVerdict.reason, 'fix-log-final-disposition-evidence-missing',
    'a required check that no evidence proves still halts');
  assert.match(unprovenVerdict.detail, /"check-b"/, 'the halt names the unproven check');
  const noOwnEvidence = finishedLog();
  noOwnEvidence.final_dispositions[1].evidence_refs = ['ev-a'];
  assert.equal(validateFixLogNewWrite(noOwnEvidence).reason, 'fix-log-final-disposition-evidence-missing',
    'a closed finding still needs evidence of its own; another finding\'s evidence does not join');

  // Issue #26 (Nov 15 report): a decision made after the run finished can be recorded on its log.
  const finished = finishedLog();
  const later = structuredClone(finished);
  later.objective_evidence.push({ id: 'ev-c', finding_id: 'F003', kind: 'command-output', ref: 'git worktree list', outcome: 'pass', summary: 'The stale worktree is gone.' });
  later.final_dispositions[2] = {
    finding_id: 'F003', disposition: 'closed', decided_by: 'owner', rationale: 'Owner approved the deletion; done.',
    decided_at: '2026-11-15T10:00:00Z', evidence_refs: ['ev-c'], supersedes: structuredClone(finished.final_dispositions[2]),
  };
  assert.deepEqual(validateFixLogTransition(later, finished), { status: 'pass', reason: 'pass' },
    'a deferred finding on a completed log can take the owner\'s later decision');
  assert.deepEqual(validateFixLogTransition(later, { ...finished, status: 'failed' }).reason, 'fix-log-later-decision-invalid',
    'the status of the finished log does not change');
  const failedLater = { ...structuredClone(later), status: 'failed' };
  assert.deepEqual(validateFixLogTransition(failedLater, { ...finished, status: 'failed' }), { status: 'pass', reason: 'pass' },
    'a failed log accepts a later decision too');
  const laterReason = (mutate) => {
    const candidate = structuredClone(later);
    mutate(candidate);
    return validateFixLogTransition(candidate, finished);
  };
  assert.equal(laterReason((c) => { delete c.final_dispositions[2].supersedes; }).reason, 'fix-log-later-decision-invalid',
    'the replaced entry must be kept');
  assert.equal(laterReason((c) => { c.final_dispositions[2].supersedes.rationale = 'edited'; }).reason, 'fix-log-later-decision-invalid',
    'the kept entry must be an exact copy');
  assert.equal(laterReason((c) => { delete c.final_dispositions[2].decided_at; }).reason, 'fix-log-later-decision-invalid');
  assert.equal(laterReason((c) => { c.final_dispositions[2].evidence_refs = []; }).reason, 'fix-log-final-disposition-evidence-missing',
    'closing later still needs evidence for that finding');
  assert.equal(laterReason((c) => {
    c.final_dispositions[0] = { ...c.final_dispositions[0], disposition: 'closed_with_residual_risk', residual_risk: 'Edge case left.', decided_at: '2026-11-15T10:00:00Z', supersedes: structuredClone(finished.final_dispositions[0]) };
  }).reason, 'fix-log-later-decision-invalid', 'a closed finding cannot be changed after the run');
  assert.equal(laterReason((c) => { c.completed_at = '2026-11-15T10:00:00Z'; }).reason, 'fix-log-later-decision-invalid',
    'nothing outside the dispositions and evidence may change');
  assert.equal(laterReason((c) => { c.objective_evidence[0].outcome = 'fail'; }).reason, 'fix-log-later-decision-invalid',
    'recorded evidence cannot be rewritten');
  assert.equal(laterReason((c) => { c.objective_evidence[2].id = 'ev-a'; c.final_dispositions[2].evidence_refs = ['ev-a']; }).reason,
    'fix-log-final-disposition-evidence-missing', 'new evidence reusing an earlier id cannot take over that id');
  assert.equal(laterReason((c) => { c.objective_evidence.push({ ...c.objective_evidence[2], outcome: 'fail' }); }).reason,
    'fix-log-later-decision-invalid', 'new evidence ids are unique');
  assert.equal(laterReason((c) => { c.objective_evidence.push({ id: 'ev-x', finding_id: 'F001', kind: 'grep', ref: 'grep x', outcome: 'pass' }); }).reason,
    'fix-log-later-decision-invalid', 'new evidence belongs to a finding decided in this update');
  assert.equal(laterReason((c) => { c.final_dispositions.pop(); }).reason, 'fix-log-later-decision-invalid');
  assert.equal(laterReason((c) => { c.final_dispositions[2].decided_at = '1'; }).reason, 'fix-log-later-decision-invalid',
    'decided_at is a UTC timestamp');
  // A run that changed nothing (every finding deferred) skips the general disposition checks,
  // so the later-decision gate checks the new value itself.
  const noChanges = finishedLog();
  for (const field of ['findings_addressed', 'changes_summary', 'files_modified', 'change_readiness']) delete noChanges[field];
  noChanges.objective_evidence = [];
  noChanges.final_dispositions = [noChanges.final_dispositions[2]];
  assert.deepEqual(validateFixLogNewWrite(noChanges), { status: 'pass', reason: 'pass' });
  const decideOnNoChanges = (fields) => validateFixLogTransition({
    ...structuredClone(noChanges),
    final_dispositions: [{ finding_id: 'F003', decided_by: 'owner', rationale: 'Owner decided.', decided_at: '2026-11-15T10:00:00Z',
      supersedes: structuredClone(noChanges.final_dispositions[0]), ...fields }],
  }, noChanges);
  assert.deepEqual(decideOnNoChanges({ disposition: 'accepted_risk' }), { status: 'pass', reason: 'pass' });
  assert.equal(decideOnNoChanges({ disposition: 'banana' }).reason, 'fix-log-later-decision-invalid',
    'a later decision uses a known disposition');
  assert.equal(decideOnNoChanges({ disposition: 'closed' }).reason, 'fix-log-final-disposition-evidence-missing');
  assert.equal(decideOnNoChanges({ disposition: 'closed_with_residual_risk' }).reason, 'fix-log-final-disposition-residual-risk-missing');
  assert.equal(validateFixLogTransition({ ...structuredClone(finished), status: 'abandoned' }, { ...finished, status: 'abandoned' }).reason,
    'fix-log-transition-prior-state-not-in-progress', 'an abandoned log stays closed to updates');

  const skill = readFileSync(path.join(REPO_ROOT, 'plugin/skills/aivv-fix/SKILL.md'), 'utf8');
  const decisioning = readFileSync(path.join(REPO_ROOT, 'plugin/skills/aivv-fix/references/execution-decisioning.md'), 'utf8');
  assert.match(skill, /### Step 4\.4:[\s\S]*?persist[\s\S]*?`write_intents\[\]`[\s\S]*?### Step 4\.5/,
    'Step 4.4 must persist the plan before the challenge');
  assertRule(decisioning, ['persisted', '`decision_ledger[]`', 'fix log'],
    'the decision ledger is persisted in the fix log, not kept only in memory');

  // Order (issue #26 item 1): the failing test runs before the plan challenge,
  // and the challenger is given the test bytes and the red output.
  const reference = (name) => readFileSync(path.join(REPO_ROOT, 'plugin/skills/aivv-fix/references', name), 'utf8');
  const redStep = skill.indexOf('### Step 4.4.5: RED-GREEN TEST GATE');
  const challengeStep = skill.indexOf('### Step 4.5: CHALLENGE');
  assert.ok(redStep > skill.indexOf('### Step 4.4: MATERIALIZE') && redStep < challengeStep,
    'the red run must sit between write-intent materialization and the plan challenge');
  assertRule(skill, ['remediation boundary', 'Step 5', 'test'],
    'no fix is written before Step 5; the only earlier project write is the failing reproduction test');
  const redGate = reference('red-green-gate.md');
  assertRule(redGate, ['run', 'before Step 4.5'], 'the red run happens before the plan challenge');
  assertRule(redGate, ['early', 'approval_mode: "auto"', 'fix_confidence: "high"', 'Hard approval rule'],
    'the early test write is an allow-list tied to the readiness outcome');
  assertRule(redGate, ['early', 'dangerously-auto-approved', 'policy-skipped', 'architecture approval', 'dangerously_auto_apply'],
    'the dangerous route does not by itself permit the early write');
  assertRule(redGate, ['early', '`ask`', '`skip`', /\b(do not|never)\b/i],
    'a pending user decision still comes before any project write');
  assertRule(redGate, ['undo', 'early test write', 'not applied'], 'a failing test must not be left behind');
  assertRule(redGate, ['early', '`class_scan`', 'verdict gate', 'confidence', 'route'],
    'a decision that only the Step 5 class scan can raise must be known before the early write');
  assertRule(redGate, ['undo', 'preimage', 'this run wrote'],
    'undo must not delete a file the user changed after the run stopped');
  const fixLogContract = reference('fix-log-contract.md');
  assert.ok(ruleBlocks(fixLogContract, ['Restart', 'undo', 'early test write']).length >= 2,
    'both the resume prompt and the reaped-log prompt undo the early test write on Restart');
  assertRule(fixLogContract, ['reuse', '`class_scan`', 'decision_ledger', /\b(do not|never)\b/i],
    'Step 5 and a resumed run must not rescan with the failing test already on disk');
  assertRule(fixLogContract, ['Resume', 'test intent', '`files_created`', /this run wrote|postimage/i],
    'a resumed run confirms an early-written test still holds what this run wrote');
  assertRule(redGate, ['before', 'early write', '`files_created`'],
    'an early test write must be visible to recovery before it happens');
  assert.match(fixLogContract, /\{files_created\}/, 'the recovery prompt shows created files');
  const challengeLoop = reference('challenge-loop.md');
  assert.match(challengeLoop, /`\{red_run_evidence\}`/);
  assertRule(challengeLoop, [/^\W*APPROVE\b/, 'Step 5 EXECUTE'], 'an APPROVE verdict proceeds to Step 5 EXECUTE');
  const challengerPrompt = reference('fix-challenger-prompt-template.md');
  assert.match(challengerPrompt, /\{red_run_evidence/);
  // Issue #26: the reviewer does a cold, independent review; later rounds re-check, they do not widen.
  assertRule(challengerPrompt, [/^\W*APPROVE\b/, 'non_blocking_observations'],
    'the APPROVE verdict rule puts uncertainty in non-blocking observations instead of forcing a concern');
  const recheck = section(challengerPrompt, '## Earlier Challenge of This Plan');
  assert.ok(recheck.includes('{prior_challenge_concerns'),
    'the re-check rule belongs to a repeat challenge of the same plan, with the earlier concerns supplied');
  assertRule(recheck, ['re-check', 'resolved'], 'a repeat challenge only re-checks the earlier must-fix concerns');
  assertRule(recheck, ['advisory', 'round', /\b(never|not)\b/i], 'advisory observations never justify another round');
  assertRule(recheck, ['REJECT', 'all axes'], 'after a REJECT, the replacement plan gets a full review');
  assertRule(section(challengerPrompt, '## Predecessor Cycle Context'), ['round ≥ 2', 'corrective plan', 'all axes'],
    'a corrective plan after a failed verification is a first review, not a re-check');
  assert.match(challengeLoop, /`\{prior_challenge_concerns\}`/);
  assertRule(redGate, ['setup repair', '`warnings`'], 'each test-setup repair is noted in the fix log warnings');
  assert.match(challengerPrompt, /setup error/, 'the challenger must check the test fails for the right reason');
  const pluginRoot = path.join(REPO_ROOT, 'plugin');
  const pluginText = readdirSync(pluginRoot, { recursive: true })
    .filter((file) => /\.(md|json|mjs|toml)$/.test(file))
    .map((file) => [file, readFileSync(path.join(pluginRoot, file), 'utf8')]);
  assert.deepEqual(pluginText.filter(([, text]) => /Step 4\.6/.test(text)).map(([file]) => file), [],
    'nothing may point at the removed Step 4.6');
  assert.deepEqual(pluginText.filter(([file, text]) => file.endsWith('.md') && /max_rework_retries`?\s*[:=]\s*`?\d/.test(text))
    .map(([file]) => file), [], 'no instruction may hard-code the retry limit; it is the resolved setting');

  // The references must give one answer on when the investigator or the verifier may be skipped.
  assertRule(reference('investigation-dispatch.md'), ['fast-path.md', 'only', 'skip', 'investigator'],
    'the fast path is the only investigator skip route');
  assertRule(reference('triage.md'), ['`skip-permitted`', 'fast-path.md', 'investigator'],
    'triage permits skipping the investigator only through the fast path');
  assertRule(reference('fast-path.md'), ['verifier', 'verifier-dispatch.md', 'only'],
    'the fast path may not carry its own verifier exemption');

  assertRule(challengeLoop, ['uncertainty', 'investigation', 'retry', /\b(does not|never)\b/i],
    'uncertainty-only challenger output neither re-investigates nor consumes a retry');
  assertRule(challengeLoop, ['max_rework_retries', '`beyond_limit_reason`', 'justified', /do not re-?investigate/i, 'unresolved'],
    'past the retry limit, continue only with a recorded reason; otherwise report unresolved');
  assertRule(challengeLoop, ['`max_rework_retries`', 'setting', /default\W{0,3}3\b/], 'the retry limit is a setting with default 3');
  assertRule(redGate, ['setup repair', 'rework', 'fix plan', 'write intents', 'production code'],
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
  // A later decision on a stored completed log, through the command an agent runs.
  const storedFinished = { ...finishedLog(), id: '2026-11-07T12-05-00-a005', storage_context: cliLog.storage_context };
  storeJson(`fix-${storedFinished.id}.json`, storedFinished);
  const storedLater = { ...structuredClone(later), id: storedFinished.id, storage_context: cliLog.storage_context };
  assert.deepEqual(fixLogCli(storedLater, '--update'), { status: 'pass', reason: 'pass' },
    '--update on a completed log accepts a later decision on its deferred finding');
  assert.equal(fixLogCli({ ...storedLater, status: 'in-progress' }, '--update').reason, 'fix-log-later-decision-invalid',
    'a completed log cannot be reopened through --update');

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
