# Execution Branches

Read before executing any Step 5 fix. Final Branch A/B/C/D/E/F dispatch ordering and route boundaries are centralized in [execution-decisioning.md](execution-decisioning.md); this file owns the branch mechanics after that route is selected. Branches B–F are in [execution-branches-b-to-f.md](execution-branches-b-to-f.md); read it only when a finding is dispatched to one of them.

## Contents

- [Apply the fix by category](#1-apply-the-fix-by-category) — root-cause verification, Branch A
- [Execute the prevention decision](#2-execute-the-prevention-decision)
- [Task integration](#3-task-integration)
- [Dangerous auto-apply audit](#dangerous-auto-apply-audit-when-dangerously_auto_apply_confirmed--true)

For each approved fix, in priority order (CRITICAL first), after the session-change tracking in [fix-log-contract.md](fix-log-contract.md):

## 1. Apply the fix by category

**Apply the strategic fix — dispatch by finding category**: Review each approved finding's `category` field from Step 2a (the user-facing triage column is labeled "Type" for readability; the machine field is `category` per `.aivv/schemas/finding.json`) and route to its branch: Branch A below, Branches B–F in [execution-branches-b-to-f.md](execution-branches-b-to-f.md). The "verify root cause" check applies to ALL branches — a fix that addresses symptom-not-cause is not acceptable regardless of category.

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

## 2. Execute the prevention decision

If `prevention_plan.mechanism == "none-new"`, create no prevention artifact; record its bounded `rationale` and evidence in the fix log, then continue to task integration. The minimum defect-reproducing regression test required by Step 4.4.5 is verification evidence and may still be written even when prevention is `none-new`; it is not a prevention artifact. For any additional or generalized prevention mechanism, first verify the investigator supplied a valid `eligibility_basis` and concrete `eligibility_evidence` establishing confirmed recurrence, systemic failure class, high-impact safety/security exposure, or failure of an existing control. Missing evidence routes back to Step 4.5 as an unjustified-complexity revision; do not write the artifact. When eligible, implement the proposed prevention. Path conventions are project- and host-dependent — first check the project's existing convention via its `maintainer guidance`/`AGENTS.md`/contributing doc; otherwise use the closest match below:
- `hook` → host's hook directory (`.claude/hooks/` on Claude Code projects; equivalent on other hosts) or project-level git hook (`.husky/`, `.git/hooks/`)
- `validator` → `scripts/validators/`, `tools/`, or equivalent project-script directory
- `test` → project's test directory (`tests/`, `test/`, `spec/`, language-conventional)
- `pattern-doc` → project-conventional pattern directory (`.claude/patterns/` for Claude-using projects; `docs/patterns/` for many others)
- `schema` → `.aivv/schemas/` for AIVV-internal schemas, project-schema dir otherwise
- `rule` → project-conventional rules location (`.claude/rules/`, `.cursor/rules/`, or maintainer guidance / AGENTS.md inline)

Preserve the existing convention if one is found; do NOT impose `.claude/` paths on projects that don't already use them.

## 3. Task integration

If source was a task file (`/aivv-fix TASK-XXXX`):
- Update `review_tracking.resolved_issues` with structured entries:
  ```
  "F001 [CRITICAL]: SQL injection — Root cause: missing input validation guardrail. Fixed: added validate_input() decorator to all API endpoints. Prevention: pre-commit hook checks for raw request.json usage."
  ```
- Remove resolved items from `open_issues`

---

## Dangerous auto-apply audit (when `dangerously_auto_apply_confirmed == true`)

When `dangerously_auto_apply_confirmed == true`, initialize `session_changes.dangerously_auto_apply` with `{confirmed: true, confirmation_source, bypassed_gates: [...], applied_count: 0}` before the first write, if Step 4.4 has not already recorded it. Which findings are eligible, and which gates still apply, is defined under Dangerous bypass route in [apply-policy-and-gates.md](apply-policy-and-gates.md). For every eligible finding applied through the dangerous route, increment `applied_count` and include `dangerously_auto_apply: true` plus `bypassed_gates: [...]` on that finding's `changes_summary` entry. At the end of Step 5, emit a loud audit banner:

```text
[aivv-fix] DANGEROUSLY AUTO-APPLIED <N> fix(es)
[aivv-fix] Bypassed user prompts: CHALLENGE, L1-source/manual-review refusal, high-blast-radius pause, low-confidence escalation, batched decision surface (the challenger and all other gates still ran)
[aivv-fix] Confirmation source: <interactive-exact-phrase | env:AIVV_DANGEROUSLY_AUTO_APPLY>
```

If `<N>` is zero, still emit the banner with `0` so the run log shows that the bypass was armed but did not affect any fix.
