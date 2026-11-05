# Result Rendering Policy

Read before rendering findings or summaries. This file owns drift handling,
setup/walkthrough hints, Trust Card, consensus orientation, filtering, lens
coverage, calibration notes, and `/aivv-fix` recommendation behavior.

## Step 6.0 Workspace Drift

When read-only enforcement has the canonical `partial` or `unsupported` status
from `.aivv/runtime-contract.md`, capture before and after reviewer dispatch:

```bash
( cd '<target>' && git status --porcelain=v1 -z; echo ''; git diff --no-color --no-ext-diff HEAD ) 2>&1
```

Compare raw strings. Equal means proceed. Different means:

- `workspace_drift_policy=void`: surface `WORKSPACE_DRIFT_VOIDED_REVIEW`, do
  not render findings, do not write review log, do not auto-chain.
- `warn`: continue with `[workspace-drift-detected-proceeding-warn-mode]` and
  record `workspace_drift_detected_warn_mode`.
- `investigate` (default): compute drifted files excluding `.aivv/state/`.
  Continue only when all drifted files are already in session scope; otherwise
  void with `WORKSPACE_DRIFT_VOIDED_REVIEW`.

If technical read-only enforcement is available, skip the drift check and omit
workspace SHA fields.

## Step 6.0b Setup Hint

MUST-READ for hint emission: [setup-hint.md](setup-hint.md). The hint runs
before Case A/B findings. Skip automatically for early-exit commands and voided
reviews because they never reach Step 6.

Trigger when `~/.aivv/config.json` exists and `_setup_hint_shown_at` is absent
or null. Emit:

```text
Tip: AIVV is using defaults ({resolved_default_reviewers} reviewer{plural-s}, {resolved_lens_summary}, {resolved_severity_threshold}-and-above severity). Configure with /aivv --setup (4-5 questions) — this hint won't appear again
```

Then write `_setup_hint_shown_at` to user config. On write failure, warn and
continue.

## Step 6.0c Trust Card

Render a compact Trust Card before findings with:

- `review_mode`
- `reviewers`
- `lenses`
- `high_risk_not_applied`
- `agreement`
- `capability_degradations`
- `filtering`
- `evidence_posture`

Use `unknown` plus a capability degradation when a field cannot be computed.

## Case A

For N=1, show reviewer output directly. If a finding connects to session
context the reviewer lacked, add a short orchestrator note.

## Case B Consensus

For N >= 2, read [consensus-output-templates.md](consensus-output-templates.md)
before rendering. Do not improvise from this digest. Highest-priority patterns:

| Pattern | Confidence | Action |
|---|---|---|
| All N flag the same issue | HIGH | Agreed Findings |
| Two+ reviewers surface same Devil's Advocate issue | CRITICAL signal | Treat as agreed and escalate |

If `severity_model: impact_likelihood` is active and raw reviewer
`impact_tier`/`likelihood` axes are available, aggregate axes before severity
lookup per the consensus template; otherwise use max-severity fallback.

## Step 6.1 Walkthrough Hint

Read [setup-hint.md](setup-hint.md) for exact marker semantics. Emit after the
entire Case A/B findings block when all are true:

1. At least one displayed DEFECT-tier finding.
2. `review_mode` is not `same_agent_review`.
3. `_walkthrough_hints_shown.first_findings_rendered` is absent or null.

Emit:

```text
Tip: /aivv-fix investigates and applies targeted remediation for these findings. /aivv --reviewers=N --fix requests auto-chain; consequential findings may still show a Decision Checkpoint, and non-interactive runs may route to dry-run only - this hint won't appear again
```

Then persist the marker timestamp if possible.

## Significance Hint

If current N=1 and at least two heuristics trigger, suggest `/aivv
--reviewers=2`: large diff, critical paths, security/architecture/migration
keywords, long-term decision weight, or real Devil's Advocate finding. For
N>=2, no upgrade hint.

## `/aivv-fix` Recommendation

Skip this subsection when `--fix` was set; Step 8 owns chaining and any
Decision Checkpoint.

Without `--fix`, use `auto_chain_fix`:

- `always`: auto-chain only when findings require action; clean reviews do not
  invoke `/aivv-fix`.
- `ask`: N=1 MAJOR/CRITICAL -> "finding(s) require attention"; N>=2 agreed
  MAJOR/CRITICAL -> "high-confidence finding(s) agreed"; unique-only
  MAJOR/CRITICAL -> medium-confidence note; clean/minor-only -> no message.
- `never`: no recommendation.

## Severity Threshold And Forced Show

Effective `severity_threshold` is CLI > project > user > default `MINOR`.
Filter DEFECT findings (`CRITICAL > MAJOR > MINOR`) below threshold from
user-facing output only; persist them in the review log. POLISH is orthogonal
and always has its own section.

L1 forced-show: render any finding regardless of threshold when `rule_id`
matches `^(COMP-LEGAL-|A11Y-|DP-LEGAL-)` or L1-source text matches summary or
`grounded_by` source/excerpt (`WCAG`, `FTC`, `GDPR`, EU/DSA, `ADA`, Section
508, ARIA APG). Forced-show does not decide legal applicability.

If threshold is non-default, emit a diagnostic line naming hidden and forced
counts. If default, omit it. POLISH rendering remains governed by
`polish_collapsed`; explicit `polish_collapsed: true` still collapses
non-forced POLISH blocks, while L1-source POLISH stays expanded.

## Lens Coverage

Always include a coverage line in the findings header:

```text
Applied: <lenses> · Not applied: <remaining>
```

If high-risk sec/compliance paths matched but fixed dispatch shape excluded
that lens, prefix the not-applied line with a warning.

## Severity Calibration Notes

These are self-check notes about AIVV's classifications, not findings.

CRITICAL-rate note: count full produced DEFECT findings, excluding POLISH. If
`critical_count / defect_total > 0.15` and `defect_total >= 5`, emit a note to
re-check impact-only inflation.

Impact-likelihood notes when fields exist:

- Under-rating mirror: denominator is DEFECT findings with impact
  `CATASTROPHIC` or `SEVERE` and likelihood present. If denominator < 5, emit
  the "minimum 5" note. If at least two high-impact findings are MINOR because
  likelihood is `UNLIKELY`/`POSSIBLE` and rate >= 20%, emit the suppression
  caution.
- DEFECT/IMPROVEMENT split: classify only for this metric. If denominator >= 5
  and improvement share >= 70% with high-risk matches, warn about demoting harm
  to POLISH. If defect share >= 90% and at least two MINOR improvement-category
  findings exist, warn about forcing improvements into the defect matrix.
- Track disagreement: when multi-reviewer clusters have known per-reviewer
  track votes, emit if denominator >= 3, numerator >= 1, and rate >= 25%.
  Otherwise record capability `per_reviewer_track_votes_unavailable` when the
  optional severity_calibration block is written.

Likelihood calibration is corpus-level. Step 6 may render it only when the
target corpus has at least 30 manifestation-tagged records and the current
review emitted a finding in a drifted tier.
