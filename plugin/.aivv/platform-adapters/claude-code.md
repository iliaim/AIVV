# Platform Adapter: Claude Code

**Platform:** Anthropic Claude Code CLI
**Status:** Active (default substrate for AIVV v0.1.x)
**Runtime contract:** [.aivv/runtime-contract.md](../runtime-contract.md)
**Shell requirement:** Unix-like shell (bash, zsh, Git Bash on Windows, WSL). Claude Code's `Bash` tool ships a Git Bash environment on Windows, so this is transparent in normal use.
**Runtime dependencies:**
- **Required:** `git` and `node`. Resolve the installed runtime through [runtime-root.md](../runtime-root.md), then invoke its `tools/storage-paths.mjs` helper for the bound target’s external state/calibration paths. Use the shared storage read/write commands for active records; host-native file tools inspect source and explicit historical inputs. Python is not required.
- **Soft-required:** `jq` for the `/aivv-fix` Step 6 step 2 pre-evaluation gate (`warnings_count` extraction from the fix-log via `jq '.warnings | length' <fix_log>`) and the `--list-wont-fix` raw-registry inspection fallback when the registry schema-gate hard-errors. Not pre-installed on macOS / Windows Git Bash / most Linux distros — users install via package manager (`brew install jq`, `apt install jq`, `winget install jq`, etc.). When `jq` is absent, the `Bash` tool surface returns a `command not found` error and the gate's warnings branch is unevaluable; orchestrator falls back to gate's `heading_count >= 3` branch alone (loses warnings-only fire). A future release may replace this dependency with a pure-shell parser if the soft-required posture proves too much friction. Python is not required by the shipped runtime.
- **Action Inbox:** uses the same required Node runtime for its short-lived loopback server and exclusive claim helper; opening the Inbox remains optional.

This document maps AIVV's shared workflow concepts to Claude Code's concrete tool names, subagent-dispatch syntax, and installation flow. Codex has its own adapter in `codex.md`; other hosts should get a separate adapter rather than changing the shared workflow contract.

---

## Tool name mapping

AIVV workflows refer to abstract actions; Claude Code implements them via these tools.

| Abstract action in AIVV prose | Claude Code tool |
|---|---|
| Read a file | `Read` |
| Modify an existing file | `Edit` |
| Create a new file | `Write` |
| Run a shell command | `Bash` |
| Search file contents by pattern | `Grep` |
| Find files by glob | `Glob` |
| Track task progress during a workflow | Whichever progress tool the session exposes: the Task tools (`TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet`) create or update one item at a time; `TodoWrite`, where enabled, sends the whole list each call; the desktop app's plan tool sends the whole list, caps its length, and allows one in-progress item. Follow `.aivv/session-continuity.md`. |
| Spawn a subagent | `Agent` (or `Task` — alias depending on Claude Code version) |
| Browse the web | `WebFetch`, `WebSearch` |
| Load a skill in-session | `Skill` |

Some existing skills still contain host-specific tool references. Keep those references explicitly labeled, and migrate them into the active adapter when touching that workflow. New shared workflow instructions should use abstract operations from the runtime contract.

---

## Read-only enforcement

AIVV reviewer and investigator agents are intended to be read-only outside explicit fix/execution phases.

**Bash pattern allowlists are not sufficient enforcement by themselves.** Empirically verified 2026-10-30 (Claude Code v2.1.309): a probe agent with `tools: Bash(git log:*)` successfully ran `pwd` when permission checks were bypassed. `tools:` also blocked the investigator's `Write` tool in the same version. The AIVV plugin now adds a bundled `PreToolUse` hook for both read-only agents. It blocks shell composition, expansions, redirection, and commands outside each agent's read-only allowlist.

Read-only enforcement in Claude Code comes from:
- The plugin's `PreToolUse` Bash guard and the declared tool surfaces.
- Agent body prose explicitly forbidding writes.
- Claude Code's interactive permission system as defense in depth.
- The orchestrator's workspace snapshot guard.

