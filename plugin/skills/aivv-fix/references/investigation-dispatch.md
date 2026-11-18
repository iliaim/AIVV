# Investigation Dispatch

Read from `skills/aivv-fix/SKILL.md` before investigator dispatch or same-agent fallback.

## Contents

- Reproducibility gate ([reproducibility-gate.md](reproducibility-gate.md))
- Change-attribution probe
- Investigator decision gate
- Cold dispatch and fallback rules

### Step 3: INVESTIGATE — Root Cause Analysis

**Default assumption: root cause is unknown.** Every finding that still needs a fix gets an investigator unless it passes the low-risk fast path below, the only skip route. A finding the reproducibility gate closes first (`already-correct`, or `unreachable-static` → `wont-fix`) needs no investigation. Confidence in a plausible explanation is not a reason to skip.

#### Reproducibility gate

For findings sourced from `[user-reported]`, `[deferred]`, or `[agent-noted]`, and for any `lens: sec` finding, run the [reproducibility gate](reproducibility-gate.md) before investigator dispatch.

#### Change-attribution probe (CRITICAL/MAJOR findings — before investigator dispatch)

For each **CRITICAL or MAJOR** finding, before spawning investigators, run:

```
git log -n 1 --follow -- <finding_file>
git blame -L <finding_line>,<finding_line> <finding_file>
```

Capture as a structured `introduced_by` object and pass as pre-populated context in the investigator prompt:

```json
"introduced_by": {
  "last_commit_sha": "...",
  "last_commit_message": "...",
  "last_commit_author": "...",
  "last_commit_date": "...",
  "blame_lines_touched": [N],
  "confidence": "programmatic"
}
```

If the file is untracked (not in git): set `confidence: "unavailable-untracked"` and omit the other fields.

If the file does not exist at HEAD (deleted or renamed without `--follow` resolution): set `confidence: "unavailable-deleted"` and omit the other fields — the investigator may consult the history of the prior path via `git log --all --full-history -- <path>` if attribution is load-bearing.

**Why the orchestrator runs this, not the investigator:** `git blame` is deterministic; LLMs hallucinate commit messages under multi-file changes. This follows SonarQube SCM integration and PagerDuty/FireHydrant change-event patterns — timeline attribution is programmatic data-gathering, not causal reasoning. The investigator's job is to reason about whether that commit is the proximate cause or a latent condition — not to discover it.

**Skip when:** finding is MINOR or POLISH.

**Dispatch-context handoff:** The `introduced_by` object is passed to the investigator as the `{introduced_by_context}` prompt template token — set to the JSON-serialized `introduced_by` object, or `"(not available)"` when the file is untracked. See the Key placeholders list below for fill instructions. Instruction 8e in `investigator-prompt-template.md` reads this token as "dispatch context" to determine whether `introduced_by` is available.

#### Decision gate (per batch)

Ask: *"Do I know with confidence exactly why this is happening AND exactly what the fix is?"*

**Spawn an investigator** (the common case) when:
- Root cause is not obvious from the finding description alone
- Multiple files or subsystems may be involved
- The fix could have side effects that aren't clear upfront
- Any CRITICAL finding (always investigate — the stakes are too high to assume)
- You're unsure whether similar patterns exist elsewhere in the codebase

**Documentation-gap routing:** `documentation-gap` findings normally dispatch the investigator. The only exception is the formal [fast-path.md](fast-path.md) route for a low-risk documentation gap whose exact `verbatim_doc_content` is already known and every fast-path eligibility gate passes. Otherwise, the investigator is the cheapest correct path: it discovers unknown content or confirms the mechanical prose via `fix_proposal.verbatim_doc_content`.

