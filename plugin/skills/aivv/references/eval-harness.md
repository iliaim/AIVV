# Eval Harness (`--eval`)

Maintainer-only early-exit branch for reviewer-quality regression checks against
author-private `.dev/eval/` corpora. Installed plugin builds may lack the corpus.

## Activation

When parsed `eval = true`, run this harness then return. Do not execute Steps
2-8, normal reviewer dispatch, result rendering, calibration writes, review-log
writes, or auto-chain.

Parse-time conflicts:
- Mutually exclusive with `--full-*`, bare integer reviewer count, and positional
  file/idea args.
- `--lens=<X>` and `--reviewers=N` are allowed.
- `--target=` is ignored; corpus path is fixed.

## Corpus

For each selected lens:

- `.dev/eval/<lens>/evals.json` is authoritative ground truth.
- `.dev/eval/<lens>/samples/<id>-<slug>.md` is the fixture.
- `.dev/eval/<lens>/manifest.md` explains seeded defects and known adjacent catches.

If no `--lens=` was supplied, evaluate every lens dir under `.dev/eval/` that
has `evals.json`. If a requested lens has no corpus, warn and skip:

```text
⚠ no eval corpus for lens '<X>' - skipping
```

If no requested lens has a corpus, halt with the substep 2t parse-time error.

## Procedure

Compute `run_id = YYYY-MM-DDTHH-MM-SS-<4-char-hex>` and ensure
`<calibration_dir>/eval-runs/` exists.

For each corpus lens:

1. Parse `evals.json`; collect sample ids and expected `rule_id`s.
2. For each sample, read the sample file and dispatch `aivv:reviewer` in
   `evidence_only_review` mode with the standard reviewer role/methodology and
   the current lens. Default reviewers is 1 unless `--reviewers=N`.
3. Ask reviewers for the normal machine-readable findings list. When a finding
   corresponds to a rule in the applicable AIVV standards, include that rule's
   exact canonical `rule_id`; do not invent or approximate IDs. Findings that
   do not correspond to a catalog rule may omit `rule_id`. No session context,
   calibration write, or auto-chain.
4. Aggregate emitted findings across reviewers. For `N > 1`, a seeded defect is
   caught if at least one reviewer emits the expected `rule_id`.
5. Match by `rule_id`:
   - `TP = expected ∩ emitted`
   - `FN = expected - emitted`
   - `FP-candidates = emitted - expected`, excluding absent/null `rule_id`
   - `unkeyed` findings are counted but not false positives
   - severity/confidence mismatch on matching `rule_id` remains TP and is logged
6. Compute per-lens:
   - `recall = sum(TP) / sum(expected)` as headline detection rate
   - `precision = sum(TP) / (sum(TP) + sum(FP-candidates))`
   - `f1 = 2 * precision * recall / (precision + recall)`, zero if undefined

Precision is noisy because fixtures seed one defect but may contain legitimate
adjacent defects. Treat spurious findings as a manual-triage queue. Do not
auto-tune thresholds or severities from eval precision alone.

## Output

Stdout per lens:

```text
=== AIVV eval - lens: visual (run 2026-05-29T14-22-07-9f3a) ===
samples: 3   expected catches: 3
recall:    3/3 = 1.00      <- headline (detection rate)
precision: 3/4 = 0.75      (1 spurious candidate - see triage list; noisy on single-defect fixtures)
f1:        0.857

misses (false negatives): none
spurious candidates (manual triage):
  - sample 02: A11Y-015
severity mismatches (calibration signal): none
unkeyed findings (no rule_id, not scored): 2
```

Append one JSONL record per evaluated lens to
`<calibration_dir>/eval-runs/<run-id>.jsonl`:

```json
{"run_id":"2026-05-29T14-22-07-9f3a","lens":"visual","reviewers":1,"review_mode":"evidence_only_review","samples":3,"expected":3,"tp":3,"fn":0,"fp_candidates":1,"unkeyed":2,"recall":1.0,"precision":0.75,"f1":0.857,"misses":[],"spurious":[{"sample":"02","rule_id":"A11Y-015"}],"severity_mismatches":[],"completed_at":"2026-05-29T14:22:41Z"}
```

Round rates to three decimals. This file is gitignored and intentionally outside
`validate.sh` Stage 12 schema scope.

## Local deterministic smoke scorer

`tools/eval-smoke.mjs --evals <evals.json> --review-output <json>` (author-side tool in the AIVV source repo; not shipped with the plugin) validates
matching mechanics without live reviewer dispatch. It emits `tp`, `fn`,
`fp_candidates`, `unkeyed`, `recall`, `precision`, `f1`, `misses`, `spurious`,
and `severity_mismatches`.

This is not a replacement for live `/aivv --eval`; it only pins scorer behavior.

## Direction Lens Exception

Direction findings are prose architectural judgments without stable `rule_id`.
They graduate via maintainer review, not rule-id scoring:

- Negative fixtures must all produce at least one direction finding with
  evidence, concrete alternative, and trade-off.
- Trap/self-dogfood fixtures must produce zero direction findings above INFO.
- `grounded_by` is reviewed for presence and grounding on load-bearing findings.

The public proof packet at
`tools/tests/fixtures/direction-eval-proof/valid/proof.json` preserves the
2026-06-03 graduation evidence. `tools/direction-eval-proof-check.mjs` (author-side, AIVV source repo) validates
packet integrity only; it does not rerun reviewers or semantically grade prose.

## Reviewer-restraint proof

Review restraint is evaluated against the complete reviewer output, including
the prose Approach assessment and the findings sidecar. Rule-ID scoring cannot
prove restraint because an unjustified recommendation may be unkeyed or appear
only in prose.

The author-side proof packet at
`tools/tests/fixtures/reviewer-restraint-proof/valid/proof.json` covers five distinct
traps: unneeded abstraction, speculative future capability, scope expansion,
dependency introduction, and an unmeasured/valueless refactor. Each must have no
finding above INFO, an empty findings sidecar, no change recommendation, explicit
acceptance of the current shape, and no forbidden recommendation. A genuine
over-abstraction positive control must retain a finding above INFO, evidence, a
concrete alternative, and its trade-off.

The committed result files carry a maintainer attestation that they were
captured from a cold independent `aivv-reviewer`; no durable dispatch record
authenticates that provenance.
The author-side proof checker validates metadata shape, fixture/result hashes,
class coverage, grade shape, and summary consistency. It cannot authenticate
the attestation. The grades are maintainer-authored judgments over those complete
outputs. This is explicitly not automated semantic scoring, and the checker
does not rerun reviewers or infer prose meaning.
