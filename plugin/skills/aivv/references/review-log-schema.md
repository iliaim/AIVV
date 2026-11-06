# Review-Log Schema (Step 7.5)

After calibration and before Step 8 auto-chain, write
`<state_dir>/review-<invocation_id>.json` for every non-voided review that ran
after its scope and final method were resolved and announced, including clean
reviews. Do not write a review log for a review held on genuine ambiguity,
missing authority, explicit ask-mode confirmation, or canceled scope, or voided
by workspace drift. The normal preamble may already have initialized
configuration, written hints, or run authorized maintenance before scope
resolution; a pre-dispatch hold does not claim
those earlier writes were absent or rolled back. The orchestrator writes this
log; reviewer agents are read-only.

Invocation ID format: `YYYY-MM-DDTHH-MM-SS-<4-char-random-hex>`, computed at
invocation start.

## Required Top-Level Fields

Emit schema-version-2 logs in this order when present:

1. `schema_version: 2`
2. `id`
3. `command: "aivv"`
4. `status`: `completed`, `in-progress`, `failed`, `abandoned`, or
   `voided-workspace-drift`
5. `invoked_at`, `completed_at` in UTC `Z` form
6. `target_project`
7. `lens`: string for homogeneous review; array length N for multi-lens/KxM
8. `reviewers`
9. `review_mode`
10. `capability_degradations`
11. `trust_summary`
12. `decision_checkpoint`
13. `assurance_plan` when findings need objective closure evidence
14. optional audit blocks: `review_scope`, `plan_review`,
    `review_prompt_profile`, `reviewer_evidence_packet`, `reviewer_roster`,
    `lens_detection`, `scope_confirmation`, `severity_calibration`
15. optional `workspace_sha_start`, `workspace_sha_end`
16. `findings`
17. optional `runtime_evidence_ingest`
18. `warnings`

Trust summary mirrors the rendered Trust Card. Decision checkpoint records
`required`, `reason_codes`, `interactive`, `outcome`, `selected_finding_refs`,
and `recorded_at`. Assurance plan records required evidence and acceptance
criteria joined to finding refs.

`review_scope` shape:
`{subject_type, final_scope, target_project, state_target, evidence_sources,
included_files, excluded_or_dropped_scope, scope_confirmation}`. `subject_type`
includes `session`, `file`, `idea`, `project`, `artifact`, `user-journey`, and
`plan`.

`plan_review` shape:
`{plan_path, implementation_verified:false, verify_skip_reason}`.

`review_prompt_profile` should prefer hashes/metadata over raw prompt content
and set `full_prompt_available:false` when content is omitted.

`reviewer_roster` entries:
`{label, display_name, dispatch_path, provider?, model?, model_source?, lens,
status, status_reason?, finding_refs}`. For native host-inherited model
where exact model is unavailable, use `model:"inherited"` and
`model_source:"host-inherited-unreported"`.

`lens_detection` shape:
`{mode, floor_matches, high_risk_matches, ceiling, applied, not_applied,
user_choice, lens_origin, suppression_reason}`. Persist only redacted/capped
`trigger_excerpt` values.

`scope_confirmation` shape for a review that actually ran (the historic field
name is retained; see the canonical scope-resolution procedure in
[`scope-confirmation.md`](scope-confirmation.md)):
`{mode, was_trivial, classification_reason, proposed_scope, options_offered,
user_choice, final_scope, dropped_scope?, suppression_reason}`. Omit on early
exits, voided reviews, or a hold before scope/method resolution. `mode` records
the resolved `announce` or `ask` policy. The default is `announce`; a manually
configured ask preference or explicit `--ask-scope` remains visible in the
record.

`severity_calibration` shape:
`{model:"impact_likelihood", under_rating_mirror, track_split,
track_disagreement}`.

## Predecessor Linkage

If `--predecessor-review-id=<id>` is explicit, honor it; `none` suppresses
auto-detection. Otherwise list/read visible completed prior review logs through
the cached storage context (including archive) within 24h, require
target match, an intervening `/aivv-fix`, and Jaccard overlap of finding files
>= 0.7. First match wins and records `predecessor_review_id` plus
`predecessor_detection_method:"auto-heuristic"`.

## Pre-Write Gate

Before writing, materialize the complete candidate to a temp JSON file and run:

```bash
# Resolve AIVV_ROOT using the shared runtime-root contract in
# the bundled `.aivv/runtime-root.md` contract, then invoke the validator by absolute path.
node "$AIVV_ROOT/tools/pre-write-validator.mjs" --review-log <candidate-review-log.json>
```

