#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { validateIncidentRecord, validateLocalIssueRecord, validateProblemRecord } from "./incident-state.mjs";

import { withExistingStorageReadLock, resolveStorage, readStorageContext } from "./storage-paths.mjs";
import { isImportPathVisible, assertNoPendingImports } from "./state-import.mjs";

let boundContext;
const KIND_DIR = {
  incident: "incidents",
  problem: "problems",
  issue: "issues"
};

function writeJson(value, status = 0) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  process.exit(status);
}

function blocked(reason, context = {}) {
  throw Object.assign(new Error(reason), { blockedResponse: { status: "blocked", reason, ...context } });
}

const GITHUB_SELECTOR_FORMS = "accepted forms: https://github.com/<owner>/<repo>/issues/<N>, <owner>/<repo>#N, or #N (uses this checkout's origin remote)";

// State is kept per checkout, so a fresh worktree or clone has none. Say where it looked.
function blockMissingState(selector, target, stateDir) {
  const github = selector?.type === "github_issue";
  blocked(github ? "github-issue-mirror-missing" : "lifecycle-target-missing", {
    selector_type: selector?.type,
    selector: selector?.value,
    target_project: target,
    state_dir: stateDir,
    detail: `no AIVV state for this checkout at ${stateDir}. State is kept per checkout, so ${github ? "an issue mirrored" : "a record created"} from another worktree or clone is not visible here; run from that checkout or pass its --target or --context.`
  });
}

function parseArgs(argv) {
  const parsed = { selectors: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      continue;
    }
    const eq = arg.indexOf("=");
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    let value = eq === -1 ? undefined : arg.slice(eq + 1);
    if (value === undefined && ["target", "context", "incident", "problem", "issue", "github-issue"].includes(key)) {
      value = argv[i + 1];
      i += 1;
    }
    if (key === "context") {
      parsed.context = value;
    } else if (key === "target") {
      parsed.target = value;
    } else if (["incident", "problem", "issue", "github-issue"].includes(key)) {
      parsed.selectors.push({ type: key.replace("-", "_"), value });
    }
  }
  return parsed;
}

function readJsonFile(file) {
  try {
    return { value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (error) {
    return { error };
  }
}

function stateDirForTarget(target) {
  return boundContext && boundContext.target === fs.realpathSync(target) ? boundContext.state_dir : resolveStorage({ target }).state_dir;
}

function resolveExplicitTarget(rawTarget, selector) {
  if (!rawTarget) return null;
  const target = path.resolve(rawTarget);
  const stateDir = stateDirForTarget(target);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory() || !fs.existsSync(stateDir)) {
    if (resolveStorage({ target }).legacy_state_dirs.some((dir) => fs.existsSync(dir))) blocked("lifecycle-import-needed", { target_project: target, source: resolveStorage({ target }).legacy_state_dirs, destination: stateDir });
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      blocked("lifecycle-target-missing", {
        selector_type: selector.type,
        selector: selector.value,
        target_project: target,
        detail: `--target ${target} is not an existing directory`
      });
    }
    blockMissingState(selector, target, stateDir);
  }
  return target;
}

function candidateJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(dir, entry));
}

function loadRecords(target, kind) {
  const dir = path.join(stateDirForTarget(target), KIND_DIR[kind]);
  const records = [];
  const context = boundContext || resolveStorage({ target });
  assertNoPendingImports(context);
  const files = [dir, path.join(context.state_dir, "archive", KIND_DIR[kind])].flatMap(candidateJsonFiles);
  for (const file of files.filter((file) => isImportPathVisible(context, file))) {
    const parsed = readJsonFile(file);
    if (parsed.error) {
      records.push({ file, error: parsed.error });
    } else {
      records.push({ file, record: parsed.value });
    }
  }
  return records;
}

function targetFromCwd(selector, kind) {
  const cwd = resolveStorage().target;
  const stateDir = stateDirForTarget(cwd);
  if (!fs.existsSync(stateDir)) {
    blockMissingState(selector, cwd, stateDir);
  }
  const matches = matchingLocalRecords(cwd, kind, selector.value);
  if (matches.invalidJson.length > 0) {
    blocked("lifecycle-record-invalid-json", {
      selector_type: selector.type,
      selector: selector.value,
      record_path: matches.invalidJson[0].file,
      detail: matches.invalidJson[0].error.message
    });
  }
  if (matches.records.length === 1) return cwd;
  if (matches.records.length > 1) {
    blocked("lifecycle-target-ambiguous", {
      selector_type: selector.type,
      selector: selector.value,
      candidates: matches.records.map((entry) => entry.file)
    });
  }
  blocked("lifecycle-record-missing", {
    selector_type: selector.type,
    selector: selector.value
  });
}

function expectedKindForSelector(selectorType) {
  if (selectorType === "incident") return "incident";
  if (selectorType === "problem") return "problem";
  if (selectorType === "issue") return "issue";
  return null;
}

