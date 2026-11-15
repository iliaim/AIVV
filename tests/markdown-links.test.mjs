#!/usr/bin/env node

// Fails when a relative link in a tracked-style Markdown file points at a
// file or directory that does not exist. External URLs, pure in-page anchors,
// fenced code blocks, and inline code spans are not checked.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skipDirs = new Set(['.git', '.claude', 'node_modules']);

function markdownFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      markdownFiles(full, out);
    } else if (entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

const linkPattern = /\[[^\]]*\]\(([^)\s]+)\)/g;
const broken = [];

for (const file of markdownFiles(repoRoot)) {
  const text = readFileSync(file, 'utf8')
    .replace(/```[\s\S]*?```/g, '') // fenced code blocks
    .replace(/`[^`\n]*`/g, ''); // inline code spans
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const filePart = target.split('#')[0];
    if (!filePart) continue;
    const resolved = path.resolve(path.dirname(file), filePart);
    if (!existsSync(resolved)) {
      broken.push(`${path.relative(repoRoot, file)} -> ${target}`);
    }
  }
}

assert.deepEqual(broken, [], `Broken relative Markdown links:\n${broken.join('\n')}`);
console.log('markdown links: ok');
