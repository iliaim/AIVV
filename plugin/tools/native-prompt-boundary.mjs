#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Native host prompts are assembled by their adapter instructions rather than
// by a renderer. This helper supplies the unpredictable per-dispatch component used
// by those instructions to fence every substituted evidence value.
export function newNonce() {
  return randomBytes(16).toString('hex');
}

export function wrapUntrusted(nonce, field, value) {
  if (!/^[a-f0-9]{32}$/.test(nonce)) throw new Error('Nonce must be 32 lowercase hexadecimal characters.');
  if (!/^[A-Z][A-Z0-9_]*$/.test(field)) throw new Error('Field must be an uppercase identifier.');
  const tag = 'AIVV_UNTRUSTED_' + nonce + '_' + field;
  return '<' + tag + '>\n' + value + (value.endsWith('\n') ? '' : '\n') + '</' + tag + '>\n';
}

function main() {
  const [, , mode, nonce, field] = process.argv;
  if (mode === '--nonce' && process.argv.length === 3) {
    process.stdout.write(newNonce() + '\n');
  } else if (mode === '--wrap' && process.argv.length === 5) {
    try {
      wrapUntrusted(nonce, field, '');
    } catch (error) {
      process.stderr.write(error.message + '\n');
      process.exit(2);
    }
    process.stdout.write(wrapUntrusted(nonce, field, readFileSync(0, 'utf8')));
  } else {
    process.stderr.write('Usage: node native-prompt-boundary.mjs --nonce\n');
    process.stderr.write('       node native-prompt-boundary.mjs --wrap <nonce> <FIELD>  # reads value from stdin\n');
    process.exit(2);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
