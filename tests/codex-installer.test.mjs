#!/usr/bin/env node

import assert from 'node:assert/strict';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'aivv-codex-installer-')));
const canonicalPluginRoot = path.join(repoRoot, 'plugin');
const pluginRoot = path.join(temporaryRoot, 'plugin-source');
const continuityFile = '.aivv/session-continuity.md';

function available(command, args = ['--version']) {
  return spawnSync(command, args, { encoding: 'utf8' }).status === 0;
}

function createRunners() {
  const runners = [];
  const shellScript = path.join(repoRoot, 'scripts/install-codex.sh');
  const powerShellScript = path.join(repoRoot, 'scripts/install-codex.ps1');

  if (available('bash')) {
    runners.push({
      name: 'shell',
      invoke(codexRoot, home, args, source) {
        return spawnSync('bash', [shellScript, ...args], {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: home,
            AIVV_CODEX_ROOT_OVERRIDE: codexRoot,
            AIVV_PLUGIN_SOURCE_ROOT: source,
            AIVV_ROOT: canonicalPluginRoot,
          },
        });
      },
    });
  }

  // The PowerShell installer is for Windows users; the windows-latest CI job covers it.
  // Elsewhere pwsh adds ~45s per run for no extra coverage.
  const powerShell = process.platform !== 'win32' ? null : available('pwsh') ? 'pwsh' : available('powershell.exe', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major']) ? 'powershell.exe' : null;
  if (powerShell) {
    runners.push({
      name: 'powershell',
      invoke(codexRoot, home, args, source) {
        const powerShellArgs = args.map((arg) => ({
          '--scope': '-Scope',
          '--force': '-Force',
          '--remove-legacy-methodology': '-RemoveLegacyMethodology',
        })[arg] ?? arg);
        return spawnSync(powerShell, ['-NoProfile', '-File', powerShellScript, ...powerShellArgs], {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: home,
            USERPROFILE: home,
            AIVV_CODEX_ROOT_OVERRIDE: codexRoot,
            AIVV_PLUGIN_SOURCE_ROOT: source,
            AIVV_ROOT: canonicalPluginRoot,
          },
        });
      },
    });
  }

  return runners;
}

