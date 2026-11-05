#!/usr/bin/env node
/**
 * AIVV Multi-Model Dispatch Script (tools/dispatch.mjs)
 *
 * Receives a fully-assembled cold prompt via stdin.
 * Calls the specified AI provider and returns findings as NDJSON.
 * Requires Node 20+ (built-in fetch; Node 18 EOL 2025-04-30). Zero external npm dependencies.
 *
 * Usage:
 *   printf '%s' "$prompt" | node <AIVV_ROOT>/tools/dispatch.mjs \
 *     --provider anthropic --model <id> --reviewer-id alpha \
 *     --timeout 300
 *
 *   node <AIVV_ROOT>/tools/dispatch.mjs --probe --provider anthropic --provider-egress-consent
 *   node <AIVV_ROOT>/tools/dispatch.mjs --assert-prompt-pack
 *
 * Exit codes:
 *   0  Success
 *   1  Missing API key (--auth-mode api_key and env var not set)
 *   2  Auth failure (401/403 from provider)
 *   3  No auth found (--auth-mode auto: CLI unavailable or unauthenticated, no API key set)
 *   4  Unsupported provider / not yet implemented
 *   5  Node version < 20 (Node 18 EOL 2025-04-30)
 *   9  Dispatch failed after all retries / provider egress consent missing
 *
 * Auth resolution (--auth-mode auto, the default — no API keys required):
 *   Anthropic: ① claude CLI subprocess  → ② ANTHROPIC_API_KEY
 *   Gemini:    ① agy CLI subprocess  → ② gemini CLI subprocess  → ③ GEMINI_API_KEY
 *   OpenAI:    ① codex CLI subprocess   → ② OPENAI_API_KEY
 */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessProviderTrust, redactProviderDiagnostic, writeProviderTrustMemory } from './provider-trust.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const AIVV_ROOT = dirname(SCRIPT_DIR);

// ── Node version guard ─────────────────────────────────────────────────────
// Require Node 20+ (LTS, Maintenance through 2026-04-30). Node 18 reached EOL 2025-04-30.
const [nodeMajor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 20) {
  process.stderr.write('[AIVV] Node 20+ required for multi-model dispatch (Node 18 EOL 2025-04-30). Current: ' + process.versions.node + '\n');
  process.exit(5);
}

// ── Arg parsing ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    probe: false,
    provider: null,
    model: null,
    reviewerId: 'solo',
    timeout: 300,
    authMode: 'auto',
    assertPromptPack: false,
    assertModernFindingSchema: false,
    assertExtractJSON: false,
    renderPromptOnly: false,
    providerEgressConsent: false,
    evidenceClasses: [],
    sourceList: [],
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--probe') { args.probe = true; continue; }
    if (arg === '--assert-prompt-pack') { args.assertPromptPack = true; continue; }
    if (arg === '--assert-modern-finding-schema') { args.assertModernFindingSchema = true; continue; }
    if (arg === '--assert-extract-json') { args.assertExtractJSON = true; continue; }
    if (arg === '--render-prompt-only') { args.renderPromptOnly = true; continue; }
    if (arg === '--provider-egress-consent') { args.providerEgressConsent = true; continue; }
    if (arg === '--help' || arg === '-h') { args.help = true; continue; }
    const eq = arg.indexOf('=');
    const [key, val] = eq >= 0 ? [arg.slice(0, eq), arg.slice(eq + 1)] : [arg, argv[++i]];
    switch (key) {
      case '--provider':    args.provider = val; break;
      case '--model':       args.model = val; break;
      case '--reviewer-id': args.reviewerId = val; break;
      case '--timeout':     args.timeout = parseInt(val, 10); break;
      case '--auth-mode':   args.authMode = val; break;
      case '--evidence-classes': args.evidenceClasses = splitListArg(val); break;
      case '--source-list': args.sourceList = splitListArg(val); break;
      default: process.stderr.write('[AIVV] Unknown arg: ' + key + '\n');
    }
  }
  return args;
}

function splitListArg(value) {
  if (!value) return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

const args = parseArgs(process.argv.slice(2));
const PROVIDER_PROMPT_MAX_BYTES = Number.parseInt(process.env.AIVV_PROVIDER_PROMPT_MAX_BYTES || '0', 10);

// Post-parse arg validation: guard against NaN from missing-value args (e.g., --timeout with no value)
if (!Number.isFinite(args.timeout) || args.timeout <= 0) {
  process.stderr.write('[AIVV] --timeout requires a positive integer (seconds). Got: ' + args.timeout + '\n');
  process.exit(4);
}

if (args.help) {
  process.stdout.write([
    'AIVV dispatch.mjs — multi-model reviewer dispatch',
    '',
    'Usage:',
    '  printf "%s" "$prompt" | node <AIVV_ROOT>/tools/dispatch.mjs --provider <p> --model <m> --reviewer-id <id> [--timeout <s>] [--auth-mode auto|cli|api_key]',
    '  printf "%s" "$prompt" | node <AIVV_ROOT>/tools/dispatch.mjs --provider <p> --model <m> --reviewer-id <id> --render-prompt-only',
    '  node <AIVV_ROOT>/tools/dispatch.mjs --probe --provider <p> --provider-egress-consent',
    '  node <AIVV_ROOT>/tools/dispatch.mjs --assert-prompt-pack',
    '  node <AIVV_ROOT>/tools/dispatch.mjs --assert-modern-finding-schema',
    '  node <AIVV_ROOT>/tools/dispatch.mjs --assert-extract-json',
    '',
    'Providers: anthropic, gemini, openai',
    '',
    'Auth (--auth-mode auto, default — no API keys required):',
    '  Anthropic: claude CLI (already logged in via Claude Code)  →  ANTHROPIC_API_KEY',
    '  Gemini:    agy CLI (Google Antigravity) → gemini CLI       →  GEMINI_API_KEY',
    '  OpenAI:    codex CLI (run: codex auth)                     →  OPENAI_API_KEY',
    '',
    'Provider egress:',
    '  Dispatch requires --provider-egress-consent. Use --render-prompt-only to inspect the packed prompt locally.',
    '',
    'Exit codes: 0=ok 1=missing-key 2=auth-fail 3=no-auth-found 4=not-impl 5=node-version 9=dispatch-fail',
  ].join('\n') + '\n');
  process.exit(0);
}

// ── Signal handler — clean up tracked children on SIGINT/SIGTERM ──────────
const activeControllers = new Set();
function cleanup(signal) {
  process.stderr.write('[AIVV] ' + signal + ' received — aborting active requests\n');
  for (const ctrl of activeControllers) { try { ctrl.abort(); } catch (_) {} }
  process.exit(signal === 'SIGINT' ? 130 : 143);
}
process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));

// ── Stdin reader ──────────────────────────────────────────────────────────
function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', d => chunks.push(d));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

// ── Retry with exponential backoff + jitter ───────────────────────────────
async function withRetry(fn, { maxRetries = 3, baseMs = 500, capMs = 60000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (err.fatal) throw err; // Auth errors: no retry
      if (attempt < maxRetries) {
        const delay = Math.min(capMs, baseMs * Math.pow(2, attempt)) * (0.5 + Math.random() * 0.5);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ── Structural validator (no external JSON Schema lib) ────────────────────
const SEVERITY_ENUM = new Set(['CRITICAL', 'MAJOR', 'MINOR', 'POLISH']);
const CONFIDENCE_ENUM = new Set(['HIGH', 'MEDIUM', 'LOW']);
const LENS_ENUM = new Set(['general', 'code', 'sec', 'visual', 'ux', 'polish', 'compliance', 'i18n', 'user-journey', 'perf', 'a11y']);
const CATEGORY_ENUM_VALUES = ['code-bug', 'design-flaw', 'process-violation', 'documentation-gap', 'clarification-needed', 'improvement'];
const CATEGORY_ENUM = new Set(CATEGORY_ENUM_VALUES);
const MODERN_FINDING_FIELDS = ['quality_profile', 'scope_ref', 'evidence', 'impact', 'severity_rationale', 'recommended_next_step', 'verification_path', 'proportional_remediation'];
const MODERN_SCOPE_KIND_ENUM = ['process', 'session', 'artifact', 'user-journey', 'project'];
const MODERN_EVIDENCE_KIND_ENUM = ['internal-repo', 'websearch', 'webfetch', 'runtime', 'command', 'state-log', 'thread', 'unverified', 'unverifiable'];
const RECOMMENDED_NEXT_STEP_ENUM = ['fix-now', 'investigate-first', 'document', 'defer-with-rationale', 'accept-risk'];
const IMPROVEMENT_VALUE_ENUM = ['high', 'medium', 'low'];
const IMPROVEMENT_EFFORT_ENUM = ['trivial', 'moderate', 'invasive'];
const PROVIDER_NULL_OPTIONAL_FINDING_FIELDS = [
  ...MODERN_FINDING_FIELDS,
  'file',
  'line',
  'lens',
  'rule_id',
  'grounded_by',
  'value',
  'effort',
];
const PROVIDER_MODERN_REQUIRED_FIELDS = [
  'evidence',
  'impact',
  'severity_rationale',
  'recommended_next_step',
  'verification_path',
  'proportional_remediation',
];
const PROPORTIONAL_REMEDIATION_FIELDS = ['present_problem', 'simplest_viable_correction', 'net_complexity', 'why_current_shape_insufficient'];
function isCompleteProportionalRemediation(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length === PROPORTIONAL_REMEDIATION_FIELDS.length
    && PROPORTIONAL_REMEDIATION_FIELDS.every(field =>
      typeof value[field] === 'string' && value[field].trim().length >= 8
    )
  );
}
const MODERN_FINDING_JSON_SCHEMA_PROPERTIES = {
  quality_profile: { type: 'string', enum: ['modern'] },
  scope_ref: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'ref'],
    properties: {
      kind: { type: 'string', enum: MODERN_SCOPE_KIND_ENUM },
      ref: { type: 'string' },
    },
  },
  evidence: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'ref', 'excerpt'],
      properties: {
        kind: { type: 'string', enum: MODERN_EVIDENCE_KIND_ENUM },
        ref: { type: 'string' },
        excerpt: { type: ['string', 'null'] },
      },
    },
  },
  impact: { type: 'string' },
  severity_rationale: { type: 'string' },
  recommended_next_step: { type: 'string', enum: RECOMMENDED_NEXT_STEP_ENUM },
  verification_path: { type: 'string' },
  proportional_remediation: {
    type: 'object',
    additionalProperties: false,
    required: PROPORTIONAL_REMEDIATION_FIELDS,
    properties: Object.fromEntries(PROPORTIONAL_REMEDIATION_FIELDS.map(field => [field, { type: 'string' }])),
  },
};
const GEMINI_MODERN_FINDING_SCHEMA_PROPERTIES = {
  quality_profile: { type: 'STRING', enum: ['modern'] },
  scope_ref: {
    type: 'OBJECT',
    properties: {
      kind: { type: 'STRING', enum: MODERN_SCOPE_KIND_ENUM },
      ref: { type: 'STRING' },
    },
    required: ['kind', 'ref'],
  },
  evidence: {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        kind: { type: 'STRING', enum: MODERN_EVIDENCE_KIND_ENUM },
        ref: { type: 'STRING' },
        excerpt: { type: 'STRING' },
      },
      required: ['kind', 'ref', 'excerpt'],
    },
  },
  impact: { type: 'STRING' },
  severity_rationale: { type: 'STRING' },
  recommended_next_step: { type: 'STRING', enum: RECOMMENDED_NEXT_STEP_ENUM },
  verification_path: { type: 'STRING' },
  proportional_remediation: {
    type: 'OBJECT',
    required: PROPORTIONAL_REMEDIATION_FIELDS,
    properties: Object.fromEntries(PROPORTIONAL_REMEDIATION_FIELDS.map(field => [field, { type: 'STRING' }])),
  },
};

