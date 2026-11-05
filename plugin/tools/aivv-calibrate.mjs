#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { withExistingStorageReadLock, resolveStorage, readStorageContext } from "./storage-paths.mjs";
import { calibrationImportStatus, isImportPathVisible } from "./state-import.mjs";

const CANONICAL_KINDS = [
  "false_positive",
  "dual_false_positive",
  "n_way_false_positive",
  "true_positive",
  "dual_true_positive",
  "n_way_true_positive_agreement",
  "false_negative",
  "bad_fix",
  "auto_deferred_at_cap",
  "review_meta",
  "fix_introduced_bug",
  "challenger_caught_issue",
  "challenger_false_positive",
  "recurring_class_missed",
  "challenge_budget_exhausted",
  "pre_write_validator_caught",
];

const CONVERGENCE_PREFIXES = [
  "dual_false_positive_",
  "n_way_false_positive_",
  "dual_true_positive_",
  "n_way_true_positive_agreement_",
];

const LIKELIHOOD_TIERS = ["CERTAIN", "PROBABLE", "POSSIBLE", "UNLIKELY"];

function usage() {
  return [
    "Usage: node <AIVV_ROOT>/tools/aivv-calibrate.mjs [--lens <lens>] [--target <dir>] [--all-lenses] [--raw]",
    "       node <AIVV_ROOT>/tools/aivv-calibrate.mjs --migrate [--lens <lens> | --all-lenses] [--target <dir>]",
    "",
    "Reads external target calibration plus uncovered read-only legacy shared files/shards",
    "calibration analytics (union of legacy shared file + per-invocation shards).",
    "",
    "--migrate relocates a legacy <lens>.jsonl to <lens>/legacy.jsonl (git-aware, idempotent).",
  ].join("\n");
}

function optionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

function parseArgs(argv) {
  const args = { lens: "code", explicitLens: false, target: null, allLenses: false, raw: false, migrate: false, warnings: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (arg === "--context") {
      args.context = optionValue(argv, i, "--context");
      i += 1;
    } else if (arg === "--lens") {
      args.lens = optionValue(argv, i, "--lens");
      args.explicitLens = true;
      i += 1;
    } else if (arg.startsWith("--lens=")) {
      args.lens = arg.slice("--lens=".length);
      args.explicitLens = true;
    } else if (arg === "--target") {
      args.target = optionValue(argv, i, "--target");
      i += 1;
    } else if (arg.startsWith("--target=")) {
      args.target = arg.slice("--target=".length);
    } else if (arg === "--all-lenses") {
      args.allLenses = true;
    } else if (arg === "--raw") {
      args.raw = true;
    } else if (arg === "--migrate") {
      args.migrate = true;
    } else {
      args.warnings.push(`unknown flag ignored: ${arg}`);
    }
  }
  if (args.allLenses && args.lens !== "code") {
    args.warnings.push(`--all-lenses set; ignoring explicit --lens=${args.lens}`);
  }
  return args;
}

function gitTopLevel(cwd) {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function resolveTarget(explicitTarget) {
  if (explicitTarget) {
    const target = path.resolve(explicitTarget);
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      throw new Error(`--target path does not exist or is not a directory: ${explicitTarget}`);
    }
    return { target, warning: null };
  }
  const top = gitTopLevel(process.cwd());
  if (top) return { target: top, warning: null };
  return {
    target: process.cwd(),
    warning: "no project root inferred from cwd; using cwd and corpus may be empty",
  };
}

// Non-lens subdirectories under `.aivv/calibration/` that MUST NOT be treated as
// lenses. `eval-runs/` is written by the `--eval` harness (eval-runs/<id>.jsonl)
// and holds run-summaries, not calibration records. Extend this set if a future
// non-lens subdirectory is added under calibration/.
const RESERVED_SUBDIRS = new Set(["eval-runs"]);

