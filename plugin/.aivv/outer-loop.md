# Outer-Loop Primitive (Step 6.5)

> **Shared contract:** referenced by both `/aivv` and `/aivv-fix`. Changes here propagate to both orchestrators; skill-specific deltas stay in the calling SKILL.md.

Shared home for the reverse-chain (`/aivv-fix` → `/aivv`) outer-loop mechanism introduced in Stage 4 of the user-preferences-system (dev.113). Referenced from [`skills/aivv-fix/SKILL.md`](../skills/aivv-fix/SKILL.md) Step 6.5 and from `/aivv`'s argument-parsing reference (the `--outer-cycle` / `--root-review-id` flag semantics).

## OUTER_LOOP_MIN_DEV constant

```
OUTER_LOOP_MIN_DEV = 113
```

Minimum dev cycle required for the outer-loop reverse-chain. The pre-dispatch canary probe reads `.claude-plugin/marketplace.json` `version` field (semver `0.1.0-dev.NN`), extracts the NN integer, and asserts `NN >= OUTER_LOOP_MIN_DEV`. If the assertion fails, the reverse-chain halts with a version warning.

**Why version-probe instead of literal-content-probe:** the literal `--root-review-id=` token only exists in the version that ships outer-loop, making the canary chicken-and-egg during the Stage-4 IV&V bootstrap. Semver-based check is cleanly decidable: stale plugin cache reports lower dev.NN than the current `marketplace.json`, so the canary correctly distinguishes "old cached skill" from "current version." (Rationale per round-2 F002 of the design spec.)

## State file schema

Outer-loop state is persisted at `<state_dir>/outer-loop-<root_review_id>.json`.

## State ownership

The outer-loop primitive is the **sole read-modify-write owner** of
`outer-loop-<root_review_id>.json`. It creates the file, reads prior state,
merges cycle and scope inputs, updates it, and deletes it on clean termination.
No other `/aivv` reference or helper may open this file for a read-modify-write
operation or create an independent replacement.

Scope confirmation is input-only for this state: it returns
`final_scope` to the orchestrator. The outer-loop owner records that value as
`scope_confirmation.final_scope` during its next normal write. On cycle N>=2,
the owner supplies the prior `scope_confirmation.final_scope` to scope
confirmation as an input; scope confirmation does not read the state file
itself. This preserves confirmed scope without introducing a second writer.

```json
{
  "schema_version": 2,
  "root_review_id": "<invocation_id from /aivv cycle 1>",
  "outer_cycle_count": 1,
  "last_fingerprint": "<SHA-1 hex | null on cycle 1>",
  "started_at": "<ISO 8601 UTC — set on cycle 1, never changed>",
  "updated_at": "<ISO 8601 UTC — updated each cycle>",
  "scope_confirmation": {
    "final_scope": "<optional confirmed scope retained by the owner>"
  }
}
```

**Field semantics:**
- `root_review_id` — the `/aivv` invocation ID from outer cycle 1. Set on cycle 1; propagated unchanged via `--root-review-id=<id>` through all subsequent cycles. Anchors the state file path so cycle N+1 finds the same file as cycle 1.
- `outer_cycle_count` — current cycle number. Bumped BEFORE writing state and BEFORE invoking the reverse-chain Skill tool (so crash between write-and-invoke leaves state at the new count, recoverable by manual `--outer-cycle=<count+1>`).
- `last_fingerprint` — SHA-1 fingerprint of sorted finding signatures from the previous cycle. `null` on cycle 1 (no-progress check skipped on first entry). See No-progress algorithm below.
- `started_at` — timestamp of cycle-1 state creation. Never mutated.
- `updated_at` — timestamp of most recent state write.
- `scope_confirmation.final_scope` — optional confirmed scope supplied by the
  scope-confirmation gate. It is merged only by this primitive and is supplied
  back to that gate on later cycles.

