#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Native Claude/Codex prompts are assembled by their host instructions rather than
// by a renderer. This helper supplies the unpredictable per-dispatch component used
// by those instructions to fence every substituted evidence value.
const [, , mode, nonce, field] = process.argv;

if (mode === '--nonce' && process.argv.length === 3) {
  process.stdout.write(randomBytes(16).toString('hex') + '\n');
} else if (mode === '--wrap' && process.argv.length === 5) {
  if (!/^[a-f0-9]{32}$/.test(nonce)) {
    process.stderr.write('Nonce must be 32 lowercase hexadecimal characters.\n');
    process.exit(2);
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(field)) {
    process.stderr.write('Field must be an uppercase identifier.\n');
    process.exit(2);
  }
  const tag = 'AIVV_UNTRUSTED_' + nonce + '_' + field;
  const value = readFileSync(0, 'utf8');
  process.stdout.write('<' + tag + '>\n' + value + (value.endsWith('\n') ? '' : '\n') + '</' + tag + '>\n');
} else {
  process.stderr.write('Usage: node native-prompt-boundary.mjs --nonce\n');
  process.stderr.write('       node native-prompt-boundary.mjs --wrap <nonce> <FIELD>  # reads value from stdin\n');
  process.exit(2);
}