**Same-agent fallback for `documentation-gap`:** When `capability_degradations` contains `"investigator_cold_dispatch_unavailable"`, ALL `documentation-gap` findings route directly to Branch E (`CLARIFICATION_NEEDED:empirical_verification_required`) without proceeding to Branch B prose edit. The same-agent investigator role may still run inline and emit `verification_method` for telemetry/calibration, but this does NOT affect routing — Branch E fires regardless of `verification_method` value. Structural independence required by the verifier's evidence grep is absent under same-agent mode.

**Low-risk fast path — the only way to skip the investigator:** check [fast-path.md](fast-path.md). When every fast-path eligibility gate passes, emit the structured `investigation_route: "fast_path_inline"` record and continue through Step 4 write-intent and verification gates. A finding that still needs a fix and fails any gate gets the investigator; there is no other skip route.

**When in doubt, spawn the investigator.** The cost of a false skip (missing root cause, missing similar patterns) is higher than the cost of an unnecessary investigation.

#### Architectural remediation assessment seed

Before investigator dispatch, compute `architectural_remediation_assessment` for each batch and pass the full reason-coded object into the investigator prompt as `{architectural_remediation_assessment}`.

1. Seed weak matches from finding/batch text mentioning UI/layout, measurement, wrappers, sibling modes, first paint, flicker, alignment, duplicated contracts, route/component scope, visual behavior tests, schema/parser/formatter/API contracts.
2. Seed strong matches only from duplicated contract evidence, manual sync invariant evidence, `predecessor_finding_match`, `class_signature`, `scope_search_seed`, or bounded same-area recurrence.
3. Weak matches set `scan_required: true` only. They do not demote `fix_confidence`, trigger Step 4.5, or enter the decision queue when the investigator provides structured disproof. If the investigator omits the scan or returns malformed disproof, fail closed to the decision queue. Targeted re-investigation is allowed only when this is a specific output defect with a concrete repair inside `authorized_scope` and the shared retry budget has room; append one `architecture-check` retry event first. Otherwise report the finding unresolved instead of routing it as ordinary.
4. Strong matches set `required: true`.

The investigator must prove or disprove each reason with file/grep evidence.

#### Spawning rules (for batches that require investigation)

Build the prompt carefully — the investigator has NO conversation history.

Before spawning investigators, apply the lifecycle pre-spawn cleanup rule (see **Lifecycle pre-spawn cleanup** below). This cleanup is best-effort and scoped only to visible completed AIVV-owned handles from prior interrupted invocations; unrelated user-created agents are never closed.

**Prompt template**: See [investigator-prompt-template.md](investigator-prompt-template.md) — read and fill in all `{placeholder}` values before sending. Key placeholders:
- `{authorized_scope}` → copy the immutable `authorized_scope` snapshot from `/aivv-fix` Step 1.9. Do not regenerate it from the current finding summary or accept alternative wording that changes the original goal or boundaries.
- `{json_schema_absolute_path}` → the absolute path to `references/json-schema.md` within the installed plugin cache at runtime (e.g., `~/.claude/plugins/cache/<marketplace>/aivv/<version>/skills/aivv-fix/references/json-schema.md`). This index links the focused schema references. The orchestrator fills the exact path at dispatch time — the investigator runs in the project's working directory and cannot resolve relative paths back to the skill.
- `{source_signal}` → the signal label for each finding from the triage table: `[ivv]`, `[user-reported]`, `[deferred]`, or `[agent-noted]` — must be populated so the investigator calibrates scrutiny appropriately
- `{introduced_by_context}` → JSON-serialized `introduced_by` object from the change-attribution probe above, or the literal string `"(not available)"` when the file is untracked, deleted/renamed at HEAD, or the finding is MINOR/POLISH (the probe skips non-CRITICAL/MAJOR findings). Passed to each CRITICAL/MAJOR finding's investigator as the `## Change Attribution` section in the prompt.
- `{plugin_root_absolute_path}` → the absolute `AIVV_ROOT` pinned and preflighted at this `/aivv-fix` invocation's start (see `SKILL.md` "Runtime pin and preflight"); do not re-resolve it. The investigator reads its role file from this root, never from the target project.
- `{target_project}` → the session target project absolute path. Use the canonical target/storage context bound before maintenance; do not infer a provisional target from findings. **Worktree-CWD note:** the investigator independently searches files to discover root causes and similar patterns, and inherits the orchestrator's shell CWD — which may be a stale git worktree at a different commit than the target. The template's `## Working Directory` block anchors all file operations on this absolute path — keep that block intact when filling placeholders (do not relax it to a bare relative-path hint), so the investigator searches the real target tree rather than the inherited CWD.

