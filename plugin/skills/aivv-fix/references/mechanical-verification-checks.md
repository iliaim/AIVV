# Mechanical Verification Checks

Read from `skills/aivv-fix/SKILL.md` before post-write mechanical verification.

## Contents

- Fix-bundle coherence pass
- Fix-log hygiene assertions
- Cycle-N+1 sibling-surface grep
- Step 5.7 verification-code execution

### Step 5.5: Fix-bundle coherence pass (orchestrator-side, advisory)

After all per-finding fixes are applied in Step 5 AND before dispatching the Step 6 verifier (or running same-agent verification), execute these orchestrator-side checks against the fix-bundle as a whole. Outputs are advisory warnings logged to the fix-log's top-level `warnings` array; they do NOT block Step 6 dispatch but ARE included in the verifier's input.

1. **Cross-task signature scan (v1 best-effort — backtick-only extraction).** Extract identifiers from `changes_summary[].change` prose using backtick-delimited tokens only: regex `` `([A-Za-z_][A-Za-z0-9_]*)` `` over the prose. For each extracted identifier, grep ALL occurrences in the modified file(s). If the identifier appears in ≥2 distinct sections (counted by the same heading regex as the dev.44+ multi-section detection heuristic — lines matching `^### Task ` OR `^## Phase ` OR `^### Phase ` OR `^## §[0-9]` OR `^### Step [0-9]` OR `^### T[0-9]`) AND any other-section occurrence's usage shape does not match the fix-targeted section's new shape, log `{"code": "signature-drift-suspect", "finding_id": null, "identifier": "<name>", "lines": [<L1>, <L2>, ...], "ts": "<now>"}`. v1 ships with documented under-coverage; non-backticked identifiers in prose are not extracted.

2. **Cross-task ENUMERATE-ALL audit (v1 narrow trigger list).** For any fix described as "refactor X", "lift Y to Z", "delete obsolete W", or "rename A → B" (detected by substring match on `changes_summary[].change`), grep for X/Y/A in the file. If the identifier still appears in sections OUTSIDE the fix-targeted section, log `{"code": "enumeration-incomplete-suspect", "finding_id": null, "identifier": "<name>", "residual_lines": [<L1>, ...], "ts": "<now>"}`. v1 ships with documented under-coverage; common synonyms (extract/promote/remove/consolidate/fold/inline/drop/move) and the bare ASCII `->` arrow form are NOT caught — broaden after dogfood calibration.

3. **Empirical-claim audit (v1 narrow scope — file:line citation + claim pattern).** Scan `changes_summary[].change` entries for prose matching the narrow trigger: a backticked or quoted file:line reference (`path/file.ext:NN` OR `[file.ext](path):NN`) followed within the same sentence by a claim verb from `(uses|ships|renders|supports|includes|doesn't include|isn't in|is in|coverage|introduces|requires|defaults to)`. If matched, log `{"code": "unverified-empirical-claim", "finding_id": "<F###>", "claim_excerpt": "<sentence>", "cited_file_line": "<path:N>", "ts": "<now>"}` and suggest empirical probe.

