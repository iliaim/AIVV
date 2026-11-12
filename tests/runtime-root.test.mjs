#!/usr/bin/env node

import assert from 'node:assert/strict';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolverSource = path.join(root, 'plugin/.aivv/runtime-root.mjs');
// The resolver reports symlink-free paths, so compare against the real temp
// directory (macOS links /var to /private/var).
const temporaryRoot = realpathSync(mkdtempSync(path.join(tmpdir(), 'aivv-runtime-root-')));

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

function preflight(resolver, profile, { skillDir = '', ...env }) {
  return spawnSync(process.execPath, [resolver, '--preflight', profile, skillDir], {
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

  const standaloneBase = path.join(temporaryRoot, 'standalone');
  const standaloneSkill = path.join(standaloneBase, 'skills', 'aivv');
  mkdirSync(path.join(standaloneSkill, '.aivv'), { recursive: true });
  writeFileSync(path.join(standaloneSkill, 'SKILL.md'), '# standalone skill\n');
  copyFileSync(resolverSource, path.join(standaloneSkill, '.aivv/runtime-root.mjs'));
  const standaloneRuntime = path.join(standaloneBase, 'aivv-runtime');
  makeRuntimeRoot(standaloneRuntime);
  assert.equal(
    resolve(path.join(standaloneSkill, '.aivv/runtime-root.mjs'), { skillDir: standaloneSkill }),
    standaloneRuntime,
    'a standalone skill bootstrap must select its documented sibling runtime',
  );

  const incompleteRoot = path.join(temporaryRoot, 'incomplete-selected-root');
  const incompleteResolver = makeRuntimeRoot(incompleteRoot);
  const incompletePreflight = preflight(incompleteResolver, 'aivv', {
    AIVV_ROOT: incompleteRoot,
    CODEX_HOME: codexHome,
  });
  assert.equal(incompletePreflight.status, 3);
  assert.match(incompletePreflight.stderr, /AIVV_INSTALLATION_INCOMPLETE/);
  assert.match(incompletePreflight.stderr, /platform-adapters\/hermes-agent\.md/,
    'an incomplete package should fail closed when the shared Hermes adapter is absent');
  assert.ok(incompletePreflight.stderr.length < 8192,
    'an installation diagnostic should fit within the host capture limit');
  assert.match(incompletePreflight.stderr, /No alternate runtime root was used/);
  assert.equal(incompletePreflight.stderr.trim().split(/\r?\n/).length, 1,
    'an incomplete selected root should stop once with one installation diagnostic');

  // A consumer that vendors AIVV under .agents/ and exposes it to Claude Code
  // through a symlinked skills folder must resolve the vendored copy, not a
  // separate (possibly stale) CODEX_HOME runtime (issue #34).
  const vendoredProject = path.join(temporaryRoot, 'vendored-project');
  const vendoredRoot = path.join(vendoredProject, '.agents');
  cpSync(path.join(root, 'plugin'), vendoredRoot, { recursive: true });
  mkdirSync(path.join(vendoredProject, '.claude'), { recursive: true });
  symlinkSync('../.agents/skills', path.join(vendoredProject, '.claude', 'skills'), 'dir');
  const staleCodexHome = path.join(temporaryRoot, 'stale-codex-home');
  const staleRuntime = path.join(staleCodexHome, 'aivv-runtime');
  cpSync(path.join(root, 'plugin'), staleRuntime, { recursive: true });
  rmSync(path.join(staleRuntime, 'tools', 'aivv-fix-records.mjs'));
  const symlinkedPreflight = preflight(path.join(vendoredRoot, '.aivv/runtime-root.mjs'), 'aivv-fix', {
    CODEX_HOME: staleCodexHome,
    skillDir: path.join(vendoredProject, '.claude', 'skills', 'aivv-fix'),
  });
  assert.equal(symlinkedPreflight.status, 0,
    `a skill loaded through a symlinked skills folder failed preflight: ${symlinkedPreflight.stderr}`);
  assert.equal(symlinkedPreflight.stdout.trim(), vendoredRoot,
    'a symlinked skills folder should resolve the installation the skill belongs to before CODEX_HOME');

  for (const [profile, skillName] of [
    ['aivv', 'aivv'],
    ['aivv-fix', 'aivv-fix'],
    ['aivv-view', 'aivv-view'],
    ['aivv-calibrate', 'aivv-calibrate'],
  ]) {
    const skillDir = path.join(root, 'plugin', 'skills', skillName);
    const result = preflight(resolverSource, profile, { skillDir });
    assert.equal(result.status, 0, `${profile} source preflight failed: ${result.stderr}`);
    assert.equal(result.stdout.trim(), path.join(root, 'plugin'),
      `${profile} should resolve the canonical package from its loaded skill directory`);
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('runtime root: prefers the active plugin package and preserves legacy Codex installs');
