#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessProviderTrust } from './provider-trust.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
// Dual-path root: in the AIVV dev checkout this script lives at <repo>/plugin/tools/, and
// review targets/requests (docs/, tools/tests/ fixtures) resolve against the REPO root —
// detected via the marketplace manifest at the ship root's parent. In an installed payload
// (plugin copy, Codex aivv-runtime bundle) no such parent manifest exists and the root is
// the ship root itself (the parent of this tools/ directory).
const SHIP_ROOT = resolve(SCRIPT_DIR, '..');
const ROOT = existsSync(join(SHIP_ROOT, '..', '.claude-plugin', 'marketplace.json'))
  ? resolve(SHIP_ROOT, '..')
  : SHIP_ROOT;

// Provider prompt parity depends on this list. Any methodology reference split
// that is required for reviewer behavior must be added here before the split
// lands; tools/tests/run.sh asserts these entries without caller-supplied
// --require-source so the test cannot mask drift in this source-of-truth list.
const REQUIRED_SOURCES = [
  '.aivv/prompts/reviewer-role.md',
  'skills/aivv/SKILL.md',
  'skills/methodology/SKILL.md',
  'skills/methodology/references/review-phases.md',
  'skills/methodology/references/severity-confidence.md',
  'skills/methodology/references/source-grounding.md',
  'skills/methodology/references/runtime-visual-verification.md',
  'skills/methodology/references/standards-lookup.md',
  'skills/methodology/references/general-review-checklist.md',
  '.aivv/methodology.md',
  'skills/aivv/references/reviewer-prompt-template.md',
];

// Subset of REQUIRED_SOURCES whose file bodies must be embedded in provider
// prompts. Keep this reviewer-facing: provider-backed reviewers need the role,
// prompt contract, and operational methodology, but not the full slash-command
// orchestrator or supplementary repo-local methodology reference.
const MANDATORY_EMBEDDED_SOURCES = [
  'skills/aivv/references/reviewer-prompt-template.md',
  'skills/methodology/references/review-phases.md',
  'skills/methodology/references/severity-confidence.md',
  'skills/methodology/references/source-grounding.md',
  'skills/methodology/references/runtime-visual-verification.md',
  'skills/methodology/references/standards-lookup.md',
  'skills/methodology/references/general-review-checklist.md',
];

const EVIDENCE_CLASSES = 'target-file,session-context,methodology-docs,role-docs,prompt-template';
const SUBJECT_TYPES = new Set(['session', 'file', 'idea', 'project', 'artifact', 'user-journey', 'plan']);
const MAX_PROMPT_BYTES = Number.parseInt(process.env.AIVV_PROMPT_BUNDLE_MAX_BYTES || String(2 * 1024 * 1024), 10);

const PROVIDER_COMMAND_SOURCES = {
  anthropic: 'skills/aivv/references/non-native-provider-commands/claude.json',
  openai: 'skills/aivv/references/non-native-provider-commands/codex.json',
  gemini: 'skills/aivv/references/non-native-provider-commands/gemini.json',
};

const PROVIDER_ADAPTER_SOURCES = {
  anthropic: '.aivv/platform-adapters/anthropic.md',
  openai: '.aivv/platform-adapters/openai.md',
  gemini: '.aivv/platform-adapters/gemini.md',
};

function assertMandatoryEmbeddedSourcesAreRequired() {
  const required = new Set(REQUIRED_SOURCES);
  const missing = MANDATORY_EMBEDDED_SOURCES.filter(source => !required.has(source));
  if (missing.length > 0) {
    process.stderr.write('[AIVV] PROMPT_BUNDLE_REQUIRED_SOURCE_DRIFT: mandatory embedded source missing from REQUIRED_SOURCES: ' + missing.join(', ') + '\n');
    process.exit(9);
  }
}

assertMandatoryEmbeddedSourcesAreRequired();

function parseArgs(argv) {
  const args = {
    renderPromptOnly: false,
    providerEgressConsent: false,
    provider: null,
    model: null,
    request: null,
    requireSource: [],
    timeout: '180',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--render-prompt-only') args.renderPromptOnly = true;
    else if (arg === '--provider-egress-consent') args.providerEgressConsent = true;
    else if (arg === '--provider') args.provider = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--request') args.request = argv[++i];
    else if (arg === '--require-source') args.requireSource.push(argv[++i]);
    else if (arg === '--timeout') args.timeout = argv[++i];
    else {
      process.stderr.write('[AIVV] unknown arg: ' + arg + '\n');
      process.exit(4);
    }
  }
  return args;
}