function validateFinding(f, idx) {
  const errs = [];
  if (!f || typeof f !== 'object') return ['not an object'];
  if (typeof f.id !== 'string' || !/^F[0-9]{3,}$/.test(f.id)) errs.push('id: must match F[0-9]{3,}');
  if (!SEVERITY_ENUM.has(f.severity)) errs.push('severity: must be CRITICAL/MAJOR/MINOR/POLISH, got: ' + f.severity);
  if (!CONFIDENCE_ENUM.has(f.confidence)) errs.push('confidence: must be HIGH/MEDIUM/LOW, got: ' + f.confidence);
  if (!CATEGORY_ENUM.has(f.category)) errs.push('category: invalid, got: ' + f.category);
  if (typeof f.summary !== 'string' || f.summary.length < 8) errs.push('summary: must be string ≥ 8 chars');
  if (f.lens != null && !LENS_ENUM.has(f.lens)) {
    process.stderr.write('[AIVV WARN] Finding ' + providerDiagnostic(f.id, 100) + ': unknown lens "' + providerDiagnostic(f.lens, 100) + '" — defaulting to code\n');
    f.lens = 'code';
  }
  if (f.quality_profile === 'modern') {
    const proportionality = f.proportional_remediation;
    if (!isCompleteProportionalRemediation(proportionality)) {
      errs.push('proportional_remediation: all four minimum-sufficient-remediation fields are required');
    }
    if (
      (f.severity === 'POLISH' || f.category === 'improvement') &&
      !IMPROVEMENT_EFFORT_ENUM.includes(f.effort)
    ) {
      errs.push('effort: modern POLISH/improvement findings require trivial/moderate/invasive');
    }
  }
  return errs;
}

function validateResponse(parsed, reviewerId) {
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Response is not an object' };
  if (!Array.isArray(parsed.findings)) return { ok: false, error: 'Response missing findings array' };
  const errs = [];
  parsed.findings.forEach((f, i) => {
    const ferrs = validateFinding(f, i);
    if (ferrs.length) errs.push('findings[' + i + ']: ' + ferrs.join('; '));
    else if (!f.reviewer) f.reviewer = reviewerId; // backfill if omitted
  });
  if (errs.length) return { ok: false, error: errs.join('\n') };
  return { ok: true };
}

function normalizeProviderCitationArrayForDurableOutput(citations) {
  if (!Array.isArray(citations)) return citations;
  return citations.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const normalized = {};
    for (const [key, value] of Object.entries(item)) {
      if (key === 'excerpt' && value === null) continue;
      normalized[key] = value;
    }
    return normalized;
  });
}

function isCompleteModernEvidenceArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(item =>
      item
      && typeof item === 'object'
      && !Array.isArray(item)
      && typeof item.kind === 'string'
      && item.kind.length > 0
      && typeof item.ref === 'string'
      && item.ref.length > 0
    );
}

function normalizeProviderFindingForDurableOutput(finding) {
  const normalized = {};
  for (const [key, value] of Object.entries(finding || {})) {
    if (PROVIDER_NULL_OPTIONAL_FINDING_FIELDS.includes(key) && value === null) continue;
    if (key === 'evidence') {
      normalized[key] = normalizeProviderCitationArrayForDurableOutput(value);
      continue;
    }
    if (key === 'grounded_by') {
      normalized[key] = normalizeProviderCitationArrayForDurableOutput(value);
      continue;
    }
    normalized[key] = value;
  }
  if (normalized.quality_profile === 'modern') {
    const hasModernEnvelope = PROVIDER_MODERN_REQUIRED_FIELDS.every(field => {
      const value = normalized[field];
      if (value === undefined || value === null) return false;
      if (field === 'evidence') return isCompleteModernEvidenceArray(value);
      if (field === 'proportional_remediation') {
        return isCompleteProportionalRemediation(value);
      }
      return true;
    });
    const hasFileLocation = typeof normalized.file === 'string' && normalized.file.length > 0 && normalized.scope_ref === undefined;
    const hasScopeLocation = normalized.file === undefined && normalized.scope_ref && typeof normalized.scope_ref.ref === 'string' && normalized.scope_ref.kind !== 'file';
    if (!hasModernEnvelope || (!hasFileLocation && !hasScopeLocation)) {
      delete normalized.quality_profile;
    }
  }
  return normalized;
}

function normalizeProviderResponseForDurableOutput(response) {
  return {
    ...response,
    findings: (response.findings || []).map(normalizeProviderFindingForDurableOutput),
  };
}

// ── NDJSON emitter ────────────────────────────────────────────────────────
function emitNDJSON(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function providerDiagnostic(message, maxBytes = 1000) {
  return redactProviderDiagnostic(message, maxBytes);
}

function classifyProviderFailure(message) {
  const text = String(message || '');
  if (/json parse|unexpected token|unexpected end of json|not valid json|no complete json|missing 'findings'|schema validation|valid json but missing/i.test(text)) return 'parse';
  if (/timed out|timeout/i.test(text)) return 'timeout';
  if (/eagain|emfile|enfile|resource temporarily unavailable|spawn/i.test(text)) return 'local-spawn-exhaustion';
  if (/quota|rate limit|too many requests|429|token limit|max tokens|context token/i.test(text)) return 'quota';
  if (/auth|unauth|not logged in|login|api key|401|403|no .*auth|missing .*key/i.test(text)) return 'auth';
  return 'unknown';
}

function emitFailureMeta({ provider, model, reviewerId, message, exitCode, failureClass }) {
  const resolvedFailureClass = failureClass || classifyProviderFailure(message);
  const diagnostic = providerDiagnostic(message);
  emitNDJSON({
    _meta: true,
    status: 'failed',
    reviewer_id: reviewerId,
    provider,
    model,
    failure_class: resolvedFailureClass,
    exit_code: exitCode,
    stderr_sha256: sha256Text(message || ''),
    remediation: remediationForFailureClass(resolvedFailureClass),
    error: diagnostic,
  });
}

function remediationForFailureClass(failureClass) {
  if (failureClass === 'auth') return 'Authenticate the provider CLI or configure the matching API key.';
  if (failureClass === 'timeout') return 'Retry with a smaller prompt, higher timeout, or different provider.';
  if (failureClass === 'parse') return 'Retry; if repeated, inspect provider output and prompt schema instructions.';
  if (failureClass === 'local-spawn-exhaustion') return 'Retry after local process/resource pressure clears.';
  if (failureClass === 'quota') return 'Retry after quota resets or switch provider/model.';
  return 'Inspect provider stderr and retry after resolving the underlying provider failure.';
}

// ── Provider role/methodology prompt pack ─────────────────────────────────
const PROMPT_PACK_SENTINEL = '## AIVV Provider Role/Methodology Prompt Pack';
const PROVIDER_REVIEWER_ROLE_PATH = '.aivv/prompts/reviewer-role.md';
const PROVIDER_METHODOLOGY_PATH = 'skills/methodology/SKILL.md';

function readRepoText(relPath) {
  const direct = join(AIVV_ROOT, relPath);
  if (existsSync(direct)) return readFileSync(direct, 'utf8');
  return readFileSync(join(AIVV_ROOT, 'plugin', relPath), 'utf8');
}

function sha256Text(text) {
  return createHash('sha256').update(text || '').digest('hex');
}

function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return text.trim();
  const end = text.indexOf('\n---\n', 4);
  return end === -1 ? text.trim() : text.slice(end + 5).trim();
}

function buildProviderPromptPack(coldPrompt) {
  const trimmed = coldPrompt.trimStart();
  if (trimmed.startsWith(PROMPT_PACK_SENTINEL)) return coldPrompt;
  const reviewerRole = stripFrontmatter(readRepoText(PROVIDER_REVIEWER_ROLE_PATH));
  const methodology = stripFrontmatter(readRepoText(PROVIDER_METHODOLOGY_PATH));

  return [
    PROMPT_PACK_SENTINEL,
    '',
    `Source: ${PROVIDER_REVIEWER_ROLE_PATH}`,
    '',
    reviewerRole,
    '',
    `Source: ${PROVIDER_METHODOLOGY_PATH}`,
    '',
    methodology,
    '',
    'Provider transport note: the sections above are source-derived AIVV reviewer role and operational methodology content, included because provider subprocesses do not receive native AIVV subagent skill preload.',
    '',
    'The Step 4 cold prompt below is expected to include Review Dispatch Metadata near the top and include these dispatch metadata fields in the prompt body: Reviewer label, Review mode, Lens, and Capability degradations. Use those fields to identify your reviewer slot and any dispatch limitations.',
    '',
    'The provider structured-output JSON is the machine-readable sidecar for provider transport, parsing, and synthesis; it is not a replacement for AIVV review methodology. Apply the methodology first, then encode the resulting findings in the provider-requested structured-output format.',
    '',
    '## Step 4 Cold Prompt',
    '',
    coldPrompt,
  ].join('\n');
}

function includedPromptPackSources(sourceList) {
  const sources = [
    PROVIDER_REVIEWER_ROLE_PATH,
    PROVIDER_METHODOLOGY_PATH,
    ...sourceList,
  ];
  return [...new Set(sources.filter(Boolean))];
}

function buildProviderDisclosure({ prompt, consented }) {
  return {
    provider: args.provider,
    model: args.model,
    reviewer_id: args.reviewerId,
    evidence_classes: args.evidenceClasses,
    destination_shape: destinationShapeForArgs(),
    auth_mode: args.authMode,
    prompt_sha256: sha256Text(prompt),
    prompt_bytes: Buffer.byteLength(prompt, 'utf8'),
    source_list: includedPromptPackSources(args.sourceList),
    consent_source: consented ? 'cli-flag:--provider-egress-consent' : 'absent',
  };
}

function destinationShapeForArgs() {
  if (args.authMode === 'api_key') return 'provider-api';
  if (args.authMode === 'test') return 'local-test-double';
  return 'provider-cli-or-api-auto';
}

