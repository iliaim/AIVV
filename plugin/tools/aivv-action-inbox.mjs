#!/usr/bin/env node
/**
 * Opt-in, loopback-only Action Inbox for AIVV viewer reports.
 * It queues typed remediation requests; it never runs remediation itself.
 */
import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveStorage, readStorageContext, withExistingStorageReadLock, withStorageLock, validateContainedPath, ensurePrivateDirectory } from "./storage-paths.mjs";
import { isImportPathVisible, assertNoPendingImports } from "./state-import.mjs";

const MAX_BODY_BYTES = 32 * 1024;
const DEFAULT_TTL_SECONDS = 15 * 60;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function fail(code, message, exitCode = 64) {
  const error = new Error(`${code}: ${message}`);
  error.exitCode = exitCode;
  throw error;
}

function usage() {
  process.stdout.write(`Usage:\n  node aivv-action-inbox.mjs serve --review-file <file> --state-dir <dir> --html-script <file> [--fix-dir <dir>] [--wont-fix <file>] [--ttl-seconds <n>]\n  node aivv-action-inbox.mjs inspect --request-id <uuid> --state-dir <dir> --target <dir>\n  node aivv-action-inbox.mjs claim --request-id <uuid> --state-dir <dir> --target <dir>\n`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") return { command: "help" };
  const args = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith("--")) fail("ACTION_INBOX_USAGE", `unexpected argument ${key}`);
    const name = key.slice(2).replaceAll("-", "_");
    const value = rest[++index];
    if (!value || value.startsWith("--")) fail("ACTION_INBOX_USAGE", `missing value for ${key}`);
    args[name] = value;
  }
  return args;
}

function readJson(file, code) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(code, `${file}: ${error.message}`, 65);
  }
}

function gitValue(target, args, code) {
  try {
    return execFileSync("git", ["-C", target, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    fail(code, `target must be a Git worktree: ${target}`, 65);
  }
}

function storageContext(args, target, storageOptions) {
  const context = args.storage_context ? readStorageContext(args.storage_context) : resolveStorage({ ...storageOptions, target });
  if (context.target !== fs.realpathSync(target)) fail("ACTION_INBOX_CONTEXT_TARGET_MISMATCH", "storage context does not match selected target", 65);
  return context;
}

function targetContext(review) {
  const configured = typeof review.target_project === "string" && review.target_project.trim() ? review.target_project : process.cwd();
  let targetProject;
  try {
    targetProject = fs.realpathSync(configured);
  } catch {
    fail("ACTION_INBOX_TARGET_INVALID", `review target does not exist: ${configured}`, 65);
  }
  const targetRepository = gitValue(targetProject, ["rev-parse", "--show-toplevel"], "ACTION_INBOX_TARGET_NOT_GIT");
  const sourceRevision = gitValue(targetProject, ["rev-parse", "HEAD"], "ACTION_INBOX_REVISION_UNAVAILABLE");
  return { targetProject, targetRepository, sourceRevision, workspaceStateSha256: workspaceStateSha256(targetProject) };
}

function workspaceStateSha256(target) {
  try {
    const status = execFileSync("git", ["-C", target, "status", "--porcelain=v1", "-z"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const diff = execFileSync("git", ["-C", target, "diff", "--no-color", "--no-ext-diff", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return createHash("sha256").update(status).update("\u0000").update(diff).digest("hex");
  } catch {
    fail("ACTION_INBOX_WORKSPACE_SNAPSHOT_UNAVAILABLE", `cannot snapshot Git workspace: ${target}`, 65);
  }
}

function reviewFindingIds(review) {
  const findings = Array.isArray(review.findings) ? review.findings : [];
  return new Set(findings.map((finding) => finding?.ref ?? finding?.id).filter((value) => typeof value === "string" && value.trim()));
}

function isoAfter(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function sendJson(response, status, body) {
  const encoded = JSON.stringify(body);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(encoded) });
  response.end(encoded);
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

function exactEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("request body exceeds limit"), { code: "ACTION_INBOX_BODY_TOO_LARGE" }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("request body must be JSON"), { code: "ACTION_INBOX_INVALID_JSON" }));
      }
    });
    request.on("error", reject);
  });
}

