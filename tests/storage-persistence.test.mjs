#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeCheckout } from './support/checkout-fixture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storageHelper = path.join(repoRoot, 'plugin/tools/storage-paths.mjs');
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'aivv-storage-persistence-'));
const home = path.join(temporaryRoot, 'home');
const target = path.join(temporaryRoot, 'target');
const contextFile = path.join(temporaryRoot, 'context.json');
const candidate = path.join(temporaryRoot, 'review-candidate.json');
const observed = path.join(temporaryRoot, 'observed.json');

mkdirSync(home, { recursive: true });
mkdirSync(target, { recursive: true });
const env = {
  ...process.env,
  HOME: home,
  LOCALAPPDATA: path.join(home, 'AppData/Local'),
  XDG_STATE_HOME: path.join(home, 'state'),
  XDG_CACHE_HOME: path.join(home, 'cache'),
};

function run(args) {
  const result = spawnSync(process.execPath, [storageHelper, ...args], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

try {
  const context = JSON.parse(run(['ensure', '--target', target]));
  writeFileSync(contextFile, `${JSON.stringify(context)}\n`);
  writeFileSync(candidate, '{"smoke":"codex-persistence","findings":[]}\n');

  const storedPath = JSON.parse(run([
    'write', '--context', contextFile, '--area', 'state', '--relative', 'review-smoke.json', '--source', candidate,
  ])).path;
  const readResult = spawnSync(process.execPath, [storageHelper, 'read', '--context', contextFile, '--area', 'state', '--relative', 'review-smoke.json'], { encoding: 'utf8', env });
  assert.equal(readResult.status, 0, readResult.stderr);
  writeFileSync(observed, readResult.stdout);

  assert.equal(readFileSync(observed, 'utf8'), readFileSync(candidate, 'utf8'));
  assert.deepEqual(JSON.parse(run(['list', '--context', contextFile, '--area', 'state', '--prefix', 'review-'])), ['review-smoke.json']);
  assert.ok(storedPath.startsWith(context.state_dir + path.sep), 'state must be stored under the resolved external state directory');
  assert.equal(existsSync(path.join(target, '.aivv')), false, 'state writes must not create project-local AIVV history');

  // Issue #26 item 4: a lookup that finds no store must say where it looked.
  // State is keyed per checkout, so another worktree or clone has its own store.
  const otherTarget = path.join(temporaryRoot, 'other-checkout');
  makeCheckout(otherTarget);
  const other = JSON.parse(run(['resolve', '--target', otherTarget]));
  const emptyList = spawnSync(process.execPath, [storageHelper, 'list', '--target', otherTarget, '--area', 'state', '--prefix', 'review-'], { encoding: 'utf8', env });
  assert.equal(emptyList.status, 0, emptyList.stderr);
  assert.deepEqual(JSON.parse(emptyList.stdout), [], 'an empty lookup stays a parseable empty list');
  assert.match(emptyList.stderr, /STORAGE_EMPTY/);
  assert.ok(emptyList.stderr.includes(other.target) && emptyList.stderr.includes(other.target_dir),
    'the notice must name the target and the directory that was searched');
  const populatedList = spawnSync(process.execPath, [storageHelper, 'list', '--context', contextFile, '--area', 'state', '--prefix', 'review-'], { encoding: 'utf8', env });
  assert.equal(populatedList.stderr, '', 'a lookup that finds records prints no notice');
  const missingRead = spawnSync(process.execPath, [storageHelper, 'read', '--context', contextFile, '--area', 'state', '--relative', 'review-absent.json'], { encoding: 'utf8', env });
  assert.equal(missingRead.status, 1);
  assert.ok(missingRead.stderr.includes('STORAGE_NOT_FOUND') && missingRead.stderr.includes(path.join(context.state_dir, 'review-absent.json')),
    'a missing file error must name the path that was read');

  if (process.platform !== 'win32') {
    assert.equal(statSync(storedPath).mode & 0o777, 0o600, 'state records must be private files');
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('storage persistence: external state writes round-trip without creating project-local history');
