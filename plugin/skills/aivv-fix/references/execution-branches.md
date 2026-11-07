# Execution Branches

Read from `skills/aivv-fix/SKILL.md` before executing Branch A/B/C/D/E/F fixes. Final Branch A/B/C/D/E/F dispatch ordering and route boundaries are centralized in [execution-decisioning.md](execution-decisioning.md); this file owns the branch mechanics after that route is selected.

## Contents

- Root-cause verification
- Branch A code-bug execution
- Branch B documentation-gap routing
- Branch C design-flaw (ADR-worthy vs localized)
- Branch D process-violation (one-off vs pattern)
- Branch E clarification-needed (HALT, return to user)
- Branch F improvement (behaviour-preserving betterment)
- Prevention and task integration

_The numbered list below continues `skills/aivv-fix/SKILL.md` Step 5 — item 1 (the root-cause verification preamble) lives there; items 2–4 below extend it._

2. **Apply the strategic fix — dispatch by finding category**: Review each approved finding's `category` field from Step 2a (the user-facing triage column is labeled "Type" for readability; the machine field is `category` per `.aivv/schemas/finding.json`) and route to the appropriate branch below. The "verify root cause" check applies to ALL branches — a fix that addresses symptom-not-cause is not acceptable regardless of category.

   **Root-cause verification (applies to every branch):**
   - State the root cause explicitly: *"The root cause is X. This fix eliminates X by doing Y."*
   - If available evidence does not support a clear root cause, stop this finding as unresolved; uncertainty alone does not trigger another investigation. Re-enter Step 3 only when a specific prior investigation defect is evidenced, a concrete in-scope correction path is available, and the shared `rework_retry_count` has room. Record that defect and evidence before re-entry; otherwise report the evidence gap without writing.
   - A fix that merely prevents the symptom from manifesting (e.g., catching an exception that should never be thrown, adding a guard that hides an underlying invariant violation) is NOT acceptable
   - Ask: *"If I apply this fix, could the same root cause produce a different symptom elsewhere?"* If yes, the fix is incomplete

   **Branch A — `code-bug` (default path, most common):**
   - REQUIRED before any host write primitive: consume the approved Step 4.4 `write_intents[]` entries for this finding. Branch A writes require `kind: "generated_patch"` with exact `proposed_edits[]` preimage/postimage pairs; opaque patch hunks or missing `proposed_edits[]` HALT as `no-pre-write-inspectable-intent`.
   - Immediately before each Edit/apply operation, recompute the Branch A intent hash from the exact pending old/new bytes. If the recomputed hash differs from `content_sha`, HALT as `stale-write-intent-content-mismatch`.
   - Fix all confirmed instances within `authorized_scope`. Do not read or modify an explicitly excluded area; report any known out-of-scope instance without treating it as authorization to expand the task.
   - Follow existing code patterns and conventions
   - **Log each change** to `session_changes.changes_summary` with `category: "code-bug"` and `type: "code-edit"` — record the file, what was changed, and which finding it addresses

   **Branch B — `documentation-gap`:**

   Apply routing rules per-finding within a batch (other findings in the same batch proceed independently):

   **Priority 1 — same-agent fallback:**
   If `capability_degradations` contains `"investigator_cold_dispatch_unavailable"`:
   → Route to Branch E. Banner: `CLARIFICATION_NEEDED:empirical_verification_required` — "Structural independence unavailable (same-agent fallback active). Cannot verify root cause empirically. User must supply investigation. For visual findings: run `/aivv --runtime --emit-runtime-probes`, execute the generated Playwright probes in the target project, ingest the JSON results with `/aivv --ingest-runtime-results <path>`, then re-run `/aivv-fix`. This finding is recorded in `session_changes.findings_deferred` at routing time and appears under deferred findings in the Step 7 summary until verification is supplied." Append finding ID to `session_changes.findings_deferred` at routing time (do NOT wait for user-explicit deferral).

   **Priority 2 — unable-to-verify or absent/empty evidence:**
   If `verification_method == "unable-to-verify"` OR `verification_method` is absent OR `verification_evidence` is empty/whitespace:
   → Route to Branch E. Banner: `CLARIFICATION_NEEDED:empirical_verification_required` — "Investigation could not empirically verify root cause for [F_ID]. [If visual]: run `/aivv --runtime --emit-runtime-probes`, execute the generated probes, ingest Playwright JSON with `/aivv --ingest-runtime-results <path>`, then re-run `/aivv-fix`. [If code]: Perform manual investigation and re-run `/aivv-fix`. This finding is recorded in `session_changes.findings_deferred` at routing time and appears under deferred findings in the Step 7 summary until verification is supplied." Append finding ID to `session_changes.findings_deferred` at routing time.

   **Priority 3 — L1-source override (A11Y-\* / COMP-LEGAL-\* / DP-LEGAL-\*):**
   L1-source detection fires at finding-collection layer (upstream of routing here). Branch E routing does NOT suppress the L1-source forced-SHOW behavior. The finding is forced-shown to the user at its assigned severity — **severity is preserved, NOT forced to CRITICAL** — with the Branch E banner. This matches the canonical L1-source rule in `polish-and-l1-source-policy.md` plus `/aivv` Step 6 severity-threshold rendering, where CRITICAL+L1 / MAJOR+L1 / MINOR+L1 / POLISH+L1 all render at their own severity; the prior "forced-CRITICAL severity" wording here was the sole outlier contradicting that rule (a correctness alignment, not a model change).

   **Priority 4 — confident, evidence present:**
   If `verification_method` ∈ {`code-trace`, `test-execution`, `grep-pattern-match`, `external-doc-lookup`} AND `confidence` ∈ {`high`, `medium`} AND `verification_evidence` is non-empty:
   → Source content: REQUIRED — `fix_proposal.verbatim_doc_content` MUST be non-null and non-empty. If absent/null/empty, route to Branch E with banner `CLARIFICATION_NEEDED:doc_content_unspecified` — "Investigator did not supply verbatim documentation text (`verbatim_doc_content` is absent). `fix_proposal.description` is a prose approach summary, not documentation prose, and cannot be safely written verbatim to docs. Re-investigate or supply manual content, then re-run `/aivv-fix`." Do NOT fall through to `fix_proposal.description`.
   → REQUIRED before Edit: consume the approved Step 4.4 `write_intents[]` entry with `kind: "verbatim_doc_content"` and `content_sha` matching the full `fix_proposal.verbatim_doc_content` bytes. Recompute immediately before the host write primitive; on mismatch HALT as `stale-write-intent-content-mismatch`.
   → Apply targeted prose edit via Edit to the identified file+section using `fix_proposal.verbatim_doc_content` verbatim. Record the written doc target file in `session_changes.changes_summary[].file` at Edit time (singular `file` field, matching the existing `"file"` key convention on every `changes_summary` entry in SKILL.md) — the Step 6 verifier resolves `<written_doc_file>` from this field to run the doc citation grep. The written documentation MUST contain `verification_evidence` verbatim as an inline citation (e.g., `per MainTimerPage.tsx:410` for code-trace; the URL for external-doc-lookup). This citation is what the Step 6 verifier greps for.
   → **Log each change** to `session_changes.changes_summary` with `category: "documentation-gap"` and `type: "documentation"`.

   **Priority 5 — new file vs in-place augmentation:**
   If Priority 4 applies AND the fix creates a NEW file (not adding to an existing one): confirm with the user before creating — new docs expand surface area and may duplicate content elsewhere. This new-file confirmation is a consequence gate that fires regardless of `fix_apply_policy.documentation-gap = auto`; auto-policy does not bypass it. In-place augmentation (new docstring on existing function, new section in existing file): no user confirmation needed.

   **Branch C — `design-flaw`:**
   - First judgment call: does this finding warrant a new architectural decision record, or is it a localized design change?
     - **ADR-worthy** (multiple viable options, non-obvious tradeoffs, load-bearing on future work): author a new ADR. Operational rules:
       1. **Detect ADR directory**: first consult the target project's maintainer guidance (or equivalent convention file) for a documented ADR location. If none documented, scan for common conventions in order: `docs/adr/`, `architecture/decisions/`, `adr/`, then any `decisions/` directory under the project's documentation tree. If multiple exist, prefer the one with the most recent file mtime; if still ambiguous, ask the user. If none exists, propose a location and confirm with the user before writing.
       2. **Detect ADR format from exemplar** (do NOT prescribe): read the most-recent existing ADR in the chosen directory (by `max(parse_leading_integer(filename))`) and mirror its section headers. If the directory is empty, default to `Status / Date / Context / Decision / Consequences / Rationale` and confirm with the user before writing.
       3. **Number selection**: `new_number = max(parse_leading_integer(existing_files)) + 1`. **Do NOT fill gaps** — gaps in ADR numbering are historical (deleted or reserved ADRs); filling them corrupts cross-references.
       4. **Concurrent-session collision**: if two `/aivv-fix` invocations run in parallel, they may independently propose the same number. Write the file with a `proposed-<4-char-random>-` prefix using the session's existing random suffix (from the invocation ID). A human resolver (PR review) renames to the final number. This mirrors the session-log collision-safety pattern.
       5. **Human-resolver renumbering semantics** (for PR review when two proposed-prefix files claim the same number): accept the first one at the original number; renumber the second to `max(existing-numbers-at-merge-time) + 1`. If that creates a visible number skip because the first ADR was numbered `0012` and a subsequent one got `0014` (skipping `0013` because the resolver lost an intermediate `proposed-*` file), DO NOT backfill the gap — the gap is historical from the resolver's perspective. The do-not-fill-gaps rule (rule 3) applies to deleted-or-reserved ADRs; a resolver-induced gap is structurally equivalent and should also stay unfilled. This keeps ADR numbers monotonically assigned from a single viewpoint (the resolver's merge history).
       6. Log the new ADR path in `session_changes.changes_summary` with `type: "design-adr"` and `category: "design-flaw"`.
     - **Localized design change** (one clear fix, no meaningful alternatives): fall through to Branch A's code-edit path with `category: "design-flaw"` preserved but `type: "code-edit"` on the session-log entry. Include the design rationale in the commit message / in-code comment if the *why* is not obvious from the code alone.
       Localized Branch C fallthrough MUST use the same Step 4.4 `write_intents[]` materialization, detector, Step 4.5 inert snapshot, and Step 5.4 pre-write validation contract as native Branch A.
   - Either way, consider documenting meaningful architectural changes in the next release notes, including documentation-only changes when they affect user expectations.

   **Branch D — `process-violation`:**
   - REQUIRED before any rule/doc write primitive: consume the approved Step 4.4 `write_intents[]` entry with `kind: "process_rule_content"`. Recompute `content_sha` over the exact pending process/rule content immediately before write; on mismatch HALT as `stale-write-intent-content-mismatch`.
   - Distinguish one-off vs pattern:
     - **One-off** (e.g., a single checkbox ticked without evidence, a single un-gated commit): apply the corrective action directly (un-tick the box, add the missing evidence line, revert the commit if the user authorizes). No rule change needed.
     - **Pattern** (the same violation has happened ≥2 times OR the existing rule is unclear): update the rule. Detect where the project stores working rules — `maintainer guidance`, `AGENTS.md`, `.cursor/rules/`, `docs/CONTRIBUTING.md`, etc. Strengthen the existing rule or add a new one. Consider whether automation (a validator, lint rule, hook) can enforce the rule at write-time rather than catching it at review-time — if so, propose the automation as the Step 3 prevention.
   - **Log each change** to `session_changes.changes_summary` with `category: "process-violation"` and `type: "process-rule"`.

   **Branch E — `clarification-needed`:**
   - The finding is ambiguous — Step 3 investigation could not resolve whether it's a real issue or a non-issue. Do NOT apply a fix.
   - Return to the user with the specific unresolved question(s). Once the user clarifies, the finding's `category` gets re-classified (typically promotes to `code-bug` / `design-flaw` / etc., OR drops as non-issue) and Step 5 re-enters with the corrected branch.
   - If the user chooses to defer the clarification: append the finding ID to `session_changes.findings_deferred` (top-level array, declared in the schema) and skip to the next finding. Deferred findings are reported separately from `findings_addressed` in Step 7.

   **Branch F — `improvement` (dev.146+):**
   - The finding is a behaviour-preserving betterment (clarity, complexity reduction, redundancy removal, ergonomics), not a defect. The bar to apply is higher than for a defect: the change must demonstrably preserve behaviour AND stay scoped.
   - **Apply decision:** improvement findings render as POLISH.
     - **Policy resolution:** resolve `fix_apply_policy.improvement` through normal precedence. If explicit modern improvement policy is absent but legacy `apply_polish_mode` is explicit, map the legacy key (`always` → `auto`, `ask` → `ask`, `never` → `skip`); if neither is explicit, bind the golden schema default.
     - **Per-value semantics:** `auto` means eligible for automatic application only when `fix_confidence == high` and Step 4 confidence/challenge/consequence gates clear (see `skills/aivv-fix/SKILL.md` Step 4 W10 classifier); `ask` routes to the batched decision queue; `skip` skips unless severity/disposition safety floors require escalation.
     - **Quick Wins:** expressed with optional `value: high` + `effort: trivial` metadata, not by borrowing MINOR severity. They are never auto-applied silently when the resolved policy is `ask`.
   - **Invasive improvements defer and never auto-apply:** if the proposal adds an abstraction/layer/dependency/configuration state, generalizes behavior beyond the current requirement, introduces enforcement machinery, changes a shared interface, or materially widens the file/region footprint, route it to the decision queue with default choice `defer-with-rationale`. A user may explicitly select application after seeing the net-value case; neither schema-default policy, explicit `fix_apply_policy.improvement=auto`, `--apply-all-polish`, nor Quick Win metadata makes it auto-eligible.
   - **Guard CQ-002 (behaviour preservation):** existing tests MUST pass unmodified after the edit. Never alter a test to make a simplification "pass" — if a test must change to accommodate the edit, the change is not behaviour-preserving and the finding is mis-categorized (re-triage as `code-bug` / `design-flaw`).
   - **Guard CQ-003 (scope):** the applied diff stays scoped to the finding's file/region. No drive-by refactors of adjacent code; if the simplification reveals a broader cleanup, surface it as a NEW improvement finding rather than widening this diff.
   - **Cross-file / structural simplifications are SURFACED, never auto-applied** — a finding proposing a module-boundary change, file-tree reorganization, or any multi-file restructure is reported as advisory with an explicit "out-of-current-scope; separate effort" note. Treat AS-* architecture-catalog findings and improvement findings whose `investigation_mode` is `instrumentation-first` as surface-only.
   - Improvement edits use the same Step 4.4 `write_intents[]` materialization, detector, Step 4.5 inert snapshot, and Step 5.4 pre-write validation contract as Branch A.
   - **Log each change** to `session_changes.changes_summary` with `category: "improvement"` and `type: "code-edit"`.

