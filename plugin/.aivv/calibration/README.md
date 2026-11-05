# AIVV Calibration

Append-only JSON Lines data accumulates in the resolved external per-user
calibration store. This shipped directory documents the format; it is not a
consumer runtime destination. Resolve and save the invocation context using
`../target-resolution.md`; `<calibration_dir>` and `<state_dir>` below refer to
that context. Legacy project corpora remain read-only/importable history.

## Layout — per-invocation shards (canonical, per-invocation sharding contract)

Calibration is **sharded one JSONL file per invocation per lens**:

```
<calibration_dir>/
  code/<invocation-id>.jsonl   # one /aivv or /aivv-fix invocation's code-lens records
  code/…                                # more per-invocation shards
  code.jsonl                            # LEGACY shared file (frozen; read via union; may be absent)
  code/legacy.jsonl                     # (only after `aivv-calibrate --migrate`) the relocated former code.jsonl
  sec/… , visual/… , ux/… …            # one directory per lens
  eval-runs/                            # RESERVED — written by the --eval harness; NOT a lens
```

Each per-invocation shard is keyed by the writing invocation's own id (the same `<id>` as `<state_dir>/review-<id>.json` / `fix-<id>.json`), so no two runs ever write the same path — the concurrent-write lost-update race is eliminated by construction. Records are one-per-line JSONL exactly as before; only the file path changed.

**Back-compat:** the legacy shared `<lens>.jsonl` (written by pre-per-invocation sharding contract versions) is never written again but stays fully readable — `/aivv-calibrate` and the jq snippets below read the **union** of `<lens>.jsonl` + `<lens>/*.jsonl`. `aivv-calibrate --migrate` optionally relocates legacy `<lens>.jsonl` files into `<lens>/legacy.jsonl` (git-aware, idempotent) to retire the shared files entirely. Bare `--migrate` retires **every** lens's legacy file; `--migrate --lens <L>` scopes to one lens.

**Writes use the shared helper.** Stage a validated JSONL record in private scratch,
then run `node "$AIVV_ROOT/tools/storage-paths.mjs" write --context
"$storage_context_file" --area calibration --relative "$lens/$invocation_id.jsonl"
--source "$record" --append`. Or publish a complete staged shard without
`--append`. Direct host writes to active calibration would race explicit import.
See the review/fix Step 7 references for record construction and dedup rules.
Explicit `aivv-calibrate --migrate` remains shared-file-to-shard maintenance in
the external store; it is separate from importing project history. Source project
files are never moved by normal reads or external writes.

## Record schema

Each line is a single JSON object. Current fields:

| Field | Values | Meaning |
|---|---|---|
| `ts` | RFC 3339 UTC timestamp with `Z` | When the record was written |
| `lens` | `code` (v0.1), `visual`/`perf`/`sec`/`a11y` (Tier 2+) | Lens the finding/bug belongs to |
| `kind` | `false_positive`, `dual_false_positive`, `n_way_false_positive`, `true_positive`, `dual_true_positive`, `n_way_true_positive_agreement`, `false_negative`, `bad_fix`, `auto_deferred_at_cap`, `review_meta`, `fix_introduced_bug`, `challenger_caught_issue`, `challenger_false_positive`, `recurring_class_missed`, `challenge_budget_exhausted`, `pre_write_validator_caught` | Calibration category |
| `finding` | string | Summary (present on `*false_positive` and `*true_positive*` kinds) |
| `severity` | `CRITICAL`/`MAJOR`/`MINOR`/`POLISH` | Severity as flagged by the reviewer (present on FP and TP kinds). POLISH (dev.41+) is the orthogonal value-add tier per `.aivv/methodology.md` and `.aivv/schemas/finding.json`. |
| `impact_tier` | `CATASTROPHIC`/`SEVERE`/`MODERATE`/`NEGLIGIBLE` (optional) | legacy-schema compatibility rules DEFECT-track impact tier when the calibrated finding used `severity_model: impact_likelihood`. Store with `likelihood` to preserve the reviewer’s cell-map reasoning. |
| `likelihood` | `CERTAIN`/`PROBABLE`/`POSSIBLE`/`UNLIKELY` (optional) | legacy-schema compatibility rules DEFECT-track likelihood when the calibrated finding used `severity_model: impact_likelihood`. Store with `impact_tier` so rare high-impact findings remain distinguishable from common high-impact findings. |
| `manifestation` | `observed`/`not_observed`/`unknown` (optional) | Impact-likelihood outcome evidence. `observed` means the defect or harm mode manifested in runtime, tests, user report, incident evidence, or a reproduced failure. `not_observed` means the finding was confirmed real but no manifestation was observed in the available evidence window. `unknown` preserves that no manifestation evidence is available and is excluded from likelihood-calibration percentages. FP/TP adjudication is reviewer-correctness evidence, not a substitute for this field. |
| `value` | `high`/`medium`/`low` (optional) | legacy-schema compatibility rules IMPROVEMENT-track value rating for POLISH findings. |
| `effort` | `trivial`/`moderate`/`invasive` (optional) | legacy-schema compatibility rules IMPROVEMENT-track effort rating for POLISH findings. `value: high` + `effort: trivial` is the Quick-Win shape. |
| `rule_id` | string (optional) | Stable rule identifier from `.aivv/standards/<file>.md` (e.g., `A11Y-2.4.11`, `HEU-NN6`, `MC-008`, `VD-059`). When the reviewer flagged a specific rule by ID, calibration entries SHOULD include this field on FP/TP/FN records (not on `review_meta`). Pre-dev.39 entries lack `rule_id` and remain valid (backward compat). Enables per-rule FP/TP rate aggregation via `jq` (see "jq aggregators" below). |
| `reason` or `evidence` | string | Why the finding was dismissed (FP) or why it was a real defect (TP) |
| `bug` | string | Bug description (present on `false_negative` kinds) |
| `category` | `correctness`/`security`/`edge-case` | Bug category (present on `false_negative`) |
| `fix_regression` | string | What broke after the fix was applied (present on `bad_fix` kind) |
| `findings_produced` | integer ≥0 | `findings_produced` is integer >=0; count of the in-memory canonical findings array Step 7.5 will write to the review log. For `cold_multi_review` and `cold_multi_model`, use the post-dedup synthesized finding count from Step 6, not the sum of per-reviewer or per-provider raw findings; for `cold_single_review` and `same_agent_review`, use parsed JSONL sidecar count. Zero-finding clean reviews emit 0. |
| `reviewers` | integer ≥1 | Number of reviewers in the session (mirrors `review_log.reviewers`; present on `review_meta` kind). |
| `review_id` | string | Invocation ID linking the record back to `<state_dir>/review-<id>.json` (or `fix-<id>.json` when `/aivv-fix` writes the record per the de-dup contract). Unique key for the `review_meta` corpus. |
| `root_cause_of_bad_fix` | string | Why the fix went wrong. Free-form string. **Example values observed so far** (guidance, not a closed enum): `prerequisite-not-met` (environmental precondition not verified before fix — single empirical instance, see `.aivv/methodology.md` Phase 1.5 canonical example), `other` (catch-all). Pick the most accurate label for what actually happened — do NOT round to the example values above unless they fit. Promote to formal JSON Schema enum at N≥3 distinct empirical values per Operating Principle 1. |

`lens` is the standard top-level field (see line 14) and applies to all kinds, including `bad_fix` — not re-listed in the kind-specific rows above for consistency.

**Severity write rule.** When writing a calibration record with a `severity`, it MUST be one of the canonical uppercase enum values (`CRITICAL`/`MAJOR`/`MINOR`/`POLISH`); lowercase/abbreviated forms are drift. The orchestrator normalizes to uppercase on write (`critical`→`CRITICAL`). `severity` is OPTIONAL — records without it (e.g., `review_meta` and other non-finding kinds) are valid and unaffected by this rule. Historical corpora carry lowercase forms from before normalization; `validate.sh` Stage 24 surfaces any off-enum value still on disk (WARN-mode) without mutating the gitignored runtime corpora.

**Convergence-kind suffixes (operator extension).** Operators may extend the canonical convergence kinds with a trailing `_<context>` suffix to capture inline what the reviewers converged on (e.g., `dual_true_positive_on_orchestrator_defaults`). The trailing context is opaque to the schema — readers MUST treat any kind whose prefix is `dual_true_positive` or `n_way_true_positive_agreement` as the canonical convergence kind. The bare canonical forms (`dual_true_positive`, `n_way_true_positive_agreement`) are also valid and recommended when no extra context is needed.

**When to record `true_positive`:** When a reviewer flags a finding that is later confirmed to be a real defect — by user agreement, by the fix landing in `/aivv-fix`, or by post-ship empirical evidence. Distinct from `false_positive` (reviewer mistake) and `false_negative` (real bug the reviewers missed — recorded post-ship). The `true_positive` record is the precision-side complement of `false_positive`: it gives the FP-rate one-liner a meaningful denominator (FP + TP = "agreed reviewer events") and lets a parallel TP-rate one-liner compute precision directly.

