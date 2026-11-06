#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReviewLogNewWrite } from '../../plugin/tools/pre-write-validator.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEMP_ROOT = mkdtempSync(path.join(os.tmpdir(), 'aivv-general-review-'));
const PROMPT_BUNDLE = path.join(REPO_ROOT, 'plugin/tools/aivv-prompt-bundle.mjs');
const DISPATCH = path.join(REPO_ROOT, 'plugin/tools/dispatch.mjs');

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function renderPrompt(name, request) {
  const workingDirectory = path.join(TEMP_ROOT, name);
  const artifactPath = path.join(workingDirectory, 'review-subject.md');
  const requestPath = path.join(workingDirectory, 'request.json');
  // Each route gets an isolated target directory for deterministic relative paths.
  mkdirSync(workingDirectory, { recursive: true });
  writeFileSync(artifactPath, '# Review subject\n\nA supplied artifact for offline prompt rendering.\n');
  writeFileSync(requestPath, JSON.stringify({
    target_file: artifactPath,
    working_directory: workingDirectory,
    what_to_review: 'Review the supplied material against the intended goal.',
    ...request,
  }));
  const result = spawnSync(process.execPath, [
    PROMPT_BUNDLE,
    '--request', requestPath,
    '--provider', 'openai',
    '--model', 'offline-render-test',
    '--render-prompt-only',
  ], { cwd: workingDirectory, encoding: 'utf8' });
  assert.equal(result.status, 0, `prompt render failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function lensEnum(schema, pathParts) {
  let value = schema;
  for (const part of pathParts) value = value[part];
  return value;
}

try {
  const goldenConfig = readJson('plugin/.aivv/schemas/config.schema.json');
  assert.equal(goldenConfig.properties.default_lenses.default, 'general');
  assert.equal(goldenConfig.properties.scope_confirmation_mode.default, 'announce',
    'clear explicit read-only reviews announce resolved scope/method without a second approval prompt');
  assert.deepEqual(goldenConfig.properties.scope_confirmation_mode.enum, ['ask', 'announce']);
  const scopePolicy = readFileSync(path.join(REPO_ROOT, 'plugin/skills/aivv/references/scope-confirmation.md'), 'utf8');
  assert.match(scopePolicy, /A clear, explicit request for a\s+read-only review authorizes that review/);
  assert.match(scopePolicy, /Ask when[\s\S]*?proceeding would materially expand[\s\S]*?the requested scope/);
  assert.match(scopePolicy, /explicitly selected ask mode \(`--ask-scope` or\s+`scope_confirmation_mode: "ask"` with manual config provenance\)/,
    'an explicit user preference for scope confirmation remains honored');
  assert.match(scopePolicy, /Treat old wizard\/default `ask`\s+values as `announce`/,
    'a persisted old default does not masquerade as an explicit user preference');
  assert.match(scopePolicy, /Never broaden\s+scope silently/);
  assert.doesNotMatch(scopePolicy, /clear proposal always requires confirmation/);

  const findingSchema = readJson('plugin/.aivv/schemas/finding.json');
  assert.equal(findingSchema.properties.lens.default, 'code', 'legacy findings without lens keep the code default');
  assert.ok(findingSchema.properties.lens.enum.includes('general'));
  const multimodelSchema = readJson('plugin/.aivv/schemas/findings-multimodel.schema.json');
  assert.equal(multimodelSchema.properties.lens.default, 'code');
  assert.ok(multimodelSchema.properties.lens.enum.includes('general'));

  const reviewLogSchema = readJson('plugin/.aivv/schemas/review-log.json');
  assert.ok(lensEnum(reviewLogSchema, ['properties', 'lens', 'oneOf', 0, 'enum']).includes('general'));
  assert.ok(lensEnum(reviewLogSchema, ['definitions', 'review_prompt_profile', 'properties', 'lens', 'oneOf', 0, 'enum']).includes('general'));
  assert.ok(lensEnum(reviewLogSchema, ['definitions', 'reviewer_roster', 'items', 'properties', 'lens', 'enum']).includes('general'));
  assert.ok(lensEnum(reviewLogSchema, ['properties', 'findings', 'items', 'properties', 'lens', 'oneOf', 0, 'enum']).includes('general'));
  assert.ok(lensEnum(reviewLogSchema, ['properties', 'findings', 'items', 'properties', 'lens', 'oneOf', 1, 'items', 'enum']).includes('general'));
  assert.ok(lensEnum(readJson('plugin/.aivv/schemas/fix-log.json'), ['properties', 'source_review_snapshot', 'anyOf', 1, 'properties', 'lens', 'enum']).includes('general'));
  assert.ok(lensEnum(readJson('plugin/.aivv/schemas/calibration.json'), ['properties', 'lens', 'enum']).includes('general'));

  const defaultRequest = renderPrompt('default', {
    review_scope: {
      subject_type: 'file',
      final_scope: 'Check this design specification for completeness and internal consistency.',
      approach: 'Compare requirements, examples, and stated constraints.',
      confirmed: true,
    },
  });
  const defaultPrompt = defaultRequest.step4_cold_prompt;
  const checklistPath = 'skills/methodology/references/general-review-checklist.md';
  assert.equal(defaultRequest.status, 'prompt-rendered');
  assert.match(defaultPrompt, /^ADVISORY MODE.*\(lens: general\)\./m);
  assert.match(defaultPrompt, /## Lens-Specific Focus: general/);
  assert.ok(defaultPrompt.includes('- .aivv/lenses/general.md'));
  assert.ok(!defaultPrompt.includes('- .aivv/lenses/code.md'), 'general default must not silently add the code lens');
  assert.ok(defaultRequest.bundle_required_sources.includes(checklistPath));
  assert.ok(defaultRequest.mandatory_embedded_sources.includes(checklistPath));
  assert.ok(defaultPrompt.includes(`Source: ${checklistPath}`));
  const checklistBody = readFileSync(path.join(REPO_ROOT, 'plugin', checklistPath), 'utf8').trim();
  assert.ok(defaultPrompt.includes(checklistBody), 'general checklist must be embedded in the portable reviewer prompt');
  assert.match(defaultPrompt, /## Supplied Artifact \(PRIMARY - this is the review subject\)/);
  assert.match(defaultPrompt, /## Session Activity \(SUPPORTING CONTEXT - clarify intent and constraints\)/);
  assert.match(defaultPrompt, /Scope resolution: resolved from caller request/);
  const scopeBlock = defaultPrompt.match(/<(AIVV_UNTRUSTED_REVIEW_SCOPE_[a-f0-9]+)>([\s\S]*?)<\/\1>/);
  assert.ok(scopeBlock, 'review scope must remain inside its nonce-delimited trust boundary');
  assert.match(scopeBlock[2], /Check this design specification/);
  assert.match(scopeBlock[2], /Compare requirements, examples/);

  const ideaPrompt = renderPrompt('idea', {
    what_to_review: 'Should we run the workshop online?',
    review_scope: {
      subject_type: 'idea',
      final_scope: 'Challenge online workshop delivery for residents with mixed digital access.',
      approach: 'Compare access, costs, and practical alternatives.',
      confirmed: true,
    },
  }).step4_cold_prompt;
  assert.match(ideaPrompt, /## Session Activity \(SUPPORTING CONTEXT - clarify intent and constraints\)/);
  assert.match(ideaPrompt, /## Supplied Artifact \(PRIMARY - this is the review subject\)/);

  for (const reviewScope of [
    undefined,
    { subject_type: 'file', confirmed: false, final_scope: 'Check the note.', approach: 'Check clarity.' },
    { subject_type: 'file', confirmed: true, final_scope: '   ', approach: 'Check clarity.' },
    { subject_type: 'file', confirmed: true, final_scope: 'Check the note.' },
    { confirmed: true, final_scope: 'Check the note.', approach: 'Check clarity.' },
    { subject_type: 'document', confirmed: true, final_scope: 'Check the note.', approach: 'Check clarity.' },
  ]) {
    const requestPath = path.join(TEMP_ROOT, 'unconfirmed-request.json');
    writeFileSync(requestPath, JSON.stringify({ target_file: 'unused-because-dispatch-must-stop.md', review_scope: reviewScope }));
    const rejected = spawnSync(process.execPath, [
      PROMPT_BUNDLE, '--request', requestPath, '--provider', 'openai',
      '--model', 'must-not-dispatch', '--provider-egress-consent',
    ], { encoding: 'utf8' });
    assert.equal(rejected.status, 9);
    assert.match(rejected.stderr, /SCOPE_CONFIRMATION_REQUIRED/);
    assert.doesNotMatch(rejected.stderr, /PROMPT_BUNDLE_SOURCE_MISSING|PROVIDER_TRUST|AIVV DISCLOSURE/,
      'unconfirmed dispatch must stop before reading target evidence or invoking the transport');
  }
  const confirmedRequestPath = path.join(TEMP_ROOT, 'confirmed-request.json');
  writeFileSync(confirmedRequestPath, JSON.stringify({
    target_file: path.join(TEMP_ROOT, 'intentionally-missing.md'),
    review_scope: { subject_type: 'artifact', confirmed: true, final_scope: 'Review the note.', approach: 'Check clarity.' },
  }));
  const admitted = spawnSync(process.execPath, [
    PROMPT_BUNDLE, '--request', confirmedRequestPath, '--provider', 'openai',
    '--model', 'must-not-dispatch', '--provider-egress-consent',
  ], { encoding: 'utf8' });
  assert.equal(admitted.status, 9);
  assert.match(admitted.stderr, /PROMPT_BUNDLE_SOURCE_MISSING: target_file/,
    'a complete confirmation must pass the gate and reach target validation');
  assert.doesNotMatch(admitted.stderr, /SCOPE_CONFIRMATION_REQUIRED/);

  const planPrompt = renderPrompt('plan', {
    review_scope: {
      subject_type: 'plan',
      final_scope: 'Review the rollout plan and its acceptance criteria.',
      approach: 'Check sequence, dependencies, risks, and the verification path.',
      confirmed: true,
    },
  }).step4_cold_prompt;
  assert.match(planPrompt, /^## Forward-Looking Plan Review$/m);
  assert.match(planPrompt, /^Forward-looking plan review: implementation VERIFY is skipped; evaluate plan soundness, assumptions, sequencing, scope, evidence, and simpler alternatives\.$/m);
  assert.match(planPrompt, /^Implementation not verified in --plan mode$/m);
  const planPacket = planPrompt.slice(planPrompt.lastIndexOf('## Forward-Looking Plan Review'));
  assert.match(planPacket, /^## Plan Under Review \(PRIMARY - forward-looking\)$/m);
  assert.match(planPrompt, /Missing implementation is expected for a plan review/);

  const incompleteScope = renderPrompt('incomplete-scope', {
    review_scope: { subject_type: 'file', final_scope: '   ', approach: 'Review the document.', confirmed: true },
  }).step4_cold_prompt;
  assert.match(incompleteScope, /scope status: incomplete/,
    'confirmed=true without a non-empty final_scope must not claim confirmation');

  const explicitCodePrompt = renderPrompt('explicit-code', { lens: 'code' }).step4_cold_prompt;
  assert.match(explicitCodePrompt, /^ADVISORY MODE.*\(lens: code\)\./m);
  assert.match(explicitCodePrompt, /## Lens-Specific Focus: code/);
  assert.ok(explicitCodePrompt.includes('- .aivv/lenses/code.md'));
  assert.doesNotMatch(explicitCodePrompt, /## Lens-Specific Focus: general/);
  assert.ok(!explicitCodePrompt.includes('- .aivv/lenses/general.md'), 'explicit code lens must remain code-only');

  const response = {
    findings: [{
      id: 'F001',
      severity: 'MAJOR',
      confidence: 'HIGH',
      category: 'documentation-gap',
      summary: 'General review finding accepted by provider validation',
      lens: 'general',
    }],
  };
  // --auth-mode test consumes this local fixture; no provider call or network access occurs.
  const dispatch = spawnSync(process.execPath, [
    DISPATCH,
    '--provider', 'openai',
    '--model', 'offline-test-double',
    '--reviewer-id', 'alpha',
    '--auth-mode', 'test',
    '--provider-egress-consent',
    '--source-list', 'plugin/.aivv/lenses/general.md',
    '--evidence-classes', 'methodology-docs',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: 'ADVISORY MODE - Artifact-centric IV&V review (lens: general).\n',
    env: {
      ...process.env,
      AIVV_PROVIDER_TRUST_MEMORY: path.join(TEMP_ROOT, 'provider-trust-memory.json'),
      AIVV_TEST_PROVIDER_RESPONSE: JSON.stringify(response),
    },
  });
  assert.equal(dispatch.status, 0, `offline dispatch failed: ${dispatch.stderr}`);
  const dispatchRecords = dispatch.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(dispatchRecords[0].lens, 'general', 'dispatch must preserve a recognized general finding lens');

  const persistedReview = {
    schema_version: 2,
    id: '2026-11-05T20-45-00-ab12',
    command: 'aivv',
    status: 'in-progress',
    invoked_at: '2026-11-05T20:45:00Z',
    target_project: TEMP_ROOT,
    lens: ['general', 'code'],
    reviewers: 2,
    review_mode: 'cold_multi_review',
    capability_degradations: [],
    findings: [{
      ref: 'F001',
      fingerprint: createHash('sha1').update('artifact:design-review|general|F001').digest('hex'),
      severity: 'MINOR',
      category: 'documentation-gap',
      description: 'The review record preserves a finding about the design artifact scope.',
      quality_profile: 'modern',
      scope_ref: { kind: 'artifact', ref: 'design-review' },
      lens: 'general',
      evidence: [{ kind: 'internal-repo', ref: 'docs/design.md', excerpt: 'Review subject and constraints.' }],
      impact: 'An unclear boundary may leave relevant design material unevaluated.',
      severity_rationale: 'This is a bounded completeness risk without observed direct harm.',
      recommended_next_step: 'document',
      verification_path: 'Confirm the review log names the selected artifact scope.',
      proportional_remediation: {
        present_problem: 'The artifact boundary is not recorded clearly.',
        simplest_viable_correction: 'Record the selected design artifact scope.',
        net_complexity: 'No runtime behavior or schema shape changes.',
        why_current_shape_insufficient: 'The current record obscures what evidence was reviewed.',
      },
    }],
    trust_summary: {
      review_mode: 'cold_multi_review',
      reviewers: { count: 2, labels: ['alpha', 'beta'] },
      lenses: { applied: ['general', 'code'], detected: [] },
      agreement: 'single',
      filtering: { hidden_count: 0, forced_show_count: 0 },
      evidence_posture: [],
    },
    reviewer_roster: [
      { label: 'alpha', display_name: 'Reviewer alpha', dispatch_path: 'agent-tool', lens: 'general', status: 'completed' },
      { label: 'beta', display_name: 'Reviewer beta', dispatch_path: 'agent-tool', lens: 'code', status: 'completed' },
    ],
    review_prompt_profile: { prompt_name: 'aivv-review', lens: ['general', 'code'] },
  };
  assert.deepEqual(validateReviewLogNewWrite(persistedReview), { status: 'pass', reason: 'pass' },
    'new review persistence validator must accept general in reviewer and nested lens arrays');
} finally {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
}

process.stdout.write('general review runtime contract: passed\n');