function printProviderTrustBlock(report) {
  process.stderr.write('[AIVV] PROVIDER_TRUST_BLOCKED: refusing to invoke provider ' + args.provider + ' because provider trust policy blocked prompt sources.\n');
  process.stderr.write('[AIVV PROVIDER_TRUST] ' + JSON.stringify(report) + '\n');
}

function enforceProviderPromptLimit(prompt) {
  if (PROVIDER_PROMPT_MAX_BYTES === 0) return;
  if (!Number.isFinite(PROVIDER_PROMPT_MAX_BYTES) || PROVIDER_PROMPT_MAX_BYTES < 0) {
    process.stderr.write('[AIVV] PROVIDER_PROMPT_LIMIT_INVALID: AIVV_PROVIDER_PROMPT_MAX_BYTES must be a non-negative integer\n');
    process.exit(4);
  }
  const promptBytes = Buffer.byteLength(prompt, 'utf8');
  if (promptBytes > PROVIDER_PROMPT_MAX_BYTES) {
    process.stderr.write('[AIVV] PROVIDER_PROMPT_TOO_LARGE: ' + promptBytes + ' bytes exceeds limit ' + PROVIDER_PROMPT_MAX_BYTES + '\n');
    process.exit(9);
  }
}

// ── Log entry (content hashed, never verbatim) ────────────────────────────
async function makeLogEntry(fields) {
  return {
    ...fields,
    prompt_sha256: sha256Text(fields._prompt || ''),
    response_sha256: sha256Text(fields._response || ''),
    prompt_bytes: (fields._prompt || '').length,
    _prompt: undefined,
    _response: undefined,
  };
}

// ── Shared CLI output JSON extraction ────────────────────────────────────
// Tries three strategies in order:
//   1. Direct JSON.parse — handles clean JSON output with no preamble.
//   2. Bracket-depth counting — finds the first parseable {…} block when
//      preamble or postamble text surrounds the JSON. Note: does not track
//      string boundaries, so embedded '{}' in summary strings can confuse
//      depth counts; if parse fails the loop continues to the next candidate.
//   3. Greedy first{…last} fallback — slices from the first '{' to the last
//      '}' and delegates to JSON.parse. JSON.parse correctly handles any
//      character (including unbalanced '{'/'}') inside string values, which
//      is the failure class the depth counter cannot recover from. This
//      strategy fails if there is postamble text containing '}' after the
//      JSON object, but that is rare and depth counting would also fail there.
function extractJSONFromOutput(output) {
  const text = output.replace(/```(?:json)?\n?([\s\S]*?)\n?```/g, '$1').trim();

  // Strategy 1: direct parse (no preamble)
  try { return JSON.parse(text); } catch (_) {}

  // Strategy 2: depth-counting scan
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(text.slice(start, i + 1)); }
        catch (_) { start = -1; } // try next candidate
      }
    }
  }

  // Strategy 3: greedy first{…last} — handles unbalanced braces inside strings
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); }
    catch (_) {}
  }

  throw new Error('No complete JSON object found in CLI output');
}

// ── Claude CLI availability check ────────────────────────────────────────
// NOTE: returns true if `claude --version` exits 0, but this does NOT guarantee
// that `claude --print` dispatch will work. In particular, spawning `claude --print`
// from within an active Claude Code session (CLAUDECODE=1) is unreliable — the
// subprocess inherits the parent session's environment and can hang or return
// wrong-schema output. Use isInsideClaudeCodeSession() to guard against this.
async function isClaudeCLIAvailable() {
  return new Promise(resolve => {
    const child = spawn('claude', ['--version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
  });
}

// Detects whether this dispatch.mjs process is running inside an active Claude Code
// session. When true, spawning `claude --print` is unreliable (session conflict).
// The correct Anthropic dispatch path inside Claude Code is the Agent tool.
//
// Detection relies on CLAUDECODE and CLAUDE_CODE_SESSION_ID env vars set by Claude Code.
// Known edge cases where the guard may fire incorrectly:
//   - Shell sessions that inherited CLAUDECODE from a previously-exited Claude Code process
//   - CI environments where CLAUDECODE=1 is set for unrelated reasons
//   - Future Claude Code versions that rename the env vars
// Override: set AIVV_FORCE_CLI_DISPATCH=1 to bypass this guard and use the CLI path
// (useful for debugging, testing outside Claude Code, or working around false positives).
function isInsideClaudeCodeSession() {
  if (process.env.AIVV_FORCE_CLI_DISPATCH === '1') return false;
  return Boolean(process.env.CLAUDECODE || process.env.CLAUDE_CODE_SESSION_ID);
}

// ── Claude CLI subprocess dispatch (Anthropic OAuth path) ─────────────────
// Leverages existing claude CLI OAuth session — no ANTHROPIC_API_KEY required.
//
// IMPORTANT: This path is NOT safe when running inside a Claude Code session
// (CLAUDECODE=1). Spawning `claude --print` from within Claude Code causes either
// ~285s hang or wrong-schema output due to parent-session interaction. When
// CLAUDECODE=1, callAnthropic() refuses the CLI path and returns an error that
// tells the caller to use the Agent tool (subagent_type: aivv:reviewer) instead.
//
// cwd is set to $HOME (not inherited project dir) to prevent maintainer guidance from being
// auto-discovered by the spawned subprocess — avoids the project context leaking
// into the cold reviewer role and overriding the --system-prompt schema instruction.
const FINDINGS_SCHEMA_FOR_CLI = JSON.stringify({
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'severity', 'confidence', 'category', 'summary'],
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['CRITICAL', 'MAJOR', 'MINOR', 'POLISH'] },
          confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          category: { type: 'string', enum: CATEGORY_ENUM_VALUES },
          summary: { type: 'string' },
          value: { type: ['string', 'null'], enum: [...IMPROVEMENT_VALUE_ENUM, null] },
          effort: { type: ['string', 'null'], enum: [...IMPROVEMENT_EFFORT_ENUM, null] },
          file: { type: ['string', 'null'] },
          line: { type: ['integer', 'null'] },
          lens: { type: 'string' },
          rule_id: { type: 'string' },
          grounded_by: { type: 'array' },
          ...MODERN_FINDING_JSON_SCHEMA_PROPERTIES,
        },
      },
    },
  },
});

const MODERN_FINDING_FILE_EXAMPLE = '{"id":"F001","severity":"CRITICAL|MAJOR|MINOR|POLISH","confidence":"HIGH|MEDIUM|LOW","category":"code-bug|design-flaw|process-violation|documentation-gap|clarification-needed|improvement","summary":"description","value":null,"effort":null,"quality_profile":"modern","file":"path/to/file","evidence":[{"kind":"internal-repo|websearch|webfetch|runtime|command|state-log|thread|unverified|unverifiable","ref":"source reference","excerpt":"short excerpt or null"}],"impact":"user or maintenance impact","severity_rationale":"why this severity is justified","recommended_next_step":"fix-now|investigate-first|document|defer-with-rationale|accept-risk","verification_path":"deterministic way to verify the fix","proportional_remediation":{"present_problem":"current evidenced problem","simplest_viable_correction":"minimum sufficient change","net_complexity":"moving pieces added or removed","why_current_shape_insufficient":"why no change or a smaller correction is insufficient"}}';
const MODERN_FINDING_SCOPED_EXAMPLE = '{"id":"F002","severity":"CRITICAL|MAJOR|MINOR|POLISH","confidence":"HIGH|MEDIUM|LOW","category":"code-bug|design-flaw|process-violation|documentation-gap|clarification-needed|improvement","summary":"description","value":null,"effort":null,"quality_profile":"modern","scope_ref":{"kind":"process|session|artifact|user-journey|project","ref":"stable scope reference"},"evidence":[{"kind":"internal-repo|websearch|webfetch|runtime|command|state-log|thread|unverified|unverifiable","ref":"source reference","excerpt":"short excerpt or null"}],"impact":"user or maintenance impact","severity_rationale":"why this severity is justified","recommended_next_step":"fix-now|investigate-first|document|defer-with-rationale|accept-risk","verification_path":"deterministic way to verify the fix","proportional_remediation":{"present_problem":"current evidenced problem","simplest_viable_correction":"minimum sufficient change","net_complexity":"moving pieces added or removed","why_current_shape_insufficient":"why no change or a smaller correction is insufficient"}}';
const MODERN_FINDING_FORMAT = '{"findings":[' + MODERN_FINDING_FILE_EXAMPLE + ']} or {"findings":[' + MODERN_FINDING_SCOPED_EXAMPLE + ']}';

const ANTHROPIC_CLI_SYSTEM_PROMPT = 'You are an AIVV independent reviewer. Follow the role/methodology prompt pack supplied on stdin, then return findings ONLY as a JSON object matching this structure: ' + MODERN_FINDING_FORMAT + '. Use exactly one location field: for file-backed findings use file and omit scope_ref; for non-file findings omit file and use scope_ref. No markdown, no explanation outside the JSON object. Empty findings array if no issues.';

async function callAnthropicCLI(model, prompt, timeoutSecs) {
  const cliArgs = [
    '--print',
    '--output-format', 'text',
    // Override maintainer guidance project context (AIVV dev instructions must not interfere
    // with the cold reviewer role). --json-schema is intentionally omitted: it
    // suppresses stdout when combined with --print + --output-format text.
    '--system-prompt', ANTHROPIC_CLI_SYSTEM_PROMPT,
    '--tools', '',
    '--no-session-persistence',
    '--model', model,
  ];

  return new Promise((resolve, reject) => {
    // cwd: process.env.HOME — hypothesis: prevents maintainer guidance auto-discovery in the
    // spawned subprocess. Without this, the subprocess may inherit the project directory,
    // load maintainer guidance, and have the project context override --system-prompt causing wrong
    // schema output (e.g. {"review":{...}} instead of {"findings":[]}).
    // NOTE: applies only on non-Claude-Code hosts. On Claude Code, the session check
    // runs before this branch. The behavior has not been empirically verified on other hosts.
    const child = spawn('claude', cliArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.env.HOME || process.env.USERPROFILE || '/tmp',
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('claude CLI timed out after ' + timeoutSecs + 's'));
    }, timeoutSecs * 1000);

    child.stdin.write(prompt);
    child.stdin.end();

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error('claude CLI exited ' + code + ': ' + stderr.slice(0, 200)));
        return;
      }
      try {
        const parsed = extractJSONFromOutput(stdout);
        resolve(parsed);
      } catch (e) {
        reject(new Error('JSON parse failed from CLI output: ' + e.message));
      }
    });
  });
}

