# Step 7 DOCUMENT — predecessor backfill and calibration write-specs

Detail relocated from `skills/aivv-fix/SKILL.md` Step 7 DOCUMENT. The inline skeleton keeps the resolution-summary table, the Finding-column sourcing rule, the Step 7.8 viewer hook (which has its own reference), and the pattern-capture suggestion. This reference is the canonical home for the predecessor-review backfill heuristic (`fix_invocation_id` write-back + `source_review_id` persistence) and the calibration JSONL append-record field specs.

## Predecessor backfill on fix-log → review-log

**Predecessor backfill on fix-log → review-log:** when `/aivv-fix` is chained from a `/aivv` review (source == "review_id"), update the originating review log's `fix_invocation_id` field with the current fix-log's `id`. This enables Case B cross-invocation predecessor resolution in subsequent rounds.

Also persist `source_review_relative_path` exactly as returned by review-ID
resolution, including `archive/` when selected. The validator re-reads that
source review through the invocation's storage context and verifies the source
ID and every selected root finding before it accepts the fix-log candidate.

For every `FixSession.source == "review_id"` write, also persist the originating
review id in `source_review_id` even when the incoming argument was stored as
`review_id` or `source_argument`. `source_review_id` is the canonical viewer/join
key; `review_id` may be preserved for backward compatibility, but it is not a
substitute. Before the durable fix-log write, materialize the candidate fix log
to a temp JSON file and run:

```bash
# Use the AIVV_ROOT pinned and preflighted at this `/aivv-fix` invocation's
# start; invoke the validator by absolute path without resolving a second root.
node "$AIVV_ROOT/tools/pre-write-validator.mjs" --fix-log <candidate-fix-log.json> \
  --context "$storage_context_file" --new
```

Use `--new` only for the initial `in-progress` fix-log write. For each later
update, validate with `--fix-log <candidate-fix-log.json> --context
"$storage_context_file" --update`. The validator reads the persisted
`fix-<invocation_id>.json` itself through the storage helper. This checks that
the invocation ID and authorized scope stay fixed and retry count and
append-only history cannot be reset or rewritten. A legacy in-progress log
without these fields cannot safely resume; start a new top-level invocation
from its original selected findings.

If the validator returns non-pass, repair the candidate before writing. Do not use legacy `review_id` or `source_argument` as a substitute for `source_review_id` on new review-sourced fix logs; new writes must also carry nonempty `findings_addressed[]` and nonempty `changes_summary[]`, with unambiguous bidirectional normalized ID coverage: every `changes_summary[].finding_id` must join to `findings_addressed[]`, every addressed finding must have at least one matching `changes_summary[]` entry, and ambiguous normalization collisions across `findings_addressed[]` and `changes_summary[].finding_id` must halt before write.

Historical logs are not rewritten in place by compatibility tooling. Use the `AIVV_ROOT` pinned and preflighted at this invocation's start, then use `node "$AIVV_ROOT/tools/state-compat-index.mjs" --context "$storage_context_file" --state-dir "<state_dir>" --output "<state_dir>/compat-index.json"` to derive safe read-side proposals: missing/prefixed fix-log `source_review_id`, review-log `fix_invocation_id` when exactly one fix log joins to the review, and deterministic finding fingerprints. If multiple fix logs join to one review, the helper records the `fix_invocation_id` gap as `unsafe` instead of guessing.

Retain `FixSession.source_review_relative_path` from review-ID resolution and
use that exact selected relative path for both the read and write, including an
`archive/` prefix. Do not create a root duplicate for an archived review. Read
the originating review through shared storage `read` first. Stage the
reviewed backfill in private scratch, then publish under the target lock:
```bash
source_review_id="$(jq -r .source_review_id <fix-log>)"
fix_id="$(jq -r .id <fix-log>)"
source_review_relative_path="<FixSession.source_review_relative_path>"
node "$AIVV_ROOT/tools/storage-paths.mjs" read --context "$storage_context_file" \
  --area state --relative "$source_review_relative_path" > "$review_snapshot"
jq --arg fid "$fix_id" '. + {fix_invocation_id: $fid}' "$review_snapshot" > "$candidate"
node "$AIVV_ROOT/tools/pre-write-validator.mjs" \
  --review-log-backfill "$candidate" --context "$storage_context_file" \
  --relative "$source_review_relative_path"
node "$AIVV_ROOT/tools/storage-paths.mjs" write --context "$storage_context_file" \
  --area state --relative "$source_review_relative_path" --source "$candidate"
```

## Calibration write-specs (JSONL append)

This is the body of Step 7's **Calibration** item (numbered item 2 in the inline Step 7 skeleton).

**Calibration**: For false positives (`already-correct` verdicts), record to AIVV calibration as an inline JSONL append. Publish using the shared storage mutation helper.

Calibration file path (per-invocation shard, per-invocation sharding contract): `<calibration_dir>/<lens>/<invocation-id>.jsonl` where `<target>` is the path cached in `session_changes.target_project` from Step 5.0 and `<invocation-id>` is THIS `/aivv-fix` run's own fix-log `id` (e.g., `<calibration_dir>/code/<invocation-id>.jsonl`). All of this invocation's calibration records for a lens append to that one shard. Default lens is `code`; `sec` and `visual` (shipped dev.22) and any future-additional lenses use their own `<lens>/` shard directory per the lens name recorded on the originating finding (`lens` field in the envelope schema, defaulting to `code` when absent for backward-compat with pre-dev.22 findings). Because the shard path is unique to this invocation, concurrent runs never collide — the legacy shared `<lens>.jsonl` is never written again (readers union it for back-compat).