function readRequired(relPath) {
  const source = relPathInsideRoot(relPath, 'source');
  return readFileSync(source.absPath, 'utf8');
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    process.stderr.write('[AIVV] REQUEST_PARSE_FAILED: ' + err.message + '\n');
    process.exit(9);
  }
}

function relPathInsideRoot(inputPath, label) {
  let absPath = isAbsolute(inputPath) ? resolve(inputPath) : resolve(ROOT, inputPath);
  const logicalRelPath = isAbsolute(inputPath) ? null : inputPath.replace(/^\.\//, '');
  if (!existsSync(absPath) && logicalRelPath && (
    logicalRelPath.startsWith('.aivv/') ||
    logicalRelPath.startsWith('skills/') ||
    logicalRelPath.startsWith('agents/')
  )) {
    absPath = resolve(ROOT, 'plugin', logicalRelPath);
  }
  if (!existsSync(absPath)) {
    process.stderr.write('[AIVV] PROMPT_BUNDLE_SOURCE_MISSING: ' + label + ' ' + inputPath + '\n');
    process.exit(9);
  }
  const realRoot = realpathSync.native(ROOT);
  const realPath = realpathSync.native(absPath);
  const realRelPath = relative(realRoot, realPath);
  if (!realRelPath || realRelPath.startsWith('..') || isAbsolute(realRelPath)) {
    process.stderr.write('[AIVV] PROMPT_BUNDLE_SOURCE_OUTSIDE_ROOT: ' + label + ' ' + inputPath + '\n');
    process.exit(9);
  }
  const relPath = logicalRelPath || relative(ROOT, absPath);
  if (!relPath || relPath.startsWith('..') || isAbsolute(relPath)) {
    process.stderr.write('[AIVV] PROMPT_BUNDLE_SOURCE_OUTSIDE_ROOT: ' + label + ' ' + inputPath + '\n');
    process.exit(9);
  }
  return { absPath, relPath };
}

// Caller-supplied path resolver — used for args.request and req.target_file, whose canonical
// residence for a real external-project review is OUTSIDE the AIVV plugin/runtime install root.
// Distinct contract from relPathInsideRoot() above: no plugin-root-prefix requirement and no
// .aivv/skills/agents dev-checkout fallback — those only make sense for plugin-authored sources.
// Existence is still required (fail-closed as PROMPT_BUNDLE_SOURCE_MISSING); realpath normalizes
// symlinks, since the caller-supplied path is trusted to point wherever the caller (a locally
// running review the user asked for) already has read access, not confined to a fixed tree.
// Relative inputs resolve against `base` (the caller's declared working directory when known,
// else process.cwd()) rather than ROOT. The returned relPath is display-friendly: computed
// against `base` when the resolved path is under it, else the absolute realpath. Plugin-authored
// fixed sources (REQUIRED_SOURCES / MANDATORY_EMBEDDED_SOURCES / lens files / provider
// adapter+command docs) continue to route through the unmodified relPathInsideRoot() via
// readRequired() — this helper never touches that boundary.
function resolveCallerSuppliedPath(inputPath, label, base) {
  const resolvedBase = base || process.cwd();
  const absPath = isAbsolute(inputPath) ? resolve(inputPath) : resolve(resolvedBase, inputPath);
  if (!existsSync(absPath)) {
    process.stderr.write('[AIVV] PROMPT_BUNDLE_SOURCE_MISSING: ' + label + ' ' + inputPath + '\n');
    process.exit(9);
  }
  const realPath = realpathSync.native(absPath);
  const realBase = existsSync(resolvedBase) ? realpathSync.native(resolvedBase) : null;
  let relPath = realBase ? relative(realBase, realPath) : realPath;
  if (!relPath || relPath.startsWith('..') || isAbsolute(relPath)) {
    relPath = realPath;
  }
  return { absPath: realPath, relPath };
}

function arrayLines(values) {
  if (!Array.isArray(values) || values.length === 0) return '- none surfaced after scan';
  return values.map(value => '- ' + value).join('\n');
}

function xmlAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function promptDelimiter(label) {
  return 'AIVV_UNTRUSTED_' + label + '_' + randomBytes(12).toString('hex');
}

function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return { body: text.trim(), description: '' };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { body: text.trim(), description: '' };
  const frontmatter = text.slice(4, end);
  const body = text.slice(end + 5).trim();
  const description = (frontmatter.match(/^description:\s*(.+)$/m) || [])[1] || '';
  return { body, description: description.replace(/^["']|["']$/g, '') };
}

function lensSourceFor(lens) {
  if (!lens) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(lens)) {
    process.stderr.write('[AIVV] REQUEST_INVALID: lens must be a shipped lens name, not a path\n');
    process.exit(9);
  }
  return `.aivv/lenses/${lens}.md`;
}

function sourceBodyBlocks(sourceTexts, sources) {
  return sources.flatMap(source => {
    if (!sourceTexts[source]) return [];
    return [
      `Source: ${source}`,
      '',
      sourceTexts[source].trim(),
      '',
    ];
  });
}

function validateRequest(req) {
  if (!req || typeof req !== 'object') {
    process.stderr.write('[AIVV] REQUEST_INVALID: request must be a JSON object\n');
    process.exit(9);
  }
  if (typeof req.target_file !== 'string' || !req.target_file.trim()) {
    process.stderr.write('[AIVV] REQUEST_INVALID: target_file is required\n');
    process.exit(9);
  }
}

function reviewApproachFor(scope) {
  if (typeof scope.approach === 'string' && scope.approach.trim()) return scope.approach;
  if (typeof scope.strategy === 'string' && scope.strategy.trim()) return scope.strategy;
  return '';
}

function hasConfirmedScope(req) {
  const scope = req.review_scope;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return false;
  return SUBJECT_TYPES.has(scope.subject_type) && scope.confirmed === true &&
    typeof scope.final_scope === 'string' && Boolean(scope.final_scope.trim()) &&
    Boolean(reviewApproachFor(scope));
}

function buildColdPrompt(req, sourceTexts, sourceList, target) {
  validateRequest(req);
  const targetAbs = target.absPath;
  if (!existsSync(targetAbs)) {
    process.stderr.write('[AIVV] REQUEST_TARGET_MISSING: ' + req.target_file + '\n');
    process.exit(9);
  }

  const targetContent = readFileSync(targetAbs, 'utf8');
  const providerCommandSource = PROVIDER_COMMAND_SOURCES[req.provider || sourceTexts.__provider] || null;
  const sessionTag = promptDelimiter('SESSION_CONTEXT');
  const targetTag = promptDelimiter('TARGET_ARTIFACT');
  const requestTag = promptDelimiter('REVIEW_REQUEST');
  const sc = req.session_context || {};
  const reviewerLabel = req.reviewer_label || 'alpha';
  const reviewMode = req.review_mode || 'cold_multi_model';
  const lens = req.lens || 'general';
  const thoroughness = req.thoroughness || 'balanced';
  // Optional additive request contract: review_scope may carry the caller's
  // subject, final scope, approach, and confirmation status. Its text stays
  // inside a nonce-delimited untrusted block; absence never implies confirmation.
  const reviewScope = req.review_scope && typeof req.review_scope === 'object' && !Array.isArray(req.review_scope)
    ? req.review_scope
    : {};
  const subjectType = SUBJECT_TYPES.has(reviewScope.subject_type)
    ? reviewScope.subject_type
    : 'session';
  const finalScope = typeof reviewScope.final_scope === 'string' && reviewScope.final_scope.trim()
    ? reviewScope.final_scope
    : '';
  const scopeConfirmed = hasConfirmedScope(req);
  const scopeConfirmationStatus = scopeConfirmed
    ? 'confirmed by caller'
    : (reviewScope.confirmed === true ? 'incomplete' : (finalScope ? 'not confirmed' : 'not supplied'));
  const reviewApproach = reviewApproachFor(reviewScope);
  const scopeTag = promptDelimiter('REVIEW_SCOPE');
  const artifactPrimary = subjectType !== 'session';
  const artifactHeading = subjectType === 'plan'
    ? '## Plan Under Review (PRIMARY - forward-looking)'
    : '## Supplied Artifact (' + (artifactPrimary ? 'PRIMARY - this is the review subject' : 'SUPPORTING EVIDENCE - not the review subject') + ')';
  // Direction posture toggle. Default ON after the R19 maintainer-review gate passed;
  // callers can still pin the pre-feature behavior with false/off.
  const direction = (req.direction === false || req.direction === 'off') ? 'off' : 'on';
  const projectContext = req.project_context && typeof req.project_context === 'object'
    ? JSON.stringify(req.project_context)
    : 'undeclared';
  const severityCellMap = req.severity_cell_map && typeof req.severity_cell_map === 'object' && Object.keys(req.severity_cell_map).length > 0
    ? JSON.stringify(req.severity_cell_map)
    : 'default';
  const degradations = req.capability_degradations || ['prompt-bundle-parity:not-native-slash'];
  const lensSource = lensSourceFor(lens);
  const lensContent = lensSource && sourceTexts[lensSource] ? stripFrontmatter(sourceTexts[lensSource]) : null;

  return [
    `ADVISORY MODE - Artifact-centric IV&V review (lens: ${lens}).`,
    '',
    '## Review Dispatch Metadata',
    `- Reviewer label: ${reviewerLabel}`,
    `- Review mode: ${reviewMode}`,
    `- Lens: ${lens}`,
    `- Capability degradations: ${degradations.join(', ')}`,
    `- Thoroughness: ${thoroughness}`,
    `- Direction: ${direction}`,
    `- Subject type: ${subjectType}`,
    `- Project context: ${projectContext}`,
    `- Severity cell map override: ${severityCellMap}`,
    '',
    '## Portable AIVV Source Manifest',
    ...sourceList.map(source => `- ${source}`),
    '',
    '## Reviewer Prompt Contract',
    '',
    ...sourceBodyBlocks(sourceTexts, MANDATORY_EMBEDDED_SOURCES.slice(0, 1)),
    '## Operational Reviewer Methodology',
    '',
    ...sourceBodyBlocks(sourceTexts, MANDATORY_EMBEDDED_SOURCES.slice(1)),
    `Source: ${PROVIDER_ADAPTER_SOURCES[sourceTexts.__provider]}`,
    '',
    sourceTexts[PROVIDER_ADAPTER_SOURCES[sourceTexts.__provider]].trim(),
    '',
    '## Non-Native Provider Command Context',
    '',
    providerCommandSource ? `Source: ${providerCommandSource}` : 'Source: none',
    '',
    providerCommandSource ? sourceTexts[providerCommandSource].trim() : 'No provider command fixture available for this provider.',
    '',
    'Provider parity note: do not invoke native `/aivv` slash commands from the non-native provider. Review the rendered prompt bundle and return structured findings through the selected provider transport.',
    '',
    '## What to Review',
    '',
    '<' + requestTag + '>',
    req.what_to_review || 'Review the supplied target artifact using AIVV methodology.',
    '</' + requestTag + '>',
    '',
    '## Review Scope and Approach (scope confirmation: ' + scopeConfirmationStatus + ')',
    '',
    'Treat this caller-supplied scope as confirmed only when its status says confirmed; missing or incomplete scope metadata is not confirmation.',
    '<' + scopeTag + '>',
    `Scope confirmation: ${scopeConfirmationStatus}`,
    `Subject type: ${subjectType}`,
    `Final scope: ${finalScope || 'not supplied'}`,
    `Review approach: ${reviewApproach || 'not supplied'}`,
    '</' + scopeTag + '>',
    '',
    ...(subjectType === 'plan' ? [
      '## Forward-Looking Plan Review',
      'Forward-looking plan review: implementation VERIFY is skipped; evaluate plan soundness, assumptions, sequencing, scope, evidence, and simpler alternatives.',
      'Implementation not verified in --plan mode',
      'Assess the proposal against its stated goal, constraints, dependencies, and verification path. Missing implementation is expected for a plan review.',
      '',
    ] : []),
    '## Session Activity (' + (artifactPrimary ? 'SUPPORTING CONTEXT - clarify intent and constraints' : 'PRIMARY - this is what you are reviewing') + ')',
    '',
    '<' + sessionTag + '>',
    '### Goals & Objectives',
    arrayLines(sc.goals_objectives),
    '',
    '### Decisions Made',
    arrayLines(sc.decisions_made),
    '',
    '### Work Performed',
    arrayLines(sc.work_performed),
    '',
    '### Problems Encountered',
    arrayLines(sc.problems_encountered),
    '',
    '### Trade-offs & Risks',
    arrayLines(sc.tradeoffs_risks),
    '',
    '### Current State',
    arrayLines(sc.current_state),
    '',
    '### Unavailable Fields',
    arrayLines(sc.unavailable_fields),
    '</' + sessionTag + '>',
    '',
    artifactHeading,
    '',
    '<' + targetTag + ' path="' + xmlAttr(target.relPath) + '">',
    targetContent,
    '</' + targetTag + '>',
    '',
    '## Scope and Evidence Coherence Check',
    'Review whether the supplied materials are consistent with the stated goal, confirmed scope and approach when supplied, and relevant constraints.',
    '',
    ...(lensContent ? [
      `## Lens-Specific Focus: ${lens}`,
      '',
      lensContent.description,
      '',
      lensContent.body,
      '',
      '**How to apply this lens:**',
      '- Treat the "Trigger patterns" list as evidence prompts: inspect matching material, cite applicable standards, and emit findings only when concrete context shows a defect, material risk, or articulated improvement/value case. Lens files may define stronger trigger semantics for their own domain; use those only when the lens text says so.',
      '- Treat the "Focus" section as additional review concerns layered on top of universal Phase 2 VERIFY.',
      '- Consult the files listed under "Standards to consult" when flagging lens-specific patterns.',
      '- Follow the "Graceful degradation" rule when the change set does not exercise the lens domain.',
      '',
    ] : []),
    '## Files in Review Packet',
    '- ' + target.relPath,
    '',
    '## Working Directory',
    req.working_directory || ROOT,
    '',
    '## Runtime Helper Paths',
    'The orchestrator resolved these paths before dispatch. Use them as absolute local paths; do not assume AIVV_ROOT is exported by the consuming project.',
    `- AIVV runtime root: ${SHIP_ROOT}`,
    `- Standards lookup helper: ${join(SHIP_ROOT, 'tools', 'standards-lookup.mjs')}`,
  ].join('\n');
}

function dispatchArgsFor(args, req, sourceList) {
  const dispatchArgs = [
    join(SCRIPT_DIR, 'dispatch.mjs'),
    '--provider', args.provider,
    '--model', args.model,
    '--reviewer-id', req.reviewer_label || 'alpha',
    '--timeout', args.timeout,
    '--source-list', sourceList.join(','),
    '--evidence-classes', EVIDENCE_CLASSES,
  ];
  if (args.renderPromptOnly) dispatchArgs.push('--render-prompt-only');
  if (args.providerEgressConsent) dispatchArgs.push('--provider-egress-consent');
  return dispatchArgs;
}

function destinationShapeFor(args) {
  return args.providerEgressConsent ? 'provider-cli-or-api-auto' : 'prompt-bundle-render-or-gated-dispatch';
}

function enforcePromptBundleTrust(args, sourceList, prompt = '') {
  const trustDecision = assessProviderTrust({
    root: ROOT,
    provider: args.provider,
    model: args.model,
    authMode: 'auto',
    destinationShape: destinationShapeFor(args),
    evidenceClasses: EVIDENCE_CLASSES.split(','),
    sourceList,
    prompt,
  });
  if (!trustDecision.report.allowed) {
    process.stderr.write('[AIVV] PROVIDER_TRUST_BLOCKED: refusing to render prompt bundle because provider trust policy blocked request sources.\n');
    process.stderr.write('[AIVV PROVIDER_TRUST] ' + JSON.stringify(trustDecision.report) + '\n');
    process.exit(9);
  }
  return trustDecision;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.request || !args.provider || !args.model) {
    process.stderr.write('[AIVV] --request, --provider, and --model are required\n');
    process.exit(4);
  }

  const sourceTexts = {};
  const request = resolveCallerSuppliedPath(args.request, 'request', process.cwd());
  const providerCommandSource = PROVIDER_COMMAND_SOURCES[args.provider];
  const providerAdapterSource = PROVIDER_ADAPTER_SOURCES[args.provider];
  if (!providerCommandSource) {
    process.stderr.write('[AIVV] UNKNOWN_PROVIDER_COMMAND_CONTEXT: ' + args.provider + '\n');
    process.exit(4);
  }
  const req = readJson(request.absPath);
  validateRequest(req);
  if (!args.renderPromptOnly && !hasConfirmedScope(req)) {
    process.stderr.write('[AIVV] SCOPE_CONFIRMATION_REQUIRED: confirm the final scope and review method, then supply review_scope.confirmed=true, subject_type (' + [...SUBJECT_TYPES].join(', ') + '), and non-empty final_scope and approach (or strategy). Prompt-only rendering remains available.\n');
    process.exit(9);
  }
  const lensSource = lensSourceFor(req.lens || 'general');
  const fixedSources = [
    ...REQUIRED_SOURCES,
    providerAdapterSource,
    providerCommandSource,
    ...(lensSource ? [lensSource] : []),
  ];
  // request.relPath is caller-supplied and, in principle, could collide as a bare string with a
  // fixed plugin-source path (e.g. a caller's cwd-relative request path happening to read
  // "skills/aivv/SKILL.md"). Disambiguate before it ever enters the same de-duped list so the
  // loop below can never shadow a fixed source's content with the request's own content.
  const requestDisplayPath = fixedSources.includes(request.relPath) ? './' + request.relPath : request.relPath;
  const sourceList = [...new Set([...fixedSources, requestDisplayPath])];
  for (const relPath of [...sourceList, ...args.requireSource]) {
    // requestDisplayPath is a caller-supplied path (already resolved above) — reading it through
    // readRequired() would re-apply the plugin-root boundary and reject any real external request.
    sourceTexts[relPath] = relPath === requestDisplayPath
      ? readFileSync(request.absPath, 'utf8')
      : readRequired(relPath);
  }
  sourceTexts.__provider = args.provider;

  const workingDirectory = typeof req.working_directory === 'string' && req.working_directory.trim()
    ? req.working_directory
    : process.cwd();
  const target = resolveCallerSuppliedPath(req.target_file, 'target_file', workingDirectory);
  const fullSourceList = [...new Set([...sourceList, target.relPath])];
  enforcePromptBundleTrust(args, fullSourceList);
  const coldPrompt = buildColdPrompt(req, sourceTexts, fullSourceList, target);
  const coldPromptBytes = Buffer.byteLength(coldPrompt, 'utf8');
  if (!Number.isFinite(MAX_PROMPT_BYTES) || MAX_PROMPT_BYTES <= 0) {
    process.stderr.write('[AIVV] PROMPT_BUNDLE_LIMIT_INVALID: AIVV_PROMPT_BUNDLE_MAX_BYTES must be a positive integer\n');
    process.exit(4);
  }
  if (coldPromptBytes > MAX_PROMPT_BYTES) {
    process.stderr.write('[AIVV] PROMPT_BUNDLE_TOO_LARGE: ' + coldPromptBytes + ' bytes exceeds limit ' + MAX_PROMPT_BYTES + '\n');
    process.exit(9);
  }

  const result = spawnSync(process.execPath, dispatchArgsFor(args, req, fullSourceList), {
    input: coldPrompt,
    encoding: 'utf8',
    maxBuffer: Math.max(MAX_PROMPT_BYTES * 3, 16 * 1024 * 1024),
    env: {
      ...process.env,
      AIVV_PROVIDER_PROMPT_MAX_BYTES: String(MAX_PROMPT_BYTES),
    },
  });

  if (result.error) {
    process.stderr.write('[AIVV] PROMPT_BUNDLE_DISPATCH_FAILED: ' + result.error.message + '\n');
    process.exit(9);
  }
  if (result.signal) {
    process.stderr.write('[AIVV] PROMPT_BUNDLE_DISPATCH_SIGNAL: ' + result.signal + '\n');
    process.exit(9);
  }
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    process.exit(result.status || 9);
  }

  if (args.renderPromptOnly) {
    const metadata = JSON.parse(result.stdout);
    metadata.step4_cold_prompt = coldPrompt;
    metadata.bundle_required_sources = REQUIRED_SOURCES;
    metadata.mandatory_embedded_sources = MANDATORY_EMBEDDED_SOURCES;
    process.stdout.write(JSON.stringify(metadata, null, 2) + '\n');
    return;
  }

  if (result.stdout) process.stdout.write(result.stdout);
}

main();