4. **Cross-task prose-value scan (v1 multi-section-doc extension — numeric/name changes in prose).** Applies only when the modified file is a multi-section cross-task documentation file — same condition as the dev.44+ multi-section detection heuristic (sub-check 1 heading regex: `^### Task `, `^## Phase `, `^### Phase `, `^## §[0-9]`, `^### Step [0-9]`, `^### T[0-9]`, ≥3 matches). For each `changes_summary[].change` entry, extract: (a) any digit sequence that appears in a count-context phrase (regex: `\b(\d+)\s+(?:peers?|files?|tasks?|steps?|rules?|sections?|back.?references?|items?|entries?)\b` — capture the leading digit); (b) any "from N to M" or "N → M" or "N to M" numeric-transition phrase (regex: `\b(\d+)\s*(?:to|→)\s*(\d+)\b` — N is the old value, M is the new); (c) any rule-ID identifier changed in prose (regex: `\b(HEU-\w+|UJ-\w+|VVT-\d+|IS-\d+|A11Y-\d+|UX-\d+|VD-\w+)\b`). For each extracted old-value: grep for it in ALL sections of the modified file (not just the fix-targeted section). If it appears in ≥1 OTHER section not covered by the fix, log `{"code": "prose-value-drift-suspect", "finding_id": null, "old_value": "<N_or_name>", "residual_lines": [<L1>, ...], "context": "<count-type or id-pattern>", "ts": "<now>"}`. v1 applies to multi-section documentation files only; single-section files and code files are out of scope. Documented limitation: count-context phrase regex matches common nouns only — domain-specific count nouns not in the list are not extracted; extend incrementally after dogfood calibration.

The pass is **advisory** (warning-level, never blocking). When Step 6 VERIFY dispatches the verifier (cold or same-agent), the verifier reads the fix-log's `warnings` array and weighs them in its decision. Purpose: surface cross-task drift BEFORE declaring complete — even if eligibility routes to same-agent verification (rare residual cases the dev.44 predicate doesn't cover), Step 5.5 gives the same-agent path a coarse coherence signal it currently lacks.

**Fix-targeted section inference (v1 heuristic).** Sub-checks 1 and 2 require knowing which section in the modified file is the "fix-targeted section". The v1 orchestrator infers this by mapping the edit's line range (the lines actually touched by the Step 5 Edit/Write call) to the nearest preceding heading-regex match (same regex as sub-check 1). Documented silent-no-op: if the edit's line range cannot be determined OR no preceding heading matches OR the file has fewer than 2 heading-regex matches total, sub-checks 1+2 emit zero warnings for that fix entry — distinguishable from "clean fix-bundle" only by the absence of the heading-match log. v2 considers an explicit `changes_summary[].section_anchor` schema field for deterministic anchoring.

---

### Step 5.6: FIX-LOG HYGIENE — Mechanical Assertions

After Step 5.5 (coherence pass advisory warnings) and before Step 6 (verifier dispatch), run these orchestrator-side mechanical assertions against the session log. No LLM reasoning required — these are structural checks.

```
assert set(entry.finding_id for entry in changes_summary) == set(findings_addressed) - set(findings_deferred)
  rationale: one finding may produce multiple changes_summary entries (e.g., code-edit + documentation); length equality would false-positive on those valid cases. Set-coverage checks that every finding_id that was addressed AND not deferred appears in changes_summary — not that the counts are equal.
  on fail: append warning {"code": "fix-log-hygiene-changes-summary-finding-mismatch", "expected_ids": sorted(set(findings_addressed) - set(findings_deferred)), "actual_ids": sorted(set(e.finding_id for e in changes_summary)), "ts": "<now>"}

assert len(files_modified) + len(files_created) > 0 OR every changes_summary entry has type ∈ {documentation, process-rule, design-adr}
  rationale: build-script, ci-gate, and verification-method fixes create NEW files (files_created) rather than modifying existing ones (files_modified). Checking only files_modified > 0 would false-positive on legitimate new-script bundles. The combined count covers both cases.
  on fail: append warning {"code": "fix-log-hygiene-empty-files-modified-with-code-edits", "ts": "<now>"}

assert status == "in-progress" at this point
  on fail: append warning {"code": "fix-log-hygiene-unexpected-status", "status": "<actual>", "ts": "<now>"}

assert cycle_count >= 1
  on fail: HALT with "fix-log-corrupted-cycle-count: cycle_count is <actual>; minimum expected 1. Session log may be corrupted. Inspect <fix_log_path> manually."

assert every changes_summary entry has non-empty {finding_id, category, file, change, type}
  on fail: append warning {"code": "fix-log-hygiene-incomplete-changes-summary-entry", "finding_id": "<F###>", "missing_fields": ["<field>"], "ts": "<now>"}
```

