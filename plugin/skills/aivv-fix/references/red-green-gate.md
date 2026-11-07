# Step 4.6 RED-GREEN TEST GATE (before any code change)

Detail relocated from `skills/aivv-fix/SKILL.md` Step 4.6. The inline skeleton keeps the gate's applicability line, the skip conditions, and a one-line pointer. This reference is the canonical home for the six-step red-green sequence and the runtime-finding exception.

For every approved finding where a test can be written (`code-bug`, `design-flaw` with testable behavior):

The minimum test in this gate is defect-reproduction and verification evidence, not a `prevention_plan` artifact. It does not need recurrence or systemic-class evidence. Any broader harness, generalized coverage rule, or additional test proposed as prevention still passes the separate new-prevention evidence gate.

1. **Materialize a failing-test write intent or test plan that reproduces the issue.**
   - Use the project's existing test framework (detect from `package.json` / `pyproject.toml` / `Makefile` / existing test dir).
   - Simplest possible reproduction — one test function, minimal setup.
   - If the test requires a new or edited test file, materialize the proposed bytes as a normal `write_intents[]` record using the write-intent contract fields: `id`, `finding_id`, `branch`, `target_file`, `operation`, `kind`, `content_sha`, `source_step`, and `pre_write_assertions`. Do not add a `type` field to `write_intents[]`. Do not write the test file to disk before Step 5 EXECUTE.
   - If the reproduction can use existing tests or a runtime observation without changing files, record the exact test plan and command instead of a write intent.
   - Actual test-file writes happen only in Step 5 EXECUTE after target resolution, dry-run handling, readiness, and pre-write gates pass.

2. **Validate the intended pre-fix failure shape.**
   - The test MUST fail for the right reason.
     - **Right-reason fail:** the assertion targeting the defective behavior fails while the test harness executes cleanly (no import errors, no syntax errors, no fixture failures).
     - **Wrong-reason fail:** the test errors before reaching the defective-behavior assertion. Fix the test setup before proceeding.

3. **Verify the test fails only when executable without pre-Step-5 writes.** Run it if the reproduction uses existing files or a no-write runtime observation. If it passes: STOP — the test does not reproduce the issue.
   A passing test is evidence that this test run did not reproduce the reported behavior. Do not label the finding false-positive or re-investigate solely because the result is uncertain. Stop the affected finding before writing and report the test result; re-enter investigation only if inspection identifies a specific defect in the test or prior investigation and a concrete in-scope correction, consuming the shared retry budget.
   If verification requires materialized test-file bytes, defer the actual write and the pre-fix failing run to Step 5 EXECUTE. The Step 5 run must write the test intent before the fix, capture right-reason failure evidence, then apply the fix.

4. **Apply the fix** (Step 5 EXECUTE).

5. **Verify the test passes.** Run it again. If it still fails: the fix did not address the root cause. Return to Step 3 INVESTIGATE only if the shared `rework_retry_count` has room; increment it once and append a `red-green` retry event. This consumes the same invocation-wide budget as challenge and Step 6 verification re-entry. `cycle_count` and `challenge_iterations` remain diagnostic counters only. At the cap, report the finding unresolved and do not re-author.

6. **Log the test** in the eventual Step 5 `session_changes.changes_summary[]` entry with `type: "verification-method"` and `change: "Added failing test <test_name> during Step 5 before fix; passes after fix."` after the write and test evidence are recorded. Also persist `red_green_evidence`:
   - Use `red_green_evidence.claim: "prevention"` only when the log contains both the right-reason pre-fix failure and the post-fix pass.
   - Use `red_green_evidence.claim: "verification-only"` when only post-fix execution evidence exists. A post-fix-only test is useful verification, but it is not prevention evidence.
   - Persist the command as both human-readable `command` and exact tokenized `command_argv` for every pre-fix and post-fix run.

**Skip when:**
- `category: documentation-gap` (no testable behavior change).
- `category: process-violation` (one-off corrective with no code change).
- Project has NO test infrastructure at all (log warning `no_test_infrastructure`).
- `recommended_next_step ∈ {document, defer-with-rationale, accept-risk}` AND test effort > 2× fix effort (log reasoning). Legacy findings without `recommended_next_step` fall back to `severity ∈ {MINOR, POLISH}`.

**Exception for runtime findings:** when `verification_method: runtime-observation`, the "failing test" is a runtime reproduction (DevTools trace, Playwright screenshot, network log) rather than a unit test. The gate still fires — show the issue exists before fixing it.
