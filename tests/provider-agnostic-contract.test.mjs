#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const repoRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function collectFiles(relativeDirectory, predicate) {
  return readdirSync(path.join(repoRoot, relativeDirectory), { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return collectFiles(entryPath, predicate);
    return entry.isFile() && predicate(entryPath) ? [entryPath] : [];
  });
}

const agentPaths = collectFiles('plugin/agents', relativePath => relativePath.endsWith('.md'));
assert.ok(agentPaths.length > 0, 'agent profiles are discovered from plugin/agents');

for (const relativePath of agentPaths) {
  const source = read(relativePath);
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter, relativePath + ' has frontmatter');
  assert.doesNotMatch(
    frontmatter[1],
    /^model\s*:/m,
    relativePath + ' must inherit model selection from the host rather than pin a vendor model'
  );
}

const sharedRolePaths = collectFiles('plugin/.aivv/prompts', relativePath => relativePath.endsWith('.md'));
assert.ok(sharedRolePaths.length > 0, 'shared role prompts are discovered from plugin/.aivv/prompts');
const sharedTemplatePaths = collectFiles('plugin/skills', relativePath => relativePath.endsWith('-template.md'));
assert.ok(sharedTemplatePaths.length > 0, 'shared skill templates are discovered from plugin/skills');
for (const requiredPath of [
  'plugin/skills/aivv-fix/references/verifier-prompt-template.md',
  'plugin/skills/aivv/references/reviewer-prompt-template.md',
]) {
  assert.ok(sharedTemplatePaths.includes(requiredPath), requiredPath + ' must be covered by the shared-template scan');
}
const sharedWorkflowPaths = [
  'plugin/skills/aivv-fix/references/finding-collection.md',
  'plugin/skills/aivv-fix/references/triage.md',
];
const sharedPromptPaths = [...sharedRolePaths, ...sharedTemplatePaths, ...sharedWorkflowPaths];
const catalog = readJson('plugin/tools/model-catalog.json');
const catalogModelIds = Object.values(catalog.providers).flatMap(provider =>
  [provider.models?.recommended, provider.models?.fallback].filter(Boolean)
);
const catalogProviderModelTerms = [...new Set([
  ...Object.keys(catalog.providers),
  ...catalogModelIds,
  ...catalogModelIds.flatMap(model => {
    const familyPrefix = model.match(/^(.*?)-\d/)?.[1];
    return familyPrefix ? familyPrefix.split('-') : [];
  }),
].filter(term => term && term.toLowerCase() !== 'claude'))];
const escapeRegexTerm = term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const catalogProviderModelPattern = catalogProviderModelTerms.map(escapeRegexTerm).join('|');
const providerAssumptionPattern = new RegExp(
  '\\b(?:' + catalogProviderModelPattern + ')\\b|claude-(?:opus|sonnet)-[0-9]+|\\bClaude\\b(?!\\s*Code\\b|[._-])|native Claude/Codex (?:reviewer )?dispatch|\\b(?:another Claude|Claude flagged|flagged by Claude)\\b',
  'i'
);
const portableSourceAssumptionPattern = new RegExp(
  '\\b(?:Claude|Codex|' + catalogProviderModelPattern + ')\\b|claude-opus-[0-9]',
  'i'
);
for (const term of catalogProviderModelTerms) {
  assert.match(
    term,
    providerAssumptionPattern,
    'catalog provider/model term must be rejected by the shared-prompt guard: ' + term
  );
  assert.match(
    term,
    portableSourceAssumptionPattern,
    'catalog provider/model term must be rejected by the portable-source guard: ' + term
  );
}
const providerRegressionPhrases = [
  'native Claude/Codex dispatch',
  'native Claude/Codex reviewer dispatch',
  'You are a Claude reviewer',
  'Opus agents',
  'GPT model',
  'gpt-5.5',
  'gpt-5',
];
for (const phrase of providerRegressionPhrases) {
  assert.match(phrase, providerAssumptionPattern, 'provider/model regression phrase must be rejected: ' + phrase);
}
for (const phrase of ['GPT model', 'gpt-5.5', 'gpt-5']) {
  assert.match(
    phrase,
    portableSourceAssumptionPattern,
    'GPT regression phrase must be rejected by the portable-source guard: ' + phrase
  );
}
assert.doesNotMatch(
  'Claude Code host compatibility note',
  providerAssumptionPattern,
  'host-specific compatibility wording must remain allowed'
);
for (const relativePath of sharedPromptPaths) {
  assert.doesNotMatch(
    read(relativePath),
    providerAssumptionPattern,
    relativePath + ' must not assume a provider or model family'
  );
}

