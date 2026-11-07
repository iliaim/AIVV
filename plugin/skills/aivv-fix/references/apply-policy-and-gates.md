# Step 4 apply-policy decision queue, pre-execution gates, and fix_confidence

Detail relocated from `skills/aivv-fix/SKILL.md` Step 4 PLAN. The inline skeleton keeps field propagation, the special-verdict triggers, and the auto-proceed precheck (with its grepped invariant strings). This reference is the canonical home for the investigation-results presentation template, the architectural-remediation lane render + fail-closed contract, the batch-reconciliation cross-batch collision check, the W10 batched apply-policy decision queue (route classification + the "Fix Decisions Needed" surface + dangerous-bypass route), the pre-execution Gate 1/2/3 mechanics, and the `fix_confidence` computation ladder.

Cross-step ordering and final route boundaries are owned by [execution-decisioning.md](execution-decisioning.md). Keep route labels and bypass limits synchronized there before changing this file.

## Investigation-results presentation

After each investigator JSON response is integrated into the structured summary below, mark that investigator handle `output_consumed: true`. Close consumed investigator handles before any Step 3 re-entry, including re-investigation caused by Step 4.5 or Step 6. If immediate targeted follow-up is required, use the Step 3 exception and leave `output_consumed: false` until the follow-up is integrated.

Collect all investigator JSON results and present a structured summary:

```
## Investigation Results

### F001 [CRITICAL] — SQL injection in api/routes.py:45
**Root cause**: {root cause from 5 Whys}
**Confidence**: {high/medium/low}
**Similar patterns found**: {N locations}
**Proposed fix**: {strategic fix description}
**Prevention**: {for `none-new`: mechanism + rationale + evidence-bounded description; otherwise: mechanism + eligibility basis/evidence + enforcement level}
**Verdict**: {fix-required / already-correct / clarification-needed / wont-fix}

### F002 [MAJOR] — Missing validation in api/routes.py:87
**Shared root cause with F001**: {shared root cause description}
...

---

**Summary**:
- {N} findings requiring code fixes
- {N} false positives (investigator determined code is correct)
- {N} clarification-needed (resolved by explanation)
- {N} wont-fix (documented, user decides)

Proceed with fixes?
```

## Architectural remediation lane

**Architectural remediation lane:** After integrating investigator JSON, merge the seed assessment with `root_cause_analysis.architectural_remediation_check`.

Final `required` is true when seed `required` is true, the investigator sets `architectural_remediation_check.triggered: true`, or `sibling_surface_scan[]` confirms the same design-decision contract with a manual sync invariant.

When final `required` is true, Step 4 must render:

- architectural remediation status
- immediate root cause and class root cause
- local option
- architectural option
- recommended option and rationale
- why the recommendation is not merely a symptom patch
- sibling surfaces checked and deferred
- an `Architecture Decision Needed` surface with route choices and consequences

Fail closed before Step 5 when final `required` is true and the check is missing or malformed: missing local option, missing architectural option, missing or empty sibling scan, missing `alternative_approaches[]` mapping, invalid `decision_route`, invalid `blast_radius`, duplicate option IDs, or `recommended_option` not matching an option ID. Also fail closed when seed `scan_required` is true but the investigator omits a structured negative scan/disproof. If that omission is a specific investigator-output defect with a concrete in-scope repair, targeted re-investigation may consume one `architecture-check` retry from the shared `rework_retry_count`; at the cap, report the finding unresolved. A challenger concern may also identify a specific actionable defect and use the same shared budget. Never downgrade malformed architecture evidence to ordinary routing or move it to a new authorization prompt. Stage-specific class-verdict and cycle counters are diagnostic only.

## Batch reconciliation (pre-execution cross-batch collision check)

**Batch reconciliation** (pre-execution cross-batch collision check):

Before applying the auto-proceed precheck, reconcile batches by fix-time file impact:

1. Collect each batch's declared `files_to_modify` from the investigator JSON responses (see [investigator-output-example.md](investigator-output-example.md) and [investigator-field-definitions.md](investigator-field-definitions.md) for `fix_proposal.files_to_modify`).
2. Compute overlap: two batches collide if their `files_to_modify` sets intersect on any path.
3. **If no collisions**: proceed silently to the auto-proceed precheck below. No user-visible update — Step 2c's provisional batches stand.
4. **If collisions exist**: merge every set of colliding batches into unified batches. Re-present an updated triage table to the user with a `[RECONCILED]` marker on each merged batch and a one-line explanation, for example:
   > *"Batch 1 (F001) and Batch 2 (F002) both modify `src/core/validation.py`; merged into Batch 1+2 to prevent parallel fixes from overwriting each other."*
5. After presenting, re-evaluate Step 4's auto-proceed precheck on the reconciled batch set.

**Rationale**: Step 2c batches by finding-location (where issues were reported). Investigators propose fixes that may touch files the findings didn't originally name. Catching cross-batch file collisions *after* investigation but *before* execution prevents parallel fixes from clobbering each other. The fields to reconcile on (`fix_proposal.files_to_modify`) already exist in the investigator JSON schema.

## W10 batched apply-policy decision queue

**W10 batched apply-policy decision queue:**

Before Step 5, classify every remaining approved finding into exactly one apply-policy route:

- **Auto-eligible**: the resolved category policy is `auto`, `fix_confidence` is `high`, Step 4.5 CHALLENGE did not require unresolved REVISE/REJECT handling, every new prevention mechanism received Axis 9 APPROVE with a valid `eligibility_basis` and non-empty concrete `eligibility_evidence`, the finding is not L1-source/manual-review-gated, the fix has no high-blast-radius/shared-interface pause, every improvement has an explicit non-invasive `effort`, all write intents are inspectable and fresh, and the finding has no unresolved trade-off or context-shaped confidence gap.
- **Decision queue**: resolved category policy is `ask`; policy is `skip` but a safety floor requires visibility; `fix_confidence` is `medium` or `low` without an adversarial second-opinion path that raised it to high; the investigator surfaced alternative approaches/trade-offs; the fix touches a shared interface or >3 files; the finding is L1-source/manual-review-gated; improvement effort is missing or invasive; or severity/disposition floors require user visibility. Missing-effort and invasive improvements default to `defer-with-rationale` and are never Auto-eligible, including under explicit `improvement=auto` or `--apply-all-polish`.
- **Architecture decision queue**: final `architectural_remediation_assessment.required == true` and route is `decision_queue`, `architectural_separate_effort`, `architectural_apply_now` without explicit architecture-specific user approval, or `tactical_apply_now` while residual class-root-cause risk remains; or seed `scan_required == true` but the investigator did not provide structured disproof. A `tactical_apply_now` route may proceed only when the selected local option removes the class root cause; `ordinary_route` is allowed only when final assessment proves class-root-cause risk is absent or a weak scan is structurally disproved.
- **Skipped by policy**: resolved category policy is `skip` and the finding is below the safety floors (`recommended_next_step` is not `fix-now`/`investigate-first`, legacy severity is below CRITICAL/MAJOR, not active-containment, and not L1-source/manual-review-gated). Record the skip in Step 7 rather than silently dropping it.

Then render ONE aggregated decision surface for all findings in the decision queue, grouped by concrete reason:

```text
## Fix Decisions Needed

| ID | Category | Reason | Proposed action |
|----|----------|--------|-----------------|
| F004 | improvement | policy asks before improvement fixes | Remove duplicate helper in src/foo.ts |
| F006 | design-flaw | touches public API + 5 files | Choose localized adapter or broader API migration |
| F009 | documentation-gap | low confidence: needs product intent | Should empty names be rejected or normalized? |
```

Prompt once for the batch, with action-specific choices such as `apply selected`, `skip selected`, `defer selected`, or a named trade-off option. Do not emit one generic yes/no prompt per finding.

Severity/disposition invariant: `fix_apply_policy.* = skip` cannot suppress CRITICAL/MAJOR defects, findings with `recommended_next_step ∈ {fix-now, investigate-first}`, active containment candidates, or L1-source/manual-review findings. These remain in the decision queue or the Step 2.5 containment prompt. `clarification-needed` is not directly fixable and always routes through the decision queue or Branch E explanation path.

