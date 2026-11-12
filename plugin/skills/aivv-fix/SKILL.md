---
name: aivv-fix
description: "Use to investigate and remediate AIVV findings, task open issues, or bugs and problems raised in the current session, then verify the fix in a bounded cycle."
argument-hint: "[task-id | \"literal finding\" | --review-id <id> | --action-request <uuid> --target <dir> | --incident <id> | --problem <id> | --issue <id> | --github-issue <url|owner/repo#N>]"
---

# AIVV Fix — Orchestrator Skill

End-to-end workflow for resolving IV&V findings: root cause analysis, strategic fixes, scoped re-verification, in a bounded loop.

Routes require only the capabilities they use: read, reviewer dispatch, or write. A selected write route needs the host's write facility (Claude Code: `Edit`/`Write`/`Bash`; Codex: `apply_patch`/`shell_command`). Check the route before stopping for missing write access; never cross a write gate without it.

## Host Adapter Mapping

Same as `/aivv` — see the Host notes paragraph at the end of the [`/aivv` skill](../aivv/SKILL.md), the Adapter Operations table in [`.aivv/runtime-contract.md`](../../.aivv/runtime-contract.md), and the per-host adapters in [`.aivv/platform-adapters/`](../../.aivv/platform-adapters/). Additional `/aivv-fix`-specific operations:

<!-- HERMES-AGENT-SPECIFIC --> In Hermes Agent, load the host adapter with
`read_file` from `${HERMES_SKILL_DIR}/../../.aivv/platform-adapters/hermes-agent.md`
before using host-specific operations. Do not open that sibling path with
`skill_view` because Hermes rejects parent traversal. If the template token is
unexpanded, stop with `AIVV_INSTALLATION_INCOMPLETE`.

<!-- CLAUDE-CODE-SPECIFIC: the table below names Claude Code tool surfaces (Agent / subagent_type) explicitly; Codex column maps to Codex equivalents. -->

| Adapter operation | Claude Code | Codex |
|---|---|---|
| Spawn cold investigator subagent | `Agent` tool with `subagent_type: aivv:investigator` | Subagent dispatch using TOML at `<codex-home>/agents/aivv-investigator.toml` or `<target>/.codex/agents/aivv-investigator.toml` |
| Spawn cold verifier subagent | `Agent` tool with `subagent_type: aivv:reviewer` (Step 6) | Subagent dispatch using `<codex-home>/agents/aivv-reviewer.toml` or `<target>/.codex/agents/aivv-reviewer.toml` |
| Apply edits | `Edit`/`Write` tools | `apply_patch` |
| Prevention paths | `.claude/hooks/`, `.claude/patterns/`, `.claude/rules/`, or project equivalents | Project-equivalent hook/pattern/rule directories (no `.claude/` assumption); see project conventions |

If `can_spawn_cold_agents` is unavailable on the active host, investigation falls back to **same-agent investigation** with a `capability_degradations` entry — investigator role prompt is consulted, but findings derive from the same agent that produced the finding context (apply extra rigor against confirmation bias).

**Codex dispatch preflight + lifecycle pre-spawn cleanup:** <!-- Codex-SPECIFIC --> Before any same-agent fallback or native fix-phase subagent spawn, run the Codex dispatch preflight (a missing visible `spawn_agent` is not by itself a capability failure — confirm TOML under `<codex-home>/agents/` or project `.codex/agents/` and `tool_search` for the dispatch surface before declaring it unavailable) and the best-effort lifecycle pre-spawn cleanup of AIVV-owned handles. **MUST-READ:** [investigation-dispatch.md](references/investigation-dispatch.md) before the Codex preflight or pre-spawn cleanup — the discovery sequence, the `codex-subagent-delegation-blocked` halt, and the AIVV-owned-handle cleanup scope are fixed contracts.

## When to Use

- After running `/aivv` (with any `--reviewers=N`) with findings to address
- When asked to "resolve findings", "fix aivv findings", "address review issues", or "remediate issues"
- When a task file has `review_tracking.open_issues` to close
- When the user asks to fix issues, bugs, or problems mentioned during the session — even if no formal review was run
**Not for**: exploratory review (use `/aivv`), formal task sign-off (use `/complete-review` — optional external integration)
## Quick Reference

Flow: 1 COLLECT findings → 2 TRIAGE batches → 2.5 CONTAIN critical blast radius when needed → 3 INVESTIGATE with cold investigator or fast path → 4 PLAN approved fixes → 4.4 MATERIALIZE write intents and persist the plan → 4.4.5 RED failing test when testable → 4.5 CHALLENGE when triggered → 5 EXECUTE the fix (test goes GREEN) with `session_changes` logging → 6 VERIFY with bounded loop → 7 DOCUMENT summary, calibration, and patterns.

