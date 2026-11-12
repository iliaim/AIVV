# Step 4.4.5 RED-GREEN TEST GATE (failing test before the plan challenge)

This reference is the canonical home for the six-step red-green sequence and the runtime-finding exception. The red run happens before Step 4.5 CHALLENGE so the plan is challenged with a test that has actually run; the green run happens in Step 5 after the fix.

For every approved finding where a test can be written (`code-bug`, `design-flaw` with testable behavior):

The minimum test in this gate is defect-reproduction and verification evidence, not a `prevention_plan` artifact. It does not need recurrence or systemic-class evidence. Any broader harness, generalized coverage rule, or additional test proposed as prevention still passes the separate new-prevention evidence gate.

1. **Materialize a failing-test write intent or test plan that reproduces the issue.**
   - Use the project's existing test framework (detect from `package.json` / `pyproject.toml` / `Makefile` / existing test dir).
   - Simplest possible reproduction — one test function, minimal setup.
   - If the test requires a new or edited test file, materialize the proposed bytes at Step 4.4 as a normal `write_intents[]` record with the required fields in [write-intents-and-prewrite-validation.md](write-intents-and-prewrite-validation.md), alongside the fix intents, so the Step 4.5 challenger sees the test bytes. Do not add a `type` field to `write_intents[]`.
   - If the reproduction can use existing tests or a runtime observation without changing files, record the exact test plan and command instead of a write intent.

2. **Validate the intended pre-fix failure shape.**
   - The test MUST fail for the right reason.
     - **Right-reason fail:** the assertion targeting the defective behavior fails while the test harness executes cleanly (no import errors, no syntax errors, no fixture failures).
     - **Wrong-reason fail:** the test errors before reaching the defective-behavior assertion. Fix the test setup before proceeding.

3. **Run the test now, before Step 4.5.** If it passes: STOP — the test does not reproduce the issue.
   A passing test is evidence that this test run did not reproduce the reported behavior. Do not label the finding false-positive or re-investigate solely because the result is uncertain. Stop the affected finding before writing the fix and report the test result; re-enter investigation only if inspection identifies a specific defect in the test or prior investigation and a concrete in-scope correction, consuming the shared retry budget.
   - If the reproduction uses existing files or a no-write runtime observation, run it as is.
   - If it needs the materialized test-file bytes, write only the test intent to the target project, then run it. No fix byte is written here, and this is the only project write permitted before Step 5. The write passes the immediately-before-write validator pass against the fix log persisted at Step 4.4 (target-path, `authorized_scope`, and detector checks) and the stale-intent check. It precedes the challenge, final route classification, and the Change Readiness Gate, so it is allowed only under the next rule.
   - **Write early only when no user decision is pending:** readiness for this finding would record `approval_mode: "auto"` — policy `auto`, `fix_confidence: "high"`, no reason-coded blocker from the Step 4 precheck, and none of the Hard approval rules in [fix-log-contract.md](fix-log-contract.md) applies — or the Step 4 classification would route the finding `dangerously-auto-approved` under [execution-decisioning.md](execution-decisioning.md) (not policy-skipped, no architecture approval outstanding, and `dangerously_auto_apply` confirmed and recorded in the Step 4.4 log). On either route, first run the finding's read-only class-verdict scan (the Step 5 pre-loop, steps 1–5 in [fix-log-contract.md](fix-log-contract.md)) and write early only if the verdict gate passes and the scan leaves the finding's confidence and route unchanged. Record the result on the finding's decision-ledger entry as `class_scan`; Step 5 reuses that record instead of scanning again. In every other case (policy `ask` or `skip`, a decision-queue or architecture-decision-queue route, medium or low confidence, or any Hard approval rule category) do not write the test early: keep it as an intent, let the challenger review the test bytes without red output, and after approval run the red step in Step 5 — write the test intent before the fix, capture the right-reason failure, then apply the fix.
   - Before the early write, add the test path to `files_created` or `files_modified` in a validated fix-log update, so the write is visible to recovery even if the run stops next. After the run, record the outcome on the finding's decision-ledger entry as `red_run` (status, test intent ID, exact `command_argv`, exit code, and an output excerpt). The ledger record becomes `red_green_evidence.pre_fix` in Step 5 and is passed to the challenger as `{red_run_evidence}`.
   - **Undo the early test write** whenever the fix for its finding is not applied in this invocation — its intent is discarded or regenerated; the finding ends unresolved, declined, skipped, stopped, deferred, or dry-run-only; or a resumed log is Restarted or Discarded. Delete the created file or restore the intent's recorded preimage — only while the file still matches the content this run wrote; if it has since changed, leave it and report the path — then remove the path from the file lists and record the undo in the fix log `warnings`, so a regenerated test intent starts from the original tree. If an invocation ends without this step (crash, or a log reaped as stale), the failing test remains but stays listed in the log, and the recovery prompt shows it.

4. **Apply the fix** (Step 5 EXECUTE).

5. **Verify the test passes.** Run it again. If it still fails: the fix did not address the root cause. Return to Step 3 INVESTIGATE only if the shared `rework_retry_count` has room; increment it once and append a `red-green` retry event. This consumes the same invocation-wide budget as challenge and Step 6 verification re-entry. `cycle_count` and `challenge_iterations` remain diagnostic counters only. At the cap, report the finding unresolved and do not re-author.

6. **Log the test** in the eventual Step 5 `session_changes.changes_summary[]` entry with `type: "verification-method"` and `change: "Added failing test <test_name> before the fix; passes after fix."` after the write and test evidence are recorded. Also persist `red_green_evidence`:
   - Use `red_green_evidence.claim: "prevention"` only when the log contains both the right-reason pre-fix failure and the post-fix pass.
   - Use `red_green_evidence.claim: "verification-only"` when only post-fix execution evidence exists. A post-fix-only test is useful verification, but it is not prevention evidence.
   - Persist the command as both human-readable `command` and exact tokenized `command_argv` for every pre-fix and post-fix run.

**Skip when:**
- `category: documentation-gap` (no testable behavior change).
- `category: process-violation` (one-off corrective with no code change).
- Project has NO test infrastructure at all (log warning `no_test_infrastructure`).
- `recommended_next_step ∈ {document, defer-with-rationale, accept-risk}` AND test effort > 2× fix effort (log reasoning). Legacy findings without `recommended_next_step` fall back to `severity ∈ {MINOR, POLISH}`.

**Exception for runtime findings:** when `verification_method: runtime-observation`, the "failing test" is a runtime reproduction (DevTools trace, Playwright screenshot, network log) rather than a unit test. The gate still fires — show the issue exists before fixing it.
