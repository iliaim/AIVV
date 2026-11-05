# AIVV Per-Invocation State Maintenance (Preamble)

> **Shared contract:** `/aivv-fix` Step 1.0 and `/aivv` Step 1.9 use this mechanism. Bind the context in [target-resolution.md](target-resolution.md) first. No provisional-cwd maintenance or second target pass.

## External state only

`<state_dir>` is the external target-instance directory returned by the shipped
storage helper. Read-only routes and `/aivv-fix --dry-run` may inspect state but
never initialize, import, reap, quarantine, archive, or clean it. A missing store
is empty for a fresh invocation, not a reason to create a migration marker.
Legacy `.aivv/state`, `.aivv/calibration`, and `.claude/sessions` files are
read-only history, including malformed/newer records and archives. Never move,
rename, normalize, delete, or rewrite them on normal invocation. Malformed
configuration is preserved at its original location; warn and fall through.

## Explicit history import

Use the installed runtime's import helper, with an explicit source:

```bash
node "$AIVV_ROOT/tools/state-import.mjs" preview --context "$storage_context_file" --source "<legacy-source>" > "$preview"
node "$AIVV_ROOT/tools/state-import.mjs" import --context "$storage_context_file" --source "<legacy-source>" --preview "$preview"
```

Preview names source/destination, digests, target mismatches, and conflicts.
Use `--choices "$choices"` for conflicted objects, with keys from preview
`files[].key`, for example `{"state/wont-fix-registry.json":"keep-current",
"state/review-id.json":"replace"}`. Preview binds source/destination digests;
byte drift requires a new preview. Follow explicit choices; replacement must
preserve the current version as history. Unresolved records are skipped without
blocking unrelated fresh work. Exact repeats are no-ops; reimport cannot silently
restore forgotten suppressions or deleted completed loops. Do not use ordinary
host writes to bypass import validation or its exclusive operation lock.

Only completed import manifests make imported copies visible. Readers and crash
recovery exclude pending/incomplete copies. Original source bytes remain
unchanged. Corrupt/newer objects remain historical until their ordinary schema
and route checks pass. Old pending Inbox requests stay non-executable; requeue
through the current receiver's target/revision/workspace/expiry/overlap checks.
An imported/moved target is not authorization to fix another checkout.

After import, only the external store supplies active mutable state. Subsequent
old-client writes remain historical; explicit reconciliation is needed, not live
merge or fallback. Legacy calibration shared files and shards remain readable,
with covered imported files counted once by source identity and digest.
When explicitly recovering another external namespace, select its `state/` and
`calibration/` separately. Calibration source coverage can pass through completed,
verified import journals within the selected source namespace; previews bind that
provenance as well as file bytes. Coverage suppresses duplicate source reads, not
repeated observation lines. Pending or malformed provenance supplies no coverage;
original and later observations remain historical input under the same rules.

## Schema-version gate (route-sensitive)

Inspect active/archived external records through the shared `list`/`read`
commands in `target-resolution.md`, never a raw glob/host read that could expose
incomplete imported copies. Inspect explicit legacy candidates as historical input.
`tools/state-schema-gate.mjs` is the deterministic non-mutating harness. The
supported state schema maximum is **2**, separate from config schema version 6.
Missing state `schema_version` means 1; numeric values <=2 are not newer.
Config files use a separate golden config schema and currently stamp `schema_version: 6`; config schema version does not affect this state gate.
Historical incompatible state must not block fresh `/aivv` or `/aivv-fix` invocations that do not read it.

- Selected `--review-id` / `--resume` / `--resolve`, selected outer-loop state,
  and registry handlers fail closed on missing/corrupt/newer required records.
  Preserve `REVIEW_SCHEMA_NEWER`, `SCHEMA_NEWER_REQUIRED`, `REVIEW_CORRUPT`,
  and `STATE_CORRUPT_SELECTED` route diagnostics. Never edit/delete selected
  history to bypass the check; upgrade or run without selecting it.
- Unrelated newer/corrupt history emits `STATE_SCHEMA_NEWER_HISTORICAL` or
  `STATE_CORRUPT_HISTORICAL` and does not block an independent fresh review.
- A legacy selected object needed for mutation reports import-needed with exact
  source and external destination before remediation; browsing remains allowed.

## Stale-session reaper (7-day threshold)

On authorized stateful routes, inspect only external `fix-*.json` with
`status: "in-progress"`. Missing/invalid `invoked_at` emits
`reaper-skip-missing-invoked_at` / `reaper-skip-invalid-invoked_at`.
When older than seven days, write `status: "abandoned"`, `completed_at`, and a
`{"code":"reaped-stale","ts":"<now>"}` warning through the shared mutation
helper. Never reap a legacy original or an incomplete imported record.

## Archival (maintenance-route only)

Only explicit `/aivv --maintenance` may MOVE, never delete, external
`review-*.json` / `fix-*.json` with completed/abandoned status and
`completed_at` (fallback `invoked_at`) older than 90 days into
`<state_dir>/archive/`. Never touch younger logs, registry, index, quarantine,
or any legacy source. All readers union active/archive, including fix joins;
active duplicate filename wins with one deterministic warning.

## Scratch and warnings

Dispatch uses unique private invocation temp directories and cleans its own
scratch on ordinary success/error. No global orphan sweep or legacy `*.tmp-*`
deletion. Preserve unparseable external records as private diagnostic history;
never treat quarantine as eligible execution state.

Surface warnings before continuing: `[aivv-fix preamble] N warning(s):
<code> (×K), ...`, with affected paths (first five per code, then `(+M more)`).
Selected-state hard errors halt before source parsing. Other warnings remain in
the final summary. Maintenance writes use the shared storage mutation helper
and cannot overlap an import; its pending diagnostic is retryable.
