#!/usr/bin/env node
// Issue #26 item 8: a lifecycle selector used from a checkout with no AIVV state
// (a fresh worktree or clone) must say what is missing and where it looked.
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeCheckout } from './support/checkout-fixture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeHelper = path.join(repoRoot, 'plugin/tools/incident-lifecycle-route.mjs');
const storageHelper = path.join(repoRoot, 'plugin/tools/storage-paths.mjs');
const githubSyncHelper = path.join(repoRoot, 'plugin/tools/incident-github-sync.mjs');
const temporaryRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'aivv-lifecycle-route-')));
const home = path.join(temporaryRoot, 'home');
const checkout = path.join(temporaryRoot, 'checkout');
const env = {
  ...process.env,
  HOME: home,
  LOCALAPPDATA: path.join(home, 'AppData/Local'),
  XDG_STATE_HOME: path.join(home, 'state'),
  XDG_CACHE_HOME: path.join(home, 'cache'),
};

function route(args) {
  const result = spawnSync(process.execPath, [routeHelper, ...args], { encoding: 'utf8', env, cwd: checkout });
  return { status: result.status, json: JSON.parse(result.stdout), stderr: result.stderr };
}

try {
  mkdirSync(home, { recursive: true });
  makeCheckout(checkout);
  const stateDir = JSON.parse(spawnSync(process.execPath, [storageHelper, 'resolve', '--target', checkout], { encoding: 'utf8', env }).stdout).state_dir;

  const invalid = route(['--target', checkout, '--github-issue', 'nonsense']);
  assert.equal(invalid.status, 2);
  assert.equal(invalid.json.reason, 'github-issue-selector-invalid',
    'a malformed selector is reported as such, not as a missing target');
  assert.match(invalid.json.detail, /<owner>\/<repo>#N/, 'the block lists the accepted forms');

  const fresh = route(['--target', checkout, '--github-issue', 'acme/widgets#5']);
  assert.equal(fresh.status, 2);
  assert.equal(fresh.json.reason, 'github-issue-mirror-missing',
    'a valid issue reference with no local mirror is a missing mirror');
  assert.equal(fresh.json.state_dir, stateDir, 'the block names the state directory it searched');
  assert.match(fresh.json.detail, /per checkout/);

  const incident = route(['--target', checkout, '--incident', 'INC-2026-01-01-0001']);
  assert.equal(incident.json.reason, 'lifecycle-target-missing');
  assert.equal(incident.json.state_dir, stateDir);
  assert.match(incident.json.detail, /per checkout/);

  // GitHub sync never guesses the destination repository: without --repo it would
  // otherwise have fallen back to the plugin checkout's own origin remote.
  for (const command of ['plan', 'apply']) {
    for (const repoArgs of [[], ['--repo'], ['--repo', 'not-a-repo']]) {
      const sync = spawnSync(process.execPath, [githubSyncHelper, command, '--issue', path.join(temporaryRoot, 'missing.json'), ...repoArgs, '--confirm'],
        { encoding: 'utf8', env: { ...env, AIVV_GH_BIN: path.join(temporaryRoot, 'no-gh') }, cwd: checkout });
      assert.equal(sync.status, 64, `${command} ${repoArgs.join(' ')} is a usage error`);
      assert.equal(JSON.parse(sync.stdout).reason, 'missing-or-invalid-repo');
    }
  }

  // A sensitive issue must never be planned for a repository whose visibility
  // gh did not report: unknown visibility is blocked, not treated as private.
  const zero = `sha256:${'0'.repeat(64)}`;
  const sensitiveIssue = path.join(temporaryRoot, 'sensitive-issue.json');
  writeFileSync(sensitiveIssue, JSON.stringify({
    schema_version: 1, id: 'ISS-1', external_id: 'aivv:issue:ISS-1', status: 'drafted', title: 'Fix the thing',
    body_hash: zero, rca_status: 'not-started', accepted_unverified_rationale: null,
    evidence: [{ id: 'EVID-1', kind: 'note', source_ref: 'local', redacted_excerpt: 'x', sha256: zero,
      redactions_applied: [], publishable: false, local_only: true, captured_at: '2026-11-18T00:00:00Z' }],
    sync: { mode: 'github-preferred', status: 'local-only', github: null, last_synced_at: null, last_checked_at: null, stale_after: 'P1D', sync_hash: null },
    owner: null, due_at: null, acceptance_criteria: [], closure_criteria: [], closure_gates: {}, labels: [], links: [], timeline: [],
  }));
  const fakeGh = path.join(temporaryRoot, 'fake-gh');
  writeFileSync(fakeGh, '#!/bin/sh\ncase "$1 $2" in\n"auth status") exit 0;;\n"repo view") printf "%s" "$FAKE_GH_REPO_VIEW"; exit 0;;\n"issue list") printf "[]"; exit 0;;\nesac\nexit 1\n');
  chmodSync(fakeGh, 0o755);
  const plan = (repoView) => JSON.parse(spawnSync(process.execPath, [githubSyncHelper, 'plan', '--issue', sensitiveIssue, '--repo', 'acme/widgets'],
    { encoding: 'utf8', env: { ...env, AIVV_GH_BIN: fakeGh, FAKE_GH_REPO_VIEW: repoView }, cwd: checkout }).stdout);
  if (process.platform !== 'win32') {
    assert.equal(plan('{"visibility":"PUBLIC"}').reason, 'sensitive-publication-blocked');
    assert.equal(plan('{"visibility":"PRIVATE"}').status, 'planned', 'a private repository still plans the sync');
    for (const repoView of ['', '{}', '[]', '{"visibility":""}', '{"visibility":"unknown"}', '{"visibility":5}']) {
      const result = plan(repoView);
      assert.equal(result.status, 'blocked', `visibility output ${JSON.stringify(repoView)} must block`);
      assert.equal(result.reason, 'repo-visibility-unknown');
      assert.equal(result.remote_allowed, false);
    }
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('lifecycle route: missing state and malformed GitHub selectors are reported with where and why; GitHub sync requires --repo');
