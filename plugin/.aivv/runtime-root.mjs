#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const contractRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PREFLIGHT_FILES = {
  aivv: [
    "skills/aivv/SKILL.md",
    ".aivv/platform-adapters/hermes-agent.md",
    ".aivv/runtime-root.md",
    ".aivv/runtime-contract.md",
    ".aivv/target-resolution.md",
    ".aivv/state-maintenance.md",
    ".aivv/configuration.md",
    ".aivv/schemas/config.schema.json",
    ".aivv/schemas/review-log.json",
    ".aivv/schemas/calibration.json",
    ".aivv/schemas/finding.json",
    ".aivv/schemas/README.md",
    ".aivv/calibration/README.md",
    ".aivv/methodology.md",
    ".aivv/outer-loop.md",
    ".aivv/lenses/README.md",
    ".aivv/standards/README.md",
    ".aivv/standards/index.json",
    ".aivv/prompts/reviewer-role.md",
    ".aivv/lenses/code.md",
    ".aivv/lenses/compliance.md",
    ".aivv/lenses/general.md",
    ".aivv/lenses/i18n.md",
    ".aivv/lenses/polish.md",
    ".aivv/lenses/sec.md",
    ".aivv/lenses/user-journey.md",
    ".aivv/lenses/ux.md",
    ".aivv/lenses/visual.md",
    ".aivv/platform-adapters/anthropic.md",
    ".aivv/platform-adapters/claude-code.md",
    ".aivv/platform-adapters/codex.md",
    ".aivv/platform-adapters/gemini.md",
    ".aivv/platform-adapters/openai.md",
    "skills/methodology/SKILL.md",
    "skills/methodology/references/review-phases.md",
    "skills/methodology/references/severity-confidence.md",
    "skills/methodology/references/source-grounding.md",
    "skills/methodology/references/runtime-visual-verification.md",
    "skills/methodology/references/standards-lookup.md",
    "skills/methodology/references/general-review-checklist.md",
    "tools/storage-paths.mjs",
    "tools/pre-write-validator.mjs",
    "tools/aivv-prompt-bundle.mjs",
    "tools/native-prompt-boundary.mjs",
    "tools/dispatch.mjs",
    "tools/runtime-evidence.mjs",
    "tools/provider-trust.mjs",
    "tools/provider-registry.mjs",
    "tools/model-selection.mjs",
    "tools/standards-lookup.mjs",
    "tools/model-catalog.json",
    "tools/aivv-calibrate.mjs",
    "tools/state-import.mjs",
    "skills/aivv/references/argument-parsing.md",
    "skills/aivv/references/auto-chain-handoff.md",
    "skills/aivv/references/consensus-output-templates.md",
    "skills/aivv/references/eval-harness.md",
    "skills/aivv/references/help-text.md",
    "skills/aivv/references/lens-composition.md",
    "skills/aivv/references/multi-model-dispatch.md",
    "skills/aivv/references/non-native-provider-commands/claude.json",
    "skills/aivv/references/non-native-provider-commands/codex.json",
    "skills/aivv/references/non-native-provider-commands/gemini.json",
    "skills/aivv/references/orchestration-workflow.md",
    "skills/aivv/references/preferences.md",
    "skills/aivv/references/result-rendering-policy.md",
    "skills/aivv/references/review-dispatch-lifecycle.md",
    "skills/aivv/references/review-shape-resolution.md",
    "skills/aivv/references/scope-confirmation.md",
    "skills/aivv/references/reviewer-prompt-template.md",
    "skills/aivv/references/review-log-schema.md",
    "skills/aivv/references/self-calibration.md",
    "skills/aivv/references/setup-hint.md",
    "skills/aivv/references/setup-wizard.md",
    "skills/aivv/references/thoroughness-dial.md",
    "skills/aivv/references/viewer-hook.md",
  ],
  "aivv-fix": [
    "skills/aivv-fix/SKILL.md",
    ".aivv/platform-adapters/hermes-agent.md",
    "skills/aivv/SKILL.md",
    ".aivv/runtime-root.md",
    ".aivv/runtime-contract.md",
    ".aivv/target-resolution.md",
    ".aivv/state-maintenance.md",
    ".aivv/configuration.md",
    ".aivv/outer-loop.md",
    ".aivv/methodology.md",
    ".aivv/schemas/config.schema.json",
    ".aivv/schemas/finding.json",
    ".aivv/schemas/remediation-request.json",
    ".aivv/schemas/README.md",
    ".aivv/schemas/review-log.json",
    ".aivv/schemas/fix-log.json",
    ".aivv/schemas/decisions.json",
    ".aivv/schemas/calibration.json",
    ".aivv/schemas/incident.json",
    ".aivv/schemas/problem.json",
    ".aivv/schemas/local-issue.json",
    ".aivv/calibration/README.md",
    ".aivv/standards/README.md",
    ".aivv/standards/index.json",
    ".aivv/prompts/_untrusted-content.md",
    ".aivv/prompts/investigator-role.md",
    ".aivv/prompts/fix-challenger-role.md",
    ".aivv/prompts/verifier-role.md",
    ".aivv/platform-adapters/anthropic.md",
    ".aivv/platform-adapters/claude-code.md",
    ".aivv/platform-adapters/codex.md",
    ".aivv/platform-adapters/gemini.md",
    ".aivv/platform-adapters/openai.md",
    "tools/storage-paths.mjs",
    "tools/pre-write-validator.mjs",
    "tools/runtime-evidence.mjs",
    "tools/native-prompt-boundary.mjs",
    "tools/aivv-action-inbox.mjs",
    "tools/state-import.mjs",
    "tools/incident-lifecycle-route.mjs",
    "tools/incident-state.mjs",
    "tools/incident-github-sync.mjs",
    "tools/standards-lookup.mjs",
    "tools/state-compat-index.mjs",
    "tools/aivv-calibrate.mjs",
    "skills/aivv-fix/references/action-inbox.md",
    "skills/aivv-fix/references/apply-policy-and-gates.md",
    "skills/aivv-fix/references/batched-and-challenger-schemas.md",
    "skills/aivv-fix/references/challenge-loop.md",
    "skills/aivv-fix/references/class-sibling-triage-template.md",
    "skills/aivv-fix/references/containment.md",
    "skills/aivv-fix/references/document-and-calibration.md",
    "skills/aivv-fix/references/execution-branches.md",
    "skills/aivv-fix/references/execution-decisioning.md",
    "skills/aivv-fix/references/fast-path.md",
    "skills/aivv-fix/references/finding-collection.md",
    "skills/aivv-fix/references/fix-challenger-prompt-template.md",
    "skills/aivv-fix/references/fix-flags.md",
    "skills/aivv-fix/references/fix-log-contract.md",
    "skills/aivv-fix/references/fix-preferences.md",
    "skills/aivv-fix/references/investigation-dispatch.md",
    "skills/aivv-fix/references/investigator-enrichment-fields.md",
    "skills/aivv-fix/references/investigator-field-definitions.md",
    "skills/aivv-fix/references/investigator-output-example.md",
    "skills/aivv-fix/references/investigator-prompt-template.md",
    "skills/aivv-fix/references/json-schema.md",
    "skills/aivv-fix/references/mechanical-verification-checks.md",
    "skills/aivv-fix/references/polish-and-l1-source-policy.md",
    "skills/aivv-fix/references/preamble-state-maintenance.md",
    "skills/aivv-fix/references/red-green-gate.md",
    "skills/aivv-fix/references/review-id-resolution.md",
    "skills/aivv-fix/references/schema-migration-notes.md",
    "skills/aivv-fix/references/triage.md",
    "skills/aivv-fix/references/verifier-dispatch.md",
    "skills/aivv-fix/references/verifier-prompt-template.md",
    "skills/aivv-fix/references/viewer-hook.md",
    "skills/aivv-fix/references/write-intents-and-prewrite-validation.md",
  ],
  "aivv-view": [
    "skills/aivv-view/SKILL.md",
    ".aivv/platform-adapters/hermes-agent.md",
    ".aivv/runtime-root.md",
    ".aivv/runtime-contract.md",
    ".aivv/target-resolution.md",
    ".aivv/schemas/review-log.json",
    ".aivv/schemas/fix-log.json",
    ".aivv/schemas/decisions.json",
    ".aivv/schemas/remediation-request.json",
    ".aivv/schemas/state-compat-index.json",
    ".aivv/schemas/incident.json",
    ".aivv/schemas/problem.json",
    ".aivv/schemas/local-issue.json",
    "tools/storage-paths.mjs",
    "tools/aivv-action-inbox.mjs",
    "tools/state-import.mjs",
    "tools/state-compat-index.mjs",
    "tools/incident-state.mjs",
    "skills/aivv-view/references/canonical-envelope-schema.json",
    "skills/aivv-view/references/humanize.md",
    "skills/aivv-view/references/loader-warnings.md",
    "skills/aivv-view/references/projection-table.md",
    "skills/aivv-view/references/report-renderer-contract.md",
    "skills/aivv-fix/references/action-inbox.md",
    "skills/aivv-view/scripts/_lib.sh",
    "skills/aivv-view/scripts/humanize.jq",
    "skills/aivv-view/scripts/humanize.sh",
    "skills/aivv-view/scripts/loader-content.sh",
    "skills/aivv-view/scripts/storage.mjs",
    "skills/aivv-view/scripts/view-browser.sh",
    "skills/aivv-view/scripts/view-html.sh",
    "skills/aivv-view/scripts/view-loader.sh",
    "skills/aivv-view/scripts/view-tui.sh",
    "skills/aivv-view/scripts/view.sh",
    "skills/aivv-view/templates/report.css",
    "skills/aivv-view/templates/report.js",
  ],
  "aivv-calibrate": [
    "skills/aivv-calibrate/SKILL.md",
    ".aivv/platform-adapters/hermes-agent.md",
    "skills/aivv/SKILL.md",
    "skills/aivv-fix/SKILL.md",
    ".aivv/runtime-root.md",
    ".aivv/runtime-contract.md",
    ".aivv/target-resolution.md",
    ".aivv/schemas/calibration.json",
    ".aivv/calibration/README.md",
    "tools/storage-paths.mjs",
    "tools/state-import.mjs",
    "tools/aivv-calibrate.mjs",
  ],
};

