# Dark Patterns — Code-reviewable Manipulative-UX Detection

**This file is a TOC stub.** Rule content lives in the [`dark-patterns/`](dark-patterns/) subdirectory (dev.68 subdir-pattern retrofit per Wave A discipline — closes the dev.56-era DEFERRED-RETIRE-WHEN sigil that motivated the retrofit; **completes Wave A**). The 93 code-reviewable rules are split across 9 by-domain files. The `DP-LEGAL-*` subset lives in `legal.md`, is forced-shown regardless of `severity_threshold` per L1 source-class precedence, and uses the context-gated hard-legal-floor policy when Project Context declares applicability.

> **Reviewers consulting this file:** open the relevant subfile(s) below for actual rule content. This stub contains no rule bodies — only the rule-ID-to-subfile mapping.

## Rule index

| File | Range | Count |
|---|---|---|
| [dark-patterns/pricing.md](dark-patterns/pricing.md) | `DP-PRICE-01` … `DP-PRICE-12` | 12 |
| [dark-patterns/subscription.md](dark-patterns/subscription.md) | `DP-SUB-01` … `DP-SUB-10` | 10 |
| [dark-patterns/consent-privacy.md](dark-patterns/consent-privacy.md) | `DP-CONSENT-01` … `DP-CONSENT-12` | 12 |
| [dark-patterns/urgency-scarcity.md](dark-patterns/urgency-scarcity.md) | `DP-URGENCY-01..08` + `DP-SCARCITY-01..06` | 14 |
| [dark-patterns/social-proof.md](dark-patterns/social-proof.md) | `DP-SOCIAL-01` … `DP-SOCIAL-08` | 8 |
| [dark-patterns/gamification.md](dark-patterns/gamification.md) | `DP-GAME-01` … `DP-GAME-10` | 10 |
| [dark-patterns/accessibility-trap.md](dark-patterns/accessibility-trap.md) | `DP-A11Y-01` … `DP-A11Y-06` | 6 |
| [dark-patterns/pr-washing.md](dark-patterns/pr-washing.md) | `DP-PR-01` … `DP-PR-08` | 8 |
| [dark-patterns/legal.md](dark-patterns/legal.md) | `DP-LEGAL-01` … `DP-LEGAL-13` (L1, forced-shown; context-gated legal floor) | 13 |
| **Total** | | **93** |

See [`dark-patterns/README.md`](dark-patterns/README.md) for the full source-class layer (L1-L3 spectrum), out-of-static-review scope, source reference map, and citation-grounding policy.

## Maintenance

When adding new DP-* rules, place each in the appropriate by-domain subfile; the maintainer validator recurses [`dark-patterns/`](dark-patterns/) to enforce the count contract.
