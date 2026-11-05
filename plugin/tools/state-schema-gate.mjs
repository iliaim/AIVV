#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { withExistingStorageReadLock, readStorageContext, resolveStorage } from "./storage-paths.mjs";
import { isImportPathVisible } from "./state-import.mjs";

const SUPPORTED_STATE_SCHEMA_VERSION = 2;
const STATE_FILE_RE = /^(review-|fix-|outer-loop-).+\.json$/;

function usage() {
  return [
    "Usage: node <AIVV_ROOT>/tools/state-schema-gate.mjs --state-dir <dir> [options]",
    "",
    "Options:",
    "  --review-id <id>       Hard-fail if that selected review log is newer/corrupt",
    "  --outer-loop-id <id>   Hard-fail if that selected outer-loop state is newer/corrupt",
    "  --require-wont-fix     Hard-fail if wont-fix-registry.json is newer/corrupt",
    "  --json                 Emit machine-readable JSON",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    stateDir: null,
    reviewId: null,
    outerLoopId: null,
    requireWontFix: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--context") {
      args.context = argv[++i];
    } else if (arg === "--target") {
      args.target = argv[++i];
    } else if (arg === "--state-dir") {
      args.stateDir = argv[++i];
    } else if (arg === "--review-id") {
      args.reviewId = stripPrefix(argv[++i], "review-").replace(/\.json$/, "");
    } else if (arg === "--outer-loop-id") {
      args.outerLoopId = stripPrefix(argv[++i], "outer-loop-").replace(/\.json$/, "");
    } else if (arg === "--require-wont-fix") {
      args.requireWontFix = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (args.context) {
    args.storageContext = readStorageContext(args.context);
    if (args.target && fs.realpathSync(path.resolve(args.target)) !== args.storageContext.target) throw new Error("storage-context-target-mismatch");
    if (args.stateDir && path.resolve(args.stateDir) !== args.storageContext.state_dir) throw new Error("storage-context-state-dir-mismatch");
  }
  if (!args.stateDir) args.stateDir = (args.storageContext || resolveStorage({ target: args.target })).state_dir;
  return args;
}

function stripPrefix(value, prefix) {
  return typeof value === "string" && value.startsWith(prefix)
    ? value.slice(prefix.length)
    : value;
}

function isStateFile(name) {
  return STATE_FILE_RE.test(name) || name === "wont-fix-registry.json";
}

function selectedReason(name, args) {
  if (args.reviewId && name === `review-${args.reviewId}.json`) {
    return "selected-review-id";
  }
  if (args.outerLoopId && name === `outer-loop-${args.outerLoopId}.json`) {
    return "selected-outer-loop";
  }
  if (args.requireWontFix && name === "wont-fix-registry.json") {
    return "selected-wont-fix-registry";
  }
  return null;
}

function readSchemaVersion(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { kind: "corrupt", error: error.message };
  }

  if (!Object.prototype.hasOwnProperty.call(parsed, "schema_version")) {
    return { kind: "ok", schemaVersion: 1, legacyMissing: true };
  }

  const version = parsed.schema_version;
  if (typeof version !== "number" || Number.isNaN(version)) {
    return { kind: "corrupt", error: `schema_version is not numeric: ${JSON.stringify(version)}` };
  }

  if (version > SUPPORTED_STATE_SCHEMA_VERSION) {
    return { kind: "newer", schemaVersion: version };
  }

  return { kind: "ok", schemaVersion: version };
}

export function checkStateSchemaGate(options) {
  const dir = path.resolve(options.stateDir);
  const state = path.basename(dir) === "archive" ? path.dirname(dir) : dir;
  const metadata = path.join(path.dirname(state), "target.json");
  const context = options.storageContext || (fs.existsSync(metadata) ? { target_dir: path.dirname(state) } : null);
  return context ? withExistingStorageReadLock(context, () => checkStateSchemaGateSnapshot({ ...options, storageContext: context }))
    || { status: "pass", supportedMax: SUPPORTED_STATE_SCHEMA_VERSION, checked: 0, warnings: [], errors: [] } : checkStateSchemaGateSnapshot(options);
}

