# Thoroughness Dial

The `thoroughness` dial is a runtime default-overlay for one review. It supplies
values only for unpinned lever cells and never writes config. Resolve tier by
precedence: CLI `--thoroughness=<tier>` > repo `thoroughness` key > user
`thoroughness` key > default `balanced`.

Tiers: `fast`, `balanced`, `thorough`, `exhaustive`. `exhaustive` is runtime-only
and not offered by setup wizard.

## Overlay Table

Only these levers are affected; never wizard-only/non-lever cells
(`auto_chain_fix`, `apply_polish_mode`, `polish_collapsed`,
`post_review_html_*`).

| Lever cell | `fast` | `balanced` | `thorough` | `exhaustive` |
|---|---|---|---|---|
| `default_reviewers` | 1 | identity | 2 | 2, or 3 on escalation |
| `severity_threshold` | MAJOR | identity | MINOR | MINOR |
| `default_lens_replicate` | 1 | identity | 2 | 3 |
| `outer_loop_mode` (fix-path only) | off | identity | until_clean | until_clean |
| `outer_loop_max_cycles` (fix-path only) | none | identity | 3 | 3 |

`balanced` is the identity overlay: it supplies no value, so schema defaults and
pins stand unchanged. Effort is non-strictly monotonic
(`fast` <= `balanced` <= `thorough` <= `exhaustive`); some cells intentionally
match schema defaults. The dial never sets `default_reviewers` below 1 and never
sets `severity_threshold=CRITICAL`. Outer-loop levers engage only for `--fix` or
auto-chain.

## Exhaustive

`exhaustive` raises coverage, replication, and traceability:
- Reviewer count is 2 by default; escalates to 3 only for architectural-scope
  changes or reviews spanning more lenses than the resolved default lens count. Pins
  still win. Under `--full-*`, reviewer count is `N=KxM`, so this escalation is
  a no-op.
- Reviewer input order is randomized across replicas.
- Result floor is MINOR, but the Improvement-articulation DROP rule still
  applies; it surfaces more grounded findings, not unjustified noise.
- Fix path can run up to 3 outer-loop cycles with convergence early-stop.
- Each load-bearing finding (MAJOR+ or merge-gating) appends:
  `grounded_by: { source: <read|grep|trace|webfetch|spec>, ref: <file:line | grep-pattern | url>, confidence: <high|med> }`.
  POLISH/MINOR are exempt. This records reviewer grounding, not independent
  execution by Tier-3 scope reviewers.

## Pin-Wins

1. Resolve one winning tier.
2. Expand that tier to the overlay table.
3. A pinned lever key at ANY scope always beats a dial-derived default:
   `default_reviewers`, `severity_threshold`, `default_lens_replicate`, or
   `outer_loop_*` from any config or CLI flag (`--reviewers`,
   `--lens-replicate`, etc.) is not overridden.
4. The dial writes nothing to config.

Examples: no flag -> `balanced` identity; user-pinned `default_reviewers=2` plus
`--thoroughness=fast` keeps 2 reviewers; `--reviewers=1 --thoroughness=thorough`
keeps one reviewer while unpinned severity/replicate overlays may apply;
`--thoroughness=exhaustive` on architectural-scope can escalate to 3 unless
`--reviewers=2` pins it.
