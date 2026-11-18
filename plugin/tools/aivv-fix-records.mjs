#!/usr/bin/env node

// Emits the records an /aivv-fix run otherwise hand-builds: the invocation ID, write-intent
// hashes, the plan-stage fix-log skeleton, a retry-history entry, and filled, fenced prompts.
// It only produces records. pre-write-validator.mjs remains the gate for every write.

import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { incidentTimestamp } from './incident-state.mjs';
import { newNonce, wrapUntrusted } from './native-prompt-boundary.mjs';
import { editFrame, intentContent, multiEditSha, sha256 } from './pre-write-validator.mjs';
import { readStorageContext, withExistingStorageReadLock } from './storage-paths.mjs';

const REFERENCES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../skills/aivv-fix/references');
const USAGE = [
  'Usage: node aivv-fix-records.mjs <request.json | ->',
  '  The request is a JSON object; every key is optional and each produces one output key:',
  '    invocation_id   reuse this run\'s ID (omit to get a new one)',
  '    write_intents   [intent, ...]             -> write_intents with content_sha filled',
  '    fix_log         {source, target_project, storage_context, authorized_scope, ...}',
  '                    (storage_context is {instance_key, target_project, policy_target})',
  '                                              -> fix_log plan-stage skeleton',
  '                    (max_rework_retries is stamped 3 unless you pass the resolved setting)',
  '    retry           {history, gate, finding_ids, defect, evidence[, beyond_limit_reason]} -> retry_entry',
  '    prompts         [{template, values}, ...] -> prompts, each value fenced with a fresh nonce',
  '                    template: fix-challenger | verifier | investigator',
  '                    unfilled lists the {placeholders} left for you to fill; loop_sections',
  '                    lists each {For each ...} section and its placeholders, which repeat once',
  '                    per entry: a supplied value fills every copy, so expand them yourself',
  '                    when there is more than one entry',
  '    prior_repairs   {context, files}          -> prior_repairs: earlier /aivv-fix runs on this',
  '                    target whose fix logs changed any of files, newest first (report only)',
  '                    context: this run\'s storage context file; files: paths this run plans to change;',
  '                    needs invocation_id; a storage failure is returned as prior_repairs.error',
  '  Prints one JSON object. Validate fix-log writes with pre-write-validator.mjs as before.',
].join('\n');

class Refusal extends Error {
  constructor(reason, detail) {
    super(detail);
    this.reason = reason;
  }
}

// Every failure, anticipated or not, leaves as the same one-line JSON object: the message, no stack.
export function reportError(error) {
  return { status: 'error', reason: error instanceof Refusal ? error.reason : 'unexpected-error', detail: String(error?.message ?? error) };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, name) {
  if (!isObject(value)) throw new Refusal('request-invalid', `${name} must be an object`);
}

function hashIntent(intent, index) {
  const label = `write_intents[${index}] (${intent?.id ?? 'no id'})`;
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) {
    throw new Refusal('write-intent-invalid', `${label} must be an object`);
  }
  const hashed = { source_step: 'Step 4.4', ...intent };
  if (Array.isArray(intent.proposed_edits) && intent.proposed_edits.length > 0) {
    if (!intent.proposed_edits.every((edit) => edit && typeof edit === 'object' &&
        typeof edit.old_string === 'string' && typeof edit.new_string === 'string')) {
      throw new Refusal('write-intent-invalid', `${label}: every proposed_edits[] entry needs string old_string and new_string`);
    }
    hashed.proposed_edits = intent.proposed_edits.map((edit) => ({ ...edit, content_sha: sha256(editFrame(edit)) }));
    hashed.content_sha = multiEditSha(intent.proposed_edits);
  } else if (typeof intent.exact_content === 'string' || typeof intent.exact_content_or_patch === 'string') {
    hashed.content_sha = sha256(intentContent(intent));
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

// Placeholders on one line: brace groups opening with a lowercase key, matched with their nested braces,
// so an annotation such as {list — JSON array of {id, ...}} is one placeholder named by its outer key.
// Inside an inline `code span`, a group whose key is not followed directly by } is a literal example
// of a value shape (`{block_id: <N>}`), not a placeholder.
function placeholderTokens(line) {
  const tokens = [];
  let inCode = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '`') inCode = !inCode;
    if (line[i] !== '{' || !/[a-z]/.test(line[i + 1] ?? '')) continue;
    let depth = 0;
    let end = -1;
    for (let j = i; j < line.length; j += 1) {
      if (line[j] === '{') depth += 1;
      if (line[j] === '}' && (depth -= 1) === 0) {
        end = j;
        break;
      }
    }
    if (end < 0) continue;
    const key = /^\{([a-z][a-z0-9_.]*)/.exec(line.slice(i))[1];
    if (!(inCode && line[i + 1 + key.length] !== '}')) tokens.push({ start: i, end: end + 1, key });
    i = end;
  }
  return tokens;
}

