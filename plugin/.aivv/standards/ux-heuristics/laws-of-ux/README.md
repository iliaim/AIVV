# Laws of UX (HEU-LUX-*) — by psychological domain

28 operationalized rules from Jon Yablonski's *Laws of UX* (lawsofux.com), split into 6 by-domain subfiles. Source-class layer: **L2 cognitive-psychology** — empirically validated by HCI research and decades of usability testing. L2 findings default to MINOR or MAJOR depending on user impact; several are POLISH-tier value-add suggestions.

This sub-subdir is the dev.69 sub-split retrofit of the prior `laws-of-ux.md` (532 lines) — applies the Wave A subdir-pattern recursively to close the only Wave A >500-line outlier. Parent directory: [.aivv/standards/ux-heuristics/](../README.md).

> **Reviewers consulting this README:** open the relevant subfile for actual rule bodies. Rule-ID-to-subfile mapping is in the index table below.

## Rule index (28 rules)

| Subfile | Rules | Count |
|---|---|---|
| [timing-perception.md](timing-perception.md) | `HEU-LUX-doherty`, `HEU-LUX-fitts`, `HEU-LUX-parkinson` | 3 |
| [memory-cognition.md](memory-cognition.md) | `HEU-LUX-millers`, `HEU-LUX-working-memory`, `HEU-LUX-chunking`, `HEU-LUX-cognitive-load`, `HEU-LUX-peak-end`, `HEU-LUX-serial-position`, `HEU-LUX-zeigarnik` | 7 |
| [decision-choice.md](decision-choice.md) | `HEU-LUX-hicks`, `HEU-LUX-occams-razor`, `HEU-LUX-pareto`, `HEU-LUX-tesler` | 4 |
| [mental-models.md](mental-models.md) | `HEU-LUX-jakob`, `HEU-LUX-postel`, `HEU-LUX-mental-model`, `HEU-LUX-paradox-active-user` | 4 |
| [gestalt-grouping.md](gestalt-grouping.md) | `HEU-LUX-prox`, `HEU-LUX-similarity`, `HEU-LUX-common-region`, `HEU-LUX-uniform-connectedness`, `HEU-LUX-pragnanz`, `HEU-LUX-von-restorff` | 6 |
| [engagement-attention.md](engagement-attention.md) | `HEU-LUX-goal-gradient`, `HEU-LUX-flow`, `HEU-LUX-aesthetic-usability`, `HEU-LUX-selective-attention` | 4 |
| **Total** | | **28** |

**Quick rule-ID lookup** (alphabetic by ID): `HEU-LUX-aesthetic-usability` (engagement-attention), `HEU-LUX-chunking` (memory-cognition), `HEU-LUX-cognitive-load` (memory-cognition), `HEU-LUX-common-region` (gestalt-grouping), `HEU-LUX-doherty` (timing-perception), `HEU-LUX-fitts` (timing-perception), `HEU-LUX-flow` (engagement-attention), `HEU-LUX-goal-gradient` (engagement-attention), `HEU-LUX-hicks` (decision-choice), `HEU-LUX-jakob` (mental-models), `HEU-LUX-mental-model` (mental-models), `HEU-LUX-millers` (memory-cognition), `HEU-LUX-occams-razor` (decision-choice), `HEU-LUX-paradox-active-user` (mental-models), `HEU-LUX-pareto` (decision-choice), `HEU-LUX-parkinson` (timing-perception), `HEU-LUX-peak-end` (memory-cognition), `HEU-LUX-postel` (mental-models), `HEU-LUX-pragnanz` (gestalt-grouping), `HEU-LUX-prox` (gestalt-grouping), `HEU-LUX-selective-attention` (engagement-attention), `HEU-LUX-serial-position` (memory-cognition), `HEU-LUX-similarity` (gestalt-grouping), `HEU-LUX-tesler` (decision-choice), `HEU-LUX-uniform-connectedness` (gestalt-grouping), `HEU-LUX-von-restorff` (gestalt-grouping), `HEU-LUX-working-memory` (memory-cognition), `HEU-LUX-zeigarnik` (memory-cognition).

## Source-anchoring rule

`HEU-LUX-*` rules are restricted to entries on lawsofux.com's published index (Yablonski, 2020 + ongoing). Cognitive-bias rules sourced from primary HCI/psychology literature without a corresponding lawsofux.com entry are catalogued under `HEU-COG-*` instead — see [../cognitive-biases.md](../cognitive-biases.md). The separation keeps the `LUX` prefix's source-anchor unambiguous.

## Maintenance

When adding a new `HEU-LUX-*` rule:
1. **Verify it has a lawsofux.com page**; if not, route to `HEU-COG-*` per the source-anchoring rule above.
2. **Place in the appropriate by-domain subfile** (timing / memory / decision / mental-models / gestalt / engagement). Avoid creating new subfiles unless ≥3 rules cluster in a new domain.
3. **Add the rule-ID to the index table and quick-lookup line** in this README.
4. **Update parent count** in [../README.md](../README.md) `Rule index` table (`laws-of-ux.md` row count).
5. The maintainer validator recurses `ux-heuristics/` (which transitively recurses this directory), so no validate.sh edit is needed when adding rules in-place.
