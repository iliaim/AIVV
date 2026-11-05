# UX Heuristics — Laws of UX (HEU-LUX-*)

**This file is a TOC stub.** Rule content lives in the [`laws-of-ux/`](laws-of-ux/) sub-subdirectory (dev.69 nested sub-split retrofit — closes the Wave A >500-line outlier by recursively applying the Wave A subdir pattern). The 28 rules from Jon Yablonski's *Laws of UX* (lawsofux.com) are split across 6 by-domain files.

> **Reviewers consulting this file:** open the relevant subfile(s) below for actual rule content. This stub contains no rule bodies — only the rule-ID-to-subfile mapping.

## Rule index

| File | Rules | Count |
|---|---|---|
| [laws-of-ux/timing-perception.md](laws-of-ux/timing-perception.md) | `HEU-LUX-doherty`, `HEU-LUX-fitts`, `HEU-LUX-parkinson` | 3 |
| [laws-of-ux/memory-cognition.md](laws-of-ux/memory-cognition.md) | `HEU-LUX-millers`, `HEU-LUX-working-memory`, `HEU-LUX-chunking`, `HEU-LUX-cognitive-load`, `HEU-LUX-peak-end`, `HEU-LUX-serial-position`, `HEU-LUX-zeigarnik` | 7 |
| [laws-of-ux/decision-choice.md](laws-of-ux/decision-choice.md) | `HEU-LUX-hicks`, `HEU-LUX-occams-razor`, `HEU-LUX-pareto`, `HEU-LUX-tesler` | 4 |
| [laws-of-ux/mental-models.md](laws-of-ux/mental-models.md) | `HEU-LUX-jakob`, `HEU-LUX-postel`, `HEU-LUX-mental-model`, `HEU-LUX-paradox-active-user` | 4 |
| [laws-of-ux/gestalt-grouping.md](laws-of-ux/gestalt-grouping.md) | `HEU-LUX-prox`, `HEU-LUX-similarity`, `HEU-LUX-common-region`, `HEU-LUX-uniform-connectedness`, `HEU-LUX-pragnanz`, `HEU-LUX-von-restorff` | 6 |
| [laws-of-ux/engagement-attention.md](laws-of-ux/engagement-attention.md) | `HEU-LUX-goal-gradient`, `HEU-LUX-flow`, `HEU-LUX-aesthetic-usability`, `HEU-LUX-selective-attention` | 4 |
| **Total** | | **28** |

See [`laws-of-ux/README.md`](laws-of-ux/README.md) for the alphabetic quick-lookup index, source-anchoring rule (`HEU-LUX-*` restricted to lawsofux.com entries), and maintenance guidance.

## Maintenance

When adding new `HEU-LUX-*` rules, place each in the appropriate by-domain sub-subfile (timing / memory / decision / mental-models / gestalt / engagement). The maintainer validator recurses [`../ux-heuristics/`](.) (which transitively recurses [`laws-of-ux/`](laws-of-ux/)) to enforce the count contract.