3. **Execute the prevention decision**: If `prevention_plan.mechanism == "none-new"`, create no prevention artifact; record its bounded `rationale` and evidence in the fix log, then continue to task integration. The minimum defect-reproducing regression test required by Step 4.6 is verification evidence and may still be written even when prevention is `none-new`; it is not a prevention artifact. For any additional or generalized prevention mechanism, first verify the investigator supplied a valid `eligibility_basis` and concrete `eligibility_evidence` establishing confirmed recurrence, systemic failure class, high-impact safety/security exposure, or failure of an existing control. Missing evidence routes back to Step 4.5 as an unjustified-complexity revision; do not write the artifact. When eligible, implement the proposed prevention. Path conventions are project- and host-dependent — first check the project's existing convention via its `maintainer guidance`/`AGENTS.md`/contributing doc; otherwise use the closest match below:
   - `hook` → host's hook directory (`.claude/hooks/` on Claude Code projects; equivalent on other hosts) or project-level git hook (`.husky/`, `.git/hooks/`)
   - `validator` → `scripts/validators/`, `tools/`, or equivalent project-script directory
   - `test` → project's test directory (`tests/`, `test/`, `spec/`, language-conventional)
   - `pattern-doc` → project-conventional pattern directory (`.claude/patterns/` for Claude-using projects; `docs/patterns/` for many others)
   - `schema` → `.aivv/schemas/` for AIVV-internal schemas, project-schema dir otherwise
   - `rule` → project-conventional rules location (`.claude/rules/`, `.cursor/rules/`, or maintainer guidance / AGENTS.md inline)

