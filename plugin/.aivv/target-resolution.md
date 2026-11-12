# Target Project and Storage Resolution

> **Shared contract:** referenced by `/aivv` and `/aivv-fix`. Resolve the installed runtime through [runtime-root.md](runtime-root.md); never execute a consuming project's `tools/` directory.

## Resolve once before state access

Resolve and cache the context before maintenance, finding collection, or dispatch.
`target_project` remains the absolute base for stored relative file references;
it is not a directory in which runtime files are written. Use the shipped helper:

```bash
node "$AIVV_ROOT/tools/storage-paths.mjs" resolve --target "<bound-target>" > "$storage_context_file"
```

The read-only JSON result supplies `target`, `instance_key`, `state_dir`,
`calibration_dir`, and `reports_dir`. In these instructions `<state_dir>`,
`<calibration_dir>`, and `<reports_dir>` always mean those resolved paths.
Allocate `storage_context_file` inside private invocation scratch and preserve
its exact JSON across child operations. On hosts with unreliable instance signals
it carries the invocation nonce; rerunning `resolve --target` per child would
split the store. The helper validates cached context against current target
observations and platform roots; caller-supplied roots are not trusted.
Resolution never initializes a store. Cache this result and `target_project` for
the invocation; do not re-resolve after a shell cwd change.

Storage target precedence is explicit `--target` > validated selected review's
target > an existing supported `default_target` binding > Git toplevel of the
invocation cwd > canonical cwd with a warning. Reject conflicts between explicit
and validated selected targets. Stale configured targets warn and fall back.
Finding locations never choose the fresh storage default. Explicit subtargets,
clones, and linked worktrees have separate stores; symlink aliases share one.

## Keep policy lookup and file referents

Policy lookup remains distinct: a user-explicit target wins; otherwise use validated
selected-state policy provenance when present, then the existing finding-path
common ancestor, Git root, or cwd lookup. Resolve CLI > project > user > schema
defaults once. Do not reload another project's config after `default_target`
binds storage or chase another default. Historical records without policy
provenance cannot invent it or restore serialized auto-apply approvals.

For finding-path policy lookup, use only file-backed findings; a single file
uses its parent, multiple files their common ancestor, rejecting `/`, home, and
degenerate ancestors. This policy lookup does not change `state_target`.
Before persistence normalize file paths against the bound `target_project`,
retaining the original absolute referent. A finding originally relative to a
nested cwd must not become a different repository-root file on handoff.
Store differing policy provenance additively in storage metadata and re-read
current policy there on continuation. An automatic peer-skill handoff carries
its already-bound context; its propagated target is routing information, not a
new user policy override. Keep that provenance through the in-memory/saved
handoff. A new user-supplied `--target` still binds both policy and storage.
Review scope and remediation gates do not
change.

## Ownership and compatibility

The helper assigns an external per-user target-instance store using canonical
paths and filesystem-instance signatures. Reliable macOS identities use version 2:
backing-volume UUID, inode and trustworthy creation time for both target and Git
administration directory. A changed device number alone does not select another
v2 namespace. Native UUID discovery failure yields an uncertain invocation-bound
identity; preserve its exact context across children. Linux/Windows retain v1.
Explicit v1 contexts still require their original device/inode/creation-time checks;
they are never silently upgraded or rebound. A checkout recreated at the same path
must not automatically inherit old decisions. If identity cannot be reliably
established, history stays browsable and fresh reviews remain available; explicit
attachment/import is required before old mutable decisions activate. Moved
checkouts and changed home/XDG roots likewise require explicit historical import.
There is no writable project-storage mode or silent repo/temp fallback.

Legacy `<target>/.aivv/{state,calibration}` and `.claude/sessions` are read-only
history. Discover only selected target and cwd-to-target ancestor locations, or
an explicit historical source; do not crawl source trees or unrelated projects.
Never rename, reap, quarantine, backfill, or write migration markers there.
Continuation needing old state reports import-needed with exact paths; see
[state-maintenance.md](state-maintenance.md). All normal writes go to the single
external store, never refill absent/empty mutable state from a legacy snapshot.

## Executable read boundary

Use the installed helper for active-state discovery and reads so pending import
copies never become executable state:

```bash
node "$AIVV_ROOT/tools/storage-paths.mjs" list --context "$storage_context_file" \
  --area state --prefix review- --archive
node "$AIVV_ROOT/tools/storage-paths.mjs" read --context "$storage_context_file" \
  --area state --relative "review-$review_id.json"
```

`list` emits JSON relative paths; `--archive` includes archive descendants.
An empty result is still `[]`, with a `STORAGE_EMPTY` notice on stderr naming the
target and the directory searched. Storage is keyed per checkout: records written
from another worktree or clone are not in this store, so an empty list is not
evidence that they were lost.
Use the returned relative path for `read` (including `archive/` when selected).
Discovery is not proof a later read is still valid: re-read each selected object
through `read`, which holds the shared target operation lock and rejects pending
imports. The same API with `--area calibration` reads shards. A missing namespace
lists as `[]`; missing selected files report `STORAGE_NOT_FOUND` and retain the
calling route's missing-state diagnostic. Neither operation initializes a store.
Host-native reads may inspect explicit legacy files as historical input, but
never activate legacy decisions without import.

## Executable mutation boundary

For active state, stage the complete validated candidate in a private invocation
scratch directory. Publish it with the installed helper (arguments are literal
argv; never interpolate finding text into shell code):

```bash
node "$AIVV_ROOT/tools/storage-paths.mjs" write --context "$storage_context_file" \
  --area state --relative "review-$invocation_id.json" --source "$candidate"
node "$AIVV_ROOT/tools/storage-paths.mjs" write --context "$storage_context_file" \
  --area calibration --relative "$lens/$invocation_id.jsonl" --source "$record" --append
```

`write` validates containment, initializes private external directories only for
this authorized mutation, holds the target operation lock, and publishes the
candidate. For JSONL `--append`, the source contains only the new complete lines;
for a staged full shard omit `--append`. Reuse it for fix logs, registry,
decisions, lifecycle, and derived index candidates with their corresponding
relative path. Existing schema/pre-write validation remains mandatory.

Moves/removal (explicit archival, successful outer-loop cleanup) run as one
child operation under `storage-paths.mjs lock --context "$storage_context_file" --
<executable> <argv...>`. Validate the resolved source/destination remain in the
cached external store, and perform the filesystem action inside that child,
not as a later host tool call after lock release. Never place repository source
edits under this storage lock. An import-pending/lock diagnostic is retryable;
never bypass it with direct host writes. A dead owner can be recovered with
`storage-paths.mjs recover-lock --context "$storage_context_file"`; it preserves the
abandoned lock and refuses a live/ambiguous owner.

## Pre-write banner

Before the first authorized write (or the dry-run report), emit:

```text
[aivv-fix] target project: <absolute path> (source: explicit | selected review | configured | git-toplevel(cwd) | cwd fallback)
[aivv-fix] policy target:  <policy lookup path, when different>
[aivv-fix] session log:    <state_dir>/fix-<id>.json
[aivv-fix] wont-fix:       <state_dir>/wont-fix-registry.json
[aivv-fix] calibration:    <calibration_dir>/<lens>/<invocation-id>.jsonl
```

Inferred targets include `override: --target=<dir> (if target is wrong)`.
Cwd fallback includes a warning. `AIVV_QUIET=1` suppresses this audit banner.
`/aivv-fix --dry-run` never initializes/imports state, reaps files, writes notice
markers, or runs calibration/verifier hooks; `/aivv --dry-run` still records its
review and calibration externally.
