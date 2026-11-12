# Verifier Dispatch

Read from `skills/aivv-fix/SKILL.md` before Step 6 VERIFY.

## Contents

- Verification context
- Scoped verifier dispatch
- Same-agent verification discipline
- Verifier result parsing
- Shared retry limit

### Step 6: VERIFY — Scoped Re-Verification

After all fixes applied:

1. **Compile verification context from session change log** (NOT from git):
   - Use the `session_changes` log from Step 5 — this is the source of truth. Read `<state_dir>/fix-<invocation_id>.json` (canonical external state; legacy originals are read-only). `<target>` is `session_changes.target_project` from Step 5.0.
   - Read `authorized_scope` from that same fix log and copy it unchanged into the verifier prompt; do not reconstruct or widen it from current context.
   - For each file in `files_modified` and `files_created`: read the current file content
   - Compile the original findings as a verification checklist
   - **Do NOT rely on `git diff` or `git log`** — in multi-agent parallel environments, other sessions may be making unrelated commits that would confuse the verifier

2. **Dispatch a scoped verifier**: Before spawning a verifier, apply the lifecycle pre-spawn cleanup rule from Host Adapter Mapping. This is the same AIVV-owned-handle-only cleanup used before investigator dispatch; preserve any cleanup warning in `session_changes.warnings` when possible. Then launch a cold reviewer subagent using the template in [verifier-prompt-template.md](verifier-prompt-template.md) — read and fill in all `{placeholder}` values from the session change log before sending.

   - `{authorized_scope}` → copy the immutable object from the same fix log byte-for-byte. The verifier must check the original goal and boundaries; it must not infer a revised task from later summaries.
   - `{target_project}` → fill with `session_changes.target_project` (the absolute path resolved at Step 5.0 and cached on the session object). **Worktree-CWD note (, sibling of #30/#39):** the verifier greps `<cited_file>` / `<written_doc_file>` and "find ALL occurrences in the modified file" — and every such path is recorded **relative** to the target project (per the Step 5.7 `os.path.join(target_project, entry.file)` contract). The verifier subagent inherits the orchestrator's shell CWD, which may be a stale git worktree at a different commit than the target, so a bare relative grep would verify against the wrong tree (false `RESOLVED`/`NOT RESOLVED`). The template's `## Working Directory` block anchors all file operations on this absolute path — keep that block intact when filling placeholders (do not relax it to a bare relative-path hint). **Timing advantage over the Step-3 investigator:** the verifier dispatches at Step 6, *after* the canonical Step-5.0 resolution, so `session_changes.target_project` is already cached and absolute — fill it directly, with none of the provisional-resolution nuance the investigator's Step-3 (pre-Step-5.0) dispatch required.

   Track each verifier handle with `cycle_number`, `role: "verifier"`, `dispatch_path`, and `output_consumed: false`. Set `output_consumed: true` only after Step 6 parses the verifier verdict for the current cycle. Close the consumed verifier before spawning any next-cycle verifier.

   **Conditional cross-section invariant section (dev.110+):** before dispatching the verifier subagent, the orchestrator computes:

   - `heading_count` per file: for each file in `session_changes.files_modified`, run `grep -cE '^### Task |^## Phase |^### Phase |^## §[0-9]|^### Step [0-9]|^### T[0-9]' <file>`. The gate fires on the **ANY-file-≥3** semantic — if any single file's heading_count is ≥3, the gate matches. (Aggregating across files would mask multi-section signal — one multi-section file with co-edits to a flat code file should still route to cold-verification of the multi-section file's invariants.)
   - `warnings_count = jq '.warnings | length' <fix_log>`. If the `warnings` key is absent (legacy fix-log shape), `jq` returns `0` — gate evaluates false on the warnings branch. If `jq` itself is unavailable on the host (the shell surface returns `command not found` / exit 127), treat `warnings_count` as `0`, append `{"code": "jq_unavailable", "ts": "<now>"}` to `session_changes.warnings`, and continue — the gate's `heading_count >= 3` branch still evaluates independently; only the warnings-only fire is forfeit. See `.aivv/platform-adapters/{claude-code,codex}.md` Runtime dependencies for per-host install commands.

   If (`heading_count >= 3` on ANY modified file) OR (`warnings_count > 0`), the orchestrator (a) populates the fenced template's `## Step 5.5 Warnings` placeholder section from `jq '.warnings' <fix_log>`, AND (b) appends the `ADDITIONAL VERIFICATION` section from `references/verifier-prompt-template.md` below the closing fence as the prompt's terminal block. Sub-instruction 4 in the addendum reads the populated `Step 5.5 Warnings` section, NOT the fix-log directly — the verifier subagent has no fix-log access. When the gate fires false, the orchestrator leaves `## Step 5.5 Warnings` populated with the empty-array placeholder (`[]`) and OMITS the `ADDITIONAL VERIFICATION` addendum entirely; the fenced template is self-contained without it.

   Lifecycle cleanup for the verifier handle follows the `output_consumed` tracking rule above: close consumed AIVV-owned verifier handles before next-cycle verifier dispatch unless an immediate targeted clarification is still pending.

   <!-- CLAUDE-CODE-SPECIFIC -->
   On Claude Code: `Agent` tool with `subagent_type: aivv:reviewer`. On Codex: subagent dispatch using `<codex-home>/agents/aivv-reviewer.toml` or `<target>/.codex/agents/aivv-reviewer.toml` (same TOML as Step 5 of `/aivv`). If the callable dispatch surface is not initially visible, perform the Codex preflight above before falling back. Same-agent verification fallback applies if cold dispatch is unavailable after preflight or dispatch attempt; record in fix-log `verification_cycles[*].capability_degradations`. On Codex, if `spawn_agent` / `wait_agent` are discoverable and reviewer TOML exists but host policy blocks delegation, ask once for explicit delegation permission or halt with `codex-subagent-delegation-blocked`; do not silently continue with same-agent verification.

   **Same-agent-verification discipline (dev.44+):** the orchestrator MAY skip cold-verifier dispatch and run a same-agent verification pass IF AND ONLY IF ALL of these hold:
   - **NEVER when any approved finding in this session has `category: documentation-gap`.** Cold-verifier dispatch required regardless of the five conditions below. Rationale: the `verification_evidence` grep check (Change 4 — doc citation + source grep) cannot be structurally enforced when the agent that wrote the prose also runs the verification — structural independence is required. This condition takes precedence over all five conditions below.
   - Every entry in `session_changes.changes_summary` has `type: "documentation"` (Branch B), or `type: "code-edit"` limited to a single-occurrence text edit (typo, rename, prose tweak)
   - `session_changes.files_modified` count is ≤ 2
   - NONE of `session_changes.files_modified` matches `.aivv/schemas/*.json`, `.aivv/runtime-contract.md`, `.aivv/methodology.md`, `agents/*.md` frontmatter sections, `skills/*/SKILL.md` Step-section semantics, or any file that defines a contract / interface / schema / protocol consumed by other components
   - The fix-bundle does NOT modify a `lens` enum, severity enum, schema property list, or any other field-set whose change has cross-file propagation requirements
   - The fix-bundle does NOT modify a multi-section cross-task documentation file (detection heuristic below)

   **Detection heuristic (5th condition):** if the modified file is `.md` and the combined count of lines matching ANY of `^### Task ` OR `^## Phase ` OR `^### Phase ` OR `^## §[0-9]` OR `^### Step [0-9]` OR `^### T[0-9]` is ≥3, the file is treated as a multi-section cross-task documentation file — dispatch a cold verifier regardless of the other four conditions. v1 favors precision over recall; non-canonical heading conventions ship as known blind spots. Per-finding grep verification cannot surface cross-task signature or consumer drift across distant sections of the same file. See `.aivv/methodology.md` Reviewer Anti-Patterns `cross-task-coherence-drift-from-per-finding-fixes`.

   When ANY of these conditions fails, dispatch a cold verifier even when the per-finding edits look mechanical. Schema/contract/protocol changes always have propagation requirements that per-finding grep cannot detect — an independent verifier asked to check "is this enum change consistent across all `.aivv/schemas/*.json`" is positionally able to grep the parent directory and surface drift; the same-agent orchestrator examining its own per-finding writes is structurally blind to peer-file gaps. Calibration lesson from the dev.43→dev.44 IV&V cycle: the dev.43 T5 same-agent-verifier-skip on the schema lens-enum fix did not catch the propagation gap to `fix-log.json`, `calibration.json`, `review-log.json`, or the investigator-schema doc; the post-ship 2-way IV&V at dev.44 caught it via cross-reviewer Devil's Advocate convergence.

   **On cycle >= 2**: populate the `{cycle_history}` placeholder with a compact record of prior attempts. For each prior cycle, include: *what was tried* (one-line fix summary per finding), *what the verifier said did NOT resolve it* (one-line verdict summary), and *whether the root cause was re-examined or only the fix was re-attempted*. Format as a markdown list, not prose. **On cycle 1**, populate the placeholder with the literal string `(cycle 1 — no prior attempts)` so the template section reads cleanly instead of showing a dangling header. The template's anti-anchoring prose still tells the verifier to ignore the section when this sentinel is present.

   **Cycle history construction source**: Build the history from the **orchestrator's own prior-cycle state** (tracked in `session_changes.cycle_count` and a per-cycle `changes_summary` entry), NOT by parsing the prior verifier's free-form narrative output. The verifier's output is read only for the current cycle's pass/fail decision. Relying on NL parsing of verifier output is fragile and not part of the contract.

   **Additional placeholder values for cycle ≥ 1:**
   - `{round_number_block}`: populate as `"Round <cycle_count>"` (e.g., `"Round 2"` on second cycle).
   - When `predecessor_review_id` is set on the current session: populate `{predecessor_findings_summary}` as a compact list — one line per prior review's finding: `<finding_id>: <summary> → <outcome: "resolved" | "unresolved" | "introduced-regression">; runtime_evidence:<confirmed|refuted|skipped|error|missing>`. Source this from the prior review selected through the shared storage `list --area state --prefix review- --archive` and `read` commands with cached context. Use the exact selected relative path (including `archive/`); active duplicate wins with one deterministic warning. Never reconstruct a root-only predecessor filename. If the prior log is absent or unreadable, emit `"(predecessor review log unavailable)"` and note the degradation in `warnings`.
     - If predecessor runtime evidence is `refuted`, do not present the source-read finding as proven; mark it as predecessor-runtime-refuted in the summary text.
     - If a UI/rendered-DOM predecessor finding has `runtime_evidence:missing`, the verifier may still verify source coherence, but READY_TO_MERGE is source-coherent only and should carry an advisory that runtime confirmation was not supplied.
     - If predecessor runtime evidence is `confirmed`, treat it as support for the original finding, not as proof that the fix was verified.
   - On cycle 1 with no predecessor: use the sentinel values from the template (`"(none — this is cycle 1)"` and `"(empty)"`).

   **WAI-ARIA sub-protocol for L1-source a11y findings:** when any finding in the verification checklist has a L1-source pattern matching `ARIA|a11y|wcag|ADA|Section.508` (case-insensitive), add this one-line directive to the verification instructions: `For a11y findings: verify that fixes do not introduce aria-label-overrides-subtree issues (WAI-ARIA Accessible Name Computation §4.3: aria-label on a parent element overrides ALL subtree content for assistive technology; sr-only children are silently suppressed).`