function isValidRuntimeRoot(candidate) {
  if (!candidate) return false;
  try {
    return fs.statSync(path.join(candidate, ".aivv")).isDirectory();
  } catch {
    return false;
  }
}

function resolveStandaloneSkillRoot(candidate) {
  if (!candidate) return "";
  try {
    if (!fs.statSync(path.join(candidate, "SKILL.md")).isFile() ||
        !fs.statSync(path.join(candidate, ".aivv")).isDirectory()) {
      return "";
    }
  } catch {
    return "";
  }

  // A standalone skill carries only the resolver bootstrap. Its sibling is
  // the shared runtime. If that sibling is absent, keep the selected skill
  // root so preflight reports one incomplete-installation diagnostic instead
  // of silently selecting another cache.
  const siblingRuntime = canonicalCandidate(path.join(candidate, "..", "..", "aivv-runtime"));
  return isValidRuntimeRoot(siblingRuntime) ? siblingRuntime : candidate;
}

function canonicalCandidate(candidate) {
  if (!candidate) return "";
  return path.resolve(candidate);
}

function resolveRuntimeRoot(skillDir) {
  const requestedRoot = process.env.AIVV_ROOT;
  if (requestedRoot) {
    // An explicit root is already the selected installation. Return it even
    // when incomplete so --preflight can report one actionable diagnostic
    // instead of falling through to another cached version.
    return canonicalCandidate(requestedRoot);
  }

  const claudeRoot = process.env.CLAUDE_PLUGIN_ROOT?.trim();
  if (claudeRoot) return canonicalCandidate(claudeRoot);

  const pluginRoot = process.env.PLUGIN_ROOT?.trim();
  if (pluginRoot) return canonicalCandidate(pluginRoot);

  const resolverOverride = process.env.AIVV_RUNTIME_ROOT_HELPER?.trim();
  if (resolverOverride) {
    return resolveStandaloneSkillRoot(contractRoot) || contractRoot;
  }

  const skillRoot = canonicalCandidate(skillDir);
  const standaloneRoot = resolveStandaloneSkillRoot(skillRoot);
  if (standaloneRoot) return standaloneRoot;
  if (isValidRuntimeRoot(skillRoot)) return skillRoot;

  const hostRoot = skillRoot ? canonicalCandidate(path.join(skillRoot, "..", "..")) : "";
  const derivedCodexRoot = hostRoot ? canonicalCandidate(path.join(hostRoot, "aivv-runtime")) : "";
  if (isValidRuntimeRoot(derivedCodexRoot)) return derivedCodexRoot;
  if (isValidRuntimeRoot(hostRoot)) return hostRoot;

  const codexHome = canonicalCandidate(process.env.CODEX_HOME);
  const envCodexRoot = codexHome ? canonicalCandidate(path.join(codexHome, "aivv-runtime")) : "";
  if (isValidRuntimeRoot(envCodexRoot)) return envCodexRoot;

  if (isValidRuntimeRoot(contractRoot)) return resolveStandaloneSkillRoot(contractRoot) || contractRoot;

  throw new Error("Unable to resolve AIVV runtime root; provide AIVV_ROOT or a loaded skill directory.");
}

