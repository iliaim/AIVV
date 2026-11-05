# Self-Calibration (Step 7)

Append-only JSONL calibration write contract for `/aivv`.

## Path And Routing

Write to `<calibration_dir>/<lens>/<invocation-id>.jsonl` — one per-invocation
shard file per lens, keyed by this `/aivv` invocation's own id (the `<id>` used in
Step 7.5's `review-<id>.json`). All of this invocation's records for a given lens append
to that one shard, so no two `/aivv`/`/aivv-fix` runs ever write the same file and the
concurrent-write lost-update race is eliminated by construction (per-invocation sharding contract). The
legacy shared `<calibration_dir>/<lens>.jsonl` is never written again by this
contract but stays readable — `/aivv-calibrate` unions it with the shards.

Use the cached external `<calibration_dir>` from `.aivv/target-resolution.md`.
Do not infer storage from reviewed paths. The `<lens>` directory segment is the lens file's `calibration_lens`
frontmatter value, defaulting to the lens name. Never hardcode `code`.

Multi-lens routing:
- Homogeneous: write to the single lens's shard.
- `review_meta`: write one denominator record into EACH contributing lens's shard
  (`<lens>/<invocation-id>.jsonl`), with identical `review_id` and only `lens` changed
  per shard; the `<invocation-id>` filename stem is identical across the per-lens copies.
- FP/TP/`bad_fix`/`false_negative` outcome records: route to first lens with a
  `lens_assignment` annotation. <!-- DEFERRED-RETIRE-WHEN: subtask 3d ADR analysis lands (per-lens FP/TP precision data accumulates to inform whether per-finding routing for outcome records changes the spike's conclusion). See `.aivv/calibration/README.md` "Tier 2B multi-lens spike evaluation protocol" Step 4 for the human-side hand-routing convention that consumes `findings[].lens` from the review log directly. -->

## Append Procedure

For every calibration write:

1. Build a valid single-line JSON object.
2. Escape quotes, backslashes, and newlines per JSON.
3. Use the shared storage `read --area calibration` command with cached context
   to read this invocation's own shard `<calibration_dir>/<lens>/<invocation-id>.jsonl`
   if present; otherwise treat as empty. (Safe against concurrency — no other run writes
   this path.)
4. Append record plus `\n`.
5. Stage the complete updated shard in private scratch and publish via the shared
   storage mutation helper, creating the external lens directory there if absent.

<!-- CLAUDE-CODE-SPECIFIC -->
Claude Code/Codex may use native writes for the scratch candidate; active
calibration publication uses the shared storage mutation helper on both hosts.

Publish a complete staged shard without `--append`, or a file containing only
new JSONL lines with `--append`:

```bash
node "$AIVV_ROOT/tools/storage-paths.mjs" write --context "$storage_context_file" \
  --area calibration --relative "$lens/$invocation_id.jsonl" --source "$record" --append
```

## Outcome Cases

- User rejects finding: `kind=false_positive`.
- User rejects agreed N-reviewer finding: `dual_false_positive` or
  `n_way_false_positive`.
- User rejects unique N-reviewer finding: `false_positive`.
- Finding later confirmed real: `true_positive`, `dual_true_positive`, or
  `n_way_true_positive_agreement`.
- Review missed later-shipped bug: `false_negative` with `bug` and `category`.
- User accepts all findings: no outcome record.

Records with severity must uppercase to `CRITICAL`, `MAJOR`, `MINOR`, or
`POLISH`. See `.aivv/calibration/README.md` for full schema semantics.

## Always-Fires `review_meta`

Append one `review_meta` record for every successful non-voided `/aivv`
invocation, even clean reviews. aivv-fix:review_meta

Required fields:

- `lens`
- `kind: "review_meta"`
- `findings_produced`: integer >=0; count of canonical findings Step 7.5 will
  write. For `cold_multi_review` and `cold_multi_model`, use post-dedup
  synthesized finding count, not raw per-reviewer/provider totals. For
  `cold_single_review` and `same_agent_review`, use parsed sidecar count.
- `reviewers`: actual reviewer count.
- `review_id`: invocation id used in `review-<id>.json`.
- `ts`: current UTC RFC3339 timestamp with `Z`.

`review_id` is the denominator de-dup key. `/aivv-fix` skips its own
`review_meta` when consuming `/aivv --review-id=<id>` because `/aivv` already
wrote the denominator.

If Step 6 voided the review with `WORKSPACE_DRIFT_VOIDED_REVIEW`, do not write
`review_meta` or review log state.

Do not prompt the user about calibration. FP/TP/FN writes need clear signals;
`review_meta` still records the denominator when no outcome signal exists.

Optional `/lesson` logging for FP/FN signals is best-effort only and silently
skipped when unavailable.
