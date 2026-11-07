# Fix Log Contract

Read from `skills/aivv-fix/SKILL.md` before writing or recovering `session_changes`.

## Contents

- Target resolution and dry-run gate
- Session log schema
- Atomic full-object write semantics
- Recovery on re-invocation

### Step 5: EXECUTE — Apply Approved Fixes

Every new fix log carries the immutable `authorized_scope` snapshot captured at
Step 1.9 and these shared retry fields:

- `rework_retry_count`: starts at 0; increments once before each semantic
  re-authoring or verification re-entry.
- `max_rework_retries`: fixed at 3 for the invocation.
- `rework_retry_history`: append-only entries with retry number, gate, affected
  finding IDs, evidenced defect, and evidence locator.

Before each durable full-object update, validate the candidate against the exact
prior persisted fix log using the invocation's `storage_context_file`. The first
write uses `--new`; every subsequent write uses `--update`, which reads the live
prior log through `storage-paths.mjs` under its read lock. The validator requires
the same invocation ID and structurally identical `authorized_scope`, a
nondecreasing retry count that can advance by at most one, and an unchanged
append-only history prefix. A legacy
in-progress log without this baseline cannot be resumed as if its retry count
were zero; stop that resume and offer a fresh top-level invocation from the
original selected findings.

`authorized_scope` contains the source, goal, selected finding IDs, included
boundaries, and exclusions. Copy it byte-for-byte through updates. Stage-specific
counters cannot create separate retry budgets. The transition validator requires
each `cycle_count` increment to occur in the same update as one new `verification`
retry event, and rejects decreases or jumps. Historical logs may omit additive
fields; current writers may not.

The fix-log validator also checks every actionable finding reference against
`authorized_scope.finding_ids`, including retry entries, write intents, changes,
plans, verification records, dispositions, and lifecycle context. It permits
only the selected ID itself or the documented derived IDs `<parent>-cls<N>`,
`<parent>-cls-overflow`, and `<parent>-sib<N>` for a selected parent. A candidate
cannot keep the original scope snapshot while silently replacing a selected
finding with an unrelated ID; correct the candidate inside the authorized
selection or leave that work unresolved.

Record explicit file/directory limits as canonical target-relative paths in
`authorized_scope.included_paths` and `authorized_scope.excluded_paths`;
descriptive summaries remain in `included` and `excluded`. Empty
`included_paths` means there is no narrower explicit inclusion. When it is
non-empty, every write intent, planned file, recorded change, and modified or
created file must match one listed path or descendant. Any target matching an
excluded path or descendant halts validation. Finding locations alone do not
create path boundaries. Do not use globs; a single dot denotes the target
project root, and every other entry must be a project-relative path without
`..`.

For `source: "review_id"`, retain `source_review_relative_path` from the exact
review selected during Step 1.05, including an `archive/` prefix when applicable.
Before a fix-log write or update, the validator reads that exact source through
the storage helper, checks that its `id` matches `source_review_id`, and checks
that every selected root finding exists in the source review. Keep the source
ID and relative path immutable through the fix invocation.

**Change Readiness Gate:** after Step 5.0 target resolution, pre-write banner, dry-run handling, and fix-log session initialization; after write intents and any Step 4.5 challenge; but before any Step 5 write dispatch, record `change_readiness` for every applied non-dry-run fix log.

Trivial fixes still record readiness. They normally use `risk_tier: "low"` and `approval_mode: "auto"` only when W10 classifies them as auto-eligible and no consequence gate applies.

For every applied non-dry-run fix, buffer `change_readiness` into the initialized `session_changes` object and persist it in the eventual fix log:

```json
{
  "risk_tier": "medium",
  "affected_surfaces": ["code", "public-api"],
  "approval_mode": "user-confirmed",
  "rollback_plan": "Revert README.md and rerun bash tools/validate.sh",
  "required_verification": [
    {
      "id": "evreq-F001-validate",
      "kind": "command",
      "command_argv": ["bash", "tools/validate.sh"],
      "required": true
    }
  ],
  "generated_verification": {
    "present": false,
    "execution_allowed": false,
    "policy": "inspect-only"
  },
  "monitoring_plan": "No runtime monitoring required for documentation-only change.",
  "go_no_go": "go"
}
```

Hard approval rules:
- `risk_tier: "high"` must not use `approval_mode: "auto"`.
- Security-sensitive, L1-source/manual-review, generated-verification, auth, schema, migration, CI/build, public API, shared-interface, or high-blast-radius fixes must use `user-confirmed`, `dry-run`, `dangerous-override`, or `skipped`.
- `dangerous-override` is valid only when the existing `/aivv-fix --dangerously-auto-apply` confirmation path has already satisfied its fail-closed rules.
- Non-interactive consequence-gated fixes cannot be upgraded to write-capable execution by readiness. They halt or route to dry-run.

