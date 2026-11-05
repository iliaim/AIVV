#!/usr/bin/env node

import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolverSource = path.join(root, 'plugin/.aivv/runtime-root.mjs');
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'aivv-runtime-root-'));

function makeRuntimeRoot(runtimeRoot) {
  mkdirSync(path.join(runtimeRoot, '.aivv'), { recursive: true });
  mkdirSync(path.join(runtimeRoot, 'tools'), { recursive: true });
  writeFileSync(path.join(runtimeRoot, 'tools/pre-write-validator.mjs'), '');
  const resolver = path.join(runtimeRoot, '.aivv/runtime-root.mjs');
  copyFileSync(resolverSource, resolver);
  return resolver;
}

function resolve(resolver, { skillDir = '', ...env }) {
  const result = spawnSync(process.execPath, [resolver, '--print', skillDir], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AIVV_ROOT: '',
      CLAUDE_PLUGIN_ROOT: '',
      PLUGIN_ROOT: '',
      SKILL_BASE_DIR: '',
      ...env,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

try {
  const codexHome = path.join(temporaryRoot, 'codex-home');
  const legacyRuntime = path.join(codexHome, 'aivv-runtime');
  makeRuntimeRoot(legacyRuntime);

  const pluginRoot = path.join(temporaryRoot, 'plugin-cache', 'aivv', '0.2.2');
  const pluginResolver = makeRuntimeRoot(pluginRoot);
  const pluginSkill = path.join(pluginRoot, 'skills', 'aivv');
  mkdirSync(pluginSkill, { recursive: true });

  assert.equal(
    resolve(pluginResolver, { CODEX_HOME: codexHome, skillDir: pluginSkill }),
    pluginRoot,
    'a plugin skill should use its packaged runtime before a legacy user runtime',
  );
  assert.equal(
    resolve(pluginResolver, { CODEX_HOME: codexHome, PLUGIN_ROOT: pluginRoot }),
    pluginRoot,
    'PLUGIN_ROOT should identify the active plugin package before a legacy user runtime',
  );

  const installedSkill = path.join(codexHome, 'skills', 'aivv');
  mkdirSync(installedSkill, { recursive: true });
  assert.equal(
    resolve(path.join(legacyRuntime, '.aivv/runtime-root.mjs'), { CODEX_HOME: codexHome, skillDir: installedSkill }),
    legacyRuntime,
    'the existing Codex installer layout should continue to resolve its external runtime',
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('runtime root: prefers the active plugin package and preserves legacy Codex installs');
