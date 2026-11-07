#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
const TEMP_ROOT = mkdtempSync(path.join(os.tmpdir(), 'aivv-fix-scope-'));
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
  assert.equal(validateFixLogTransition(overBudget, current).reason,
    'fix-log-rework-retry-state-invalid',
    're-authoring and verification cannot exceed the shared three-retry cap');

  const challengePolicy = readFileSync(path.join(REPO_ROOT, 'plugin/skills/aivv-fix/references/challenge-loop.md'), 'utf8');
  assert.match(challengePolicy, /Uncertainty-only output[\s\S]*?does not trigger another investigation[\s\S]*?does not consume a retry/);
  assert.match(challengePolicy, /At `rework_retry_count == max_rework_retries`[\s\S]*?do not re-investigate, re-author,[\s\S]*?Report them as unresolved/);

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
  const linkedFix = {
    id: '2026-11-07T12-02-00-a003',
    source: 'review_id',
    source_review_id: reviewId,
    source_review_relative_path: reviewRelative,
  };
  storeJson(`fix-${linkedFix.id}.json`, linkedFix);
  const backfillCandidate = path.join(TEMP_ROOT, 'review-backfill.json');
  writeFileSync(backfillCandidate, `${JSON.stringify({ ...legacyReview, fix_invocation_id: linkedFix.id })}\n`);
  const validator = path.join(REPO_ROOT, 'plugin/tools/pre-write-validator.mjs');
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