The Bash guard rejects DNS clients such as `dig` and `nslookup` because caller-controlled
queries can transmit inspected data. Every allowed Git invocation must use `git --no-pager`;
`git log`, `git diff`, and `git show` must also include `--no-ext-diff --no-textconv` so
repository-level configuration cannot execute pager, external diff, or text-conversion
programs.

---

## Multi-model provider dispatch (Case D — `multi_model_enabled: true`)

When `multi_model_enabled: true`, `/aivv` Case D dispatches three providers in parallel. On Claude Code, the Anthropic slot uses the **Agent tool** instead of a `dispatch.mjs` subprocess. This is a platform-specific adaptation — on Codex/other hosts, all three providers use `dispatch.mjs`.

**Why Agent tool for Anthropic on Claude Code:**
Spawning `claude --print` as a Node.js subprocess from within an active Claude Code session is unreliable. The subprocess inherits `CLAUDECODE=1` and `CLAUDE_CODE_SESSION_ID` and can interact pathologically with the parent session (manifesting as ~285s hangs or wrong-schema output). The Agent tool bypasses this by using Claude Code's native in-process subagent dispatch — the same path Cases A/B/C already use successfully.

**Anthropic dispatch on Claude Code:**
```
Agent tool: subagent_type: aivv:reviewer
description: "AIVV multi-model review — Anthropic (alpha)"
prompt: {cold reviewer prompt from SKILL.md Step 4}
```
The agent response text is parsed as reviewer findings (not NDJSON). See SKILL.md Case D 5.D.4–5.D.5 for the full dispatch and result-parsing instructions.

**Gemini + OpenAI on Claude Code:**
Use the `AIVV_ROOT` pinned and preflighted at the current AIVV invocation's start, then use `"$AIVV_ROOT/tools/dispatch.mjs"` via Bash background jobs, same as other hosts. No session conflict — Google CLI subprocesses (`agy` or legacy `gemini`) and `codex` are unrelated binaries.

**Probe behavior on Claude Code:**
`dispatch.mjs --probe --provider anthropic --provider-egress-consent` exits 0 with a "native Agent tool path available" message when `CLAUDECODE=1`. This correctly signals availability without triggering the CLI-subprocess path. A machine-parseable JSON line is also written to stderr: `{"aivv_capability":"anthropic","dispatch_path":"agent-tool","reason":"claude-code-session-detected"}`.

**Session detection (`isInsideClaudeCodeSession`):**
The guard checks `CLAUDECODE` or `CLAUDE_CODE_SESSION_ID` env vars. Known edge cases where the guard may fire incorrectly:
- Shell sessions that inherited `CLAUDECODE` from a previously-exited Claude Code process (env vars persist in shell rc-sourced contexts)
- CI environments where `CLAUDECODE=1` is set for unrelated reasons
- Future Claude Code versions that rename these env vars

**Override:** set `AIVV_FORCE_CLI_DISPATCH=1` to bypass the CLAUDECODE guard and use the CLI subprocess path. Useful for debugging, testing the CLI path from outside Claude Code, or working around false-positive detection.

---

## Subagent dispatch

AIVV spawns subagents for independent review, investigation, and verification. Claude Code's `Agent`/`Task` tool handles this.

**Plugin-namespaced subagent references:**

| Abstract agent role | Claude Code `subagent_type:` |
|---|---|
| Review agent (for `/aivv` with any `--reviewers=N` and any `--lens=X`) | `aivv:reviewer` |
| Investigator (for `/aivv-fix` Step 3) | `aivv:investigator` |

**Dispatch semantics:**
- Parallel spawning: up to 3 subagents launched in a single message with multiple tool calls
- Sequential spawning: one at a time for CRITICAL findings (full attention)
- Cold spawn (per methodology.md invariant): subagent receives no conversation history from the parent

**Empirical verification of namespacing syntax**: Confirmed 2026-04-21 via `claude -p` subprocess dispatch in a fresh session. `subagent_type: aivv-test:hello` resolved; bare `hello` failed with "Agent type not found"; slash form `aivv-test/hello` was rejected.