Before any write dispatch, render:

```text
[aivv-fix] readiness: high risk; auth + public-api; W10 route: decision queue
Rollback: revert files X/Y and rerun validate
Required evidence: evreq-F001-validate, evreq-F001-verifier
Generated verification: present; inspect-only
Choice: approve writes | dry-run only | revise plan | stop | defer
```

`stop` exits without adding a finding disposition. `defer` records a durable `deferred` final disposition with rationale and reopen trigger in `final_dispositions[]`.

**Step 5.0 — Target resolution + pre-write banner (FIRST action in Step 5):**

Before any state mutation, reuse the context bound before maintenance per
[`.aivv/target-resolution.md`](../../../.aivv/target-resolution.md). Cache its
canonical target in `session_changes.target_project`; do not infer a new target
from findings at Step 5. Normalize findings to this base without changing their
absolute referents. Preserve differing policy lookup provenance additively.
Emit the shared pre-write banner and honor `AIVV_QUIET=1`.

All state paths use `<state_dir>`, and calibration uses `<calibration_dir>` from
the cached external context. Never rename or backfill legacy originals; import
explicitly before continuing their mutable workflows. Publish staged candidates
through the shared storage mutation helper so import cannot race writes.

**Dry-run gate:** if the invocation included the `--dry-run` flag, HALT here. Do NOT apply any fixes, do NOT create a session log, do NOT dispatch the verifier in Step 6, do NOT write calibration records in Step 7. Emit a dry-run report to the user:

```
## Dry-run Complete — No Fixes Applied

Investigation results have been presented above (Step 4). If the plan looks good:
- Re-run `/aivv-fix` WITHOUT `--dry-run` to apply fixes
- Or re-run with a narrower argument (specific task ID or literal finding) to scope down

Nothing was written to disk. Session log, fix changes, verifier dispatch, and calibration writes are all skipped in dry-run.
```

If `--dangerously-auto-apply` was confirmed on the same dry-run invocation, add this block before the final "Nothing was written" sentence:

```text
## Dangerous Auto-Apply Preview

Would dangerously auto-apply: <N> finding(s)
Confirmation source: <interactive-exact-phrase | env:AIVV_DANGEROUSLY_AUTO_APPLY>

| ID | Category | Bypassed gates/reasons | Proposed action |
|----|----------|------------------------|-----------------|
| F006 | design-flaw | high-blast-radius; batched-decision | Update public API adapter |
```

Use the same dangerous-route classification that Step 4 assigned before the dry-run halt. If `<N>` is zero, still emit the block with `0` so the run log shows that the bypass was armed but did not affect any finding.

Then terminate the skill (do NOT proceed to Steps 5 sub-items, 6, or 7).

**Non-dry-run session initialization:** after the dry-run gate has passed, initialize the fix-log session object before any readiness prompt or write dispatch. The initialized object buffers `change_readiness` decisions and persists them in the eventual fix log using the atomic full-object write semantics below.

**Fix lifecycle audit fields (optional, non-dry-run only):** after the dry-run gate has passed, the initialized fix-log may include `fix_plans[]` and `verification_cycles[]` as additive lifecycle metadata. `fix_plans[]` records proposed or approved remediation plans and alternatives; it does not imply that a change was applied. Even `status: "applied"` means only that the selected plan reached write dispatch/execution; durable applied-change truth still requires a matching `changes_summary[]` entry. `changes_summary[]` remains the source of truth for applied changes. `verification_cycles[]` records scoped verifier outcomes after execution. `/aivv-fix --dry-run` must not write a fix log or persistent `fix_plans[]`; dry-run plans are preview output only unless a future reviewed contract explicitly changes that no-write rule.

#### Step 5 pre-loop: class-verdict gate (FAIL-CLOSED) + variant scan + class-sibling triage

Before the scope_search_seed pre-loop, enforce the mandatory class verdict on the approved findings, scan for class siblings, and triage them. This is the class-breadth counterpart of the scope_search_seed pre-loop: `scope_search_seed` answers *which other files need the same change* (scope breadth); `class_signature` answers *which other locations have the same bug* (class breadth). Both pre-loops run before any per-finding fix branch; the class-verdict gate runs first because a finding without a verdict is not ready for either scan.

The execution-shape contract below (pattern interpretation, target scoping, argv tokenization, own-locator exclusion, time budget) is shared by step 3's `searched_pattern_negative` execution AND step 4's `class_signature` variant scan — they are the same grep machinery pointed at different patterns.

