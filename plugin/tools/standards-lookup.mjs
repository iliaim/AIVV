#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Default index resolution is script-relative dual-path: sibling-first
// (`<ship-root>/.aivv/standards/index.json`, correct when this script lives at
// `<ship-root>/tools/`), then the cwd-relative legacy repo-root path.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_INDEX_CANDIDATES = [
  path.join(SCRIPT_DIR, "..", ".aivv", "standards", "index.json"),
  "plugin/.aivv/standards/index.json",
];
const DEFAULT_INDEX =
  DEFAULT_INDEX_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || DEFAULT_INDEX_CANDIDATES[0];

function usage() {
  return [
    "Usage: node <AIVV_ROOT>/tools/standards-lookup.mjs [--index <path>] (--id <RULE-ID> | --family <family> | --prefix <PREFIX> | --grep-title <text>) [--json]",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    index: DEFAULT_INDEX,
    id: null,
    family: null,
    prefix: null,
    grepTitle: null,
    json: false,
  };

  function requireValue(flag, index) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--index") {
      args.index = requireValue(arg, i);
      i += 1;
    } else if (arg === "--id") {
      args.id = requireValue(arg, i);
      i += 1;
    } else if (arg === "--family") {
      args.family = requireValue(arg, i);
      i += 1;
    } else if (arg === "--prefix") {
      args.prefix = requireValue(arg, i);
      i += 1;
    } else if (arg === "--grep-title") {
      args.grepTitle = requireValue(arg, i);
      i += 1;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  const queryCount = [args.id, args.family, args.prefix, args.grepTitle].filter(Boolean).length;
  if (queryCount !== 1) {
    throw new Error("exactly one query is required: --id, --family, --prefix, or --grep-title");
  }

  return args;
}

function assertRule(rule) {
  for (const key of ["rule_id", "title", "file", "family"]) {
    if (typeof rule[key] !== "string" || rule[key].length === 0) {
      throw new Error(`index rule missing ${key}: ${JSON.stringify(rule)}`);
    }
  }
  if (typeof rule.line !== "number" || !Number.isInteger(rule.line) || rule.line < 1) {
    throw new Error(`index rule has invalid line: ${JSON.stringify(rule)}`);
  }
}

export function loadIndex(indexPath) {
  const absolute = path.resolve(indexPath);
  const parsed = JSON.parse(fs.readFileSync(absolute, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("standards index root must be an object");
  }
  if (!Array.isArray(parsed.rules)) {
    throw new Error("standards index must contain rules[]");
  }

  const seen = new Map();
  for (const rule of parsed.rules) {
    assertRule(rule);
    if (seen.has(rule.rule_id)) {
      throw new Error(`duplicate rule id ${rule.rule_id}: ${seen.get(rule.rule_id)} and ${rule.file}:${rule.line}`);
    }
    seen.set(rule.rule_id, `${rule.file}:${rule.line}`);
  }

  return parsed;
}

function sortRules(rules) {
  return [...rules].sort((a, b) => a.rule_id.localeCompare(b.rule_id));
}

function queryRules(index, args) {
  if (args.id) {
    const rule = index.rules.find((candidate) => candidate.rule_id === args.id);
    if (!rule) {
      throw new Error(`unknown standards rule id: ${args.id}`);
    }
    return [rule];
  }

  if (args.family) {
    return sortRules(index.rules.filter((rule) => rule.family === args.family));
  }

  if (args.prefix) {
    const prefix = `${args.prefix.replace(/-$/, "")}-`;
    return sortRules(index.rules.filter((rule) => rule.rule_id.startsWith(prefix)));
  }

  const needle = args.grepTitle.toLowerCase();
  return sortRules(index.rules.filter((rule) => rule.title.toLowerCase().includes(needle)));
}

function renderText(rules) {
  for (const rule of rules) {
    console.log(`${rule.rule_id}\t${rule.family}\t${rule.file}:${rule.line}\t${rule.title}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const index = loadIndex(args.index);
  const rules = queryRules(index, args);

  if (args.json) {
    const value = args.id ? rules[0] : rules;
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  renderText(rules);
}

function isDirectInvocation() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectInvocation()) {
  try {
    main();
  } catch (error) {
    console.error(`standards-lookup error: ${error.message}`);
    process.exit(1);
  }
}