function run(runner, codexRoot, home, args, source = pluginRoot) {
  const result = runner.invoke(codexRoot, home, args, source);
  return { ...result, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function verifyInstalledRuntime(codexRoot) {
  const runtimeRoot = path.join(codexRoot, 'aivv-runtime');
  assert.deepEqual(readFileSync(path.join(runtimeRoot, continuityFile)),
    readFileSync(path.join(canonicalPluginRoot, continuityFile)));

  for (const profile of ['aivv', 'aivv-fix', 'aivv-view', 'aivv-calibrate']) {
    const skillDir = path.join(codexRoot, 'skills', profile);
    const resolver = path.join(skillDir, '.aivv/runtime-root.mjs');
    const result = spawnSync(process.execPath, [resolver, '--preflight', profile, skillDir], {
      encoding: 'utf8',
      env: {
        ...process.env,
        AIVV_ROOT: '',
        AIVV_RUNTIME_ROOT_HELPER: '',
        CLAUDE_PLUGIN_ROOT: '',
        PLUGIN_ROOT: '',
        CODEX_HOME: codexRoot,
      },
    });
    assert.equal(result.status, 0, `${profile} installed preflight failed: ${result.stderr}`);
    assert.equal(result.stdout.trim(), runtimeRoot, `${profile} must select the installed standalone runtime`);
  }
}

function verifyRunner(runner) {
  const runnerRoot = path.join(temporaryRoot, runner.name);
  const codexRoot = path.join(runnerRoot, 'codex-home');
  const home = path.join(runnerRoot, 'home');
  const reviewerProfile = path.join(codexRoot, 'agents/aivv-reviewer.toml');

  mkdirSync(path.dirname(reviewerProfile), { recursive: true });
  writeFileSync(reviewerProfile, 'local reviewer profile\n');

  const rejected = run(runner, codexRoot, home, ['--scope', 'user']);
  assert.notEqual(rejected.status, 0, `${runner.name}: existing profile must require --force`);
  assert.match(rejected.output, /Existing AIVV destinations found; no files were changed:/);
  assert.equal(readFileSync(reviewerProfile, 'utf8'), 'local reviewer profile\n');
  assert.equal(existsSync(path.join(codexRoot, 'skills/aivv')), false, 'preflight must run before creating any skills');

  unlinkSync(reviewerProfile);
  const fresh = run(runner, codexRoot, home, ['--scope', 'user']);
  assert.equal(fresh.status, 0, `${runner.name}: fresh install failed: ${fresh.output}`);
  assert.doesNotMatch(fresh.output, /Backed up existing AIVV destinations/);
  assert.match(readFileSync(reviewerProfile, 'utf8'), /sandbox_mode = "read-only"/);
  verifyInstalledRuntime(codexRoot);

  const localSkillEdit = path.join(codexRoot, 'skills/aivv/LOCAL.md');
  writeFileSync(localSkillEdit, 'keep this local edit in the backup\n');
  writeFileSync(reviewerProfile, 'custom reviewer profile\n');
  const investigatorProfile = path.join(codexRoot, 'agents/aivv-investigator.toml');
  writeFileSync(investigatorProfile, 'custom investigator profile\n');
  const localRuntimeEdit = path.join(codexRoot, 'aivv-runtime/tools/LOCAL.mjs');
  writeFileSync(localRuntimeEdit, 'keep this runtime edit in the backup\n');
  const unrelatedSkill = path.join(codexRoot, 'skills/other/SKILL.md');
  mkdirSync(path.dirname(unrelatedSkill), { recursive: true });
  writeFileSync(unrelatedSkill, 'leave unrelated skills alone\n');
  const legacyMethodology = path.join(codexRoot, 'skills/methodology/LOCAL.md');
  mkdirSync(path.dirname(legacyMethodology), { recursive: true });
  writeFileSync(legacyMethodology, 'legacy content\n');

  const sourceContinuity = path.join(pluginRoot, continuityFile);
  const before = readdirSync(codexRoot);
  function verifyRejectedUpgrade(diagnostic) {
    const result = run(runner, codexRoot, home, ['--scope', 'user', '--force']);
    assert.notEqual(result.status, 0, `${runner.name}: incomplete runtime must fail even with --force`);
    assert.match(result.output, diagnostic);
    assert.deepEqual(readdirSync(codexRoot), before, 'an incomplete runtime must fail before backup or replacement');
    assert.equal(readFileSync(reviewerProfile, 'utf8'), 'custom reviewer profile\n');
    assert.equal(readFileSync(localSkillEdit, 'utf8'), 'keep this local edit in the backup\n');
    verifyInstalledRuntime(codexRoot);
  }

  unlinkSync(sourceContinuity);
  try {
    verifyRejectedUpgrade(/AIVV_INSTALLATION_INCOMPLETE.*session-continuity\.md/);

    // Bash preserves symbolic links when copying. This target is available
    // in the source tree but is absent from the copied runtime.
    if (runner.name === 'shell' && process.platform !== 'win32') {
      copyFileSync(path.join(canonicalPluginRoot, continuityFile), path.join(pluginRoot, 'outside-runtime.md'));
      symlinkSync('../outside-runtime.md', sourceContinuity);
      verifyRejectedUpgrade(/AIVV_INSTALLATION_INCOMPLETE.*\.aivv-install-stage.*session-continuity\.md/);

      unlinkSync(sourceContinuity);
      symlinkSync(localSkillEdit, sourceContinuity);
      verifyRejectedUpgrade(/required files linked outside the runtime.*session-continuity\.md/);
    }
  } finally {
    rmSync(sourceContinuity, { force: true });
    copyFileSync(path.join(canonicalPluginRoot, continuityFile), sourceContinuity);
  }

  unlinkSync(path.join(codexRoot, 'aivv-runtime', continuityFile));

  const upgraded = run(runner, codexRoot, home, ['--scope', 'user', '--force', '--remove-legacy-methodology']);
  assert.equal(upgraded.status, 0, `${runner.name}: backed-up upgrade failed: ${upgraded.output}`);
  const backupMatch = upgraded.output.match(/Backed up existing AIVV destinations to ([^\r\n]+)/);
  assert.ok(backupMatch, `${runner.name}: upgrade did not report its backup path`);
  const backupRoot = backupMatch[1].trim();

  assert.equal(readFileSync(path.join(backupRoot, 'previous/skills/aivv/LOCAL.md'), 'utf8'), 'keep this local edit in the backup\n');
  assert.equal(readFileSync(path.join(backupRoot, 'previous/agents/aivv-reviewer.toml'), 'utf8'), 'custom reviewer profile\n');
  assert.equal(readFileSync(path.join(backupRoot, 'previous/agents/aivv-investigator.toml'), 'utf8'), 'custom investigator profile\n');
  assert.equal(readFileSync(path.join(backupRoot, 'previous/aivv-runtime/tools/LOCAL.mjs'), 'utf8'), 'keep this runtime edit in the backup\n');
  assert.equal(readFileSync(path.join(backupRoot, 'previous/skills/methodology/LOCAL.md'), 'utf8'), 'legacy content\n');
  assert.match(readFileSync(path.join(backupRoot, 'README.txt'), 'utf8'), /mirrors its original relative path/);

  assert.equal(existsSync(localSkillEdit), false, 'the replacement should contain the shipped skill, not overlay user files');
  assert.equal(existsSync(legacyMethodology), false, 'the requested legacy removal should still happen');
  assert.equal(readFileSync(unrelatedSkill, 'utf8'), 'leave unrelated skills alone\n');
  assert.match(readFileSync(reviewerProfile, 'utf8'), /sandbox_mode = "read-only"/);
  verifyInstalledRuntime(codexRoot);

  // An override can point at the runtime being replaced. Snapshot it before
  // removing any destination paths that also serve as inputs.
  const inPlace = run(runner, codexRoot, home, ['--force'], path.join(codexRoot, 'aivv-runtime'));
  assert.equal(inPlace.status, 0, `${runner.name}: upgrade from the installed runtime failed: ${inPlace.output}`);
  verifyInstalledRuntime(codexRoot);
}

try {
  cpSync(canonicalPluginRoot, pluginRoot, { recursive: true });
  const runners = createRunners();
  const requiredRunner = process.platform === 'win32' ? 'powershell' : 'shell';
  assert.ok(runners.some((runner) => runner.name === requiredRunner), `${requiredRunner} is required to test the Codex installer`);
  for (const runner of runners) verifyRunner(runner);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('Codex installer: validates runtime sources and installed skills, and backs up AIVV paths before upgrades');
