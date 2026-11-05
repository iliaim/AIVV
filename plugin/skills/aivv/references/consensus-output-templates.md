# Consensus Output Templates

Read only when Step 6 enters Case B (`N >= 2` same-host `cold_multi_review`).

## Agreement Classification

Homogeneous lens:
- Same issue by all reviewers at same severity -> HIGH, render in `Agreed Findings`.
- Same area by majority with severity variance -> HIGH existence / MEDIUM
  severity, render agreed with severity range.
- One reviewer only -> MEDIUM, render `Unique to Reviewer X`.
- All clean -> HIGH positive signal.
- Split verdict -> MEDIUM, render `Areas of Disagreement`; do not pick a winner.
- Two+ reviewers surface same Devil's Advocate challenge -> agreed finding tagged
  `[devil's advocate convergence | critical signal]`.

Multi-lens (`K >= 2`, including `KxM`):
- All K lenses catch same finding -> `cross-lens-convergence`, HIGHEST,
  top-level `Cross-Lens Convergence`.
- Subset of K>=3 lenses catch same finding -> use `unanimous` when contributing
  reviewers had the same domain-finding shape, otherwise `lens-domain-catch` for
  the dominant contributing lens. <!-- DEFERRED-RETIRE-WHEN: ≥3 K≥3 multi-lens reviews land with at least one subset-convergence finding; at that point the cluster shape (TP-leaning vs FP-leaning) informs whether to add `multi-lens-convergence-subset` enum value (option A) or broaden `cross-lens-convergence` (option B). -->
- One lens catches a domain finding -> `lens-domain-catch`, HIGH within domain;
  never label it unique/noisy merely because other lenses skipped it.
- All lenses clean -> HIGH+ approval with lens list.

Intra-lens replication (`M >= 2`):
- All M reviewers in one lens block catch same finding -> `intra-lens-convergence`,
  HIGH; upgrade to `cross-lens-convergence` if another lens block also caught it.
- Subset in one block -> `lens-domain-catch`, MEDIUM within lens, render
  `Lens-X Block Disagreement`.
- One reviewer in one block -> solo homogeneous-style handling.
- `unanimous` applies only when top-level `lens` is a single string.

Consensus level: `ALIGNED` means same verdict and overlapping findings;
`MOSTLY ALIGNED` means same verdict with unique findings; `DIVERGENT` means
different verdicts or substantially different finding sets.

## Severity Synthesis

When `severity_model = impact_likelihood` and all overlapping DEFECT findings
carry raw axes:

1. Aggregate `impact_tier` by median ordinal
   `NEGLIGIBLE < MODERATE < SEVERE < CATASTROPHIC`; even split takes higher middle.
2. Aggregate `likelihood` by mode
   `UNLIKELY < POSSIBLE < PROBABLE < CERTAIN`; ties take the more likely value.
3. Apply resolved `severity_cell_map` overrides before the default methodology map.
4. Preserve each reviewer's original axes in attribution.

If any contributing finding lacks axes, use legacy max severity
`CRITICAL > MAJOR > MINOR > POLISH` and say so. Case D multi-model synthesis
keeps its `severity_reported`/`max()` fallback until provider axis maps are real.

## Render Skeleton

For homogeneous runs, include:

```markdown
## AIVV {N}-Way Review - Consensus Analysis
### Overall Consensus: {ALIGNED | MOSTLY ALIGNED | DIVERGENT}
| | Reviewer Alpha | Reviewer Beta | ... |
|---|---|---|---|
| **Verdict** | {verdict} | {verdict} | |
| **Scope** | {scope} | {scope} | |
| **Findings** | {N crit/maj/min} | {N crit/maj/min} | |
### Agreed Findings (high confidence - multiple reviewers independently flagged)
### Unique to Reviewer Alpha (medium confidence - single source)
### Areas of Disagreement
### POLISH - Improvement Opportunities
### Full Reviews (unmodified)
### Recommendation
```

For multi-lens runs, change title to
`AIVV {N}-Way Multi-Lens Review - Consensus Analysis`, add
`Info: Tier 2B spike active (lenses: <lens1>, <lens2>, ...). Each reviewer applied a different methodological frame.`,
show reviewer lens in the table, and include `Cross-Lens Convergence`,
`Multi-Lens Convergence`, and `Lens-<L> Domain Catches` sections. Recommendation:
weigh cross-lens convergence highest; treat lens-domain catches as HIGH within
domain; absence of cross-lens convergence is not failure.

## POLISH Rendering

Canonical POLISH/MINOR/DROP guidance lives in `.aivv/methodology.md` under
`Reviewer Anti-Patterns > cosmetic-edge-case-not-manifest-at-current-data`.

Summary line:

```text
POLISH: {N} improvement opportunities{ifQuickWins: " ({Q} Quick Wins)"}{ifCollapsed: " - collapsed by explicit `polish_collapsed: true`; expand with `--show-polish` or set `polish_collapsed: false` in `.aivv/config.json`."}{ifL1: " ({L1count} L1-source forced-shown below.)"}
```

Rules:
- Default-expanded: golden schema default is `polish_collapsed: false`, so
  per-finding POLISH blocks are visible by default.
- Explicit `polish_collapsed: true` suppresses non-L1 per-finding blocks.
- `--show-polish` expands for one invocation and overrides config.
- Sort by `value` descending (`high > medium > low > absent`), then `effort`
  ascending (`trivial > moderate > invasive > absent`).
- `value: high` plus `effort: trivial` is a Quick Win label, not severity.
- `severity_threshold` never hides POLISH; threshold filters only
  CRITICAL/MAJOR/MINOR.
- L1-source POLISH findings are always shown individually.
- Calibration emits `severity: "POLISH"`; per-rule FP/TP aggregation is
  independent of severity tier.
