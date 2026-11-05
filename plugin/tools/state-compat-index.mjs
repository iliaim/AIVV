#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { withExistingStorageReadLock, readStorageContext, resolveStorage, ensureStorage, validateContainedPath, withStorageLock } from "./storage-paths.mjs";
import { isImportPathVisible } from "./state-import.mjs";

const MUTATION_FLAGS = new Set(["--apply", "--in-place", "--rewrite", "--mutate"]);

function usage(exitCode = 2) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write("Usage: node <AIVV_ROOT>/tools/state-compat-index.mjs --state-dir <dir> [--output <file>] [--pretty] | --registry-for-matching [--context <file> | --target <dir>]\n");
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { stateDir: "", output: "", pretty: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (MUTATION_FLAGS.has(arg)) {
      throw new Error(`${arg} is intentionally unsupported; this helper writes a derived index only`);
    }
    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--context") {
      args.context = argv[++index];
    } else if (arg === "--target") {
      args.target = argv[++index];
    } else if (arg === "--state-dir") {
      args.stateDir = argv[++index] ?? "";
    } else if (arg === "--output") {
      args.output = argv[++index] ?? "";
    } else if (arg === "--registry-for-matching") {
      args.registryForMatching = true;
    } else if (arg === "--pretty") {
      args.pretty = true;
    } else {
      throw new Error(`Unknown arg: ${arg}`);
    }
  }
  if (args.context) {
    args.storageContext = readStorageContext(args.context);
    if (args.target && fs.realpathSync(path.resolve(args.target)) !== args.storageContext.target) throw new Error("storage-context-target-mismatch");
    if (args.stateDir && path.resolve(args.stateDir) !== args.storageContext.state_dir) throw new Error("storage-context-state-dir-mismatch");
  }
  if (!args.stateDir) args.stateDir = (args.storageContext || resolveStorage({ target: args.target })).state_dir;
  if (args.registryForMatching && args.output) throw new Error("--registry-for-matching is read-only; --output is unsupported");
  return args;
}

function readJsonFile(file) {
  try {
    return { value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (error) {
    return { error };
  }
}

function listJsonFiles(dir, prefix, context) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort()
    .map((name) => path.join(dir, name))
    .filter((file) => isImportPathVisible(context, file));
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeFile(value, targetProject = "") {
  let normalized = normalizeText(value).replaceAll("\\", "/").replace(/^\.\//, "");
  const normalizedTarget = normalizeText(targetProject).replaceAll("\\", "/").replace(/\/+$/, "");
  if (path.posix.isAbsolute(normalized) && normalizedTarget && normalized.startsWith(`${normalizedTarget}/`)) {
    normalized = normalized.slice(normalizedTarget.length + 1);
  }
  return normalized.replace(/^\.\//, "");
}

function canonicalFindingId(value) {
  if (typeof value !== "string") return null;
  const match = /^F-?[A-Z]?0*([0-9]+)(?:[-_].*)?$/.exec(value);
  if (!match) return value;
  return `F${Number(match[1])}`;
}

function stripRecordPrefix(value, prefix) {
  const normalized = normalizeText(value);
  if (normalized.startsWith(prefix)) return normalized.slice(prefix.length);
  return normalized;
}

function locationBasis(finding, targetProject = "") {
  const file = typeof finding.file === "string" ? normalizeFile(finding.file, targetProject) : "";
  const filePath = typeof finding.file_path === "string" ? normalizeFile(finding.file_path, targetProject) : "";
  const files = Array.isArray(finding.files) ? finding.files.filter((entry) => typeof entry === "string" && entry.trim()) : [];
  const scope = finding.scope_ref && typeof finding.scope_ref === "object" ? finding.scope_ref : null;

  if (file && !scope) return { basis: file, fields: ["file"] };
  if (!file && scope && typeof scope.kind === "string" && typeof scope.ref === "string" && scope.kind !== "file") {
    return { basis: `${normalizeText(scope.kind)}:${normalizeText(scope.ref)}`, fields: ["scope_ref.kind", "scope_ref.ref"] };
  }
  if (!file && !scope && filePath) return { basis: filePath, fields: ["file_path"] };
  if (!file && !scope && files.length === 1) return { basis: normalizeFile(files[0], targetProject), fields: ["files[0]"] };
  return null;
}

function descriptionBasis(finding) {
  for (const field of ["description", "summary", "title"]) {
    if (typeof finding[field] === "string" && finding[field].trim()) {
      return { value: finding[field].toLowerCase(), field };
    }
  }
  return null;
}

function gitHashObject(input) {
  return execFileSync("git", ["hash-object", "--stdin", "--no-filters"], {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  }).trim();
}

function deriveFingerprint(finding, targetProject = "") {
  const location = locationBasis(finding, targetProject);
  const description = descriptionBasis(finding);
  if (!location || !description) return null;
  return {
    value: gitHashObject(`${location.basis}:${description.value}`),
    fields: [...location.fields, description.field]
  };
}

/** A derived matching view only. Never persist aliases or change approval fields. */
export function registryForMatching(registry, target) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry) || !Array.isArray(registry.entries)) throw new Error("REGISTRY_CORRUPT: registry must contain an entries array");
  if (registry.schema_version !== undefined && (!Number.isInteger(registry.schema_version) || registry.schema_version < 1 || registry.schema_version > 2)) throw new Error("SCHEMA_NEWER_REQUIRED: unsupported wont-fix registry schema");
  const view = structuredClone(registry);
  const warnings = [];
  view.entries = view.entries.flatMap((entry, entryIndex) => {
    const skip = (reason) => { warnings.push({ code: "WONT_FIX_COMPAT_SKIP_MALFORMED", entry_index: entryIndex, reason }); return []; };
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(entry.fingerprint ?? "")) return skip("invalid fingerprint entry");
    entry.matching_fingerprints = [entry.fingerprint];
    if (!Object.hasOwn(entry, "updated_at_schema_v3") && /^[0-9a-f]{64}$/i.test(entry.fingerprint)) {
      if (typeof entry.file_path !== "string" || !entry.file_path.trim() || typeof entry.description !== "string" || !entry.description.trim()) return skip("legacy entry requires file_path and description");
      // Unlike general display normalization, file whitespace is significant.
      let file = path.posix.normalize(entry.file_path.replaceAll("\\", "/")).replace(/^(?:\.\/)+/, "");
      const project = path.posix.normalize(String(target).replaceAll("\\", "/")).replace(/\/+$/, "");
      if (project && file.startsWith(`${project}/`)) file = file.slice(project.length + 1);
      const derived = gitHashObject(`${file}:${entry.description.toLowerCase()}\n`);
      if (!entry.matching_fingerprints.includes(derived)) entry.matching_fingerprints.push(derived);
    }
    return [entry];
  });
  view.warnings = [...(Array.isArray(view.warnings) ? view.warnings : []), ...warnings];
  return view;
}