**State cleanup:** on clean termination (no continuation-counting findings remain), delete the state file (history not needed post-success). On all other terminations (cap, no-progress, user-interrupt, capability-unavailable), leave the state file for user inspection. All mutations use the shared storage mutation helper under its target operation lock. Never delete or quarantine legacy originals.

## No-progress algorithm

Compute the fingerprint of the current outer cycle's continuation-counting findings using the canonical `git hash-object` formula:

**Step 1 — collect continuation-counting subset:**
- Include findings where `recommended_next_step ∈ {fix-now, investigate-first}`
- For legacy findings that lack `recommended_next_step`, include findings where `severity ≥ outer_loop_severity_floor` (CRITICAL or MAJOR per config value)
- Exclude L1-source findings (WCAG/FTC/GDPR/ADA/Section 508/COMP-LEGAL-*/A11Y-*/DP-LEGAL-* per the `skills/aivv-fix/references/polish-and-l1-source-policy.md` L1-source detection regex)
- Exclude POLISH-tier findings (POLISH never counts toward continuation)

**Step 2 — sort and serialize:**
All signatures are normalized to 4-tuples `(severity, rule_id, file, line)` with empty string substituted for any missing or null field:
- `rule_id` → empty string when the finding envelope lacks it (pre-dev.41 path or reviewer-emitted without the optional field)
- `file` → empty string when the finding has no file attribution (whole-project finding)
- `line` → empty string when no line is attributed (file-level finding)

Sort all 4-tuples by tuple-comparison ascending (alphabetic string comparison on each field; empty string sorts before any non-empty value).

Concatenate all tuples as a newline-separated string with fixed-arity colon-delimited form:
`<severity>:<rule_id>:<file>:<line>\n...`

Examples: a CRITICAL finding with no rule_id, no file, no line → `CRITICAL:::`; a MAJOR A11Y-001 finding at `src/foo.ts:42` → `MAJOR:A11Y-001:src/foo.ts:42`.

**Step 3 — compute SHA-1:**

```bash
git hash-object --stdin --no-filters <<'EOF_AIVV_OL'
<serialized tuples string>
EOF_AIVV_OL
```

(The single-quoted delimiter `'EOF_AIVV_OL'` suppresses shell parameter expansion and backtick interpretation — critical because finding `file` and `summary` fields may contain `$`, backticks, or other shell-special characters that would otherwise corrupt the hash input.)

Capture the hex SHA-1 as `current_fingerprint`.

**Step 4 — compare:**
If `current_fingerprint == last_fingerprint` (and `outer_cycle_count > 1`): halt with no-progress banner. If not equal (or cycle 1): store `current_fingerprint` as `last_fingerprint` in state file; continue.

**Rationale for rule_id over summary:** cold_multi_review produces LLM-text variance in `summary` across cycles even for identical defects. `rule_id` is the stable dedup-anchor already used by `/aivv` Step 6 consensus synthesis; it gives deterministic same-defect detection across outer cycles.

## Reverse-chain Skill-tool invocation form

```
Skill tool:
  skill: "aivv:aivv"
  args: "--fix --outer-cycle=<new_count> --root-review-id=<root_id> [--target=<dir>] [--dry-run]"
```

Where `<new_count>` is the post-increment `outer_cycle_count` written to the state file in Step 6.5 Phase G (i.e., the prior count + 1), and `root_id` is the `root_review_id` from the state file (unchanged throughout the chain). The variable name `<new_count>` matches the SKILL.md Step 6.5 prose; the form `<N+1>` (where N is the PRIOR cycle count before increment) is equivalent but was previously ambiguously documented.

**`--target=<dir>` propagation:** propagate verbatim if set on the originating /aivv-fix invocation.
**`--dry-run` propagation:** propagate verbatim if set.
**All other args NOT propagated:** findings for the next cycle come from /aivv's fresh re-review of current code state, not from the prior /aivv-fix invocation's argument string.

## Pre-dispatch canary probe procedure