function resolveIndexedDependencies(root, profile) {
  const requiredLines = new Map();
  const problems = [];
  if (!new Set(["aivv", "aivv-fix"]).has(profile)) return { dependencies: [], problems };
  const indexPath = ".aivv/standards/index.json";
  let index;
  try {
    index = JSON.parse(fs.readFileSync(path.join(root, indexPath), "utf8"));
  } catch {
    return { dependencies: [], problems: [`${indexPath} is unreadable or invalid JSON`] };
  }
  if (!index || !Array.isArray(index.rules)) {
    return { dependencies: [], problems: [`${indexPath} has no rules array`] };
  }
  const seenRuleIds = new Set();
  for (const rule of index.rules) {
    const relativePath = rule?.file;
    if (!rule || typeof rule.rule_id !== "string" || !rule.rule_id.trim() ||
        typeof rule.title !== "string" || !rule.title.trim() ||
        typeof rule.family !== "string" || !rule.family.trim() ||
        typeof relativePath !== "string" || !relativePath.trim() ||
        !relativePath.startsWith(".aivv/standards/") ||
        path.isAbsolute(relativePath) ||
        relativePath.split(/[\\/]/).includes("..") ||
        !Number.isInteger(rule?.line) || rule.line < 1) {
      problems.push(`${indexPath} contains an invalid rule reference`);
      continue;
    }
    if (seenRuleIds.has(rule.rule_id)) {
      problems.push(`${indexPath} contains duplicate rule id ${rule.rule_id}`);
      continue;
    }
    seenRuleIds.add(rule.rule_id);
    requiredLines.set(relativePath, Math.max(requiredLines.get(relativePath) || 0, rule.line));
  }
  for (const [relativePath, lastReferencedLine] of requiredLines) {
    try {
      const lines = fs.readFileSync(path.join(root, relativePath), "utf8").split(/\r?\n/);
      if (lines.length < lastReferencedLine) problems.push(`${relativePath}:${lastReferencedLine} is outside the referenced file`);
    } catch {
      // The shared missing-file diagnostic below reports this path.
    }
  }
  return { dependencies: [...requiredLines.keys()], problems: [...new Set(problems)] };
}

