# Investigation Dispatch

Read from `skills/aivv-fix/SKILL.md` before investigator dispatch or same-agent fallback.

## Contents

- Reproducibility gate
- Change-attribution probe
- Investigator decision gate
- Cold dispatch and fallback rules

### Step 3: INVESTIGATE — Root Cause Analysis

**Default assumption: root cause is unknown.** For every batch, you must either spawn an investigator OR document a confident root cause inline. You may only skip the investigator if you are certain of the exact root cause AND the fix — not just a plausible explanation.

#### Reproducibility gate (Signal 2-4 only — fires before investigator dispatch)

For findings sourced from `[user-reported]`, `[deferred]`, or `[agent-noted]`:

1. **Attempt to reproduce the issue** using the steps/evidence available in the finding description.
   - For code-bugs: look at the code path mentioned. Can you see the condition that triggers it? If yes → `reproduction_status: code-confirmed`; proceed.
   - For runtime issues: is there a reproduction script or test case available? Run it. If yes and it fails as described → `reproduction_status: runtime-confirmed`; proceed.
   - If neither → `reproduction_status: unconfirmed`.

2. **If `unconfirmed`:**
   - Set `confidence_gap_shape: context-shaped` on the finding's triage record.
   - Ask the user: "I cannot reproduce [F###]: [description]. Can you provide: (a) the exact input that triggers it, (b) the expected vs actual output, (c) the environment/conditions?"
   - Proceed only after user provides reproduction evidence OR user explicitly says "proceed anyway."
   - If user says "proceed anyway": spawn investigator with `source_signal: [agent-noted]` tier-scrutiny and `confidence` likely to come back `low` + `confidence_gap_shape: context-shaped`.

3. **For `[deferred]` findings:** verify the issue is STILL PRESENT. Quick code check (grep/read) before spawning. If no longer present → `verdict: already-correct`; skip investigation.

**Skip when:** finding is Signal 0 (`[ivv]`) or Signal 1 (formal review output).

#### Sec-lens reproducibility extension (fires for any `lens: sec` finding — all signal tiers)

Security findings get one extra step in the reproducibility gate: state the **reachable execution path** statically. Unlike the base gate above, this fires regardless of signal tier (a sec finding is usually Signal 1, which the base gate skips) — it is gated only on the finding's `lens`/`domain` being `sec`. No runtime PoC is required or attempted — `/aivv` analyzes static artifacts, not running systems.

> **Disambiguation (one word, two jobs):** this *static-reachability* determination answers **"can user input reach the vulnerable code at all"** — a reproduce-gate question that decides whether to investigate. It is distinct from the W5 LIKELIHOOD `reachability` axis in `.aivv/lenses/sec.md` (the `### LIKELIHOOD: reachability and exposure` determinant), which answers **"will the harm manifest"** and feeds *severity*. Do not conflate `unreachable-static` (no code path → wont-fix) with a W5 `UNLIKELY` likelihood (a path exists but rarely fires → severity discount).

This **extends** the base `reproduction_status` values (`code-confirmed | runtime-confirmed | unconfirmed`) — it does not replace them:

1. **Trace the path (static):** "User-controlled input at `[entry point]` flows to `[vulnerable code]` via `[code path]`." Read the code; no runtime PoC.

2. **Classify the outcome:**
   - **Path traceable** → `reproduction_status: code-confirmed`; proceed to investigation (same value the base code-bug case uses).
   - **Path traceable but exploitability uncertain** (timing attack, second-order injection, SSRF, info disclosure via error differential) → `reproduction_status: code-confirmed-uncertain-exploitability`. Record the traced path in the finding's `static_reachability.execution_path` and the static-only basis in `static_reachability.exploitability_note`, and **proceed to the fix** — inability to confirm runtime exploitability does NOT block it. Let the uncertainty inform the W5 LIKELIHOOD axis (discount toward `POSSIBLE`/`UNLIKELY`) rather than acting as a separate severity input, so the two systems don't double-count it.
   - **Genuinely unreachable from any entry point under static analysis** → `reproduction_status: unreachable-static`. This is a structural "there is no execution path" determination, NOT an "I can't confirm it" case. Set `verdict: wont-fix` with the traced no-path reasoning and route through the **existing wont-fix sign-off flow** (`SKILL.md` Step 4 wont-fix: present reasoning → user accepts (registry write, `user_approved: true`) or overrides). Mandatory user sign-off before deferring — never auto-defer a security finding.