// ── Anthropic provider ────────────────────────────────────────────────────
const ANTHROPIC_FINDINGS_TOOL = {
  name: 'submit_findings',
  description: 'Submit all findings identified in the requested review. Call this once with the complete list. Use an empty array if no issues were found.',
  input_schema: {
    type: 'object',
    required: ['findings'],
    properties: {
      findings: {
        type: 'array',
        description: 'Zero or more findings. Empty array = no issues found.',
        items: {
          type: 'object',
          required: ['id', 'severity', 'confidence', 'category', 'summary'],
          properties: {
            id:         { type: 'string', pattern: '^F[0-9]{3,}$' },
            severity:   { type: 'string', enum: ['CRITICAL', 'MAJOR', 'MINOR', 'POLISH'] },
            confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
            category:   { type: 'string', enum: CATEGORY_ENUM_VALUES },
            summary:    { type: 'string', minLength: 8 },
            value:      { type: ['string', 'null'], enum: [...IMPROVEMENT_VALUE_ENUM, null] },
            effort:     { type: ['string', 'null'], enum: [...IMPROVEMENT_EFFORT_ENUM, null] },
            file:       { type: ['string', 'null'] },
            line:       { type: ['integer', 'null'], minimum: 1 },
            lens:       { type: 'string', enum: ['general', 'code', 'sec', 'visual', 'ux', 'polish', 'compliance', 'i18n', 'user-journey', 'perf', 'a11y'] },
            rule_id:    { type: 'string' },
            devils_advocate: { type: 'boolean' },
            grounded_by: { type: 'array' },
            ...MODERN_FINDING_JSON_SCHEMA_PROPERTIES,
          },
        },
      },
    },
  },
};

async function probeAnthropic() {
  // When running inside Claude Code in auto mode, spawning `claude --print` as a
  // subprocess is unreliable (session conflict — see file header comment). The correct
  // Anthropic dispatch path on Claude Code is the Agent tool (subagent_type:
  // aivv:reviewer). Probe exits 0 to signal "available via native-agent path".
  // Note: --auth-mode api_key bypasses the Claude Code guard to allow testing the
  // API key path explicitly (e.g. for T6 api_key mode tests).
  //
  // Probe-call contract (intentional asymmetry): probe exits 0 but callAnthropic() exits 4
  // when called directly inside Claude Code. This is by design — the probe signals that
  // ANTHROPIC is AVAILABLE on this host, but via the Agent tool (not via CLI subprocess).
  // The orchestrator (SKILL.md Case D 5.D.3) interprets exit 0 + dispatch_path:agent-tool
  // and routes accordingly. Direct callers that bypass SKILL.md Case D and call
  // callAnthropic() will get exit 4 — they should use the Agent tool path instead.
  if (args.authMode === 'auto' && isInsideClaudeCodeSession()) {
    process.stdout.write('[AIVV] Anthropic probe: running inside Claude Code session — native Agent tool path available. CLI subprocess skipped.\n');
    // Machine-parseable capability marker for telemetry and orchestrators.
    process.stderr.write(JSON.stringify({ aivv_capability: 'anthropic', dispatch_path: 'agent-tool', reason: 'claude-code-session-detected' }) + '\n');
    process.exit(0);
  }

  // Outside Claude Code, or explicit api_key mode: try claude CLI first (uses existing OAuth session).
  if (args.authMode === 'auto' && await isClaudeCLIAvailable()) {
    process.stdout.write('[AIVV] Anthropic probe OK via claude CLI (OAuth — existing session).\n');
    process.exit(0);
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !key.trim()) {
    if (args.authMode === 'auto') {
      process.stderr.write(
        '[AIVV] No Anthropic auth found.\n' +
        '[AIVV] Auth options:\n' +
        '[AIVV]   1. CLI OAuth: install the claude CLI and ensure it is in PATH (uses existing OAuth session)\n' +
        '[AIVV]   2. API key (--auth-mode api_key): set ANTHROPIC_API_KEY. Get at: https://console.anthropic.com/\n'
      );
      process.exit(3);
    }
    process.stderr.write('[AIVV] Missing ANTHROPIC_API_KEY. Get a key at: https://console.anthropic.com/\n');
    process.exit(1);
  }
  const ctrl = new AbortController();
  activeControllers.add(ctrl);
  setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: ctrl.signal,
    });
    activeControllers.delete(ctrl);
    if (res.status === 401 || res.status === 403) {
      process.stderr.write('[AIVV] Anthropic auth failure (HTTP ' + res.status + ')\n');
      process.exit(2);
    }
    if (!res.ok) {
      process.stderr.write('[AIVV] Anthropic probe failed: HTTP ' + res.status + '\n');
      process.exit(9);
    }
    const data = await res.json();
    const ids = (data.data || []).map(m => m.id).join(', ');
    process.stdout.write('[AIVV] Anthropic probe OK. Models: ' + ids + '\n');
    process.exit(0);
  } catch (err) {
    activeControllers.delete(ctrl);
    if (err.name === 'AbortError') {
      process.stderr.write('[AIVV] Anthropic probe timed out after 5s\n');
      process.exit(9);
    }
    process.stderr.write('[AIVV] Anthropic probe error: ' + providerDiagnostic(err.message) + '\n');
    process.exit(9);
  }
}

// ── Exit code reference ───────────────────────────────────────────────────
// Processes using dispatch.mjs can observe these exit codes:
//   0 — success (probe OK or dispatch completed)
//   1 — missing required credential (e.g. no ANTHROPIC_API_KEY in api_key mode)
//   2 — auth failure (HTTP 401/403 from provider API)
//   3 — no auth method found (CLI unavailable AND no API key in auto mode)
//   4 — operation not supported in this context (e.g. Anthropic CLI inside Claude Code)
//   9 — other/unexpected error (timeout, network failure, parse error)
//
function classifyClaudeCliFailure(message) {
  const sharedClass = classifyProviderFailure(message);
  if (sharedClass !== 'unknown') return sharedClass;
  return 'unknown';
}

async function callAnthropic(model, prompt, timeoutSecs) {
  // Inside Claude Code in auto mode: CLI subprocess is unreliable. Refuse with a
  // clear error so the orchestrator (SKILL.md Case D) uses the Agent tool instead.
  // Note: --auth-mode api_key bypasses this guard to allow explicit API-key usage.
  if (args.authMode === 'auto' && isInsideClaudeCodeSession()) {
    const err = new Error(
      'Anthropic CLI subprocess is not supported when running inside a Claude Code session ' +
      '(CLAUDECODE=1). Use the Agent tool with subagent_type: aivv:reviewer for Anthropic ' +
      'dispatch on Claude Code. For debugging or edge cases, set AIVV_FORCE_CLI_DISPATCH=1 to bypass.'
    );
    err.fatal = true;
    err.exitCode = 4; // unsupported in this context
    throw err;
  }

  // Outside Claude Code: try claude CLI first (uses existing OAuth session, no API key needed).
  let cliFailureClass = null;
  let cliFailureMessage = null;
  if (args.authMode === 'auto' && await isClaudeCLIAvailable()) {
    try {
      return await callAnthropicCLI(model, prompt, timeoutSecs);
    } catch (cliErr) {
      cliFailureClass = classifyClaudeCliFailure(cliErr.message);
      cliFailureMessage = cliErr.message;
      process.stderr.write('[AIVV] claude CLI dispatch failed: ' + providerDiagnostic(cliErr.message, 500) + '\n[AIVV] Falling back to ANTHROPIC_API_KEY...\n');
    }
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !key.trim()) {
    if (args.authMode === 'auto') {
      const failureClass = cliFailureClass || 'auth';
      const err = new Error(
        failureClass === 'auth'
          ? 'No Anthropic auth. Claude CLI failed auth and ANTHROPIC_API_KEY is not set. Options: ensure `claude` is in PATH and authenticated, or set ANTHROPIC_API_KEY.'
          : `Claude CLI dispatch failed (${failureClass}) and ANTHROPIC_API_KEY is not set for fallback. CLI error: ${String(cliFailureMessage || '').slice(0, 300)}`
      );
      err.fatal = true;
      err.exitCode = failureClass === 'auth' ? 3 : 9;
      err.failureClass = failureClass;
      throw err;
    }
    const err = new Error('Missing ANTHROPIC_API_KEY. Get a key at: https://console.anthropic.com/'); err.fatal = true; err.exitCode = 1; throw err;
  }

  const ctrl = new AbortController();
  activeControllers.add(ctrl);
  const timer = setTimeout(() => ctrl.abort(), timeoutSecs * 1000);

  try {
    const res = await withRetry(async (attempt) => {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: ctrl.signal,
      });
      if (r.status === 401 || r.status === 403) {
        const err = new Error('Auth failure HTTP ' + r.status); err.fatal = true; err.exitCode = 2; throw err;
      }
      if (r.status === 429 || r.status >= 500) {
        throw new Error('Retryable HTTP ' + r.status);
      }
      if (!r.ok) {
        const err = new Error('HTTP ' + r.status); err.fatal = true; throw err;
      }
      return r;
    });

    const data = await res.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const text = textBlock && textBlock.text;
    if (!text) throw new Error('No text content in Anthropic response');
    return JSON.parse(text);

  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out after ' + timeoutSecs + 's');
    throw err;
  } finally {
    clearTimeout(timer);
    activeControllers.delete(ctrl);
  }
}

// ── Gemini provider ───────────────────────────────────────────────────────
// Auth (auto): agy CLI subprocess → legacy gemini CLI subprocess → GEMINI_API_KEY.
// Setup (no API key): install/authenticate Google Antigravity CLI (`agy`) or run
// `gemini auth login` while the legacy Gemini CLI remains available.
// Note: CLI OAuth tokens are not reused for direct REST API calls. CLI subprocess
// is the OAuth path; GEMINI_API_KEY is the REST API path.