1. Read `.claude-plugin/marketplace.json` via host's read primitive.
2. Parse JSON. Extract the AIVV version via the nested path `.plugins[] | select(.name == "aivv") | .version` (or `.plugins[0].version` for single-plugin marketplace files). **There is NO top-level `version` field** — the version lives under `.plugins[].version`. Example: `jq -r '.plugins[] | select(.name == "aivv") | .version' .claude-plugin/marketplace.json` → `"0.1.0-dev.114"`.
3. Parse the dev.NN integer from the semver string (e.g., `"0.1.0-dev.114"` → `114`). If parse fails (version field absent, unexpected format, jq unavailable), surface warning and proceed anyway (conservative degradation: log `{"code": "outer_loop_canary_parse_failure", ...}` + proceed; the canary's purpose is to catch STALE cache, not to block on unexpected formats).
4. If `NN >= OUTER_LOOP_MIN_DEV` (113): proceed with Skill handoff.
5. If `NN < OUTER_LOOP_MIN_DEV`: halt and surface:
   > "Outer-loop reverse-chain requires AIVV ≥ 0.1.0-dev.113; cached version is 0.1.0-dev.{NN}. Restart Claude Code and re-run after upgrading to dev.113+."
   Set `capability_degradations: ["outer_loop_min_dev_not_met"]` in fix-log.

## Termination banners

| Condition | Banner text |
|---|---|
| **Cap reached** (continuation-counting findings remain at max cycles) | `Halted after {N} outer cycles (configured cap = {max}). {K} continuation-counting findings still open — likely architectural / require human judgment. Root review: {root_review_id}. State: <state_dir>/outer-loop-{root_review_id}.json` |
| **No-progress** (fingerprint identical between two consecutive cycles) | `No progress between outer cycles {N-1} and {N} — same {K} continuation-counting findings persist (rule_ids: {rule_id_list}). Halting to prevent infinite loop. Root review: {root_review_id}` |
| **Clean** (no continuation-counting findings remain) | `Outer loop converged at cycle {N}. No continuation-counting findings remain.` |
| **L1-regression at exit** (L1-source count non-zero at clean exit, or increased from prior cycle) | `⚠ Outer loop reached clean state on continuation-counting axis. BUT {L} L1-source findings remain — review legal/compliance implications before considering this cycle complete. L1 findings are forced-shown regardless of severity_threshold; they were excluded from continuation logic but require human disposition.` |
| **User-interrupt** (Ctrl-C or explicit user halt at any `/aivv-fix` inner-loop gate) | `Outer loop interrupted at cycle {N}. {K} findings remain. Resume: /aivv --fix --root-review-id={root_review_id} --outer-cycle={N}` |

**Notes:**
- The "clean-by-auto-disposition" banner row was removed (round-3 F001 of the design spec: disjoint-set analysis proved the underlying gate was unreachable — MINOR/POLISH severity was in the continuation-counting exclusion set, so no finding could ever be auto-disposed away while still counting toward continuation).
- The `--dry-run` note: outer-loop check is structurally bypassed when `--dry-run` is set — `/aivv-fix` Step 4 halts before Step 6/6.5 are reached; the outer-loop trigger condition is defense-in-depth only. A one-line note emits at Step 4 dry-run output: `"Outer loop disabled under --dry-run (--dry-run halts at /aivv-fix Step 4; Step 6.5 outer-loop check is never reached)."` This is an informational note, not a banner.

## Capability-unavailable degradation

If `can_invoke_peer_skill` is `unavailable` on the active host, Step 6.5 surfaces:

> "Outer-loop reverse-chain not available on this host (`can_invoke_peer_skill` unavailable); halting after current /aivv-fix cycle. Re-run `/aivv --fix --root-review-id=<id> --outer-cycle=<N+1>` manually to continue."

Set `capability_degradations: ["outer_loop_reverse_chain_unavailable"]` in fix-log. Do NOT loop; do NOT use same-agent dispatch as a substitute for the reverse-chain (the independence guarantee requires the fresh `/aivv` invocation to run cold).
