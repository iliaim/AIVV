# Laws of UX (HEU-LUX-*) — by psychological domain

Operationalized rules from Jon Yablonski's *Laws of UX* (lawsofux.com), split into by-domain subfiles. Source-class layer: **L2 cognitive-psychology** — empirically validated by HCI research and decades of usability testing. L2 findings default to MINOR or MAJOR depending on user impact; several are POLISH-tier value-add suggestions.

Parent directory: [.aivv/standards/ux-heuristics/](../README.md).

> **Reviewers consulting this README:** open the relevant subfile for actual rule bodies. Rule-ID-to-subfile mapping is in the index table below.

## Rule index

| Subfile | Rules |
|---|---|
| [timing-perception.md](timing-perception.md) | `HEU-LUX-doherty`, `HEU-LUX-fitts`, `HEU-LUX-parkinson` |
| [memory-cognition.md](memory-cognition.md) | `HEU-LUX-millers`, `HEU-LUX-working-memory`, `HEU-LUX-chunking`, `HEU-LUX-cognitive-load`, `HEU-LUX-peak-end`, `HEU-LUX-serial-position`, `HEU-LUX-zeigarnik` |
| [decision-choice.md](decision-choice.md) | `HEU-LUX-hicks`, `HEU-LUX-occams-razor`, `HEU-LUX-pareto`, `HEU-LUX-tesler` |
| [mental-models.md](mental-models.md) | `HEU-LUX-jakob`, `HEU-LUX-postel`, `HEU-LUX-mental-model`, `HEU-LUX-paradox-active-user` |
| [gestalt-grouping.md](gestalt-grouping.md) | `HEU-LUX-prox`, `HEU-LUX-similarity`, `HEU-LUX-common-region`, `HEU-LUX-uniform-connectedness`, `HEU-LUX-pragnanz`, `HEU-LUX-von-restorff` |
| [engagement-attention.md](engagement-attention.md) | `HEU-LUX-goal-gradient`, `HEU-LUX-flow`, `HEU-LUX-aesthetic-usability`, `HEU-LUX-selective-attention` |

## Source-anchoring rule

`HEU-LUX-*` rules are restricted to entries on lawsofux.com's published index (Yablonski, 2020 + ongoing). Cognitive-bias rules sourced from primary HCI/psychology literature without a corresponding lawsofux.com entry are catalogued under `HEU-COG-*` instead — see [../cognitive-biases.md](../cognitive-biases.md). The separation keeps the `LUX` prefix's source-anchor unambiguous.

## Maintenance

When adding a new `HEU-LUX-*` rule:
1. **Verify it has a lawsofux.com page**; if not, route to `HEU-COG-*` per the source-anchoring rule above.
2. **Place in the appropriate by-domain subfile** (timing / memory / decision / mental-models / gestalt / engagement). Avoid creating new subfiles unless ≥3 rules cluster in a new domain.
3. **Add the rule-ID to the index table** in this README.