// A name is a real lens iff it is non-empty and not a reserved non-lens subdir.
// Enforced at the LENS-NAME layer (not just the directory-entry layer) so a stray
// flat `eval-runs.jsonl` is rejected as firmly as an `eval-runs/` directory —
// otherwise eval-harness run-summaries leak into the calibration denominator.
function isReservedLens(lens) {
  return !lens || RESERVED_SUBDIRS.has(lens);
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function hasJsonl(dir) {
  try {
    return fs.readdirSync(dir).some((name) => name.endsWith(".jsonl") && isFile(path.join(dir, name)));
  } catch {
    return false;
  }
}

// Discover every lens present as EITHER a `<lens>.jsonl` file OR a `<lens>/` shard
// directory. Discovery is fully dynamic (no hardcoded lens allowlist): a top-level
// `<name>.jsonl` is a lens (unchanged, always permissive), and any non-reserved
// subdirectory containing >=1 `.jsonl` is a lens shard directory — including a
// shard-ONLY lens with no legacy sibling, which is the normal post-per-invocation sharding contract case.
// `RESERVED_SUBDIRS` + the `.jsonl`-present requirement keep stray/eval dirs out.
function discoverLenses(dir) {
  const lenses = new Set();
  const entries = fs.readdirSync(dir);
  for (const name of entries) {
    if (name.endsWith(".jsonl")) {
      const lens = name.slice(0, -".jsonl".length);
      if (!isReservedLens(lens) && isFile(path.join(dir, name))) lenses.add(lens);
      continue;
    }
    if (RESERVED_SUBDIRS.has(name)) continue;
    const sub = path.join(dir, name);
    let isDir = false;
    try { isDir = fs.statSync(sub).isDirectory(); } catch { isDir = false; }
    if (!isDir || !hasJsonl(sub)) continue;
    lenses.add(name);
  }
  return [...lenses].sort((a, b) => a.localeCompare(b));
}

// A lens's record sources = legacy shared `<lens>.jsonl` (if present) + every
// per-invocation shard `<lens>/*.jsonl` (sorted). All JSONL — same parser.
function lensSources(dir, lens) {
  if (isReservedLens(lens)) return [];
  const sources = [];
  const legacy = path.join(dir, `${lens}.jsonl`);
  if (isFile(legacy)) sources.push(legacy);
  const shardDir = path.join(dir, lens);
  if (fs.existsSync(shardDir) && fs.statSync(shardDir).isDirectory()) {
    for (const name of fs.readdirSync(shardDir).filter((n) => n.endsWith(".jsonl") && isFile(path.join(shardDir, n))).sort()) {
      sources.push(path.join(shardDir, name));
    }
  }
  return sources;
}

function lensFiles(target, lens, allLenses, warnings, boundContext, includeActive = true) {
  const context = boundContext || resolveStorage({ target });
  const dirs = [...(includeActive ? [context.calibration_dir] : []), ...context.legacy_calibration_dirs]
    .filter((dir, index, list) => list.indexOf(dir) === index && fs.existsSync(dir) && fs.statSync(dir).isDirectory());
  const available = [...new Set(dirs.flatMap(discoverLenses))].sort();
  const selected = allLenses ? available : available.includes(lens) ? [lens] : [];
  const lenses = selected.map((name) => ({
    lens: name,
    sources: dirs.flatMap((dir) => lensSources(dir, name)).filter((file) => {
      if (!isImportPathVisible(context, file)) return false;
      if (file.startsWith(`${context.calibration_dir}${path.sep}`)) return true;
      const imported = calibrationImportStatus(context, file);
      if (imported.changed) warnings.push(`Imported legacy calibration changed; retained as historical input until explicit reconciliation: ${file}`);
      return !imported.covered;
    }),
  }));
  return {
    dir: context.calibration_dir, dirs, lenses,
    message: lenses.length ? null : `Lens '${lens}' not available in ${[context.calibration_dir, ...context.legacy_calibration_dirs].join(', ')}. Available lenses: ${available.join(', ') || '(none)'}`,
  };
}

function parseJsonl(file) {
  const warnings = [];
  const records = [];
  const text = fs.readFileSync(file, "utf8");
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      records.push(JSON.parse(line));
    } catch {
      warnings.push(`malformed JSONL line ignored: ${file}:${index + 1}`);
    }
  });
  return { records, warnings };
}

