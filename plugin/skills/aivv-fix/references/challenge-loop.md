# Step 4.5 CHALLENGE — trigger, dispatch, and verdict handling

Detail relocated from `skills/aivv-fix/SKILL.md` Step 4.5 CHALLENGE. The inline skeleton keeps the step intro (when CHALLENGE runs relative to Step 4.4 / the W10 Auto-eligible gate) and a one-line pointer. This reference is the canonical home for the 4.5.1 trigger evaluation, the 4.5.2 dispatch (placeholder construction), and the 4.5.3 verdict handling + counter semantics. The challenger **prompt** itself lives in [fix-challenger-prompt-template.md](fix-challenger-prompt-template.md). The route effect of APPROVE/REVISE/REJECT is summarized in [execution-decisioning.md](execution-decisioning.md).

## 4.5.1 — Trigger evaluation (per batch)

**CHALLENGE fires** when ANY of these holds for any finding in the batch:
- `fix_confidence != "high"` (medium or low)
- `recommended_next_step ∈ {fix-now, investigate-first}` (regardless of fix_confidence); legacy findings without `recommended_next_step` fall back to `severity ∈ {CRITICAL, MAJOR}`
- finding has `class_signature` populated
- finding has `scope_search_seed` populated
- finding is L1-source (per the regex in [`polish-and-l1-source-policy.md`](polish-and-l1-source-policy.md)); if declared `project_context` makes the cited statute inapplicable, keep forced-show rendering but do not treat the bare citation as a manual-review batch-refusal reason
- fix authors NEW verification code (`fix_proposal.description` or `files_to_modify` triggers the `authors_new_verification_code` predicate; see [apply-policy-and-gates.md](apply-policy-and-gates.md))
- `prevention_plan.mechanism != "none-new"`; a new prevention artifact always requires Axis 9 approval with a valid `eligibility_basis` and non-empty concrete `eligibility_evidence`
- finding has `predecessor_finding_match: true` (this finding maps to a prior round's finding — recurring across rounds)
- final `architectural_remediation_assessment.required == true` or `architectural_remediation_check.triggered == true`

**CHALLENGE skipped** (trivial-fix carve-out) when ALL hold for ALL findings in the batch:
- `fix_confidence == "high"` for every finding
- `recommended_next_step ∈ {document, defer-with-rationale, accept-risk}` for every finding; legacy findings without `recommended_next_step` fall back to `severity ∈ {MINOR, POLISH}`
- single-file edit, single-occurrence text edit (typo, rename, prose tweak)
- NOT L1-source
- NOT round ≥ 2
- every `prevention_plan.mechanism == "none-new"`

**Gate-fusion skip:** if Gate 1 already ran a cold adversarial investigator for the same finding in this invocation, and the recorded second-opinion output explicitly agreed on both root cause and the proposed fix direction, Step 4.5 may skip a separate challenger only when every pending write intent in the batch is safe high-confidence plain prose (`detector_result.verdict: "pass"`, no `content_shapes`, `detection_confidence: "high"`), every `prevention_plan.mechanism == "none-new"`, and no new consequence predicate appeared after Gate 1. Record `challenge_status: "gate-fused-safe"` in the decision ledger. Any code edit, schema content, shell/content detector trigger, shared-interface touch, L1-source finding, predecessor recurrence, architectural-remediation seed, or new prevention mechanism disables this fusion and runs the normal challenger.

**Token-budget circuit-breaker:** `max_challenges_per_invocation: 10` (default; configurable via user-preferences key `max_challenges_per_invocation`). When the cap is hit:
- Remaining batches proceed to Step 5 without challenge only when every `write_intents[]` entry is safe high-confidence plain prose (`detector_result.verdict: "pass"`, `detector_result.content_shapes: []`, `detector_result.detection_confidence: "high"`, and no required assertions) and every `prevention_plan.mechanism == "none-new"`.
- Risky, unclassified, low/medium-confidence, bypassed, or near-miss write-intent batches HALT before write as `challenge-budget-exhausted-write-intent-risk`. Record warning code `challenge_budget_exhausted_write_intent_risk` and final-report status `challenge-budget-halted-risky` / `challenge-budget-halted-risky-write-intent`.
- Reason phrase for deterministic logs: `challenge-budget-halted-risky-write-intent` means a risky write intent could not receive exact-content challenge coverage because the challenge budget was exhausted.
- Safe skipped batches get one note in the final report: `[Step 4.5 skipped — challenge budget exhausted at N batches; safe high-confidence plain-prose write intents only]` and status `challenge-skipped-safe`. Do not ask the user to narrow or reopen the already-authorized scope to recover challenge coverage; report any risky batch halted by the cap as unresolved.
- Emit a `challenge_budget_exhausted` calibration record in Step 7.

## 4.5.2 — Dispatch

Before spawning challengers, apply the lifecycle pre-spawn cleanup rule from Host Adapter Mapping. This is the same AIVV-owned-handle-only cleanup used before investigator dispatch; preserve any cleanup warning in `session_changes.warnings` when possible.

<!-- CLAUDE-CODE-SPECIFIC -->
On Claude Code: `Agent` tool with `subagent_type: aivv:reviewer` and the prompt from `fix-challenger-prompt-template.md` (fill ALL `{placeholder}` values from session state before sending). Cold context; NO conversation history.

On Codex: subagent dispatch via `<codex-home>/agents/aivv-reviewer.toml` or `<target>/.codex/agents/aivv-reviewer.toml` with the fix-challenger prompt. Same cold-context requirement.

**Dispatch granularity:** per-batch. One challenger sees all approved findings in the batch plus their fix proposals. Independent batches may be challenged in parallel (same rules as Step 3 investigator parallel dispatch).

Track each challenger handle with `batch_id`, `role: "challenger"`, `dispatch_path`, and `output_consumed: false`. Set `output_consumed: true` only after Step 4.5.3 parses APPROVE, REVISE, or REJECT and records the decision. Close consumed challenger handles before looping to Step 3 or proceeding to Step 5.

**Prompt construction:** use `fix-challenger-prompt-template.md`. Fill:
- `{batch_id}`: e.g., `B1`
- `{finding_id_list}`: e.g., `F001, F002`
- `{authorized_scope}`: immutable snapshot captured in Step 1.9; include the original goal, selected findings, included boundaries, and exclusions.
- `{For each finding}` block: one block per finding with investigator fields from Step 3 output
- `{round_number_block}`: `"(none — this is cycle 1)"` on cycle 1; `"Round N (predecessor review: <id>)"` on cycle ≥ 2
- `{predecessor_findings_summary}`: empty on cycle 1; prior-round findings + outcomes on cycle ≥ 2
- `{prior_challenge_concerns}`: `"(none — first challenge of this plan)"` on the first challenge of a batch; when the batch is challenged again after a REVISE or REJECT in this invocation, the earlier challenger's `concerns[]` entries (kind, summary, evidence, alternative), so the challenger re-checks them instead of reviewing from scratch
- `{target_project}`: session target project path, from `session_changes.target_project`. Use the canonical target/storage context bound before maintenance; do not infer a provisional target from findings. **Worktree-CWD note:** challenger subagents inherit the orchestrator's shell CWD, which may be a git worktree at a different commit than `target_project`. The template's `## Working Directory` block instructs absolute-path file operations anchored on this value — keep that block intact when filling placeholders (do not relax it to a bare relative-path hint), so the challenger searches the real target tree rather than a stale inherited CWD.
- `{write_intents}`: escaped inert data snapshot of the Step 4.4 `write_intents[]` entries for the batch, including any failing-test intent. Include `content_sha` values for the full proposed content; do not substitute `fix_proposal.description` for exact proposed bytes.
- `{red_run_evidence}`: per finding, the Step 4.4.5 `red_run` record from the decision ledger — test intent ID, `command_argv`, exit code, right-reason verdict, and output excerpt. Use `(not run — <reason>)` when the gate was skipped or its red run is deferred to Step 5. Never summarize a run that did not happen as a failure.
- `{session_class_context}`: compact bullet list of root-cause classes from findings NOT in the current batch. For each finding outside this batch (from the Step 4 PLAN approved-finding records persisted on `fix_plans[]` — NOT from `session_changes.changes_summary`, which is not yet written at Step 4.5 dispatch time and does not carry these fields), collect `root_cause_category` + `class_signature` (null → `"n/a"`) from the finding's `root_cause_analysis` as integrated from the investigator output. Deduplicate by `root_cause_category`. Format each as `- [F-ID]: <root_cause_category> (grep: <class_signature>)`. When the current batch is the only batch this session (all approved findings are in this batch), populate as `"(none — this is the only batch this session)"`. **Note:** dedup is by `root_cause_category`; when two out-of-batch findings share a `root_cause_category` but have different `class_signature` patterns, only one signature is retained — follow-on cycles may miss sibling instances matching the dropped signature.
- `{alternative_approaches}` (inside each `{For each finding}` block): JSON-serialize `fix_proposal.alternative_approaches[]` from the investigator output; emit `"(none provided — run Axis 9 minimum-sufficient-remediation checks; skip only alternative-to-alternative comparison)"` when the field is absent or empty. Architecture-required findings also run Axis 8 from the architectural remediation fields.
- `{prevention_plan}` (inside each `{For each finding}` block): JSON-serialize the complete investigator `prevention_plan` decision, including `mechanism` and either the `none-new` rationale or the structured `eligibility_basis`, concrete `eligibility_evidence`, and implementation details for a new mechanism. Never summarize or omit it: Axis 9 must receive the same prevention decision that Step 5 would execute.

**Output format contract:** the challenger prompt template's `## OUTPUT FORMAT OVERRIDE — READ THIS FIRST` block explicitly supersedes the `aivv:reviewer` agent's `aivv:methodology`-preloaded output format. Do NOT modify or remove that override block when filling placeholders. The orchestrator in Step 4.5.3 parses the challenger's response as pure JSON `{batch_id, verdict, per_finding[]}` — if the override block is missing or stripped, the reviewer will emit the methodology prose+JSONL sidecar format instead, making Step 4.5 a silent no-op.

## 4.5.3 — Verdict handling

After parsing the challenger's JSON verdict and recording the decision, mark that challenger handle `output_consumed: true`. Close consumed challenger handles before any Step 3 loop or before proceeding to Step 5.

**APPROVE:** proceed to Step 5 EXECUTE. The red run already happened at Step 4.4.5 (or is deferred to Step 5 by its user-decision rule).

**REVISE:** only when a concern identifies a specific defect, cites evidence that supports it, and gives a concrete correction inside `authorized_scope`. If the shared retry budget has room, record one retry event, append the concern to the investigator prompt, discard affected write intents (undoing an early test write per [red-green-gate.md](red-green-gate.md)), and re-enter Step 3. If the budget is exhausted, leave those findings unresolved and report them. `--dangerously-auto-apply` does not bypass this rule or the retry budget.

**REJECT:** only when evidence shows the proposed fix direction is wrong and the challenger supplies a concrete alternative inside `authorized_scope`. If the shared retry budget has room, record one retry event and investigate that alternative as a candidate implementation. An out-of-scope alternative is not adopted; report the finding unresolved. If the budget is exhausted, do not re-enter Step 3.

**Uncertainty-only output:** record missing evidence or hypothetical risk under `non_blocking_observations`. It does not invalidate an otherwise supported plan, does not trigger another investigation, and does not consume a retry. The `concerns` array contains only actionable blockers.

**Immediate targeted-follow-up exception:** If the next immediate step requires targeted interactive follow-up with a specific challenger, keep that challenger's `output_consumed` value `false` until the follow-up response is integrated. Surface and persist the reason in `session_changes.warnings` when possible. This is the only valid reason to leave a completed challenger subagent open after its current response.

Do not add a separate double-REJECT escalation prompt. If evidence-backed concerns conflict, include both in the next in-budget investigation. If they remain unresolved at the shared cap, report the evidence and leave the finding unresolved.

**Shared semantic retry budget:** `rework_retry_count` starts at 0 and
`max_rework_retries` is the resolved setting `max_rework_retries` (default 3),
read once at Step 1.1 and fixed for the entire `/aivv-fix` invocation. Before every
re-entry that re-authors a fix plan or repeats post-write verification, increment
the count once and append one `rework_retry_history` entry with the gate, affected
finding IDs, defect, and evidence. A batch re-entry consumes one retry, regardless
of its number of findings. `challenge_iterations` and `cycle_count` remain stage
diagnostics only; they never grant another retry. Transport and invalid-JSON
retries that do not change the fix proposal are outside this budget. Outer-loop
review cycles are new invocations and remain governed by the outer-loop contract.

At or past `rework_retry_count == max_rework_retries`, the limit is soft: continue only
when another try is clearly justified, by adding `beyond_limit_reason` to the
new `rework_retry_history` entry — one line saying what new evidence the last
rework produced and why one more is expected to converge. This is your recorded
judgement; no approval is asked, and each further rework needs its own reason.
Wherever this skill says the budget "has room", is "exhausted", or is "at the cap",
read it with this rule: a justified, recorded reason is room for one more rework.
Without such a reason, do not re-investigate, re-author,
or dispatch another verifier for unresolved findings. Report them as unresolved
with the retry history. Do not ask the user to repeat or widen already-authorized
scope. Independently approved batches may continue through their existing safety
gates; unresolved batches do not write.

**Calibration (deferred to Step 7):**
- When REVISE/REJECT led to a fix change AND Step 6 verifier confirms the revised fix resolved the finding → emit `challenger_caught_issue` record.
- When the user explicitly overrides a REVISE/REJECT concern AND Step 6 verifier confirms the original fix was correct → emit `challenger_false_positive` record.
