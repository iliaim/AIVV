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