## Common Mistakes

Do not rely on `git diff` in Steps 5/6, skip same-file batching, or auto-proceed on architectural changes. Preserve the immutable authorized scope in every re-dispatch. One invocation-wide semantic rework budget (the `max_rework_retries` setting, default 3; a soft limit defined in [challenge-loop.md](references/challenge-loop.md)) covers every fix-plan re-authoring and verification re-entry, including readiness revisions, challenge, pre-write, stale-intent, class-verdict, architecture-check, investigator-output, duplicate-intent, red-green, and verification failures. At exhaustion, report unresolved findings and stop without reopening scope or asking for another approval. Transport/format retries and independent outer-loop reviews keep their separate limits.

## Reference Loading

Read the linked reference when a step or condition below calls for it; do not preload the full reference set. Load prompt templates and schemas only for the dispatch that uses them: [investigator-prompt-template.md](references/investigator-prompt-template.md), [json-schema.md](references/json-schema.md), [investigator-output-example.md](references/investigator-output-example.md), [investigator-enrichment-fields.md](references/investigator-enrichment-fields.md), [investigator-field-definitions.md](references/investigator-field-definitions.md), [batched-and-challenger-schemas.md](references/batched-and-challenger-schemas.md), [schema-migration-notes.md](references/schema-migration-notes.md), [fix-challenger-prompt-template.md](references/fix-challenger-prompt-template.md), and [verifier-prompt-template.md](references/verifier-prompt-template.md).

Calibration data is appended inline as JSONL; see Step 7.

---

## Usage

```
/aivv-fix                              # current-session /aivv findings
/aivv-fix TASK-2026-0123               # task open_issues
/aivv-fix "CRITICAL: SQL injection..." # literal finding
/aivv-fix --dry-run                    # Steps 1-4 only
/aivv-fix --target=/path/project       # force state target
/aivv-fix --resume <review-id>         # review + optional decisions file
/aivv-fix --resolve <review-id>        # require decisions handoff
/aivv-fix --action-request=<uuid> --target=/path/project  # claim a local selected-findings batch
/aivv-fix --dangerously-auto-apply     # confirmed per-run bypass
/aivv-fix --list-wont-fix              # read-only registry
/aivv-fix --forget-wont-fix=<key>      # remove registry entry (with --dry-run: preview only)
```

**Flags:** parse with [fix-flags.md](references/fix-flags.md). `--action-request` is an explicit user-selected batch handoff, not an auto-apply bypass: it requires `--target`, claims the request once, revalidates its review and revision, and then uses all ordinary gates. `--dry-run` writes nothing: no state maintenance (initialization, import, stale-session reaping, notice markers) and no fix/session/calibration/verifier state. `--dangerously-auto-apply` is a confirmed per-run bypass only; it never overrides `--dry-run`.

## Target Project Resolution

**Runtime pin and preflight:** before Step 1.0 state maintenance, source parsing,
scope questions, or dispatch, resolve the loaded installation once with
`runtime-root.mjs --preflight aivv-fix [skill-directory]`. Export the returned
absolute path as `AIVV_ROOT` and use it for all subsequent procedure reads and
helper calls. If the command reports `AIVV_INSTALLATION_INCOMPLETE`, show that
diagnostic once and stop the invocation; do not retry the read or substitute a
workspace/cache copy. A new invocation may start after that selected installation
is repaired. For an actual fix workflow, allocate one invocation ID immediately
after preflight and the Step 1.0 recovery decision, but before source parsing or
investigation. A valid Resume choice reuses the prior log's invocation ID, scope,
and retry count; a new run gets a fresh ID. Keep that ID and retry counter
through every re-entry. Step 4.4 reuses the bound ID when it first persists the
fix log. Help and registry-only early exits do not create a fix invocation.

**Read before resolving the target project:** [`.aivv/target-resolution.md`](../../.aivv/target-resolution.md). Bind and cache storage context before maintenance, collection, or dispatch, using the pinned `tools/storage-paths.mjs resolve` helper; all generated state uses external `<state_dir>` and calibration uses `<calibration_dir>`. `session_changes.target_project` is the immutable base for finding file references. Policy lookup remains separate and retains original provenance. Finding ancestors never choose the fresh storage target. Do not improvise precedence, write local `.aivv/state/` migration markers, or re-resolve after cwd changes.

## Instructions

For remediation, follow the ordered phases below and take conditional branches only when their trigger applies.

### Before Starting: Track Progress

When a host progress facility is available, register these pending steps and
update their status as work proceeds:
1. COLLECT — parse findings
2. TRIAGE — classify, cluster, prioritize
3. INVESTIGATE — cold investigator or same-agent fallback
4. PLAN — present investigation results
5. EXECUTE — apply approved fixes
6. VERIFY — re-verify fixes
7. DOCUMENT — capture lessons learned