function fillPrompt(request) {
  const values = request.values ?? {};
  const nonce = newNonce();
  const unfilled = new Set();
  const loopSections = [];
  let loop = null;
  const lines = templateBody(request.template).split('\n').map((line) => {
    // A line opening with {For each ...}, {/...} or another capitalised directive is an instruction to
    // the orchestrator, not a placeholder. A {For each ...} section runs to its {/For each ...} line or
    // the next ## heading; its placeholders repeat once per entry, which this helper does not expand.
    const directive = /^\s*\{(?:[A-Z]|\/)/.test(line);
    if (/^## /.test(line) || /^\s*\{\/For each\b/.test(line)) loop = null;
    if (/^\s*\{For each\b/.test(line)) {
      loop = { marker: line.trim().replace(/^\{|\}$/g, '').replace(/:$/, ''), fields: [] };
      loopSections.push(loop);
    }
    if (directive) return line;
    let out = '';
    let last = 0;
    for (const { start, end, key } of placeholderTokens(line)) {
      out += line.slice(last, start);
      last = end;
      if (loop && !loop.fields.includes(key)) loop.fields.push(key);
      if (!Object.hasOwn(values, key)) {
        unfilled.add(key);
        out += line.slice(start, end);
        continue;
      }
      const value = typeof values[key] === 'string' ? values[key] : JSON.stringify(values[key], null, 2);
      out += wrapUntrusted(nonce, key.toUpperCase().replaceAll('.', '_'), value);
    }
    return out + line.slice(last);
  });
  return {
    template: request.template,
    nonce,
    prompt: lines.join('\n'),
    unfilled: [...unfilled],
    loop_sections: loopSections.filter((section) => section.fields.length > 0),
  };
}

function relativeTo(file, ...roots) {
  const posix = (value) => String(value).replace(/\\/g, '/');
  let rel = path.posix.normalize(posix(file));
  for (const root of roots) {
    const prefix = path.posix.normalize(posix(root ?? '')).replace(/\/+$/, '');
    if (prefix && prefix !== '.' && rel.startsWith(`${prefix}/`)) {
      rel = rel.slice(prefix.length + 1);
      break;
    }
  }
  return rel.replace(/^(\.\/)+/, '');
}

// Earlier /aivv-fix runs on the same target that changed any planned file, newest first. Each
// run's rework limit resets per invocation, so a loop that starts a fresh run per round cannot see
// repeated repairs of one area any other way. This only reports: it blocks nothing and changes no
// budget, so a storage failure comes back as `error` instead of failing the rest of the request.
// It reads the active state folder only; archived logs are left out on purpose.
function priorRepairs(request, currentId) {
  requireObject(request, 'prior_repairs');
  if (typeof request.context !== 'string' || request.context === '') {
    throw new Refusal('request-invalid', "prior_repairs.context must be the path of this run's storage context file");
  }
  if (!Array.isArray(request.files) || request.files.length === 0 ||
      !request.files.every((file) => typeof file === 'string' && file !== '')) {
    throw new Refusal('request-invalid', 'prior_repairs.files must list the files this run plans to change');
  }
  let context;
  let logs;
  try {
    context = readStorageContext(request.context);
    logs = withExistingStorageReadLock(context, () => {
      if (!existsSync(context.state_dir)) return [];
      return readdirSync(context.state_dir).filter((name) => /^fix-.+\.json$/.test(name)).sort().map((name) => {
        try {
          return { name, log: JSON.parse(readFileSync(path.join(context.state_dir, name), 'utf8')) };
        } catch {
          return { name, log: null };
        }
      });
    }) ?? [];
  } catch (error) {
    return { count: 0, runs: [], error: `${request.context}: ${error.message}` };
  }
  const planned = new Set(request.files.map((file) => relativeTo(file, context.target)));
  const runs = [];
  const unreadable = [];
  for (const { name, log } of logs) {
    if (!isObject(log)) {
      unreadable.push(name);
      continue;
    }
    if (log.id === currentId) continue;
    const logTarget = typeof log.target_project === 'string' ? log.target_project : null;
    const touched = [log.files_modified, log.files_created].flatMap((list) => Array.isArray(list) ? list : [])
      .filter((file) => typeof file === 'string')
      .map((file) => relativeTo(file, logTarget, context.target));
    const files = [...new Set(touched.filter((file) => planned.has(file)))].sort();
    if (files.length > 0) {
      runs.push({ id: log.id ?? name, invoked_at: log.invoked_at ?? null, status: log.status ?? null, files });
    }
  }
  runs.sort((a, b) => String(b.invoked_at).localeCompare(String(a.invoked_at)));
  const latest = runs[0];
  const note = runs.length === 0
    ? 'No earlier /aivv-fix run on this target changed these files.'
    : `${runs.length} earlier /aivv-fix run${runs.length === 1 ? '' : 's'} on this target changed ` +
      `${[...new Set(runs.flatMap((run) => run.files))].sort().join(', ')}; the latest was ${latest.id}` +
      `${latest.status ? ` (${latest.status})` : ''}. If this fix repairs one of those changes, reassess the ` +
      'design before patching the same area again. This note does not block the fix or count against the rework limit.';
  return { count: runs.length, runs, ...(unreadable.length > 0 ? { unreadable } : {}), note };
}

function build(request, now = new Date()) {
  requireObject(request, 'the request');
  const out = {
    invocation_id: request.invocation_id ?? `${incidentTimestamp(now)}-${randomBytes(2).toString('hex')}`,
  };
  if (request.write_intents !== undefined) {
    if (!Array.isArray(request.write_intents)) throw new Refusal('write-intent-invalid', 'write_intents must be an array');
    out.write_intents = request.write_intents.map(hashIntent);
  }
  if (request.fix_log !== undefined) {
    requireObject(request.fix_log, 'fix_log');
    const storage = request.fix_log.storage_context;
    if (storage !== undefined && !(isObject(storage) && ['instance_key', 'target_project', 'policy_target'].every((key) => typeof storage[key] === 'string'))) {
      throw new Refusal('request-invalid', 'fix_log.storage_context must be the object {instance_key, target_project, policy_target}, not the storage context file path');
    }
  }
  if (request.fix_log !== undefined) out.fix_log = fixLogSkeleton(request.fix_log, out.invocation_id, now, out.write_intents);
  if (request.retry !== undefined) {
    requireObject(request.retry, 'retry');
    if (request.retry.history !== undefined && !Array.isArray(request.retry.history)) {
      throw new Refusal('request-invalid', 'retry.history must be an array (the existing rework_retry_history)');
    }
    out.retry_entry = retryEntry(request.retry);
  }
  if (request.prompts !== undefined) {
    if (!Array.isArray(request.prompts)) throw new Refusal('prompt-request-invalid', 'prompts must be an array');
    out.prompts = request.prompts.map((prompt, index) => {
      requireObject(prompt, `prompts[${index}]`);
      if (prompt.values !== undefined) requireObject(prompt.values, `prompts[${index}].values`);
      return fillPrompt(prompt);
    });
  }
  if (request.prior_repairs !== undefined) {
    if (typeof request.invocation_id !== 'string' || request.invocation_id === '') {
      throw new Refusal('request-invalid', "prior_repairs needs this run's invocation_id, so the run does not count itself");
    }
    out.prior_repairs = priorRepairs(request.prior_repairs, request.invocation_id);
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
    process.stdout.write(JSON.stringify(reportError(error)) + '\n');
    return 1;
  }
}

// exitCode, not process.exit(): a large prompt must finish flushing to a pipe.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
