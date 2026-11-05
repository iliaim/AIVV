---
name: aivv-calibrate
description: "Use for read-only analytics on a target project's AIVV calibration corpus. --migrate is the explicit, target-local maintenance exception that relocates legacy files."
argument-hint: "[--lens=<lens>] [--target=<dir>] [--all-lenses] [--raw] [--migrate]"
---

# AIVV Calibrate — Read-Side Analytics Skill

Without `--migrate`, this skill emits read-only analytics over a single project's calibration corpus:
external target-instance calibration and read-only legacy shared files plus shards
(per-invocation sharding contract). The shared storage resolver owns the external location. Completed
imports count each covered source file once; changed imported legacy bytes remain
historical until explicit reconciliation. Analytics never initialize a store.
`--migrate` is an explicit, target-local maintenance operation that relocates a
legacy shared file into the shard directory.

## Contract

- **Default analytics are read-only:** without `--migrate`, perform no state
  writes, subagent dispatch, or code mutations.
- **Explicit maintenance exception:** only an argument that already includes
  `--migrate` may relocate `<lens>.jsonl` to `<lens>/legacy.jsonl` in the
  selected target. Do not add `--migrate` on the user's behalf. The operation
  is git-aware and idempotent; it does not rewrite record contents.
- Target-only: no cross-project aggregation and no rescaling-formula
  consumption. Those remain deferred to v0.3.
- Visualization only: the output informs a human; it does not feed review-time
  logic.
- Minimum-N floor: FP/TP rates emit `insufficient_data` when the denominator is
  below 5.

## Host Adapter Mapping

| Adapter operation | Claude Code | Codex |
|---|---|---|
| Run analytics | `Bash` | `shell_command` |
| Run explicit `--migrate` maintenance | `Bash` | `shell_command` |
| Read-only fallback | `Read` | `shell_command` with `cat` |

The full host capability matrix is in
[.aivv/runtime-contract.md](../../.aivv/runtime-contract.md). Claude Code
behavior specifics are in
[.aivv/platform-adapters/claude-code.md](../../.aivv/platform-adapters/claude-code.md).
Codex behavior specifics are in
[.aivv/platform-adapters/codex.md](../../.aivv/platform-adapters/codex.md).

## Usage

```bash
/aivv-calibrate
/aivv-calibrate --lens=sec
/aivv-calibrate --target=/path/to/project
/aivv-calibrate --all-lenses
/aivv-calibrate --raw
/aivv-calibrate --migrate --all-lenses   # explicit maintenance: relocate legacy <lens>.jsonl → <lens>/legacy.jsonl (git-aware, idempotent)
```

## Instructions

When `/aivv-calibrate` triggers:

1. Preserve strict read-only mode unless the user's original arguments include
   `--migrate`. Never add that flag to an analytics request.

   When `--migrate` is present, treat the invocation as the explicit,
   target-local maintenance exception: it may relocate only legacy calibration
   files under the selected target. Preserve the flag exactly; do not combine
   it with any other write behavior.
2. Resolve the AIVV plugin/runtime root, then run the deterministic helper from
   that root while preserving the user's original target arguments. Do not
   assume the reviewed target project contains AIVV's `tools/` directory.

   ```bash
   AIVV_CODEX_HOME="${CODEX_HOME:-${HOME:-}/.codex}"
   AIVV_RUNTIME_ROOT_HELPER="${AIVV_RUNTIME_ROOT_HELPER:-}"
   for AIVV_RUNTIME_ROOT_CANDIDATE in \
     "${AIVV_ROOT:-}/.aivv/runtime-root.mjs" \
     "${CLAUDE_PLUGIN_ROOT:-}/.aivv/runtime-root.mjs" \
     "${PLUGIN_ROOT:-}/.aivv/runtime-root.mjs" \
     "${SKILL_BASE_DIR:-}/.aivv/runtime-root.mjs" \
     "${SKILL_BASE_DIR:-}/../../.aivv/runtime-root.mjs" \
     "$AIVV_CODEX_HOME/aivv-runtime/.aivv/runtime-root.mjs"; do
     if [ -z "$AIVV_RUNTIME_ROOT_HELPER" ] && [ -f "$AIVV_RUNTIME_ROOT_CANDIDATE" ]; then
       AIVV_RUNTIME_ROOT_HELPER="$AIVV_RUNTIME_ROOT_CANDIDATE"
     fi
   done
   if [ -z "$AIVV_RUNTIME_ROOT_HELPER" ]; then
     echo "AIVV runtime-root resolver not found; set AIVV_ROOT, PLUGIN_ROOT, CODEX_HOME, or SKILL_BASE_DIR" >&2
     exit 1
   fi
   AIVV_ROOT="$(node "$AIVV_RUNTIME_ROOT_HELPER" --print "${SKILL_BASE_DIR:-}")"
   AIVV_CALIBRATE_MJS="$AIVV_ROOT/tools/aivv-calibrate.mjs"
   ```

3. Invoke the helper by absolute path:

   ```bash
   node "$AIVV_CALIBRATE_MJS" <original arguments>
   ```

4. Return the helper's stdout to the user. If the helper exits nonzero, surface
   stderr and stop.

The helper owns argument parsing, target resolution, JSONL parsing, analytics,
raw JSON formatting, human-readable formatting, malformed-line warnings,
off-schema kind detection, likelihood-calibration buckets, and edge cases.

## Output Summary

The helper reports:

- records by canonical calibration kind;
- FP and TP rates over FP/TP-family events, with the N=5 floor;
- findings-per-review trend from `review_meta` records;
- likelihood calibration by manifestation with per-tier N=10 and total N=30
  floors;
- off-schema kind audit;
- accepted trade-off heuristic count;
- target-only scope reminder.

## Cross-References

- [.aivv/calibration/README.md](../../.aivv/calibration/README.md) — schema
  and jq one-liners mirrored by the helper.
- [skills/aivv/SKILL.md](../aivv/SKILL.md) Step 7 — write side of the
  calibration corpus.
- [skills/aivv-fix/SKILL.md](../aivv-fix/SKILL.md) Target Project Resolution —
  resolver semantics mirrored by the helper.