---

## Preloaded skills (agent frontmatter)

Agent definitions declare preloaded methodology via `skills:` frontmatter. Plugin-namespaced references:

| Agent | Preloaded skills (`skills:` frontmatter values) |
|---|---|
| `aivv:reviewer` | `aivv:methodology` (merged — includes review methodology + project-context discovery) |
| `aivv:investigator` | (none — Investigation Protocol inlined in the agent body as of dev.9; Phase 1.5 PREREQUISITE PROBE added dev.29) |

Empirically confirmed 2026-04-21 via subprocess dispatch — a test agent with `skills: - aivv-test:test-methodology` in its frontmatter correctly accessed the plugin's bundled skill content.

---

## Repository validation

From the repository root, validate the Claude Code plugin package with `claude plugin validate --profile directory plugin`.

---

## Plugin manifest

**Location**: `.claude-plugin/plugin.json` (at plugin root)

**Required fields for Claude Code**:
- `name`: plugin identifier (`aivv`)
- `description`: short user-facing description
- `author.name`: plugin author
- `license`: SPDX identifier (`MIT`)

**Note — version field**: For relative-path plugins (`source: "./"`), the `version` field lives in `marketplace.json` (per-plugin entry), NOT in `plugin.json`. The plugin manifest's version would silently win over the marketplace version per Anthropic's docs, so for relative-path plugins the canonical approach is: omit `version` from `plugin.json`, set it in `marketplace.json`. AIVV follows this — `.claude-plugin/plugin.json` has no `version` field; the canonical version is at `.claude-plugin/marketplace.json` `plugins[0].version`.

**Marketplace manifest**: `.claude-plugin/marketplace.json` at the plugin root. Required for local-directory installs; defines marketplace `name` (canonical: `aivv`), `owner`, `metadata.description`, and the `plugins[]` catalog. For relative-path plugins (`source: "./"`), plugin version lives in `marketplace.json` — not in `plugin.json` — per Anthropic docs ("plugin manifest always wins silently; for relative-path plugins, set version in marketplace entry").

**Installation flow (CLI, empirically verified 2026-04-21):**

```bash
claude plugin validate /absolute/path/to/AIVV       # optional — pre-flight manifest check
claude plugin marketplace add /absolute/path/to/AIVV
claude plugin install aivv@aivv
claude plugin list                                   # verify install
```

From a GitHub repo (future public distribution):

```bash
claude plugin marketplace add <author>/aivv-plugin
claude plugin install aivv@aivv
```

The equivalent in-app slash-command form (`/plugin marketplace add`, `/plugin install`) also works. Both surfaces accept the same `<name>@<marketplace>` identifier pattern.

**Verified install outcome (shipped version = whatever `.claude-plugin/marketplace.json` currently declares):**
- Plugin surfaces as `aivv@aivv` at the declared version with scope `user`.
- Skills surface as `aivv:aivv`, `aivv:aivv-fix`, `aivv:methodology`. (The `aivv:aivv` form is because plugin name and `/aivv` skill name both happen to be `aivv` — user-facing slash command is still `/aivv`. `aivv:investigation-methodology` was removed in dev.9 — its 5-phase protocol is now inlined directly in the `aivv:investigator` agent body.)
- Agents `aivv:reviewer` and `aivv:investigator` resolve as `subagent_type:` targets in a fresh subprocess.

---

## Slash commands

AIVV skills expose slash commands via SKILL.md frontmatter's `description:` field. Claude Code auto-triggers skills based on description matching; users can also invoke explicitly.

| AIVV skill | Slash command (user-invocable) |
|---|---|
| `aivv` | `/aivv` (supports `--reviewers=N` or bare-integer shorthand; `--lens=general` default, with `--lens=code` and other specialist lenses available) |
| `aivv-fix` | `/aivv-fix` |
| `methodology` | (not user-invocable — preload only; merged review methodology + project-context) |