function matchingLocalRecords(target, kind, id) {
  const records = [];
  const invalidJson = [];
  for (const entry of loadRecords(target, kind)) {
    if (entry.error) {
      invalidJson.push(entry);
      continue;
    }
    if (entry.record?.id === id) {
      records.push(entry);
    }
  }
  return { records, invalidJson };
}

function resolveLocalRecord(target, selector, kind) {
  const matches = matchingLocalRecords(target, kind, selector.value);
  if (matches.invalidJson.length > 0) {
    blocked("lifecycle-record-invalid-json", {
      selector_type: selector.type,
      selector: selector.value,
      record_path: matches.invalidJson[0].file,
      detail: matches.invalidJson[0].error.message
    });
  }
  if (matches.records.length === 0) {
    blocked("lifecycle-record-missing", {
      selector_type: selector.type,
      selector: selector.value
    });
  }
  if (matches.records.length > 1) {
    blocked("lifecycle-target-ambiguous", {
      selector_type: selector.type,
      selector: selector.value,
      candidates: matches.records.map((entry) => entry.file)
    });
  }
  return matches.records[0];
}

function parseGithubSelector(value) {
  if (!value || typeof value !== "string") return null;
  const bare = /^#([0-9]+)$/.exec(value);
  if (bare) return { bare: true, number: Number(bare[1]) };
  const typed = /^([^/\s#]+)\/([^/\s#]+)#([0-9]+)$/.exec(value);
  if (typed) return { owner: typed[1], repo: typed[2], number: Number(typed[3]) };
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "github.com" || parts.length !== 4 || parts[2] !== "issues" || !/^[0-9]+$/.test(parts[3])) {
      return null;
    }
    return { owner: parts[0], repo: parts[1], number: Number(parts[3]) };
  } catch {
    return null;
  }
}

function parseGithubRemote(value) {
  const https = /^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/.exec(value || "");
  if (https) return { owner: https[1], repo: https[2].replace(/\.git$/, "") };
  const ssh = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(value || "");
  if (ssh) return { owner: ssh[1], repo: ssh[2].replace(/\.git$/, "") };
  return null;
}

function targetRemote(target) {
  const result = spawnSync("git", ["remote", "get-url", "origin"], { cwd: target, encoding: "utf8" });
  if (result.status !== 0) return null;
  return parseGithubRemote(result.stdout.trim());
}

function githubMatches(target, selector) {
  const records = loadRecords(target, "issue");
  const invalidJson = records.find((entry) => entry.error);
  if (invalidJson) {
    blocked("lifecycle-record-invalid-json", {
      selector_type: "github_issue",
      selector: selector.value,
      record_path: invalidJson.file,
      detail: invalidJson.error.message
    });
  }
  let parsed = parseGithubSelector(selector.value);
  let usedBareSelector = false;
  if (!parsed) {
    blocked("github-issue-selector-invalid", {
      selector_type: "github_issue",
      selector: selector.value,
      detail: GITHUB_SELECTOR_FORMS
    });
  }
  if (parsed.bare) {
    usedBareSelector = true;
    const remote = targetRemote(target);
    if (!remote) {
      blocked("github-issue-bare-number-ambiguous", {
        selector_type: "github_issue",
        selector: selector.value
      });
    }
    parsed = { ...remote, number: parsed.number };
  }
  const matches = records.filter(({ record }) => {
    const github = record?.sync?.github;
    return github &&
      record.sync?.status === "synced" &&
      github.owner === parsed.owner &&
      github.repo === parsed.repo &&
      Number(github.number) === parsed.number;
  });
  return { matches, usedBareSelector };
}

function resolveGithubRecord(target, selector) {
  const { matches, usedBareSelector } = githubMatches(target, selector);
  if (matches.length === 0) {
    if (usedBareSelector) {
      blocked("github-issue-bare-number-ambiguous", {
        selector_type: "github_issue",
        selector: selector.value
      });
    }
    blocked("github-issue-mirror-missing", {
      selector_type: "github_issue",
      selector: selector.value
    });
  }
  if (matches.length > 1) {
    blocked("github-issue-mirror-ambiguous", {
      selector_type: "github_issue",
      selector: selector.value,
      candidates: matches.map((entry) => entry.file)
    });
  }
  return matches[0];
}

function linksOf(record) {
  return Array.isArray(record?.links) ? record.links : [];
}

function firstLink(record, type) {
  return linksOf(record).find((link) => link?.type === type && typeof link.id === "string" && link.id.trim());
}

