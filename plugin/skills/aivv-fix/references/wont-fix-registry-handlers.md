# Wont-fix registry early-exit handlers

Read only when `--list-wont-fix` or `--forget-wont-fix=<identifier>` was extracted ([fix-flags.md](fix-flags.md)). Do not improvise the handler exit codes.

## Contents

- [`--list-wont-fix`](#--list-wont-fix-early-exit-handler)
- [`--forget-wont-fix=<identifier>`](#--forget-wont-fixidentifier-early-exit-handler)

## `--list-wont-fix` early-exit handler

**Early-exit on `--list-wont-fix`:** if the flag was set, invoke this handler before preference resolution and return (skipping Steps 1.1 through 7). Note: this handler fires AFTER Step 1.0's preamble. Because this route needs to read the registry, a newer/corrupt `wont-fix-registry.json` remains a selected-state hard failure (`SCHEMA_NEWER_REQUIRED` or `STATE_CORRUPT_SELECTED`). In that case, preserve the hard failure. For raw inspection, read through the shared storage helper into private scratch before running `jq` against that snapshot; a pending import still blocks the read. Never read the active file directly or use raw inspection to authorize a fix.

**Handler (orchestrator-mediated; no Python required):**

1. Read the registry through the locked storage reader into private scratch:
   ```bash
   node "$AIVV_ROOT/tools/storage-paths.mjs" read --context "$storage_context_file" \
     --area state --relative wont-fix-registry.json > "$registry_snapshot"
   ```
   On `STORAGE_NOT_FOUND`, output `No wont-fix registry found.` and exit 0.
   Pending-import/lock errors remain retryable failures; do not treat them as
   an empty registry. Raw inspection uses `jq '.entries[]' "$registry_snapshot"`
   only after that read succeeds, including when its schema is newer.
2. Parse the JSON in agent context. If `entries` array is missing or empty, output `Wont-fix registry is empty.` and exit 0.
3. Format and print a table:
   ```text
   FINGERPRINT   LOCATION                                  DECIDED               DESCRIPTION
   <fp[:10]>..   <location[:38] left-padded to 40>          <decided_at[:19]>     <description[:60]>
   ```
   One row per entry. Use `file_path` for legacy file-backed entries, or `location.type:location.kind:location.ref` for scoped entries. Truncate fields to the column widths shown.

<!-- CLAUDE-CODE-SPECIFIC -->
On both hosts use the shared locked storage reader for step 1; the agent generates the table from the private snapshot.

## `--forget-wont-fix=<identifier>` early-exit handler

<!-- CONCURRENCY-ACCEPTED-BY: runtime-contract.md "Cross-invocation shared files" -->
> **Concurrent-write note:** this handler rewrites `wont-fix-registry.json` whole (read → filter → write); a parallel accept/forget can be lost (accepted last-writer-wins, recoverable). See runtime-contract.md "Cross-invocation shared files".

**Early-exit on `--forget-wont-fix=<identifier>`:** if set, invoke this handler and return. When `dry_run` is true, run only the read-only preview steps below (the dry-run outputs replace the normal ones, and step 5's write is skipped); when `dry_run` is false, run the full handler:

**Handler (orchestrator-mediated; no Python required):**

1. Read the external registry through `storage-paths.mjs read --context "$storage_context_file" --area state --relative wont-fix-registry.json`. If absent, output `Dry-run: no wont-fix registry; nothing would be removed.` and exit 0 when `dry_run` is true; otherwise output `No wont-fix registry; nothing to forget.` and exit 1.
2. Resolve the identifier into a target fingerprint:
   - If `<identifier>` matches the regex `^[0-9a-f]{40}$` (40 hex chars; SHA-1 from `git hash-object` per dev.25+) OR `^[0-9a-f]{64}$` (64 hex chars; legacy SHA-256 from pre-dev.25), use it directly as `target_fp`.
   - If `<identifier>` contains `::`, split on the first `::` into `location_identifier` and `description`. Compute `target_fp` per the canonical fingerprint formula (see the "wont-fix registry pre-filter" section in [`finding-collection.md`](finding-collection.md) for the formula). The location identifier is either a file path or `<scope_ref.kind>:<scope_ref.ref>`.
   - Otherwise, output `Invalid identifier. Use either a hex fingerprint (40 or 64 chars) or 'location_identifier::description'.` and exit 2.
3. Preserve direct matching: raw entries whose stored `fingerprint` equals `target_fp` are selected even if malformed legacy fields prevent alias derivation. Resolve additional matching equivalence with `state-compat-index.mjs --registry-for-matching --context "$storage_context_file"`. Compare `target_fp` against each retained entry's `matching_fingerprints`; collect the corresponding original stored fingerprints. Filter the raw snapshot's `entries` by those stored fingerprints. Never persist the derived matching view or change approval fields; warnings from malformed legacy entries remain visible.
4. If the count is unchanged, output `Dry-run: no wont-fix entry matches <identifier>; nothing would be removed.` and exit 0 when `dry_run` is true; otherwise output `No wont-fix entry matches <identifier>.` and exit 1. If a match exists and `dry_run` is true, output `Dry-run: would forget <N> wont-fix entry(ies) with fingerprint <target_fp[:10]>...` and exit 0.
5. If `dry_run` is true, return without staging or writing anything. Otherwise stage the modified registry and publish it through the shared storage mutation helper under the target operation lock.
   ```bash
   node "$AIVV_ROOT/tools/storage-paths.mjs" write --context "$storage_context_file" \
     --area state --relative wont-fix-registry.json --source "$candidate"
   ```
6. Output `Forgot <N> wont-fix entry(ies) with fingerprint <target_fp[:10]>...` and exit 0.

<!-- CLAUDE-CODE-SPECIFIC -->
Use the shared storage `read` command for step 1 and `write` for step 5 on both hosts.
