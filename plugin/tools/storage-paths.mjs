#!/usr/bin/env node
/** Canonical runtime paths. Resolution and validation never create directories.
 * withStorageLock is async, non-reentrant, and fails retryably when occupied.
 * roots/stat/identityPlatform/nativeCommand are internal test seams, never environment configuration.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sessionNonce = crypto.randomUUID();
function fail(code, message) { throw Object.assign(new Error(`${code}: ${message}`), { code }); }
function git(cwd, args) {
  try { return execFileSync('git', ['-C', cwd, 'rev-parse', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}
function canonical(p) { return fs.realpathSync(path.resolve(p)); }
export function signatureForStats(stats, platform = process.platform) {
  const value = key => String(stats[key] ?? 0);
  const birth = value('birthtimeNs');
  // Some hosts synthesize birthtime from ctime/epoch. Darwin/Windows expose
  // creation time natively; elsewhere equality cannot establish provenance.
  const reliable = value('dev') !== '0' && value('ino') !== '0' && BigInt(birth) > 0n
    && (['darwin', 'win32', 'linux'].includes(platform))
    && (['darwin', 'win32'].includes(platform) || birth !== value('ctimeNs'));
  return { dev: value('dev'), ino: value('ino'), birthtime_ns: reliable ? birth : '0', reliable };
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function observeIdentity(target, gitDir, options = {}, version) {
  const platform = options.identityPlatform ?? process.platform;
  const stat = options.stat ?? (p => fs.statSync(p, { bigint: true }));
  const paths = [...new Set([target, ...(gitDir ? [gitDir] : [])])];
  const before = new Map(paths.map(p => [p, signatureForStats(stat(p), platform)]));
  const signatures = new Map(before);
  let reliable = [...before.values()].every(value => value.reliable);
  const useVolumes = version === 2 || (version === undefined && platform === 'darwin');
  if (useVolumes) {
    const command = options.nativeCommand ?? execFileSync;
    const volumes = new Map();
    try {
      for (const p of paths) {
        const run = (executable, args, input) => command(executable, args, {
          encoding: 'utf8', timeout: 3000, maxBuffer: 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'], ...(input === undefined ? {} : { input }),
        });
        const lines = String(run('/bin/df', ['-P', p])).trim().split(/\r?\n/);
        const device = lines.length === 2 ? lines[1].trim().split(/\s+/)[0] : '';
        if (!/^\/dev\/[a-zA-Z0-9._-]+$/.test(device)) throw new Error('invalid backing device');
        if (!volumes.has(device)) {
          const plist = run('/usr/sbin/diskutil', ['info', '-plist', device]);
          const uuid = String(run('/usr/bin/plutil', ['-extract', 'VolumeUUID', 'raw', '-o', '-', '--', '-'], plist)).trim();
          if (!uuidPattern.test(uuid)) throw new Error('invalid volume UUID');
          volumes.set(device, uuid.toLowerCase());
        }
        const value = before.get(p);
        signatures.set(p, { volume_uuid: volumes.get(device), ino: value.ino, birthtime_ns: value.birthtime_ns, reliable: value.reliable });
      }
    } catch {
      reliable = false;
    }
    // A volume lookup is not an atomic filesystem observation. Refuse replacement
    // during discovery rather than binding the UUID to a stale inode signature.
    for (const p of paths) {
      if (JSON.stringify(before.get(p)) !== JSON.stringify(signatureForStats(stat(p), platform))) fail('STORAGE_IDENTITY_MISMATCH', 'filesystem instance changed during volume discovery');
    }
  }
  // Discovery failure must not silently attach the former reliable v1 store.
  const selected = useVolumes && reliable ? signatures : before;
  const identity = {
    version: useVolumes && reliable ? 2 : 1, target, target_signature: selected.get(target),
    git_dir: gitDir ? { path: gitDir, signature: selected.get(gitDir) } : null,
    reliable,
  };
  if (!reliable) identity.session_nonce = sessionNonce;
  return identity;
}
function rootPaths(platform, home, env) {
  if (platform === 'darwin') return { root: path.join(home, 'Library', 'Application Support', 'AIVV'), cache_root: path.join(home, 'Library', 'Caches', 'AIVV') };
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA;
    if (!local || !path.win32.isAbsolute(local)) fail('STORAGE_ROOT_UNAVAILABLE', 'LOCALAPPDATA must be an absolute per-user path');
    const root = path.win32.join(local, 'AIVV');
    return { root, cache_root: path.win32.join(root, 'cache') };
  }
  if (platform !== 'linux') fail('STORAGE_PLATFORM_UNSUPPORTED', `no storage root defined for ${platform}`);
  const state = env.XDG_STATE_HOME && path.isAbsolute(env.XDG_STATE_HOME) ? env.XDG_STATE_HOME : path.join(home, '.local', 'state');
  const cache = env.XDG_CACHE_HOME && path.isAbsolute(env.XDG_CACHE_HOME) ? env.XDG_CACHE_HOME : path.join(home, '.cache');
  return { root: path.join(state, 'aivv'), cache_root: path.join(cache, 'aivv') };
}
function ancestors(cwd, target) {
  const result = [target];
  let current = cwd;
  if (current === target || current.startsWith(`${target}${path.sep}`)) {
    while (current !== target) { result.push(current); current = path.dirname(current); }
  }
  return [...new Set(result)];
}
export function resolveStorage(options = {}) {
  const cwd = canonical(options.cwd ?? process.cwd());
  const target = canonical(options.target ?? git(cwd, ['--show-toplevel']) ?? cwd);
  if (!fs.statSync(target).isDirectory()) fail('STORAGE_TARGET_INVALID', 'target must be an existing directory');
  const platform = options.platform ?? process.platform;
  const roots = options.roots ?? rootPaths(platform, options.home ?? os.homedir(), options.env ?? process.env);
  const gitPath = git(target, ['--absolute-git-dir']);
  const gitDir = gitPath ? canonical(gitPath) : null;
  const identity = observeIdentity(target, gitDir, options);
  const instanceKey = crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  const join = platform === 'win32' ? path.win32.join : path.join;
  const targetDir = join(roots.root, 'targets', instanceKey);
  const legacy = ancestors(cwd, target);
  return {
    target, instance_key: instanceKey, root: roots.root, cache_root: roots.cache_root,
    target_dir: targetDir, metadata_path: join(targetDir, 'target.json'),
    state_dir: join(targetDir, 'state'), calibration_dir: join(targetDir, 'calibration'),
    reports_dir: join(roots.cache_root, 'targets', instanceKey, 'reports'), identity,
    legacy_state_dirs: legacy.flatMap(p => [path.join(p, '.aivv', 'state'), path.join(p, '.claude', 'sessions')]),
    legacy_calibration_dirs: legacy.map(p => path.join(p, '.aivv', 'calibration')),
  };
}

/** Reject symlinks at/within an owned root. Existing ancestor aliases (/var on
 * macOS, for example) are outside our ownership and are resolved by the OS. */
