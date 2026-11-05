#!/usr/bin/env node
// Claude Code PreToolUse hook for AIVV's read-only native agents.
// Fail closed: only simple, explicitly read-only shell commands are permitted.

import path from "node:path";
import { realpathSync } from "node:fs";

const BLOCKED = (reason) => {
  process.stderr.write(`Blocked by AIVV read-only agent Bash guard: ${reason}\n`);
  process.exit(2);
};

function tokenize(command) {
  if (typeof command !== "string" || command.trim() === "") {
    throw new Error("missing Bash command");
  }

  // The investigator needs one command per call. Disallow shell composition,
  // expansion, escapes, and redirection so the command cannot hide a second
  // operation behind a read-only prefix.
  if (/[\r\n;&|<>`$\\~{}*?\[\]\0]/.test(command)) {
    throw new Error("shell operators, expansions, escapes, globbing, and redirection are disabled");
  }

  const tokens = [];
  let token = "";
  let quote = null;
  let started = false;

  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else token += char;
      started = true;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (started) tokens.push(token);
      token = "";
      started = false;
      continue;
    }
    token += char;
    started = true;
  }

  if (quote) throw new Error("unclosed quote");
  if (started) tokens.push(token);
  if (tokens.length === 0) throw new Error("missing command");
  return tokens;
}

function isAllowed(tokens, policy) {
  const [executable, ...gitWords] = tokens;

  if (policy === "reviewer" && executable !== "git") return false;

  // Do not accept executable paths, shell builtins, package managers, network
  // clients, deployment CLIs, environment dumps, or archive extraction tools.
  if (executable !== "git") {
    const args = gitWords;
    if (!["cat", "head", "tail", "grep", "ls", "wc"].includes(executable)) {
      return false;
    }
    const options = args.slice(0, args.indexOf("--") < 0 ? args.length : args.indexOf("--"));
    if (executable === "grep" && options.some((arg) => arg === "--file" || arg.startsWith("--file=") || arg === "--exclude-from" || arg.startsWith("--exclude-from=") || (/^-[^-]/.test(arg) && arg.slice(1).includes("f")))) return false;
    if (executable === "grep" && options.some((arg) => arg === "--recursive" || arg === "--dereference-recursive" || (/^-[^-]/.test(arg) && /[rR]/.test(arg.slice(1))))) return false;
    if (executable === "ls" && options.some((arg) => arg === "--dereference" || (/^-[^-]/.test(arg) && arg.slice(1).includes("L")))) return false;
    return true;
  }

  // Keep the pager override before Git's global options and the subcommand.
  if (gitWords[0] !== "--no-pager") return false;
  const afterPager = gitWords.slice(1);
  const safeStatusPrefix = ["--no-optional-locks", "-c", "core.fsmonitor=false"];
  const hasSafeStatusPrefix = safeStatusPrefix.every((flag, index) => afterPager[index] === flag);
  const commandWords = hasSafeStatusPrefix ? afterPager.slice(safeStatusPrefix.length) : afterPager;
  const [subcommand, ...args] = commandWords;

  // Git built-ins are read-only here. Reject flags that can write output or
  // invoke an external diff/textconv/pager command.
  // `blame` can invoke Git's diff machinery and has no safe invocation policy
  // here, so it is intentionally outside the allowlist.
  if (!["status", "log", "diff", "show"].includes(subcommand)) return false;
  if (subcommand === "status" && !hasSafeStatusPrefix) return false;
  const deniedGitFlags = /^(--output(?:=|$)|--ext-diff$|--textconv$|--exec(?:=|$)|--pager(?:=|$)|--pathspec-from-file(?:=|$)|--pathspec-file-nul$|-o(?:$|.)|-O(?:$|.))/;
  if (args.some((arg) => deniedGitFlags.test(arg))) return false;
  // Configured diff.external and textconv drivers can execute arbitrary programs.
  // Require Git's explicit per-command opt-outs whenever a command may render diffs.
  if (["log", "diff", "show"].includes(subcommand)
      && (!args.includes("--no-ext-diff") || !args.includes("--no-textconv"))) return false;
  return true;
}

function isWorkspacePath(candidate, workspaceRoot, endOfOptions) {
  if (candidate === "" || (candidate === "-" && !endOfOptions)) return true;
  const lexical = path.resolve(workspaceRoot, candidate);
  const relative = path.relative(workspaceRoot, lexical);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;

  let probe = lexical;
  let resolved;
  while (true) {
    try {
      resolved = realpathSync(probe);
      break;
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
      const parent = path.dirname(probe);
      if (parent === probe) return false;
      probe = parent;
    }
  }
  const realRelative = path.relative(workspaceRoot, resolved);
  return realRelative === "" || (!realRelative.startsWith(`..${path.sep}`) && realRelative !== ".." && !path.isAbsolute(realRelative));
}

function stayWithinWorkspace(tokens, workspaceRoot) {
  let endOfOptions = false;
  for (const token of tokens.slice(1)) {
    if (token === "--") {
      endOfOptions = true;
      continue;
    }
    const candidates = [token];
    const equals = token.indexOf("=");
    if (equals > 0) candidates.push(token.slice(equals + 1));
    const attachedShortPath = token.match(/^-[A-Za-z]+(\/.*)$/);
    if (attachedShortPath) candidates.push(attachedShortPath[1]);

    for (const candidate of candidates) {
      if (candidate === "" || (candidate === "-" && !endOfOptions)) continue;
      if (!endOfOptions && candidate.startsWith("-") && !candidate.includes("/")) continue;
      if (!isWorkspacePath(candidate, workspaceRoot, endOfOptions)) return false;
    }
  }
  return true;
}

let input;
try {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  input = JSON.parse(raw);
} catch {
  // The caller cannot be identified when the hook payload is malformed, so
  // fail closed for the session rather than risk bypassing the target policy.
  BLOCKED("could not parse hook input");
}

// Plugin hooks run for the whole session. Restrict only the two read-only
// AIVV subagents; other agents and the parent session retain their Bash access.
const policyByAgent = {
  "aivv:investigator": "investigator",
  "aivv:reviewer": "reviewer",
};
if (input?.tool_name !== "Bash" || typeof input?.tool_input?.command !== "string") {
  BLOCKED("hook input is missing the Bash tool payload");
}
if (input?.agent_id && typeof input?.agent_type !== "string") {
  BLOCKED("subagent hook input is missing its agent type");
}
if (typeof input?.agent_type === "string" && input.agent_type.startsWith("aivv:") && !policyByAgent[input.agent_type]) {
  BLOCKED("unrecognized AIVV subagent type");
}
const policy = policyByAgent[input?.agent_type];
if (!policy) process.exit(0);

try {
  const tokens = tokenize(input?.tool_input?.command);
  const workspaceRoot = realpathSync(input.cwd);
  if (!stayWithinWorkspace(tokens, workspaceRoot)) {
    BLOCKED("command path escapes the current project directory");
  }
  if (!isAllowed(tokens, policy)) BLOCKED(`command is outside the read-only ${policy} allowlist`);
} catch (error) {
  BLOCKED(error instanceof Error ? error.message : "invalid command");
}