function isOnSchemaKind(kind) {
  return CANONICAL_KINDS.includes(kind) || CONVERGENCE_PREFIXES.some((prefix) => kind.startsWith(prefix));
}

function familyCount(records, family) {
  const re = family === "fp" ? /false_positive($|_)/ : /true_positive($|_)/;
  return records.filter((record) => re.test(String(record.kind || ""))).length;
}

function rate(numerator, denominator) {
  if (denominator < 5) return { insufficient_data: true, n: denominator, threshold: 5 };
  return { value: numerator / denominator, n: denominator };
}

function likelihoodCalibration(records) {
  const tiers = {};
  let totalEligible = 0;
  for (const tier of LIKELIHOOD_TIERS) {
    const eligible = records.filter((record) => record.likelihood === tier && ["observed", "not_observed"].includes(record.manifestation));
    const observed = eligible.filter((record) => record.manifestation === "observed").length;
    const notObserved = eligible.length - observed;
    totalEligible += eligible.length;
    tiers[tier] = {
      manifestation_observed: observed,
      manifestation_not_observed: notObserved,
      n: eligible.length,
      rate: eligible.length >= 10 ? observed / eligible.length : { insufficient_data: true, n: eligible.length, threshold: 10 },
      threshold_crossed: false,
    };
    const value = typeof tiers[tier].rate === "number" ? tiers[tier].rate : null;
    if (value !== null) {
      tiers[tier].threshold_crossed =
        (tier === "CERTAIN" && value < 0.7) ||
        (tier === "PROBABLE" && value < 0.5) ||
        (tier === "POSSIBLE" && (value < 0.2 || value > 0.8)) ||
        (tier === "UNLIKELY" && value > 0.4);
    }
  }
  return {
    tiers,
    total_eligible: totalEligible,
    advisory_eligible: totalEligible >= 30,
    advisory_threshold: 30,
  };
}

function analyze(target, lens, records) {
  const recordsByKind = Object.fromEntries(CANONICAL_KINDS.map((kind) => [kind, 0]));
  const offSchemaKinds = {};
  for (const record of records) {
    const kind = String(record.kind || "");
    if (CANONICAL_KINDS.includes(kind)) recordsByKind[kind] += 1;
    else if (!isOnSchemaKind(kind)) offSchemaKinds[kind || "(missing-kind)"] = (offSchemaKinds[kind || "(missing-kind)"] || 0) + 1;
  }
  const fp = familyCount(records, "fp");
  const tp = familyCount(records, "tp");
  const denominator = fp + tp;
  const reviewMeta = records.filter((record) => record.kind === "review_meta");
  const findingsSum = reviewMeta.reduce((sum, record) => sum + (Number.isFinite(record.findings_produced) ? record.findings_produced : 0), 0);
  const tradeOffsAccepted = records.filter((record) => /by-design|deliberate trade-off|intentional safety/i.test(String(record.evidence || ""))).length;
  const result = {
    target,
    lens,
    records_by_kind: recordsByKind,
    rates: {
      fp_rate: rate(fp, denominator),
      tp_rate: rate(tp, denominator),
      findings_per_review: reviewMeta.length > 0
        ? { value: findingsSum / reviewMeta.length, reviews: reviewMeta.length, findings_sum: findingsSum }
        : { denominator_unavailable: true, reason: "no review_meta records" },
    },
    likelihood_calibration: likelihoodCalibration(records),
    trade_offs_accepted: tradeOffsAccepted,
    scope: "target-only",
  };
  if (Object.keys(offSchemaKinds).length > 0) result.off_schema_kinds = offSchemaKinds;
  return result;
}

function formatRate(item) {
  if (item.insufficient_data) return `insufficient_data (N=${item.n}, threshold=${item.threshold})`;
  return `${Math.floor(item.value * 100)}% (N=${item.n})`;
}