function matchingRegistrySnapshot(context) {
  const file = path.join(context.state_dir, "wont-fix-registry.json");
  const empty = () => ({ entries: [], warnings: [] });
  return withExistingStorageReadLock(context, () => {
    if (!isImportPathVisible(context, file)) throw new Error("STATE_IMPORT_PENDING: selected registry requires import recovery");
    if (!fs.existsSync(file)) return empty();
    const parsed = readJsonFile(file);
    if (parsed.error) throw new Error("REGISTRY_CORRUPT: selected registry is not valid JSON");
    return registryForMatching(parsed.value, context.target);
  }) || empty();
}

function recordIdFromFile(file, parsed) {
  return parsed?.id ?? parsed?.review_id ?? path.basename(file, ".json").replace(/^review-/, "").replace(/^fix-/, "");
}

function missingModernValue(value) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function maybeReviewBackfills(file, review, reviewBackfills, unsafe) {
  const reviewId = recordIdFromFile(file, review);
  const targetProject = typeof review.target_project === "string" ? review.target_project : "";
  const findings = Array.isArray(review.findings) ? review.findings : [];
  findings.forEach((finding, index) => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
      unsafe.push({
        record_type: "review",
        file,
        record_id: reviewId,
        finding_id: null,
        path: `/findings/${index}`,
        reason: "finding is not an object"
      });
      return;
    }
    const findingId = canonicalFindingId(finding.ref ?? finding.id) ?? `findings[${index}]`;
    if (!finding.fingerprint) {
      const fingerprint = deriveFingerprint(finding, targetProject);
      if (fingerprint) {
        reviewBackfills.push({
          record_type: "review",
          file,
          record_id: reviewId,
          finding_id: findingId,
          path: `/findings/${index}/fingerprint`,
          value: fingerprint.value,
          derived_from: fingerprint.fields,
          reason: "missing fingerprint can be derived from deterministic location and description fields"
        });
      } else {
        unsafe.push({
          record_type: "review",
          file,
          record_id: reviewId,
          finding_id: findingId,
          path: `/findings/${index}/fingerprint`,
          reason: "missing fingerprint is not backfillable without exactly one durable location and description"
        });
      }
    }
    for (const field of ["evidence", "impact", "severity_rationale", "recommended_next_step", "verification_path", "proportional_remediation"]) {
      if (missingModernValue(finding[field])) {
        unsafe.push({
          record_type: "review",
          file,
          record_id: reviewId,
          finding_id: findingId,
          path: `/findings/${index}/${field}`,
          reason: "modern handoff evidence cannot be invented for historical findings"
        });
      }
    }
  });
}