If no compatible progress tool is available, provide concise, meaningful
user-facing updates at phase changes and continue through all normal steps.
Progress tracking is informational: its absence MUST NOT skip, weaken, or
relabel review, fix, safety, or verification gates. Missing progress UI does
not indicate unavailable cold-agent dispatch or a degraded verification result.

When the host supports task state, mark each task `in_progress` when begun and
`completed` when done.

<!-- CLAUDE-CODE-SPECIFIC --> On Claude Code, the host facility is `TodoWrite`.
<!-- Codex-SPECIFIC --> On Codex, use `update_plan` when exposed; otherwise use
the user-facing phase updates above and continue.

---

### Step 1: COLLECT — Parse Findings from Source

### Step 1.0: Per-invocation preamble (FIRST action in Step 1)

**MUST-READ:** [preamble-state-maintenance.md](references/preamble-state-maintenance.md) before executing this step — it points to the shared canonical home [`.aivv/state-maintenance.md`](../../.aivv/state-maintenance.md) (the same preamble mechanism /aivv Step 1.9 runs).

Before source parsing, minimally parse `--dry-run`, `--target=<dir>`, and
route selectors that make state required (`--review-id`, `--resume`, `--resolve`, outer-loop and
registry selectors). Bind the shared context before maintenance. The preamble
performs route-sensitive schema checks and authorized external maintenance;
legacy originals remain untouched. Selected missing/corrupt/newer artifacts
keep their route errors; unrelated history warns. Dry-run only inspects state:
it never initializes, imports, reaps, or writes it.
**Route-first cost rule:** execute Step 1 in this order: minimal `--target` pre-parse → preamble → full flag parse → source-route classification (`review_id`/`resume`/`resolve`, lifecycle selector, task ID, literal, or conversation) → load only that route's collector/resolver. Do not load conversation Signal 0-4 rules for a successful `--review-id` route, lifecycle helpers without a lifecycle selector, or task-file extraction details for literal/conversation routes. Safety gates still run in normal order once findings exist.
**Flag extraction first.** Before source parsing, parse and strip flags from the argument string per the reference (the flag catalog covers `--dry-run`, `--target=`, `--review-id=`, `--resume`, `--resolve`, `--incident`/`--problem`/`--issue`/`--github-issue`, `--list-wont-fix`, `--forget-wont-fix=`, `--outer-cycle=`, `--root-review-id=`, `--apply-all-polish`, and `--dangerously-auto-apply`). If `--dry-run` is present, stop at Step 4.3 after investigation planning output; do not load write-intent, challenger, execution, verifier, or calibration references unless the user starts a non-dry-run invocation.

**MUST-READ:** [fix-flags.md](references/fix-flags.md) before extracting any Step 1 flag, invoking the `--list-wont-fix`/`--forget-wont-fix` early-exit handlers, or routing a lifecycle selector. The per-flag parsing rules, the two registry-handler exit codes, and the lifecycle-selector route precedence are fixed contracts. Do not improvise flag names, strip-order, or the confirmation-phrase semantics for `--dangerously-auto-apply`.

#### POLISH-application behavior and L1-source detection

**MUST-READ:** [polish-and-l1-source-policy.md](references/polish-and-l1-source-policy.md) whenever POLISH handling, `--apply-all-polish`, `apply_polish_mode`, or L1-source policy affects scope.

The reference is the canonical home for POLISH application behavior and the L1-source detection regex. Preserve its forced-show semantics: L1-source findings are rendered at their assigned severity regardless of threshold. L1-source POLISH findings refuse batch-apply without per-rule manual review when the cited authority is applicable or applicability is undeclared; declared-inapplicable legal context does not trip refusal by bare citation alone.

### Step 1.04: Action Inbox inspection/claim and revalidation

When `--action-request=<uuid>` is present, load [action-inbox.md](references/action-inbox.md) before any ordinary source collection. Require explicit `--target`. On a normal invocation validate/claim with the shipped helper and re-read the validated artifacts before binding the request's review id, exact selected finding IDs, bounded notes, and `action_request_id` provenance. Under `--dry-run`, use the helper's read-only `inspect` subcommand instead: bind the validated selection as an unclaimed preview and follow the ordinary dry-run plan-only route. Never claim, request-write, requeue, expand the selection, or report the queued request consumed/executed during dry-run; a later non-dry-run must validate and claim afresh. This route never wakes an agent, executes browser text, or bypasses the normal fix workflow.

### Step 1.05: `--review-id` resolution and failure-mode handling

**MUST-READ:** [review-id-resolution.md](references/review-id-resolution.md) when `--review-id=<id>` is set.