**Spawning rules** (host-neutral; each host's specific dispatch syntax in `<!-- CLAUDE-CODE-SPECIFIC -->` aside below):
- Independent batches (no shared context): dispatch cold investigators in parallel via the host's subagent facility.
- Batches containing CRITICAL findings: dispatch sequentially (full attention).
- Maximum 3 parallel investigators at once.
- All cold investigators load the portable role from `.aivv/prompts/investigator-role.md` (Claude Code: preloaded via the `aivv:investigator` agent's frontmatter; Codex: inlined into `developer_instructions` of `<codex-home>/agents/aivv-investigator.toml` or `<target>/.codex/agents/aivv-investigator.toml` at install time).
- Track each spawned investigator handle with `batch_id`, `role: "investigator"`, `dispatch_path`, and `output_consumed: false`. Set `output_consumed: true` only after Step 4 integrates the investigator JSON into the structured investigation summary. Close consumed investigator handles before any Step 3 re-entry or second-opinion respawn.

If `can_spawn_cold_agents` is unavailable (e.g., Codex `agents.max_depth=0`), fall back to **same-agent investigation** (single pass per batch). Append a `capability_degradations` entry: `"investigator_cold_dispatch_unavailable"`. Mark the resulting investigation in fix-log as `same_agent_investigation: true`. The investigator role still applies — just to the same agent that orchestrates the fix flow. Apply extra rigor against confirmation bias (the active agent already saw the finding context). On Codex, run the [Codex dispatch preflight](codex-dispatch-preflight.md) before using this fallback.

<!-- CLAUDE-CODE-SPECIFIC -->
On Claude Code: dispatch via the `Agent` tool with `subagent_type: aivv:investigator`. For parallel batches, emit all Agent calls in a single assistant message. The `aivv:investigator` agent has its frontmatter set so the role + methodology preload before the prompt arrives.

On Codex: dispatch a subagent declared at `<codex-home>/agents/aivv-investigator.toml` or `<target>/.codex/agents/aivv-investigator.toml`; multiple subagents run in parallel under `agents.max_threads`. The TOML's `developer_instructions` already contains the portable role. If the callable dispatch surface is not initially visible, perform the [Codex dispatch preflight](codex-dispatch-preflight.md) before falling back.

Wait for all investigators (and any inline analyses) to complete before proceeding.

#### Lifecycle pre-spawn cleanup


**Lifecycle pre-spawn cleanup / Subagent cleanup:** Before spawning native fix-phase subagents, perform lifecycle pre-spawn cleanup when the active host exposes explicit subagent close primitives (see `.aivv/runtime-contract.md` and `.aivv/platform-adapters/codex.md` for the Codex adapter operation). Close visible completed AIVV-owned handles from interrupted prior invocations. Scope is limited to AIVV-owned handles; do not close unrelated user-created agents. Cleanup failures are warnings and do not invalidate already-consumed output. If cleanup fails before the fix log exists, surface the warning immediately and carry it into `session_changes.warnings` once the fix log is created.

**Immediate targeted-follow-up exception:** If the next immediate step requires targeted interactive follow-up with a specific investigator, keep that investigator's `output_consumed` value `false` until the follow-up response is integrated. Surface the reason immediately and persist it in `session_changes.warnings` when possible. This is the only valid reason to leave a completed investigator subagent open after its current response.

---
