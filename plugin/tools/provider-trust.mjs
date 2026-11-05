#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');

const DEFAULT_DENYLIST = [
  '.git/**',
  '.env',
  '**/.env',
  '**/.env.*',
  '*.pem',
  '*.key',
  '**/*.pem',
  '**/*.key',
  '**/id_rsa',
  '**/id_dsa',
  '**/id_ecdsa',
  '**/id_ed25519',
  '**/.ssh/*',
  '**/.aws/credentials',
  '**/.aws/config',
  '**/.kube/config',
  '*.p12',
  '*.pfx',
  '**/*.p12',
  '**/*.pfx',
  '**/credentials.json',
  '**/token.json',
  '.aivv/runtime/**',
  '.aivv/state/**',
  '.aivv/provider-trust/**',
  'plugin/.aivv/runtime/**',
  'plugin/.aivv/state/**',
  'plugin/.aivv/provider-trust/**',
];

const DEFAULT_REDACTIONS = [
  { name: 'url-credential', pattern: /(?:[?;]|&(?:amp;)?)(?:x-(?:amz|goog)-(?:credential|signature)|x-amz-security-token|api[_-]?key|apikey|key|access[_-]?token|id[_-]?token|refresh[_-]?token|token|client[_-]?secret|secret|password|signature|sig|credential)\s*=\s*[^\s&#;"'<>]+/gi },
  { name: 'assignment-secret', pattern: /(?:["']?)(\b[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)(?:["']?)\s*(?:=|:)\s*(?:["']?)([^\s"']{4,})(?=["']?(?:\s|$|[.,;\])}]))/gi },
  { name: 'openai-style-token', pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/g },
  { name: 'anthropic-style-token', pattern: /\bsk-ant-[A-Za-z0-9_-]{8,}\b/g },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/g },
];

function sha256Text(text) {
  return createHash('sha256').update(text || '').digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function splitList(value) {
  if (!value) return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeRelPath(pathValue, root = ROOT) {
  const raw = String(pathValue || '').trim();
  if (!raw) return '';
  const abs = isAbsolute(raw) ? resolve(raw) : resolve(root, raw);
  const rel = relative(root, abs).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return raw.replace(/\\/g, '/');
  return rel;
}

function matchPattern(relPath, pattern) {
  const path = relPath.replace(/\\/g, '/');
  const pat = pattern.replace(/\\/g, '/');
  if (pat.endsWith('/**')) return path === pat.slice(0, -3) || path.startsWith(pat.slice(0, -2));
  if (pat.includes('*')) return globRegex(pat).test(path);
  return path === pat || path.endsWith('/' + pat);
}

function globRegex(pattern) {
  let source = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    if (pattern.startsWith('**/', i)) {
      source += '(?:.*/)?';
      i += 2;
    } else if (pattern.startsWith('**', i)) {
      source += '.*';
      i += 1;
    } else if (pattern[i] === '*') {
      source += '[^/]*';
    } else {
      source += escapeRegex(pattern[i]);
    }
  }
  return new RegExp(source + '$');
}

function escapeRegex(text) {
  return text.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function classifyPath(inputPath, denylist, root = ROOT) {
  const relPath = normalizeRelPath(inputPath, root);
  for (const pattern of denylist) {
    if (matchPattern(relPath, pattern)) {
      const source = DEFAULT_DENYLIST.includes(pattern) ? 'default-denylist' : 'user-denylist';
      return { path: relPath, allowed: false, reason: source, pattern };
    }
  }
  return { path: relPath, allowed: true, reason: 'allowed' };
}

function redactText(text, redactionRules = DEFAULT_REDACTIONS) {
  let redactedText = String(text || '');
  const redactions = [];
  for (const rule of redactionRules) {
    redactedText = redactedText.replace(rule.pattern, match => {
      const replacement = '[AIVV_REDACTED:' + rule.name + ':' + sha256Text(match).slice(0, 12) + ']';
      redactions.push({
        kind: rule.name,
        sha256: sha256Text(match),
        replacement,
        bytes: Buffer.byteLength(match, 'utf8'),
      });
      return replacement;
    });
  }
  return { text: redactedText, redactions };
}

function truncateUtf8(text, maxBytes) {
  if (!Number.isFinite(maxBytes) || maxBytes < 0) return '';
  let bytes = 0;
  let truncated = '';
  for (const character of text) {
    const characterBytes = Buffer.byteLength(character, 'utf8');
    if (bytes + characterBytes > maxBytes) break;
    truncated += character;
    bytes += characterBytes;
  }
  return truncated;
}

function escapeTerminalControls(text) {
  const escapes = {
    8: '\\b',
    9: '\\t',
    10: '\\n',
    11: '\\v',
    12: '\\f',
    13: '\\r',
  };
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, character => {
    const code = character.charCodeAt(0);
    return escapes[code] || '\\x' + code.toString(16).padStart(2, '0').toUpperCase();
  });
}

// Provider CLIs may echo credentials in their diagnostics. Keep every
// user-visible diagnostic redacted and bounded at its sink; hashes can still
// be calculated from the original text where correlation is needed.
export function redactProviderDiagnostic(text, maxBytes = 1000) {
  return truncateUtf8(escapeTerminalControls(redactText(text).text), maxBytes);
}

function evidenceClassForPath(pathValue) {
  const relPath = normalizeRelPath(pathValue).replace(/^plugin\//, '');
  if (relPath.startsWith('.aivv/prompts/') || relPath.startsWith('skills/methodology/')) return 'role-methodology';
  if (relPath.startsWith('skills/')) return 'skill';
  if (relPath.startsWith('.aivv/platform-adapters/')) return 'platform-adapter';
  if (relPath.startsWith('tools/tests/fixtures/')) return 'fixture';
  if (relPath.startsWith('docs/')) return 'target-doc';
  return 'repo-source';
}

export function providerTrustMemoryPath() {
  if (process.env.AIVV_PROVIDER_TRUST_MEMORY) return process.env.AIVV_PROVIDER_TRUST_MEMORY;
  // Dual-path: prefer the sibling `.aivv/provider-trust/` under ROOT (correct when this
  // script lives at `<ship-root>/tools/`), else the legacy repo-root layout under ROOT.
  const base = existsSync(resolve(ROOT, '.aivv'))
    ? resolve(ROOT, '.aivv/provider-trust')
    : resolve(ROOT, 'plugin/.aivv/provider-trust');
  return resolve(base, 'last-approved.json');
}

export function assessProviderTrust(input = {}) {
  const root = input.root || ROOT;
  const provider = input.provider || 'unknown';
  const model = input.model || null;
  const authMode = input.authMode || 'auto';
  const destinationShape = input.destinationShape || 'provider-cli-or-api-auto';
  const evidenceClasses = Array.isArray(input.evidenceClasses) ? input.evidenceClasses.filter(Boolean) : [];
  const sourceList = Array.isArray(input.sourceList) ? input.sourceList.filter(Boolean) : [];
  const userDenylist = [...splitList(process.env.AIVV_PROVIDER_TRUST_DENYLIST), ...(input.denylist || [])];
  const denylist = [...DEFAULT_DENYLIST, ...userDenylist];
  const policy = {
    version: 1,
    default_denylist: DEFAULT_DENYLIST,
    user_denylist: userDenylist,
    redaction_rules: DEFAULT_REDACTIONS.map(rule => rule.name),
  };
  const policySha256 = sha256Text(stableJson(policy));
  const blockedPaths = sourceList
    .map(source => classifyPath(source, denylist, root))
    .filter(result => !result.allowed);
  const redacted = redactText(input.prompt || '');
  const evidenceClassSet = [...new Set([
    ...evidenceClasses,
    ...sourceList.map(evidenceClassForPath),
  ].filter(Boolean))].sort();
  const sourceClasses = [...new Set(sourceList.map(evidenceClassForPath))].sort();
  const signaturePayload = {
    provider,
    model,
    auth_mode: authMode,
    destination_shape: destinationShape,
    evidence_classes: evidenceClassSet,
    source_classes: sourceClasses,
    policy_sha256: policySha256,
  };
  const trustSignature = sha256Text(stableJson(signaturePayload));
  const report = {
    allowed: blockedPaths.length === 0,
    provider,
    model,
    auth_mode: authMode,
    destination_shape: destinationShape,
    evidence_classes: evidenceClassSet,
    source_classes: sourceClasses,
    policy_sha256: policySha256,
    trust_signature: trustSignature,
    blocked_paths: blockedPaths,
    redactions: redacted.redactions,
    warnings: [],
  };

  const memoryPath = input.memoryPath || providerTrustMemoryPath();
  if (memoryPath && existsSync(memoryPath)) {
    try {
      const previous = JSON.parse(readFileSync(memoryPath, 'utf8'));
      if (previous.trust_signature && previous.trust_signature !== trustSignature) {
        report.warnings.push({
          code: 'PROVIDER_TRUST_CHANGED',
          previous_trust_signature: previous.trust_signature,
          current_trust_signature: trustSignature,
        });
      }
    } catch (err) {
      report.warnings.push({ code: 'PROVIDER_TRUST_MEMORY_UNREADABLE', message: err.message });
    }
  }

  return { report, prompt: redacted.text };
}

export function writeProviderTrustMemory(report, memoryPath = providerTrustMemoryPath()) {
  if (!memoryPath) return;
  mkdirSync(dirname(memoryPath), { recursive: true });
  writeFileSync(memoryPath, JSON.stringify({
    updated_at: new Date().toISOString(),
    trust_signature: report.trust_signature,
    provider: report.provider,
    model: report.model,
    auth_mode: report.auth_mode,
    destination_shape: report.destination_shape,
    evidence_classes: report.evidence_classes,
    source_classes: report.source_classes,
    policy_sha256: report.policy_sha256,
  }, null, 2) + '\n');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function selfTest() {
  const blocked = assessProviderTrust({ sourceList: ['.env'], prompt: 'safe' }).report;
  assert(blocked.allowed === false, 'expected .env to be blocked');
  assert(blocked.blocked_paths[0].reason === 'default-denylist', 'expected default denylist reason');
  for (const path of ['.env.local', '.env.production', 'sub/.env.local', 'certs/client.pem', 'nested/client.key']) {
    const report = assessProviderTrust({ sourceList: [path], prompt: 'safe' }).report;
    assert(report.allowed === false, 'expected credential-adjacent path to be blocked: ' + path);
  }
  const dottedSafe = assessProviderTrust({ sourceList: ['docs/release.v1.md'], prompt: 'safe' }).report;
  assert(dottedSafe.allowed === true, 'expected ordinary dotted doc filename to remain allowed');

  const user = assessProviderTrust({ sourceList: ['docs/private/design.md'], prompt: 'safe', denylist: ['docs/private/**'] }).report;
  assert(user.allowed === false, 'expected user denylist to block path');
  assert(user.blocked_paths[0].reason === 'user-denylist', 'expected user denylist reason');

  const redacted = assessProviderTrust({ sourceList: ['docs/public.md'], prompt: 'token sk-test-redacted' });
  assert(redacted.report.allowed === true, 'safe source should be allowed');
  assert(!redacted.prompt.includes('sk-test-redacted'), 'redacted prompt should not contain token');
  assert(redacted.report.redactions.length === 1, 'expected redaction metadata');

  const diagnostic = redactProviderDiagnostic('token sk-test-diagnostic-12345678 ' + 'x'.repeat(200), 100);
  assert(!diagnostic.includes('sk-test-diagnostic-12345678'), 'diagnostic should not contain token');
  assert(Buffer.byteLength(diagnostic, 'utf8') <= 100, 'diagnostic should respect byte limit');
  const namedDiagnostic = redactProviderDiagnostic('GEMINI_API_KEY: provider-key-12345678');
  assert(!namedDiagnostic.includes('provider-key-12345678'), 'colon-assigned secret should not appear in diagnostic');
  assert(namedDiagnostic.includes('AIVV_REDACTED:assignment-secret'), 'colon-assigned secret should be redacted');
  const quotedNamedDiagnostic = redactProviderDiagnostic('GEMINI_API_KEY="provider-key-quoted-12345678".');
  assert(!quotedNamedDiagnostic.includes('provider-key-quoted-12345678'), 'quoted secret should not appear in diagnostic');
  assert(quotedNamedDiagnostic.includes('AIVV_REDACTED:assignment-secret'), 'quoted secret should be redacted');
  const jsonNamedDiagnostic = redactProviderDiagnostic('{"GEMINI_API_KEY":"provider-key-json-12345678"}');
  assert(!jsonNamedDiagnostic.includes('provider-key-json-12345678'), 'JSON secret should not appear in diagnostic');
  assert(jsonNamedDiagnostic.includes('AIVV_REDACTED:assignment-secret'), 'JSON secret should be redacted');
  const queryDiagnostic = redactProviderDiagnostic('request failed: https://example.test/generate?key=abc&attempt=1');
  assert(!queryDiagnostic.includes('key=abc'), 'short query secret should not appear in diagnostic');
  assert(queryDiagnostic.includes('AIVV_REDACTED:url-credential'), 'query secret should be redacted');
  assert(queryDiagnostic.includes('&attempt=1'), 'query redaction should preserve neighboring non-secret parameters');
  for (const [name, value] of [
    ['X-Amz-Credential', 'AKIAEXAMPLE'],
    ['X-Amz-Signature', 'deadbeef'],
    ['X-Amz-Security-Token', 'temporary-session-token'],
    ['X-Goog-Credential', 'goog-credential'],
    ['X-Goog-Signature', 'goog-signature'],
  ]) {
    const signedUrlDiagnostic = redactProviderDiagnostic(`request failed: https://example.test/?${name}=${value}&attempt=1`);
    assert(!signedUrlDiagnostic.includes(value), `${name} should not appear in diagnostic`);
    assert(signedUrlDiagnostic.includes('AIVV_REDACTED:url-credential'), `${name} should be redacted`);
  }
  assert(redactProviderDiagnostic('first\n\u001b[31mred\u001b[0m') === 'first\\n\\x1B[31mred\\x1B[0m', 'terminal controls should be escaped');
  assert(redactProviderDiagnostic('first\u009B31mred\u009D') === 'first\\x9B31mred\\x9D', 'C1 terminal controls should be escaped');

  const a = assessProviderTrust({ provider: 'gemini', sourceList: ['docs/a.md'], prompt: 'safe' }).report.trust_signature;
  const b = assessProviderTrust({ provider: 'openai', sourceList: ['docs/a.md'], prompt: 'safe' }).report.trust_signature;
  assert(a !== b, 'provider change should alter trust signature');
  process.stdout.write('[AIVV] provider-trust self-test OK\n');
}

if (process.argv.includes('--self-test')) {
  try {
    selfTest();
  } catch (err) {
    process.stderr.write('[AIVV] provider-trust self-test failed: ' + err.message + '\n');
    process.exit(9);
  }
}