Resolve the durable review log before Step 1 source parsing. Missing, corrupt, target-mismatched, schema-newer, empty, evidence-only, same-agent, and stale-path cases are stable routing conditions defined in the reference; do not fall back to conversation scanning after successful review-id resolution.

### Step 1.1: Resolve `/aivv-fix` Preferences

After flag extraction and any successful `--review-id` resolution, resolve user/project preferences once for the fix invocation (the `/aivv-fix` counterpart to `/aivv` Step 1.5; load-bearing for `apply_polish_mode`, `fix_apply_policy`, `shared_interface_patterns`, `max_challenges_per_invocation`, `max_rework_retries`, `enable_step_57_execution`, `outer_loop_*`, and `post_review_html_*`). Pick the resolution target per the reference's target chain (`--target` > review-log `target_project` > finding-path common-ancestor/git/cwd), reuse the shared resolution algorithm in [`.aivv/configuration.md`](../../.aivv/configuration.md) (CLI > project > user > schema defaults, validated against `.aivv/schemas/config.schema.json`), then bind the `/aivv-fix`-specific key catalog + emit the one-time `auto_apply_v1` notice. On a malformed/unreadable config, preserve its original location and warn/fall through per the reference — do not fail the fix workflow over an optional preference file.

**MUST-READ:** [fix-preferences.md](references/fix-preferences.md) before binding any `/aivv-fix`-specific preference key or emitting the `auto_apply_v1` notice. The preference-resolution target chain, the per-category `fix_apply_policy` values, the legacy `apply_polish_mode` mapping, the `--apply-all-polish`/`--dangerously-auto-apply` precedence, the malformed-config handling, and the `auto_apply_v1` marker-write contract are fixed contracts. Do not improvise key names, precedence, or the marker write.

**Early-exit registry handlers + lifecycle-selector routing:** when `--list-wont-fix` or `--forget-wont-fix=<identifier>` was extracted, run the matching read-only/write registry handler and return (skip Steps 1.1–7). When a lifecycle selector (`--incident`/`--problem`/`--issue`/`--github-issue`) was extracted, use the `AIVV_ROOT` pinned and preflighted at invocation start, then run `"$AIVV_ROOT/tools/incident-lifecycle-route.mjs"` before ordinary source parsing and bind `lifecycle_context` + `FixSession.source` from the route result.

**MUST-READ:** [fix-flags.md](references/fix-flags.md) before invoking either registry handler or routing a lifecycle selector — the handler exit codes, the fingerprint-resolution rule, the route-helper invocation, and the "lifecycle routing MUST NOT create `FixSession.source = incident/problem/issue/github_issue`" invariant are fixed contracts.

Remaining argument (post-flag-extraction) determines the source. Set `FixSession.source`: `conversation` for blank/no-argument session scan, `review_id` for `--review-id=<id>` or an accepted `--action-request=<uuid>` (handled in Step 1.04/1.05 without conversation fallback), `task_file` for `[A-Z]+-\d{4}-\d{4}` task ID, or `literal` for quoted text/other string. Record it in the fix log per `.aivv/runtime-contract.md`.

**MUST-READ:** [finding-collection.md](references/finding-collection.md) before scanning conversation signals, computing fingerprints, or de-duplicating. It is the canonical home for the **Signal 0–4** scan (machine-readable JSONL sidecar → prose review → user-reported → deferred → agent-noted), the `severity_model`-gated severity inference (`legacy_4pass` vs `impact_likelihood`, blast-radius pass, tone pass), the **wont-fix registry pre-filter** and Step 4 wont-fix accept path that both use `.aivv/runtime-contract.md` `compute_fingerprint(location, description)`, and the structural/description/contradiction/severity-on-merge **de-duplication** rules. Do not improvise signal priority, severity inference, the runtime-contract fingerprint formula, or dedup thresholds.

For conversation/literal/task-file collection, tag each finding with its source label, apply wont-fix pre-filtering, de-duplicate, assign stable `F001` IDs, and continue to Step 1.9. Review-id findings come only from the durable review log.

**Validation**: If no findings can be parsed from any source, inform the user:
> No findings detected. Scanned for: machine-readable findings sidecar (JSONL block), formal /aivv prose output, user-reported bugs, deferred issues, and agent observations. Run `/aivv` (or `/aivv --reviewers=2` for higher-confidence dual review), provide a task ID with open issues, or paste specific findings.

---

### Step 1.9: Write Boundary

After findings are loaded and before investigation or planning output can imply remediation, render:

```text
[aivv-fix] remediation boundary: no fix is written before Step 5 EXECUTE; the only earlier project write is a failing reproduction test (Step 4.4.5).
[aivv-fix] every write first materializes as an inspectable write_intent; fix writes also pass the readiness gates.
```

Earlier steps may perform the state maintenance, preference update, or action-request claim described in their route. Record `write_boundary_shown: true` in the eventual fix log for every non-dry-run invocation. In `--dry-run`, render the same boundary but do not write a fix log, preserving dry-run's no-remediation-write contract.