function formatLikelihood(item) {
  if (typeof item.rate === "number") {
    return `${item.manifestation_observed}/${item.n} manifestation observed (${Math.floor(item.rate * 100)}%)`;
  }
  return `${item.manifestation_observed}/${item.n} manifestation observed (insufficient_data; threshold=${item.rate.threshold})`;
}

function formatHuman(result, emptyCorpus) {
  const lines = [`Calibration analytics for ${result.target} (lens: ${result.lens})`, ""];
  lines.push("Records by kind:");
  const present = Object.entries(result.records_by_kind).filter(([, count]) => count > 0);
  if (emptyCorpus) lines.push("  (empty corpus - 0 records)");
  else if (present.length === 0) lines.push("  (no canonical records)");
  else for (const [kind, count] of present) lines.push(`  ${kind}: ${count}`);
  if (result.off_schema_kinds) {
    const total = Object.values(result.off_schema_kinds).reduce((sum, count) => sum + count, 0);
    lines.push(`  (off-schema): ${total}`);
  }
  lines.push("", "Rates:");
  lines.push(`  FP rate (FP family / (FP + TP)): ${formatRate(result.rates.fp_rate)}`);
  lines.push(`  TP rate (TP family / (FP + TP)): ${formatRate(result.rates.tp_rate)}`);
  if (result.rates.findings_per_review.denominator_unavailable) {
    lines.push("  Findings per review: denominator unavailable (no review_meta records)");
  } else {
    const trend = result.rates.findings_per_review;
    lines.push(`  Findings per review: ${trend.value.toFixed(2)} (S=${trend.findings_sum}, R=${trend.reviews})`);
  }
  lines.push("", "Likelihood calibration by manifestation:");
  for (const tier of LIKELIHOOD_TIERS) lines.push(`  ${tier}: ${formatLikelihood(result.likelihood_calibration.tiers[tier])}`);
  lines.push(`  Advisory eligibility: ${result.likelihood_calibration.advisory_eligible ? "eligible" : "insufficient_data"} (total N=${result.likelihood_calibration.total_eligible}, threshold=${result.likelihood_calibration.advisory_threshold})`);
  lines.push("", "Schema conformance:");
  if (!result.off_schema_kinds) lines.push("  All records on-schema.");
  else for (const [kind, count] of Object.entries(result.off_schema_kinds)) lines.push(`  ${kind}: ${count} - operator-extension; consider proposing schema graduation if pattern persists`);
  lines.push("", `Trade-offs accepted (heuristic by-design / deliberate / intentional substring): ${result.trade_offs_accepted}`);
  lines.push("", "Scope: target-only (single corpus). Cross-project aggregation deferred to v0.3.");
  return lines.join("\n");
}

// Is `file` a git-tracked path in the `target` repo? False when not tracked or
// when `target` is not a git working tree.
function isTracked(target, file) {
  const result = spawnSync("git", ["ls-files", "--error-unmatch", "--", path.relative(target, file)], {
    cwd: target,
    encoding: "utf8",
  });
  return result.status === 0;
}

