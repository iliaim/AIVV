#!/usr/bin/env node

// Emits the records an /aivv-fix run otherwise hand-builds: the invocation ID, write-intent
// hashes, the plan-stage fix-log skeleton, a retry-history entry, and filled, fenced prompts.
// It only produces records. pre-write-validator.mjs remains the gate for every write.

import { randomBytes } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { incidentTimestamp } from './incident-state.mjs';
import { newNonce, wrapUntrusted } from './native-prompt-boundary.mjs';
import { editFrame, multiEditSha, sha256 } from './pre-write-validator.mjs';

const REFERENCES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../skills/aivv-fix/references');
const USAGE = [
  'Usage: node aivv-fix-records.mjs <request.json | ->',
  '  The request is a JSON object; every key is optional and each produces one output key:',
  '    invocation_id   reuse this run\'s ID (omit to get a new one)',
  '    write_intents   [intent, ...]             -> write_intents with content_sha filled',
  '    fix_log         {source, target_project, storage_context, authorized_scope, ...}',
  '                                              -> fix_log plan-stage skeleton',
  '    retry           {history, gate, finding_ids, defect, evidence[, beyond_limit_reason]} -> retry_entry',
  '    fix_log.max_rework_retries defaults to 3; pass the resolved setting to override',
  '    prompts         [{template, values}, ...] -> prompts, each value fenced with a fresh nonce',
  '                    template: fix-challenger | verifier | investigator',
  '                    unfilled lists every {placeholder} left for you to fill',
  '  Prints one JSON object. Validate fix-log writes with pre-write-validator.mjs as before.',
].join('\n');

class Refusal extends Error {
  constructor(reason, detail) {
    super(detail);
    this.reason = reason;
  }
}

function hashIntent(intent, index) {
  const label = `write_intents[${index}] (${intent?.id ?? 'no id'})`;
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) {
    throw new Refusal('write-intent-invalid', `${label} must be an object`);
  }
  const hashed = { source_step: 'Step 4.4', ...intent };
  if (Array.isArray(intent.proposed_edits) && intent.proposed_edits.length > 0) {
    hashed.proposed_edits = intent.proposed_edits.map((edit) => ({ ...edit, content_sha: sha256(editFrame(edit)) }));
    hashed.content_sha = multiEditSha(intent.proposed_edits);
  } else if (typeof intent.exact_content_or_patch === 'string') {
    hashed.content_sha = sha256(intent.exact_content_or_patch);
  } else if (typeof intent.exact_content === 'string') {
    hashed.content_sha = sha256(intent.exact_content);
  } else {
    throw new Refusal('write-intent-has-no-bytes',
      `${label} needs proposed_edits[] (old_string/new_string) or exact_content_or_patch; a hash cannot be made without the exact bytes`);
  }
  return hashed;
}

function fixLogSkeleton(seed, invocationId, now, writeIntents) {
  const findingIds = Array.isArray(seed.authorized_scope?.finding_ids) ? seed.authorized_scope.finding_ids : [];
  return {
    schema_version: 2,
    id: invocationId,
    command: 'aivv-fix',
    status: 'in-progress',
    invoked_at: now.toISOString(),
    cycle_count: 1,
    rework_retry_count: 0,
    max_rework_retries: 3,
    rework_retry_history: [],
    decision_ledger: findingIds.map((findingId) => ({ finding_id: findingId })),
    write_intents: writeIntents ?? [],
    fix_plans: [],
    files_modified: [],
    files_created: [],
    warnings: [],
    ...seed,
  };
}

function retryEntry(retry) {
  const history = Array.isArray(retry.history) ? retry.history : [];
  return {
    retry_number: history.length + 1,
    gate: retry.gate,
    finding_ids: retry.finding_ids,
    defect: retry.defect,
    evidence: retry.evidence,
    ...(retry.beyond_limit_reason === undefined ? {} : { beyond_limit_reason: retry.beyond_limit_reason }),
  };
}

// A prompt template is the outermost fenced block of its reference.
function templateBody(name) {
  if (typeof name !== 'string' || !/^[a-z]+(-[a-z]+)*$/.test(name)) {
    throw new Refusal('prompt-template-unknown', `template ${JSON.stringify(name)} is not a template name such as fix-challenger or verifier`);
  }
  const file = path.join(REFERENCES, `${name}-prompt-template.md`);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Refusal('prompt-template-unknown', `no template at ${file}`);
  }
  // The body runs from the first bare fence to the last one, so fenced excerpts inside it stay in.
  const lines = text.split(/\r?\n/);
  const start = lines.indexOf('```');
  const end = lines.lastIndexOf('```');
  if (start < 0 || end <= start) throw new Refusal('prompt-template-unreadable', `${file} has no closed fenced template block`);
  return lines.slice(start + 1, end).join('\n') + '\n';
}

function fillPrompt(request) {
  const values = request.values ?? {};
  const nonce = newNonce();
  const unfilled = new Set();
  const prompt = templateBody(request.template).replace(/\{([a-z][a-z0-9_.]*)[^{}\n]*\}/g, (token, key) => {
    if (!Object.hasOwn(values, key)) {
      unfilled.add(key);
      return token;
    }
    const value = typeof values[key] === 'string' ? values[key] : JSON.stringify(values[key], null, 2);
    return wrapUntrusted(nonce, key.toUpperCase(), value);
  });
  return { template: request.template, nonce, prompt, unfilled: [...unfilled] };
}

function build(request, now = new Date()) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Refusal('request-invalid', 'the request must be a JSON object');
  }
  const out = {
    invocation_id: request.invocation_id ?? `${incidentTimestamp(now)}-${randomBytes(2).toString('hex')}`,
  };
  if (request.write_intents !== undefined) {
    if (!Array.isArray(request.write_intents)) throw new Refusal('write-intent-invalid', 'write_intents must be an array');
    out.write_intents = request.write_intents.map(hashIntent);
  }
  if (request.fix_log !== undefined) out.fix_log = fixLogSkeleton(request.fix_log, out.invocation_id, now, out.write_intents);
  if (request.retry !== undefined) out.retry_entry = retryEntry(request.retry);
  if (request.prompts !== undefined) {
    if (!Array.isArray(request.prompts)) throw new Refusal('prompt-request-invalid', 'prompts must be an array');
    out.prompts = request.prompts.map(fillPrompt);
  }
  return out;
}

function main(argv) {
  if (argv.length !== 1 || argv[0] === '--help' || argv[0] === '-h') {
    (argv[0] === '--help' || argv[0] === '-h' ? process.stdout : process.stderr).write(USAGE + '\n');
    return argv.length === 1 ? 0 : 2;
  }
  try {
    let text;
    try {
      text = readFileSync(argv[0] === '-' ? 0 : argv[0], 'utf8');
    } catch (error) {
      throw new Refusal('request-unreadable', `cannot read ${argv[0]}: ${error.message}`);
    }
    let request;
    try {
      request = JSON.parse(text);
    } catch (error) {
      throw new Refusal('request-json-invalid', error.message);
    }
    process.stdout.write(JSON.stringify(build(request), null, 2) + '\n');
    return 0;
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    process.stdout.write(JSON.stringify({ status: 'error', reason: error.reason, detail: error.message }) + '\n');
    return 1;
  }
}

// exitCode, not process.exit(): a large prompt must finish flushing to a pipe.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
