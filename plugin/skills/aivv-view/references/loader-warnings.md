# Loader Warnings Taxonomy

The loader emits structured warnings in `loader_warnings[]` of the canonical envelope. Warnings partition into two classes:

- **Expected** (operational) — fire on every projection of historical shapes; do NOT count toward AC #7's drift-stability assertion.
- **Anomalous** (drift signal) — indicate genuine data drift OR a join gap; DO count toward AC #7.

## Display Groups

Renderers keep the technical `kind` unchanged and group warnings by actionability:

- **Compatibility:** legacy aliases/defaults and field-shape coercions used to keep historical logs readable.
- **Producer defect:** post-cutoff logs that lack modern fingerprints, handoff fields, or canonical join keys.
- **Join gap:** fix logs or finding IDs cannot be joined to the review/finding they claim to address.
- **Lifecycle:** incident lifecycle records could not be loaded, parsed, joined, or version-accepted.
- **Render gap:** browser fault isolation kept the index alive after one review failed to load, humanize, or render.
- **Deferred design:** known intentional deferrals such as calibration join.

## Expected (operational) kinds

### `field_alias_applied`
Emitted when the loader projected a canonical field from a non-canonical alias. Example: `ref` → `id`, `description` → `summary`, `files[0]` → `file`, `suggested_fix` → `suggested_action`, `convergence` → `reviewer_attribution`.

The `detail` field describes the specific alias-to-canonical mapping that fired.

### `field_default_applied`
Emitted when the loader used a static default because the source had neither the canonical field nor any alias. Currently only fires for: `severity` → `"MINOR"` default.

## Anomalous (drift signal) kinds

### `fingerprint_missing`
The finding had no `fingerprint` field. ~30% of historical corpus lacks fingerprints (older review-eras pre-fingerprint-canonicalization). Anomalous flag exists so consumers can distinguish "fingerprint-joinable" findings from "fingerprint-absent" findings during wont-fix matching.

### `fix_log_unjoinable`
The review log claims a fix exists (for example, `fix_invocation_id` is present), but no fix-log in the supplied `--fix-dir <dir>` references the current review-log's `review_id` through a supported join key. Reviews with no claimed fix session stay Open and do not emit this warning.

### `calibration_skipped_deferred`
Calibration-join is deferred per Sigil #4 in the design spec. Emitted exactly once per loader invocation (envelope level, not per-finding). Will retire once calibration entries carry a structured join key.

### `addressed_unjoinable_id_shape`
A fix-log was found for this review_id but after slug-strip and zero-pad normalization, no finding ids overlap with the fix-log's `findings_addressed[]` entries. This signals a novel id-shape pairing not handled by the normalizer. Investigate the actual id forms in both the review-log and fix-log and extend the normalization logic as needed.

### `finding_quality_legacy_weak`
The finding is readable but lacks one or more modern handoff fields: `evidence`, `impact`, `severity_rationale`, `recommended_next_step`, `verification_path`, or `proportional_remediation`. This is expected for older review logs and anomalous for new writes. Modern findings are validated by schema before write, so this warning targets legacy compatibility rather than modern schema enforcement.

`finding_quality_modern_incomplete` is the compatibility warning for historical
records that already used `quality_profile: modern` before
`proportional_remediation` existed. Durable schemas keep these records readable;
the new-write producer gate still requires the field.

### `field_shape_coerced`
The loader found a value whose JSON type does not match the canonical envelope. The viewer coerces it so the report remains readable, but new producer output should be validated rather than relying on this compatibility path. `detail` names the offending path and the review id.

Two levels are covered:

- **Finding-level** — a legacy scalar/object where an array is expected (`grounded_by`, `evidence`); coerced to an array.
- **Envelope-level audit blocks** (dev.295+) — `provider_trust`, `review_scope`, `plan_review`, `review_prompt_profile` (and its nested `redaction_summary`), `reviewer_evidence_packet`, `reviewer_roster`; a non-object is coerced to `null`, and a non-array roster (or a non-object roster entry) is dropped.

The envelope-level guard exists because `--html` sub-indexes these blocks. Before it, a block written with the wrong type reached the renderer and died as `jq: Cannot index string with string "..."` — exit 5, no report at all, naming neither the review nor the field. The `//` operator these panels used guards `null`, not type. Coercing at the loader means the renderer's existing section gates short-circuit, so only the affected panel is omitted while the rest of the report renders. The write-side producer gate added in dev.294 prevents new logs from reaching this path; this warning covers logs already on disk, which stay readable and are never rewritten (immutable-history policy).

### `loader_error` / `humanize_error` / `render_error`
Browser-mode fault-isolation warnings. A single review failed in the loader, humanizer, or linked-report renderer, so the browser emitted a safe row for that review and continued building the rest of the index.

## Lifecycle warning kinds

Slice 1A emits lifecycle loader warnings under `lifecycle.loader_warnings[]`, using the same `{file, kind, detail}` shape as canonical-envelope `loader_warnings[]`. For lifecycle warnings, `file` may point to the lifecycle record that triggered the warning rather than the source review log.

### `lifecycle_dir_missing`
The configured lifecycle directory does not exist, so the lifecycle projection continues with no lifecycle records.

### `lifecycle_record_malformed`
A lifecycle record exists but could not be parsed or projected into the supported lifecycle shape. The loader isolates the malformed record and continues processing the remaining records.

### `lifecycle_link_unresolved`
A lifecycle record could not be joined to its referenced review, finding, or lifecycle target through the supported link keys.

### `lifecycle_evidence_ref_unresolved`
A lifecycle record references evidence that could not be resolved in the loaded review/finding evidence set.

### `lifecycle_unsupported_version`
A lifecycle record declares a schema or record version that Slice 1A does not support.

### `lifecycle_record_ignored`
A lifecycle record was intentionally skipped because its shape, target, or state is outside Slice 1A's supported projection surface.

**Note on retired kinds:** `lens_attribution_unresolvable`, `shape_unknown_outer`, `shape_unknown_finding`, and `shape_first_seen` are documented in the taxonomy for Phase 1+ drift-detection use and are NOT emitted in Phase 0. They have been removed from the Phase 0 schema enum and from humanize.jq's anomalous-warning filter pending their implementation.

## Reading a warning

Every warning object has the form:
```json
{
  "file": ".aivv/state/review-<review-id>.json",
  "kind": "field_alias_applied",
  "detail": "id projected from `ref`"
}
```

`file` is the source review-log; `kind` is the enum; `detail` is human-readable.

## Filtering anomalous warnings

The humanize module surfaces anomalous warnings via the `loader_warnings_anomalous[]` array (added to the envelope when humanize is applied). Each entry has an additional `sentence` field with a user-friendly explanation. See [humanize.md](humanize.md).