function sourceReviewFromFix(fix) {
  if (typeof fix.source_review_id === "string" && fix.source_review_id.trim()) {
    const normalized = stripRecordPrefix(fix.source_review_id, "review-");
    if (normalized !== fix.source_review_id.trim()) {
      return { value: normalized, fields: ["source_review_id"] };
    }
    return null;
  }
  if (typeof fix.review_id_consumed === "string" && fix.review_id_consumed.trim()) {
    return { value: stripRecordPrefix(fix.review_id_consumed, "review-"), fields: ["review_id_consumed"] };
  }
  if (fix.source === "review_id" && typeof fix.review_id === "string" && fix.review_id.trim()) {
    return { value: stripRecordPrefix(fix.review_id, "review-"), fields: ["source", "review_id"] };
  }
  if (typeof fix.source_argument === "string") {
    const match = /(?:^|\s)--review-id=([^\s]+)/.exec(fix.source_argument);
    if (match) return { value: stripRecordPrefix(match[1], "review-"), fields: ["source_argument"] };
  }
  return null;
}

function effectiveSourceReviewId(fix) {
  if (typeof fix.source_review_id === "string" && fix.source_review_id.trim()) {
    return stripRecordPrefix(fix.source_review_id, "review-");
  }
  return sourceReviewFromFix(fix)?.value ?? "";
}

function maybeFixBackfills(file, fix, fixBackfills, unsafe) {
  const fixId = recordIdFromFile(file, fix);
  const sourceReview = sourceReviewFromFix(fix);
  if (sourceReview) {
    fixBackfills.push({
      record_type: "fix",
      file,
      record_id: fixId,
      finding_id: null,
      path: "/source_review_id",
      value: sourceReview.value,
      derived_from: sourceReview.fields,
      reason: sourceReview.fields.includes("source_review_id")
        ? "non-canonical prefixed source_review_id can be normalized to the bare review id"
        : "missing canonical source_review_id can be derived from an explicit legacy review reference"
    });
  } else if (!fix.source_review_id) {
    unsafe.push({
      record_type: "fix",
      file,
      record_id: fixId,
      finding_id: null,
      path: "/source_review_id",
      reason: "source review id is not derivable from legacy fix-log fields"
    });
  }
}

function maybeReviewFixInvocationBackfills(reviewFiles, fixRecords, reviewBackfills, unsafe) {
  const fixesByReview = new Map();
  for (const record of fixRecords) {
    const sourceReviewId = effectiveSourceReviewId(record.fix);
    if (!sourceReviewId) continue;
    const existing = fixesByReview.get(sourceReviewId) ?? [];
    existing.push(record);
    fixesByReview.set(sourceReviewId, existing);
  }

  for (const reviewRecord of reviewFiles) {
    const reviewId = recordIdFromFile(reviewRecord.file, reviewRecord.review);
    if (reviewRecord.review?.fix_invocation_id) continue;
    const candidates = fixesByReview.get(reviewId) ?? [];
    if (candidates.length === 1) {
      reviewBackfills.push({
        record_type: "review",
        file: reviewRecord.file,
        record_id: reviewId,
        finding_id: null,
        path: "/fix_invocation_id",
        value: candidates[0].fixId,
        derived_from: [`fix:${path.basename(candidates[0].file)}`, "source_review_id"],
        reason: "missing review fix_invocation_id can be derived from exactly one fix log that joins to this review"
      });
    } else if (candidates.length > 1) {
      unsafe.push({
        record_type: "review",
        file: reviewRecord.file,
        record_id: reviewId,
        finding_id: null,
        path: "/fix_invocation_id",
        reason: `fix_invocation_id is ambiguous: ${candidates.length} fix logs join to this review`
      });
    }
  }
}

export function buildStateCompatIndex(stateDir, now = new Date(), boundContext) {
  const dir = path.resolve(stateDir);
  const state = path.basename(dir) === "archive" ? path.dirname(dir) : dir;
  const metadata = path.join(path.dirname(state), "target.json");
  const context = boundContext || (fs.existsSync(metadata) ? { target_dir: path.dirname(state) } : null);
  if (context) {
    const snapshot = withExistingStorageReadLock(context, () => buildStateCompatSnapshot(stateDir, now));
    if (!snapshot) throw new Error("state dir does not exist");
    return snapshot;
  }
  return buildStateCompatSnapshot(stateDir, now);
}