// --migrate: physically retire the shared `<lens>.jsonl` by RELOCATING it to
// `<lens>/legacy.jsonl` (never splits records, never rewrites content in place).
// Idempotent (skips a lens whose legacy.jsonl already exists or that has no shared
// file); git-aware (`git mv` when the file is tracked so the consumer's tree ends
// clean after they commit, plain rename otherwise). Migration is a one-shot
// housekeeping op, so bare `--migrate` (no explicit --lens) retires EVERY legacy
// file — the read-side "default to code" convention would silently leave other
// lenses' legacy files behind.
function migrate(target, lens, allLenses, explicitLens) {
  const dir = path.join(target, ".aivv", "calibration");
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { dir, migrated: [], message: `No calibration directory at ${dir} - nothing to migrate.` };
  }
  const migrateAll = allLenses || !explicitLens;
  const targetLenses = (migrateAll
    ? fs.readdirSync(dir).filter((n) => n.endsWith(".jsonl")).map((n) => n.slice(0, -".jsonl".length))
    : [lens]
  ).filter((l) => !isReservedLens(l)).sort();
  const migrated = [];
  // Surface the reservation on the migrate path too (parity with the reader's
  // "Lens '<x>' not available"): an explicit `--lens <reserved>` filters targetLenses
  // to empty, so without this the command prints only a header and exits 0 — a silent
  // no-op indistinguishable from success. A skip (not an error) keeps exit code 0.
  if (explicitLens && !allLenses && isReservedLens(lens)) {
    migrated.push({ lens, action: "skip", reason: "reserved non-lens subdir — not a calibration lens" });
  }
  for (const l of targetLenses) {
    const legacy = path.join(dir, `${l}.jsonl`);
    const shardDir = path.join(dir, l);
    const dest = path.join(shardDir, "legacy.jsonl");
    try {
      if (!fs.existsSync(legacy) || !fs.statSync(legacy).isFile()) {
        migrated.push({ lens: l, action: "skip", reason: "no shared <lens>.jsonl to migrate" });
        continue;
      }
      if (fs.existsSync(dest)) {
        migrated.push({ lens: l, action: "skip", reason: `${l}/legacy.jsonl already exists` });
        continue;
      }
      fs.mkdirSync(shardDir, { recursive: true });
      if (isTracked(target, legacy)) {
        const res = spawnSync("git", ["mv", path.relative(target, legacy), path.relative(target, dest)], {
          cwd: target,
          encoding: "utf8",
        });
        if (res.status !== 0) {
          migrated.push({ lens: l, action: "error", reason: `git mv failed: ${(res.stderr || "").trim()}` });
          continue;
        }
        migrated.push({ lens: l, action: "git-mv", to: dest });
      } else {
        fs.renameSync(legacy, dest);
        migrated.push({ lens: l, action: "rename", to: dest });
      }
    } catch (err) {
      // Per-lens isolation: one lens's filesystem error must not abort the rest.
      migrated.push({ lens: l, action: "error", reason: err.message });
    }
  }
  return { dir, migrated, message: null };
}

