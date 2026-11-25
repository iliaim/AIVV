---
name: aivv-fix
description: "Use to investigate and remediate AIVV findings, task open issues, or bugs and problems raised in the current session, then verify the fix in a bounded cycle."
argument-hint: "[task-id | \"literal finding\" | --review-id <id> | --action-request <uuid> --target <dir> | --incident <id> | --problem <id> | --issue <id> | --github-issue <url|owner/repo#N>]"
---

# AIVV Fix — Orchestrator Skill

End-to-end workflow for resolving IV&V findings: root cause analysis, strategic fixes, scoped re-verification, in a bounded loop.

**Use for:** `/aivv` findings, "fix/resolve/remediate these findings" requests, a task file's `review_tracking.open_issues`, or bugs raised in the session without a formal review. **Not for:** exploratory review (`/aivv`) or formal task sign-off (`/complete-review`, optional).

## Standing rules

These hold for the whole run. After a context compaction, re-read this block and the persisted fix log before continuing.

- **Fixed scope.** The Step 1.9 `authorized_scope` snapshot is immutable: carry it unchanged into every investigator, challenger, verifier, and re-entry prompt, and check every proposed file against it before approval or write. Never widen or reopen scope; report the finding unresolved. No fix is written before Step 5 (see the Step 1.9 write-boundary banner).
- **Dry run writes nothing.** `--dry-run` stops at the Step 4.3 halt, which owns its limits.
- **One runtime.** `AIVV_ROOT` is pinned once (Target Project Resolution) and never re-resolved; every procedure read and helper call uses `$AIVV_ROOT`.
- **The fix log is the record.** Never rely on `git diff` or `git log` to learn what this run changed: the persisted fix log (`session_changes`) is the source of truth, and other agents may commit in parallel. After a compaction, stop, or Resume, re-read the persisted fix log ([fix-log-contract.md](references/fix-log-contract.md)) instead of rebuilding the plan from memory.
- **One rework budget.** Every fix-plan re-authoring and verification re-entry draws on one invocation-wide budget ([challenge-loop.md](references/challenge-loop.md)). When it is spent, report unresolved findings with the retry history and stop; do not reopen scope or ask for another approval.
- **Close what you spawn.** Track and close every subagent handle per [Subagent handles](references/investigation-dispatch.md#subagent-handles).
- **Write capability.** A route needs only the capabilities it uses (read, reviewer dispatch, or write); a write route needs the host's write facility (Claude Code: `Edit`/`Write`/`Bash`; Codex: `apply_patch`/`shell_command`; Antigravity: `edit_file`/`write_file`/`run_command`). Check the route before stopping for missing write access; never cross a write gate without it: stop before the first write, name the missing facility, and report any read-only result.
- **No shortcuts.** Do not skip same-file batching or auto-proceed on architectural changes.
- **Progress and hand-back.** Track progress per Track Progress below; every ending follows the Hand back section of [`.aivv/session-continuity.md`](../../.aivv/session-continuity.md).

## Host notes

<!-- ANTIGRAVITY-SPECIFIC --> In Antigravity, load [antigravity.md](../../.aivv/platform-adapters/antigravity.md) for tool mappings (`read_file`, `edit_file`, `write_file`, `run_command`, `update_steps`, `invoke_subagent` with `TypeName: "research"` for read-only investigators/challengers/verifiers, and `manage_subagents` for handle cleanup).

<!-- HERMES-AGENT-SPECIFIC --> In Hermes Agent, load the host adapter with `read_file` from `${HERMES_SKILL_DIR}/../../.aivv/platform-adapters/hermes-agent.md` before using host-specific operations. Do not open that sibling path with `skill_view` because Hermes rejects parent traversal. If the template token is unexpanded, stop with `AIVV_INSTALLATION_INCOMPLETE`.

Dispatch operations per host: [Host adapter mapping](references/investigation-dispatch.md#host-adapter-mapping). <!-- Codex-SPECIFIC --> On Codex, **MUST-READ:** [codex-dispatch-preflight.md](references/codex-dispatch-preflight.md) before the first subagent spawn or same-agent fallback.

## Reference Loading

Read a reference only when a step or condition calls for it. Build investigator, fix-challenger, and verifier prompts with `aivv-fix-records.mjs` per [Building subagent prompts](references/investigation-dispatch.md#building-subagent-prompts); do not read the `*-prompt-template.md` files except as that section allows. Load output schemas ([json-schema.md](references/json-schema.md), [batched-and-challenger-schemas.md](references/batched-and-challenger-schemas.md)) only to parse that dispatch's output.

## Target Project Resolution

**Runtime pin and preflight:** before state maintenance, source parsing, scope questions, or dispatch, resolve the loaded installation once with `node <path>/.aivv/runtime-root.mjs --preflight aivv-fix [skill-directory]`, where `.aivv/` is at the plugin root, two levels above this skill's directory (a standalone skill copy carries its own `.aivv/`; it is not under `tools/`). Export the returned absolute path as `AIVV_ROOT`. On `AIVV_INSTALLATION_INCOMPLETE`, show that diagnostic once and stop; do not retry or substitute a workspace/cache copy (a new invocation may start after repair). Allocate the invocation ID per [fix-flags.md](references/fix-flags.md).

**Read before resolving the target project:** [`.aivv/target-resolution.md`](../../.aivv/target-resolution.md): bind and cache the storage context once, before maintenance, collection, or dispatch, with the pinned `tools/storage-paths.mjs resolve` helper (external `<state_dir>`, `<calibration_dir>`); never re-resolve after a cwd change. `session_changes.target_project` is the immutable base for finding file references. Write no local `.aivv/state/` migration markers.

## Instructions

Flow: 1 COLLECT → 2 TRIAGE → 2.5 CONTAIN (when needed) → 3 INVESTIGATE (cold investigator or fast path) → 4 PLAN → 4.4 MATERIALIZE write intents, persist the plan → 4.4.5 RED failing test → 4.5 CHALLENGE (when triggered) → 5 EXECUTE (test goes GREEN), logging `session_changes` → 6 VERIFY (bounded) → 7 DOCUMENT. Take a conditional branch only when its trigger applies.

### Before Starting: Track Progress

For an actual fix workflow (not help or registry-only early exits),
**MUST-READ:** [`.aivv/session-continuity.md`](../../.aivv/session-continuity.md) before registering progress. It owns the progress items, marking each in progress as its phase begins, merging them into the session's existing list without replacing it, and handing control back when the run ends. Every ending of the outermost run follows its Hand back section, including the dry-run halt, an exhausted rework budget, and verification failure. Missing progress UI does not indicate unavailable cold-agent dispatch or a degraded verification result.
Host progress tools are named in the active platform adapter.

---

### Step 1: COLLECT — Parse Findings from Source

### Step 1.0: Per-invocation preamble (FIRST action in Step 1)

**MUST-READ:** [`.aivv/state-maintenance.md`](../../.aivv/state-maintenance.md) (the same preamble /aivv Step 1.9 runs) and [fix-flags.md](references/fix-flags.md): usage, Step 1 order, route-first loading, invocation ID, flags.

**Early exits and lifecycle selectors:** `--list-wont-fix` / `--forget-wont-fix` run [wont-fix-registry-handlers.md](references/wont-fix-registry-handlers.md) and return (skip Steps 1.1–7). A lifecycle selector routes through [lifecycle-route.md](references/lifecycle-route.md) before ordinary source parsing.

#### POLISH-application behavior and L1-source detection

**MUST-READ:** [polish-and-l1-source-policy.md](references/polish-and-l1-source-policy.md) whenever POLISH handling, `--apply-all-polish`, `apply_polish_mode`, or L1-source policy affects scope.

### Step 1.04: Action Inbox inspection/claim and revalidation

With `--action-request=<uuid>`, follow [action-inbox.md](references/action-inbox.md) before any source collection (claim; `inspect` under `--dry-run`).

### Step 1.05: `--review-id` resolution and failure-mode handling

**MUST-READ:** [review-id-resolution.md](references/review-id-resolution.md) when `--review-id=<id>` is set. After it succeeds, do not fall back to conversation scanning.

### Step 1.1: Resolve `/aivv-fix` Preferences

After flags and any `--review-id` resolution, resolve preferences once per **MUST-READ:** [fix-preferences.md](references/fix-preferences.md). Review-id findings come only from the review log. For conversation, literal, or task-file sources, **MUST-READ:** [finding-collection.md](references/finding-collection.md) (signals, fingerprints, wont-fix pre-filter, de-duplication, no-findings message): tag each finding's source label, pre-filter, de-duplicate, and assign stable `F001` IDs.

---

### Step 1.9: Write Boundary

After findings are loaded and before investigation or planning output can imply remediation, render:

```text
[aivv-fix] remediation boundary: no fix is written before Step 5 EXECUTE; the only earlier project write is a failing reproduction test (Step 4.4.5).
[aivv-fix] every write first materializes as an inspectable write_intent; fix writes also pass the readiness gates.
```

Earlier steps may perform only the state maintenance, preference update, or action-request claim their route describes. Record `write_boundary_shown: true` in the eventual fix log (a dry run writes none). Then create the immutable `authorized_scope` snapshot per [triage.md](references/triage.md).

---

### Step 2: TRIAGE — Classify, Cluster, and Prioritize

**MUST-READ:** [triage.md](references/triage.md) (2a classify, incl. `category`, the Step 5 dispatch key; 2b batch; 2c provisional summary) and [execution-decisioning.md](references/execution-decisioning.md) before routing findings.

---

### Step 2.5: CONTAIN — Immediate Blast Radius Reduction (fix-now/investigate-first findings)

**Applies only when triage has ≥1 `fix-now` or `investigate-first` finding with active data-integrity/financial/security/availability blast radius** (legacy fallback: `CRITICAL`). Then **MUST-READ:** [containment.md](references/containment.md).

---

### Step 3: INVESTIGATE — Root Cause Analysis

First, for a finding sourced from `[user-reported]`, `[deferred]`, or `[agent-noted]`, or with `lens: sec`, run [reproducibility-gate.md](references/reproducibility-gate.md), whichever path follows.

**MUST-READ:** [fast-path.md](references/fast-path.md) before the fast path (the only investigator skip) and [investigation-dispatch.md](references/investigation-dispatch.md) before investigator dispatch or same-agent fallback.

### Step 4: PLAN — Present Investigation Results

**MUST-READ:** [apply-policy-and-gates.md](references/apply-policy-and-gates.md) (summary, reconciliation, special verdicts, Gates 1/2/3, `fix_confidence`, precheck). No finding's final route is settled before Steps 4.4–4.5.

---

### Step 4.3: DRY-RUN PLAN HALT — preview only, no write-intent or challenger load

If `dry_run == true`, stop here after investigation results, batch reconciliation, apply-policy preview, and `fix_confidence` computation. Render a plan-only summary with:
- findings that would be fixed, skipped, escalated, or require user decisions;
- proposed files to modify when investigators supplied them;
- confidence and reason-coded blockers;
- if `--dangerously-auto-apply` is confirmed, a `Dangerous Auto-Apply Preview` table of the findings it would apply (ID, category, bypass reasons, proposed action), its confirmation source, and the would-apply count, shown even when the count is 0. The table is provisional: it is built from the Step 4 blocker record, before write intents and the challenger, which may still remove findings;
- the exact message: `DRY RUN: no remediation writes were made. After the dry-run gate, no write intents, challenger dispatch, execution, verifier dispatch, fix log, session changes, or calibration writes occurred, and no pre-invocation state maintenance ran.`

A dry run writes nothing: no state maintenance (initialization, import, stale-session reaping, notice markers) and no fix, session, calibration, or verifier state. After this halt, do not materialize `write_intents[]`, enter Step 4.4.5, dispatch the fix-plan challenger, initialize a fix log, write active state, or run verification/calibration hooks. `--dangerously-auto-apply` never overrides it. The Step 5 dry-run gate remains as defense-in-depth only; reaching Step 5 while `dry_run == true` is a contract violation to report and halt.

Then hand control back per the Hand back section of [`.aivv/session-continuity.md`](../../.aivv/session-continuity.md); a dry run is never a clean outcome for automatic continuation.

---

### Step 4.4: MATERIALIZE WRITE INTENTS — inspectable proposed bytes

Every write-capable Branch `A`/`B`/`C-fallthrough-A`/`D` fix, and the Step 4.4.5 failing test, materializes inspectable `write_intents[]` (exact bytes, hashes, detector results, required assertions) before Step 4.4.5, 4.5, or 5; bad intents halt per [write-intents-and-prewrite-validation.md](references/write-intents-and-prewrite-validation.md).

Then persist the plan: after the Step 5.0 target reuse and pre-write banner, write the `in-progress` fix log to `<state_dir>` with every identity field (target, storage, source, lifecycle context), any confirmed `dangerously_auto_apply`, `write_intents[]`, `fix_plans[]`, and `decision_ledger[]`, updating it in the same validated write as each later decision ([fix-log-contract.md](references/fix-log-contract.md)).

### Step 4.4.5: RED-GREEN TEST GATE — failing test before the plan challenge

Run each testable finding's failing test now and confirm it fails for the right reason; write test bytes early only under [red-green-gate.md](references/red-green-gate.md) step 3. Step 5 re-runs it green.

---

### Step 4.5: CHALLENGE — Independent Fix-Plan Review

After the precheck (and Gates 1/2/3), Step 4.4, and the red run, decide whether to challenge the fix plan before any fix is written: [challenge-loop.md](references/challenge-loop.md). A finding is Auto-eligible only after APPROVE or a legitimate skip.

---

### Step 5: EXECUTE — Apply Approved Fixes

Follow [fix-log-contract.md](references/fix-log-contract.md): Step 5.0 target reuse and banner, the Step 4.4 fix log, then the class-verdict gate (with [class-sibling-triage-template.md](references/class-sibling-triage-template.md)) and `scope_search_seed` pre-loop, which can demote `fix_confidence` and re-trigger Step 4.5, then the Change Readiness Gate. Apply each approved fix by [execution-branches.md](references/execution-branches.md) (Branches B–F: [execution-branches-b-to-f.md](references/execution-branches-b-to-f.md)), which also owns the dangerous-auto-apply audit banner. Lifecycle write-back: [lifecycle-route.md](references/lifecycle-route.md).

### Step 5.4: PRE-WRITE-VALIDATE — deterministic embedded-content checks

Immediately before each host write, run the pre-write validator per [write-intents-and-prewrite-validation.md](references/write-intents-and-prewrite-validation.md). Never bypass a required assertion without a valid user approval record.

### Step 5.5: Fix-bundle coherence pass (orchestrator-side, advisory)

Steps 5.5–5.7: [mechanical-verification-checks.md](references/mechanical-verification-checks.md). Log this pass's advisory warnings in the fix log.

### Step 5.6: FIX-LOG HYGIENE — Mechanical Assertions

Halt on corrupted scope or retry state; otherwise warn and continue.

### Step 5.6.5: Cycle-N+1 mandatory sibling-surface grep

On cycle ≥ 2, surface surviving sibling matches of replaced strings.

### Step 5.7: ORCHESTRATOR EXECUTION — Run New Verification Code

When enabled, run newly authored verification code before Step 6.

---

### Step 6: VERIFY — Scoped Re-Verification

Follow [verifier-dispatch.md](references/verifier-dispatch.md): context from the fix log and `authorized_scope`, scoped verifier, same-agent exclusions, outcomes, calibration queue, shared budget.

### Step 6.5: Outer-loop reverse-chain

**Fires ONLY after a Step 6 verify-PASS with no regressions.** Read the [outer-loop contract](../../.aivv/outer-loop.md) first; it owns the algorithm.

---

### Step 7: DOCUMENT — Capture Lessons Learned

After all findings are resolved or escalated, run Step 7.0, then items 1–4 in order; [document-and-calibration.md](references/document-and-calibration.md) owns items 1–3.

**Step 7.0: Final Subagent cleanup:** run the final cleanup in [Subagent handles](references/investigation-dispatch.md#subagent-handles).

1. **Summary report:** present the Resolution Summary.
2. **Records**, in order: predecessor backfill on fix-log → review-log (validated before the durable write); calibration shard records; then **Step 7.8: Optional post-fix HTML viewer hook** when [viewer-hook.md](references/viewer-hook.md) conditions match (non-blocking; not verification).
3. **Pattern capture:** suggest promoting any new prevention mechanism.
4. **Hand back**: When this run is nested, return control to the enclosing run (for `/aivv --fix`, the review continues at its Ending), as at every other ending of a nested run. When this run is the outermost AIVV run, close its progress items, including those of a nested `/aivv` run, and hand control back per the Hand back section of [`.aivv/session-continuity.md`](../../.aivv/session-continuity.md).