**Shared scan-execution contract (load-bearing — applies to both grepped patterns):**
- **Pattern interpretation:** treat the emitted pattern as a POSIX basic-regular-expression for `git grep` (its default). The investigator is instructed to emit a grep-pattern; if a finding needs a literal containing regex metacharacters, the investigator escapes them (the `parseDeadline\(` example escapes the paren). Do not silently switch interpreters per pattern.
- **Target scoping:** scan `session_changes.target_project` (the path resolved at Step 5.0), never the AIVV plugin tree. Pass it as the `git grep` pathspec.
- **Argv tokenization:** invoke the grep through the host's argv-array form with the pattern as a single discrete argument — never f-string-concatenate the pattern into a shell command line. A pattern containing a quote, `$`, or backtick must not be able to alter the command. (Same hardening rationale as the fingerprint heredoc-stdin pattern.)
- **Own-locator exclusion:** run `git grep -n '<pattern>' -- <target>` (line-numbered) and exclude the finding's own `<file>:<line>` locator from the match set — NOT the whole `<file>`. Excluding the entire file would blanket-drop intra-file siblings (a second instance of the class at a different line in the same file is a real sibling). When the finding carries only `<file>` and no `line`, fall back to whole-file exclusion and note `own-locator-coarse` in the scan record. Fallback when not in a git repo: `grep -rn '<pattern>' <target> --exclude-dir=.git --exclude-dir=node_modules`.
- **Time budget:** bound the scan per finding; on timeout record `class-scan-timeout` (with the partial match set) and route the finding to the decision queue rather than silently reporting zero.

**Gate scope — top-level findings only.** The verdict gate (steps 1–3) applies to **top-level approved findings**. Expanded-scope sub-findings emitted *by* this pre-loop or the scope_search_seed pre-loop — `<parent>-cls<N>`, `<parent>-cls-overflow`, `<parent>-sib<N>` — are **exempt from the verdict gate**: they inherit their parent's verdict context and are scope expanded within the same cycle, not independently-investigated findings. Applying the gate to them would re-investigate every sibling and defeat the pre-loop. (A `-cls<N>` is, by construction, a *confirmed instance of the parent's class* — the parent already carries the verdict.)

For each approved **top-level** finding whose `category` is `code-bug` or `design-flaw`:

**Authorized-scope gate for discovery:** Before a `class_signature` or
`scope_search_seed` scan, resolve the permitted paths from the immutable
`authorized_scope` snapshot. If the source request authorized the target project,
that root may be included; otherwise honor its narrower file/topic boundaries.
Filter candidate paths before reading or dispatching sibling triage. Never read
or write an excluded path. Do not emit or fix a discovered sibling outside the
recorded boundary; report it as an out-of-scope observation only when its
existence is already known from in-scope evidence. This gate overrides broad
search examples below.

1. **Verdict presence (fail-closed).** If the finding has neither a non-empty `root_cause_analysis.class_signature` nor a valid `root_cause_analysis.class_assessment`, the verdict is **missing**: do not fix the finding on this pass. A targeted re-investigation is allowed only if the shared invocation-wide `rework_retry_count` has room; append a `class-verdict` retry event before re-entering Step 3. At the cap, report the finding unresolved with reason `rework-retry-budget-exhausted`; do not move it to a new decision queue or ask to reopen scope. This pre-execution re-entry consumes the same three-retry budget as challenge, pre-write, stale-intent, red-green, and verifier rework. Exempt categories — `improvement`, `documentation-gap`, `clarification-needed`, `process-violation` — are skipped by the class-verdict gate; if one emits a `class_signature`, it still flows through the variant scan in step 4.

2. **`class_assessment` completeness (fail-closed).** A `class_assessment` is valid only when it is a JSON object carrying all three sub-fields: `self_contained == true` (the literal boolean), a non-empty `justification`, and a non-empty `searched_pattern_negative` (non-empty = ≥1 non-whitespace character; whitespace-only or non-string does NOT count). An assessment that is not an object, or has any missing/blank/wrong-typed sub-field, is **not a valid verdict** → treated as missing in step 1 (re-investigation). If a finding emits BOTH `class_signature` and a valid `class_assessment`, `class_signature` governs and the assessment is ignored (per the json-schema.md contract) — proceed to step 4, skip step 3.

3. **Execute `searched_pattern_negative` (verify the self-contained claim — auto-route on falsification).** When a valid `class_assessment` is the governing verdict, run the shared scan contract above with `<pattern> = searched_pattern_negative`. **Zero matches (after own-locator exclusion) → self-contained verified; proceed (no siblings).** **≥1 match → the self-contained claim is FALSIFIED:** record a `self-contained-falsified` warning listing the matched locators, then **auto-route the matched locators into the step-6 triage as the candidate set** (the opt-out is not accepted on a falsified claim). **Critical:** `searched_pattern_negative` was authored to *disprove* a class — it does NOT characterize the bug — so it is used ONLY as the candidate-set source, **never** as the triage judging basis and **never** copied into a `class_signature` field. Triage judges each candidate against the parent finding's **root cause** (see the triage template), exactly as it does for `class_signature`-sourced candidates. Demote the parent's `fix_confidence` to `low` (the self-contained verdict was wrong — a confidence-reducing signal).

