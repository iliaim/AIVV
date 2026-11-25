# Platform Adapter: Antigravity (AGY)

**Platform:** Google Antigravity (AGY)
**Status:** Active
**Runtime contract:** [.aivv/runtime-contract.md](../runtime-contract.md)
**Shell requirement:** Host shell via `run_command` (zsh/bash on macOS/Linux).
**Runtime dependencies:**
- **Required:** `git` and `node` on `PATH`. Resolve the installed runtime once per invocation through [runtime-root.md](../runtime-root.md), then invoke its `tools/storage-paths.mjs` helper for the bound target's external state/calibration paths. Use the shared storage read/write commands for active records; host-native file tools inspect source and explicit historical inputs. Python is not required.
- **Soft-required:** `jq` (1.6+) for `/aivv-view` and the `/aivv-fix` Step 6 warnings-count branch. When `jq` is absent, `/aivv-fix` falls back to the `heading_count >= 3` branch alone.
- **Action Inbox:** uses the same required Node runtime for its short-lived loopback server and exclusive claim helper; opening the Inbox remains optional.

This document maps AIVV's shared workflow concepts to Antigravity's native tool names, subagent-dispatch semantics, capability boundaries, and portable plugin installation flow. Shared methodology, state formats, schemas, and provider adapters remain in their existing AIVV locations.

---

## Tool name mapping

AIVV workflows refer to abstract actions; Antigravity implements them via these native tools.

| Abstract action in AIVV prose | Antigravity tool | Notes |
|---|---|---|
| Read a file | `read_file` | Reads text, images, and other supported media by absolute path. |
| Modify an existing file | `edit_file` | Targeted contiguous replacement; follow AIVV write-intent and pre-write validation gates. |
| Create a new file | `write_file` | Creates or overwrites files; follow AIVV write-intent and pre-write validation gates. |
| Run a shell command | `run_command` | Runs in a fresh shell session per call (cwd and exported env vars do not persist across calls; pass pinned `AIVV_ROOT` explicitly on every call). |
| Search file contents / find files | `run_command` (`rg`, `grep`, `find`) | Scope searches to the confirmed `AIVV_ROOT` or user-authorized target. |
| Search the web | `search_web` | Read-only web search when authorized by the task. |
| Ask the user a structured question | `ask_question` | Multiple-choice prompts for scope/method confirmation; plain text for trivial yes/no questions. |
| Track task progress during a workflow | `update_steps` | Replaces the full ordered step list (up to 12 items) each call. Follow [session-continuity.md](../session-continuity.md): merge with existing steps when possible, or use short text phase updates if existing items cannot be reproduced. Pair with `update_focus` for finer-grained phase activity. |
| Spawn a cold read-only subagent | `invoke_subagent` with `TypeName: "research"` | Built-in read-only sandbox with no network access and no parent conversation history. Used for reviewers, investigators, fix-plan challengers, and verifiers. |
| Spawn a write-capable subagent (if ever needed) | `invoke_subagent` with `TypeName: "self"` | Inherits parent tools/capabilities in a separate conversation context. Not used for read-only review/investigation/verification roles. |
| Communicate with a running/paused subagent | `send_message` | Sends a follow-up message by `conversationId`. Used only for targeted follow-up; never to leak peer outputs across reviewers. |
| List or terminate subagents | `manage_subagents` | `Action: "list"` inspects direct subagents; `Action: "kill"` with `ConversationIds: [...]` closes consumed AIVV-owned handles. |

---

## Subagent dispatch and reactive wakeup lifecycle

Antigravity's `invoke_subagent` tool launches each subagent in a fresh, isolated conversation context without parent conversation history:

| Abstract AIVV role | Antigravity `invoke_subagent` parameters | Role instructions |
|---|---|---|
| Reviewer (`/aivv`, Cases A/B) | `TypeName: "research"`, `Role: "AIVV Reviewer (<label>)"` | Prompt instructs subagent to read `$AIVV_ROOT/.aivv/prompts/reviewer-role.md` and its assigned lens/methodology references from `$AIVV_ROOT`. |
| Investigator (`/aivv-fix`, Step 3) | `TypeName: "research"`, `Role: "AIVV Investigator (<batch_id>)"` | Prompt instructs subagent to read `$AIVV_ROOT/.aivv/prompts/investigator-role.md` and schema references from `$AIVV_ROOT`. |
| Fix-plan challenger (`/aivv-fix`, Step 4.5) | `TypeName: "research"`, `Role: "AIVV Fix Challenger (<batch_id>)"` | Prompt instructs subagent to read `$AIVV_ROOT/.aivv/prompts/fix-challenger-role.md` from `$AIVV_ROOT`. |
| Verifier (`/aivv-fix`, Step 6) | `TypeName: "research"`, `Role: "AIVV Verifier (cycle <N>)"` | Prompt instructs subagent to read `$AIVV_ROOT/.aivv/prompts/verifier-role.md` from `$AIVV_ROOT`. |

**Dispatch semantics:**
- **Parallel dispatch:** emit multiple `invoke_subagent` calls in a single assistant turn (e.g., all `N` reviewers for Case B, or up to 3 independent investigator batches). Each subagent gets its own isolated conversation and cannot see peer outputs.
- **Sequential dispatch:** launch one `invoke_subagent` call at a time for batches containing `CRITICAL` findings.
- **Reactive wakeup (no polling):** `invoke_subagent` returns a `conversationId` immediately and runs asynchronously. Do **not** poll in a loop or run shell `sleep` commands; end the turn with no further tool calls and Antigravity automatically wakes the orchestrator as each subagent sends its result via `send_message`. Wait until all dispatched subagents in the round have reported before synthesis or reconciliation.
- **Model selection:** omit `Model` (defaults to `"inherit"`) unless the user explicitly requested a different model tier.
- **Handle tracking and cleanup:** record each returned `conversationId` in the AIVV handle table with `output_consumed: false`. Once its output is integrated (and for `/aivv`, after the durable Step 7.5 log write), mark `output_consumed: true` and close only AIVV-owned handles using `manage_subagents(Action: "kill", ConversationIds: [...])`. Never use `Action: "kill_all"` if non-AIVV subagents may be active. Cleanup failures are warnings and do not discard consumed output.

---

## Read-only enforcement and unused Claude Code assets

On Antigravity, read-only isolation for reviewers, investigators, fix-plan challengers, and verifiers is enforced natively by the built-in `research` subagent (`TypeName: "research"`), which runs in a read-only sandbox with no write tools and no network access.

