# Lens Composition Rule (Step 1.4)

Derive `reviewer_lens_assignments` from `--reviewers=N`, `lenses_list`
(`K = len(lenses_list)`), and `lens_replicate_M` (`M`, default 1).

## Matrix

| Shape | Rule |
|---|---|
| `K=1`, `M=1` | all N reviewers use `lenses_list[0]` |
| `K>=2`, `M=1`, `N==K` | reviewer `i` gets `lenses_list[i]` |
| `M>=2`, `N==K*M` | KxM block replication; reviewer `i` gets `lenses_list[i // M]` |
| `K>=2`, `M=1`, `N!=K` | reject |
| `M>=2`, `N!=K*M` | reject |

Error text:

```text
--lens=<list> has K lenses but --reviewers=N. Use 1 lens (homogeneous), exactly K lenses (1:1), or --lens-replicate=M with N==K×M.
--lens-replicate=M with K lenses requires --reviewers=N where N==K×M; got K=<K> M=<M> N=<N> (expected N=<K*M>).
```

`--lens-replicate` is explicit by design; do not auto-distribute surplus
reviewers across lenses.

## Spike Banner

When `K>=2` or `M>=2`, emit before dispatch:

```text
ℹ Tier 2B multi-lens spike active (lenses=<lens1>,<lens2>,..., M=<M>). Per the Tier 2B framing, this dispatch is evidence-gathering - outputs feed a future ADR decision. Treat findings as experimental until the spike concludes.
```

No confirmation prompt; the flags are explicit consent.

## Maintenance Early Exit

If `--maintenance` is set, run the periodic preamble and return. Do not run
session extraction, reviewer dispatch, review-log write, or calibration.

Maintenance actions:
- Run standard state preamble.
- Through the shared target-lock mutation boundary, preserve unparsable external `review-*.json`, `fix-*.json`, `index.json`, and
  `wont-fix-registry.json` under `<state_dir>/quarantine/`.
- Warn `quarantine-overflow` when quarantine count exceeds 20.
- Rebuild `<state_dir>/index.json` from parseable review/fix logs with
  `schema_version: 2`, `rebuilt_at`, and metadata entries.

Surface summaries: `index-rebuilt`, `periodic-quarantine`,
`quarantine-overflow` and `reaped-stale`. Legacy originals are never modified.
Publish index candidates with `storage-paths.mjs write --context "$storage_context_file" --area
state --relative index.json --source "<candidate>"`; move external quarantined
records only inside the shared `lock -- <executable> <argv...>` operation.

## Positional Precedence

Quoted text wins over file path when ambiguous. Explicit `--reviewers=N` wins
over bare integer shorthand.

Examples:
- `/aivv src/foo.ts 4` -> file positional, 4 reviewers.
- `/aivv "should we use Redis" 3` -> idea positional, 3 reviewers.
- `/aivv 3 src/foo.ts` -> reviewers 3, file positional.
- `/aivv src/foo.ts 4 5` -> reviewers 4; trailing 5 warned and ignored.

## Full-* Shortcuts

Full-* wrappers remain fixed specialist audits; their ordered lens sets and
reviewer counts do not change when the default lens is `general`. They never
implicitly add `general`.

| Flag | K | Default M/N | Lenses |
|---|---:|---:|---|
| `--full-visual` | 2 | M=3 / N=6 | visual + polish |
| `--full-ui-ux` | 6 | M=2 / N=12 | visual + ux + polish + compliance + i18n + user-journey |
| `--full-a11y` | 2 | M=2 / N=4 | visual + compliance |
| `--full` | 7 | M=2 / N=14 | code + sec + visual + ux + polish + compliance + i18n (all seven specialist lenses) |
| `--full-with-journey` | 8 | M=2 / N=16 | code + sec + visual + ux + polish + compliance + i18n + user-journey (all eight specialist lenses) |

`--lens-replicate=<M>` overrides wrapper default M. N above 14 exceeds the
single-trial dev.70 probe ceiling and should warn as host-cap risk.
