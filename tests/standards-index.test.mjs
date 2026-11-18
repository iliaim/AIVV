import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, serialize } from '../scripts/standards-index.mjs';

const committed = fs.readFileSync(new URL('../plugin/.aivv/standards/index.json', import.meta.url), 'utf8');
assert.equal(committed, serialize(buildIndex()),
  'plugin/.aivv/standards/index.json is stale: run `node scripts/standards-index.mjs write`');
console.log('standards index matches rule headings');
