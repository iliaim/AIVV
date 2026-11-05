# UX Heuristics — Operationalized Cognitive-Psychology Rules

Curated checklist of operationalized heuristics that an IV&V reviewer can apply by reading code alone — JSX/HTML markup, state machines, async handlers, navigation flows, copy strings. Each rule cites an authoritative cognitive-psychology, HCI, or design-systems source (Nielsen Norman Group, Ben Schneiderman's *Designing the User Interface*, Jon Yablonski's *Laws of UX*, Apple HIG, Material Design, NN/g empirical research).

The audience for this document is the AIVV reviewer agent applying the `ux` or `polish` lens (see [`.aivv/lenses/ux.md`](../../lenses/ux.md), [`.aivv/lenses/polish.md`](../../lenses/polish.md)). Rules carry severities (CRITICAL / MAJOR / MINOR / POLISH) consistent with the orchestrator's severity-inference 4-pass rule ([`.aivv/methodology.md`](../../methodology.md) Severity inference).

**Source-class layer**: these rules are predominantly **L2 cognitive-psychology** — empirically validated by HCI research and decades of usability testing. L2 findings default to MINOR or MAJOR depending on user impact; some are POLISH-tier value-add suggestions. None default to CRITICAL because L1 legal/safety overrides (WCAG, FTC, EU-DSA, ADA) are out of scope here — those live in `accessibility/` and forthcoming `compliance.md`.

**Scope**: code-observable patterns only. Heuristic violations that require runtime confirmation (actual response time, real focus-ring rendering, computed contrast under live theme) are out of scope; those route to `visual-verification-triggers/` and the runtime-visual lens (planned).

**Rule-count contract (maintainer-side):** the maintainer validator recurses this directory (`grep -rhcE '^### HEU-[A-Za-z0-9.-]+:' .aivv/standards/ux-heuristics/`) and asserts the count matches the documented total. When adding new heuristics, place each in the appropriate by-source subfile.

**Rule-ID conventions**:
- `HEU-NN1` … `HEU-NN10` — Nielsen's 10 usability heuristics (NN/g 1994, refined 2024) — see [nielsen.md](nielsen.md)
- `HEU-SCH1` … `HEU-SCH8` — Schneiderman's 8 Golden Rules (1987, 6th ed. 2016) — see [schneiderman.md](schneiderman.md)
- `HEU-LUX-<slug>` — Laws of UX (Yablonski, 2020 + lawsofux.com), restricted to entries on lawsofux.com's published index — see [laws-of-ux.md](laws-of-ux.md) (TOC stub) → [laws-of-ux/](laws-of-ux/) sub-subdir (6 by-domain files, dev.69 nested sub-split)
- `HEU-COG-<slug>` — Cognitive-bias rules sourced from primary HCI/psychology literature (not on lawsofux.com); separated from `HEU-LUX-` to keep the LUX prefix's source-anchor unambiguous — see [cognitive-biases.md](cognitive-biases.md)

## Rule index (51 rules)

| File | Range | Count |
|---|---|---|
| [nielsen.md](nielsen.md) | `HEU-NN1` … `HEU-NN10` | 10 |
| [schneiderman.md](schneiderman.md) | `HEU-SCH1` … `HEU-SCH8` | 8 |
| [laws-of-ux.md](laws-of-ux.md) (TOC stub) → [laws-of-ux/](laws-of-ux/) sub-subdir (6 by-domain files, dev.69) | `HEU-LUX-doherty` … `HEU-LUX-working-memory` | 28 |
| [cognitive-biases.md](cognitive-biases.md) | `HEU-COG-curiosity-gap` … `HEU-COG-novelty` | 5 |
| **Total** | | **51** |

**Quick rule-ID lookup** (alphabetic by ID; HEU-LUX-* entries annotated with their dev.69-nested sub-subfile): `HEU-LUX-aesthetic-usability` (laws-of-ux/engagement-attention), `HEU-LUX-chunking` (laws-of-ux/memory-cognition), `HEU-LUX-cognitive-load` (laws-of-ux/memory-cognition), `HEU-LUX-common-region` (laws-of-ux/gestalt-grouping), `HEU-COG-confirmation-bias` (cognitive-biases), `HEU-COG-curiosity-gap` (cognitive-biases), `HEU-COG-default-effect` (cognitive-biases), `HEU-LUX-doherty` (laws-of-ux/timing-perception), `HEU-COG-feedback-loop` (cognitive-biases), `HEU-LUX-fitts` (laws-of-ux/timing-perception), `HEU-LUX-flow` (laws-of-ux/engagement-attention), `HEU-LUX-goal-gradient` (laws-of-ux/engagement-attention), `HEU-LUX-hicks` (laws-of-ux/decision-choice), `HEU-LUX-jakob` (laws-of-ux/mental-models), `HEU-LUX-mental-model` (laws-of-ux/mental-models), `HEU-LUX-millers` (laws-of-ux/memory-cognition), `HEU-NN1` … `HEU-NN10` (nielsen), `HEU-COG-novelty` (cognitive-biases), `HEU-LUX-occams-razor` (laws-of-ux/decision-choice), `HEU-LUX-paradox-active-user` (laws-of-ux/mental-models), `HEU-LUX-pareto` (laws-of-ux/decision-choice), `HEU-LUX-parkinson` (laws-of-ux/timing-perception), `HEU-LUX-peak-end` (laws-of-ux/memory-cognition), `HEU-LUX-postel` (laws-of-ux/mental-models), `HEU-LUX-pragnanz` (laws-of-ux/gestalt-grouping), `HEU-LUX-prox` (laws-of-ux/gestalt-grouping), `HEU-LUX-selective-attention` (laws-of-ux/engagement-attention), `HEU-LUX-serial-position` (laws-of-ux/memory-cognition), `HEU-LUX-similarity` (laws-of-ux/gestalt-grouping), `HEU-LUX-tesler` (laws-of-ux/decision-choice), `HEU-LUX-uniform-connectedness` (laws-of-ux/gestalt-grouping), `HEU-LUX-von-restorff` (laws-of-ux/gestalt-grouping), `HEU-LUX-working-memory` (laws-of-ux/memory-cognition), `HEU-LUX-zeigarnik` (laws-of-ux/memory-cognition), `HEU-SCH1` … `HEU-SCH8` (schneiderman).

## Calibration

Findings emitted under HEU-* rules should populate `rule_id` in the calibration entry per [.aivv/calibration/README.md](../../calibration/README.md). The aggregator can then track per-heuristic FP rate and calibration evolution.

When a heuristic conflicts with an L1 source-class rule (WCAG, FTC, EU-DSA, ADA, Section 508, ARIA APG), the L1 rule wins per the methodology's source-precedence layers.

## Maintenance

These rules are curated content, not author-invented:

1. **Cite an authoritative source** — NN/g, Schneiderman's *Designing the User Interface*, Yablonski's *Laws of UX*, peer-reviewed HCI research. No "we think it's good practice" entries.
2. **Verify the rule is code-reviewable** — if verification requires runtime measurement (actual response time, real focus-ring rendering), put it in `visual-verification-triggers/`, not here.
3. **Follow the numbering convention** — `HEU-NN<n>`, `HEU-SCH<n>`, `HEU-LUX-<slug>`, `HEU-COG-<slug>`.
