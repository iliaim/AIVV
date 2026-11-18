# Lifecycle selectors: routing and write-back

Read only when `--incident`, `--problem`, `--issue`, or `--github-issue` was extracted (Step 1), and again before any lifecycle write-back (Step 5). Flag syntax is in [fix-flags.md](fix-flags.md).

## Contents

- [Lifecycle selector routing](#lifecycle-selector-routing)
- [Lifecycle write-back rules](#lifecycle-write-back-rules)

## Lifecycle selector routing

If any lifecycle selector was extracted, route it before ordinary source parsing:

1. Reject more than one lifecycle selector with `lifecycle-selector-conflict`.
2. Resolve the target. If `--target=<dir>` was supplied, pass that directory to the route helper. Without `--target`, use the same Git-root/cwd default and resolved external store. A legacy-only match reports import-needed and never becomes executable implicitly.
3. Run the deterministic route helper:
   ```bash
   node "$AIVV_ROOT/tools/incident-lifecycle-route.mjs" --context "$storage_context_file" --target "<target>" --incident "<id>"
   node "$AIVV_ROOT/tools/incident-lifecycle-route.mjs" --context "$storage_context_file" --target "<target>" --problem "<id>"
   node "$AIVV_ROOT/tools/incident-lifecycle-route.mjs" --context "$storage_context_file" --target "<target>" --issue "<id>"
   node "$AIVV_ROOT/tools/incident-lifecycle-route.mjs" --context "$storage_context_file" --target "<target>" --github-issue "<url|owner/repo#N>"
   ```
4. If the helper exits non-zero, halt before Step 2 and surface its JSON `reason` and `detail`. State is kept per checkout: `lifecycle-target-missing` or `github-issue-mirror-missing` from a fresh worktree means the record lives in another checkout's store (named in `state_dir`), not that it was lost.
5. Bind `lifecycle_context = route.lifecycle_context` in session state and carry it unchanged into `session_changes.lifecycle_context` at the first fix-log write (Step 4.4).
6. Bind `FixSession.source` from `route.source_mode`:
   - `review-sourced` and `finding-sourced` → `FixSession.source = "review_id"` and `source_review_id = route.source_review_id`.
   - `investigation-only` → `FixSession.source = "conversation"` and do not claim review-sourced findings.
7. If `--review-id=<id>` was also supplied, it must equal `route.source_review_id` when the route has one; otherwise halt with `lifecycle-review-id-mismatch` before Step 2.
8. If `route.filter_finding_id` is present, collect the review log through the usual `--review-id` path and filter the finding list to that single finding even when `route.source_mode == "review-sourced"`. This prevents a lifecycle record linked to both `review_log` and `finding` from applying the whole review.
9. If `route.source_mode == "finding-sourced"`, require `route.filter_finding_id`; without it, halt with `lifecycle-finding-route-missing-filter`.
10. If `route.source_mode == "investigation-only"`, skip review-log finding collection and run Step 3 investigation over the lifecycle record context. The resulting fix log may include `lifecycle_context`, but it must not write `source: "review_id"` or nonempty `findings_addressed` unless a concrete review finding is later linked.

Lifecycle routing MUST NOT create `FixSession.source = "incident"`, `"problem"`, `"issue"`, or `"github_issue"`. Those values are selector types only; `lifecycle_context` is the side-channel that preserves selector provenance.

## Lifecycle write-back rules

When `lifecycle_context` is present, initialize `session_changes.lifecycle_context` before the first fix-log write. Before Step 3 investigation, load the lifecycle record named by `lifecycle_context.record_path` and pass a compact context summary to the investigator. Treat `rca_status: "not-started"` and `rca_status: "draft"` as investigation-first states; they are not fix-ready unless linked review findings already identify concrete changes.

Lifecycle write-back rules:
- Incident and problem RCA/prevention updates may write only schema-backed fields: `root_cause_analysis`, `incident_context`, `prevention_plan`, `rca_status`, `updated_at` when the record schema supports it, and `links`.
- Local issue workflow updates may write only schema-backed fields: `status`, `updated_at` when the record schema supports it, `links`, `closure_decision` when `status: "closed"`, `timeline`, and `sync.status`.
- Verifier failure reopens RCA investigation by moving the lifecycle record back to an investigation state and adding a `fix_log` link to the failed fix log.
- The convergence cap writes a problem-level or architecture-level recommendation into the lifecycle record rather than looping silently.
- GitHub updates are drafted through the sync helper:
  ```bash
  node "$AIVV_ROOT/tools/incident-github-sync.mjs" plan --context "$storage_context_file" --issue "<issue-record>" --repo "<owner>/<repo>"
  node "$AIVV_ROOT/tools/incident-github-sync.mjs" apply --context "$storage_context_file" --issue "<issue-record>" --repo "<owner>/<repo>" --confirm
  ```
- `/aivv-fix` must not directly invoke `gh`; remote issue edits go through `tools/incident-github-sync.mjs`.
- After every lifecycle record write, validate the record:
  ```bash
  node "$AIVV_ROOT/tools/incident-state.mjs" validate --file "<record-file>" --state-dir "<state_dir>" --kind "<incident|problem|local-issue>"
  ```