try {
  const mode = process.argv[2];
  const skillDir = process.env.SKILL_BASE_DIR || "";
  if (mode === "--print") {
    console.log(resolveRuntimeRoot(process.argv[3] || skillDir));
  } else if (mode === "--preflight") {
    const profile = process.argv[3];
    const requirements = PREFLIGHT_FILES[profile];
    if (!requirements) {
      console.error("Usage: runtime-root.mjs --preflight <aivv|aivv-fix|aivv-view|aivv-calibrate> [skill-directory]");
      process.exit(2);
    }
    let root;
    try {
      root = resolveRuntimeRoot(process.argv[4] || skillDir);
    } catch (error) {
      console.error(`[AIVV] AIVV_INSTALLATION_INCOMPLETE: could not resolve the selected runtime root: ${error instanceof Error ? error.message : String(error)}. Repair or reinstall this AIVV installation, restart the host, and retry in a new invocation.`);
      process.exit(3);
    }
    const indexed = resolveIndexedDependencies(root, profile);
    const allRequirements = [...new Set([...requirements, ...indexed.dependencies])];
    const missing = allRequirements.filter((relativePath) => {
      try {
        return !fs.statSync(path.join(root, relativePath)).isFile();
      } catch {
        return true;
      }
    });
    if (missing.length > 0 || indexed.problems.length > 0) {
      const formatIssues = (label, issues) => {
        const examples = issues.slice(0, 3).join(", ");
        const remainder = issues.length > 3 ? `, and ${issues.length - 3} more` : "";
        return `${label} (${issues.length}): ${examples}${remainder}`;
      };
      const missingText = missing.length > 0
        ? formatIssues("missing required files", missing.map((item) => path.join(root, item)))
        : "";
      const problemsText = indexed.problems.length > 0
        ? formatIssues("invalid indexed references", indexed.problems)
        : "";
      const detail = [missingText, problemsText].filter(Boolean).join("; ");
      console.error(`[AIVV] AIVV_INSTALLATION_INCOMPLETE: selected runtime root ${root} has ${detail}. Repair or reinstall this AIVV installation, restart the host, and retry in a new invocation. No alternate runtime root was used.`);
      process.exit(3);
    }
    console.log(root);
  } else {
    console.error("Usage: runtime-root.mjs --print [skill-directory]");
    console.error("   or: runtime-root.mjs --preflight <aivv|aivv-fix|aivv-view|aivv-calibrate> [skill-directory]");
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