async function isGeminiCLIAvailable() {
  return new Promise(resolve => {
    const child = spawn('gemini', ['--version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
  });
}

async function isAgyCLIAvailable() {
  return new Promise(resolve => {
    const child = spawn('agy', ['--version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
  });
}

// JSON instruction appended as -p arg; main prompt goes to stdin.
// Google CLI subprocesses write warnings to stderr, response to stdout.
// agy accepts --model in print mode; legacy gemini still omits -m because REST
// API model IDs (e.g. gemini-2.0-flash) are not accepted consistently by that
// CLI path.
// -m flag intentionally omitted: REST API model IDs (e.g. gemini-2.0-flash) are
// not accepted by the gemini CLI (it uses its own internal model routing). The
// model ID from the catalog is recorded in _meta for traceability but the CLI
// picks its own default. Known limitation — model pinning via config has no
// effect on the legacy gemini CLI dispatch path; use agy or GEMINI_API_KEY +
// --auth-mode=api_key for model control.
// Shared JSON format instruction appended to prompts for all CLI subprocess paths.
// gemini: passed as -p value (appended to stdin). codex: appended to stdin directly.
const CLI_JSON_SUFFIX = '\n\nRESPONSE FORMAT: Return ONLY a valid JSON object — no markdown fences, no text before or after. Structure: ' + MODERN_FINDING_FORMAT + '. Use exactly one location field: for file-backed findings use file and omit scope_ref; for non-file findings omit file and use scope_ref. Empty array if no issues: {"findings":[]}';

function providerPromptPathTexts(packedPrompt) {
  return {
    'anthropic-cli-system+stdin': ANTHROPIC_CLI_SYSTEM_PROMPT + '\n\n' + packedPrompt,
    'anthropic-api-message': packedPrompt,
    'agy-cli-stdin+suffix': packedPrompt + CLI_JSON_SUFFIX,
    'gemini-cli-stdin+suffix': packedPrompt + CLI_JSON_SUFFIX,
    'gemini-api-content': packedPrompt,
    'codex-cli-stdin+suffix': packedPrompt + CLI_JSON_SUFFIX,
    'openai-api-message': packedPrompt,
  };
}

function assertPromptPack() {
  const sampleColdPrompt = [
    'ADVISORY MODE — Session-centric IV&V review (lens: code).',
    '',
    '## Review Dispatch Metadata',
    'Reviewer label: alpha',
    'Review mode: cold_multi_model',
    'Lens: code',
    'Capability degradations: none',
    '',
    'Session Activity (PRIMARY)',
    '- Sample no-network assertion prompt.',
  ].join('\n');
  const packedPrompt = buildProviderPromptPack(sampleColdPrompt);
  const required = [
    'AIVV Independent Reviewer',
    `Source: ${PROVIDER_REVIEWER_ROLE_PATH}`,
    `Source: ${PROVIDER_METHODOLOGY_PATH}`,
    'Session Context Skepticism',
    'Project Context Discovery',
    'Provider transport note',
    'Review Dispatch Metadata',
    'Reviewer label',
    'Review mode',
    'Lens',
    'Capability degradations',
    'provider structured-output JSON is the machine-readable sidecar',
    'not a replacement for AIVV review methodology',
  ];

  const failures = [];
  for (const [pathName, text] of Object.entries(providerPromptPathTexts(packedPrompt))) {
    for (const needle of required) {
      if (!text.includes(needle)) failures.push(pathName + ' missing: ' + needle);
    }
  }

  if (failures.length) {
    process.stderr.write('[AIVV] Prompt-pack assertion failed:\n' + failures.map(f => '  - ' + f).join('\n') + '\n');
    process.exit(9);
  }

  process.stdout.write('[AIVV] Prompt-pack assertion OK for provider paths: ' + Object.keys(providerPromptPathTexts(packedPrompt)).join(', ') + '\n');
  process.exit(0);
}

function failModernFindingSchema(message) {
  process.stderr.write('[AIVV] STRICT_FINDING_PROFILE_MISSING: ' + message + '\n');
  process.exit(9);
}

function expectObject(value, message) {
  if (!value || typeof value !== 'object') failModernFindingSchema(message);
  return value;
}

function expectArrayIncludes(array, value, message) {
  if (!Array.isArray(array) || !array.includes(value)) failModernFindingSchema(message);
}

function expectTypeIncludesNull(schema, fieldName) {
  if (!Array.isArray(schema.type) || !schema.type.includes('null')) {
    failModernFindingSchema('OpenAI strict schema field ' + fieldName + ' is not nullable');
  }
}

function assertModernFieldsPresent(schemaName, findingSchema) {
  const properties = expectObject(findingSchema.properties, schemaName + ' missing finding properties');
  for (const field of MODERN_FINDING_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(properties, field)) {
      failModernFindingSchema(schemaName + ' missing ' + field);
    }
  }
}

function assertModernJsonSchemaNestedShapes(schemaName, findingSchema) {
  const properties = findingSchema.properties;
  const scopeRef = expectObject(properties.scope_ref, schemaName + ' missing scope_ref schema');
  const scopeProperties = expectObject(scopeRef.properties, schemaName + ' missing scope_ref properties');
  expectArrayIncludes(scopeRef.required, 'kind', schemaName + ' scope_ref missing required kind');
  expectArrayIncludes(scopeRef.required, 'ref', schemaName + ' scope_ref missing required ref');
  if (scopeRef.additionalProperties !== false) failModernFindingSchema(schemaName + ' scope_ref allows additional properties');
  if (scopeProperties.kind?.enum?.includes('file')) failModernFindingSchema(schemaName + ' scope_ref.kind enum includes file');

  const evidence = expectObject(properties.evidence, schemaName + ' missing evidence schema');
  const evidenceItems = expectObject(evidence.items, schemaName + ' missing evidence items schema');
  const evidenceProperties = expectObject(evidenceItems.properties, schemaName + ' missing evidence item properties');
  if (evidenceItems.additionalProperties !== false) failModernFindingSchema(schemaName + ' evidence items allow additional properties');
  for (const field of ['kind', 'ref', 'excerpt']) {
    expectArrayIncludes(evidenceItems.required, field, schemaName + ' evidence item missing required ' + field);
    if (!Object.prototype.hasOwnProperty.call(evidenceProperties, field)) {
      failModernFindingSchema(schemaName + ' evidence item missing property ' + field);
    }
  }
}

function assertOpenAIStrictModernSchema(findingSchema) {
  assertModernFieldsPresent('OpenAI strict schema', findingSchema);
  const properties = findingSchema.properties;
  for (const field of MODERN_FINDING_FIELDS) {
    expectArrayIncludes(findingSchema.required, field, 'OpenAI strict schema required array missing ' + field);
    expectTypeIncludesNull(properties[field], field);
  }
  assertModernJsonSchemaNestedShapes('OpenAI strict schema', findingSchema);
}

function assertModernPromptStrings() {
  const directPromptTexts = {
    ANTHROPIC_CLI_SYSTEM_PROMPT,
    CLI_JSON_SUFFIX,
  };
  for (const [name, text] of Object.entries(directPromptTexts)) {
    for (const field of MODERN_FINDING_FIELDS) {
      if (!text.includes(field)) failModernFindingSchema(name + ' missing ' + field);
    }
    if (!text.includes(MODERN_FINDING_FORMAT)) failModernFindingSchema(name + ' is not using the shared modern finding format examples');
    if (!text.includes('Use exactly one location field') || !text.includes('omit scope_ref') || !text.includes('omit file')) {
      failModernFindingSchema(name + ' missing exactly-one-location guidance');
    }
  }

  if (MODERN_FINDING_FILE_EXAMPLE.includes('"scope_ref"')) {
    failModernFindingSchema('shared file example includes scope_ref');
  }
  if (MODERN_FINDING_SCOPED_EXAMPLE.includes('"file"')) {
    failModernFindingSchema('shared scoped example includes file');
  }

  const sampleColdPrompt = [
    'ADVISORY MODE — Session-centric IV&V review (lens: code).',
    '',
    '## Review Dispatch Metadata',
    'Reviewer label: alpha',
    'Review mode: cold_multi_model',
    'Lens: code',
    'Capability degradations: none',
    '',
    'Session Activity (PRIMARY)',
    '- Sample modern finding schema assertion prompt.',
  ].join('\n');
  const packedPrompt = buildProviderPromptPack(sampleColdPrompt);
  const packedTexts = providerPromptPathTexts(packedPrompt);
  for (const pathName of ['anthropic-cli-system+stdin', 'agy-cli-stdin+suffix', 'gemini-cli-stdin+suffix', 'codex-cli-stdin+suffix']) {
    const text = packedTexts[pathName];
    for (const field of MODERN_FINDING_FIELDS) {
      if (!text.includes(field)) failModernFindingSchema(pathName + ' packed prompt missing ' + field);
    }
  }
}

function assertProviderNullNormalization() {
  const openAiStyle = {
    findings: [{
      id: 'F001',
      severity: 'MAJOR',
      confidence: 'HIGH',
      category: 'design-flaw',
      summary: 'Strict provider emitted nullable optional fields',
      quality_profile: null,
      scope_ref: null,
      evidence: null,
      impact: null,
      severity_rationale: null,
      recommended_next_step: null,
      verification_path: null,
      proportional_remediation: null,
      file: null,
      line: null,
      lens: null,
    }],
  };
  const validation = validateResponse(openAiStyle, 'schema-assertion');
  if (!validation.ok) {
    failModernFindingSchema('provider null normalization fixture failed raw validation: ' + validation.error);
  }
  const normalized = normalizeProviderResponseForDurableOutput(openAiStyle);
  for (const field of [...MODERN_FINDING_FIELDS, 'file', 'line', 'lens']) {
    if (Object.prototype.hasOwnProperty.call(normalized.findings[0], field)) {
      failModernFindingSchema('provider null normalization retained ' + field);
    }
  }

  const mixedModernNulls = normalizeProviderResponseForDurableOutput({
    findings: [{
      id: 'F002',
      severity: 'MAJOR',
      confidence: 'HIGH',
      category: 'design-flaw',
      summary: 'Strict provider emitted modern marker with null required fields',
      quality_profile: 'modern',
      scope_ref: { kind: 'process', ref: 'aivv-step-5-output' },
      evidence: null,
      impact: null,
      severity_rationale: null,
      recommended_next_step: null,
      verification_path: null,
      proportional_remediation: null,
    }],
  });
  if (Object.prototype.hasOwnProperty.call(mixedModernNulls.findings[0], 'quality_profile')) {
    failModernFindingSchema('provider null normalization retained quality_profile on incomplete modern envelope');
  }

  const nestedNullExcerpt = normalizeProviderResponseForDurableOutput({
    findings: [{
      id: 'F003',
      severity: 'MAJOR',
      confidence: 'HIGH',
      category: 'design-flaw',
      summary: 'Strict provider emitted nested null excerpt',
      quality_profile: 'modern',
      scope_ref: { kind: 'process', ref: 'aivv-step-5-output' },
      evidence: [{ kind: 'internal-repo', ref: 'skills/aivv/SKILL.md', excerpt: null }],
      impact: 'Provider output must normalize to the durable schema.',
      severity_rationale: 'MAJOR because durable persistence would otherwise fail.',
      recommended_next_step: 'fix-now',
      verification_path: 'Run provider normalization assertion.',
      proportional_remediation: {
        present_problem: 'Strict provider output otherwise loses its modern profile.',
        simplest_viable_correction: 'Preserve a complete four-field proportionality object.',
        net_complexity: 'One nested object is retained with no runtime branch.',
        why_current_shape_insufficient: 'The existing fields do not express the complexity trade-off.',
      },
    }],
  });
  if (Object.prototype.hasOwnProperty.call(nestedNullExcerpt.findings[0].evidence[0], 'excerpt')) {
    failModernFindingSchema('provider null normalization retained nested evidence excerpt');
  }
  if (nestedNullExcerpt.findings[0].quality_profile !== 'modern') {
    failModernFindingSchema('provider null normalization stripped quality_profile from complete modern envelope');
  }

  const malformedEvidence = normalizeProviderResponseForDurableOutput({
    findings: [{
      id: 'F004',
      severity: 'MAJOR',
      confidence: 'HIGH',
      category: 'design-flaw',
      summary: 'Provider emitted malformed modern evidence',
      quality_profile: 'modern',
      scope_ref: { kind: 'process', ref: 'aivv-step-5-output' },
      evidence: ['repo-ref'],
      impact: 'Provider output must not retain modern markers on malformed evidence.',
      severity_rationale: 'MAJOR because durable persistence would otherwise keep invalid evidence.',
      recommended_next_step: 'fix-now',
      verification_path: 'Run provider normalization assertion.',
    }],
  });
  if (Object.prototype.hasOwnProperty.call(malformedEvidence.findings[0], 'quality_profile')) {
    failModernFindingSchema('provider null normalization retained quality_profile on malformed modern evidence');
  }
  if (malformedEvidence.findings[0].evidence[0] !== 'repo-ref') {
    failModernFindingSchema('provider null normalization rewrote malformed evidence item');
  }

  const groundedByNullExcerpt = normalizeProviderResponseForDurableOutput({
    findings: [{
      id: 'F005',
      severity: 'MAJOR',
      confidence: 'HIGH',
      category: 'design-flaw',
      summary: 'Strict provider emitted grounded_by null excerpt',
      grounded_by: [{ source_type: 'internal-repo', source_ref: 'skills/aivv/SKILL.md', excerpt: null }],
    }],
  });
  if (Object.prototype.hasOwnProperty.call(groundedByNullExcerpt.findings[0].grounded_by[0], 'excerpt')) {
    failModernFindingSchema('provider null normalization retained nested grounded_by excerpt');
  }
}

function assertModernFindingSchema() {
  const anthropicFindingSchema = ANTHROPIC_FINDINGS_TOOL.input_schema.properties.findings.items;
  const geminiFindingSchema = GEMINI_FINDINGS_SCHEMA.properties.findings.items;
  const openAiFindingSchema = OPENAI_FINDINGS_SCHEMA.properties.findings.items;

  assertModernFieldsPresent('Anthropic tool schema', anthropicFindingSchema);
  assertModernFieldsPresent('Gemini response schema', geminiFindingSchema);
  assertOpenAIStrictModernSchema(openAiFindingSchema);
  assertModernPromptStrings();
  assertProviderNullNormalization();

  process.stdout.write('[AIVV] Modern finding schema assertion OK: provider schemas (Anthropic, Gemini, OpenAI), direct prompt paths (Anthropic CLI, CLI suffix), packed prompt paths, null-normalization check.\n');
  process.exit(0);
}

function assertExtractJSON() {
  // Case 1: Strategy 1 — clean JSON, direct JSON.parse
  {
    const result = extractJSONFromOutput('{"id":"F001","severity":"MAJOR"}');
    if (result.id !== 'F001' || result.severity !== 'MAJOR') {
      throw new Error('assertExtractJSON case 1 failed: clean JSON not parsed correctly');
    }
  }
  // Case 2: Strategy 2 — JSON with preamble; depth-counting finds the first balanced block
  {
    const result = extractJSONFromOutput('Here is the result:\n{"id":"F002","severity":"MINOR"}');
    if (result.id !== 'F002') {
      throw new Error('assertExtractJSON case 2 failed: preamble JSON not extracted correctly');
    }
  }
  // Case 3: Strategy 3 — unbalanced { inside a string value; depth-counter gets confused;
  //          greedy first{…last} slice hands the full string to JSON.parse which handles it
  {
    const result = extractJSONFromOutput('Preamble text {"id":"F003","note":"has { inside string"} trailing');
    if (result.id !== 'F003') {
      throw new Error('assertExtractJSON case 3 failed: unbalanced brace inside string not handled');
    }
  }
  // Case 4: Two adjacent objects; Strategy 1 fails (two root-level objects), Strategy 2 picks
  //         the first balanced block — ordering invariant preserved
  {
    const result = extractJSONFromOutput('{"id":"F004"} {"id":"F005"}');
    if (result.id !== 'F004') {
      throw new Error('assertExtractJSON case 4 failed: first-object-selection ordering not preserved');
    }
  }
  // Case 5: U002 boundary — unbalanced { in string value AND trailing } in postamble;
  //         all three strategies fail — function must throw (documented limitation)
  {
    let threw = false;
    try { extractJSONFromOutput('{"id":"F006","note":"has { inside"} and postamble }'); }
    catch (_) { threw = true; }
    if (!threw) {
      throw new Error('assertExtractJSON case 5 failed: expected throw on unbalanced-string-brace + postamble-} but did not throw');
    }
  }
  process.stdout.write('[AIVV] extractJSONFromOutput assertion OK: 5 cases (clean, preamble, unbalanced-brace-in-string, two-adjacent-objects, postamble-boundary).\n');
  process.exit(0);
}

async function callGeminiCLI(prompt, timeoutSecs) {
  return new Promise((resolve, reject) => {
    const child = spawn('gemini', ['-p', CLI_JSON_SUFFIX, '-o', 'text'],
      { stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('gemini CLI timed out after ' + timeoutSecs + 's')); }, timeoutSecs * 1000);

    child.stdin.write(prompt);
    child.stdin.end();

    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) { reject(new Error('gemini CLI exited ' + code + ': ' + stderr.slice(0, 200))); return; }
      if (!stdout.trim()) { reject(new Error('gemini CLI empty output. stderr: ' + stderr.slice(0, 200))); return; }
      try { resolve(extractJSONFromOutput(stdout)); }
      catch (e) {
        const head = stdout.slice(0, 500);
        const tail = stdout.length > 500 ? '\n...(tail): ' + stdout.slice(-300) : '';
        reject(new Error('JSON parse failed: ' + e.message + '\nOutput (head): ' + head + tail));
      }
    });
  });
}