function reviewIdFromFindingLink(findingLink) {
  if (!findingLink) return null;
  const match = /^(.+?)[#:](F[A-Za-z0-9._-]+)$/.exec(findingLink.id);
  return match ? match[1] : null;
}

function validateSelectedRecord(target, kind, entry, selector) {
  const options = {
    file: path.resolve(entry.file),
    stateDir: stateDirForTarget(target),
    storageContext: boundContext || resolveStorage({ target })
  };
  let validation;
  if (kind === "incident") validation = validateIncidentRecord(entry.record, options);
  else if (kind === "problem") validation = validateProblemRecord(entry.record, options);
  else if (kind === "issue") validation = validateLocalIssueRecord(entry.record, options);
  else validation = { status: "invalid", reason: "unsupported-lifecycle-kind" };
  if (validation.status !== "valid") {
    blocked("lifecycle-record-invalid", {
      selector_type: selector.type,
      selector: selector.value,
      record_path: path.resolve(entry.file),
      validation
    });
  }
}

function routeFromRecord(target, selector, kind, entry) {
  const record = entry.record;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    blocked("lifecycle-record-kind-mismatch", {
      selector_type: selector.type,
      selector: selector.value,
      record_path: entry.file
    });
  }
  validateSelectedRecord(target, kind, entry, selector);
  const reviewLink = firstLink(record, "review_log");
  const findingLink = firstLink(record, "finding");
  const sourceReviewId = reviewLink?.id || reviewIdFromFindingLink(findingLink);
  const findingId = findingLink?.id?.includes("#") || findingLink?.id?.includes(":")
    ? findingLink.id.split(/[#:]/).at(-1)
    : findingLink?.id;
  let sourceMode = "investigation-only";
  if (reviewLink) sourceMode = "review-sourced";
  else if (findingLink && sourceReviewId) sourceMode = "finding-sourced";

  const lifecycleContext = {
    selector_type: selector.type,
    selector: selector.value,
    record_kind: kind,
    record_id: record.id,
    record_path: path.resolve(entry.file),
    workflow_status: record.status,
    rca_status: record.rca_status,
    source_mode: sourceMode
  };
  if (sourceReviewId) lifecycleContext.source_review_id = sourceReviewId;
  if (findingId) lifecycleContext.finding_id = findingId;
  if (kind === "issue" && record.sync?.github) lifecycleContext.github = record.sync.github;

  const route = {
    status: "routed",
    selector_type: selector.type,
    selector: selector.value,
    target_project: target,
    record_kind: kind,
    record_id: record.id,
    record_path: path.resolve(entry.file),
    workflow_status: record.status,
    rca_status: record.rca_status,
    source_mode: sourceMode,
    lifecycle_context: lifecycleContext
  };
  if (sourceReviewId) route.source_review_id = sourceReviewId;
  if (findingId) {
    route.finding_id = findingId;
    route.filter_finding_id = findingId;
  }
  if (sourceMode !== "investigation-only" && sourceReviewId) {
    route.recommended_fix_args = [`--target=${target}`, `--review-id=${sourceReviewId}`];
  }
  return route;
}

function resolveRoute(args) {
  if (args.selectors.length === 0) blocked("lifecycle-selector-missing");
  if (args.selectors.length > 1) {
    blocked("lifecycle-selector-conflict", {
      selectors: args.selectors.map((selector) => selector.type)
    });
  }

  const selector = args.selectors[0];
  if (!selector.value || selector.value.startsWith("--")) {
    blocked("lifecycle-selector-missing", { selector_type: selector.type });
  }

  let target = resolveExplicitTarget(args.target, selector);
  let kind = expectedKindForSelector(selector.type);
  let entry;

  if (selector.type === "github_issue") {
    if (!target) target = resolveStorage().target;
    const stateDir = stateDirForTarget(target);
    if (!fs.existsSync(stateDir)) blockMissingState(selector, target, stateDir);
    kind = "issue";
    entry = resolveGithubRecord(target, selector);
  } else {
    if (!target) target = targetFromCwd(selector, kind);
    entry = resolveLocalRecord(target, selector, kind);
  }

  return routeFromRecord(target, selector, kind, entry);
}

try {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log([
      "usage: node <AIVV_ROOT>/tools/incident-lifecycle-route.mjs (--incident|--problem|--issue <id> | --github-issue <url|owner/repo#N|N>) [--target <dir> | --context <storage-context.json>]",
      "Prints one JSON route on stdout. Exit 0 on a resolved route, 2 when blocked ({status: \"blocked\", reason, ...}).",
    ].join("\n"));
    process.exit(0);
  }
  const args = parseArgs(process.argv.slice(2));
  if (args.context) {
    boundContext = readStorageContext(args.context);
    if (args.target && fs.realpathSync(path.resolve(args.target)) !== boundContext.target) blocked("storage-context-target-mismatch");
    args.target = boundContext.target;
  }
  const selector = args.selectors[0];
  if (selector?.type === "github_issue" && selector.value && !selector.value.startsWith("--") && !parseGithubSelector(selector.value)) {
    blocked("github-issue-selector-invalid", { selector_type: selector.type, selector: selector.value, detail: GITHUB_SELECTOR_FORMS });
  }
  const context = boundContext || resolveStorage({ target: args.target });
  const route = withExistingStorageReadLock(context, () => resolveRoute(args));
  if (!route) {
    const source = context.legacy_state_dirs.filter((dir) => fs.existsSync(dir));
    if (source.length) writeJson({ status: "blocked", reason: "lifecycle-import-needed", source, target_project: context.target, destination: context.state_dir }, 2);
    blockMissingState(selector, context.target, context.state_dir);
  }
  writeJson(route);
} catch (error) { writeJson(error.blockedResponse || { status: "blocked", reason: error.code || "lifecycle-storage-error", detail: error.message }, 2); }
