#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(repoRoot, 'plugin');

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

const codexPlugin = readJson('plugin/plugin.json');
const codexMarketplace = readJson('.agents/plugins/marketplace.json');
const claudePlugin = readJson('plugin/.claude-plugin/plugin.json');
const claudeMarketplace = readJson('.claude-plugin/marketplace.json');

assert.equal(codexMarketplace.plugins.length, 1);
assert.equal(codexMarketplace.plugins[0].name, codexPlugin.name);
assert.equal(codexMarketplace.plugins[0].source.path, './plugin');
assert.equal(claudeMarketplace.plugins.length, 1);
assert.equal(claudeMarketplace.plugins[0].name, claudePlugin.name);
assert.equal(claudeMarketplace.plugins[0].source, './plugin');
assert.equal(claudePlugin.version, undefined, 'relative Claude plugins take their version from the marketplace');
assert.equal(claudeMarketplace.plugins[0].version, codexPlugin.version);

for (const relativePath of [
  codexPlugin.extensions['com.openai'].hooks,
  codexPlugin.extensions['com.openai'].interface.composerIcon,
  codexPlugin.extensions['com.openai'].interface.logo,
  claudePlugin.icon,
  'skills/aivv/SKILL.md',
  '.aivv/runtime-contract.md',
]) {
  assert.ok(existsSync(path.join(pluginRoot, relativePath.replace(/^\.\//, ''))), `missing packaged path: ${relativePath}`);
}

for (const host of ['antigravity', 'claude-code', 'codex', 'hermes-agent']) {
  assert.ok(existsSync(path.join(pluginRoot, `.aivv/platform-adapters/${host}.md`)), `missing ${host} adapter`);
}

for (const skill of ['aivv', 'aivv-fix', 'aivv-view', 'aivv-calibrate', 'methodology']) {
  assert.ok(existsSync(path.join(pluginRoot, `skills/${skill}/SKILL.md`)), `missing canonical ${skill} skill`);
}

const antigravityAdapter = readFileSync(path.join(pluginRoot, '.aivv/platform-adapters/antigravity.md'), 'utf8');
assert.match(antigravityAdapter, /invoke_subagent/, 'Antigravity adapter must map subagent dispatch to invoke_subagent');
assert.match(antigravityAdapter, /TypeName:\s*"research"/, 'Antigravity adapter must use built-in research subagent for read-only roles');
assert.ok(antigravityAdapter.split('\n').some((line) => line.includes('can_enforce_readonly') && line.includes('available')),
  'Antigravity adapter must document native read-only enforcement via research subagent');

const hermesAdapter = readFileSync(path.join(pluginRoot, '.aivv/platform-adapters/hermes-agent.md'), 'utf8');
assert.match(hermesAdapter, /\$\{HERMES_SKILL_DIR\}/, 'Hermes adapter must use Hermes skill-dir substitution');
assert.match(hermesAdapter, /skill_view[\s\S]*read_file/, 'Hermes adapter must distinguish in-skill and cross-root references');
assert.match(hermesAdapter, /SKILL_BASE_DIR[\s\S]*does not export/, 'Hermes adapter must map shared path placeholders without assuming shell variables');
assert.ok(hermesAdapter.split('\n').some((line) => line.includes('can_enforce_readonly') && line.includes('unverified')),
  'Hermes adapter must not claim unverified read-only enforcement');

const installGuide = readFileSync(path.join(repoRoot, 'INSTALL.md'), 'utf8');
assert.match(installGuide, /agy plugin install/, 'installation guide should document Antigravity plugin install');
assert.match(installGuide, /skills\.external_dirs/, 'installation guide should document Hermes external skill setup');
assert.ok(installGuide.split('\n').some((line) => line.includes('git clone') && line.includes('github.com/iliaim/AIVV')
  && /--branch main\b/.test(line)), 'Hermes setup should clone the canonical public repository at its main branch');

for (const skill of ['aivv', 'aivv-fix', 'aivv-view', 'aivv-calibrate']) {
  const content = readFileSync(path.join(pluginRoot, `skills/${skill}/SKILL.md`), 'utf8');
  assert.match(content, /ANTIGRAVITY-SPECIFIC/, `${skill} should point Antigravity users to its host adapter`);
  assert.match(content, /HERMES-AGENT-SPECIFIC/, `${skill} should point Hermes users to its host adapter`);
}

console.log('plugin package: host-adapter assets and canonical skills are present; Claude/Codex marketplaces resolve the shared package');