async function callAgyCLI(model, prompt, timeoutSecs) {
  return new Promise((resolve, reject) => {
    const cliArgs = ['--print', CLI_JSON_SUFFIX, '--print-timeout', `${timeoutSecs}s`];
    if (model) cliArgs.push('--model', model);
    const child = spawn('agy', cliArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('agy CLI timed out after ' + timeoutSecs + 's')); }, timeoutSecs * 1000);

    child.stdin.write(prompt);
    child.stdin.end();

    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) { reject(new Error('agy CLI exited ' + code + ': ' + stderr.slice(0, 200))); return; }
      if (!stdout.trim()) { reject(new Error('agy CLI empty output. stderr: ' + stderr.slice(0, 200))); return; }
      try { resolve(extractJSONFromOutput(stdout)); }
      catch (e) {
        const head = stdout.slice(0, 500);
        const tail = stdout.length > 500 ? '\n...(tail): ' + stdout.slice(-300) : '';
        reject(new Error('JSON parse failed: ' + e.message + '\nOutput (head): ' + head + tail));
      }
    });
  });
}

const GEMINI_FINDINGS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    findings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id:         { type: 'STRING' },
          severity:   { type: 'STRING' },
          confidence: { type: 'STRING' },
          category:   { type: 'STRING' },
          summary:    { type: 'STRING' },
          file:       { type: 'STRING' },
          line:       { type: 'INTEGER' },
          lens:       { type: 'STRING' },
          ...GEMINI_MODERN_FINDING_SCHEMA_PROPERTIES,
        },
        required: ['id', 'severity', 'confidence', 'category', 'summary'],
      },
    },
  },
  required: ['findings'],
};

async function callGeminiAPI(model, prompt, timeoutSecs, authToken) {
  const url = authToken
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;

  const ctrl = new AbortController();
  activeControllers.add(ctrl);
  const timer = setTimeout(() => ctrl.abort(), timeoutSecs * 1000);
  try {
    const res = await withRetry(async () => {
      const r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: ctrl.signal,
      });
      if (r.status === 401 || r.status === 403) {
        const e = new Error('Gemini auth failure HTTP ' + r.status); e.fatal = true; e.exitCode = 2; throw e;
      }
      if (r.status === 429 || r.status >= 500) throw new Error('Retryable HTTP ' + r.status);
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.fatal = true; throw e; }
      return r;
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No content in Gemini response');
    return JSON.parse(text);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Gemini request timed out after ' + timeoutSecs + 's');
    throw err;
  } finally {
    clearTimeout(timer);
    activeControllers.delete(ctrl);
  }
}

async function probeGemini() {
  if (args.authMode !== 'api_key' && await isAgyCLIAvailable()) {
    process.stdout.write('[AIVV] Gemini probe OK via agy CLI (Google Antigravity version check only — dispatch may still fail if unauthenticated or quota-limited).\n');
    process.exit(0);
  }
  if (args.authMode !== 'api_key' && await isGeminiCLIAvailable()) {
    process.stdout.write('[AIVV] Gemini probe OK via legacy gemini CLI (version check only — dispatch may still fail if unauthenticated or quota-limited).\n');
    process.exit(0);
  }
  if (args.authMode === 'cli') {
    process.stderr.write('[AIVV] No Gemini CLI auth found in --auth-mode=cli; not falling back to GEMINI_API_KEY. Install/authenticate `agy` or run `gemini auth login` while available.\n');
    process.exit(3);
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key || !key.trim()) {
    if (args.authMode === 'auto') {
      process.stderr.write(
        '[AIVV] No Gemini auth found.\n' +
        '[AIVV] Auth options:\n' +
        '[AIVV]   1. CLI OAuth: install/authenticate Google Antigravity CLI (`agy`) or run `gemini auth login` while legacy Gemini CLI remains available\n' +
        '[AIVV]   2. API key (--auth-mode api_key): set GEMINI_API_KEY — get at https://aistudio.google.com/apikey\n'
      );
      process.exit(3);
    }
    process.stderr.write('[AIVV] Missing GEMINI_API_KEY. Get at: https://aistudio.google.com/apikey\n');
    process.exit(1);
  }
  // Probe via REST API key
  const ctrl = new AbortController();
  activeControllers.add(ctrl);
  setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, { signal: ctrl.signal });
    activeControllers.delete(ctrl);
    if (res.status === 401 || res.status === 403) { process.stderr.write('[AIVV] Gemini auth failure HTTP ' + res.status + '\n'); process.exit(2); }
    if (!res.ok) { process.stderr.write('[AIVV] Gemini probe failed HTTP ' + res.status + '\n'); process.exit(9); }
    const data = await res.json();
    const ids = (data.models || []).map(m => m.name.replace('models/', '')).slice(0, 4).join(', ');
    process.stdout.write('[AIVV] Gemini probe OK (API key). Models: ' + ids + '\n');
    process.exit(0);
  } catch (err) {
    activeControllers.delete(ctrl);
    if (err.name === 'AbortError') { process.stderr.write('[AIVV] Gemini probe timed out\n'); process.exit(9); }
    process.stderr.write('[AIVV] Gemini probe error: ' + providerDiagnostic(err.message) + '\n'); process.exit(9);
  }
}