4. **Variant scan (`class_signature`).** For each finding with a non-empty `class_signature` (including findings auto-routed from step 3): run the shared scan contract with `<pattern> = class_signature`. **Always record the true distinct-candidate count** in the scan record, even when it exceeds the cap (never silently truncate the count). Distinct candidates = matched `<file>:<line>` locators minus the finding's own locator, minus any already in `fix_proposal.files_to_modify`.

5. **Blast-radius routing (count + contract evidence — count alone never routes to the lane).** Let `cap = class_breadth_triage_cap` (golden config, default 10):
   - **candidates ≤ cap →** triage all candidates (step 6).
   - **candidates > cap AND duplicated-contract evidence present** (the candidates implement the same design-decision contract / share a manual-sync invariant, per the architectural-remediation `sibling_surface_scan` criterion) **→** route the parent to the **architectural-remediation lane**. The orchestrator sets seed signals `architectural_remediation_assessment.required = true`, `architectural_remediation_check.triggered = true`, and `scan_required = true`, then asks the investigator to author the full `architectural_remediation_check` structure (local and architectural options, shaped `sibling_surface_scan[]`, `alternative_approaches[]` mapping, `recommended_option`, `decision_route`, and `blast_radius`). If this is a new investigator pass to repair a specific missing-output defect, consume one shared `architecture-check` retry before dispatch; if no budget remains, report the finding unresolved. Pass candidate locators as scan seeds; the orchestrator does not synthesize the investigator's evidence. This is the class-root-cause case — one structural fix, not N site patches.
   - **candidates > cap WITHOUT contract evidence →** triage the first `cap` candidates (step 6), then list the overflow explicitly and emit one deferred next-cycle sub-finding `{"id":"<parent>-cls-overflow","verdict":"deferred","summary":"<K> additional class_signature candidates beyond cap=<cap>; not silently swallowed","files":[...]}`. Overflow is surfaced, never hidden. Count alone does NOT route to the architectural lane. Remaining candidates may surface in a later user-initiated outer review cycle as fixed candidates leave `files_to_modify`; this is cross-invocation drainage, not permission to reopen the current fix scope. Keep the configured cap at its default unless the project deliberately chooses narrower per-cycle batches.

6. **Class-sibling triage (batched; the `speculative-pattern-projection` guard).** Dispatch a **read-only investigator** (the same read/grep/git tool surface, no write tools) with the [`class-sibling-triage-template.md`](class-sibling-triage-template.md) prompt, **one batched dispatch per parent finding** over the in-scope candidates; this dispatch does NOT increment `cycle_count` (it is in-cycle scope expansion). It reads each candidate site and returns a per-site verdict into `root_cause_analysis.class_sibling_triage[]`: `confirmed` | `false-positive` (+reason) | `ambiguous`. **Missing-verdict fail-safe (enforced, not assumed):** after the pass returns, the orchestrator computes `omitted = candidate_locators \ triaged_locators` and injects a synthetic `{verdict: "ambiguous", reason: "missing-from-triage-output"}` for each omitted candidate before consuming the results — a truncated or partial triage output can never let an unjudged site fall through to auto-fix; it falls toward investigation. Triage is what makes class breadth safe to act on — a grep match is a *hypothesis*, never an auto-fix target (the speculative-pattern-projection anti-pattern: a pattern that *could* exist at the projected site but *does not in fact*). Per-site empirical confirmation against the parent's root cause is mandatory before any sibling is fixed.

