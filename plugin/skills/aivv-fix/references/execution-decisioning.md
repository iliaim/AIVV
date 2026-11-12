# Execution Decisioning

Read from `skills/aivv-fix/SKILL.md` before deciding whether a finding is contained, investigated, challenged, auto-applied, queued for user decision, skipped by policy, dry-run halted, or dispatched to Branch A/B/C/D/E/F.

This is the canonical cross-step decision map. The detailed mechanics stay in the step references named below; this file owns ordering, route boundaries, and the invariant that no execution route may collapse multiple gates into "just edit".

## Canonical Ordering

Evaluate execution readiness in this order:

1. **Source and policy binding**: parse flags, resolve preferences, and bind `fix_apply_policy`, `--dry-run`, `--apply-all-polish`, `--dangerously-auto-apply`, POLISH/L1-source policy, lifecycle context, and any review decisions.
2. **Triage**: assign severity, disposition, `category`, `investigation_mode`, provisional batch, and containment eligibility.
3. **Containment check**: when active blast radius exists, decide whether a reversible containment action is available. Containment is symptom-level risk reduction; it never replaces root-cause investigation or Branch A/B/C/D/E/F execution.
4. **Investigation route**: use the low-risk fast path only when every eligibility gate passes; otherwise dispatch or fall back per `investigation-dispatch.md`. Preserve category and `recommended_next_step` for later gates.
5. **Plan reconciliation**: merge batches whose `files_to_modify` overlap, handle special verdicts, run architectural-remediation and Gate 1/2/3 checks, then compute `fix_confidence`.
6. **Write readiness**: materialize fresh `write_intents[]`, run detector assertions, and dispatch Step 4.5 CHALLENGE when triggered. Only a specific evidence-backed in-scope defect can produce a REVISE/REJECT re-entry; it consumes the shared retry budget and invalidates affected intents before investigation/planning.
7. **Final route classification**: after write intents, challenge, red-green intent, and consequence gates settle, classify each finding as exactly one of Auto-eligible, Decision queue, Architecture decision queue, or Skipped by policy.
8. **Execution halt or dispatch**: `--dry-run` halts before stateful remediation writes. Non-dry-run findings approved for execution dispatch to Branch A/B/C/D/E/F by `category`, then run Step 5.4+ mechanical checks and Step 6 verification.

## Execution Decision Ledger

Keep a per-finding decision ledger. From Step 4.4 it is persisted as `decision_ledger[]` in the fix log and updated in the same validated write as each decision, so a compaction, stop, or Resume does not lose it; before Step 4.4, and under `--dry-run` (which persists nothing), it is held in memory. Each entry records:

- `finding_id`, `category`, severity, disposition, source, and batch.
- Containment status: `not-applicable`, `available-when-triggered`, `applied`, or `declined`.
- Investigation route: `cold-investigator`, `same-agent-fallback`, or `fast_path_inline`.
- `fix_confidence` plus demotion reasons.
- Write-intent status: `missing`, `fresh`, `stale`, `unsupported-risky-shape`, `unsupported-risky-path`, or `validated`.
- Challenge status: `not-triggered`, `approved`, `revise`, `reject`, `gate-fused-safe`, `budget-skipped-safe`, or `budget-halted-risky`.
- Final route: `auto-eligible`, `decision-queue`, `architecture-decision-queue`, `skipped-by-policy`, or `dangerously-auto-approved`.
- Final branch: `A`, `B`, `C-adr`, `C-fallthrough-A`, `D`, `E`, or `F`.

The ledger prevents later steps from re-deriving decisions from prose. When Step 5 records applied changes, copy the relevant final route, branch, bypass reasons, and warning state into `changes_summary`, `findings_deferred`, `dangerously_auto_apply`, or `warnings` as applicable.

## Route Boundaries

- **Auto-eligible** means policy is `auto`, `fix_confidence == "high"`, write intents are fresh and validated, no unresolved CHALLENGE concern exists, no L1/manual-review guard fires, no high-blast-radius/shared-interface pause fires, and no architectural decision is required.
- **Decision queue** means user choice is required because policy is `ask`, policy `skip` is blocked by a safety floor, confidence is medium/low, a trade-off exists, a shared interface or >3 files are touched, L1/manual-review applies, or severity/disposition requires visibility.
- **Architecture decision queue** means architectural remediation is required or not structurally disproved. Do not downgrade it to ordinary tactical editing unless the selected local option removes the class root cause or explicit architecture-specific approval is recorded.
- **Skipped by policy** is allowed only below safety floors. `fix_apply_policy.* = skip` cannot hide CRITICAL/MAJOR findings, `fix-now` / `investigate-first` findings, active containment candidates, or L1-source/manual-review findings.
- **Dangerously-auto-approved** is available only after `--dangerously-auto-apply` is confirmed with `DANGEROUSLY AUTO APPLY` or `AIVV_DANGEROUSLY_AUTO_APPLY=1`. It bypasses the W10 decision prompt, not dry-run, unsupported risky paths, stale write intents, missing write intents, architectural approval, or verifier obligations.

## Branch Dispatch Rules

Final branch selection is evidence-driven:

- `code-bug` -> Branch A.
- `documentation-gap` -> Branch B when empirical evidence and verbatim content are present; otherwise Branch E.
- `design-flaw` -> Branch C ADR path when options/trade-offs are load-bearing; Branch C localized fallthrough to Branch A when the design fix is scoped and unambiguous.
- `process-violation` -> Branch D.
- `clarification-needed` -> Branch E.
- `improvement` -> Branch F, surfaced as POLISH and constrained to behavior-preserving, scoped changes.

Missing or unknown `category` falls back to Branch A only with an explicit warning in the decision ledger and later `session_changes.warnings`.

## Required References By Phase

- Flags/preferences/POLISH/L1: `fix-flags.md`, `fix-preferences.md`, `polish-and-l1-source-policy.md`.
- Triage/containment: `triage.md`, `containment.md`.
- Investigation: `fast-path.md`, `investigation-dispatch.md`.
- Planning and final route classification: `apply-policy-and-gates.md`.
- Write readiness: `write-intents-and-prewrite-validation.md`, `challenge-loop.md`, `red-green-gate.md`.
- Execution and audit: `fix-log-contract.md`, `execution-branches.md`, `mechanical-verification-checks.md`.

Do not use this reference as a substitute for those mechanics; use it to preserve their ordering and avoid duplicated route decisions.
