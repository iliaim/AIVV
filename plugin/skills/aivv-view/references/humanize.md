# Humanize module — public API

`skills/aivv-view/scripts/humanize.{jq,sh}` is the canonical translation layer for AIVV state data. Any AIVV component or external consumer that wants human-readable labels pipes raw envelope JSON through this module — eliminating per-renderer translation duplication.

## Invocation

### Standalone bash wrapper

```bash
# From stdin
cat envelope.json | bash humanize.sh

# From a file
bash humanize.sh --file envelope.json

# As part of a pipeline
bash view-loader.sh --file review.json | bash humanize.sh > humanized.json
```

The bash wrapper adds date/duration labels formatted in local time (jq's date math is UTC-only), then delegates to the jq module for all string-level translations.

### As a jq module

```bash
jq -L /path/to/skills/aivv-view/scripts 'include "humanize"; humanize' < envelope.json
```

This form is for embedding in larger jq pipelines. It does NOT add `ran_at_label` / `duration_label` (those require bash-side date formatting). Use the standalone bash wrapper if you need date labels.

## Output augmentation

The humanize module adds these `*_label` fields to the canonical envelope:

| Path | Added field | Translation source |
|---|---|---|
| `review_meta` | `lens_label` | lens enum → display name |
| `review_meta` | `review_mode_label` | review mode enum → "N reviewers" form |
| `review_meta` | `ran_at_label` | invoked_at UTC → local-time string (bash only) |
| `review_meta` | `duration_label` | "Nm Ss" duration (bash only) |
| `findings[]` | `severity_desc` | severity → parenthetical guidance |
| `findings[]` | `agreement_label` | agreement/reviewer_attribution → "Both reviewers spotted this" etc. |
| `findings[]` | `evidence_state` | resolution/fix evidence → `open`, `no_fix_session`, `fix_unjoinable`, `addressed_unverified`, `verified_resolved`, `deferred`, `wont_fix`, or `legacy_fixed_claim` |
| `findings[]` | `status_label` | evidence_state → "Open" / "No fix session yet" / "Fix evidence unjoinable" / "Addressed, not verified" / "Verified resolved" / etc. |
| `findings[]` | `wont_fix_label` | recurring wont-fix → "↩ Recurring · previously dismissed" |
| top-level | `loader_warnings_anomalous` | filtered warnings + `.sentence` field |

Original technical fields are preserved unchanged.

When present, `resolution.final_disposition.disposition` is the preferred source for
`evidence_state`: `closed` and `closed_with_residual_risk` map to `verified_resolved`;
`accepted_risk` and `false_positive` map to `wont_fix`; `deferred` maps to `deferred`;
`needs_evidence` maps to `addressed_unverified`; `needs_rework` and `reopened` map to
`open`.

When no final disposition is available, `verified_resolved` is derived from joined
fix-log change evidence: `resolution.fix_outcome` equal to `resolved` or
`verifier-pass-with-residual-warning`. Top-level fix-log `status` values such as
`completed` identify session lifecycle, not per-finding verification outcome.

## Idempotency contract

Running humanize twice on the same input produces identical output. Re-running on already-humanized input safely re-writes the `*_label` fields without accumulating duplicates or losing information.

## Cross-component reuse

- `/aivv view <id> --summary` invokes humanize via view.sh
- Future `/aivv-fix` annotators may consume humanized envelopes for status reports
- External skills + CI report generators use the jq-module form to embed AIVV translations in larger pipelines

## When NOT to use humanize

Tooling consumers that need pure technical data (programmatic field comparisons, schema-version gates, fingerprint joins) should consume the canonical envelope directly without piping through humanize. The `_label` fields are display-layer extensions; technical contracts use the underlying field names.

## Unknown values

If the canonical envelope contains a value the translation table doesn't recognize (e.g., a new lens enum added in a future cycle), humanize passes the value through verbatim. This is deliberate: information is never lost; the display layer falls back to the technical value. Add the new value to `humanize.jq`'s translation table to upgrade the display.