function validateSubmission(body, review, expectedReviewId) {
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("ACTION_INBOX_INVALID_REQUEST", "request must be an object", 422);
  const allowed = new Set(["kind", "request_id", "review_id", "finding_ids", "decisions"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) fail("ACTION_INBOX_INVALID_REQUEST", "unsupported request field", 422);
  if (body.kind !== "aivv.remediation-request.v1") fail("ACTION_INBOX_INVALID_REQUEST", "unsupported request kind", 422);
  if (typeof body.request_id !== "string" || !REQUEST_ID.test(body.request_id)) fail("ACTION_INBOX_INVALID_REQUEST", "request_id must be a UUID", 422);
  if (body.review_id !== expectedReviewId) fail("ACTION_INBOX_REVIEW_MISMATCH", "request review_id does not match the served review", 422);
  if (!Array.isArray(body.finding_ids) || body.finding_ids.length < 1 || body.finding_ids.length > 50 || new Set(body.finding_ids).size !== body.finding_ids.length || body.finding_ids.some((id) => typeof id !== "string" || !id || id.length > 160)) {
    fail("ACTION_INBOX_INVALID_FINDINGS", "finding_ids must be a non-empty unique bounded string array", 422);
  }
  const known = reviewFindingIds(review);
  if (body.finding_ids.some((id) => !known.has(id))) fail("ACTION_INBOX_FINDING_NOT_IN_REVIEW", "every selected finding must belong to the served review", 422);
  if (!Array.isArray(body.decisions) || body.decisions.length !== body.finding_ids.length) fail("ACTION_INBOX_INVALID_DECISIONS", "decisions must contain exactly one item per selected finding", 422);
  const decisionIds = new Set();
  for (const decision of body.decisions) {
    if (!decision || typeof decision !== "object" || Array.isArray(decision) || Object.keys(decision).some((key) => key !== "finding_id" && key !== "notes") || typeof decision.finding_id !== "string" || !body.finding_ids.includes(decision.finding_id) || decisionIds.has(decision.finding_id) || !(decision.notes === null || (typeof decision.notes === "string" && decision.notes.length <= 2000))) {
      fail("ACTION_INBOX_INVALID_DECISIONS", "decisions must match selected finding IDs with bounded notes", 422);
    }
    decisionIds.add(decision.finding_id);
  }
}

function existingScopeRequest(inboxDir, reviewId, sourceRevision, findingIds) {
  const requested = new Set(findingIds);
  if (!fs.existsSync(inboxDir)) return null;
  for (const name of fs.readdirSync(inboxDir).sort()) {
    if (!name.endsWith(".json")) continue;
    try {
      const candidate = JSON.parse(fs.readFileSync(path.join(inboxDir, name), "utf8"));
      if (candidate.kind === "aivv.remediation-request.v1" && candidate.status === "queued" && Date.parse(candidate.expires_at) > Date.now() && candidate.review_id === reviewId && candidate.source_revision === sourceRevision && Array.isArray(candidate.finding_ids) && candidate.finding_ids.some((id) => requested.has(id))) return candidate.request_id;
    } catch {
      // A malformed historical shard cannot be safely deduplicated; it never grants execution.
    }
  }
  return null;
}

function withSubmissionLock(inboxDir, work) {
  const lockDir = path.join(inboxDir, ".submission-lock");
  const ownerFile = path.join(lockDir, "owner.json");
  const createLock = () => {
    fs.mkdirSync(lockDir, { mode: 0o700 });
    fs.writeFileSync(ownerFile, `${JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() })}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  };
  try {
    createLock();
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    try {
      const owner = JSON.parse(fs.readFileSync(ownerFile, "utf8"));
      if (!Number.isInteger(owner.pid) || owner.pid <= 0) fail("ACTION_INBOX_BUSY", "a malformed local submission lock needs manual maintenance", 409);
      try {
        process.kill(owner.pid, 0);
        fail("ACTION_INBOX_BUSY", "another local Inbox is submitting a batch; retry shortly", 409);
      } catch (ownerError) {
        if (ownerError?.exitCode || ownerError?.code === "EPERM") throw ownerError;
      }
      fs.unlinkSync(ownerFile);
      fs.rmdirSync(lockDir);
      createLock();
    } catch (retryError) {
      if (retryError?.exitCode) throw retryError;
      fail("ACTION_INBOX_BUSY", "another local Inbox is submitting a batch; retry shortly", 409);
    }
  }
  try {
    return work();
  } finally {
    fs.unlinkSync(ownerFile);
    fs.rmdirSync(lockDir);
  }
}

function renderReport(args, endpoint, token) {
  const commandArgs = [args.html_script, "--file", args.review_file, "--fix-dir", args.fix_dir ?? args.state_dir, "--action-endpoint", endpoint, "--action-token", token];
  if (args.wont_fix) commandArgs.push("--wont-fix", args.wont_fix);
  const result = spawnSync("bash", commandArgs, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) fail("ACTION_INBOX_RENDER_FAILED", result.stderr.trim() || "HTML renderer failed", 70);
  return result.stdout;
}

async function startServer(args, storageOptions = {}) {
  for (const field of ["review_file", "state_dir", "html_script"]) if (!args[field]) fail("ACTION_INBOX_USAGE", `missing --${field.replaceAll("_", "-")}`);
  const review = readJson(args.review_file, "ACTION_INBOX_REVIEW_INVALID");
  const reviewId = typeof review.id === "string" && review.id.trim() ? review.id : review.review_id;
  if (typeof reviewId !== "string" || !reviewId.trim()) fail("ACTION_INBOX_REVIEW_INVALID", "review must contain id or review_id", 65);
  const context = targetContext(review);
  const storage = storageContext(args, context.targetProject, storageOptions);
  const canonicalStateDir = storage.state_dir;
  if (path.resolve(args.state_dir) === path.join(context.targetProject, ".aivv", "state")) fail("ACTION_INBOX_REQUEUE_REQUIRED", "legacy history must be explicitly imported, then selected findings requeued through the current Inbox", 65);
  if (path.resolve(args.state_dir) !== canonicalStateDir) fail("ACTION_INBOX_STATE_TARGET_MISMATCH", `--state-dir must be the target's canonical state directory: ${canonicalStateDir}`, 64);
  if (!isImportPathVisible(storage, args.review_file)) fail("ACTION_INBOX_IMPORT_PENDING", "review import is incomplete; retry after import completes", 65);
  const canonicalReview = path.join(storage.state_dir, path.basename(args.review_file));
  if (path.resolve(args.review_file) !== canonicalReview && path.resolve(args.review_file) !== path.join(storage.state_dir, "archive", path.basename(args.review_file))) fail("ACTION_INBOX_REQUEUE_REQUIRED", "historical reviews must be explicitly imported before selected findings can be requeued", 65);
  validateContainedPath(args.review_file, storage.state_dir);
  const ttlSeconds = Number(args.ttl_seconds ?? DEFAULT_TTL_SECONDS);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 3600) fail("ACTION_INBOX_USAGE", "ttl-seconds must be an integer from 1 to 3600");
  const token = randomBytes(32).toString("hex");
  const inboxDir = path.join(args.state_dir, "action-inbox");
  await withStorageLock(storage, () => ensurePrivateDirectory(inboxDir, storage.state_dir));
  let expiresAt;
  let report = "";
  let baseUrl = "";
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", baseUrl);
    if (request.method === "GET" && requestUrl.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(report) });
      response.end(report);
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, 200, { status: "ok", expires_at: expiresAt });
      return;
    }
    if (request.method !== "POST" || requestUrl.pathname !== "/v1/remediation-requests") {
      sendError(response, 404, "ACTION_INBOX_ROUTE_NOT_FOUND", "unsupported Action Inbox route");
      return;
    }
    if (request.headers.origin !== baseUrl || !exactEqual(String(request.headers["x-aivv-action-token"] ?? ""), token)) {
      sendError(response, 403, "ACTION_INBOX_FORBIDDEN", "missing or invalid local Action Inbox capability");
      return;
    }
    try {
      const body = await readBody(request);
      if (Date.parse(expiresAt) <= Date.now()) {
        sendError(response, 410, "ACTION_INBOX_EXPIRED", "this local Action Inbox session has expired; start a new Inbox session or use the manual handoff");
        return;
      }
      validateSubmission(body, review, reviewId);
      const record = {
        schema_version: 1,
        kind: "aivv.remediation-request.v1",
        request_id: body.request_id,
        review_id: reviewId,
        requested_at: new Date().toISOString(),
        expires_at: expiresAt,
        target_project: context.targetProject,
        target_repository: context.targetRepository,
        source_revision: context.sourceRevision,
        workspace_state_sha256: context.workspaceStateSha256,
        finding_ids: body.finding_ids,
        decisions: body.decisions,
        status: "queued"
      };
      let sameScope;
      try {
        await withStorageLock(storage, () => withSubmissionLock(inboxDir, () => {
          const currentContext = targetContext(readJson(args.review_file, "ACTION_INBOX_REVIEW_INVALID"));
          if (currentContext.targetProject !== context.targetProject || currentContext.targetRepository !== context.targetRepository || currentContext.sourceRevision !== context.sourceRevision || currentContext.workspaceStateSha256 !== context.workspaceStateSha256) fail("ACTION_INBOX_STALE", "target changed since the report was opened; reopen the Inbox", 409);
          if (JSON.stringify(readJson(args.review_file, "ACTION_INBOX_REVIEW_INVALID")) !== JSON.stringify(review)) fail("ACTION_INBOX_REVIEW_CHANGED", "review changed since report rendering; reopen the Inbox", 409);
          sameScope = existingScopeRequest(inboxDir, record.review_id, record.source_revision, record.finding_ids);
          if (sameScope) return;
          validateContainedPath(path.join(inboxDir, `${record.request_id}.json`), storage.state_dir);
          fs.writeFileSync(path.join(inboxDir, `${record.request_id}.json`), `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
        }));
      } catch (error) {
        if (error?.code === "EEXIST") {
          sendError(response, 409, "ACTION_INBOX_DUPLICATE_REQUEST", "request ID was already queued");
          return;
        }
        throw error;
      }
      if (sameScope) {
        sendError(response, 409, "ACTION_INBOX_DUPLICATE_SCOPE", `one or more selected findings are already queued as ${sameScope}`);
        return;
      }
      sendJson(response, 201, { status: "queued", request_id: record.request_id, target_project: record.target_project, finding_ids: record.finding_ids, expires_at: record.expires_at });
    } catch (error) {
      const status = error?.exitCode === 422 || error?.exitCode === 409 ? error.exitCode : (["STORAGE_BUSY", "STORAGE_IMPORT_PENDING"].includes(error?.code) ? 409 : 400);
      sendError(response, status, String(error?.message ?? "ACTION_INBOX_REQUEST_FAILED").split(":")[0], String(error?.message ?? "request rejected"));
    }
  });
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      report = renderReport(args, `${baseUrl}/v1/remediation-requests`, token);
      expiresAt = isoAfter(ttlSeconds);
      const timer = setTimeout(() => server.close(), ttlSeconds * 1000);
      timer.unref();
      process.stdout.write(`AIVV_ACTION_INBOX_URL=${baseUrl}\n`);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      server.close(() => process.exit(error.exitCode ?? 70));
    }
  });
  server.on("error", (error) => {
    process.stderr.write(`ACTION_INBOX_SERVER_FAILED: ${error.message}\n`);
    process.exit(70);
  });
}

async function claimRequest(args, storageOptions = {}, inspectOnly = false) {
  for (const field of ["request_id", "state_dir", "target"]) if (!args[field]) fail("ACTION_INBOX_USAGE", `missing --${field.replaceAll("_", "-")}`);
  if (!REQUEST_ID.test(args.request_id)) fail("ACTION_INBOX_USAGE", "request-id must be a UUID");
  const storage = storageContext(args, args.target, storageOptions);
  const targetProject = storage.target;
  if (path.resolve(args.state_dir) !== storage.state_dir) {
    if (path.resolve(args.state_dir) === path.join(targetProject, ".aivv", "state")) fail("ACTION_REQUEST_REQUEUE_REQUIRED", "legacy pending requests are historical; requeue selected findings through the current Inbox", 65);
    fail("ACTION_REQUEST_STATE_TARGET_MISMATCH", "state-dir must be the target's canonical external state directory", 65);
  }
  const validateAndSelect = () => {
    assertNoPendingImports(storage);
    const requestFile = path.join(args.state_dir, "action-inbox", `${args.request_id}.json`);
    validateContainedPath(requestFile, storage.state_dir);
    if (!isImportPathVisible(storage, requestFile)) fail("ACTION_REQUEST_IMPORT_PENDING", "request import is incomplete", 65);
    const request = readJson(requestFile, "ACTION_REQUEST_NOT_FOUND");
    if (request.schema_version !== 1) fail("ACTION_REQUEST_SCHEMA_UNSUPPORTED", "request schema must be version 1", 65);
    if (request.kind !== "aivv.remediation-request.v1" || request.status !== "queued") fail("ACTION_REQUEST_INVALID", "request is not a queued remediation request", 65);
    const expiresAt = Date.parse(request.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) fail("ACTION_REQUEST_EXPIRED", "request expiry is missing, invalid, or expired", 65);
    const targetRepository = gitValue(targetProject, ["rev-parse", "--show-toplevel"], "ACTION_REQUEST_TARGET_NOT_GIT");
    const sourceRevision = gitValue(targetProject, ["rev-parse", "HEAD"], "ACTION_REQUEST_REVISION_UNAVAILABLE");
    if (targetProject !== request.target_project || targetRepository !== request.target_repository) fail("ACTION_REQUEST_TARGET_MISMATCH", "request target does not match active target", 65);
    if (sourceRevision !== request.source_revision) fail("ACTION_REQUEST_STALE", "target revision differs from queued request", 65);
    if (workspaceStateSha256(targetProject) !== request.workspace_state_sha256) fail("ACTION_REQUEST_STALE", "target workspace differs from queued request", 65);
    const reviewCandidates = [path.join(storage.state_dir, `review-${request.review_id}.json`), path.join(storage.state_dir, "archive", `review-${request.review_id}.json`)];
    const reviewFile = reviewCandidates.find(file => fs.existsSync(file) && isImportPathVisible(storage, file));
    if (!reviewFile) fail("ACTION_REQUEST_REVIEW_NOT_FOUND", "current review is unavailable; requeue after validating the review", 65);
    validateContainedPath(reviewFile, storage.state_dir);
    const currentReview = readJson(reviewFile, "ACTION_REQUEST_REVIEW_INVALID");
    if (currentReview.schema_version !== undefined && ![1, 2].includes(currentReview.schema_version)) fail("ACTION_REQUEST_REVIEW_SCHEMA_UNSUPPORTED", "current review schema is unsupported", 65);
    if ((currentReview.id ?? currentReview.review_id) !== request.review_id || !currentReview.target_project || fs.realpathSync(currentReview.target_project) !== targetProject) fail("ACTION_REQUEST_REVIEW_TARGET_MISMATCH", "current review does not match queued review and target", 65);
    if (!Array.isArray(request.finding_ids) || request.finding_ids.some(id => !reviewFindingIds(currentReview).has(id))) fail("ACTION_REQUEST_FINDING_NOT_IN_REVIEW", "queued findings no longer belong to the current review", 65);
    const claimsDir = path.join(args.state_dir, "action-inbox", "claims");
    const claimFile = path.join(claimsDir, `${request.request_id}.json`);
    validateContainedPath(claimFile, storage.state_dir);
    if (fs.existsSync(claimFile)) fail("ACTION_REQUEST_ALREADY_CLAIMED", "request was already claimed", 65);
    if (inspectOnly) {
      process.stdout.write(`${JSON.stringify({ schema_version: 1, kind: "aivv.remediation-preview.v1", status: "preview", request_id: request.request_id, review_id: request.review_id, target_project: targetProject, source_revision: sourceRevision, workspace_state_sha256: request.workspace_state_sha256, finding_ids: request.finding_ids, decisions: request.decisions })}\n`);
      return true;
    }
    ensurePrivateDirectory(claimsDir, storage.state_dir);
    validateContainedPath(path.join(claimsDir, `${request.request_id}.json`), storage.state_dir);
    const claim = { schema_version: 1, kind: "aivv.remediation-claim.v1", request_id: request.request_id, claimed_at: new Date().toISOString(), target_project: targetProject, source_revision: sourceRevision, workspace_state_sha256: request.workspace_state_sha256 };
    try {
      fs.writeFileSync(path.join(claimsDir, `${request.request_id}.json`), `${JSON.stringify(claim, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error?.code === "EEXIST") fail("ACTION_REQUEST_ALREADY_CLAIMED", "request was already claimed", 65);
      throw error;
    }
    process.stdout.write(`${JSON.stringify(claim)}\n`);
    return true;
  };
  if (inspectOnly) {
    if (!withExistingStorageReadLock(storage, validateAndSelect)) fail("ACTION_REQUEST_NOT_FOUND", "request store is absent; inspection does not initialize it", 65);
    return;
  }
  return withStorageLock(storage, validateAndSelect);
}

export async function main(argv = process.argv.slice(2), storageOptions = {}) {
  const args = parseArgs(argv);
  if (args.command === "help") usage();
  else if (args.command === "serve") await startServer(args, storageOptions);
  else if (args.command === "inspect") await claimRequest(args, storageOptions, true);
  else if (args.command === "claim") await claimRequest(args, storageOptions);
  else fail("ACTION_INBOX_USAGE", `unknown command ${args.command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode ?? 1);
  });
}