Default binding: absent `fix_apply_policy` resolves from the golden schema default: defect categories are `auto`, while `improvement` and `clarification-needed` are `ask`. Schema-default `auto` still lands only through the Auto-eligible route above, and every medium/low-confidence or consequence-gated finding goes to the decision queue.

**Dangerous bypass route (`--dangerously-auto-apply`):** when `dangerously_auto_apply_confirmed == true`, findings that would otherwise enter the W10 decision queue are marked `dangerously-auto-approved` for Step 5 instead of prompting, except invasive improvements, which remain deferred pending an explicit per-finding apply decision. For each eligible finding, record the exact bypass reasons from the normal classifier (`CHALLENGE`, `L1-source/manual-review`, `high-blast-radius`, `low-confidence`, `batched-decision`, or any concrete trade-off reason) before execution. This route is intentionally broader than Auto-eligible, but it still cannot write without inspectable fresh write intents and cannot override unsupported-risky-path or dry-run halts. If the flag was requested but not confirmed, ignore the bypass and use normal routing. Architecture-required findings are not silently converted to ordinary tactical work by `--dangerously-auto-apply`. If final `architectural_remediation_assessment.required == true`, the bypass can proceed only when explicit architecture-specific user approval is recorded with the chosen `architecture_decision_route`; otherwise the finding remains in the decision queue.

## Pre-execution gates for uncertain or overconfident findings

**Pre-execution gates for uncertain or overconfident findings** (apply before the auto-proceed precheck below):

> **Gate 1 vs Step 4.5 — defense-in-depth (no behavior change):** Gate 1 fires before the auto-proceed precheck and challenges the *root cause* via the investigator role (adversarial second investigator on CRITICAL+high-confidence). Step 4.5 CHALLENGE fires after write-intent materialization and before any execution decision, challenging the *fix plan* via the reviewer role. Both can fire on the same finding — Gate 1 first, then Step 4.5 sees the reconciled root cause + exact proposed write-intent snapshot. This is intentional layering: root-cause challenges are cheaper when the investigation can be re-run; fix-plan challenges are most useful when proposed bytes are available and still cheap to revise.

> **`unable-to-verify` short-circuit for `documentation-gap` findings:** If a `documentation-gap` finding's investigator output has `verification_method: unable-to-verify` (or `verification_evidence` is empty/whitespace, treated as `unable-to-verify`), this finding bypasses gates 2 and 3 entirely and routes directly to Branch E with `CLARIFICATION_NEEDED:empirical_verification_required`. Apply this short-circuit per-finding BEFORE evaluating gates 1–3. Rationale: the gap is empirical root-cause verification, not codebase scanning or user intent — neither gate response path applies.

1. **Action-driving + high-confidence → adversarial second opinion**: Any finding with `recommended_next_step ∈ {fix-now, investigate-first}` where the investigator returned `confidence: high` auto-spawns a second `aivv:investigator` agent with an adversarial framing prompt: *"Challenge this root cause. What alternative explanations could produce the same symptom? What evidence would distinguish them? Is the proposed fix addressing the correct cause, or is there a more upstream cause that would also produce this symptom?"* Pass the first investigator's root cause and fix proposal as input. Legacy findings without `recommended_next_step` use the previous CRITICAL fallback.
   - If the second investigator agrees: proceed.
   - If the second investigator disagrees: present both analyses to the user as a contradiction; do not auto-proceed.
   - Second-opinion investigator handles follow the same lifecycle: track `batch_id`, `role`, `dispatch_path`, and `output_consumed: false`; mark consumed after the gate decision integrates the second opinion, then close before continuing.
   - Rationale: "confidently wrong on a CRITICAL" is the most dangerous failure mode; one extra agent call on CRITICAL findings is cheap insurance.

2. **Low-confidence, context-shaped gap → ask the user directly**: If `confidence: low` AND `confidence_gap_shape: context-shaped`, phrase the `confidence_gap` as a concrete question to the user (e.g., *"Should save_task treat empty-string and null as equivalent, or is null supposed to be filtered upstream?"*) and pause. Do not spawn a second investigator — the gap is in user knowledge, not code reading. Cheaper than a subagent call and usually faster for the user.

