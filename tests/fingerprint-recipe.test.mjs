#!/usr/bin/env node
// Runs the fingerprint recipes exactly as documented in plugin/.aivv/runtime-contract.md
// against finding text full of shell metacharacters. The documented recipe must hash the
// literal bytes and must never execute any part of the finding text.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMP_ROOT = mkdtempSync(path.join(os.tmpdir(), 'aivv-fingerprint-'));

const contract = readFileSync(path.join(REPO_ROOT, 'plugin/.aivv/runtime-contract.md'), 'utf8');
const start = contract.indexOf('## Canonical Fingerprint Formula');
const end = contract.indexOf('\n## ', start + 1);
assert.ok(start >= 0 && end > start, 'runtime-contract.md must keep a "Canonical Fingerprint Formula" section');
const section = contract.slice(start, end);

function recipe(language) {
  const blocks = [...section.matchAll(new RegExp('```' + language + '\\n([\\s\\S]*?)```', 'g'))]
    .map((match) => match[1])
    .filter((block) => block.includes('git hash-object'));
  assert.equal(blocks.length, 1, `expected exactly one documented ${language} fingerprint recipe`);
  return blocks[0];
}

// Ground truth: the canonical input followed by exactly one LF.
function expectedHash(identifier) {
  return execFileSync('git', ['hash-object', '--stdin', '--no-filters'], {
    cwd: REPO_ROOT,
    input: `${identifier}\n`,
    encoding: 'utf8',
  }).trim();
}

// The documented rule: a delimiter that equals no complete input line.
function bashDelimiter(identifier) {
  const lines = new Set(identifier.split('\n'));
  let delimiter = 'EOF_AIVV_FP';
  while (lines.has(delimiter)) delimiter += '_';
  return delimiter;
}

const BASH_PLACEHOLDER = '<location_identifier>:<lowercased_description>';
const bashTemplate = recipe('bash');
assert.ok(bashTemplate.includes(BASH_PLACEHOLDER), 'the bash recipe must show the canonical input placeholder');

function runDocumentedBash(identifier) {
  const delimiter = bashDelimiter(identifier);
  const script = bashTemplate
    .replaceAll('EOF_AIVV_FP', delimiter)
    .replace(BASH_PLACEHOLDER, () => identifier);
  return spawnSync('bash', ['--noprofile', '--norc', '-c', script], { cwd: REPO_ROOT, encoding: 'utf8' });
}

// PowerShell treats U+0027 and the four typographic single quotes as quote characters.
const SINGLE_QUOTES = new RegExp(`[${String.fromCodePoint(0x27, 0x2018, 0x2019, 0x201a, 0x201b)}]`, 'g');
const CURLY = String.fromCodePoint(0x2018, 0x2019, 0x201a, 0x201b);
const PS_PLACEHOLDER = '<identifier with single-quote characters doubled>';
const powershellTemplate = recipe('powershell');

function runDocumentedPowerShell(identifier) {
  const doubled = identifier.replace(SINGLE_QUOTES, (quote) => quote + quote);
  const script = powershellTemplate.replace(PS_PLACEHOLDER, () => doubled);
  return spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

try {
  if (spawnSync('bash', ['--version'], { encoding: 'utf8' }).error?.code === 'ENOENT') {
    console.log('fingerprint recipe: bash unavailable, bash cases skipped');
  } else {
    const marker = path.join(TEMP_ROOT, 'bash-command-ran');
    const hostile = [
      'src/café.txt:plain \\path "quoted" \'apostrophe\' $HOME $(printf aivv_probe)',
      `src/a.js:backtick \`touch ${marker}\` and $(touch ${marker})`,
      'dir/first line\nEOF_AIVV_FP\nEOF_AIVV_FP_\nlast.txt:needs a longer delimiter',
    ];
    for (const identifier of hostile) {
      const result = runDocumentedBash(identifier);
      assert.equal(result.status, 0, `documented bash recipe failed: ${result.stderr}`);
      assert.equal(result.stdout.trim(), expectedHash(identifier), `documented bash recipe changed the bytes for: ${JSON.stringify(identifier)}`);
    }
    assert.equal(existsSync(marker), false, 'finding text was executed by the documented bash recipe');
  }

  const powershellProbe = spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' });
  if (powershellProbe.error?.code === 'ENOENT') {
    console.log('fingerprint recipe: PowerShell 7 unavailable, PowerShell cases skipped');
  } else {
    assert.ok(powershellTemplate.includes(PS_PLACEHOLDER), 'the PowerShell recipe must be the single-quoted string form');
    const hostile = [
      `src/café.txt:plain \\path $(2+3) $HOME \`printf probe\` "quoted" 'apostrophe' ${CURLY}curly${CURLY}`,
      "src/a.ps1:prefix\n'@ | Write-Output\nWrite-Output 'aivv_here_string_probe'\n@'\nsuffix $(2+3)",
      `src/b.ps1:it${CURLY[1]}; Write-Output aivv_curly_probe; ${CURLY[0]}tail`,
    ];
    for (const identifier of hostile) {
      const result = runDocumentedPowerShell(identifier);
      assert.equal(result.status, 0, `documented PowerShell recipe failed: ${result.stderr}`);
      assert.equal(result.stdout.trim(), expectedHash(identifier), `documented PowerShell recipe changed the bytes for: ${JSON.stringify(identifier)}`);
      assert.doesNotMatch(result.stdout, /aivv_/, 'finding text was executed by the documented PowerShell recipe');
    }
  }
} finally {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
}

console.log('fingerprint recipe: documented Bash and PowerShell forms hash finding text literally');