Preserve the existing convention if one is found; do NOT impose `.claude/` paths on projects that don't already use them.

4. **Task integration**: If source was a task file (`/aivv-fix TASK-XXXX`):
   - Update `review_tracking.resolved_issues` with structured entries:
     ```
     "F001 [CRITICAL]: SQL injection — Root cause: missing input validation guardrail. Fixed: added validate_input() decorator to all API endpoints. Prevention: pre-commit hook checks for raw request.json usage."
     ```
   - Remove resolved items from `open_issues`

---

## Lifecycle write-back rules (when `lifecycle_context` is present)

When `lifecycle_context` is present, initialize `session_changes.lifecycle_context` before the first fix-log write. Before Step 3 investigation, load the lifecycle record named by `lifecycle_context.record_path` and pass a compact context summary to the investigator. Treat `rca_status: "not-started"` and `rca_status: "draft"` as investigation-first states; they are not fix-ready unless linked review findings already identify concrete changes.

Lifecycle write-back rules:
- Incident and problem RCA/prevention updates may write only schema-backed fields: `root_cause_analysis`, `incident_context`, `prevention_plan`, `rca_status`, `updated_at` when the record schema supports it, and `links`.
- Local issue workflow updates may write only schema-backed fields: `status`, `updated_at` when the record schema supports it, `links`, `closure_decision` when `status: "closed"`, `timeline`, and `sync.status`.
- Verifier failure reopens RCA investigation by moving the lifecycle record back to an investigation state and adding a `fix_log` link to the failed fix log.
- The convergence cap writes a problem-level or architecture-level recommendation into the lifecycle record rather than looping silently.
- GitHub updates are drafted through the Slice 2 sync helper:
  ```bash
  node "$AIVV_ROOT/tools/incident-github-sync.mjs" plan --issue "<issue-record>" --repo "<owner>/<repo>"
  node "$AIVV_ROOT/tools/incident-github-sync.mjs" apply --issue "<issue-record>" --repo "<owner>/<repo>" --confirm
  ```
