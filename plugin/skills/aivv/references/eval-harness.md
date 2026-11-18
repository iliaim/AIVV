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

If no requested lens has a corpus, halt:

```text
halt: no eval corpus for the requested lens(es)
```

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

Round rates to three decimals.

## Outside Rule-ID Scoring

Direction findings and reviewer restraint have no stable `rule_id`, so rule-ID
scoring cannot grade them; they are judged by maintainer review of the complete
reviewer output.