function checkStateSchemaGateSnapshot(options) {
  const stateDir = path.resolve(options.stateDir);
  const context = options.storageContext || { target_dir: path.dirname(path.basename(stateDir) === "archive" ? path.dirname(stateDir) : stateDir) };
  const allEntries = fs.existsSync(stateDir) ? fs.readdirSync(stateDir).filter(isStateFile).sort() : [];
  const entries = allEntries.filter((name) => isImportPathVisible(context, path.join(stateDir, name)));

  const warnings = [];
  const errors = [];
  for (const name of allEntries.filter((name) => !entries.includes(name))) {
    if (selectedReason(name, options)) errors.push({ file: path.join(stateDir, name), name, code: "STATE_IMPORT_PENDING", message: "Selected state is invisible until explicit import recovery completes." });
  }

  for (const name of entries) {
    const file = path.join(stateDir, name);
    const reason = selectedReason(name, options);
    const result = readSchemaVersion(file);
    const record = { file, name, reason, ...result };

    if (result.kind === "newer") {
      if (reason) {
        errors.push({
          ...record,
          code: name.startsWith("review-") ? "REVIEW_SCHEMA_NEWER" : "SCHEMA_NEWER_REQUIRED",
          message: `${name} has schema_version ${result.schemaVersion}; this AIVV version supports ${SUPPORTED_STATE_SCHEMA_VERSION} for selected state logs.`,
        });
      } else {
        warnings.push({
          ...record,
          code: "STATE_SCHEMA_NEWER_HISTORICAL",
          message: `${name} has schema_version ${result.schemaVersion}; leaving historical log in place and continuing because this invocation did not select it.`,
        });
      }
    } else if (result.kind === "corrupt") {
      if (reason) {
        errors.push({
          ...record,
          code: name.startsWith("review-") ? "REVIEW_CORRUPT" : "STATE_CORRUPT_SELECTED",
          message: `${name} could not be parsed and is required for this invocation: ${result.error}`,
        });
      } else {
        warnings.push({
          ...record,
          code: "STATE_CORRUPT_HISTORICAL",
          message: `${name} could not be parsed; leaving historical log in place and continuing because this invocation did not select it.`,
        });
      }
    }
  }

  return {
    status: errors.length ? "halt" : "pass",
    supportedMax: SUPPORTED_STATE_SCHEMA_VERSION,
    checked: entries.length,
    warnings,
    errors,
  };
}

function renderText(verdict) {
  const lines = [];
  if (verdict.errors.length) {
    for (const error of verdict.errors) {
      lines.push(`${error.code}: ${error.message}`);
      lines.push(`Remediation: upgrade AIVV if this log came from a newer compatible runtime, or run without selecting this log. To preserve audit history, do not edit/delete it in place; preserve it as historical data and explicitly import a compatible selection.`);
    }
  }
  if (verdict.warnings.length) {
    lines.push(`[aivv preamble] ${verdict.warnings.length} historical state warning(s); continuing.`);
    for (const warning of verdict.warnings.slice(0, 10)) {
      lines.push(`- ${warning.code}: ${warning.name} (${warning.kind}${warning.schemaVersion !== undefined ? ` ${warning.schemaVersion}` : ""})`);
    }
    if (verdict.warnings.length > 10) {
      lines.push(`- ... +${verdict.warnings.length - 10} more`);
    }
  }
  return lines.join("\n");
}

function main(argv) {
  const args = parseArgs(argv);
  const verdict = checkStateSchemaGate(args);
  if (args.json) {
    console.log(JSON.stringify(verdict, null, 2));
  } else {
    const text = renderText(verdict);
    if (text) console.log(text);
  }
  return verdict.status === "pass" ? 0 : 1;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(`state-schema-gate error: ${error.message}`);
    process.exit(2);
  }
}