- `/aivv-fix` must not directly invoke `gh`; remote issue edits go through `tools/incident-github-sync.mjs`.
- After every lifecycle record write, validate the record:
  ```bash
  node "$AIVV_ROOT/tools/incident-state.mjs" validate --file "<record-file>" --state-dir "<state_dir>" --kind "<incident|problem|local-issue>"
  ```

## Dangerous auto-apply audit (when `dangerously_auto_apply_confirmed == true`)

When `dangerously_auto_apply_confirmed == true`, initialize `session_changes.dangerously_auto_apply` with `{confirmed: true, confirmation_source, bypassed_gates: [...], applied_count: 0}` before the first write. Invasive improvements remain deferred pending an explicit per-finding apply decision and are excluded from this route. For every eligible finding applied through the dangerous route, increment `applied_count` and include `dangerously_auto_apply: true` plus `bypassed_gates: [...]` on that finding's `changes_summary` entry. At the end of Step 5, emit a loud audit banner:

```text
[aivv-fix] DANGEROUSLY AUTO-APPLIED <N> fix(es)
[aivv-fix] Bypassed gates: CHALLENGE, L1-source/manual-review refusal, high-blast-radius pause, low-confidence escalation, batched decision surface
[aivv-fix] Confirmation source: <interactive-exact-phrase | env:AIVV_DANGEROUSLY_AUTO_APPLY>
```

If `<N>` is zero, still emit the banner with `0` so the run log shows that the bypass was armed but did not affect any fix.
