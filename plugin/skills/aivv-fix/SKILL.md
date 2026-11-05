---
name: aivv-fix
description: "Use when you need end-to-end remediation of IV&V findings: investigate root causes, apply strategic fixes with prevention mechanisms, and verify in a bounded cycle after `/aivv`, lifecycle records, task open_issues, or a literal finding string."
argument-hint: "[task-id | \"literal finding\" | --review-id <id> | --action-request <uuid> --target <dir> | --incident <id> | --problem <id> | --issue <id> | --github-issue <url|owner/repo#N>]"
---

# AIVV Fix — Orchestrator Skill

End-to-end workflow for resolving IV&V findings: root cause analysis, strategic fixes, scoped re-verification, in a bounded loop.

**This skill requires write access via the host's edit facility** (Claude Code: `Edit`/`Write`/`Bash`; Codex: `apply_patch`/`shell_command`). If invoked from a restricted context (read-only subagent, no edit capability), warn the user and stop.

## Host Adapter Mapping

Same as `/aivv` — see the Host notes paragraph at the end of the [`/aivv` skill](../aivv/SKILL.md), the Adapter Operations table in [`.aivv/runtime-contract.md`](../../.aivv/runtime-contract.md), and the per-host adapters in [`.aivv/platform-adapters/`](../../.aivv/platform-adapters/). Additional `/aivv-fix`-specific operations:

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

Flow: 1 COLLECT findings → 2 TRIAGE batches → 2.5 CONTAIN critical blast radius when needed → 3 INVESTIGATE with cold investigator or fast path → 4 PLAN approved fixes → 4.5 CHALLENGE when triggered → 4.6 RED/GREEN when testable → 5 EXECUTE with `session_changes` logging → 6 VERIFY with bounded loop → 7 DOCUMENT summary, calibration, and patterns.

## Common Mistakes

Do not rely on `git diff` in Steps 5/6, skip same-file batching, auto-proceed on architectural changes, or loop past 3 cycles; use the session change log, batch related findings, ask on restructuring, and present the convergence gate.

## Reference Index

Single progressive-disclosure index. Open the matching subfile before executing its gated step; references own load-bearing contracts, while this body keeps the skeleton and triggers.

**Step-gated references (read before the named step/condition):**