3. **Low-confidence, code-shaped gap → adversarial second opinion**: If `confidence: low` AND `confidence_gap_shape: code-shaped`, auto-spawn a second `aivv:investigator` with a scope directive derived from the gap (e.g., *"Focus the investigation on the full lifecycle of X across all files touching it"*). If the second investigator reaches high or medium confidence, merge results and proceed. If it also returns low-confidence, escalate both analyses to the user.

> **Note on overlap with Auto-proceed rule below**: A finding that a Pre-execution gate has already handled (paused to user, or merged with second-investigator results) is considered *resolved at the gate* — the "Low-confidence proposals" auto-proceed exception does NOT re-fire for the same finding. If the second investigator raised confidence to medium or high, the finding is no longer low-confidence and the exception does not apply. If the gate escalated to the user, the user's decision takes precedence.

## `fix_confidence` computation (per approved finding, computed here — consumed by Step 4.5)

After Gate 1/2/3 resolves and before evaluating the Step 4.5 trigger, compute `fix_confidence` per approved finding:

```
fix_confidence = "high"
demote_one_tier_if(investigator.confidence == "medium")      // high → medium
demote_to_low_if(investigator.confidence == "low")           // high → low (floor immediately)
demote_one_tier_if(is_l1_source(finding))                    // L1-source per existing regex; bare citation still reduces fix-confidence even when legal applicability affects batch-refusal
demote_one_tier_if(fix_proposal.files_to_modify.length > 2)
demote_one_tier_if(touches_shared_interface(fix_proposal))   // API, auth, schema, migration
demote_one_tier_if(authors_new_verification_code(fix_proposal))
demote_one_tier_if(class_signature_present(finding))
demote_one_tier_if(scope_search_seed_present(finding))
demote_one_tier_if(predecessor_finding_match)                // this finding maps to a prior round's finding
demote_one_tier_if(architectural_remediation_assessment.required || architectural_remediation_check.triggered)
```

Demotion is one-way (`high → medium → low`); floor at `low`. Each predicate fires AT MOST once per finding. The `demote_to_low_if` form floors at `low` immediately (two-tier shortcut), used only for the `investigator.confidence == "low"` predicate.

**`predecessor_finding_match` predicate:** when `predecessor_review_id` is set on the current session, the orchestrator compares each finding's `summary` + durable location (`file` or `scope_ref`) against findings from the predecessor review log. Resolve that id through shared `list --area state --prefix review- --archive` with the cached context, apply the active-before-archive duplicate rule, and `read` its exact selected relative path; never reconstruct a root-only path. If a finding matches a prior-round finding (same file-backed location, or same `scope_ref.kind` + `scope_ref.ref`, with overlapping `summary` keywords), `predecessor_finding_match: true` is set on the finding object. Used to trigger Step 4.5 on recurrent findings and to demote `fix_confidence` (a finding that recurred across rounds despite a prior fix attempt has lower fix confidence).

**Architectural remediation predicate:** fires only for final required cases, investigator-triggered checks, or unresolved weak scans that lack structured disproof. Weak `scan_required` hints that the investigator disproves do not demote confidence.

**`touches_shared_interface` predicate:** matches any `files_to_modify` path against the regex `(api/|auth/|middleware/|schemas?/|migrations?/|interfaces?/|public-api/)`. Configurable per project via user-preferences (`shared_interface_patterns: [...]`).

**`authors_new_verification_code` predicate:** `files_to_modify` contains any file matching `(\.github/workflows/|\.husky/|scripts/.*\.(sh|mjs|js|ts|py)$|tests?/.*verif.*|ci\.(yml|yaml)$)` OR `fix_proposal.description` mentions "verification script", "CI gate", "build check", or "smoke test".

**Persistence:** `fix_confidence` is recorded on every `session_changes.changes_summary[]` entry and in the `review_meta` calibration record. Schema: `fix_confidence` field is declared in `.aivv/schemas/fix-log.json` under `changes_summary.items.properties` (optional string, enum: high|medium|low); `fix_confidence_distribution` is declared in `.aivv/schemas/calibration.json` under the `review_meta` discriminator as an optional object with `{high, medium, low}` integer counts.