**When to record `dual_true_positive` / `n_way_true_positive_agreement`:** Orchestrator-emitted when N≥2 (resp. N≥3) reviewers independently flag the same finding and it is later confirmed real. Parallel to `dual_false_positive` / `n_way_false_positive` on the FP side. The epistemic signal is "consensus among independent reviewers was correct" — distinct from a single-reviewer `true_positive`, which carries weaker evidence.

**When to record `bad_fix`:** When a fix proposed and executed by `/aivv-fix` is later found to have introduced a regression (broken behavior, wrong assumption, missed precondition). Distinct from `false_positive` (fix wasn't needed) and `false_negative` (fix didn't catch a real bug — that's recorded as a missed finding, not a bad fix).

**When to record `review_meta`:** Per-review-session metadata; one record per `/aivv` invocation regardless of finding count (zero-finding clean reviews still write a record). Numerator-denominator math for true precision uses these as the denominator — `findings_produced` is the count of findings the reviewer(s) emitted, which lets `/aivv-calibrate` compute "of N findings produced, how many were FP / TP / not yet classified." Existing readers that count `kind`-by-frequency MUST exclude `review_meta` to avoid pollution (it is metadata, not a calibration event).

**De-dup contract.** `review_id` is the unique key. `/aivv` writes one `review_meta` per invocation with `review_id` set to the `/aivv` invocation ID. `/aivv-fix` writes a `review_meta` ONLY when its findings did NOT come from a `/aivv` review log (i.e., `--source=conversation`/`literal`/`task-id`); when `/aivv-fix` consumed `--review-id=<id>` (the `/aivv --fix` auto-chain path or fresh-session resumption), the `/aivv` invocation already wrote the `review_meta` and `/aivv-fix` skips its own write. Readers can verify uniqueness with `jq -s 'map(select(.kind == "review_meta")) | group_by(.review_id) | map(select(length > 1))'`.

**Reader dedup scope (coexistence window).** `/aivv-calibrate` deduplicates the union **only** at the `review_meta` × `review_id` grain — this protects the `findings_per_review` / review-count denominator. It does **not** dedupe finding-kind records (`false_positive` / `true_positive` / `false_negative` / `bad_fix` / …). During the transition window when a lens has BOTH a legacy flat `<lens>.jsonl` and per-invocation `<lens>/*.jsonl` shards (a pre-per-invocation sharding contract writer still appending to the flat file while a new writer shards, or a flat file resurrected after `--migrate`), `records_by_kind`, `fp_rate`, `tp_rate`, `trade_offs_accepted`, and the likelihood-calibration tiers may be **inflated** by double-counted finding records. `/aivv-calibrate` emits a coexistence warning naming the lens whenever this shape is present; `--migrate` retires the flat file and closes the window. Treat a coexistence-warned corpus's finding-kind metrics as upper bounds until migrated; `findings_per_review` stays trustworthy throughout.

Full schema will ship at `../schemas/calibration.json` in v0.2. Until then, the fields above are the operational contract.

## Read-side analytics (jq one-liners)

Read-side analytics are intentionally minimal at v0.1 — small data volume, no decisions yet being made from it. Prefer `/aivv-calibrate` (it already reads the union of legacy file + shards). For ad-hoc `jq`, read the **union** of the legacy shared file and the per-invocation shards. The snippets below are written against a single `code.jsonl` for brevity; to run them over the real sharded corpus, feed the union instead — e.g. define once:

```bash
# Union of legacy shared file + per-invocation shards for a lens (nullglob-safe):
# Run inspection snippets from the resolved external corpus, or a selected read-only legacy corpus.
cd "$calibration_dir"
CORPUS=$(cat ./code.jsonl ./code/*.jsonl 2>/dev/null)
# then pipe it: echo "$CORPUS" | jq -s '.'   (or replace `./code.jsonl` below)
```

Everywhere a snippet reads `./code.jsonl`, substitute `<(cat ./code.jsonl ./code/*.jsonl 2>/dev/null)` (process substitution) to include shards.

### All records (pretty-print)

```bash
jq -s '.' <(cat ./code.jsonl ./code/*.jsonl 2>/dev/null)
```

### Count by kind

```bash
jq -sr 'map(select(.kind != "review_meta")) | group_by(.kind) | map({kind: .[0].kind, count: length}) | .[] | "\(.kind)\t\(.count)"' ./code.jsonl
```

`review_meta` is excluded — it is per-session metadata, not a calibration event. To count `review_meta` records separately (e.g., "how many reviews ran"), use the "Reviews this period" one-liner below.

### False-positive count only

```bash
jq -c 'select(.kind == "false_positive" or .kind == "dual_false_positive" or .kind == "n_way_false_positive")' ./code.jsonl | wc -l
```

### Records from the last 30 days (UTC)

```bash
# macOS/BSD: date -u -v-30d ...   Linux/GNU: date -u -d '30 days ago' ...
CUTOFF=$(date -u -v-30d +'%Y-%m-%dT%H:%M:%S.000000Z' 2>/dev/null || date -u -d '30 days ago' +'%Y-%m-%dT%H:%M:%S.000000Z')
jq -c --arg cutoff "$CUTOFF" 'select(.ts >= $cutoff)' ./code.jsonl
```

### Most-recent N records

```bash
tail -n 20 ./code.jsonl | jq '.'
```

### FP rate estimate (FP / (FP + TP))

```bash
jq -sr '
  (map(select(.kind | test("false_positive($|_)"))) | length) as $fp
  | (map(select(.kind | test("(false_positive($|_)|true_positive($|_))"))) | length) as $denom
  | "false_positive\t\($fp)/\($denom) = \(if $denom > 0 then ((($fp / $denom) * 100) | floor | tostring) + "%" else "N/A" end)"
' ./code.jsonl
```

The numerator selector matches `false_positive`, `dual_false_positive`, `n_way_false_positive`, and any operator-extended convergence kind whose prefix is `dual_false_positive_` or `n_way_false_positive_` (symmetric to TP-family suffix tolerance per dev.31 policy). The denominator selector matches the FP family plus the TP family — `true_positive`, `dual_true_positive`, `n_way_true_positive_agreement`, and any operator-extended convergence kind whose prefix is `dual_true_positive_` or `n_way_true_positive_agreement_`. `bad_fix`, `false_negative`, and `review_meta` records are excluded from both numerator and denominator (their semantics are orthogonal to the FP/TP rate — `review_meta` in particular is per-session metadata that feeds the "Findings per review" denominator below, not the agreed-events precision rate).

### TP rate estimate (precision: TP / (FP + TP))

```bash
jq -sr '
  (map(select(.kind | test("true_positive($|_)"))) | length) as $tp
  | (map(select(.kind | test("(false_positive($|_)|true_positive($|_))"))) | length) as $denom
  | "true_positive\t\($tp)/\($denom) = \(if $denom > 0 then ((($tp / $denom) * 100) | floor | tostring) + "%" else "N/A" end)"
' ./code.jsonl
```

The denominator is identical to the FP-rate one-liner; the numerator captures TP-family records. Together the two rates sum to 100% (modulo integer-floor rounding) because the denominator is the disjoint union of FP-family and TP-family events.

**Interpretation.** The denominator above is **agreed reviewer events** (FP + TP) — calibration-recorded outcomes where reviewer correctness has a recorded ground truth. This is one of two precision-shaped rates AIVV computes; the other is the true rate-per-review trend below, which divides by `findings_produced` (every finding the reviewers emitted, not just the ones that triggered explicit feedback). Use the agreed-events rate when you care about classification accuracy on findings the user reacted to; use the rate-per-review trend when you care about the raw flagging rate per session.

Note on `bad_fix` records: `bad_fix` is excluded from both numerator and denominator above (the regex anchors `false_positive($|_)` and `true_positive($|_)` do not match `bad_fix`). Compute `bad_fix` rate separately rather than folding it into FP/TP rate — it captures fix-quality, not finding-quality.

### Findings per review (trend; requires `review_meta` records)

```bash
jq -sr '
  map(select(.kind == "review_meta")) as $meta
  | ($meta | length) as $reviews
  | ($meta | map(.findings_produced) | add // 0) as $sum
  | "findings_per_review\t\($sum)/\($reviews) = \(if $reviews > 0 then (($sum / $reviews) * 100 | floor / 100 | tostring) else "N/A (no review_meta records)" end)"
' ./code.jsonl
```

Average findings produced per `/aivv` invocation. Numerator sums `findings_produced` across all `review_meta` records; denominator counts `review_meta` records. Backward-compat: corpora written before `review_meta` shipped report `N/A (no review_meta records)`; readers should treat that as "denominator unavailable" rather than "zero findings."

### Reviews this period (count of `review_meta` records, optionally time-windowed)

```bash
jq -sr 'map(select(.kind == "review_meta")) | length' ./code.jsonl
```

Time-windowed variant (last 30 days):

```bash
# macOS/BSD: date -u -v-30d ...   Linux/GNU: date -u -d '30 days ago' ...
CUTOFF=$(date -u -v-30d +'%Y-%m-%dT%H:%M:%S.000000Z' 2>/dev/null || date -u -d '30 days ago' +'%Y-%m-%dT%H:%M:%S.000000Z')
jq -sr --arg cutoff "$CUTOFF" 'map(select(.kind == "review_meta" and .ts >= $cutoff)) | length' ./code.jsonl
```

Useful for trend analysis (review volume, before/after methodology changes, etc.).

### Per-rule FP/TP rate (dev.39+, requires `rule_id` field on entries)

```bash
jq -s '
  map(select(.kind | test("(true_positive($|_)|false_positive($|_))")))
  | group_by(.rule_id // "unknown")
  | map({
      rule_id: (.[0].rule_id // "unknown"),
      tp: ([.[] | select(.kind | test("true_positive($|_)"))] | length),
      fp: ([.[] | select(.kind | test("false_positive($|_)"))] | length),
      tp_plus_fp: length,
      fp_rate: (
        ([.[] | select(.kind | test("false_positive($|_)"))] | length) /
        ((. | length) + 0.0001)
      )
    })
  | sort_by(.fp_rate) | reverse
' ./<lens>.jsonl
```

(Each `key: expr` operand containing `//` is wrapped in parentheses — jq's object-construction parser requires this when the value expression mixes `//` alternation; otherwise the parser raises `unexpected //, expecting '}'`. Empirically verified against the corpus.)

Output: ranked list of rules by FP rate (highest first). Empirically prune rules with `fp_rate > 0.30` after `tp_plus_fp >= 10` (low-N rules have unstable rates and should not be pruned).

The aggregator first FILTERS to FP-family + TP-family records (matching the FP/TP-rate aggregator above's denominator semantics — see "FP rate estimate" / "TP rate estimate" sections), then buckets by `rule_id`. Records lacking the field group under `"unknown"` (pre-dev.39 corpus or reviewer omissions). The selectors use anchored `test("true_positive($|_)")` / `test("false_positive($|_)")` patterns (same suffix-tolerance for operator-extended convergence kinds per dev.31 as the aggregate aggregator). `bad_fix`, `false_negative`, and `review_meta` records are excluded from BOTH numerator and denominator (they have no place in a FP/TP precision rate calculation). The denominator field is named `tp_plus_fp` to make the semantics explicit at the output layer — this matches the prose description and the aggregate-FP-rate aggregator at the top of this section.

**Per-tier filter (POLISH-vs-MINOR separation, dev.41+):** layer a `select(.severity == "POLISH")` (or `"MINOR"`, etc.) into the initial filter stage to scope the aggregator to one severity tier:

```bash
# POLISH-only per-rule FP/TP rate
jq -s '
  map(select((.kind | test("(true_positive($|_)|false_positive($|_))")) and .severity == "POLISH"))
  | group_by(.rule_id // "unknown")
  | map({
      rule_id: (.[0].rule_id // "unknown"),
      tp: ([.[] | select(.kind | test("true_positive($|_)"))] | length),
      fp: ([.[] | select(.kind | test("false_positive($|_)"))] | length),
      tp_plus_fp: length,
      fp_rate: (([.[] | select(.kind | test("false_positive($|_)"))] | length) / ((. | length) + 0.0001))
    })
  | sort_by(.fp_rate) | reverse
' ./<lens>.jsonl
```

POLISH findings are by-design value-add (NOT defects), so a high POLISH FP-rate signals over-eager Improvement-articulation pass — distinct signal from defect-tier FP-rate. Track separately when corpus reaches N≥10 POLISH samples per rule_id.

### Likelihood calibration by manifestation (impact-likelihood model, dev.204+)

Likelihood calibration is a corpus-level signal over outcome evidence, not over reviewer correctness. FP/TP-family records answer "was the reviewer right?" They do NOT answer whether the harm mode manifested. Use only records with both `likelihood` and `manifestation`, and exclude `manifestation: "unknown"` from percentages.

```bash
jq -s '
  map(select(
    .likelihood
    and .manifestation
    and .manifestation != "unknown"
    and (.kind | test("^(false_positive|dual_false_positive(_.+)?|n_way_false_positive(_.+)?|true_positive|dual_true_positive(_.+)?|n_way_true_positive_agreement(_.+)?|false_negative)$"))
  )) as $rows
  | ["CERTAIN", "PROBABLE", "POSSIBLE", "UNLIKELY"] as $tiers
  | $tiers
  | map(
      . as $tier
      | ($rows | map(select(.likelihood == $tier))) as $bucket
      | ($bucket | length) as $n
      | ($bucket | map(select(.manifestation == "observed")) | length) as $observed
      | ($bucket | map(select(.manifestation == "not_observed")) | length) as $not_observed
      | {
          likelihood: $tier,
          n: $n,
          manifestation_observed: $observed,
          manifestation_not_observed: $not_observed,
          observed_rate: (if $n >= 10 then ($observed / $n) else null end),
          insufficient_data: ($n < 10),
          threshold: 10
        }
    )
' ./<lens>.jsonl
```

Interpretation floors:

- Per-tier percentage is shown only when that tier has at least 10 manifestation-tagged events.
- Overall review-time advisory is shown only when the total manifestation-tagged corpus has at least 30 events and the current review emitted a finding in a weak tier.
- `unknown` and absent `manifestation` mean denominator unavailable, not `not_observed`.

Broad drift thresholds for `/aivv-calibrate` surfacing:

- `CERTAIN`: warn if manifestation-observed rate is below 70% after N >= 10.
- `PROBABLE`: warn if manifestation-observed rate is below 50% after N >= 10.
- `POSSIBLE`: warn if manifestation-observed rate is below 20% or above 80% after N >= 10.
- `UNLIKELY`: warn if manifestation-observed rate is above 40% after N >= 10.

These are coarse drift indicators for sparse, feedback-biased corpora. They are not statistical proof and must not automatically promote or demote severity.

### Summary, all kinds + time window

```bash
jq -s '
  {
    total: length,
    by_kind: (group_by(.kind) | map({key: .[0].kind, value: length}) | from_entries),
    by_lens: (group_by(.lens) | map({key: .[0].lens, value: length}) | from_entries),
    oldest: (map(.ts) | min),
    newest: (map(.ts) | max)
  }
' ./code.jsonl
```

## Tier 2B multi-lens spike evaluation protocol (dev.39+)

Use this protocol when you want to evaluate whether multi-lens dispatch (`--lens=a,b`) produces findings that homogeneous same-lens dispatch (`--lens=a`) does not. The Tier 2B spike's central question — *does methodological diversity at dispatch time produce real epistemic gain, or is it prompt ornamentation?* — is answered by accumulating N≥3 such evaluations, then writing the 3d ADR off the empirical record.

### Step 1 — Run the A/B pair

Pick a diff worth reviewing (real session work, not synthetic). Run `/aivv` twice over the SAME diff with different lens configurations:

```
# Baseline (homogeneous, single lens)
/aivv 2 --lens=code

# Treatment (multi-lens, same N reviewers)
/aivv 2 --lens=code,sec
```

Both invocations write `review-<id>.json` files to `<state_dir>/`. Note both review IDs.

**Constraint:** baseline N must equal treatment N (compare like-for-like). For `--lens=a,b` (treatment K=2), use `--lens=a` (baseline) — homogeneous K=1 with N=2 reviewers.

### Step 2 — Compare findings by fingerprint

Each finding has a stable `fingerprint` (per `.aivv/methodology.md` and `skills/aivv-fix/SKILL.md` wont-fix-registry pre-filter). Set-difference the two fingerprint sets to surface the three buckets:

```bash
BASELINE="$state_dir/review-<baseline-id>.json"
TREATMENT="$state_dir/review-<treatment-id>.json"

# Convergent catches (both configurations caught it)
comm -12 \
  <(jq -r '.findings[].fingerprint' "$BASELINE" | sort -u) \
  <(jq -r '.findings[].fingerprint' "$TREATMENT" | sort -u)

# Treatment-only catches (multi-lens caught, baseline missed) — KEY DATA for the spike
comm -23 \
  <(jq -r '.findings[].fingerprint' "$TREATMENT" | sort -u) \
  <(jq -r '.findings[].fingerprint' "$BASELINE" | sort -u)

# Baseline-only catches (homogeneous caught, multi-lens missed) — counter-signal
comm -13 \
  <(jq -r '.findings[].fingerprint' "$TREATMENT" | sort -u) \
  <(jq -r '.findings[].fingerprint' "$BASELINE" | sort -u)
```

### Step 3 — Attribute treatment-only catches to specific lenses

For each treatment-only fingerprint, look up its `findings[].lens` attribution (per dev.37 schema):

```bash
# Read fingerprints into a bash array (mapfile -t handles arbitrary characters
# and avoids the word-splitting fragility of `for fp in $unquoted_var`).
mapfile -t TREATMENT_ONLY_FPS < <(comm -23 \
  <(jq -r '.findings[].fingerprint' "$TREATMENT" | sort -u) \
  <(jq -r '.findings[].fingerprint' "$BASELINE" | sort -u))

for fp in "${TREATMENT_ONLY_FPS[@]}"; do
  # Use `tojson` so array-form `findings[].lens` (cross-lens-convergence) emits
  # as compact single-line `["code","sec"]` instead of multi-line indented JSON
  # that breaks the single-line aggregation below.
  lens=$(jq -r --arg fp "$fp" '.findings[] | select(.fingerprint == $fp) | .lens | tojson' "$TREATMENT")
  agreement=$(jq -r --arg fp "$fp" '.findings[] | select(.fingerprint == $fp) | .agreement' "$TREATMENT")
  desc=$(jq -r --arg fp "$fp" '.findings[] | select(.fingerprint == $fp) | .description' "$TREATMENT")
  echo "$fp | $agreement | $lens | $desc"
done
```

Expected output: `lens-domain-catch` findings emit `lens="sec"` (JSON-quoted single string from `tojson`); `cross-lens-convergence` findings emit `lens=["code","sec"]` (JSON-quoted array). Both render as single-line strings in the aggregation, machine-distinguishable by leading-character (`"` for string, `[` for array).

### Step 4 — Classify each treatment-only catch as TP / FP

After human review of each treatment-only catch:
- **True positive (TP)**: real defect that baseline missed → multi-lens added value.
- **False positive (FP)**: noise that baseline correctly avoided → multi-lens added cost (false alarm).
- **Unknown**: cannot be classified yet (e.g., needs runtime data) → skip; revisit later.

Log each classified outcome using the `false_positive` / `true_positive` kinds. Per per-invocation sharding contract, write to a per-invocation shard `<calibration_dir>/<lens>/<id>.jsonl` (pick any unique `<id>`, e.g. a timestamp, for this manual evaluation batch); the union reader picks it up. The `<lens>.jsonl` paths named in the routing bullets below refer to the same per-lens corpus — write to `<lens>/<id>.jsonl` shards, not the frozen legacy flat file.

**Routing the calibration write:**
- For `lens-domain-catch` findings: write one record to `<calibration_dir>/<finding-lens>/<id>.jsonl` (the single lens from Step 3's lookup).
- For `cross-lens-convergence` findings: write one record to **each** lens in the `findings[].lens` array — content is identical across copies EXCEPT the `lens` field, which carries the lens of the file each copy is written into (so `code.jsonl` carries `lens: "code"`, `sec.jsonl` carries `lens: "sec"`). The cross-lens identity is preserved by the duplication itself (the same finding fingerprint appearing in multiple per-lens corpora IS the cross-lens signal); the per-file `lens` field stays consistent with the file path so existing per-lens FP/TP-rate one-liners that filter inside a single corpus continue to work without re-filtering by the `lens` field.
- For `intra-lens-convergence` findings (K×M case, dev.58+): write one record to `<calibration_dir>/<finding-lens>/<id>.jsonl` — routing identical to `lens-domain-catch` (single lens, no duplication). The epistemic signal that all M reviewers within the block agreed is recorded via the `agreement` field, NOT via duplication (duplication is reserved for the cross-lens identity). Eligible for `dual_<X>` / `n_way_<X>` calibration-kind selection in homogeneous-block sense — M reviewers with the same lens converging IS the same-lens N-reviewer agreement epistemic shape that dev.40's calibration-kind selection note describes.

**Calibration kind selection (dev.40 clarification; scope clarified dev.58):** **for cross-lens-convergence findings**, use the bare `false_positive` / `true_positive` kinds, NOT the `dual_<X>` / `n_way_<X>` family. The `dual_<X>` / `n_way_<X>` kinds are reserved for **same-lens N-reviewer agreement** (the homogeneous-case epistemic signal — N reviewers with the same lens agreeing; this includes intra-lens-convergence per the dev.58 K×M case per the prior bullet's routing rule). Cross-lens-convergence is semantically distinct (independent methodological frames converged); the cross-lens signal is preserved by the per-lens corpus separation (a cross-lens-convergence finding appearing in BOTH `code.jsonl` and `sec.jsonl` IS the cross-lens signal, machine-readable from the corpus structure). Conflating cross-lens findings with same-lens-N-reviewer findings under a shared `dual_<X>` kind would undo dev.36's deliberate machine-distinguishability between same-lens unanimity and cross-lens convergence. <!-- DEFERRED-RETIRE-WHEN: subtask 3d ADR analysis confirms whether per-lens corpus separation is sufficient or whether explicit cross-lens calibration kinds are needed for downstream consumers. -->

**Note on orchestrator-side `review_meta` write (dev.40):** AIVV's `/aivv` Step 7 dual-writes `review_meta` denominator records to ALL contributing lenses' corpora when a multi-lens dispatch fires (per the dev.40 fix to first-lens denominator skew). FP/TP outcome records remain orchestrator-routed to first-lens with `lens_assignment` annotation (per the v1-spike scope deferral pending 3c eval evidence). The dev.39 protocol's Step 4 hand-routing here is the canonical per-lens FP/TP routing convention; the orchestrator's first-lens routing for those records is a known v1-spike limitation.

### Step 5 — Repeat until N≥3 evaluations

The 3d ADR write-up requires N≥3 real-diff evaluations to make a credible case. Each evaluation is:
- 1 baseline run + 1 treatment run + classified treatment-only catches.

When N≥3:
- Compute per-lens TP/FP rates from the accumulated calibration corpus (use the existing `FP rate estimate` and `TP rate estimate` one-liners above, filtered per lens).
- Read across the per-lens results to answer: did multi-lens lenses produce categorically different catches, or did they re-discover what the homogeneous baseline already found?

### Step 6 — Write the 3d ADR

Three possible outcomes (pre-committed in the Tier 2B framing — outputs feed an ADR decision, not a production release):

1. **Lens-first wins** — treatment produces TP findings the baseline missed, and these findings have lens-attributable patterns (e.g., the security-lens consistently catches injection bugs the code-lens misses). Write ADR formalizing lens-first scaling.
2. **Lens-first loses** — treatment-only catches are all FPs, or all re-discoveries dressed in lens-specific language. Write ADR documenting the negative result; siblings-first stays.
3. **Lens-first needs consensus extension** — treatment produces real TP findings, but the consensus-synthesis layer cannot coherently combine cross-lens findings into a useful report. Flag as Tier 3 prerequisite; postpone production lens-first until consensus extension ships.

The ADR consumes this protocol's accumulated evidence. The protocol itself can then be retired (or kept as a reusable harness for future spikes targeting other forms of methodological diversity).

## When to inspect

- Before a version bump — quick sanity check that no pattern of false-positives is concentrated in one area.
- When the prompt or methodology changes — re-read recent records to see whether the change addresses prior FPs.
- When considering a new lens — the lens should have its own calibration file from first use.
- When running a Tier 2B multi-lens spike evaluation cycle — see the protocol section above.

Read-side analytics expanded in dev.31 (`/aivv-calibrate` slash command + `review_meta` denominator logging) and dev.39 (Tier 2B spike evaluation protocol). Future expansion (cross-project rollups, rescaling-formula consumption) is sequenced for v0.3.

## `fix_introduced_bug` vs `bad_fix` — which kind to use

`fix_introduced_bug` is **auto-emitted** by `/aivv-fix` Step 6 verifier when a within-cycle regression's `file` matches a prior-cycle `changes_summary[].file` (machine-detected; no human narrative). Fields are all machine-emittable: `original_fix_finding_id`, `regression_summary` (verifier-output one-liner), `caught_by_round`, `predecessor_review_id`.

`bad_fix` is **manually recorded** by `/aivv-calibrate` after post-ship dogfood evidence confirms a regression was introduced by a fix. Human narrative required in `fix_regression` + `root_cause_of_bad_fix` fields.

Both kinds MAY exist for the same regression event:
- One auto-emitted by Step 6 within the invocation that introduced the regression
- One manually recorded later after dogfood evidence accumulates

**Analytics aggregators MUST dedupe:**
- by `original_fix_finding_id` (for `fix_introduced_bug` records)
- by `finding` summary substring-match (for `bad_fix` records)

to avoid double-counting cross-kind. Example jq query:

```bash
# Count unique regressions across both kinds:
cat ./code.jsonl | jq -s '
  (map(select(.kind == "fix_introduced_bug")) | unique_by(.original_fix_finding_id) | length) +
  (map(select(.kind == "bad_fix")) | unique_by(.finding) | length)
'
```