- MUST-READ before Step 1.0 state maintenance: [preamble-state-maintenance.md](references/preamble-state-maintenance.md) — external-only Schema-version gate, authorized stale-session reaping, and legacy-history preservation. Do not improvise.
- MUST-READ before extracting any Step 1 flag, the `--list-wont-fix`/`--forget-wont-fix` early-exit handlers, or lifecycle-selector routing: [fix-flags.md](references/fix-flags.md) — per-flag parsing rules, the two registry-handler exit codes, and the lifecycle-selector route helper are fixed contracts.
- MUST-READ before accepting `--action-request=<uuid>`: [action-inbox.md](references/action-inbox.md) — the exclusive claim, target/revision revalidation, bounded selected-findings filter, and no-auto-execution boundary are fixed contracts.
- MUST-READ before scanning conversation signals or fingerprinting in Step 1 COLLECT: [finding-collection.md](references/finding-collection.md) — Signal 0–4 priority, severity inference, fingerprint routing to `.aivv/runtime-contract.md`, and dedup thresholds are fixed contracts.
- MUST-READ when resolving `--review-id`: [review-id-resolution.md](references/review-id-resolution.md) — missing, ambiguous, stale, or schema-newer review logs are hard routing conditions.
- MUST-READ before binding `/aivv-fix`-specific preference keys in Step 1.1: [fix-preferences.md](references/fix-preferences.md) — the `fix_apply_policy` map, legacy `apply_polish_mode` mapping, `--apply-all-polish`/`--dangerously-auto-apply` precedence, and the `auto_apply_v1` marker write are fixed contracts (shared mechanism in `.aivv/configuration.md`).
- MUST-READ when POLISH or L1-source policy affects scope: [polish-and-l1-source-policy.md](references/polish-and-l1-source-policy.md) — preserve forced-show and evidence semantics.
- MUST-READ before any cross-step containment/investigation/challenge/auto-apply/decision-queue/Branch A-F execution decision: [execution-decisioning.md](references/execution-decisioning.md) — ordering, route boundaries, decision ledger fields, and dry-run/dangerous-bypass limits are fixed contracts.
- MUST-READ before Step 2 TRIAGE classification, smart batching, or the triage summary: [triage.md](references/triage.md) — the disposition/category/investigation-mode classification, batching heuristics, and triage-table format are fixed contracts.
- MUST-READ when Step 2.5 CONTAIN applies: [containment.md](references/containment.md) — the right-now/when-triggered protocol and disruption-cost disclosure are fixed contracts.
- MUST-READ before using the low-risk fast path in Step 3: [fast-path.md](references/fast-path.md) — the eligibility gate, inline investigation record, and non-skippable safety/verification steps are fixed contracts.
- MUST-READ before investigator dispatch or same-agent fallback in Step 3: [investigation-dispatch.md](references/investigation-dispatch.md) — record capability degradations rather than guessing.
- MUST-READ before classifying apply-policy routes, the Step 4 architectural-remediation lane + batch reconciliation, evaluating Gate 1/2/3, the wont-fix-accept write, the auto-proceed precheck, or computing `fix_confidence`: [apply-policy-and-gates.md](references/apply-policy-and-gates.md) — the W10 route boundaries, the architectural-remediation render + fail-closed contract, the dangerous-bypass audit, the pre-execution gate triggers, and the confidence demotion ladder are fixed contracts.
- MUST-READ before write intents or pre-write validation (Step 4.4 / 5.4): [write-intents-and-prewrite-validation.md](references/write-intents-and-prewrite-validation.md) — never bypass required assertions without explicit user approval.
- MUST-READ before Step 4.5 CHALLENGE trigger, dispatch, or verdict handling: [challenge-loop.md](references/challenge-loop.md) — the trigger/skip conditions, prompt placeholders, and `challenge_iterations` counter semantics are fixed contracts.
- MUST-READ before Step 4.6 RED-GREEN TEST GATE: [red-green-gate.md](references/red-green-gate.md) — the right-reason failure-shape validation and the `red_green_evidence` prevention-claim rule are fixed contracts.
- MUST-READ before writing or recovering `session_changes` in Step 5: [fix-log-contract.md](references/fix-log-contract.md) — resolve the target project once and keep state writes atomic. The Step 5 pre-loop also runs the fail-closed class-verdict gate + `class_signature` variant scan + class-sibling triage (class breadth), alongside the `scope_search_seed` pre-loop (scope breadth).
- MUST-READ before dispatching the Step 5 pre-loop class-sibling triage pass: [class-sibling-triage-template.md](references/class-sibling-triage-template.md) — the per-site `confirmed`/`false-positive`/`ambiguous` verdict contract and the embedded `speculative-pattern-projection` prevention rule are fixed contracts; a `class_signature` grep match is a hypothesis, never an auto-fix target.
- MUST-READ before executing Branch A/B/C/D/E/F fixes, the `--dangerously-auto-apply` Step 5 audit banner, or lifecycle write-back: [execution-branches.md](references/execution-branches.md) — branch selection is evidence-driven and must not collapse into generic editing.
- MUST-READ before post-write mechanical verification (Step 5.5/5.6/5.6.5/5.7): [mechanical-verification-checks.md](references/mechanical-verification-checks.md) — run sibling-surface grep and clean-tree checks where required.
- MUST-READ before Step 6: VERIFY: [verifier-dispatch.md](references/verifier-dispatch.md) — enforce the convergence gate after bounded verification loops.
- MUST-READ before Step 6.5 outer-loop reverse-chain: [outer-loop.md](references/outer-loop.md) — state schema, no-progress algorithm, termination banners, and reverse-chain invocation form are fixed contracts.
- MUST-READ before Step 7 predecessor backfill or any calibration JSONL write: [document-and-calibration.md](references/document-and-calibration.md) — the `fix_invocation_id` backfill recipe and the per-kind calibration record fields are fixed contracts.
- MUST-READ when review/fix viewer behavior is enabled (Step 7.8): [viewer-hook.md](references/viewer-hook.md) — viewer updates are post-state-write behavior, not a substitute for verification.