**Recovery behavior:**
- Missing `cycle_count` → default to `1`, continue (does not HALT; add warning `fix-log-hygiene-missing-cycle-count-defaulted-to-1`).
- Missing `status` → default to `"in-progress"`, continue.
- Other assertion failures → append warning, continue to Step 6 (the verifier sees the warnings).
- `cycle_count < 1` → HALT (only case that stops execution before Step 6).

The Step 6 verifier prompt receives the `session_changes.warnings` array and is instructed to weigh them. Step 5.6 warnings that indicate structural incompleteness (missing changes_summary entries) are particularly load-bearing — a verifier reviewing incomplete records cannot determine whether the fix was applied.

---

### Step 5.6.5: Cycle-N+1 mandatory sibling-surface grep (AC-X3)

When `cycle_count >= 2`, the orchestrator's recovery path automatically runs:

For each string the prior cycle's Edits REPLACED (extracted from `prior_cycle_snapshots[-1].changes_summary` `change` field — parse the Edit semantic from the change description), run:

```bash
grep -rnF -- "$original_string" "$target_project" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.aivv/state \
  2>&1 | head -50
```

- If grep returns hits in files NOT modified by the prior cycle: emit warning `sibling-surface-drift-cycle<N>-original-string-survives-in-<file>`. Append to a new sub-finding list for the next round of investigation.
- If grep returns no hits: clean — proceed.

**Promotion of dev.91+ Discipline 2 from author-side advice to orchestrator-side check.** Prevents the dev.123 N1/N3 class where a fix on one surface leaves the same wrong string on a sibling surface.

---

### Step 5.7: ORCHESTRATOR EXECUTION — Run New Verification Code

After Step 5.6 hygiene pass, execute any verification scripts the fix bundle authored. This runs BEFORE Step 6 verifier dispatch so the verifier receives concrete execution evidence rather than having to infer from script inspection alone.

**Trigger:** any `changes_summary[]` entry with `type ∈ {build-script, ci-gate, verification-method}` AND the resolved config has `enable_step_57_execution: true` (default `false` — see Task 3 for schema registration). When `enable_step_57_execution: false` (default for first 3 dogfood cycles per the default-off ship discipline), Step 5.7 is SKIPPED entirely. The Step 6 verifier still receives the `type` enum signals and reasons structurally about whether the verification code looks correct — but the orchestrator does NOT execute any script. Override for current invocation only: `--enable-step-57-execution` flag.

**Algorithm (per qualifying entry, when enabled):**

1. **Existence + path-safety preconditions** — for each entry's `file`:
   - Resolve: `real_path = os.path.realpath(os.path.join(target_project, entry.file))`. Use `os.path.realpath` (resolves ALL symlinks in the full path, including parent-directory symlinks), NOT `os.path.abspath` (which is lexical-only and does NOT resolve symlinks — a parent-directory symlink would bypass the commonpath check with abspath).
   - Assert inside target: `os.path.commonpath([real_path, os.path.realpath(target_project)]) == os.path.realpath(target_project)` (NOT string-prefix — handles `..` traversal; both paths resolved via realpath before comparison). On failure: append warning `step-5-7-path-outside-target`, skip entry.
   - Assert exists: `os.path.isfile(real_path)`. On failure: append warning `step-5-7-file-missing-at-exec-time`, skip entry.
   - Assert not symlink: `not os.path.islink(real_path)`. On failure: append warning `step-5-7-symlink-rejected`, skip entry. (Note: after realpath resolution, this check catches the case where `real_path` itself is a symlink that realpath could not follow — e.g., a dangling symlink. In practice, with realpath fully resolving the path, this is defense-in-depth rather than the primary guard.)