Lenses are defined by files in `.aivv/lenses/<name>.md`; [the lens catalog](../lenses/README.md) lists the shipped choices. `general` is the default for intent-driven review across artifact types; specialist lenses remain selectable. B3 runtime evidence is externalized by default through generated Playwright probe scaffolds plus user-run JSON ingest; host browser drivers are optional gated adapters. Additional lenses (`perf`, `a11y` as a pure-a11y split) are Tier 2/3. Alias commands (e.g., `/aivv-visual` → `/aivv --lens=visual`) and scheduled audits (`/aivv-audit`) are Tier 3.

---

## MCP integrations

AIVV itself has no MCP dependencies in Tier 1. Runtime evidence does not require Playwright MCP: AIVV can emit probe scaffolds and ingest user-run Playwright JSON. Playwright MCP or Chrome DevTools MCP may be declared by a future host adapter for read-only enrichment, but they are not required for the default B3 path.

When an AIVV skill declares an MCP dependency, the dependency is on the MCP server itself — not on the user having a specific plugin installed. Users install the MCP server separately; AIVV gracefully degrades with a clear error if the MCP is absent.

---

## Session persistence and host access

Resolve storage using the installed `tools/storage-paths.mjs` helper after using the `AIVV_ROOT` pinned and preflighted at invocation start; do not construct paths from the consuming CWD. The helper selects a per-target-instance directory under the user’s platform state root, with report cache separate from durable history. See [runtime-contract.md](../runtime-contract.md) for the shared storage contract and [state-maintenance.md](../state-maintenance.md) for explicit legacy import.

Legacy `.aivv/state/`, `.aivv/calibration/` and `.claude/sessions/` history stays readable and unchanged. Ordinary invocations do not create or update these consuming-project directories. Existing tracked history remains intact; new generated history is personal. Explicit configuration, report output and runtime-probe artifacts retain their documented project-output behavior. Provider trust remains installation-owned.

**Permissions are host-dependent.** External state writes and helper shell commands may require Claude Code permission approval or sandbox access. Do not infer permission-free behavior from an unrestricted shell test, a bypass-permissions session, or the old project-directory allowlist. If access is denied, report the resolved path and denied operation; grant narrowly scoped access through the host’s supported permission UI/settings and retry. Do not fall back to project, plugin or temporary storage. Read-only queries must not initialize a store merely to test write access.

The author-side packaging fixture installs a disposable Codex fixture and invokes shipped helpers directly from outside a consuming project. This proves packaging/helper discovery in that shell, not Claude Code’s interactive sandbox or permission prompts. An end-to-end Claude Code probe must record its actual permission mode and access outcome separately.

---

## Assumptions specific to Claude Code (cross-agent portability flags)

When adding another host adapter, re-verify each of these against the target platform:

1. **Plugin-agent namespacing as `<plugin>:<agent>`** — Claude Code convention (empirically verified via throwaway test plugin). Other platforms may use different separators (slash, dot) or no namespacing.
2. **Subagent `Agent` / `Task` tool with `subagent_type:` parameter** — Claude Code-specific. Other platforms have different parallel/subagent patterns (or none).
3. **Skill auto-triggering via `description:` field** — Claude Code convention. Other platforms may require explicit invocation or different trigger syntax.
4. **`Skill` tool for in-session skill invocation** — Claude Code-specific. Other platforms may auto-load all installed skills or require a different invocation.
5. **`.claude-plugin/plugin.json` manifest** — Claude Code-only. Other platforms have their own manifest formats and locations.
6. **User-scope permission model** (`~/.claude/settings.json` allowlists) — Claude Code-specific. Other platforms have different permission/sandbox models.
7. **MCP server availability via `mcp plugin install`** — Claude Code integration. Other platforms may use different MCP distribution or have no MCP.

---

## Versioning

This adapter is versioned with the AIVV plugin (see `marketplace.json`'s `plugins[0].version` field — the canonical version for relative-path plugins). When Claude Code's plugin spec changes in a way that affects this adapter, update this document AND bump the marketplace version.