**Dispatch-time prompt/schema bodies:** load these inline only when their dispatch step needs them: [investigator-prompt-template.md](references/investigator-prompt-template.md), [json-schema.md](references/json-schema.md), [investigator-output-example.md](references/investigator-output-example.md), [investigator-enrichment-fields.md](references/investigator-enrichment-fields.md), [investigator-field-definitions.md](references/investigator-field-definitions.md), [batched-and-challenger-schemas.md](references/batched-and-challenger-schemas.md), [schema-migration-notes.md](references/schema-migration-notes.md), [fix-challenger-prompt-template.md](references/fix-challenger-prompt-template.md), and [verifier-prompt-template.md](references/verifier-prompt-template.md).

Calibration data is written inline (JSONL append) — see Step 7. No separate script is shipped for the write path; analytics/reporting scripts are planned for a future release alongside `.aivv/schemas/`.

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
/aivv-fix --forget-wont-fix=<key>      # remove registry entry
```

**Flags:** parse with [fix-flags.md](references/fix-flags.md). `--action-request` is an explicit user-selected batch handoff, not an auto-apply bypass: it requires `--target`, claims the request once, revalidates its review and revision, and then uses all ordinary gates. Keep the top-level invariant: `--dry-run` is safe preview mode; the pre-invocation state-maintenance preamble still runs, but no remediation writes occur and No fix/session/calibration/verifier writes occur after the dry-run gate. `--dangerously-auto-apply` is a confirmed per-run bypass only; it never overrides `--dry-run`.

## Target Project Resolution

**Read before resolving the target project:** [`.aivv/target-resolution.md`](../../.aivv/target-resolution.md). Bind and cache storage context before maintenance, collection, or dispatch, using the installed `tools/storage-paths.mjs resolve` helper; all generated state uses external `<state_dir>` and calibration uses `<calibration_dir>`. `session_changes.target_project` is the immutable base for finding file references. Policy lookup remains separate and retains original provenance. Finding ancestors never choose the fresh storage target. Do not improvise precedence, write local `.aivv/state/` migration markers, or re-resolve after cwd changes.

## Instructions

When this skill triggers, follow these 7 steps **exactly**.

<!-- pre-fix evidence: plugin/skills/aivv-fix/SKILL.md:110-122. -->
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
keep their route errors; unrelated history warns. Dry-run is read-only throughout.
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

After flag extraction and any successful `--review-id` resolution, resolve user/project preferences once for the fix invocation (the `/aivv-fix` counterpart to `/aivv` Step 1.5; load-bearing for `apply_polish_mode`, `fix_apply_policy`, `shared_interface_patterns`, `max_challenges_per_invocation`, `enable_step_57_execution`, `outer_loop_*`, and `post_review_html_*`). Pick the resolution target per the reference's target chain (`--target` > review-log `target_project` > finding-path common-ancestor/git/cwd), reuse the shared resolution algorithm in [`.aivv/configuration.md`](../../.aivv/configuration.md) (CLI > project > user > schema defaults, validated against `.aivv/schemas/config.schema.json`), then bind the `/aivv-fix`-specific key catalog + emit the one-time `auto_apply_v1` notice. On a malformed/unreadable config, preserve its original location and warn/fall through per the reference — do not fail the fix workflow over an optional preference file.

**MUST-READ:** [fix-preferences.md](references/fix-preferences.md) before binding any `/aivv-fix`-specific preference key or emitting the `auto_apply_v1` notice. The preference-resolution target chain, the per-category `fix_apply_policy` values, the legacy `apply_polish_mode` mapping, the `--apply-all-polish`/`--dangerously-auto-apply` precedence, the malformed-config handling, and the `auto_apply_v1` marker-write contract are fixed contracts. Do not improvise key names, precedence, or the marker write.

**Early-exit registry handlers + lifecycle-selector routing:** when `--list-wont-fix` or `--forget-wont-fix=<identifier>` was extracted, run the matching read-only/write registry handler and return (skip Steps 1.1–7). When a lifecycle selector (`--incident`/`--problem`/`--issue`/`--github-issue`) was extracted, resolve `AIVV_ROOT` through the shared runtime-root contract, then run `"$AIVV_ROOT/tools/incident-lifecycle-route.mjs"` before ordinary source parsing and bind `lifecycle_context` + `FixSession.source` from the route result.

**MUST-READ:** [fix-flags.md](references/fix-flags.md) before invoking either registry handler or routing a lifecycle selector — the handler exit codes, the fingerprint-resolution rule, the route-helper invocation, and the "lifecycle routing MUST NOT create `FixSession.source = incident/problem/issue/github_issue`" invariant are fixed contracts.

Remaining argument (post-flag-extraction) determines the source. Set `FixSession.source`: `conversation` for blank/no-argument session scan, `review_id` for `--review-id=<id>` or an accepted `--action-request=<uuid>` (handled in Step 1.04/1.05 without conversation fallback), `task_file` for `[A-Z]+-\d{4}-\d{4}` task ID, or `literal` for quoted text/other string. Record it in the fix log per `.aivv/runtime-contract.md`.

**MUST-READ:** [finding-collection.md](references/finding-collection.md) before scanning conversation signals, computing fingerprints, or de-duplicating. It is the canonical home for the **Signal 0–4** scan (machine-readable JSONL sidecar → prose review → user-reported → deferred → agent-noted), the `severity_model`-gated severity inference (`legacy_4pass` vs `impact_likelihood`, blast-radius pass, tone pass), the **wont-fix registry pre-filter** and Step 4 wont-fix accept path that both use `.aivv/runtime-contract.md` `compute_fingerprint(location, description)`, and the structural/description/contradiction/severity-on-merge **de-duplication** rules. Do not improvise signal priority, severity inference, the runtime-contract fingerprint formula, or dedup thresholds.

For conversation/literal/task-file collection, tag each finding with its source label, apply wont-fix pre-filtering, de-duplicate, assign stable `F001` IDs, and continue to Step 1.9. Review-id findings come only from the durable review log.

**Validation**: If no findings can be parsed from any source, inform the user:
> No findings detected. Scanned for: machine-readable findings sidecar (JSONL block), formal /aivv prose output, user-reported bugs, deferred issues, and agent observations. Run `/aivv` (or `/aivv --reviewers=2` for higher-confidence dual review), provide a task ID with open issues, or paste specific findings.

---

### Step 1.9: Write Boundary

After findings are loaded and before investigation or planning output can imply writes, render:

```text
[aivv-fix] write boundary: no files will change until Step 5 EXECUTE.
[aivv-fix] proposed writes must first materialize as inspectable write_intents and pass readiness gates.
```

Record `write_boundary_shown: true` in the eventual fix log for every non-dry-run invocation. In `--dry-run`, render the same boundary but do not write a fix log, preserving dry-run's no-remediation-write contract.

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

Default assumption: root cause is unknown. Reproduce informal findings when required, run the CRITICAL/MAJOR change-attribution probe, and either dispatch a cold investigator per batch, use the low-risk fast path when every [fast-path.md](references/fast-path.md) eligibility gate passes, or document the rare high-confidence skip inline. Documentation-gap findings normally require investigator routing; the only exception is a fast-path-eligible documentation gap whose exact `verbatim_doc_content` is already known. If cold dispatch is unavailable, record the capability degradation and follow the reference's Branch E fallback rules.

Before investigator dispatch, compute `architectural_remediation_assessment` and pass the reason-coded object into `{architectural_remediation_assessment}`. The weak/strong seed rules live in [investigation-dispatch.md](references/investigation-dispatch.md); the investigator must prove or disprove each reason with file/grep evidence.

### Step 4: PLAN — Present Investigation Results

**MUST-READ:** [execution-decisioning.md](references/execution-decisioning.md) before reconciling gates into final execution routes.
**Field propagation (required — load-bearing for Step 5 dispatch):** Before presenting the structured summary, for every approved finding, carry the **`category`** value set in Step 2a (inherited from the envelope schema for Signal 0 findings; inferred for Signal 1-4) onto the approved-finding record. Step 5 Branch dispatch reads this field and falls back to Branch A (`code-bug`) on missing-or-unknown with a warning logged to `session_changes`. Undefined-on-read is never acceptable for a dispatch key.

Collect investigator JSON, mark consumed handles, close them before Step 3 re-entry, and render the structured **Investigation Results** summary per [apply-policy-and-gates.md](references/apply-policy-and-gates.md). That reference owns the architectural-remediation lane, `[RECONCILED]` batch reconciliation, and the W10 batched apply-policy decision queue with the **"Fix Decisions Needed"** surface.

**MUST-READ:** [apply-policy-and-gates.md](references/apply-policy-and-gates.md) before classifying apply-policy routes, rendering the decision queue, or applying the `--dangerously-auto-apply` bypass. It is the canonical home for the four route classifications, the "Fix Decisions Needed" surface format, the severity/disposition invariant (`skip` cannot suppress CRITICAL/MAJOR), the absent-`fix_apply_policy` default binding, and the dangerous-bypass route. Do not improvise route boundaries or the bypass audit reasons.

Handle special verdicts in order: `already-correct` → false-positive calibration; `clarification-needed` → explanation/Branch E; `wont-fix` → user accept/override and, if accepted, the Step 4 wont-fix accept path in [finding-collection.md](references/finding-collection.md). Then apply the pre-execution Gate 1/2/3 rules from [apply-policy-and-gates.md](references/apply-policy-and-gates.md); Gate 1 challenges root cause and Step 4.5 later challenges the fix plan.

**MUST-READ:** [apply-policy-and-gates.md](references/apply-policy-and-gates.md) before evaluating Gate 1/2/3, the `unable-to-verify` documentation-gap short-circuit, or the Gate-1-vs-Step-4.5 layering. The gate triggers, second-opinion dispatch lifecycle, and the gate-vs-auto-proceed overlap rule are fixed contracts.

**Auto-proceed precheck:** do not move any finding to Step 5 yet. Record blockers for the later Auto-eligible route, then wait for `fix_confidence`, Step 4.4 write-intent materialization, Step 4.5 CHALLENGE, and consequence gates. Only high-confidence, policy-auto, consequence-free fixes may auto-apply; trade-offs, architecture/shared-interface changes, medium/low confidence, conflicts, and high-blast-radius action-driving findings route through the decision queue or skip/escalate invariant.
Final auto-eligible classification happens only after `fix_confidence` computation, Step 4.4 write-intent materialization, Step 4.5 CHALLENGE trigger/verdict handling, and consequence gates settle. Auto-apply requires `fix_confidence == "high"` plus policy-auto and no unresolved blockers. Medium/low-confidence proposals route to the decision queue, targeted re-investigation, or skip/escalate handling; they never auto-apply by policy default.
#### `fix_confidence` computation (per approved finding, computed here — consumed by Step 4.5)

After Gate 1/2/3 resolves and before evaluating the Step 4.5 trigger, compute `fix_confidence` per approved finding via the one-way demotion ladder (`high → medium → low`, floor at `low`), then persist it on every `session_changes.changes_summary[]` entry and in the `review_meta` calibration record.

**MUST-READ:** [apply-policy-and-gates.md](references/apply-policy-and-gates.md) before computing `fix_confidence`. It is the canonical home for the demotion ladder, the per-predicate definitions (`predecessor_finding_match`, architectural-remediation, `touches_shared_interface`, `authors_new_verification_code`), and the schema persistence contract. Do not improvise predicates or floors.

---

### Step 4.3: DRY-RUN PLAN HALT — preview only, no write-intent or challenger load

If `dry_run == true`, stop here after investigation results, batch reconciliation, apply-policy preview, and `fix_confidence` computation. Render a plan-only summary with:
- findings that would be fixed, skipped, escalated, or require user decisions;
- proposed files to modify when investigators supplied them;
- confidence and reason-coded blockers;
- the exact message: `DRY RUN: no write intents, challenger dispatch, execution, verifier dispatch, fix log, session state, calibration, or viewer artifacts were written.`

Do not materialize `write_intents[]`, dispatch the fix-plan challenger, enter Step 4.6, initialize a fix log, write active state, or run verification/calibration hooks. The Step 5 dry-run gate remains as defense-in-depth only; reaching Step 5 while `dry_run == true` is a contract violation to report and halt.

---

### Step 4.4: MATERIALIZE WRITE INTENTS — inspectable proposed bytes

**MUST-READ:** [write-intents-and-prewrite-validation.md](references/write-intents-and-prewrite-validation.md) before challenger dispatch, pre-write validation, or any host write primitive.

Every write-capable Branch A/B/C-localized/D fix must materialize inspectable `write_intents[]` with exact proposed bytes, stable hashes, detector results, and required assertions before Step 4.5 or Step 5 can proceed. Missing, opaque, stale, risky, or insufficiently validated intents halt according to the reference.

### Step 4.5: CHALLENGE — Independent Fix-Plan Review

After Step 4's auto-proceed precheck records blockers (and any Gate 1/2/3 escalations complete), and after Step 4.4 has materialized `write_intents[]`, evaluate whether to spawn an independent fix-plan challenger BEFORE executing fixes. The challenger reviews proposed fixes and escaped `write_intents[]` snapshots BEFORE code is written — when revision is cheap. Only after Step 4.5 returns APPROVE or is legitimately skipped may the W10 decision queue classify a finding as Auto-eligible for Step 5.

**MUST-READ:** [challenge-loop.md](references/challenge-loop.md) before evaluating the CHALLENGE trigger, dispatching the challenger, or handling its verdict. It is the canonical home for the 4.5.1 trigger/skip conditions + token-budget circuit-breaker, the 4.5.2 dispatch + per-placeholder prompt construction (including the  worktree-CWD note and the output-format-override contract), and the 4.5.3 APPROVE/REVISE/REJECT handling + the `challenge_iterations`-vs-`cycle_count` counter semantics. Do not improvise the triggers, the prompt placeholders, or the counter rules. The challenger **prompt** itself is in [fix-challenger-prompt-template.md](references/fix-challenger-prompt-template.md).

---

### Step 4.6: RED-GREEN TEST GATE (before any code change)

For every approved finding where a test can be written (`code-bug`, `design-flaw` with testable behavior): materialize a failing-test write intent (red), validate the right-reason pre-fix failure, apply the fix in Step 5, verify the test passes (green), and log `red_green_evidence` on the Step 5 `changes_summary` entry.

**MUST-READ:** [red-green-gate.md](references/red-green-gate.md) before materializing a test intent or claiming red-green prevention. It is the canonical home for the six-step sequence (materialize → validate failure shape → verify-fails → apply → verify-passes → log), the `red_green_evidence.claim` prevention-vs-verification-only contract, the skip conditions (`documentation-gap`/`process-violation`/no-test-infra/effort), and the runtime-observation exception. Do not improvise the failure-shape validation or the prevention-claim rule.

---

### Step 5: EXECUTE — Apply Approved Fixes

**MUST-READ:** [execution-decisioning.md](references/execution-decisioning.md) before dispatching an approved finding to Branch A/B/C/D/E/F or applying a dangerous-auto-approved route.
**MUST-READ:** [fix-log-contract.md](references/fix-log-contract.md) before resolving targets, evaluating dry-run, writing `session_changes`, or recovering an in-progress fix log.
**MUST-READ:** [execution-branches.md](references/execution-branches.md) before executing Branch A/B/C/D/E/F fixes.

Reuse the target/storage context bound before maintenance, cache `target_project` in `session_changes`, emit the pre-write banner, and honor the dry-run halt. Then initialize the fix log and apply each approved fix by evidence-driven branch selection. Every branch must preserve root-cause verification, write-intent consumption where required, scoped edits, prevention mechanism selection, and accurate `changes_summary` logging as specified in the references.

When `lifecycle_context` is present, initialize `session_changes.lifecycle_context` before the first fix-log write, load the lifecycle record for investigator context, and apply only schema-backed write-back fields per the reference (treating `rca_status` not-started/draft as investigation-first). When `dangerously_auto_apply_confirmed == true`, initialize `session_changes.dangerously_auto_apply`, tag each dangerous-route `changes_summary` entry, and emit the loud `DANGEROUSLY AUTO-APPLIED <N> fix(es)` audit banner at the end of Step 5 (with `0` if no fix was bypassed). The lifecycle write-back rules + GitHub-sync/validate helpers and the dangerous-audit banner contract are in [execution-branches.md](references/execution-branches.md) — read it before any lifecycle write-back or dangerous-route apply.

### Step 5.4: PRE-WRITE-VALIDATE — deterministic embedded-content checks

**MUST-READ:** [write-intents-and-prewrite-validation.md](references/write-intents-and-prewrite-validation.md) before running Step 5.4.

Run deterministic checks for every approved write intent with required or missing detector assertions before the host write primitive. `jq-parses`, `schema-coherence`, and `line-cite-valid` failures halt and re-route for re-authoring; never bypass required assertions without an explicit valid user approval record.

### Step 5.5: Fix-bundle coherence pass (orchestrator-side, advisory)

**MUST-READ:** [mechanical-verification-checks.md](references/mechanical-verification-checks.md) before post-write mechanical verification.

Run the fix-bundle coherence pass after per-finding fixes and before verifier dispatch. Warnings are advisory but must be logged into the fix log for verifier input.

---

### Step 5.6: FIX-LOG HYGIENE — Mechanical Assertions

**MUST-READ:** [mechanical-verification-checks.md](references/mechanical-verification-checks.md) before Step 6.

Check `changes_summary` coverage, modified/created-file consistency, status, cycle count, and required entry fields exactly as the reference specifies. Halt only on corrupted `cycle_count < 1`; otherwise append warnings and continue to verifier dispatch.

---

### Step 5.6.5: Cycle-N+1 mandatory sibling-surface grep (AC-X3)

**MUST-READ:** [mechanical-verification-checks.md](references/mechanical-verification-checks.md) when `cycle_count >= 2`.

Run sibling-surface grep for original strings from the prior cycle and surface surviving sibling matches as warnings/sub-findings.

---

### Step 5.7: ORCHESTRATOR EXECUTION — Run New Verification Code

**MUST-READ:** [mechanical-verification-checks.md](references/mechanical-verification-checks.md) before executing new verification code.

When enabled by config/flag, execute newly-authored verification code with path-safety checks, timeout handling, captured execution evidence, nonzero-exit warnings, and immediate atomic fix-log persistence.

When a newly-authored verification method is claimed as recurrence prevention, Step 5.7 must read and preserve the Step 4.6 `red_green_evidence` object. If the pre-fix failure evidence is absent, wrong-reason, or only reconstructed from memory, downgrade the entry to `red_green_evidence.claim: "verification-only"` before verifier dispatch. `execution_evidence.command_argv` records the exact command arguments used for the post-fix execution path.

---

### Step 6: VERIFY — Scoped Re-Verification

**MUST-READ:** [verifier-dispatch.md](references/verifier-dispatch.md) before Step 6 verifier dispatch, same-agent verification fallback, result parsing, or convergence handling.

Compile verification context from the `session_changes` log rather than git, dispatch the scoped verifier with target-project anchoring, enforce the same-agent-verification exclusions, parse resolver/regression outcomes, queue calibration records, and enforce the convergence gate after bounded verification loops. Do not attempt a 4th fix cycle without explicit user direction.

When a predecessor review is linked, Step 6 must carry each predecessor finding's `runtime_evidence` outcome into the verifier prompt summary. Missing or refuted runtime evidence on UI/rendered-DOM findings does not block source-level verification, but any READY_TO_MERGE conclusion is source-coherent only and should include the runtime-evidence advisory from `verifier-dispatch.md`.

### Step 6.5: Outer-loop reverse-chain (NEW Stage 4 dev.113)

**Fires ONLY after Step 6 produces a verify-PASS result with no regressions.** This step checks whether the outer-loop should continue, has converged cleanly, or has hit a termination condition.

**MUST-READ:** [`references/outer-loop.md`](references/outer-loop.md) before running Step 6.5 — it points to the canonical home (`.aivv/outer-loop.md`) for the full phase algorithm: the OUTER_LOOP_MIN_DEV constant, the `outer-loop-<root_review_id>.json` state schema, the no-progress algorithm (SHA-1 of sorted finding signatures), the 5-banner termination matrix, the Skill-tool reverse-chain invocation form, the pre-dispatch canary procedure, and the capability-unavailable degradation.

Execute the reference's phases in order:
- **Phase A — preconditions:** no-op + proceed to Step 7 when `outer_loop_mode != "until_clean"` or `--dry-run`; on `can_invoke_peer_skill` unavailable, emit the capability-unavailable banner, set `capability_degradations: ["outer_loop_reverse_chain_unavailable"]`, and halt.
- **Phase B — canary probe:** assert the `marketplace.json` `dev.NN` ≥ OUTER_LOOP_MIN_DEV before dispatch; halt with the version banner on failure.
- **Phase C — load state + continuation subset:** read/initialize the state file; let K = count of verify-pass `fix-now`/`investigate-first`, non-L1, non-POLISH findings (legacy `severity ≥ outer_loop_severity_floor` fallback).
- **Phase D — CLEAN exit (K == 0):** when `outer_cycle_count ≥ 1`, emit the CLEAN banner (+ L1-regression banner if applicable), delete the state file, proceed to Step 7; when `outer_cycle_count == 0`, no-op to Step 7.
- **Phase E — cap (K > 0):** halt with the Cap-reached banner when `outer_cycle_count ≥ outer_loop_max_cycles` (leave state file).
- **Phase F — no-progress (K > 0, under cap):** halt with the no-progress banner when `outer_cycle_count > 1` and the current fingerprint equals `last_fingerprint` (leave state file).
- **Phase G — reverse-chain (K > 0, under cap, progress):** increment `outer_cycle_count`, write state atomically, then invoke the reverse-chain Skill tool:
  ```
  Skill tool:
    skill: "aivv:aivv"
    args: "--fix --outer-cycle=<new_count> --root-review-id=<root_review_id> [--target=<dir>] [--dry-run]"
  ```
  where `<new_count>` is the post-increment value written to state.

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

**MUST-READ:** [document-and-calibration.md](references/document-and-calibration.md) before writing the predecessor backfill or any calibration record. It is the canonical home for the `fix_invocation_id` write-back + `source_review_id` persistence + bidirectional ID-coverage contract (with the `jq` write-back recipe) AND the calibration JSONL append field-specs below. Do not improvise the backfill recipe or the calibration record fields.

**Step 7.8: Optional post-fix HTML viewer hook**

**MUST-READ:** [viewer-hook.md](references/viewer-hook.md) when review/fix viewer behavior is enabled.

After Step 7 completes the fix log and review-log backfill, render the joined review/fix HTML report only when the reference conditions match. Viewer behavior is post-state-write and non-blocking; it is not a substitute for verification.

2. **Calibration**: For false positives (`already-correct` verdicts), and for the `false_negative` / `bad_fix` / conditional `review_meta` / `pending_calibration` / challenger-outcome / `challenge_budget_exhausted` records, append the appropriate single-line JSON record to this invocation's per-invocation shard `<calibration_dir>/<lens>/<invocation-id>.jsonl` via the host read-modify-write pattern (per-invocation sharding contract). Skip under `--dry-run`. See the **MUST-READ** [document-and-calibration.md](references/document-and-calibration.md) for the per-kind field specs, the `review_meta` de-dup contract, the lens-file path resolution, and the `fix_confidence_distribution` addition. Use the shared storage mutation helper for publication.

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
- **Restricted context (no edit capability)**: Stop immediately, explain that `/aivv-fix` needs the host's edit facility (Claude Code: `Edit`/`Write`; Codex: `apply_patch`).

### `--review-id` failure modes (Task 6 / Step 1.05)

| Code | Exit | Meaning |
|---|---|---|
| `REVIEW_NOT_FOUND` | 2 | review-`<id>`.json absent from resolved external state/archive and bounded historical sources |
| `REVIEW_CORRUPT` | 3 | review log JSON parse fails |
| `REVIEW_TARGET_MISMATCH` | 4 | review's `target_project` != current target |
| `REVIEW_STALE_PATHS` | per-finding | file-backed `file` field no longer exists at fix-application time |
| `REVIEW_SCHEMA_NEWER` | 6 | review log `schema_version` exceeds supported max |
| `REVIEW_NO_FINDINGS` | 0 | review log has empty `findings` array — clean exit |
| `EVIDENCE_ONLY_HANDOFF` | info | review was `evidence_only_review`; file-clustering skipped |
| `same_agent_review` warning | info → user-confirm | review was non-independent; user must confirm to proceed |
