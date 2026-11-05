#!/usr/bin/env node
// Explicit copy/verify import. Legacy trees are never writable authority.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolveStorage, readStorageContext, ensureStorage, ensurePrivateDirectory, validateContainedPath, withStorageLock } from './storage-paths.mjs';

const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const digest = (file) => fs.existsSync(file) ? hash(fs.readFileSync(file)) : null;
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = (code, message) => { throw Object.assign(new Error(`${code}: ${message}`), { code }); };
const importsDir = (ctx) => path.join(ctx.target_dir, 'imports');
function inside(root, file) {
  const rel = path.relative(root, file);
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}
function operations(ctx) {
  const root = importsDir(ctx);
  if (!fs.existsSync(root)) return [];
  if (fs.lstatSync(root).isSymbolicLink()) fail('STORAGE_IMPORT_UNSAFE', `symlink: ${root}`);
  return fs.readdirSync(root).sort().filter((name) => /^[a-f0-9-]+$/.test(name)).map((name) => { const dir = path.join(root, name); validateContainedPath(dir, root); return dir; });
}
function completedOperations(ctx) {
  return operations(ctx).filter((dir) => fs.existsSync(path.join(dir, 'manifest.json')))
    .map((directory) => ({ directory, manifest: JSON.parse(safeRead(path.join(directory, 'manifest.json'), ctx.target_dir)) }))
    .sort((a, b) => a.manifest.completed_at.localeCompare(b.manifest.completed_at));
}
export function listCompletedImports(ctx) {
  return completedOperations(ctx).map(({ manifest }) => manifest);
}
const validDigest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
// These paths are proof copies owned by this journal, never authority to follow
// the original source path or to activate any historical decision.
function verifiedCoverage(entry, directory) {
  const namespace = path.dirname(path.dirname(directory));
  if (entry.kind !== 'calibration' || !['copied', 'unchanged', 'kept-current', 'historical-only'].includes(entry.action)
    || typeof entry.key !== 'string' || !entry.key.startsWith('calibration/')
    || entry.destination !== path.resolve(namespace, entry.key)
    || !inside(path.join(namespace, 'calibration'), entry.destination) || !validDigest(entry.sha256)) return [];
  const sourceSnapshot = typeof entry.key === 'string' ? path.resolve(directory, 'source', entry.key) : '';
  if (!sourceSnapshot || !inside(path.join(directory, 'source', 'calibration'), sourceSnapshot)) return [];
  try { if (hash(safeRead(sourceSnapshot, directory)) !== entry.sha256) return []; } catch { return []; }
  if (!Array.isArray(entry.calibration_coverage)) return [];
  return entry.calibration_coverage.filter((coverage) => {
    if (!coverage || typeof coverage.source !== 'string' || !path.isAbsolute(coverage.source)
      || !validDigest(coverage.sha256) || typeof coverage.snapshot !== 'string'
      || !coverage.snapshot.startsWith('provenance/')) return false;
    const snapshot = path.resolve(directory, coverage.snapshot);
    if (!inside(path.join(directory, 'provenance'), snapshot)) return false;
    try { return hash(safeRead(snapshot, directory)) === coverage.sha256; } catch { return false; }
  });
}
function calibrationProvenance(file, ctx) {
  // Only an explicitly selected external calibration namespace can supply
  // journals. Project calibration has no target.json and is read as plain input.
  let calibration = path.dirname(file);
  while (path.basename(calibration) !== 'calibration' && path.dirname(calibration) !== calibration) calibration = path.dirname(calibration);
  if (path.basename(calibration) !== 'calibration') return null;
  const namespace = path.dirname(calibration);
  const metadataPath = path.join(namespace, 'target.json');
  if (!fs.existsSync(metadataPath)) return null;
  const metadataBytes = safeRead(metadataPath, namespace);
  let metadata;
  try { metadata = JSON.parse(metadataBytes); } catch { return null; }
  if (metadata.identity?.target !== ctx.target || metadata.instance_key !== path.basename(namespace)
    || ![1, 2].includes(metadata.identity?.version) || !validDigest(metadata.instance_key)
    || hash(JSON.stringify(metadata.identity)) !== metadata.instance_key) return null;
  assertNoPendingImports({ target_dir: namespace });
  const inputs = [{ path: metadataPath, sha256: hash(metadataBytes) }];
  const coverage = [];
  const completed = [];
  for (const directory of operations({ target_dir: namespace })) {
    const manifestPath = path.join(directory, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const bytes = safeRead(manifestPath, namespace);
    inputs.push({ path: manifestPath, sha256: hash(bytes) });
    let manifest;
    try { manifest = JSON.parse(bytes); } catch { continue; }
    if (manifest.version !== 1 || typeof manifest.completed_at !== 'string'
      || manifest.target !== ctx.target || !Array.isArray(manifest.files)) continue;
    completed.push({ directory, manifest });
  }
  completed.sort((a, b) => a.manifest.completed_at.localeCompare(b.manifest.completed_at));
  for (const { directory, manifest } of completed) {
    for (const entry of manifest.files) {
      if (!entry || entry.kind !== 'calibration' || entry.destination !== file
        || !['copied', 'unchanged', 'kept-current', 'historical-only'].includes(entry.action)
        || typeof entry.source !== 'string' || !path.isAbsolute(entry.source)
        || !validDigest(entry.sha256) || typeof entry.key !== 'string'
        || !entry.key.startsWith('calibration/')
        || entry.destination !== path.resolve(namespace, entry.key)
        || !inside(path.join(namespace, 'calibration'), entry.destination)) continue;
      const snapshot = path.resolve(directory, 'source', entry.key);
      if (!inside(path.join(directory, 'source', 'calibration'), snapshot)) continue;
      try {
        if (hash(safeRead(snapshot, namespace)) !== entry.sha256) continue;
      } catch { continue; }
      inputs.push({ path: snapshot, sha256: entry.sha256 });
      coverage.push({ source: entry.source, sha256: entry.sha256, snapshot });
      for (const inherited of verifiedCoverage(entry, directory)) {
        const inheritedSnapshot = path.resolve(directory, inherited.snapshot);
        inputs.push({ path: inheritedSnapshot, sha256: inherited.sha256 });
        coverage.push({ source: inherited.source, sha256: inherited.sha256, snapshot: inheritedSnapshot });
      }
    }
  }
  const unique = new Map();
  for (const entry of coverage) {
    const key = `${entry.source}\0${entry.sha256}`;
    unique.delete(key); unique.set(key, entry);
  }
  return { inputs, coverage: [...unique.values()] };
}
export function pendingImports(ctx) {
  return operations(ctx).filter((dir) => fs.existsSync(path.join(dir, 'pending.json')) && !fs.existsSync(path.join(dir, 'manifest.json')) && !fs.existsSync(path.join(dir, 'rolled-back.json')))
    .map((dir) => ({ ...JSON.parse(safeRead(path.join(dir, 'pending.json'), ctx.target_dir)), directory: dir }));
}
export function assertNoPendingImports(ctx) {
  const pending = pendingImports(ctx);
  if (pending.length) fail('STORAGE_IMPORT_PENDING', `retry the explicit import to recover ${pending[0].directory}`);
}
export function isImportPathVisible(ctx, file) {
  const absolute = path.resolve(file);
  return !pendingImports(ctx).some((operation) => operation.writes.some((entry) => path.resolve(entry.destination) === absolute));
}
export function calibrationImportStatus(ctx, file) {
  const source = fs.existsSync(file) ? fs.realpathSync(file) : path.resolve(file);
  const imported = completedOperations(ctx).flatMap(({ directory, manifest }) => manifest.files
    .filter((entry) => entry.kind === 'calibration' && entry.action !== 'skipped')
    .flatMap((entry) => [entry, ...verifiedCoverage(entry, directory).map((coverage) => ({
      source: coverage.source, sha256: coverage.sha256, destination: entry.destination,
    }))]));
  let records = imported.filter((entry) => entry.source === source);
  // Only the documented --migrate rename has an alias: <lens>.jsonl becomes
  // <lens>/legacy.jsonl in the same calibration root, with its original absent.
  // Changed bytes at this known path are ambiguous historical input requiring
  // explicit reconciliation; do not silently count them alongside the import.
  // No generic rename discovery or content/line deduplication is performed.
  if (!records.length && path.basename(source) === 'legacy.jsonl') {
    const lens = path.basename(path.dirname(source));
    const original = path.join(path.dirname(path.dirname(source)), `${lens}.jsonl`);
    if (!fs.existsSync(original)) {
      records = imported.filter((entry) => entry.source === original);
    }
  }
  const record = records.findLast((entry) => digest(entry.destination) === entry.sha256) ?? records.at(-1);
  return record ? { covered: true, changed: digest(source) !== record.sha256, digest: record.sha256, destination: record.destination } : { covered: false, changed: false };
}
function safeRead(file, root) {
  if (!inside(root, file)) fail('STORAGE_IMPORT_UNSAFE', 'source escapes selected namespace');
  let cursor = file;
  while (inside(root, cursor)) {
    if (fs.lstatSync(cursor).isSymbolicLink()) fail('STORAGE_IMPORT_UNSAFE', `symlink source: ${cursor}`);
    if (cursor === root) break;
    cursor = path.dirname(cursor);
  }
  return fs.readFileSync(file);
}
function walk(root) {
  if (!fs.existsSync(root)) return [];
  if (fs.lstatSync(root).isSymbolicLink()) fail('STORAGE_IMPORT_UNSAFE', `symlink source: ${root}`);
  const files = [];
  for (const item of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (item.isSymbolicLink()) fail('STORAGE_IMPORT_UNSAFE', `symlink source: ${path.join(root, item.name)}`);
    if (item.name.startsWith('.') || item.name === 'index.json' || item.name === 'compat-index.json') continue;
    const full = path.join(root, item.name);
    if (item.isDirectory()) files.push(...walk(full));
    else if (item.isFile()) files.push(full);
  }
  return files;
}
function sourceRoots(source) {
  const root = fs.realpathSync(source);
  if (fs.statSync(root).isFile()) return [{ root: path.dirname(root), selected: root, kind: root.split(path.sep).includes('calibration') ? 'calibration' : 'state' }];
  if (!fs.statSync(root).isDirectory()) fail('STORAGE_IMPORT_SOURCE', 'source must be a legacy record, state/calibration directory, .aivv directory, or target');
  const base = path.basename(root);
  if (['state', 'calibration', 'sessions'].includes(base)) return [{ root, kind: base === 'calibration' ? 'calibration' : 'state' }];
  const aivv = base === '.aivv' ? root : path.join(root, '.aivv');
  const roots = ['state', 'calibration'].map((kind) => ({ root: path.join(aivv, kind), kind })).filter(({ root: dir }) => fs.existsSync(dir));
  if (base !== '.aivv' && fs.existsSync(path.join(root, '.claude', 'sessions'))) roots.push({ root: path.join(root, '.claude', 'sessions'), kind: 'state' });
  if (!roots.length) fail('STORAGE_IMPORT_SOURCE', `no legacy stores found in ${root}`);
  return roots;
}
export function canonicalName(relative) {
  return relative.replace(/(^|[\\/])aivv-fix-/, '$1fix-').replace(/(^|[\\/])resolve-findings-/, '$1fix-');
}
function eligibility(bytes, relative, kind, ctx) {
  if (relative.split(path.sep).some((piece) => ['action-inbox', 'quarantine'].includes(piece))) return 'historical-only';
  try {
    const values = kind === 'calibration' && relative.endsWith('.jsonl')
      ? bytes.toString('utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line))
      : [JSON.parse(bytes.toString('utf8'))];
    if (!values.length || values.some((value) => !value || typeof value !== 'object' || Array.isArray(value))) return 'historical-only';
    if (values.some((value) => value.schema_version !== undefined && (!Number.isInteger(value.schema_version) || value.schema_version > 2 || value.schema_version < 1))) return 'historical-only';
    if (values.some((value) => value.target_project && path.resolve(value.target_project) !== ctx.target)) return 'target-mismatch';
    return 'eligible'; // Existing route/schema/freshness checks still decide execution.
  } catch { return 'historical-only'; }
}
function targetPath(ctx, kind, relative) {
  const root = kind === 'state' ? ctx.state_dir : ctx.calibration_dir;
  const destination = path.resolve(root, canonicalName(relative));
  if (!inside(root, destination)) fail('STORAGE_IMPORT_UNSAFE', `escaping destination: ${relative}`);
  return destination;
}
export function previewImport({ context: ctx, source }) {
  const prior = listCompletedImports(ctx).flatMap((operation) => operation.files);
  const files = [];
  for (const { root, kind, selected } of sourceRoots(source)) {
    for (const file of selected ? [selected] : walk(root)) {
      if (path.basename(root) === 'sessions' && !/^(aivv-fix-|resolve-findings-|wont-fix-registry\.json$)/.test(path.basename(file))) continue;
      const relative = path.relative(root, file);
      const bytes = safeRead(file, root);
      const destination = targetPath(ctx, kind, relative);
      const sha256 = hash(bytes);
      validateContainedPath(destination, ctx.target_dir);
      const destination_sha256 = digest(destination);
      const imported = prior.some((entry) => entry.destination === destination && entry.action !== 'skipped');
      const classification = eligibility(bytes, relative, kind, ctx);
      const conflict = classification === 'eligible' && (destination_sha256 !== null && destination_sha256 !== sha256 || destination_sha256 === null && imported);
      const provenance = kind === 'calibration' ? calibrationProvenance(file, ctx) : null;
      files.push({ ...(provenance ? { calibration_provenance: provenance } : {}), key: `${kind}/${canonicalName(relative).split(path.sep).join('/')}`, kind, source: file, relative, destination, sha256, destination_sha256, classification, previously_imported: imported, conflict, reason: imported && destination_sha256 === null ? 'would-restore-previously-imported-state' : conflict ? 'divergent-destination' : null });
    }
  }
  // Two legacy stores can map to one canonical filename; require separate scoped imports.
  if (new Set(files.map((entry) => entry.destination)).size !== files.length) fail('STORAGE_IMPORT_COLLISION', 'multiple source files map to one destination; preview each legacy store separately');
  const body = { version: 1, source: fs.realpathSync(source), target: ctx.target, target_dir: ctx.target_dir, files };
  return { ...body, preview_sha256: hash(JSON.stringify(body)) };
}
function writePrivate(file, bytes) {
  fs.writeFileSync(file, bytes, { mode: 0o600, flag: 'wx' });
}
function writeJson(file, value) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try { writePrivate(temporary, `${JSON.stringify(value, null, 2)}\n`); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function atomicCopy(source, destination, ctx) {
  const root = inside(ctx.state_dir, destination) ? ctx.state_dir : ctx.calibration_dir;
  ensurePrivateDirectory(path.dirname(destination), root);
  if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) fail('STORAGE_IMPORT_UNSAFE', `symlink destination: ${destination}`);
  const temporary = path.join(path.dirname(destination), `.import-${crypto.randomUUID()}`);
  try { writePrivate(temporary, fs.readFileSync(source)); fs.renameSync(temporary, destination); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
// Recovery never trusts filesystem absence as evidence that an import completed.
export function recoverIncompleteImports(ctx) {
  for (const operation of pendingImports(ctx)) {
    // Verify all paths before changing any, so unexpected external drift stays untouched.
    for (const entry of operation.writes) {
      if (!inside(ctx.state_dir, entry.destination) && !inside(ctx.calibration_dir, entry.destination)) fail('STORAGE_IMPORT_UNSAFE', 'pending journal escapes target store');
      validateContainedPath(entry.destination, ctx.target_dir);
      if (entry.before_sha256 !== null) {
        const backup = path.resolve(operation.directory, 'before', entry.key);
        validateContainedPath(backup, operation.directory);
        if (digest(backup) !== entry.before_sha256) fail('STORAGE_IMPORT_RECOVERY_CONFLICT', `invalid preserved backup ${backup}`);
      }
      const current = digest(entry.destination);
      if (current !== entry.before_sha256 && current !== entry.sha256) fail('STORAGE_IMPORT_RECOVERY_CONFLICT', `unexpected bytes at ${entry.destination}; preserved evidence: ${operation.directory}`);
    }
    for (const entry of operation.writes) {
      if (entry.before_sha256 === null) { if (fs.existsSync(entry.destination)) fs.unlinkSync(entry.destination); }
      else {
        const backup = path.join(operation.directory, 'before', entry.key);
        if (digest(backup) !== entry.before_sha256) fail('STORAGE_IMPORT_RECOVERY_CONFLICT', `invalid preserved backup ${backup}`);
        atomicCopy(backup, entry.destination, ctx);
      }
    }
    writeJson(path.join(operation.directory, 'rolled-back.json'), { recovered_at: new Date().toISOString() });
  }
}
export async function importState({ context: ctx, source, preview, choices = {}, hooks = {} }) {
  ensureStorage(ctx);
  return withStorageLock(ctx, async () => {
    recoverIncompleteImports(ctx);
    const current = previewImport({ context: ctx, source });
    if (!preview || preview.preview_sha256 !== current.preview_sha256) fail('STORAGE_IMPORT_STALE_PREVIEW', 'source/destination changed or no preview supplied; preview again');
    for (const [key, choice] of Object.entries(choices)) {
      if (!current.files.some((entry) => entry.key === key) || !['keep-current', 'replace'].includes(choice)) fail('STORAGE_IMPORT_CHOICE', `invalid choice for ${key}`);
    }
    let files = current.files.map((entry) => ({ ...entry, action: entry.classification !== 'eligible' ? 'historical-only' : entry.conflict ? choices[entry.key] === 'replace' ? 'copied' : choices[entry.key] === 'keep-current' ? 'kept-current' : 'skipped' : entry.sha256 === entry.destination_sha256 ? 'unchanged' : 'copied' }));
    // A fully identical replay needs no extra snapshots or manifest.
    const prior = completedOperations(ctx).flatMap(({ directory, manifest }) => manifest.files.map((entry) => ({ ...entry, verified_coverage: verifiedCoverage(entry, directory) })));
    const sameCoverage = (entry, old) => JSON.stringify((entry.calibration_provenance?.coverage ?? []).map(({ source, sha256 }) => ({ source, sha256 }))) === JSON.stringify(old.verified_coverage.map(({ source, sha256 }) => ({ source, sha256 })));
    if (files.length && files.every((entry) => entry.action !== 'copied' && prior.some((old) => old.source === entry.source && old.destination === entry.destination && old.sha256 === entry.sha256 && sameCoverage(entry, old) && (entry.action === 'unchanged' ? old.action !== 'skipped' : old.action === entry.action)))) return { status: 'unchanged', files };
    const operation = path.join(importsDir(ctx), crypto.randomUUID());
    ensurePrivateDirectory(operation, ctx.target_dir);
    for (const entry of files) {
      const snapshot = path.join(operation, 'source', entry.key);
      ensurePrivateDirectory(path.dirname(snapshot), operation);
      writePrivate(snapshot, safeRead(entry.source, sourceRoots(source).find(({ root }) => inside(root, entry.source)).root));
      if (digest(snapshot) !== entry.sha256 || digest(entry.source) !== entry.sha256) fail('STORAGE_IMPORT_SOURCE_CHANGED', `source changed during import: ${entry.source}`);
      if (entry.destination_sha256 !== null && entry.sha256 !== entry.destination_sha256) {
        const backup = path.join(operation, 'before', entry.key);
        ensurePrivateDirectory(path.dirname(backup), operation);
        writePrivate(backup, fs.readFileSync(entry.destination));
        if (digest(backup) !== entry.destination_sha256) fail('STORAGE_IMPORT_STALE_PREVIEW', `destination changed: ${entry.destination}`);
      }
    }
    // Preserve verified coverage bytes inside this completed operation. Readers
    // never need the old namespace, and another explicit hop can verify them here.
    files = files.map((entry) => {
      const { calibration_provenance: provenance, ...record } = entry;
      if (!provenance) return record;
      record.calibration_coverage = provenance.coverage.map((coverage, index) => {
        const relative = `provenance/${entry.key}/${index}`;
        const snapshot = path.join(operation, relative);
        ensurePrivateDirectory(path.dirname(snapshot), operation);
        // metadata is <namespace>/target.json; stay in that namespace only.
        const bytes = safeRead(coverage.snapshot, path.dirname(provenance.inputs[0].path));
        if (hash(bytes) !== coverage.sha256) fail('STORAGE_IMPORT_SOURCE_CHANGED', 'calibration proof changed');
        writePrivate(snapshot, bytes);
        return { source: coverage.source, sha256: coverage.sha256, snapshot: relative };
      });
      return record;
    });
    const checkProvenance = () => {
      for (const entry of current.files) {
        if (entry.calibration_provenance && JSON.stringify(calibrationProvenance(entry.source, ctx)) !== JSON.stringify(entry.calibration_provenance)) {
          fail('STORAGE_IMPORT_SOURCE_CHANGED', 'calibration provenance changed; preview again');
        }
      }
    };
    checkProvenance();
    const writes = files.filter((entry) => entry.action === 'copied').map((entry) => ({ ...entry, before_sha256: entry.destination_sha256 }));
    writeJson(path.join(operation, 'pending.json'), { version: 1, writes });
    await hooks.afterStage?.({ operation, files });
    checkProvenance();
    for (const entry of files) {
      if (digest(entry.source) !== entry.sha256 || digest(entry.destination) !== entry.destination_sha256) fail('STORAGE_IMPORT_STALE_PREVIEW', `bytes changed while staging ${entry.key}; retry explicit import to recover`);
    }
    for (const entry of writes) {
      atomicCopy(path.join(operation, 'source', entry.key), entry.destination, ctx);
      if (digest(entry.destination) !== entry.sha256) fail('STORAGE_IMPORT_VERIFY', `copy verification failed: ${entry.destination}`);
      await hooks.afterPublish?.({ operation, entry });
    }
    // Check every source again, even after publication; pending remains invisible on failure.
    for (const entry of files) if (digest(entry.source) !== entry.sha256) fail('STORAGE_IMPORT_SOURCE_CHANGED', `source changed: ${entry.source}; retry import to recover`);
    checkProvenance();
    const manifest = { version: 1, completed_at: new Date().toISOString(), preview_sha256: current.preview_sha256, source: current.source, target: current.target, files };
    writeJson(path.join(operation, 'manifest.json'), manifest);
    return { status: 'completed', manifest: path.join(operation, 'manifest.json'), files };
  }, { allowPendingImport: true });
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (command === '--help' || command === 'help') { console.log('Usage: state-import.mjs preview|import --target <target> --source <legacy-store> [--context <bound-context.json>] [--preview <preview.json>] [--choices <choices.json>]'); return; }
  const args = {};
  for (let index = 0; index < rest.length; index += 2) {
    if (!['--target', '--source', '--preview', '--choices', '--context'].includes(rest[index]) || !rest[index + 1]) fail('STORAGE_IMPORT_USAGE', `unknown/missing argument ${rest[index]}`);
    args[rest[index].slice(2)] = rest[index + 1];
  }
  if ((!args.target && !args.context) || !args.source || !['preview', 'import'].includes(command)) fail('STORAGE_IMPORT_USAGE', 'preview|import requires --target and --source');
  const context = args.context ? readStorageContext(args.context) : resolveStorage({ target: args.target });
  if (args.target && fs.realpathSync(args.target) !== context.target) fail('STORAGE_IMPORT_TARGET_MISMATCH', 'explicit target differs from saved context');
  const result = command === 'preview' ? previewImport({ context, source: args.source }) : await importState({ context, source: args.source, preview: args.preview ? readJson(args.preview) : null, choices: args.choices ? readJson(args.choices) : {} });
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