const portableSourcePaths = [
  'plugin/.aivv/prompts/README.md',
  'plugin/.aivv/prompts/reviewer-role.md',
  'plugin/.aivv/prompts/investigator-role.md',
  'plugin/.aivv/prompts/_untrusted-content.md',
  'plugin/.aivv/runtime-contract.md',
  'plugin/skills/methodology/SKILL.md',
  'plugin/skills/aivv/references/multi-model-dispatch.md',
];
for (const relativePath of portableSourcePaths) {
  assert.doesNotMatch(
    read(relativePath),
    portableSourceAssumptionPattern,
    relativePath + ' must express shared behavior without one host, provider, or model family'
  );
}
const reportViewerHookPaths = collectFiles('plugin/skills', relativePath => relativePath.endsWith('/viewer-hook.md'));
assert.ok(reportViewerHookPaths.length > 0, 'shared viewer hooks are discovered from plugin/skills');
const reportOpeningSharedPaths = [
  'plugin/.aivv/configuration.md',
  'plugin/.aivv/schemas/config.schema.json',
  ...reportViewerHookPaths,
  'plugin/skills/aivv-view/SKILL.md',
];
for (const requiredPath of [
  'plugin/.aivv/configuration.md',
  'plugin/.aivv/schemas/config.schema.json',
  'plugin/skills/aivv/references/viewer-hook.md',
  'plugin/skills/aivv-fix/references/viewer-hook.md',
  'plugin/skills/aivv-view/SKILL.md',
]) {
  assert.ok(reportOpeningSharedPaths.includes(requiredPath), requiredPath + ' must be covered by the shared report-opening scan');
}
const hostSpecificReportOpeningPattern = /(?:\bCodex\b[^\n]{0,160}(?:in-app browser|Browser plugin|local-served report URL)|(?:in-app browser|Browser plugin|local-served report URL)[^\n]{0,160}\bCodex\b)/i;
for (const phrase of [
  'Codex in-app browser local-served report URL',
  'in-app Browser plugin on Codex',
]) {
  assert.match(phrase, hostSpecificReportOpeningPattern, 'host-specific report-opening regression phrase must be rejected: ' + phrase);
}
for (const relativePath of reportOpeningSharedPaths) {
  assert.doesNotMatch(
    read(relativePath),
    hostSpecificReportOpeningPattern,
    relativePath + ' must delegate host-specific report opening to its platform adapter'
  );
}
const codexAdapter = read('plugin/.aivv/platform-adapters/codex.md');
assert.match(
  codexAdapter,
  /## Report opening[\s\S]*Codex Browser plugin[\s\S]*existing local-served report URL[\s\S]*`--open`[\s\S]*OS opener/i,
  'Codex report-opening behavior must be documented in the Codex adapter'
);

const schema = readJson('plugin/.aivv/schemas/config.schema.json');
assert.deepEqual(schema.properties.reviewer_provider_priority.default, []);
assert.equal(schema.properties.reviewer_provider_priority.items.enum, undefined);
assert.equal(schema.properties.model_overrides.additionalProperties.type, 'string');
assert.deepEqual(schema.properties.provider_auth_modes.additionalProperties.enum, ['auto', 'cli', 'api_key']);
for (const legacyKey of ['auth_mode_anthropic', 'auth_mode_openai', 'auth_mode_gemini']) {
  assert.equal(schema.properties[legacyKey].deprecated, true, legacyKey + ' remains a migration alias only');
}

