#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'aivv-codex-installer-'));
const pluginRoot = path.join(temporaryRoot, 'plugin-source');

function createPluginFixture() {
  mkdirSync(path.join(pluginRoot, '.aivv/prompts'), { recursive: true });
  mkdirSync(path.join(pluginRoot, 'skills'), { recursive: true });
  mkdirSync(path.join(pluginRoot, 'tools'), { recursive: true });
  writeFileSync(path.join(pluginRoot, '.aivv/prompts/reviewer-role.md'), '# Reviewer role\n');
  writeFileSync(path.join(pluginRoot, '.aivv/prompts/investigator-role.md'), '# Investigator role\n');
  writeFileSync(path.join(pluginRoot, '.aivv/methodology.md'), 'AIVV runtime support\n');
  writeFileSync(path.join(pluginRoot, 'tools/dispatch.mjs'), 'export {};\n');

  for (const name of ['aivv', 'aivv-fix', 'aivv-calibrate', 'aivv-view', 'methodology']) {
    const skillDir = path.join(pluginRoot, 'skills', name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), `---\nname: ${name}\ndescription: test fixture\n---\n`);
  }
}

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
      invoke(codexRoot, home, args) {
        return spawnSync('bash', [shellScript, ...args], {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: home,
            AIVV_CODEX_ROOT_OVERRIDE: codexRoot,
            AIVV_PLUGIN_SOURCE_ROOT: pluginRoot,
          },
        });
      },
    });
  }

  const powerShell = available('pwsh') ? 'pwsh' : available('powershell.exe', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major']) ? 'powershell.exe' : null;
  if (powerShell) {
    runners.push({
      name: 'powershell',
      invoke(codexRoot, home, args) {
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
            AIVV_PLUGIN_SOURCE_ROOT: pluginRoot,
          },
        });
      },
    });
  }

  return runners;
}

function run(runner, codexRoot, home, args = []) {
  const result = runner.invoke(codexRoot, home, args);
  return { ...result, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
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
  assert.ok(existsSync(path.join(codexRoot, 'aivv-runtime/tools/dispatch.mjs')));

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
  assert.ok(existsSync(path.join(codexRoot, 'aivv-runtime/tools/dispatch.mjs')));
}

try {
  createPluginFixture();
  const runners = createRunners();
  assert.ok(runners.length > 0, 'a Bash or PowerShell runtime is required to test the Codex installer');
  for (const runner of runners) verifyRunner(runner);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('Codex installer: refuses silent replacement and backs up AIVV paths before upgrades');
