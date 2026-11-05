# Projection Table — 15 Review-Log Shape Variants

This table enumerates every historical review-log shape variant observed in `.aivv/state/review-*.json` across the dev.6 → current cycles. Each row identifies the unique key-set and the dev-era it represents.

## Verifying grep

```bash
for f in .aivv/state/review-*.json; do jq -c '.findings[]? | keys' "$f"; done | sort -u
```

This should produce exactly 15 distinct key-sets.

## Shape variants

| # | Keys (sorted) | Source era |
|---|---|---|
| 01 | `["agreement","category","files","id","severity","summary","title"]` | dev.6 era |
| 02 | `["agreement","description","file","fingerprint","fix_status","line","ref","severity"]` | dev.10 era |
| 03 | `["agreement","description","file","fingerprint","line","ref","rule_id","severity"]` | dev.20 era |
| 04 | `["agreement","description","file","fingerprint","line","ref","severity"]` | dev.30 era |
| 05 | `["agreement","description","file","fingerprint","ref","rule_id","severity"]` | dev.31 era |
| 06 | `["agreement","description","file","fingerprint","ref","severity"]` | dev.35 era |
| 07 | `["agreement","description","fingerprint","ref","severity"]` | dev.40 era |
| 08 | `["category","confidence","devils_advocate","file","grounded_by","id","improvement","lens","line","reviewer","severity","summary","value"]` | dev.41+ full envelope (POLISH-aware; `value` may be legacy prose or legacy-schema compatibility rules enum metadata) |
| 09 | `["category","confidence","devils_advocate","file","grounded_by","id","improvement","lens","reviewer","severity","summary","value"]` | dev.41+ no-line variant |
| 10 | `["confidence","convergence","files","id","rule_id","severity","suggested_fix","summary"]` | dev.55 era |
| 11 | `["confidence","cross_reviewer_agreement","grounded_by","id","lens","rule_id","severity","summary"]` | dev.60 era |
| 12 | `["confidence","grounded_by","id","lens","rule_id","severity","summary"]` | dev.70 era |
| 13 | `["convergence","grounded_by","id","severity","suggested_action","summary"]` | dev.80 era |
| 14 | `["convergence","grounded_by","severity","suggested_action","summary"]` | dev.85 era |
| 15 | `["convergence","id","severity","suggested_action","summary"]` | dev.90 era |

## Projection rules (alias-first priority)

The loader projects each shape into a single canonical envelope per these rules (corpus-frequency priority — the alias more commonly observed wins on aliased fields):

| Canonical field | Aliases (in priority order) | Default | Notes |
|---|---|---|---|
| `id` | `ref` → `id` | `null` | Ref-first per dev.10-40 corpus frequency |
| `severity` | `severity` | `"MINOR"` | Default fires `field_default_applied` warning |
| `impact_tier` | `impact_tier` | `null` | legacy-schema compatibility rules impact axis; preserved when emitted, never synthesized |
| `likelihood` | `likelihood` | `null` | legacy-schema compatibility rules likelihood axis; preserved when emitted, never synthesized |
| `confidence` | `confidence` | `null` | Phase 0+: dev.41+ shapes only |
| `category` | `category` | `null` | dev.6 + dev.41+ shapes |
| `summary` | `description` → `summary` → `title` → `""` | `""` | Description-first per dev.10-40 frequency |
| `title` | `title` | `null` | Preserved alongside `summary` when both present |
| `file` | `file` (string) → `files[0]` | `null` | dev.6 uses `files` array; later uses `file` string |
| `line` | `line` | `null` | Some shapes omit |
| `reviewer` | `reviewer` | `null` | NOT synthesized to "solo" — null pass-through |
| `lens` | finding's `lens` → top-level `lens` | `null` | Finding-own takes priority |
| `rule_id` | `rule_id` | `null` | dev.20+ shapes; preserved exactly when present, never synthesized or rewritten |
| `devils_advocate` | `devils_advocate` | `false` | dev.41+ shapes |
| `grounded_by` | `grounded_by` | `[]` | dev.41+ shapes |
| `runtime_evidence` | `runtime_evidence` | `null` | Manifest-bound Playwright evidence ingested after review; preserved and rendered when present |
| `agreement` | `agreement` | `null` | NOT coalesced from convergence (separate fields) |
| `reviewer_attribution` | `convergence` → `cross_reviewer_agreement` | `null` | Free-form passthrough |
| `fingerprint` | `fingerprint` | `null` | NO post-hoc compute |
| `improvement` | `improvement` | `null` | dev.41+ shapes |
| `value` | `value` | `null` | Raw value field; render `high`/`medium`/`low` as legacy-schema compatibility rules "Improvement value" metadata, otherwise render as legacy "Value justification" prose |
| `effort` | `effort` | `null` | legacy-schema compatibility rules improvement effort enum metadata |
| `suggested_action` | `suggested_action` → `suggested_fix` | `null` | dev.55+ uses suggested_fix; dev.80+ uses suggested_action |
| `fix_status` | `fix_status` | `null` | dev.10 era only |
| `calibration` | (none) | `null` | Sigil-deferred per Phase 0 design |
| `resolution` | (from joined fix-log) | `null` | Populated when --fix-dir provided AND fix-log references this review_id |
| `wont_fix` | (from joined wont-fix-registry) | `null` | Populated when --wont-fix provided AND fingerprint matches |

## Drift detection

When the loader encounters a finding whose sorted key-set does NOT match any of the 15 enumerated shapes, it emits a `shape_first_seen` warning. This signals that the projection-table.md may need an update — investigate the new shape, decide whether to extend the table or treat as malformed.

Similarly, an unrecognized top-level review-log key-set fires `shape_unknown_outer`.

## Lifecycle Projection

The canonical envelope may include a read-only `lifecycle` object joined from
sibling `.aivv/state/` lifecycle records. Slice 1A populated
`lifecycle.incidents[]`; Slice 1B adds local problem-cluster and local issue
projection.

Single-report mode projects incidents only when an incident links to the current
review id, finding id, finding fingerprint, or source fix id. Malformed
incident records are isolated in `lifecycle.loader_warnings[]` and do not break
review rendering.

Problem records project when they link to the current review id, a projected
incident id, a current finding id, or a source fix id. Local issue records
project when they link to the current review id, a projected problem id, a
projected incident id, a current finding id, or a source fix id.

| Canonical lifecycle field | Source field | Default | Notes |
|---|---|---|---|
| `lifecycle.problems[].id` | `problem.id` | none | Problem-cluster lifecycle id |
| `lifecycle.problems[].status` | `problem.status` | none | Technical status; labels are display-layer only |
| `lifecycle.problems[].rca_status` | `problem.rca_status` | none | Technical RCA maturity state |
| `lifecycle.problems[].closure_gate_statuses` | `problem.closure_gates.*.status` | `{}` | Collapses closure gate objects to status values |
| `lifecycle.issues[].id` | `issue.id` | none | Local issue lifecycle id |
| `lifecycle.issues[].external_id` | `issue.external_id` | none | Stable local mirror id for eventual sync |
| `lifecycle.issues[].status` | `issue.status` | none | Technical status; labels are display-layer only |
| `lifecycle.issues[].sync_status` | `issue.sync.status` | `"local-only"` | Local sync state projected without GitHub network access |
| `lifecycle.issues[].acceptance_criteria` | `issue.acceptance_criteria` | `[]` | Local issue acceptance criteria pass through verbatim |