assert.equal(catalog.schema_version, 2);
assert.ok(Object.keys(catalog.providers).length > 0);
assert.ok(Object.values(catalog.providers).every(provider =>
  provider.adapter_source && provider.command_source && provider.models?.recommended
));

const registryUrl = pathToFileURL(path.join(repoRoot, 'plugin/tools/provider-registry.mjs'));
const selectionUrl = pathToFileURL(path.join(repoRoot, 'plugin/tools/model-selection.mjs'));
const registry = await import(registryUrl.href);
const selector = await import(selectionUrl.href);
assert.equal(registry.validateProviderCatalog(), true);
assert.deepEqual(registry.defaultProviderPriority, catalog.default_provider_priority);
assert.equal(new Set(registry.defaultProviderPriority).size, registry.providerIds.length);
assert.deepEqual(registry.resolveProviderPriority([]), catalog.default_provider_priority);
assert.deepEqual(registry.resolveProviderPriority([registry.providerIds[1]]), [registry.providerIds[1]]);
assert.throws(() => registry.resolveProviderPriority(['unregistered-provider']), /Unknown provider/);
assert.throws(() => registry.resolveProviderPriority('anthropic'), /must be an array/);
assert.equal(registry.assertProviderAdapterParity(registry.providerIds), true);
assert.throws(
  () => registry.assertProviderAdapterParity(registry.providerIds.slice(1)),
  /Missing runtime adapters/
);
assert.throws(
  () => registry.assertProviderAdapterParity([...registry.providerIds, 'unregistered-provider']),
  /Runtime adapters absent from the provider catalog/
);
const evidenceAcceptance = registry.providerCatalog.providers[registry.providerIds[0]].models.acceptance.recommended;
const priorAcceptance = { ...evidenceAcceptance };
evidenceAcceptance.status = 'verified';
evidenceAcceptance.evidence = [];
assert.throws(() => registry.validateProviderCatalog(), /requires acceptance evidence/);
evidenceAcceptance.evidence = ['tests/provider-agnostic-contract.test.mjs: model selection contract'];
assert.equal(registry.validateProviderCatalog(), true);
Object.assign(evidenceAcceptance, priorAcceptance);

for (const providerId of registry.providerIds) {
  const provider = registry.getProvider(providerId);
  assert.deepEqual(provider.models.acceptance.recommended, {
    status: 'unverified-legacy',
    evidence: [],
  });
  assert.deepEqual(provider.models.acceptance.fallback, {
    status: 'unverified-legacy',
    evidence: [],
  });
  const selected = selector.resolveModelSelection({ provider: providerId });
  assert.equal(selected.model, provider.models.recommended);
  assert.equal(selected.model_source, 'model-catalog');
  assert.ok(selected.warnings.some(message => message.includes('unverified legacy catalog value')));
  assert.equal(
    selector.resolveModelSelection({
      provider: providerId,
      policy: 'pinned',
      providerOverrides: { [providerId]: 'custom-model' },
    }).model,
    'custom-model'
  );
  assert.equal(
    selector.resolveModelSelection({
      provider: providerId,
      policy: 'pinned',
      requestedModel: 'request-model',
      providerOverrides: { [providerId]: 'custom-model' },
    }).model_source,
    'request'
  );
  if (provider.legacy_slot) {
    assert.equal(
      selector.resolveModelSelection({
        provider: providerId,
        policy: 'pinned',
        legacySlotOverrides: { [provider.legacy_slot]: 'legacy-model' },
      }).model,
      'legacy-model'
    );
  }
  assert.equal(
    selector.resolveModelSelection({ provider: providerId, policy: 'family-latest' }).model,
    provider.models.recommended
  );
}
assert.throws(() => selector.resolveModelSelection({ provider: 'unregistered-provider' }), /Unknown provider/);
for (const prototypeKey of ['__proto__', 'constructor', 'toString']) {
  assert.throws(() => registry.getProvider(prototypeKey), /Unknown provider/);
  assert.throws(() => selector.resolveModelSelection({ provider: prototypeKey }), /Unknown provider/);
}