async function callGemini(model, prompt, timeoutSecs) {
  if (args.authMode !== 'api_key' && await isAgyCLIAvailable()) {
    try {
      return await callAgyCLI(model, prompt, timeoutSecs);
    } catch (cliErr) {
      const fallback = args.authMode === 'cli' ? 'legacy gemini CLI...' : 'legacy gemini CLI or GEMINI_API_KEY...';
      process.stderr.write('[AIVV] agy CLI failed: ' + providerDiagnostic(cliErr.message, 500) + '\n[AIVV] Falling back to ' + fallback + '\n');
    }
  }
  if (args.authMode !== 'api_key' && await isGeminiCLIAvailable()) {
    try {
      return await callGeminiCLI(prompt, timeoutSecs);
    } catch (cliErr) {
      if (args.authMode === 'cli') {
        process.stderr.write('[AIVV] legacy gemini CLI failed: ' + providerDiagnostic(cliErr.message, 500) + '\n[AIVV] Gemini CLI-only mode exhausted; not falling back to GEMINI_API_KEY.\n');
      } else {
        process.stderr.write('[AIVV] legacy gemini CLI failed: ' + providerDiagnostic(cliErr.message, 500) + '\n[AIVV] Falling back to GEMINI_API_KEY...\n');
      }
    }
  }
  if (args.authMode === 'cli') {
    const e = new Error('No Gemini CLI auth. agy/gemini CLI unavailable or failed in --auth-mode=cli; not falling back to GEMINI_API_KEY. Install/authenticate `agy` or run `gemini auth login` while available.');
    e.fatal = true;
    e.exitCode = 3;
    throw e;
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key || !key.trim()) {
    if (args.authMode === 'auto') {
      const e = new Error('No Gemini auth. agy/gemini CLI failed and GEMINI_API_KEY not set. Install/authenticate `agy`, run `gemini auth login` while available, or set GEMINI_API_KEY.'); e.fatal = true; e.exitCode = 3; throw e;
    }
    const e = new Error('Missing GEMINI_API_KEY. Get at: https://aistudio.google.com/apikey'); e.fatal = true; e.exitCode = 1; throw e;
  }
  return await callGeminiAPI(model, prompt, timeoutSecs, null);
}

// ── OpenAI provider ───────────────────────────────────────────────────────
// Auth (auto): codex CLI subprocess (OAuth, no API key needed) → OPENAI_API_KEY
// Setup (no API key): run `codex auth`
// Note: ~/.codex/auth.json access_token is ChatGPT OAuth (aud: api.openai.com/v1)
// but the token is rejected by api.openai.com/v1/chat/completions with 401.
// codex exec CLI handles its own auth internally — that is the correct OAuth path.

// Probe scope: checks `codex --version` exit code only. Does NOT smoke-test
// the actual dispatch path. On hosts where the codex binary exists but auth
// is restricted (sandbox-denied, no OAuth session, expired token), this probe
// returns true while `codex exec` later fails with non-zero exit + stderr like
// "failed to initialize in-process app-server client: Operation not permitted".
// The user-visible "OpenAI probe OK" message reflects this scope honestly per
// cycle-4 F001 (2026-05-22). The dispatch.mjs fallback chain (codex CLI →
// OPENAI_API_KEY → callOpenAIAPI) handles the actual dispatch failure path; a
// smoke-test here would add ~3-5s latency to every /aivv invocation for what
// is a rare failure mode. v0.2+ may revisit if probe-vs-dispatch asymmetry
// surfaces as a recurring class.
async function isCodexCLIAvailable() {
  return new Promise(resolve => {
    const child = spawn('codex', ['--version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
  });
}

// codex exec is agentic: stdout is a streaming trace (banner + tool-call traces
// + final assistant message). Previous implementation captured ALL stdout and
// scanned for JSON via depth-counting — fragile under truncation when token
// budget was consumed by agentic exploration, leaving the final findings JSON
// cut off mid-emission (extractJSONFromOutput threw "No complete JSON object").
//
// Fix per cycle-3 F-C1 diagnostic (2026-05-22): use codex's native
// --output-last-message writes ONLY the final assistant message to a file,
// bypassing the agentic-trace mess on stdout. AIVV envelope validation stays
// centralized in validateResponse() and the shared retry block.
async function callCodexCLI(prompt, timeoutSecs) {
  const tmp = mkdtempSync(join(tmpdir(), 'aivv-codex-'));
  const responseFile = join(tmp, 'response.txt');

  const cleanup = () => {
    for (const f of [responseFile]) {
      try { unlinkSync(f); } catch (_) {}
    }
    try { rmdirSync(tmp); } catch (_) {}
  };

  const cliArgs = ['exec', '--output-last-message', responseFile, '-'];
  return new Promise((resolve, reject) => {
    const child = spawn('codex', cliArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill('SIGTERM'); cleanup(); reject(new Error('codex exec timed out after ' + timeoutSecs + 's')); }, timeoutSecs * 1000);

    child.stdin.write(prompt + CLI_JSON_SUFFIX);
    child.stdin.end();

    let stderr = '';
    // stdout is the agentic trace — drain but ignore.
    child.stdout.on('data', () => {});
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => { clearTimeout(timer); cleanup(); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) { cleanup(); reject(new Error('codex exec exited ' + code + ': ' + stderr.slice(0, 200))); return; }
      let lastMessage;
      try { lastMessage = readFileSync(responseFile, 'utf8'); }
      catch (e) { cleanup(); reject(new Error('codex exec did not write --output-last-message file: ' + e.message)); return; }
      cleanup();
      if (!lastMessage.trim()) { reject(new Error('codex exec last-message file empty (likely truncated mid-response)')); return; }
      try { resolve(extractJSONFromOutput(lastMessage)); }
      catch (e) {
        reject(new Error('JSON parse failed from codex exec last-message output: ' + e.message + '\nLast message: ' + lastMessage.slice(0, 300)));
      }
    });
  });
}

// OpenAI strict-mode JSON Schema requires every property to be in `required`
// AND every nested object to have an explicit `type` key. Optional fields are
// expressed via nullable union types (`["string", "null"]`). This schema remains
// as an assertion fixture for modern finding shape; provider adapters do not use
// it to enforce the AIVV envelope before shared validation/retry.
//
// Canonical grounded_by item shape derived from `.aivv/schemas/finding.json`.
const OPENAI_FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'severity', 'confidence', 'category', 'summary', 'value', 'effort', 'file', 'line', 'lens', 'rule_id', 'grounded_by', 'quality_profile', 'scope_ref', 'evidence', 'impact', 'severity_rationale', 'recommended_next_step', 'verification_path', 'proportional_remediation'],
        additionalProperties: false,
        properties: {
          id:         { type: 'string' },
          severity:   { type: 'string', enum: ['CRITICAL', 'MAJOR', 'MINOR', 'POLISH'] },
          confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          category:   { type: 'string', enum: CATEGORY_ENUM_VALUES },
          summary:    { type: 'string' },
          value:      { type: ['string', 'null'], enum: [...IMPROVEMENT_VALUE_ENUM, null] },
          effort:     { type: ['string', 'null'], enum: [...IMPROVEMENT_EFFORT_ENUM, null] },
          file:       { type: ['string', 'null'] },
          line:       { type: ['integer', 'null'] },
          lens:       { type: ['string', 'null'] },
          rule_id:    { type: ['string', 'null'] },
          grounded_by: {
            type: 'array',
            items: {
              type: 'object',
              required: ['source_type', 'source_ref', 'excerpt'],
              additionalProperties: false,
              properties: {
                source_type: { type: 'string', enum: ['websearch', 'webfetch', 'context7', 'runtime', 'unverified', 'unverifiable', 'internal-repo'] },
                source_ref:  { type: 'string' },
                excerpt:     { type: ['string', 'null'] },
              },
            },
          },
          quality_profile: { type: ['string', 'null'], enum: ['modern', null] },
          scope_ref: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['kind', 'ref'],
            properties: {
              kind: { type: 'string', enum: ['process', 'session', 'artifact', 'user-journey', 'project'] },
              ref: { type: 'string' },
            },
          },
          evidence: {
            type: ['array', 'null'],
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'ref', 'excerpt'],
              properties: {
                kind: { type: 'string', enum: ['internal-repo', 'websearch', 'webfetch', 'runtime', 'command', 'state-log', 'thread', 'unverified', 'unverifiable'] },
                ref: { type: 'string' },
                excerpt: { type: ['string', 'null'] },
              },
            },
          },
          impact: { type: ['string', 'null'] },
          severity_rationale: { type: ['string', 'null'] },
          recommended_next_step: { type: ['string', 'null'], enum: ['fix-now', 'investigate-first', 'document', 'defer-with-rationale', 'accept-risk', null] },
          verification_path: { type: ['string', 'null'] },
          proportional_remediation: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['present_problem', 'simplest_viable_correction', 'net_complexity', 'why_current_shape_insufficient'],
            properties: {
              present_problem: { type: 'string' },
              simplest_viable_correction: { type: 'string' },
              net_complexity: { type: 'string' },
              why_current_shape_insufficient: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

async function callOpenAIAPI(model, prompt, timeoutSecs, bearerToken) {
  const ctrl = new AbortController();
  activeControllers.add(ctrl);
  const timer = setTimeout(() => ctrl.abort(), timeoutSecs * 1000);
  try {
    const res = await withRetry(async () => {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + bearerToken },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: ctrl.signal,
      });
      if (r.status === 401) { const e = new Error('OpenAI auth failure HTTP 401'); e.fatal = true; e.exitCode = 2; throw e; }
      if (r.status === 429 || r.status >= 500) throw new Error('Retryable HTTP ' + r.status);
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.fatal = true; throw e; }
      return r;
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('No content in OpenAI response');
    return JSON.parse(text);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('OpenAI request timed out after ' + timeoutSecs + 's');
    throw err;
  } finally {
    clearTimeout(timer);
    activeControllers.delete(ctrl);
  }
}

