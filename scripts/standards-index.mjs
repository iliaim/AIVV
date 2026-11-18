#!/usr/bin/env node
// Rebuilds plugin/.aivv/standards/index.json from `### RULE-ID: title` headings.
// Usage: node scripts/standards-index.mjs [write|check]   (default: check)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugin');
const STANDARDS = path.join(PLUGIN, '.aivv', 'standards');
const INDEX = path.join(STANDARDS, 'index.json');
const PREFIXES = ['A11Y', 'AS', 'COMP', 'CQ', 'DP', 'HEU', 'I18N', 'IS', 'MC', 'RTV', 'UJ', 'UX', 'VD', 'VVT'];
const HEADING = new RegExp(`^### ((?:${PREFIXES.join('|')})-[A-Za-z0-9.-]+): (.+)$`);

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

export function buildIndex() {
  const rules = [];
  for (const file of markdownFiles(STANDARDS)) {
    const rel = path.relative(PLUGIN, file).split(path.sep).join('/');
    const family = path.relative(STANDARDS, file).split(path.sep)[0].replace(/\.md$/, '');
    fs.readFileSync(file, 'utf8').split('\n').forEach((text, i) => {
      const match = HEADING.exec(text.trimEnd());
      if (match) rules.push({ rule_id: match[1], title: match[2], file: rel, line: i + 1, family });
    });
  }
  rules.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
  return { schema_version: 1, generated_by: 'scripts/standards-index.mjs', rule_id_prefixes: PREFIXES, rules };
}

export const serialize = (index) => `${JSON.stringify(index, null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? 'check';
  const expected = serialize(buildIndex());
  if (mode === 'write') {
    fs.writeFileSync(INDEX, expected);
    console.log(`wrote ${path.relative(process.cwd(), INDEX)}`);
  } else if (mode === 'check') {
    if (fs.readFileSync(INDEX, 'utf8') !== expected) {
      console.error('standards index is stale: run `node scripts/standards-index.mjs write`');
      process.exit(1);
    }
    console.log('standards index is current');
  } else {
    console.error('usage: node scripts/standards-index.mjs [write|check]');
    process.exit(2);
  }
}
