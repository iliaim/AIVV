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

for (const host of ['claude-code', 'codex']) {
  assert.ok(existsSync(path.join(pluginRoot, `.aivv/platform-adapters/${host}.md`)), `missing ${host} adapter`);
}

console.log('plugin package: Codex and Claude marketplaces resolve the shared package and host adapters');
