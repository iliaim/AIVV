#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const contractRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function isValidRuntimeRoot(candidate) {
  return Boolean(
    candidate &&
    fs.existsSync(path.join(candidate, ".aivv")) &&
    fs.existsSync(path.join(candidate, "tools", "pre-write-validator.mjs")),
  );
}

function canonicalCandidate(candidate) {
  if (!candidate) return "";
  return path.resolve(candidate);
}

function resolveRuntimeRoot(skillDir) {
  const requestedRoot = process.env.AIVV_ROOT;
  if (requestedRoot) {
    const candidate = canonicalCandidate(requestedRoot);
    if (!isValidRuntimeRoot(candidate)) {
      throw new Error(`AIVV_ROOT is not an AIVV runtime root: ${candidate}`);
    }
    return candidate;
  }

  const claudeRoot = canonicalCandidate(process.env.CLAUDE_PLUGIN_ROOT);
  if (isValidRuntimeRoot(claudeRoot)) return claudeRoot;

  const codexHome = canonicalCandidate(process.env.CODEX_HOME);
  const envCodexRoot = codexHome ? canonicalCandidate(path.join(codexHome, "aivv-runtime")) : "";
  if (isValidRuntimeRoot(envCodexRoot)) return envCodexRoot;

  const hostRoot = skillDir ? canonicalCandidate(path.join(skillDir, "..", "..")) : "";
  const derivedCodexRoot = hostRoot ? canonicalCandidate(path.join(hostRoot, "aivv-runtime")) : "";
  if (isValidRuntimeRoot(derivedCodexRoot)) return derivedCodexRoot;
  if (isValidRuntimeRoot(hostRoot)) return hostRoot;

  if (isValidRuntimeRoot(contractRoot)) return contractRoot;

  throw new Error("Unable to resolve AIVV runtime root; provide AIVV_ROOT or a loaded skill directory.");
}

if (process.argv[2] !== "--print") {
  console.error("Usage: runtime-root.mjs --print [skill-directory]");
  process.exit(2);
}

try {
  console.log(resolveRuntimeRoot(process.argv[3] || process.env.SKILL_BASE_DIR || ""));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