It must return `{"status":"pass","reason":"pass"}`. Any `halt` means fix the
in-memory synthesis and retry. This producer gate is stricter than the durable
schema because historical logs remain readable.

Every structured audit block is checked against its durable shape: `review_scope`,
`reviewer_roster`, `plan_review`, `review_prompt_profile`, `reviewer_evidence_packet`,
and `provider_trust`. Each is optional — omitting one stays valid — but writing a
malformed one halts with a reason naming the block (e.g.
`review-log-review-scope-invalid`). Write `review_scope.evidence_sources` as objects
with `kind` + `summary` (never bare strings), and `review_prompt_profile.redaction_summary`
as an object (never a prose string): both shapes were written by real orchestrators
obeying an earlier version of this file, and both break `aivv view --html`.

After a passing producer gate, publish the staged candidate:

```bash
node "$AIVV_ROOT/tools/storage-paths.mjs" write --context "$storage_context_file" \
  --area state --relative "review-$invocation_id.json" --source "$candidate"
```

Include additive `storage_context` provenance as permitted by the durable schema:
`instance_key`, bound `target_project`, and original `policy_target`. Resolve
current policy on handoff; this metadata does not authorize an auto-apply decision.
Normalize file-backed finding paths relative to the bound target without changing
their original absolute referents.

## Canonical JSON Form

- 2-space indent, no tabs, exactly one trailing newline.
- Raw UTF-8; do not escape ordinary non-ASCII characters.
- Omit absent optional fields; do not write null unless a field explicitly uses
  null as meaningful.
- Empty arrays are compact `[]`.
- Normalize paths to POSIX separators.
- JSON-escape control characters; `workspace_sha_*` may contain NULs.
- Materialize candidates in private invocation scratch, then publish through the
  shared storage mutation helper; do not use direct host writes for active state.

## Findings Array

For single/same-agent reviews, use parsed reviewer JSONL. For multi-review or
multi-model, use synthesized post-dedup findings, not raw per-reviewer findings.

Each new finding must include:

- `ref`
- `fingerprint`
- `severity`
- exactly one location: `file` (+ optional `line`) OR `scope_ref`
- `description`
- `agreement`
- optional multi-lens `lens` only when top-level `lens` is an array
- optional impact-likelihood fields: `impact_tier`, `likelihood`, `value`,
  `effort`, `category`
- `quality_profile:"modern"`
- non-empty `evidence`
- `impact`
- `severity_rationale`
- `recommended_next_step`
- `verification_path`
- complete `proportional_remediation` (`present_problem`,
  `simplest_viable_correction`, `net_complexity`,
  `why_current_shape_insufficient`)

Do not invent fake file paths for process/session/project findings. Use
`scope_ref` instead.

Fingerprint formula: after finalizing location and description, hash
`<normalized_file>:<lowercased_description>` for file-backed findings, or
`<scope_ref.kind>:<scope_ref.ref>:<lowercased_description>` for scoped findings.
Use the runtime-contract `git hash-object --stdin --no-filters` SHA-1 formula.
Missing or malformed fingerprints are producer bugs.

Homogeneous reviews omit `findings[].lens`; top-level `lens` already applies.
Multi-lens/KxM reviews set per-finding lens as follows:

- `lens-domain-catch`: single catching lens.
- `cross-lens-convergence`: array of distinct contributing lenses.
- `intra-lens-convergence`: single lens of the agreeing M-block.
- Other agreements: omit per-finding lens.

When top-level `lens` is an array, its length must equal `reviewers`.

## Runtime Evidence Ingest

Runtime evidence is a post-review helper mutation, not reviewer output:

```bash
node "$AIVV_ROOT/tools/runtime-evidence.mjs" ingest --review <review-log.json> --results <playwright-results.json> [--manifest <manifest.json>]
```

The helper may update only `findings[].runtime_evidence`,
`findings[].epistemic_modes`, `findings[].evidence_modes_diversity`,
top-level `runtime_evidence_ingest`, and append-only warnings.

Runtime evidence must carry manifest identity: `probe_id`, `review_id`,
`finding_ref`, `finding_fingerprint`, and `assertion_polarity`. `review_id` and
`finding_ref` must match the log. `ran_at` and `updated_at` must be RFC 3339.

## Voided And Error Handling

If Step 6.0 voided the review with `WORKSPACE_DRIFT_VOIDED_REVIEW`, do not write
a review log. If the write fails after output was already presented, warn the
user; the review still completed, but the audit artifact was lost.