export function validateContainedPath(candidate, boundary) {
  const root = path.resolve(boundary); const resolved = path.resolve(candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) fail('STORAGE_PATH_ESCAPE', 'path escapes selected storage root');
  const relative = path.relative(root, resolved);
  let current = root;
  for (const part of ['', ...relative.split(path.sep).filter(Boolean)]) {
    if (part) current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) fail('STORAGE_SYMLINK', `refusing redirected storage path: ${current}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return resolved;
}
function privateWindows(dir) {
  // A fresh DACL avoids inheriting broad grants from a custom LOCALAPPDATA.
  const script = `$p='${dir.replaceAll("'", "''")}'; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object System.Security.AccessControl.DirectorySecurity; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,"FullControl","ContainerInherit,ObjectInherit","None","Allow"); $acl.AddAccessRule($rule); Set-Acl -LiteralPath $p -AclObject $acl -ErrorAction Stop`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { stdio: 'pipe' });
}
export function ensurePrivateDirectory(dir, boundary = dir) {
  validateContainedPath(dir, boundary);
  const root = path.resolve(boundary); const destination = path.resolve(dir);
  // mkdir ancestors privately too, without changing pre-existing home parents.
  const missing = []; let current = root;
  while (!fs.existsSync(current)) { missing.unshift(current); const parent = path.dirname(current); if (parent === current) break; current = parent; }
  for (const item of missing) {
    try { fs.mkdirSync(item, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const dirs = [root];
  for (const part of path.relative(root, destination).split(path.sep).filter(Boolean)) dirs.push(path.join(dirs.at(-1), part));
  for (const item of dirs) {
    validateContainedPath(item, root);
    try { fs.mkdirSync(item, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const info = fs.lstatSync(item);
    if (!info.isDirectory() || info.isSymbolicLink()) fail('STORAGE_SYMLINK', `not a private storage directory: ${item}`);
    if (process.platform === 'win32') privateWindows(item);
    else if ((typeof process.getuid === 'function' && info.uid !== process.getuid()) || (info.mode & 0o077)) fail('STORAGE_PERMISSIONS', `storage directory must be owned by current user with mode 0700: ${item}`);
  }
  return destination;
}
function compareObservedSignature(expected, observed) {
  for (const key of ['dev', 'volume_uuid', 'ino', 'birthtime_ns']) {
    if (expected[key] && expected[key] !== '0' && expected[key] !== observed[key]) fail('STORAGE_IDENTITY_MISMATCH', 'target filesystem instance changed since context resolution');
  }
  if (expected.reliable && !observed.reliable) fail('STORAGE_IDENTITY_MISMATCH', 'target instance signals are no longer trustworthy');
}
function validIdentity(identity) {
  if (!identity || ![1, 2].includes(identity.version) || typeof identity.target !== 'string' || typeof identity.reliable !== 'boolean') return false;
  const signatures = [identity.target_signature, ...(identity.git_dir ? [identity.git_dir.signature] : [])];
  if (identity.git_dir && typeof identity.git_dir.path !== 'string') return false;
  return signatures.every(signature => signature && typeof signature.reliable === 'boolean'
    && ['ino', 'birthtime_ns', ...(identity.version === 1 ? ['dev'] : [])].every(key => typeof signature[key] === 'string' && /^\d+$/.test(signature[key]))
    && (!identity.reliable || (signature.reliable && BigInt(signature.ino) > 0n && BigInt(signature.birthtime_ns) > 0n))
    && (identity.version !== 2 || (identity.reliable && uuidPattern.test(signature.volume_uuid ?? '') && !('dev' in signature))));
}
function validateObservedIdentity(identity, options = {}) {
  if (!validIdentity(identity)) fail('STORAGE_CONTEXT_INVALID', 'invalid invocation identity');
  if (canonical(identity.target) !== identity.target) fail('STORAGE_IDENTITY_MISMATCH', 'target path changed since context resolution');
  const observedGit = git(identity.target, ['--absolute-git-dir']);
  const gitDir = observedGit ? canonical(observedGit) : null;
  if (gitDir !== (identity.git_dir?.path ?? null)) fail('STORAGE_IDENTITY_MISMATCH', 'Git directory changed since context resolution');
  const observed = observeIdentity(identity.target, gitDir, options, identity.version);
  if (identity.version === 2 && observed.version !== 2) fail('STORAGE_IDENTITY_MISMATCH', 'volume identity is no longer trustworthy');
  compareObservedSignature(identity.target_signature, observed.target_signature);
  if (identity.git_dir) compareObservedSignature(identity.git_dir.signature, observed.git_dir.signature);
}
/** Carry one invocation's context across CLI child processes. Standard roots are
 * recomputed, never trusted from the file. Uncertain contexts require an explicit
 * supplied handle and are never discovered automatically from a target path. */
export function readStorageContext(file, options = {}) {
  if (fs.lstatSync(file).isSymbolicLink()) fail('STORAGE_SYMLINK', 'context file must not be a symlink');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  const identity = saved.identity;
  if (!validIdentity(identity)) fail('STORAGE_CONTEXT_INVALID', 'invalid invocation context');
  if (!identity.reliable && !/^[0-9a-f-]{36}$/.test(identity.session_nonce ?? '')) fail('STORAGE_CONTEXT_INVALID', 'uncertain context requires its invocation nonce');
  validateObservedIdentity(identity, options);
  const current = resolveStorage({ ...options, target: identity.target });
  const instanceKey = crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  if (instanceKey !== saved.instance_key) fail('STORAGE_CONTEXT_INVALID', 'context digest does not match its identity');
  const targetDir = path.join(current.root, 'targets', instanceKey);
  const context = { ...current, identity, instance_key: instanceKey, target_dir: targetDir,
    metadata_path: path.join(targetDir, 'target.json'), state_dir: path.join(targetDir, 'state'), calibration_dir: path.join(targetDir, 'calibration'), reports_dir: path.join(current.cache_root, 'targets', instanceKey, 'reports') };
  return validateStorage(context, options);
}
export function validateStorage(context, options = {}) {
  validateObservedIdentity(context.identity, options);
  for (const item of [context.target_dir, context.state_dir, context.calibration_dir]) validateContainedPath(item, context.root);
  if (fs.existsSync(context.metadata_path)) {
    validateContainedPath(context.metadata_path, context.root);
    let existing;
    try { existing = JSON.parse(fs.readFileSync(context.metadata_path, 'utf8')); } catch { fail('STORAGE_IDENTITY_INVALID', 'target metadata cannot be read'); }
    if (JSON.stringify(existing.identity) !== JSON.stringify(context.identity) || existing.instance_key !== context.instance_key) fail('STORAGE_IDENTITY_MISMATCH', 'target metadata differs from resolved filesystem instance');
  }
  return context;
}
export function contextForStateDirectory(stateDir) {
  const absolute = path.resolve(stateDir);
  const metadata = path.join(path.dirname(absolute), 'target.json');
  let saved;
  try { saved = JSON.parse(fs.readFileSync(metadata, 'utf8')); }
  catch { fail('STORAGE_STATE_DIR_UNBOUND', 'selected state directory has no current target binding'); }
  const context = resolveStorage({ target: saved.identity?.target });
  if (path.resolve(context.state_dir) !== absolute) fail('STORAGE_STATE_DIR_UNBOUND', 'selected state directory is not canonical for the observed target instance');
  return validateStorage(context);
}
export function ensureReportCache(context) {
  if (context.cache_root.startsWith(`${context.root}${path.sep}`)) validateContainedPath(context.cache_root, context.root);
  ensurePrivateDirectory(context.reports_dir, context.cache_root); return context;
}
export function ensureStorage(context) {
  validateStorage(context);
  ensurePrivateDirectory(context.state_dir, context.root);
  ensurePrivateDirectory(context.calibration_dir, context.root);
  try {
    fs.writeFileSync(context.metadata_path, `${JSON.stringify({ instance_key: context.instance_key, identity: context.identity }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  } catch (error) { if (error.code !== 'EEXIST') throw error; }
  validateStorage(context); return context;
}
function pendingImports(context) {
  const dir = path.join(context.target_dir, 'imports'); validateContainedPath(dir, context.root);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => {
    const item = path.join(dir, name); validateContainedPath(item, context.root);
    return fs.existsSync(path.join(item, 'pending.json')) && !fs.existsSync(path.join(item, 'manifest.json')) && !fs.existsSync(path.join(item, 'rolled-back.json'));
  });
}
function acquireStorageLock(context) {
  const lock = path.join(context.target_dir, '.storage-lock');
  validateContainedPath(lock, context.root ?? context.target_dir);
  try { fs.mkdirSync(lock, { mode: 0o700 }); }
  catch (error) { if (error.code === 'EEXIST') fail('STORAGE_BUSY', `target storage is locked; retry after active operation completes; if interrupted, inspect owner.json and use recover-lock after its process exits: ${lock}`); throw error; }
  const owner = path.join(lock, 'owner.json');
  try { fs.writeFileSync(owner, `${JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() })}\n`, { flag: 'wx', mode: 0o600 }); }
  catch (error) { fs.rmdirSync(lock); throw error; }
  return () => { fs.unlinkSync(owner); fs.rmdirSync(lock); };
}
export async function withStorageLock(context, fn, { allowPendingImport = false } = {}) {
  ensureStorage(context);
  const release = acquireStorageLock(context);
  try {
    if (!allowPendingImport && pendingImports(context).length) fail('STORAGE_IMPORT_PENDING', 'an interrupted import needs explicit retry/recovery before dependent mutation');
    return await fn();
  } finally { release(); }
}
/** Atomically snapshot existing external state against import publication.
 * Returns undefined without calling fn when no namespace exists. Historical
 * external contexts may use {target_dir, state_dir, root}; this is read-only
 * coordination, never a claim of current target/mutation authority.
 * Callback must synchronously read all data it returns; do not return a Promise.
 */
export function withExistingStorageReadLock(context, fn) {
  validateContainedPath(context.target_dir, context.root ?? context.target_dir);
  if (!fs.existsSync(context.target_dir)) return undefined;
  const metadata = path.join(context.target_dir, 'target.json');
  validateContainedPath(metadata, context.root ?? context.target_dir);
  let saved;
  try { saved = JSON.parse(fs.readFileSync(metadata, 'utf8')); }
  catch { fail('STORAGE_IDENTITY_INVALID', 'external read namespace has no valid target metadata'); }
  if (!/^[a-f0-9]{64}$/.test(saved.instance_key ?? '') || path.basename(context.target_dir) !== saved.instance_key || !validIdentity(saved.identity)) fail('STORAGE_IDENTITY_INVALID', 'external read namespace metadata is invalid');
  const release = acquireStorageLock(context);
  try {
    const result = fn();
    if (result && typeof result.then === 'function') fail('STORAGE_READ_ASYNC', 'read lock callback must synchronously snapshot its result');
    return result;
  } finally { release(); }
}

async function main(argv) {
  const command = argv.shift() ?? 'resolve'; let target; let child = []; let area = 'state'; let relative; let source; let contextFile; let append = false; let prefix = ''; let archive = false;
  while (argv.length) {
    const arg = argv.shift();
    if (arg === '--target' && argv.length) target = argv.shift();
    else if (arg === '--context' && argv.length) contextFile = argv.shift();
    else if (arg === '--area' && argv.length) area = argv.shift();
    else if (arg === '--relative' && argv.length) relative = argv.shift();
    else if (arg === '--source' && argv.length) source = argv.shift();
    else if (arg === '--append') append = true;
    else if (arg === '--prefix' && argv.length) prefix = argv.shift();
    else if (arg === '--archive') archive = true;
    else if (arg === '--') { child = argv; break; }
    else fail('STORAGE_USAGE', 'usage: storage-paths.mjs resolve|ensure|ensure-cache|read|list|write|lock|recover-lock [--target directory|--context invocation.json] [--area state|calibration --relative path --source file] [-- command args...]');
  }
  const context = contextFile ? readStorageContext(contextFile) : resolveStorage({ ...(target ? { target } : {}) });
  if (target && canonical(target) !== context.target) fail('STORAGE_CONTEXT_INVALID', 'target conflicts with supplied invocation context');
  if (command === 'resolve') { validateStorage(context); console.log(JSON.stringify(context)); }
  else if (command === 'ensure') { ensureStorage(context); ensureReportCache(context); console.log(JSON.stringify(context)); }
  else if (command === 'ensure-cache') { ensureReportCache(context); console.log(JSON.stringify(context)); }
  else if (['read', 'list'].includes(command) && ['state', 'calibration'].includes(area)) {
    validateStorage(context);
    const result = withExistingStorageReadLock(context, () => {
      if (pendingImports(context).length) fail('STORAGE_IMPORT_PENDING', 'an interrupted import needs explicit retry/recovery before active reads');
      const boundary = area === 'state' ? context.state_dir : context.calibration_dir;
      if (command === 'read') {
        if (!relative || path.isAbsolute(relative)) fail('STORAGE_PATH_ESCAPE', 'read requires a relative file path');
        const file = validateContainedPath(path.resolve(boundary, relative), boundary);
        if (file === boundary || !fs.existsSync(file) || !fs.statSync(file).isFile()) fail('STORAGE_NOT_FOUND', 'selected runtime file does not exist');
        return fs.readFileSync(file);
      }
      const names = [];
      function collect(dir, recurse) {
        validateContainedPath(dir, boundary);
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
          const file = validateContainedPath(path.join(dir, entry.name), boundary);
          if (entry.isFile() && entry.name.startsWith(prefix)) names.push(path.relative(boundary, file));
          else if (recurse && entry.isDirectory()) collect(file, true);
        }
      }
      collect(boundary, false);
      if (archive) collect(path.join(boundary, 'archive'), true);
      return names.sort();
    });
    if (command === 'list') console.log(JSON.stringify(result ?? []));
    else if (result === undefined) fail('STORAGE_NOT_FOUND', 'selected target has no runtime store');
    else process.stdout.write(result);
  }
  else if (command === 'recover-lock') {
    validateStorage(context);
    const lock = path.join(context.target_dir, '.storage-lock');
    validateContainedPath(lock, context.root);
    const owner = JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'), 'utf8'));
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) fail('STORAGE_BUSY', 'malformed owner requires explicit filesystem inspection; lock was preserved');
    try { process.kill(owner.pid, 0); fail('STORAGE_BUSY', 'owner process is still active'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    // Preserve the whole abandoned lock rather than deleting history.
    const preserved = path.join(context.target_dir, `.abandoned-lock-${crypto.randomUUID()}`);
    fs.renameSync(lock, preserved); console.log(JSON.stringify({ preserved }));
  }
  else if (command === 'write' && relative && source && ['state', 'calibration'].includes(area)) {
    if (path.isAbsolute(relative)) fail('STORAGE_PATH_ESCAPE', 'write path must be relative');
    await withStorageLock(context, async () => {
      const boundary = area === 'state' ? context.state_dir : context.calibration_dir;
      const destination = validateContainedPath(path.resolve(boundary, relative), boundary);
      if (destination === boundary) fail('STORAGE_PATH_ESCAPE', 'write requires a file path');
      const bytes = fs.readFileSync(source);
      ensurePrivateDirectory(path.dirname(destination), boundary);
      if (append) fs.appendFileSync(destination, bytes, { mode: 0o600 });
      else {
        const temporary = path.join(path.dirname(destination), `.write-${crypto.randomUUID()}`);
        try { fs.writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600 }); fs.renameSync(temporary, destination); }
        finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
      }
      console.log(JSON.stringify({ path: destination }));
    });
  }
  else if (command === 'lock' && child.length) {
    const code = await withStorageLock(context, () => new Promise((resolve, reject) => {
      const proc = spawn(child[0], child.slice(1), { stdio: 'inherit' });
      proc.once('error', reject); proc.once('exit', (status, signal) => signal ? reject(new Error(`child terminated by ${signal}`)) : resolve(status));
    })); process.exitCode = code;
  } else fail('STORAGE_USAGE', 'unknown command or missing lock child command');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