Before triage, create one immutable `authorized_scope` snapshot from the source
request: the user's goal, selected finding IDs and locations, included
boundaries, and explicit exclusions. For `--review-id`, derive it from the
selected review's scope and only the findings selected for this fix; for a
conversation/literal or task-file route, use that source and the parsed findings.
If the request authorizes remediation across the target project, record that
project-wide boundary; if it names narrower files, topics, or exclusions, keep
those limits explicit. A discovered sibling is actionable only when it falls
inside this recorded boundary. Carry the snapshot unchanged into every
investigator, challenger, verifier, and re-entry prompt, and check every
proposed file against it before approval or write.

Encode explicit file or directory boundaries in the snapshot's canonical,
target-relative `included_paths` and `excluded_paths` arrays, in addition to the
human-readable `included` and `excluded` summaries. Leave `included_paths` empty
when the request imposes no narrower path inclusion; when non-empty, every
write target must match one listed path or a descendant. Every path in
`excluded_paths` blocks that path and descendants. Do not infer path limits from
finding locations alone. The fix-log validator checks write intents, planned
files, recorded changes, and modified/created file lists against these arrays.
If a stated path limit cannot be represented safely, do not write outside it;
report the affected finding unresolved.

Alternatives may change implementation while remaining inside this scope. An
alternative that changes
the goal or crosses an excluded boundary is a proposed scope change: do not
adopt it or ask to reopen scope in this invocation; report the finding
unresolved. A new top-level user request is a new invocation. Persist the
snapshot in every new fix log.

---

### Step 2: TRIAGE — Classify, Cluster, and Prioritize

Classify each finding (2a) by **Severity**, **Disposition** (`recommended_next_step` or the legacy severity fallback), **Type**/`category` (the Step 5 dispatch key — `code-bug` | `design-flaw` | `process-violation` | `documentation-gap` | `clarification-needed` | `improvement`), and internal **Investigation Mode** (`skip-permitted | standard | instrumentation-first | containment-first`). Then smart-batch (2b) by the location/subsystem/category/causal/context heuristics under the batch-independence rule, and present the provisional triage summary (2c) for auto-proceed-or-pause. Step 2c batches are **provisional** — Step 4 reconciles them after investigators declare `files_to_modify`.

**MUST-READ:** [triage.md](references/triage.md) before classifying findings, computing batches, or rendering the triage summary. The classification dimensions, the `complexity`→`investigation_mode` migration, the dispatch-semantics note, the batch-independence + mandatory->5 rule, and the triage-table columns are fixed contracts. Do not improvise the classification or the batching heuristics.
**MUST-READ:** [execution-decisioning.md](references/execution-decisioning.md) before converting triage output into containment, investigation, decision-queue, or Branch A-F execution routes.

---

### Step 2.5: CONTAIN — Immediate Blast Radius Reduction (fix-now/investigate-first findings)

**Applies only when the triage table contains ≥1 finding with DISPOSITION
`fix-now` or `investigate-first` and active data-integrity/financial/security/
availability blast radius.** Legacy findings without `recommended_next_step` use
the severity fallback (`CRITICAL` remains containment-eligible).

Before spawning investigators, ask whether a reversible containment action is available right now — a temporary symptom-level measure to limit ongoing damage while the root cause is investigated, NOT the fix. If the user applies one, log it in `session_changes` and still proceed to Step 3 for all batches.

**MUST-READ:** [containment.md](references/containment.md) when this step applies. It is the canonical home for the containment examples (least- to most-disruptive), disruptive-action disclosure, and the right-now/when-triggered protocol. Do not improvise the protocol or skip the disruption-cost disclosure.

**Skip when:** batch contains no `fix-now` / `investigate-first` findings with active blast radius, or only contains legacy findings below the CRITICAL fallback threshold.

---

### Step 3: INVESTIGATE — Root Cause Analysis

**MUST-READ:** [fast-path.md](references/fast-path.md) before using the low-risk fast path. **MUST-READ:** [investigation-dispatch.md](references/investigation-dispatch.md) before investigator dispatch or same-agent fallback.

Default assumption: root cause is unknown. Reproduce informal findings when required, run the CRITICAL/MAJOR change-attribution probe, and either dispatch a cold investigator per batch or use the low-risk fast path when every [fast-path.md](references/fast-path.md) eligibility gate passes; there is no other way to skip the investigator. Documentation-gap findings normally require investigator routing; the only exception is a fast-path-eligible documentation gap whose exact `verbatim_doc_content` is already known. If cold dispatch is unavailable, record the capability degradation and follow the reference's Branch E fallback rules.