7. **Act on triage verdicts:**
   - **`confirmed` →** emit a `<parent>-cls<N>` sub-finding (severity inherits parent; `category: <parent.category>`; `class_sibling_parent: <parent_id>`). It flows through the **existing** schema validation contract `fix_apply_policy` gates and the W10 decision queue exactly like any other finding — no new approval wiring. Its fix MUST be **per-site adapted**, enforced by the write-intent-diff check (see [`write-intents-and-prewrite-validation.md`](write-intents-and-prewrite-validation.md)): a `-cls<N>` write-intent that is a verbatim whole-intent duplicate of the parent's (same `target_file` + `old_string` + `new_string`) is a blind paste, not a per-site fix → HALT as `class-sibling-blind-paste` and re-adapt.
   - **`ambiguous` →** dispatch a full investigator (Step 3) on that site, capped at `ambiguous_escalation_cap` (golden config, default 3) escalations per parent. Beyond the cap, record remaining ambiguous sites as `ambiguous-deferred` with `escalation-budget-exhausted` and surface them (deferred, not dropped). **`ambiguous_escalation_cap == 0`** (that knob's schema minimum) is the supported "never escalate" path: ALL ambiguous sites go straight to `ambiguous-deferred` / `escalation-budget-exhausted` with no investigator dispatch.
   - **`false-positive` →** drop the candidate WITH its recorded reason retained in `class_sibling_triage[]` (the reason is the audit trail that the projection was checked and disproved — the speculative-pattern-projection prevention rule's "broader audit clean" outcome).

8. **Parent confidence demotion (idempotent).** If ≥1 `confirmed` sub-finding was emitted (or step 3 falsified a self-contained claim), demote the parent's `fix_confidence` to `low`. The demotion is **clamped to `low`** — it composes idempotently with any `scope_search_seed` emission demote and with the Step-4.5 presence-ladder `class_signature_present` demote (all saturate at the `low` floor; none underflow). Re-evaluate the Step 4.5 trigger on the expanded batch (the demotion may trigger Step 4.5 on a batch that previously scored all-high).

9. `-cls<N>` and `-cls-overflow` sub-findings do NOT increment `cycle_count` (expanded scope within the same investigation cycle, not a re-investigation due to failure). The scope_search_seed pre-loop below applies the identical no-increment rule to its `-sib<N>` sub-findings.

Warnings (`missing-class-verdict`, `self-contained-falsified`, `class-scan-timeout`, `escalation-budget-exhausted`) are recorded in the session warnings array AND surfaced in the run summary so the operator sees class-breadth activity and its impact each cycle.

#### Step 5 pre-loop: scope_search_seed execution

Before dispatching any per-finding fix branch, scan for multi-SSoT siblings:

For each approved finding with a non-empty `scope_search_seed` field in its `root_cause_analysis`:

1. Run `git grep -rl '<scope_search_seed>' -- <target>` (uses git-ignore semantics). Fall back to `grep -rl '<scope_search_seed>' <target> --exclude-dir=.git --exclude-dir=node_modules` if not in a git repo.

2. For each matched file NOT already in `fix_proposal.files_to_modify`:
   - Emit a sub-finding: `{"id": "<parent_id>-sib<N>", "severity": "<inherits parent>", "category": "code-bug", "summary": "<matched-file>: contains pattern matching scope_search_seed of <parent_id> — may need the same update", "file": "<matched-file>", "scope_seed_parent": "<parent_id>"}`
   - Sub-findings default to MAJOR severity unless the parent was CRITICAL (in which case inherit CRITICAL).

3. Append sub-findings to the approved list. They receive their own `changes_summary` entries.

4. If ≥1 sub-finding emitted: demote the parent finding's `fix_confidence` to `low` (scope-seed discovery is a confidence-reducing signal). Re-evaluate the Step 4.5 trigger on the expanded batch — the demotion may trigger Step 4.5 on a batch that previously scored all-high.

5. Sub-findings do NOT increment `cycle_count` (they are expanded scope within the same investigation cycle, not a re-investigation due to failure).

The seed is required for fixes that change a canonical name, public API, schema key, route/asset ID, prompt/template field, evidence claim, or other source-of-truth token. It is not limited to code registries. The purpose is to catch post-fix sibling artifact drift across docs, schemas, tests, prompt templates, route budgets, and state fixtures before a verifier has to infer missing scope from prose.

For each approved fix (in priority order: CRITICAL first):

1. **Track session changes (in-memory AND persisted to disk)**: Initialize a change log. Reuse the invocation ID bound after runtime preflight and the Step 1.0 recovery decision (format: `YYYY-MM-DDTHH-MM-SS-<4-char-random>`); a valid Resume reuses the persisted ID. Create the persistence file at `<state_dir>/fix-<invocation_id>.json` where `<target>` is the path resolved in Step 5.0 and cached in `session_changes.target_project`. Filename prefix is `fix-`; historical prefixes remain read-only/importable and are never renamed in the project.

   **Schema**:
   ```json
   {
     "schema_version": 2,
     "id": "<fix-id>",
     "command": "aivv-fix",
     "status": "completed",
     "invoked_at": "2026-04-21T14:00:00Z",
     "completed_at": "2026-04-21T14:05:00Z",
     "target_project": "/absolute/path/resolved/at/Step/5.0",
     "source": "review_id",
     "source_review_id": "<review-id>",
     "source_review_relative_path": "<review-relative-path-from-Step-1.05>",
     "source_argument": "<task-ID | quoted-text | blank>",
     "lifecycle_context": {
       "selector_type": "issue",
       "selector": "ISS-2026-06-04-0001",
       "record_kind": "issue",
       "record_id": "ISS-2026-06-04-0001",
       "record_path": "<state_dir>/issues/issue-slice-3-review-linked.json",
       "source_mode": "review-sourced",
       "source_review_id": "<review-id>",
       "finding_id": "F001"
     },
     "write_boundary_shown": true,
     "change_readiness": {
       "risk_tier": "medium",
       "affected_surfaces": ["code"],
       "approval_mode": "user-confirmed",
       "rollback_plan": "Revert src/api/routes.py and rerun bash tools/validate.sh",
       "required_verification": [
         {
           "id": "evreq-F001-validate",
           "kind": "command",
           "command_argv": ["bash", "tools/validate.sh"],
           "required": true
         }
       ],
       "generated_verification": {
         "present": false,
         "execution_allowed": false,
         "policy": "inspect-only"
       },
       "monitoring_plan": "No runtime monitoring required for this scoped code change.",
       "go_no_go": "go"
     },
     "objective_evidence": [
       {
         "id": "evidence-F001-validate",
         "finding_id": "F001",
         "kind": "command-output",
         "satisfies": ["evreq-F001-validate"],
         "ref": "bash tools/validate.sh",
         "outcome": "pass",
         "summary": "Validation completed successfully."
       }
     ],
     "final_dispositions": [
       {
         "finding_id": "F001",
         "disposition": "closed",
         "decided_by": "aivv-fix-verifier",
         "rationale": "Required validation evidence closed the finding.",
         "evidence_refs": ["evidence-F001-validate"],
         "residual_risk": null,
         "reopen_trigger": "Reopen if validation fails or the original symptom recurs."
       }
     ],
     "cycle_count": 1,
     "fix_plans": [
       {
         "finding_id": "F001",
         "status": "approved",
         "selected_approach": "A1",
         "summary": "Add validate_input() guard before /search handles user input.",
         "expected_files": ["src/api/routes.py"],
         "verification_path": "bash tools/validate.sh",
         "alternatives_considered": [
           {
             "approach_id": "A2",
             "summary": "Document caller responsibility only.",
             "rejected_because": "It would preserve the missing runtime guard."
           }
         ],
         "dry_run": false
       }
     ],
     "files_modified": ["src/api/routes.py"],
     "files_created": [],
     "changes_summary": [
       {
         "finding_id": "F001",
         "category": "code-bug",
         "file": "src/api/routes.py",
         "change": "added validate_input() decorator to /search",
         "root_cause": "missing validation guardrail",
         "type": "code-edit"
       }
     ],
     "verification_cycles": [
       {
         "finding_id": "F001",
         "status": "verified_resolved",
         "verifier": "scoped-verifier",
         "evidence": "bash tools/validate.sh passed",
         "remaining_next_action": null
       }
     ],
     "findings_addressed": ["F001"],
     "findings_deferred": [],
     "warnings": []
   }
   ```

   **Field semantics:**
   - `target_project` — absolute path resolved at Step 5.0 per the [`.aivv/target-resolution.md`](../../../.aivv/target-resolution.md) algorithm. Set at object-init, immutable for the invocation's lifetime. Load-bearing for recovery-on-re-invocation (state paths can be reconstructed from it without re-running the resolver).
   - `lifecycle_context` — optional side-channel context from `/aivv-fix --incident`, `--problem`, `--issue`, or `--github-issue` routing. It records selector metadata, local record identity/path, workflow/RCA status when present, route `source_mode`, optional `source_review_id`, optional `finding_id`, and optional GitHub owner/repo/number. It does not change `FixSession.source`: review-backed lifecycle routes still write `source: "review_id"` with `source_review_id`, and investigation-only lifecycle routes write a non-review source such as `conversation`.
   - `changes_summary[].category` — the finding's dispatch category (`code-bug | design-flaw | process-violation | documentation-gap | clarification-needed | improvement`). Propagated from Step 2a per the Step 4 PLAN field-propagation rule above. Present on every entry regardless of Branch.
   - `changes_summary[].type` — the ACTION taken by the EXECUTE branch, with enum values `code-edit | documentation | design-adr | process-rule | build-script | ci-gate | verification-method`. Distinct from `category`: `category` identifies the finding's kind; `type` identifies the fix's kind. Branch A writes `type: code-edit`; Branch B writes `documentation`; Branch C writes `design-adr` (for a new ADR) or `code-edit` (for localized design changes falling through to Branch A); Branch D writes `process-rule`; Branch F writes `code-edit` (scoped simplification). Extended values:
     - `build-script` — fix adds/modifies a script in `scripts/`, `tools/`, `bin/` that participates in the build
     - `ci-gate` — fix adds/modifies a CI workflow file (`.github/workflows/*`, `.gitlab-ci.yml`, etc.) or pre-commit hook
     - `verification-method` — fix adds/modifies an assertion script intended to verify an acceptance criterion
   - `changes_summary[].red_green_evidence` — optional Step 4.6/5.7 evidence object for verification-method entries. `claim: "prevention"` means the fix log contains a right-reason pre-fix failure and a post-fix pass; `claim: "verification-only"` means only post-fix evidence was captured. A prevention claim without `pre_fix` is schema-invalid; the orchestrator must downgrade it to verification-only instead of implying red-green proof.
   - `changes_summary[].red_green_evidence.pre_fix.command_argv` / `.post_fix.command_argv` — exact tokenized command arguments for the recorded run. `command` remains the human-readable shell form; `command_argv` is the durable command-argument contract Step 5.7 and verifiers read.
   - `changes_summary[].execution_evidence.command_argv` — exact tokenized command arguments for post-fix execution evidence. Present when Step 5.7 executed the verification code locally.
   - `findings_deferred` — list of finding IDs that Branch E (clarification-needed) parked pending user clarification. Empty by default; appended to when the user defers a clarification-needed finding instead of resolving it in-session. On Step 6 / Step 7, these are reported separately from `findings_addressed`. **Branch E writes no `changes_summary` entry** — the fix-kind enum `{code-edit, documentation, design-adr, process-rule, build-script, ci-gate, verification-method}` has 7 values covering Branches A–D and F (F reuses `code-edit`) plus build/CI/verification fix kinds; Branch E's action is "deferral," which goes into this top-level array instead.
   - `fix_plans[]` — optional non-dry-run proposal records keyed by `finding_id`. `status` is one of `proposed | approved | applied | superseded | abandoned`; `applied` means the selected plan reached write dispatch/execution and is not proof that a change landed. Applied-change truth still comes from a matching `changes_summary[]` entry. `dry_run` records whether the plan originated as preview context, but persistent fix logs are only written after the dry-run gate has passed; a standalone `/aivv-fix --dry-run` writes no fix log.
   - `verification_cycles[]` — optional post-execution verifier records keyed by `finding_id`. `status` is one of `verified_resolved | verified_unresolved | needs_rework | skipped | error`. Use this for scoped verifier outcomes; do not overload `changes_summary[]` with verifier status.
   - `dangerously_auto_apply` — null/absent for normal runs. When `--dangerously-auto-apply` is explicitly confirmed, set `{confirmed: true, confirmation_source, bypassed_gates, applied_count}` and mirror per-change `dangerously_auto_apply: true` plus `bypassed_gates: [...]` on each affected `changes_summary[]` entry. Step 5's final audit banner reads this object; do not reconstruct the count from git diff.
   - `warnings` — top-level array of orchestrator-side warnings (dispatch fallbacks, schema-mismatch notes, recovery events). Separate from `changes_summary[].root_cause` which documents actual finding root causes — do NOT overload. Warning-object shape: `{"code": "<identifier>", "finding_id": "<F###>"|null, "ts": "<RFC 3339>", ...contextual fields}`. Common codes: `category-fallback` (see [investigator-field-definitions.md](investigator-field-definitions.md) Category section), `stale-skill-cache` (if the Step 8 canary fires in /aivv), `schema-migration` (on-read handling of historical session log paths). Surfaced in Step 7 DOCUMENT if non-empty.

  **Lifecycle write-back contract:** When `lifecycle_context` is present, load the lifecycle record from `lifecycle_context.record_path` before investigation and pass a compact context summary to the investigator. `rca_status: "not-started"` and `rca_status: "draft"` mean investigation-first. Incident/problem writes are limited to schema-backed RCA/prevention fields (`root_cause_analysis`, `incident_context`, `prevention_plan`, `rca_status`, `updated_at` when supported, and `links`). Local issue writes are limited to schema-backed workflow fields (`status`, `updated_at` when supported, `links`, `closure_decision` when closing, `timeline`, and `sync.status`). Use the `AIVV_ROOT` pinned and preflighted at this invocation's start, then validate every lifecycle write with `node "$AIVV_ROOT/tools/incident-state.mjs" validate --file "<record-file>" --state-dir "<state_dir>" --kind "<incident|problem|local-issue>"`. Draft or apply GitHub changes only through `node "$AIVV_ROOT/tools/incident-github-sync.mjs" plan --context "$storage_context_file" --issue "<issue-record>" --repo "<owner>/<repo>"` and `node "$AIVV_ROOT/tools/incident-github-sync.mjs" apply --context "$storage_context_file" --issue "<issue-record>" --repo "<owner>/<repo>" --confirm`; `/aivv-fix` must not call `gh` directly.

   **Write semantics** (full-object publication, not literal append-to-entries):

   ```bash
   node "$AIVV_ROOT/tools/storage-paths.mjs" write --context "$storage_context_file" \
     --area state --relative "fix-$invocation_id.json" --source "$candidate"
   ```

   - Initialize only after the dry-run gate through the shared storage mutation helper.
   - Reuse the invocation ID bound after Step 1.0 recovery selection and create the session file with `status: "in-progress"` and `cycle_count: 1`. Include any evidence-backed rework retries already consumed in memory before this first durable write; the first persisted snapshot becomes the transition baseline.
   - After every in-memory `session_changes` mutation, stage the complete candidate in private scratch and validate it with `node "$AIVV_ROOT/tools/pre-write-validator.mjs" --fix-log <candidate> --context "$storage_context_file" --new` for the first write or `--update` thereafter. The validator reads the exact persisted record itself; do not supply a model-authored or stale prior snapshot. Then publish to `<state_dir>/fix-<invocation_id>.json` under the shared target operation lock. Never write active state with a host Write/apply_patch operation outside the helper; this would race import. Invocation-specific names preserve the existing independent-session model.
   - **JSON emission canonical form (dev.26+):** to ensure byte-stable output across orchestrator agent invocations and across hosts, follow the same canonical-form rules documented in [/aivv Step 7.5](../../aivv/SKILL.md#step-75-write-review-log-orchestrator-side-unconditional) ("JSON emission canonical form" subsection). Briefly: 2-space indent, key order matches the field-source/object-shape table above (top-to-bottom), exactly one trailing `\n`, raw UTF-8 (no `\u` escapes for non-ASCII), absent optional fields are OMITTED (not `null`), empty arrays as `[]`, all timestamps in UTC `Z` form, paths in POSIX forward-slash form even on Windows. Maintainer-side schema-fixture validation (run by AIVV's own pre-release validator) embodies the canonical form for fix-log shape; if your output differs from a freshly-emitted dev.26+ fix log's shape (modulo per-invocation ID/timestamp/finding values), you have drifted from canonical.
   - The first Step 6 verifier dispatch uses `cycle_count: 1`. When an evidence-backed verifier defect qualifies for re-entry, increment `rework_retry_count`, append its `verification` retry event, and increment `cycle_count` together in one validated update before returning to Step 3. The next Step 6 verifier uses that already-incremented value; do not increment it again at dispatch. The shared `rework_retry_count` is the sole semantic rework cap.
   - Set `status: "completed"` and `completed_at` at the end of Step 7.
   - Set `status: "failed"` if Step 6 stops with unresolved findings because the shared retry budget is exhausted, or because a regression stop fires without resolution. `cycle_count` alone never fails or extends the invocation.

   **Recovery on re-invocation**:
   When `/aivv-fix` is invoked and `<state_dir>/` contains existing session files:
   1. Find the most recent file by `invoked_at`.
   2. If `status: "in-progress"` and its immutable `authorized_scope` plus retry state validate: present to the user: *"A prior `/aivv-fix` invocation at {invoked_at} did not complete. Files modified: {files_modified}. Options: (a) Resume — continue from the last logged change using the same invocation ID, scope, and retry count; (b) Restart — start fresh, review currently-modified files manually; (c) Discard — mark the prior session as abandoned (`status: "abandoned"`) and start fresh. Which?"*
   3. If `status: "in-progress"` but its scope/retry baseline is missing or invalid, do not offer Resume: report that the old record cannot safely continue and offer only Restart from the original selected findings or Discard. Do not initialize its retry count to zero or infer a broader scope.
   4. If `status: "failed" | "completed"`: no recovery prompt; the file is read only for the scan boundary (see Step 1).

   5. If `status: "abandoned"` AND the session was auto-reaped (has a `warnings` entry with `code: "reaped-stale"`) and its scope/retry baseline validates: present to the user: *"A prior `/aivv-fix` invocation at {invoked_at} was auto-reaped after 7 days of inactivity. Files modified: {files_modified}. Options: (a) Resume — restore status to in-progress and continue with the same invocation ID, scope, and retry count; (b) Restart — start fresh, review currently-modified files manually; (c) Ignore — leave as abandoned and start a new session. Which?"*
      - On "Resume": set the reaped file's status back to `in-progress`, clear the `reaped-stale` warning, and continue from where it left off.
      - On "Restart" or "Ignore": create a new session; the reaped file remains abandoned.
   6. If the auto-reaped record lacks a valid scope/retry baseline, omit Resume and offer Restart or Ignore only.

   7. If `status: "abandoned"` AND NOT auto-reaped (manually marked by user in a prior session): no recovery prompt.

   **Collision safety**: The `<4-char-random>` suffix in the invocation ID prevents concurrent invocations from colliding on filename. Do not re-use or share session files across invocations.

   **Do NOT rely on `git diff` or `git log` to reconstruct what was changed — the persisted `session_changes` file IS the source of truth.** Other agents may be making unrelated commits simultaneously.