async function probeOpenAI() {
  if (args.authMode !== 'api_key' && await isCodexCLIAvailable()) {
    process.stdout.write('[AIVV] OpenAI probe OK via codex CLI (version check only — dispatch may still fail on auth-restricted hosts; see dispatch.mjs isCodexCLIAvailable for scope).\n');
    process.exit(0);
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.trim()) {
    if (args.authMode === 'auto') {
      process.stderr.write(
        '[AIVV] No OpenAI auth found.\n' +
        '[AIVV] Auth options:\n' +
        '[AIVV]   1. CLI OAuth: run `codex auth` (no API key needed)\n' +
        '[AIVV]   2. API key (--auth-mode api_key): set OPENAI_API_KEY\n'
      );
      process.exit(3);
    }
    process.stderr.write('[AIVV] Missing OPENAI_API_KEY. Set env var or run `codex auth`.\n');
    process.exit(1);
  }
  // Probe via REST API key
  const ctrl = new AbortController();
  activeControllers.add(ctrl);
  setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': 'Bearer ' + key },
      signal: ctrl.signal,
    });
    activeControllers.delete(ctrl);
    if (res.status === 401) { process.stderr.write('[AIVV] OpenAI auth failure HTTP 401\n'); process.exit(2); }
    if (!res.ok) { process.stderr.write('[AIVV] OpenAI probe failed HTTP ' + res.status + '\n'); process.exit(9); }
    const data = await res.json();
    const ids = (data.data || []).filter(m => m.id.startsWith('gpt')).slice(0, 3).map(m => m.id).join(', ');
    process.stdout.write('[AIVV] OpenAI probe OK (API key). Models: ' + ids + '\n');
    process.exit(0);
  } catch (err) {
    activeControllers.delete(ctrl);
    if (err.name === 'AbortError') { process.stderr.write('[AIVV] OpenAI probe timed out\n'); process.exit(9); }
    process.stderr.write('[AIVV] OpenAI probe error: ' + providerDiagnostic(err.message) + '\n'); process.exit(9);
  }
}

async function callOpenAI(model, prompt, timeoutSecs) {
  if (args.authMode !== 'api_key' && await isCodexCLIAvailable()) {
    try {
      return await callCodexCLI(prompt, timeoutSecs);
    } catch (cliErr) {
      process.stderr.write('[AIVV] codex CLI failed: ' + providerDiagnostic(cliErr.message, 500) + '\n[AIVV] Falling back to OPENAI_API_KEY...\n');
    }
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.trim()) {
    if (args.authMode === 'auto') {
      const e = new Error('No OpenAI auth. codex CLI failed and OPENAI_API_KEY not set. Run `codex auth` or set OPENAI_API_KEY.'); e.fatal = true; e.exitCode = 3; throw e;
    }
    const e = new Error('Missing OPENAI_API_KEY. Set env var or run `codex auth`.'); e.fatal = true; e.exitCode = 1; throw e;
  }
  return await callOpenAIAPI(model, prompt, timeoutSecs, key);
}

// Provider adapter contract:
// - provider.call parses transport output into a candidate JSON value.
// - provider.call may throw transport/auth/quota/timeout/local-spawn errors.
// - provider.call must not enforce the AIVV findings envelope; validateResponse()
//   and the shared retry block own schema validation and repair.

// ── Provider dispatch table ───────────────────────────────────────────────
const PROVIDERS = {
  anthropic: { probe: probeAnthropic, call: callAnthropic },
  gemini:    { probe: probeGemini,    call: callGemini },
  openai:    { probe: probeOpenAI,    call: callOpenAI },
};

// ── Main entry ────────────────────────────────────────────────────────────
async function main() {
  if (args.assertPromptPack) {
    assertPromptPack();
    return;
  }
  if (args.assertModernFindingSchema) {
    assertModernFindingSchema();
    return;
  }
  if (args.assertExtractJSON) {
    assertExtractJSON();
    return;
  }

  if (!args.provider) {
    process.stderr.write('[AIVV] --provider is required\n');
    process.exit(4);
  }
  const provider = PROVIDERS[args.provider];
  if (!provider) {
    process.stderr.write('[AIVV] Unknown provider: ' + args.provider + '. Supported: ' + Object.keys(PROVIDERS).join(', ') + '\n');
    process.exit(4);
  }

  if (args.probe) {
    const disclosure = buildProviderDisclosure({
      prompt: '',
      consented: args.providerEgressConsent,
    });
    disclosure.evidence_classes = disclosure.evidence_classes.length ? disclosure.evidence_classes : ['provider-probe'];
    if (!args.providerEgressConsent) {
      process.stderr.write('[AIVV] PROVIDER_EGRESS_CONSENT_REQUIRED: refusing to probe provider ' + args.provider + '. Pass --provider-egress-consent after reviewing the disclosure.\n');
      process.stderr.write('[AIVV DISCLOSURE] ' + JSON.stringify(disclosure) + '\n');
      process.exit(9);
    }
    await provider.probe();
    return;
  }

  // Dispatch path
  if (!args.model) {
    process.stderr.write('[AIVV] --model is required for dispatch\n');
    process.exit(4);
  }

  const startMs = Date.now();
  const coldPrompt = await readStdin();
  if (!coldPrompt.trim()) {
    process.stderr.write('[AIVV] Empty prompt received on stdin\n');
    process.exit(9);
  }
  const providerPrompt = buildProviderPromptPack(coldPrompt);
  enforceProviderPromptLimit(providerPrompt);
  const disclosure = buildProviderDisclosure({
    prompt: providerPrompt,
    consented: args.providerEgressConsent,
  });
  const trustDecision = assessProviderTrust({
    root: AIVV_ROOT,
    provider: args.provider,
    model: args.model,
    authMode: args.authMode,
    destinationShape: disclosure.destination_shape,
    evidenceClasses: args.evidenceClasses,
    sourceList: disclosure.source_list,
    prompt: providerPrompt,
  });
  const providerTrust = trustDecision.report;
  const trustedProviderPrompt = trustDecision.prompt;
  disclosure.prompt_sha256 = sha256Text(trustedProviderPrompt);
  disclosure.prompt_bytes = Buffer.byteLength(trustedProviderPrompt, 'utf8');
  providerTrust.prompt_sha256 = disclosure.prompt_sha256;
  providerTrust.prompt_bytes = disclosure.prompt_bytes;

  if (args.renderPromptOnly) {
    process.stdout.write(JSON.stringify({
      status: 'prompt-rendered',
      ...disclosure,
      provider_trust: providerTrust,
      prompt: trustedProviderPrompt,
    }, null, 2) + '\n');
    return;
  }

  if (!args.providerEgressConsent) {
    process.stderr.write('[AIVV] PROVIDER_EGRESS_CONSENT_REQUIRED: refusing to invoke provider ' + args.provider + '. Re-run with --render-prompt-only to inspect prompt metadata, or pass --provider-egress-consent after reviewing the disclosure.\n');
    process.stderr.write('[AIVV DISCLOSURE] ' + JSON.stringify(disclosure) + '\n');
    process.exit(9);
  }

  if (!providerTrust.allowed) {
    printProviderTrustBlock(providerTrust);
    process.exit(9);
  }

  for (const warning of providerTrust.warnings) {
    if (warning.code === 'PROVIDER_TRUST_CHANGED') {
      process.stderr.write('[AIVV] PROVIDER_TRUST_CHANGED: provider/auth/evidence trust signature changed since last approved dispatch.\n');
    }
  }

  let rawResponse = null;
  let retried = false;

  try {
    if (args.authMode === 'test') {
      try {
        rawResponse = JSON.parse(process.env.AIVV_TEST_PROVIDER_RESPONSE || '{"findings":[]}');
      } catch (parseErr) {
        parseErr.failureClass = 'parse';
        throw parseErr;
      }
    } else {
      rawResponse = await provider.call(args.model, trustedProviderPrompt, args.timeout);
    }
  } catch (err) {
    process.stderr.write('[AIVV] Dispatch failed: ' + providerDiagnostic(err.message) + '\n');
    if (err.fatal) {
      emitFailureMeta({
        provider: args.provider,
        model: args.model,
        reviewerId: args.reviewerId,
        message: err.message,
        exitCode: err.exitCode || 9,
        failureClass: err.failureClass,
      });
      process.exit(err.exitCode || 9);
    }
    emitFailureMeta({
      provider: args.provider,
      model: args.model,
      reviewerId: args.reviewerId,
      message: err.message,
      exitCode: 9,
      failureClass: err.failureClass,
    });
    process.exit(9);
  }

  const validation = validateResponse(rawResponse, args.reviewerId);
  if (!validation.ok) {
    // Retry once with schema feedback. Retry responses that still fail the AIVV
    // envelope, and provider transport/parse failures during retry, emit
    // centralized failure metadata.
    if (!retried) {
      retried = true;
      process.stderr.write('[AIVV] Schema validation failed: ' + providerDiagnostic(validation.error) + '\nRetrying with error feedback...\n');
      try {
        const retryPrompt = 'Previous response failed schema validation:\n' + providerDiagnostic(validation.error) + '\n\nPlease correct and re-emit.\n\n' + trustedProviderPrompt;
        if (args.authMode === 'test') {
          try {
            rawResponse = JSON.parse(process.env.AIVV_TEST_PROVIDER_RETRY_RESPONSE || '{"findings":[]}');
          } catch (parseErr) {
            parseErr.failureClass = 'parse';
            throw parseErr;
          }
        } else {
          rawResponse = await provider.call(args.model, retryPrompt, args.timeout);
        }
        const v2 = validateResponse(rawResponse, args.reviewerId);
        if (!v2.ok) {
          emitFailureMeta({
            provider: args.provider,
            model: args.model,
            reviewerId: args.reviewerId,
            message: 'Schema validation failed after retry: ' + v2.error + '\nRetry response: ' + JSON.stringify(rawResponse),
            exitCode: 9,
            failureClass: 'parse',
          });
          process.exit(9);
        }
      } catch (err3) {
        emitFailureMeta({
          provider: args.provider,
          model: args.model,
          reviewerId: args.reviewerId,
          message: err3.message,
          exitCode: err3.exitCode || 9,
          failureClass: err3.failureClass,
        });
        process.exit(err3.exitCode || 9);
      }
    }
    // Note: the else branch (retried already true when validation fails) is unreachable
    // because retried is only set inside this if (!retried) block. Removed dead code (see review I-3).
  }

  const durableResponse = normalizeProviderResponseForDurableOutput(rawResponse);
  const durationMs = Date.now() - startMs;
  writeProviderTrustMemory(providerTrust);
  // Create log entry with hashed prompt/response (never log content verbatim)
  const logEntry = await makeLogEntry({
    timestamp: new Date().toISOString(),
    reviewer_id: args.reviewerId,
    provider: args.provider,
    model: args.model,
    duration_ms: durationMs,
    finding_count: durableResponse.findings.length,
    exit_code: 0,
    provider_egress: disclosure,
    provider_trust: providerTrust,
    _prompt: trustedProviderPrompt,
    _response: JSON.stringify(durableResponse),
  });
  process.stderr.write('[AIVV LOG] ' + JSON.stringify(logEntry) + '\n');
  // Emit each finding as a NDJSON line
  for (const finding of durableResponse.findings) {
    emitNDJSON(finding);
  }
  // Emit terminal metadata record
  emitNDJSON({
    _meta: true,
    reviewer_id: args.reviewerId,
    provider: args.provider,
    model: args.model,
    finding_count: durableResponse.findings.length,
    duration_ms: durationMs,
    provider_egress: disclosure,
    provider_trust: providerTrust,
    retried,
    status: 'complete',
  });
}

main().catch(err => {
  process.stderr.write('[AIVV] Unhandled error: ' + providerDiagnostic(err.message) + '\n');
  process.exit(9);
});