Include the immutable `authorized_scope` snapshot in every investigator prompt.
Investigate and propose fixes only for its selected findings and boundaries; do
not reinterpret a proposed correction as permission to change the task.

Before investigator dispatch, compute `architectural_remediation_assessment` and pass the reason-coded object into `{architectural_remediation_assessment}`. The weak/strong seed rules live in [investigation-dispatch.md](references/investigation-dispatch.md); the investigator must prove or disprove each reason with file/grep evidence.

### Step 4: PLAN — Present Investigation Results

**Field propagation (required — load-bearing for Step 5 dispatch):** Before presenting the structured summary, for every approved finding, carry the **`category`** value set in Step 2a (inherited from the envelope schema for Signal 0 findings; inferred for Signal 1-4) onto the approved-finding record. Step 5 Branch dispatch reads this field and falls back to Branch A (`code-bug`) on missing-or-unknown with a warning logged to `session_changes`. Undefined-on-read is never acceptable for a dispatch key.

Collect investigator JSON, mark consumed handles, close them before Step 3 re-entry, and render the structured **Investigation Results** summary. Reconcile batches after investigators declare `files_to_modify`.

Handle special verdicts in order: `already-correct` → false-positive calibration; `clarification-needed` → explanation/Branch E; `wont-fix` → user accept/override and, if accepted, the Step 4 wont-fix accept path in [finding-collection.md](references/finding-collection.md). Then apply Gate 1/2/3; Gate 1 challenges root cause and Step 4.5 later challenges the fix plan.

**Auto-proceed precheck:** do not move any finding to Step 5 yet. Auto-apply is allowed only after `fix_confidence` is high, policy is `auto`, write-intent readiness passes, CHALLENGE and consequence gates clear, and no blocker remains. Route trade-offs, architecture/shared-interface changes, medium/low confidence, conflicts, and high-blast-radius action-driving findings to the decision queue, evidence-backed targeted re-investigation only when the shared retry budget has room, or skip/escalate handling.
#### `fix_confidence` computation (per approved finding, computed here — consumed by Step 4.5)

After Gate 1/2/3 resolves and before evaluating the Step 4.5 trigger, compute `fix_confidence` per approved finding via the one-way demotion ladder (`high → medium → low`, floor at `low`), then persist it on every `session_changes.changes_summary[]` entry and in the `review_meta` calibration record.

---

### Step 4.3: DRY-RUN PLAN HALT — preview only, no write-intent or challenger load

If `dry_run == true`, stop here after investigation results, batch reconciliation, apply-policy preview, and `fix_confidence` computation. Render a plan-only summary with:
- findings that would be fixed, skipped, escalated, or require user decisions;
- proposed files to modify when investigators supplied them;
- confidence and reason-coded blockers;
- the exact message: `DRY RUN: no remediation writes were made. After the dry-run gate, no write intents, challenger dispatch, execution, verifier dispatch, fix log, session changes, or calibration writes occurred, and no pre-invocation state maintenance ran.`

After this halt, do not materialize `write_intents[]`, enter Step 4.4.5, dispatch the fix-plan challenger, initialize a fix log, write active state, or run verification/calibration hooks. The Step 5 dry-run gate remains as defense-in-depth only; reaching Step 5 while `dry_run == true` is a contract violation to report and halt.

---

### Step 4.4: MATERIALIZE WRITE INTENTS — inspectable proposed bytes

Every write-capable Branch A/B/C-localized/D fix must materialize inspectable `write_intents[]` with exact proposed bytes, stable hashes, detector results, and required assertions before Step 4.4.5, Step 4.5, or Step 5 can proceed. The failing-test intent of Step 4.4.5 is materialized here with the fix intents. Missing, opaque, stale, risky, or insufficiently validated intents halt according to the reference.

Then persist the plan: after the Step 5.0 target reuse and pre-write banner, write the `in-progress` fix log to `<state_dir>` with every identity field (target, storage, source, lifecycle context), any confirmed `dangerously_auto_apply`, `write_intents[]`, `fix_plans[]`, and the `decision_ledger[]`, and update it in the same validated write as each later decision. After a context compaction, a stop, or a Resume, re-read that log instead of rebuilding the plan from memory. See [fix-log-contract.md](references/fix-log-contract.md) for the write and recovery rules.

### Step 4.4.5: RED-GREEN TEST GATE — failing test before the plan challenge

For every approved finding where a test can be written (`code-bug`, `design-flaw` with testable behavior): run the failing test now, before Step 4.5, and confirm it fails for the right reason (red). A test that needs new bytes on disk is written here only when no user decision is pending for its finding; it is the only project write allowed before Step 5, it is recorded in the fix log, and it is undone if the fix is not applied. Otherwise the test stays an intent and the red run happens in Step 5 after approval. Record the red result in the decision ledger. Step 5 applies the fix, re-runs the test (green), and logs `red_green_evidence` on the `changes_summary` entry. See [red-green-gate.md](references/red-green-gate.md).

