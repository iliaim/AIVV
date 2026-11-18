---
name: aivv-calibrate
description: "Use for read-only analytics on a target project's AIVV calibration corpus. --migrate is the explicit, target-local maintenance exception that relocates legacy files."
argument-hint: "[--lens=<lens>] [--target=<dir>] [--all-lenses] [--raw] [--migrate]"
---

# AIVV Calibrate — Read-Side Analytics Skill

Analytics use one target project's external calibration corpus and legacy or sharded records. The shared resolver selects storage; completed imports count each covered source file once, and imported legacy bytes remain historical until explicit reconciliation.

## Contract

- **Default analytics are read-only:** without `--migrate`, perform no state
  writes, subagent dispatch, or code mutations.
- **Explicit maintenance exception:** only an argument that already includes
  `--migrate` may relocate `<lens>.jsonl` to `<lens>/legacy.jsonl` in the
  selected target. Do not add `--migrate` on the user's behalf. The operation
  is git-aware and idempotent; it does not rewrite record contents.
- Target-only: no cross-project aggregation or rescaling-formula consumption.
- Visualization only: the output informs a human; it does not feed review-time
  logic.
- Minimum-N floor: FP/TP rates emit `insufficient_data` when the denominator is
  below 5.

## Host Notes

Run the helper with the host's shell tool; host capabilities are in
[.aivv/runtime-contract.md](../../.aivv/runtime-contract.md) and the active
platform adapter.

<!-- HERMES-AGENT-SPECIFIC --> In Hermes Agent, load the host adapter with
`read_file` from `${HERMES_SKILL_DIR}/../../.aivv/platform-adapters/hermes-agent.md`
before using host-specific operations. Do not open that sibling path with
`skill_view` because Hermes rejects parent traversal. If the template token is
unexpanded, stop with `AIVV_INSTALLATION_INCOMPLETE`.

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

1. Preserve the read-only default. Honor `--migrate` only when the user's original
   arguments include it, and limit it to legacy calibration files in the
   selected target.
2. Before reading calibration data, preflight once per
   [.aivv/runtime-root.md](../../.aivv/runtime-root.md) with profile
   `aivv-calibrate` and export the result as `AIVV_ROOT`. If preflight reports
   `AIVV_INSTALLATION_INCOMPLETE`, show that diagnostic once and stop; do not
   retry or select another cache. Do not assume the reviewed target project
   contains AIVV's `tools/` directory.

3. Invoke the helper by absolute path, preserving the user's original arguments:

   ```bash
   node "$AIVV_ROOT/tools/aivv-calibrate.mjs" <original arguments>
   ```

4. Return the helper's stdout to the user. If the helper exits nonzero, surface
   stderr and stop.

The helper owns argument parsing, target resolution, JSONL parsing, analytics,
raw JSON formatting, human-readable formatting, malformed-line warnings,
off-schema kind detection, likelihood-calibration buckets, and edge cases.

## Output Summary

The helper reports:

- records by canonical calibration kind;
- FP and TP rates over FP/TP-family events, subject to the minimum-N floor above;
- findings-per-review trend from `review_meta` records;
- likelihood calibration by manifestation with per-tier N=10 and total N=30
  floors;
- off-schema kind audit;
- accepted trade-off heuristic count;
- target-only scope reminder.

## Cross-References

- [.aivv/calibration/README.md](../../.aivv/calibration/README.md) — schema
  and jq one-liners mirrored by the helper.
- [skills/aivv/references/self-calibration.md](../aivv/references/self-calibration.md)
  — write side of the calibration corpus.
- [skills/aivv-fix/SKILL.md](../aivv-fix/SKILL.md) Target Project Resolution —
  resolver semantics mirrored by the helper.
