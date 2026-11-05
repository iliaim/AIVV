# Dark Patterns — Code-reviewable Manipulative-UX Detection

Curated checklist of operationalized rules for detecting manipulative-UX patterns (dark patterns / deceptive patterns) from code alone — JSX/HTML markup, copy strings, CSS, form/modal/notification components, payment-flow code, consent UIs. Each rule cites an authoritative source (deceptive.design taxonomy, FTC enforcement guidance, EU DSA Article 25, NN/g research, GDPR provisions, Baymard, WCAG).

The audience for this document is the AIVV reviewer agent applying the `visual`, `ux`, or `polish` lens (see [`.aivv/lenses/visual.md`](../../lenses/visual.md), [`.aivv/lenses/ux.md`](../../lenses/ux.md), [`.aivv/lenses/polish.md`](../../lenses/polish.md)), with the `DP-LEGAL-*` subset firing across all lenses regardless of selection (L1 source-class forced-override per [`.aivv/methodology.md`](../../methodology.md)).

**Source-class layer**: dark-patterns rules span the source-class spectrum:
- **L1 legal/safety (forced-shown; context-gated legal floor)** — the `DP-LEGAL-*` subset (see [legal.md](legal.md)). Cites FTC enforcement, EU DSA Article 25, or GDPR articles directly. Forced-shown by the L1 detection regex in [`skills/aivv-fix/references/polish-and-l1-source-policy.md`](../../../skills/aivv-fix/references/polish-and-l1-source-policy.md) "L1-source detection logic" (canonical home; result rendering references this policy) regardless of `severity_threshold`.
- **L2 cognitive-psychology (MAJOR default)** — manipulation rules grounded in research on cognitive bias / behavior. Most `DP-CONSENT-*`, `DP-SOCIAL-*`, `DP-GAME-*` rules.
- **L3 platform conventions (MAJOR / MINOR)** — patterns deceptive.design or NN/g classify by category but where legal exposure is jurisdiction-specific. Most `DP-PRICE-*`, `DP-SUB-*`, `DP-URGENCY-*`, `DP-SCARCITY-*` rules.
- **L4 aesthetic / improvement (POLISH)** — none default to POLISH; manipulative patterns produce real user harm even when not legally enforceable. Rules with marginal manipulation framing (e.g., onboarding default-state selection) route to MINOR, not POLISH.

**Scope**: code-observable patterns only. Dark-pattern concerns that require runtime confirmation (actual measured time spent in cancel flow, real countdown-timer accuracy under network variance, real consent-banner accept-rate manipulation) are out of scope; those route to `visual-verification-triggers/` and the runtime-visual lens (planned).

**Rule-count contract (maintainer-side):** the maintainer validator recurses this directory (`grep -rhcE '^### DP-[A-Z0-9]+-[0-9]+:' .aivv/standards/dark-patterns/`) and asserts the count matches the documented total. When adding new rules, place each in the appropriate by-domain subfile.

**Rule-ID conventions**:
- `DP-PRICE-NN` — pricing manipulation (drip pricing, hidden fees, anchor manipulation) — see [pricing.md](pricing.md)
- `DP-SUB-NN` — subscription manipulation (auto-renew, hard-to-cancel, payment-method dark patterns) — see [subscription.md](subscription.md)
- `DP-CONSENT-NN` — consent + privacy manipulation (cookie banners, GDPR violations, asymmetric opt-in/opt-out) — see [consent-privacy.md](consent-privacy.md)
- `DP-URGENCY-NN` — urgency manipulation (countdown timers, fake deadlines) — see [urgency-scarcity.md](urgency-scarcity.md)
- `DP-SCARCITY-NN` — scarcity manipulation (fake "only X left", "viewing now" counters) — see [urgency-scarcity.md](urgency-scarcity.md)
- `DP-SOCIAL-NN` — social-proof manipulation (fake reviews, manipulated testimonials) — see [social-proof.md](social-proof.md)
- `DP-GAME-NN` — gamification / dark-engagement patterns — see [gamification.md](gamification.md)
- `DP-A11Y-NN` — accessibility-as-trap patterns (overlay widgets, false WCAG claims) — see [accessibility-trap.md](accessibility-trap.md)
- `DP-PR-NN` — dark-PR (greenwashing, AI-washing, false CSR claims in product copy) — see [pr-washing.md](pr-washing.md)
- `DP-LEGAL-NN` — legal-risk subset with FTC / EU-DSA / GDPR direct citations (forced-shown; context-gated legal floor) — see [legal.md](legal.md)

