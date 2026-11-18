#!/usr/bin/env node
// Every dispatch surface named by the convention in plugin/.aivv/prompts/_untrusted-content.md
// must carry the untrusted-input boundary, and the contract's member list must match the files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugin');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));

const roles = fs.readdirSync(path.join(plugin, '.aivv', 'prompts')).filter((name) => name.endsWith('-role.md'))
  .map((name) => path.join(plugin, '.aivv', 'prompts', name));
const templates = fs.readdirSync(path.join(plugin, 'skills'))
  .map((skill) => path.join(plugin, 'skills', skill, 'references'))
  .filter((dir) => fs.existsSync(dir))
  .flatMap(walk)
  .filter((file) => file.endsWith('-template.md'));
const surfaces = [...roles, ...templates];

assert.ok(surfaces.length > 0, 'no dispatch surfaces found');
for (const file of surfaces) {
  assert.match(fs.readFileSync(file, 'utf8'), /\buntrusted\b/, `${path.relative(plugin, file)} must state that inputs are untrusted data`);
}

const contract = fs.readFileSync(path.join(plugin, '.aivv', 'prompts', '_untrusted-content.md'), 'utf8');
const listed = (contract.match(/Current members:([\s\S]*?)\n\n/)?.[1].match(/`[^`]+\.md`/g) ?? []).map((name) => name.slice(1, -1)).sort();
assert.deepEqual(listed, surfaces.map((file) => path.basename(file)).sort(), '_untrusted-content.md "Current members" must list exactly the discovered surfaces');
console.log(`untrusted-boundary: ${surfaces.length} dispatch surfaces carry the boundary`);