- **`agents/reviewer.md`, `agents/investigator.md`, and `hooks/hooks.json` are Claude Code-specific and intentionally unused by Antigravity.** `agy plugin validate` reports frontmatter errors on `agents/*.md` (Claude Code's comma-separated `tools:` string) and a warning on `hooks/hooks.json` (nested hooks path). Antigravity skips those files while loading all 5 canonical skills cleanly; do not alter `agents/*.md` or `hooks/hooks.json` in a way that breaks Claude Code compatibility.
- **Visibility note (`methodology`):** Like Hermes Agent, Antigravity loads all `skills/*/SKILL.md` directories in the plugin, so `methodology` appears in the skill list alongside `aivv`, `aivv-fix`, `aivv-view`, and `aivv-calibrate`. `methodology` remains shared support material and is not a standalone workflow.

---

## Runtime root and reference loading

Antigravity installs the plugin directory under `~/.gemini/config/plugins/aivv/` (preserving the `plugin/` tree layout: `skills/<name>/SKILL.md`, `.aivv/`, and `tools/`). Each skill's absolute `SKILL.md` path is provided in the session's Available Skills list.

Before any operational route reads state, extracts context, asks a scope question, or dispatches a subagent, derive the loaded skill directory from the active skill's `SKILL.md` path and run preflight once via `run_command`:

```bash
node "<skill_dir>/../../.aivv/runtime-root.mjs" --preflight aivv "<skill_dir>"
```

Use the matching route profile (`aivv`, `aivv-fix`, `aivv-view`, or `aivv-calibrate`). Capture the printed absolute path as `AIVV_ROOT` and pass it explicitly in every subsequent `run_command` call (because each `run_command` runs in a fresh shell session and does not inherit exported variables from prior calls). If preflight prints `AIVV_INSTALLATION_INCOMPLETE`, surface that single diagnostic and stop.

---

## Capability flags

Declared against the canonical vocabulary in [runtime-contract.md](../runtime-contract.md):

| Runtime-contract capability | Status | Notes |
|---|---|---|
| `can_resolve_skill_assets` | `available` | Antigravity provides exact absolute `SKILL.md` paths; `runtime-root.mjs --preflight` resolves and pins `AIVV_ROOT`. |
| `can_spawn_cold_agents` | `available` | `invoke_subagent` with `TypeName: "research"` starts a fresh subagent with no parent conversation history. |
| `can_isolate_reviewer_context` | `available` | Each `research` subagent receives only the explicit prompt/evidence packet passed to `invoke_subagent`. |
| `can_hide_peer_outputs_until_synthesis` | `available` | Parallel `research` subagents have separate conversations and only message the parent orchestrator. |
| `can_parallelize_agents` | `available` | Multiple `invoke_subagent` calls in one turn execute concurrently with reactive wakeup on completion. |
| `can_read_conversation_history` | `available` | Active orchestrator has access to the current conversation context; mark any unavailable/compacted fields explicitly. |
| `can_read_tool_history` | `available` | Active orchestrator sees files read/edited/commands run in the current session. |
| `can_enforce_readonly` | `available` | Enforced natively by Antigravity's built-in `research` subagent (read-only sandbox, no write tools, no network access). |
| `can_write_project_state` | `available` | Orchestrator writes validated state/calibration through `$AIVV_ROOT/tools/storage-paths.mjs` via `run_command`. |
| `can_invoke_peer_skill` | `partial` | Antigravity does not expose a programmatic `Skill` tool to auto-invoke a peer slash command in-turn, but the orchestrator can read `$AIVV_ROOT/skills/aivv-fix/SKILL.md` (or `skills/aivv/SKILL.md`) via `read_file` and continue in-session with explicit `--review-id=<id>` handoff, or halt with a manual-resume banner when a clean command boundary is required. |
| `can_emit_runtime_probe_scaffolds` | `available` | Orchestrator can write reviewable Playwright probe scaffolds via `write_file` / Node helpers. |
| `can_ingest_runtime_results` | `available` | Orchestrator can run `node "$AIVV_ROOT/tools/runtime-evidence.mjs" ingest` via `run_command`. |
| `can_invoke_playwright_mcp` | `conditional` | Optional; available only if a browser/Playwright/Chrome DevTools MCP server is configured in the user's Antigravity session. |
| `can_persist_screenshot_artifacts` | `available` | Orchestrator can write PNG artifacts via `run_command` / `write_file` under `<target>/.aivv/visual-baselines/` without silent overwrite. |
| `can_receive_remediation_request` | `available` | Orchestrator can run `node "$AIVV_ROOT/tools/aivv-action-inbox.mjs" claim ...` via `run_command` and continue through `/aivv-fix`. |

---

## Installation and validation

Install the portable plugin package into Antigravity from a local checkout of AIVV:

```bash
git clone --branch main https://github.com/iliaim/AIVV.git AIVV
agy plugin validate ./AIVV/plugin --json
agy plugin install ./AIVV/plugin
agy plugin enable aivv
agy plugin list
```

See [INSTALL.md](https://github.com/iliaim/AIVV/blob/main/INSTALL.md) for update and uninstall steps. After installation, start a new Antigravity session (or reload plugins) to use `/aivv`, `/aivv-fix`, `/aivv-view`, and `/aivv-calibrate`.

---

## Session persistence and host access

Resolve storage through `node "$AIVV_ROOT/tools/storage-paths.mjs" resolve` using the pinned `AIVV_ROOT`; never construct state paths from the consuming project's working directory. Legacy `.aivv/state/`, `.aivv/calibration/`, and `.claude/sessions/` histories remain read-only unless explicitly imported per [state-maintenance.md](../state-maintenance.md).