## Rule index (93 rules)

| File | Range | Count |
|---|---|---|
| [pricing.md](pricing.md) | `DP-PRICE-01` … `DP-PRICE-12` | 12 |
| [subscription.md](subscription.md) | `DP-SUB-01` … `DP-SUB-10` | 10 |
| [consent-privacy.md](consent-privacy.md) | `DP-CONSENT-01` … `DP-CONSENT-12` | 12 |
| [urgency-scarcity.md](urgency-scarcity.md) | `DP-URGENCY-01..08` + `DP-SCARCITY-01..06` | 14 |
| [social-proof.md](social-proof.md) | `DP-SOCIAL-01` … `DP-SOCIAL-08` | 8 |
| [gamification.md](gamification.md) | `DP-GAME-01` … `DP-GAME-10` | 10 |
| [accessibility-trap.md](accessibility-trap.md) | `DP-A11Y-01` … `DP-A11Y-06` | 6 |
| [pr-washing.md](pr-washing.md) | `DP-PR-01` … `DP-PR-08` | 8 |
| [legal.md](legal.md) | `DP-LEGAL-01` … `DP-LEGAL-13` | 13 |
| **Total** | | **93** |

## Out-of-static-review scope

The following dark-pattern concerns require **runtime confirmation** and are NOT in scope for code-only review:

- Actual countdown-timer accuracy under network variance
- Real concurrent-viewer / activity-feed data verification
- Live A/B-test arm assignment (whether the user is in a manipulation bucket)
- Measured cancellation-flow click depth vs signup click depth
- Real-time consent-banner accept-rate measurement
- Verified-buyer-badge ground truth against orders database
- Notification-timing analysis (timezone respect, quiet-hours enforcement)
- Inventory-lock semantics behind cart timers

These route to `visual-verification-triggers/` triggers and the runtime-visual lens (planned post-dev.62).

## Source reference map

| Source | URL | Coverage |
|---|---|---|
| deceptive.design | https://www.deceptive.design/ + /types + /cases | Harry Brignull's canonical taxonomy; cited across all DP-* sub-domains |
| FTC Business Guidance | https://www.ftc.gov/business-guidance/advertising-marketing | DP-PRICE-*, DP-SOCIAL-*, DP-PR-*, DP-LEGAL-* |
| FTC Negative Option Rule | https://www.ftc.gov/legal-library/browse/rules/negative-option-rule | DP-SUB-* + DP-LEGAL-01/02/04 |
| FTC Endorsement Guides | https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews | DP-SOCIAL-* + DP-LEGAL-10 |
| FTC Green Guides | https://www.ftc.gov/business-guidance/advertising-marketing/environmental-marketing | DP-PR-01, DP-LEGAL-11 |
| FTC Health Claims | https://www.ftc.gov/business-guidance/advertising-marketing/health-claims | DP-LEGAL-12 |
| EU DSA Article 25 | https://eur-lex.europa.eu/eli/reg/2022/2065/oj | DP-LEGAL-07; catch-all for EU-jurisdiction dark patterns |
| GDPR Article 7 | https://gdpr-info.eu/art-7-gdpr/ | DP-CONSENT-* + DP-LEGAL-05/09 |
| GDPR Cookies | https://gdpr.eu/cookies/ | DP-CONSENT-01/03/08 + DP-LEGAL-06 |
| NN/g | https://www.nngroup.com/articles/deceptive-patterns/ + /social-proof-ux/ | DP-SUB-03, DP-GAME-*, DP-URGENCY-* |
| Baymard | https://www.baymard.com/blog | DP-PRICE-12, DP-SUB-10 |
| Overlay Fact Sheet | https://overlayfactsheet.com/ | DP-A11Y-01, DP-A11Y-05 |
| WCAG | https://www.w3.org/WAI/standards-guidelines/wcag/ | DP-A11Y-02/04/06 cross-references |

**Citation-grounding policy** (post-dev.46/54 discipline): every URL in this directory resolved to HTTP 200 at authoring time (dev.56 + dev.68 retrofit verification). Internal cross-references to other AIVV catalogs (`defer-to A11Y-NNN`, `defer-to UX-NNN`, `defer-to MC-NNN`, `defer-to DP-LEGAL-NN`) were verified by greping the target file at authoring time. Severity claims about cross-referenced rules were verified against the target rule's actual severity in its catalog. Future cycles refine URLs and cross-references as catalogs evolve.