function buildStateCompatSnapshot(stateDir, now) {
  const absoluteStateDir = path.resolve(stateDir);
  if (!fs.existsSync(absoluteStateDir) || !fs.statSync(absoluteStateDir).isDirectory()) {
    throw new Error(`state dir does not exist: ${stateDir}`);
  }

  const reviewBackfills = [];
  const fixBackfills = [];
  const unsafe = [];
  const context = { target_dir: path.dirname(path.basename(absoluteStateDir) === "archive" ? path.dirname(absoluteStateDir) : absoluteStateDir) };
  const reviewFiles = listJsonFiles(absoluteStateDir, "review-", context);
  const fixFiles = listJsonFiles(absoluteStateDir, "fix-", context);
  const parsedReviews = [];
  const parsedFixes = [];

  for (const file of reviewFiles) {
    const parsed = readJsonFile(file);
    if (parsed.error) {
      unsafe.push({
        record_type: "review",
        file,
        record_id: path.basename(file, ".json").replace(/^review-/, ""),
        path: "/",
        reason: "review log is not valid JSON"
      });
      continue;
    }
    parsedReviews.push({ file, review: parsed.value });
    maybeReviewBackfills(file, parsed.value, reviewBackfills, unsafe);
  }

  for (const file of fixFiles) {
    const parsed = readJsonFile(file);
    if (parsed.error) {
      unsafe.push({
        record_type: "fix",
        file,
        record_id: path.basename(file, ".json").replace(/^fix-/, ""),
        path: "/",
        reason: "fix log is not valid JSON"
      });
      continue;
    }
    parsedFixes.push({
      file,
      fix: parsed.value,
      fixId: recordIdFromFile(file, parsed.value)
    });
    maybeFixBackfills(file, parsed.value, fixBackfills, unsafe);
  }

  maybeReviewFixInvocationBackfills(parsedReviews, parsedFixes, reviewBackfills, unsafe);

  return {
    schema_version: 1,
    generated_at: now.toISOString(),
    state_dir: absoluteStateDir,
    policy: {
      mode: "derived_index",
      original_log_mutation: false,
      refresh_owner: "tools/state-compat-index.mjs",
      fingerprint_algorithm: "git-hash-object-v1:<location_identifier>:<lowercased_description>"
    },
    counts: {
      reviews_scanned: reviewFiles.length,
      fix_logs_scanned: fixFiles.length,
      review_backfills: reviewBackfills.length,
      fix_backfills: fixBackfills.length,
      unsafe: unsafe.length
    },
    review_backfills: reviewBackfills,
    fix_backfills: fixBackfills,
    unsafe
  };
}

function outputPathLooksLikeSourceLog(outputPath, stateDir) {
  const resolvedOutput = path.resolve(outputPath);
  const resolvedStateDir = path.resolve(stateDir);
  const relative = path.relative(resolvedStateDir, resolvedOutput);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  const basename = path.basename(resolvedOutput);
  return /^review-.*\.json$/.test(basename) || /^fix-.*\.json$/.test(basename);
}

function assertSafeOutputPath(outputPath, stateDir) {
  if (!outputPath) return;
  if (outputPathLooksLikeSourceLog(outputPath, stateDir)) {
    throw new Error("--output must not target review-*.json or fix-*.json source logs under the state dir");
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.registryForMatching) {
      const context = args.storageContext || resolveStorage({ target: args.target });
      if (path.resolve(args.stateDir) !== context.state_dir) throw new Error("storage-context-state-dir-mismatch");
      process.stdout.write(`${JSON.stringify(matchingRegistrySnapshot(context), null, args.pretty ? 2 : 0)}\n`);
      return;
    }
    assertSafeOutputPath(args.output, args.stateDir);
    const index = buildStateCompatIndex(args.stateDir, new Date(), args.storageContext);
    const json = `${JSON.stringify(index, null, args.pretty ? 2 : 0)}\n`;
    if (args.output) {
      const context = args.storageContext || resolveStorage({ target: args.target });
      const output = path.resolve(args.output);
      const relative = path.relative(context.state_dir, output);
      const write = () => {
        fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
        fs.writeFileSync(output, json, { mode: 0o600 });
      };
      if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
        validateContainedPath(output, context.state_dir);
        ensureStorage(context);
        await withStorageLock(context, write);
      } else write(); // Explicit derived-output export; original logs remain protected above.
    } else {
      process.stdout.write(json);
    }
  } catch (error) {
    process.stderr.write(`state-compat-index: error: ${error.message}\n`);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