**Calibration write — append to the external per-invocation shard:**

Same pattern as `/aivv` Step 7 calibration writes (read this invocation's own shard if present → append new record line → write back). The shard is invocation-private, so the read-before-append is safe against concurrent runs.

For `already-correct` verdicts (`kind: "false_positive"`), construct a JSON record with these fields:
- `lens`: lens name (default `"code"`)
- `kind`: `"false_positive"`
- `finding`: finding summary (escape per JSON spec)
- `severity`: severity level — uppercase the value before append (`critical`→`CRITICAL`); MUST be one of `CRITICAL`/`MAJOR`/`MINOR`/`POLISH` (per `.aivv/calibration/README.md` severity write rule)
- `evidence`: evidence text (escape per JSON spec)
- `ts`: current UTC time in RFC 3339 with `Z` suffix

For shipped bugs discovered post-review (`kind: "false_negative"`), construct with:
- `lens`: lens name
- `kind`: `"false_negative"`
- `bug`: bug description (escape per JSON spec)
- `category`: `"correctness"` | `"security"` | `"edge-case"`
- `ts`: current UTC time

For fixes later found to have introduced a regression (`kind: "bad_fix"`), see [.aivv/calibration/README.md](../../../.aivv/calibration/README.md) for the field list (`fix_regression`, `root_cause_of_bad_fix`, plus standard `lens`/`kind`/`ts`). Schema lives in calibration/README.md only — no field-list duplication here.

**Conditional `review_meta` write (de-dup contract).** `/aivv-fix` writes ONE `review_meta` record per invocation if and only if its findings did NOT come from a `/aivv` review log — i.e., when `FixSession.source` is `"conversation"`, `"literal"`, or `"task_file"`. When `FixSession.source == "review_id"` (the `/aivv --fix` auto-chain path or a fresh-session resumption via `--review-id=<id>`), the originating `/aivv` invocation already wrote the `review_meta` for that review and `/aivv-fix` SKIPS its own write. The unique key is `review_id`; double-writing would pollute the denominator.

When the write fires (non-`review_id` sources), construct the record with these fields and append via the same read-modify-write JSONL pattern:

- `lens`: lens name (default `"code"`)
- `kind`: `"review_meta"`
- `findings_produced`: integer ≥0; the count of findings the consumed source presented to /aivv-fix at Step 1 (after wont-fix-registry pre-filter). For literal-finding invocations, `1`. For task-id sources, the count of `open_issues` parsed. For conversation sources, the count of findings extracted from Signal 0–4.
- `reviewers`: integer ≥1; defaults to `1` (conversation, literal, and task-id sources are not multi-reviewer by construction; only `/aivv --reviewers=N` sources produce N>1, and those flow through the `review_id` path which is exempt from this write).
- `review_id`: the `/aivv-fix` invocation ID (the fix-log's own `id` field, NOT the consumed source's ID — because no upstream `/aivv` exists to claim that ID).
- `ts`: current UTC time in RFC 3339 with `Z` suffix.

Skip this write under `--dry-run` (parallel to the existing dry-run gate's calibration-write skip in Step 5.0).

Append the single-line JSON to `<calibration_dir>/<lens>/<invocation-id>.jsonl` (this invocation's shard) via a staged read-modify-write candidate published through the shared storage mutation helper (read the shard's existing content if any, append `<json>\n`, write back). Stage and publish the complete shard through the shared storage mutation helper; create only the external lens directory.

<!-- CLAUDE-CODE-SPECIFIC -->
Construct the record in context and stage its bytes in private scratch on either
host; then append through the installed helper:

```bash
node "$AIVV_ROOT/tools/storage-paths.mjs" write --context "$storage_context_file" \
  --area calibration --relative "$lens/$invocation_id.jsonl" --source "$record" --append
```

Alternatively publish a complete staged shard without `--append`. Never append
the complete existing shard with `--append`, which would duplicate observations.

**Emit pending_calibration records (from Step 6 auto-emit):**

For each record queued in `pending_calibration` during Step 6:
- Append to `<calibration_dir>/<lens>/<invocation-id>.jsonl` (this invocation's shard) using the same read-modify-write pattern as other calibration records.
- Clear `pending_calibration` after writing.

**Emit challenger calibration records (from Step 4.5 outcomes):**

After Step 6 verifier PASS:
- For each finding where Step 4.5 returned REVISE/REJECT AND the revised fix was applied AND verifier confirmed resolved: emit `challenger_caught_issue` with fields `finding_id`, `challenger_verdict`, `concern_kind` (from challenger's `concerns[0].kind`), `fix_revised: true`.
- For each finding where user explicitly overrode a REVISE/REJECT concern AND verifier confirmed original fix was correct: emit `challenger_false_positive` with fields `finding_id`, `concern_kind`, `user_override_reason`.

**Emit `challenge_budget_exhausted` (if circuit-breaker fired in Step 4.5):**

If `max_challenges_per_invocation` was hit during this invocation, emit one `challenge_budget_exhausted` record with `invocation_id`, `max_challenges`, `batches_skipped`.

**Add `fix_confidence` to `review_meta` record:**

When writing the `review_meta` calibration record (per the de-dup contract), include the `fix_confidence` distribution:
```json
{"lens": "code", "kind": "review_meta", "ts": "...",
 "findings_produced": N, "reviewers": 2, "review_id": "...",
 "fix_confidence_distribution": {"high": N1, "medium": N2, "low": N3}}
```