3. **Parse verification results**:
   - After parsing the verifier verdict for the current cycle, mark the verifier handle `output_consumed: true`. Close the consumed verifier before the next-cycle verifier is spawned. If the next immediate step requires targeted interactive follow-up with the verifier for clarification, keep that verifier's `output_consumed` value `false` until the clarification is integrated; surface and persist the reason in `session_changes.warnings` when possible.
   - **All findings verified as resolved + no regressions** → Proceed to Step 7
   - **Some findings not resolved** → Do NOT retry based on the label alone. Read the verifier's cited evidence. Re-enter Step 3 only when it establishes a specific defect in the prior fix or investigation and identifies a concrete correction inside `authorized_scope`; in one validated state update, append one evidence-backed `verification` retry event, increment the shared counter, and increment `cycle_count` before returning to Step 3. If the verifier reports uncertainty, missing context, or an unsupported conclusion without an actionable defect, stop that finding as unresolved and report the evidence gap without consuming a retry. At the cap, report unresolved and stop.
   - **New regressions introduced** → Use the session change log to isolate which batch caused the regression:
     1. Look at `session_changes.changes_summary` — each entry records which finding it addresses and which files it touched
     2. Cross-reference the regression location against which batch modified those files
     3. Present the specific batch + files to the user as the likely regression source
     4. Re-enter Step 3 for the regression only when the evidence identifies a specific fix defect and a concrete in-scope correction. In one validated state update, append one evidence-backed `verification` retry event, increment the shared counter, and increment `cycle_count` before returning to Step 3. If not, or if the shared budget is exhausted, stop and report the regression and unresolved findings; do not reopen scope.
     > **Note**: This is inter-batch isolation, not intra-batch. Fixes within a batch are interdependent by design (that is why they were batched). Regression hunting happens at the batch boundary, not within a batch.

   **Auto-emit calibration on regression (Step 11b):**

   When Step 6 verifier emits a regression finding (any finding flagged as "NEW issue introduced by the fixes"):

   1. Read `session_changes.changes_summary` for the current AND any prior cycles.
   2. If the regression's `file` field matches any `changes_summary[].file` from a prior cycle's session log:
      - Queue a `fix_introduced_bug` calibration record for Step 7:
        ```json
        {"lens": "<lens>", "kind": "fix_introduced_bug", "ts": "<now>",
         "original_fix_finding_id": "<matching prior changes_summary entry's finding_id>",
         "regression_summary": "<regression finding summary>",
         "caught_by_round": <current cycle_count>,
         "predecessor_review_id": "<predecessor_review_id or current session's root_review_id>"}
        ```
   3. If the regression's location matches the `class_signature` of any prior-round finding:
      - Queue a `recurring_class_missed` calibration record:
        ```json
        {"lens": "<lens>", "kind": "recurring_class_missed", "ts": "<now>",
         "finding_id": "<prior-round finding_id>",
         "class_signature": "<class_signature>",
         "sibling_locations": ["<regression file:line>"]}
        ```

   Emit these records in Step 7 DOCUMENT (not here). Queue them in an in-memory `pending_calibration` list.

4. **Shared retry-budget enforcement**:
   - `cycle_count` starts at 1. Increment it in the same validated update as each accepted `verification` retry, before re-entering Step 3; the next Step 6 verifier uses that value. It is not a separate retry cap.
   - One `/aivv-fix` invocation has `max_rework_retries` from the setting of that name (default 3). Each actionable verifier failure that re-enters investigation consumes one retry, shared with plan-readiness, challenger, pre-write, stale-intent, class-verdict, architecture-check, investigator-output, duplicate-intent, and red-green rework.
   - At `rework_retry_count == max_rework_retries`, stop re-entry and report each unresolved finding with the cycle history and evidence, unless one more rework is clearly justified and recorded with `beyond_limit_reason` per [challenge-loop.md](challenge-loop.md). Do not ask the user to authorize another cycle or to reopen the already-authorized scope. A later top-level fix request is a new invocation.
   - **If findings increased** from the previous cycle (regression): stop immediately. Present the `session_changes` evidence, identify which batch likely introduced the regression, and report the affected findings unresolved. Do NOT assume git state is clean; name the files the user should inspect. Do not start another cycle from the regression report.

---