const resolvedSettings = selector.buildRequestSettings({
  reviewer_provider_priority: [],
  model_policy: 'pinned',
  model_overrides: { openai: 'configured-model' },
  reviewer_primary: 'legacy-primary-model',
  auth_mode_anthropic: 'cli',
  provider_auth_modes: { anthropic: 'api_key', openai: 'api_key' },
});
assert.deepEqual(resolvedSettings.reviewer_provider_priority, catalog.default_provider_priority);
assert.deepEqual(resolvedSettings.model_selection, {
  policy: 'pinned',
  provider_overrides: { openai: 'configured-model' },
  legacy_slot_overrides: { primary: 'legacy-primary-model', secondary: null, fast: null },
  provider_auth_modes: { anthropic: 'api_key', openai: 'api_key' },
});
assert.equal(resolvedSettings.auth_mode, null);
assert.equal(
  selector.buildRequestSettings({ auth_mode_anthropic: 'cli' }).model_selection.provider_auth_modes.anthropic,
  'cli'
);
const settingsCli = spawnSync(
  process.execPath,
  [path.join(repoRoot, 'plugin/tools/model-selection.mjs'), '--build-request-settings'],
  { cwd: repoRoot, encoding: 'utf8', input: JSON.stringify({ reviewer_provider_priority: ['gemini'], model_overrides: { gemini: 'cli-model' } }) }
);
assert.equal(settingsCli.status, 0, settingsCli.stderr);
assert.deepEqual(JSON.parse(settingsCli.stdout).reviewer_provider_priority, ['gemini']);
assert.deepEqual(JSON.parse(settingsCli.stdout).model_selection.provider_overrides, { gemini: 'cli-model' });

const promptBundleSource = read('plugin/tools/aivv-prompt-bundle.mjs');
assert.doesNotMatch(promptBundleSource, /PROVIDER_COMMAND_SOURCES|PROVIDER_ADAPTER_SOURCES/);
const dispatch = spawnSync(
  process.execPath,
  [path.join(repoRoot, 'plugin/tools/dispatch.mjs'), '--assert-provider-registry'],
  { cwd: repoRoot, encoding: 'utf8' }
);
assert.equal(dispatch.status, 0, dispatch.stderr);
assert.match(dispatch.stdout, /registry and runtime adapter map are consistent/);

const tempRoot = mkdtempSync(path.join(tmpdir(), 'aivv-provider-contract-'));
try {
  const target = path.join(tempRoot, 'target.md');
  const request = path.join(tempRoot, 'request.json');
  writeFileSync(target, '# Test review target\nA small provider-neutral fixture.\n');
  const requestSettings = selector.buildRequestSettings({
    reviewer_provider_priority: [],
    model_policy: 'pinned',
    model_overrides: { openai: 'integration-model' },
    provider_auth_modes: { openai: 'api_key' },
  });
  writeFileSync(request, JSON.stringify({
    ...requestSettings,
    target_file: target,
    working_directory: tempRoot,
    lens: 'general',
    what_to_review: 'Check the fixture using the shared AIVV method.',
  }));
  const bundle = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'plugin/tools/aivv-prompt-bundle.mjs'),
      '--provider', 'openai',
      '--request', request,
      '--render-prompt-only',
    ],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  assert.equal(bundle.status, 0, bundle.stderr);
  const rendered = JSON.parse(bundle.stdout);
  assert.equal(rendered.provider, 'openai');
  assert.equal(rendered.model, 'integration-model');
  assert.equal(rendered.model_source, 'provider-config');
  assert.equal(rendered.auth_mode, 'api_key');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log('provider-agnostic contract: shared roles, registry, model/auth selection, and dispatch metadata are consistent');
