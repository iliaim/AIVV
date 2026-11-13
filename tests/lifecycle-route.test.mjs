#!/usr/bin/env node
// Issue #26 item 8: a lifecycle selector used from a checkout with no AIVV state
// (a fresh worktree or clone) must say what is missing and where it looked.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeCheckout } from './support/checkout-fixture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeHelper = path.join(repoRoot, 'plugin/tools/incident-lifecycle-route.mjs');
const storageHelper = path.join(repoRoot, 'plugin/tools/storage-paths.mjs');
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
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('lifecycle route: missing state and malformed GitHub selectors are reported with where and why');
