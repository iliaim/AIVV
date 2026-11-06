# Auto-Chain Handoff

Read only when `/aivv --fix` or resolved config requests auto-chain.

## Trigger

Set `fix_chain_requested = true` only for explicit `--fix` or resolved
`auto_chain_fix: always`. Otherwise Step 8 is skipped.

This step is reached only after the review scope and method are resolved under
[scope-confirmation.md](scope-confirmation.md). A review held for necessary
clarification cannot dispatch reviewers, write a review log, or hand off to fixes.

If a legacy caller supplies `scope_fix_chain_suppressed = true`, keep the chain
withheld and emit:

```text
Review scope is unresolved; fix handoff is withheld. Resolve the material scope or method question before running the review and any fix handoff.
```

## Decision Checkpoint

A finding is action-driving when severity is `CRITICAL`/`MAJOR`,
`recommended_next_step` is `fix-now`/`investigate-first`, or user/viewer selected
`fix`.

Checkpoint is required when action-driving finding is consequential:

- sec lens, L1-source forced-show, security/compliance-sensitive scope/output
- runtime-sensitive without supplied runtime evidence
- low confidence
- medium confidence plus CRITICAL/MAJOR, high blast radius, runtime sensitivity,
  L1-source, security, or compliance-sensitive scope
- mixed reviewer agreement on action-driving CRITICAL/MAJOR
- high-blast-radius paths: auth, schema, migration, CI/build, public API,
  generated verification code

Choices: continue into `/aivv-fix`, dry-run plan, select findings, or stop.

Non-interactive consequence-gated writes are suppressed unless policy explicitly
permits dry-run-only routing. `auto_chain_fix: "always"` is not consent for
non-interactive write-capable consequential fixes.

Render checkpoint, record `decision_checkpoint`, write review log, then invoke
`/aivv-fix`.

## Durable Handoff

Invoke `/aivv-fix --review-id=<invocation_id>` after Step 7.5 writes
`review-<invocation_id>.json`. This works in fresh sessions without conversation
memory. Carry stored policy lookup provenance additively, re-read current policy
at that location, and never restore serialized auto-apply approvals. Carry the
cached invocation context into the child. Its automatically propagated `--target`
is routing information; preserve the original policy provenance rather than
treating this generated argument as a fresh user policy override.

Propagate only:
- `--review-id=<id>` always
- `--target=<bound-target>` always, using the cached storage context
- `--dry-run` when set
- `--root-review-id=<id>` when received; otherwise initialize to current
  invocation id on cycle 1
- `--outer-cycle=<N>` when received

Do not propagate reviewers, lens, or original positional args; the review log is
the source of findings and scope.

If `--dry-run` is propagated, do not auto-open/generate a post-fix report. Print
the manual Step 7.6 viewer command when viewer behavior is enabled.

<!-- CLAUDE-CODE-SPECIFIC -->
Claude Code uses `Skill` with `skill: "aivv:aivv-fix"` and args above. Codex
continues same-agent into the fix workflow; durable `--review-id` preserves the
handoff contract.

## Stale-Cache Canary

aivv:stale-cache canary

Before Claude Code `Skill` handoff, check the live cached `aivv-fix/SKILL.md`
for the string `storage-paths.mjs`. If absent or file missing, halt auto-chain and
tell the user the loaded skill body is stale and would silently drop `--target=`
or external storage routing; ask them to restart and rerun. Do not continue the chain.

This defends the known stale skill-registry failure mode; it is not a universal
version check.

## Fix Safety Gates Still Apply

`--fix` does not bypass `/aivv-fix` gates: adversarial investigator,
low-confidence handling, high-blast-radius pauses, trade-off pauses, wont-fix
acceptance, and `--dry-run` plan-only behavior all remain active.

Clean review behavior:
- Explicit `--fix`: invoke `/aivv-fix`; its no-findings path is cheap.
- Config-only `auto_chain_fix: always`: do not invoke for clean review.

If peer-skill invocation fails, report and suggest manual `/aivv-fix`; do not
retry silently.