---

### Step 4.5: CHALLENGE — Independent Fix-Plan Review

After Step 4's auto-proceed precheck records blockers (and any Gate 1/2/3 escalations complete), after Step 4.4 has materialized `write_intents[]`, and after the Step 4.4.5 red run, evaluate whether to spawn an independent fix-plan challenger BEFORE executing fixes. The challenger reviews the immutable `authorized_scope`, proposed fixes, escaped `write_intents[]` snapshots (including the failing test), and the red-run output BEFORE the fix is written — when revision is cheap. A revision requires a specific evidence-backed defect and a concrete correction inside `authorized_scope`; uncertainty alone is advisory. Only after Step 4.5 returns APPROVE or is legitimately skipped may the W10 decision queue classify a finding as Auto-eligible for Step 5.

---

### Step 5: EXECUTE — Apply Approved Fixes

Reuse the target/storage context bound before maintenance, cache `target_project` in `session_changes`, emit the pre-write banner if Step 4.4 has not already done so, and honor the dry-run halt. Then reuse the fix log persisted at Step 4.4 (initialize it here only when no write intent preceded this step) and apply each approved fix through its evidence-selected branch, recording the applied changes as specified in that branch's reference.

When `lifecycle_context` is present, initialize `session_changes.lifecycle_context` before the first fix-log write, load the lifecycle record for investigator context, and apply only schema-backed write-back fields per the reference (treating `rca_status` not-started/draft as investigation-first). When `dangerously_auto_apply_confirmed == true`, initialize `session_changes.dangerously_auto_apply` if Step 4.4 has not already recorded it, tag each dangerous-route `changes_summary` entry, and emit the loud `DANGEROUSLY AUTO-APPLIED <N> fix(es)` audit banner at the end of Step 5 (with `0` if no fix was bypassed). The lifecycle write-back rules + GitHub-sync/validate helpers and the dangerous-audit banner contract are in [execution-branches.md](references/execution-branches.md) — read it before any lifecycle write-back or dangerous-route apply.

### Step 5.4: PRE-WRITE-VALIDATE — deterministic embedded-content checks

Run deterministic checks for every approved write intent with required or missing detector assertions before the host write primitive. `jq-parses`, `schema-coherence`, and `line-cite-valid` failures halt and re-route for re-authoring only when the shared invocation-wide rework budget has room; otherwise report the finding unresolved and do not write it. Never bypass required assertions without an explicit valid user approval record.

### Step 5.5: Fix-bundle coherence pass (orchestrator-side, advisory)

Run the fix-bundle coherence pass after per-finding fixes and before verifier dispatch. Warnings are advisory but must be logged into the fix log for verifier input.

---

### Step 5.6: FIX-LOG HYGIENE — Mechanical Assertions

Check `authorized_scope`, retry history, `changes_summary` coverage, modified/created-file consistency, status, cycle count, and required entry fields exactly as the reference specifies. Halt on corrupted scope or retry state; otherwise append warnings and continue to verifier dispatch.

---

### Step 5.6.5: Cycle-N+1 mandatory sibling-surface grep (AC-X3)

Run sibling-surface grep for original strings from the prior cycle and surface surviving sibling matches as warnings/sub-findings.

---

### Step 5.7: ORCHESTRATOR EXECUTION — Run New Verification Code

When enabled by config/flag, execute newly-authored verification code with path-safety checks, timeout handling, captured execution evidence, nonzero-exit warnings, and immediate atomic fix-log persistence.

When a newly-authored verification method is claimed as recurrence prevention, Step 5.7 must read and preserve the Step 4.4.5 `red_green_evidence` object. If the pre-fix failure evidence is absent, wrong-reason, or only reconstructed from memory, downgrade the entry to `red_green_evidence.claim: "verification-only"` before verifier dispatch. `execution_evidence.command_argv` records the exact command arguments used for the post-fix execution path.

---

### Step 6: VERIFY — Scoped Re-Verification

See [verifier-dispatch.md](references/verifier-dispatch.md) for dispatch, independence, result parsing, and convergence rules.

Compile verification context from the `session_changes` log and immutable
`authorized_scope`, dispatch the scoped verifier with target-project anchoring,
enforce the same-agent-verification exclusions, parse resolver/regression
outcomes, queue calibration records, and apply the single invocation-wide
rework budget. When it is exhausted, report unresolved findings and the bounded
retry history; do not ask for permission to repeat or widen already-authorized
work.

When a predecessor review is linked, Step 6 must carry each predecessor finding's `runtime_evidence` outcome into the verifier prompt summary. Missing or refuted runtime evidence on UI/rendered-DOM findings does not block source-level verification, but any READY_TO_MERGE conclusion is source-coherent only and should include the runtime-evidence advisory from `verifier-dispatch.md`.

