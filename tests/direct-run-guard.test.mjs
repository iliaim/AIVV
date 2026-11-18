#!/usr/bin/env node
// Every CLI must still run when invoked through a symlinked install path that contains
// a space. A guard comparing raw argv[1] with import.meta.url (which resolves symlinks
// and percent-encodes spaces) silently skipped main() and exited 0 — read as a pass.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(repo, 'plugin');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aivv-direct-run-'));
const linked = path.join(work, 'with space', 'plugin');
fs.mkdirSync(path.dirname(linked));
fs.symlinkSync(plugin, linked, 'dir');

const scripts = [
  ...fs.readdirSync(path.join(plugin, 'tools')).filter((name) => name.endsWith('.mjs')).map((name) => `tools/${name}`),
  'skills/aivv-view/scripts/storage.mjs',
].filter((rel) => /process\.argv\[1\]/.test(fs.readFileSync(path.join(plugin, rel), 'utf8')));

try {
  assert.ok(scripts.length >= 10, `expected the guarded CLIs, found ${scripts.length}`);
  for (const rel of scripts) {
    const result = spawnSync(process.execPath, [path.join(linked, rel)], {
      cwd: work, env: { ...process.env, HOME: work }, input: '', encoding: 'utf8', timeout: 60000,
    });
    assert.ok(`${result.stdout}${result.stderr}`.trim().length > 0, `${rel} printed nothing when run through a symlinked path with a space (exit ${result.status})`);
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
console.log(`direct-run-guard: ${scripts.length} CLIs run through a symlinked, spaced path`);