2. Extract the `file` from the `changes_summary` entry. Infer the command:
   - `.sh` → `bash <file>`
   - `.mjs` or `.js` → `node <file>`
   - `.py` → `python3 <file>`
   - `.yml` / `.yaml` (CI workflow) → DO NOT execute locally; emit note: `ci-gate files cannot be run locally; evidence will be absent; verifier is informed`
   - User-preferences `verification_command_map` overrides the default per extension.

   **argv construction:** when the entry's `fix_proposal.verification_method.command_args` is a non-empty array, use it verbatim as `argv[1:]` (positional arguments after the interpreter + script path). When absent or empty, default `argv[1] = <target_project>` (the resolved absolute path from Step 5.0). This honors the investigator's advisory binding for scripts that expect a fixed-path artifact other than the project root (e.g., a manifest verification script reading a snapshot fixture).

3. Run the command via the host's shell primitive (`Bash` on Claude Code; `shell_command` on Codex). Capture stdout, stderr, and exit code. Hard limit: 60-second timeout (configurable via user-preferences `step_57_timeout_seconds: <N>` (range 5–600)). Wrap with `timeout 60 <command> <file>`. On exit 124 (timeout), mark `execution_evidence.timed_out: true`, capture partial stdout/stderr, and append warning `{"code": "step-5-7-timeout", "file": "<file>", "ts": "<now>"}` to `session_changes.warnings`.

4. Append to `changes_summary[].execution_evidence`:
   ```json
   {
     "command": "node scripts/verify-bundle-shape.mjs",
     "command_argv": ["node", "scripts/verify-bundle-shape.mjs", "/absolute/target/project"],
     "exit": 0,
     "stdout_excerpt": "<first 8 KiB of stdout — append '(truncated)' if actual output exceeded this>",
     "stderr_excerpt": "<first 8 KiB of stderr — append '(truncated)' if actual output exceeded this>",
     "timed_out": false
   }
   ```

5. **Do NOT fail the cycle on non-zero exit.** The script may have found a legitimate issue the verifier should surface. Append a warning: `{"code": "step-5-7-nonzero-exit", "file": "<file>", "exit": N, "ts": "<now>"}` to `session_changes.warnings`.

6. Write `execution_evidence` to the session log immediately (atomic full-object write per Step 5's write semantics). New Step 5.7 writes include `command_argv` as the exact tokenized command used for execution; legacy fix logs may omit it and remain readable.

**Security boundary:** the orchestrator runs the script — NOT the verifier subagent. The reviewer's read-only contract is preserved. Scripts run with the same permissions as the orchestrator process.

**Step 6 verifier receives:** the `execution_evidence` for each qualifying entry, via the new "Execution Evidence" section in the verifier prompt (see `references/verifier-prompt-template.md`).

**Override:** `--disable-step-57-execution` flag (or set `enable_step_57_execution: false` in project config) skips Step 5.7 for the current invocation. Use when scripts have known side effects or require a specific environment not available in the orchestrator process.

---

### Objective Evidence Closure

Before Step 7 reports a terminal disposition, collect `objective_evidence` entries for every `closed`, `closed_with_residual_risk`, or `false_positive` finding in `final_dispositions[]`.

Accepted objective evidence kinds: `test-output`, `command-output`, `schema-validation`, `grep`, `runtime-evidence`, `source-citation`, and `verifier-result`.

Decision and attestation artifacts such as `accepted-risk-rationale`, `manual-confirmation`, `residual-risk-rationale`, `approver`, and `approval_timestamp` may approve execution or risk acceptance, but they are not objective evidence.

Closure rules:
- `closed` requires objective evidence and no known residual risk requiring user acceptance.
- `closed_with_residual_risk` requires objective evidence plus residual-risk rationale and approver.
- `false_positive` requires objective evidence that refutes the reported condition.
- Pure non-remediation acceptance uses `accepted_risk`.
- If no objective evidence exists, use `needs_evidence`, `needs_rework`, `deferred`, or `accepted_risk`, not `closed`, `closed_with_residual_risk`, or `false_positive`.