### Step 6.5: Outer-loop reverse-chain

**Fires ONLY after Step 6 produces a verify-PASS result with no regressions.** This step checks whether the outer-loop should continue, has converged cleanly, or has hit a termination condition.

Read the canonical [outer-loop contract](../../.aivv/outer-loop.md) before evaluating its preconditions, state, canary, termination, or reverse-chain behavior. The outer loop runs only after verification passes without regressions; the contract owns its algorithm and version-failure handling.

---

### Step 7: DOCUMENT — Capture Lessons Learned

After all findings are resolved (or escalated):

**Step 7.0: Final Subagent cleanup:** Before returning the final resolution summary, run one final best-effort cleanup over any AIVV-owned handles from this invocation whose outputs are consumed and not yet closed. Persist cleanup warnings in the fix log `warnings` array when possible and surface them in the Step 7 summary. If cleanup fails after output was already consumed, preserve the resolved verifier/challenger/investigator decision and report only the cleanup warning.

1. **Summary report**: Present this final summary:

```
## Resolution Summary

| ID | Severity | Finding | Status | Root Cause | Fix Applied | Prevention Added |
|----|----------|---------|--------|-----------|-------------|-----------------|
| F001 | CRITICAL | <symptom <=60 chars> | Resolved | <cause <=60 chars> | <fix <=80 chars> | <prevention <=80 chars> |

**Cycles**: {N} resolve-verify cycles
**Total fixes**: {N} files modified
**Prevention mechanisms added**: {N}
**Codebase-wide similar patterns fixed**: {N} additional instances
**Cleanup warnings**: {N or "none"} — include any final Subagent cleanup warnings that were persisted to `warnings`
```

The **Finding** column is sourced from `session_changes.changes_summary[].finding_id` → originating finding's `summary` field. When source is `"review_id"`, look up `FixSession.review_log.findings[id == finding_id].summary`. When source is `"task_file"`, use the issue description from the task file's `open_issues` entry for that finding ID. When source is `"conversation"` or `"literal"`, use the finding's `summary` as collected in Step 1. If summary is unavailable for a finding, use the finding ID as a fallback. Keep values short — **Finding** and **Root Cause** at ≤60 chars each, other columns at ≤80 chars — truncate with `…` if longer. Finding and Root Cause occupy different abstraction levels (observed symptom vs causal explanation) and should not duplicate each other.

**Predecessor backfill on fix-log → review-log:** when `/aivv-fix` is chained from a `/aivv` review (source == "review_id"), back-fill the originating review log's `fix_invocation_id` with the current fix-log's `id`, persist `source_review_id` as the canonical join key, and validate the candidate fix log with the AIVV-rooted `"$AIVV_ROOT/tools/pre-write-validator.mjs"` command defined in [document-and-calibration.md](references/document-and-calibration.md) before the durable write.

**Step 7.8: Optional post-fix HTML viewer hook**

After Step 7 completes the fix log and review-log backfill, render the joined review/fix HTML report only when the conditions in [viewer-hook.md](references/viewer-hook.md) match. Viewer behavior is post-state-write and non-blocking; it is not a substitute for verification.

2. **Calibration**: Append applicable records to this invocation's per-invocation shard through the shared storage helper; skip calibration writes under `--dry-run`. See [document-and-calibration.md](references/document-and-calibration.md) for record fields and shard rules.

3. **Pattern capture**: If a new prevention mechanism was created, suggest promoting it to project/global guidance. If `/lesson` is available, also suggest `/lesson "Prevention mechanism created for recurring pattern: [description]. Applies to: [scope]." --category technical --severity medium`; otherwise skip silently.

---

## Relationship to Other Skills

| Skill | Relationship |
|-------|-------------|
| `/aivv` | Produces findings this skill resolves |
| `/complete-review` | Optional external sign-off integration |
| `/lesson` | Optional pattern capture, capability-checked |

## Error Handling

- **No findings found**: Inform user, suggest running `/aivv` (or `/aivv --reviewers=2` for higher-confidence dual review) first
- **Investigator returns invalid JSON**: Retry with clarified prompt (max 1 retry)
- **Investigator times out (max-turns exhausted on the host)**: Use partial results if available, flag incomplete analysis
- **Session change log incomplete**: Warn user that verification may miss changes not logged in `session_changes`. Suggest manual review of all files touched during the session.
- **Write route without edit capability**: Stop before the first write, explain which host facility is unavailable (Claude Code: `Edit`/`Write`; Codex: `apply_patch`), and report any read-only result already established.

For `--review-id` failure codes and recovery routes, follow
[review-id-resolution.md](references/review-id-resolution.md).