**Why `lens: sec` only:** accessibility (`A11Y-*`) and legal-compliance (`COMP-LEGAL-*`) findings are definitionally not security-exploitability findings under AIVV's lens taxonomy and must never be gated on a reachability trace; the trigger is the security lens exclusively. Investigators MAY persist the trace as a structured `static_reachability` object — see [investigator-enrichment-fields.md](investigator-enrichment-fields.md) `### static_reachability`.

#### Phase 1.5: Change-attribution probe (CRITICAL/MAJOR findings — before investigator dispatch)

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

**Low-risk fast path — the only way to skip the investigator:** check [fast-path.md](fast-path.md). When every fast-path eligibility gate passes, emit the structured `investigation_route: "fast_path_inline"` record and continue through Step 4 write-intent and verification gates. A finding that fails any gate gets the investigator; there is no other skip route.

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

Before spawning investigators, apply the lifecycle pre-spawn cleanup rule (see the **Codex dispatch preflight + lifecycle pre-spawn cleanup** section below). This cleanup is best-effort and scoped only to visible completed AIVV-owned handles from prior interrupted invocations; unrelated user-created agents are never closed.

**Prompt template**: See [investigator-prompt-template.md](investigator-prompt-template.md) — read and fill in all `{placeholder}` values before sending. Key placeholders:
- `{authorized_scope}` → copy the immutable `authorized_scope` snapshot from `/aivv-fix` Step 1.9. Do not regenerate it from the current finding summary or accept alternative wording that changes the original goal or boundaries.
- `{json_schema_absolute_path}` → the absolute path to `references/json-schema.md` within the installed plugin cache at runtime (e.g., `~/.claude/plugins/cache/<marketplace>/aivv/<version>/skills/aivv-fix/references/json-schema.md`). This index links the focused schema references. The orchestrator fills the exact path at dispatch time — the investigator runs in the project's working directory and cannot resolve relative paths back to the skill.
- `{source_signal}` → the signal label for each finding from the triage table: `[ivv]`, `[user-reported]`, `[deferred]`, or `[agent-noted]` — must be populated so the investigator calibrates scrutiny appropriately
- `{introduced_by_context}` → JSON-serialized `introduced_by` object from Phase 1.5 probe above, or the literal string `"(not available)"` when the file is untracked, deleted/renamed at HEAD, or the finding is MINOR/POLISH (Phase 1.5 skips non-CRITICAL/MAJOR findings). Passed to each CRITICAL/MAJOR finding's investigator as the `## Change Attribution` section in the prompt.
- `{target_project}` → the session target project absolute path. Use the canonical target/storage context bound before maintenance; do not infer a provisional target from findings. **Worktree-CWD note (, sibling of #30):** the investigator independently runs `find`/`grep`/`ls` to discover root causes and similar patterns, and inherits the orchestrator's shell CWD — which may be a stale git worktree at a different commit than the target. The template's `## Working Directory` block anchors all file operations on this absolute path — keep that block intact when filling placeholders (do not relax it to a bare relative-path hint), so the investigator searches the real target tree rather than the inherited CWD.

**Spawning rules** (host-neutral; each host's specific dispatch syntax in `<!-- CLAUDE-CODE-SPECIFIC -->` aside below):
- Independent batches (no shared context): dispatch cold investigators in parallel via the host's subagent facility.
- Batches containing CRITICAL findings: dispatch sequentially (full attention).
- Maximum 3 parallel investigators at once.
- All cold investigators load the portable role from `.aivv/prompts/investigator-role.md` (Claude Code: preloaded via the `aivv:investigator` agent's frontmatter; Codex: inlined into `developer_instructions` of `<codex-home>/agents/aivv-investigator.toml` or `<target>/.codex/agents/aivv-investigator.toml` at install time).
- Track each spawned investigator handle with `batch_id`, `role: "investigator"`, `dispatch_path`, and `output_consumed: false`. Set `output_consumed: true` only after Step 4 integrates the investigator JSON into the structured investigation summary. Close consumed investigator handles before any Step 3 re-entry or second-opinion respawn.

If `can_spawn_cold_agents` is unavailable (e.g., Codex `agents.max_depth=0`), fall back to **same-agent investigation** (single pass per batch). Append a `capability_degradations` entry: `"investigator_cold_dispatch_unavailable"`. Mark the resulting investigation in fix-log as `same_agent_investigation: true`. The investigator role still applies — just to the same agent that orchestrates the fix flow. Apply extra rigor against confirmation bias (the active agent already saw the finding context). On Codex, do not use this fallback when `spawn_agent` / `wait_agent` are discoverable and investigator TOML exists but host policy blocks delegation; ask once for explicit delegation permission or halt with `codex-subagent-delegation-blocked`.

<!-- CLAUDE-CODE-SPECIFIC -->
On Claude Code: dispatch via the `Agent` tool with `subagent_type: aivv:investigator`. For parallel batches, emit all Agent calls in a single assistant message. The `aivv:investigator` agent has its frontmatter set so the role + methodology preload before the prompt arrives.

On Codex: dispatch a subagent declared at `<codex-home>/agents/aivv-investigator.toml` or `<target>/.codex/agents/aivv-investigator.toml`; multiple subagents run in parallel under `agents.max_threads`. The TOML's `developer_instructions` already contains the portable role. If the callable dispatch surface is not initially visible, perform the Codex preflight (below) before falling back.

Wait for all investigators (and any inline analyses) to complete before proceeding.

#### Codex dispatch preflight + lifecycle pre-spawn cleanup

**Codex preflight before fallback:** <!-- Codex-SPECIFIC --> When AIVV is running inside a Codex agent session, a missing visible `spawn_agent` tool is not by itself a capability failure. Before same-agent investigation or same-agent verification fallback, run the Codex dispatch preflight from `.aivv/platform-adapters/codex.md` ("Codex Dispatch Preflight" section): confirm the relevant TOML exists under `<codex-home>/agents/` or project `.codex/agents/`, checking both scopes before declaring TOML missing, and if the dispatch tool is not already loaded, use `tool_search` with `multi-agent subagent dispatch codex agents spawn_agent wait_agent close_agent`. If discovery returns `spawn_agent` / `wait_agent`, use cold subagent dispatch and do not record a dispatch degradation; if `close_agent` is absent, keep dispatch available but record cleanup as a lifecycle degradation per the Codex adapter. Explicit `/aivv-fix`, `$aivv-fix`, `/aivv --fix`, and `$aivv --fix` invocations authorize AIVV-owned read-only investigator/verifier subagents; do not require a second delegation phrase. If Codex host policy still blocks delegation despite visible dispatch tools and existing TOML, ask once for explicit delegation permission or halt with `codex-subagent-delegation-blocked`; do not silently continue as same-agent investigation/verification. When AIVV is running outside Codex and merely calls `codex exec` as a provider subprocess, this preflight does not apply; that is multi-model provider dispatch, not native Codex subagent dispatch.

**Lifecycle pre-spawn cleanup / Subagent cleanup:** Before spawning native fix-phase subagents, perform lifecycle pre-spawn cleanup when the active host exposes explicit subagent close primitives (see `.aivv/runtime-contract.md` and `.aivv/platform-adapters/codex.md` for the Codex adapter operation). Close visible completed AIVV-owned handles from interrupted prior invocations. Scope is limited to AIVV-owned handles; do not close unrelated user-created agents. Cleanup failures are warnings and do not invalidate already-consumed output. If cleanup fails before the fix log exists, surface the warning immediately and carry it into `session_changes.warnings` once the fix log is created.

**Immediate targeted-follow-up exception:** If the next immediate step requires targeted interactive follow-up with a specific investigator, keep that investigator's `output_consumed` value `false` until the follow-up response is integrated. Surface the reason immediately and persist it in `session_changes.warnings` when possible. This is the only valid reason to leave a completed investigator subagent open after its current response.

---