// Dedup `review_meta` records by their unique `review_id` key (leaves every other
// kind untouched). In a well-formed corpus each invocation writes one review_meta per
// lens, so this is a no-op; it only removes TRUE duplicates that arise when a union
// source overlaps another (e.g. a legacy flat file resurrected after --migrate by an
// old-prose writer — the per-invocation sharding contract cross-version-writer race). Protects the
// findings-per-review / review-count denominator from silent inflation.
function dedupeReviewMeta(records) {
  const seen = new Set();
  const out = [];
  for (const r of records) {
    if (r && r.kind === "review_meta" && typeof r.review_id === "string") {
      if (seen.has(r.review_id)) continue;
      seen.add(r.review_id);
    }
    out.push(r);
  }
  return out;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    const boundContext = args.context ? readStorageContext(args.context) : null;
    if (args.target && boundContext && fs.realpathSync(path.resolve(args.target)) !== boundContext.target) throw new Error("storage-context-target-mismatch");
    const resolved = resolveTarget(args.target || boundContext?.target);
    if (resolved.warning) args.warnings.push(resolved.warning);
    if (args.migrate) {
      const result = migrate(resolved.target, args.lens, args.allLenses, args.explicitLens);
      if (args.raw) {
        console.log(JSON.stringify({ target: resolved.target, ...result, warnings: args.warnings }, null, 2));
      } else {
        const lines = args.warnings.map((w) => `warning: ${w}`);
        if (result.message) lines.push(result.message);
        else for (const m of result.migrated) {
          lines.push(m.action === "skip" ? `  - ${m.lens}: skipped (${m.reason})`
            : m.action === "error" ? `  ✗ ${m.lens}: ${m.reason}`
            : `  ✔ ${m.lens}: ${m.action} → ${path.relative(resolved.target, m.to)}`);
        }
        console.log([`Calibration migration for ${resolved.target}`, ...lines].join("\n"));
      }
      // Surface aggregate failure to scripted callers (per-lens isolation still runs
      // every lens; the non-zero exit only signals that at least one errored).
      if (result.migrated.some((m) => m.action === "error")) process.exitCode = 1;
      return;
    }
    const context = boundContext || resolveStorage({ target: resolved.target });
    const readSnapshot = (includeActive) => {
      const selection = lensFiles(resolved.target, args.lens, args.allLenses, args.warnings, context, includeActive);
      for (const item of selection.lenses) {
        item.records = [];
        for (const source of item.sources) {
          const parsed = parseJsonl(source);
          args.warnings.push(...parsed.warnings);
          item.records.push(...parsed.records);
        }
      }
      return selection;
    };
    const selection = withExistingStorageReadLock(context, () => readSnapshot(true)) || readSnapshot(false);
    if (selection.message) {
      if (args.raw) console.log(JSON.stringify({ target: resolved.target, message: selection.message, warnings: args.warnings }, null, 2));
      else console.log([...args.warnings.map((w) => `warning: ${w}`), selection.message].join("\n"));
      return;
    }
    const results = [];
    const emptyByLens = new Map();
    for (const item of selection.lenses) {
      // Union every source (legacy `<lens>.jsonl` + per-invocation `<lens>/*.jsonl`).
      const records = item.records;
      // Coexistence guard: a legacy flat `<lens>.jsonl` coexisting with ANY shard in
      // `<lens>/` is the per-invocation sharding contract cross-version-writer race — an old-prose writer still
      // appends to the flat file while a new writer shards. Union counts may then be
      // inflated (only `review_meta` is deduped by review_id; finding-kind metrics are
      // not). Warn instead of silently inflating. Two shapes: post-migration flat-file
      // resurrection (a `<lens>/legacy.jsonl` shard exists) vs the far more common
      // pre-migration transition window (flat + fresh per-invocation shards, no
      // migrate has run yet). The earlier guard only caught the resurrection shape.
      const hasFlat = item.sources.some((s) => path.basename(s) === `${item.lens}.jsonl`);
      const hasShard = item.sources.some((s) => path.basename(s) !== `${item.lens}.jsonl`);
      if (hasFlat && hasShard) {
        const resurrection = item.sources.some((s) => path.basename(s) === "legacy.jsonl");
        args.warnings.push(resurrection
          ? `lens '${item.lens}': both ${item.lens}.jsonl and ${item.lens}/legacy.jsonl are present — a legacy flat file may have been re-created after --migrate; unioned counts may include duplicates. Run 'aivv-calibrate --migrate' to retire the flat file.`
          : `lens '${item.lens}': a legacy flat ${item.lens}.jsonl coexists with per-invocation shards in ${item.lens}/ — cross-version writers (pre-migration transition window); unioned finding-kind counts may be inflated. Run 'aivv-calibrate --migrate' to retire the flat file.`);
      }
      // Dedup review_meta by review_id so overlapping sources can't inflate the denominator.
      const deduped = dedupeReviewMeta(records);
      emptyByLens.set(item.lens, deduped.length === 0);
      results.push(analyze(resolved.target, item.lens, deduped));
    }
    if (args.raw) {
      const payload = args.allLenses ? [...results, { total_lenses_analyzed: results.length }] : results[0];
      if (args.warnings.length > 0) {
        if (Array.isArray(payload)) payload.unshift({ warnings: args.warnings });
        else payload.warnings = args.warnings;
      }
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    const warningBlock = args.warnings.map((w) => `warning: ${w}`);
    const blocks = results.map((result) => formatHuman(result, emptyByLens.get(result.lens)));
    if (args.allLenses) blocks.push(`Total lenses analyzed: ${results.length}`);
    console.log([...warningBlock, ...blocks].join(warningBlock.length ? "\n\n" : "\n\n---\n\n"));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
