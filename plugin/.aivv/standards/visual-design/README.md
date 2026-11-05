# Visual Design — Code-reviewable Aesthetic Baselines

Curated checklist of operationalized visual-design rules an IV&V reviewer can apply by reading code alone — JSX/HTML markup, CSS/SCSS/Tailwind classes, design-token references, transition / animation declarations, layout primitives. Each rule cites an authoritative design-systems source (Refactoring UI, Material Design 3, Apple HIG, GOV.UK Design System, web.dev, MDN).

The audience for this document is the AIVV reviewer agent applying the `visual` or `polish` lens (see [`.aivv/lenses/visual.md`](../../lenses/visual.md), [`.aivv/lenses/polish.md`](../../lenses/polish.md)). Rules carry severities (CRITICAL / MAJOR / MINOR / POLISH) consistent with the orchestrator's severity-inference 4-pass rule ([`.aivv/methodology.md`](../../methodology.md) Severity inference).

**Source-class layer**: these rules are predominantly **L4 aesthetic / improvement** — design-systems guidance and visual-hygiene patterns that distinguish polished surfaces from "works but feels off." L4 findings default to **POLISH** severity (orthogonal to the defect axis — they describe improvement opportunities rather than broken behavior). A subset surfaces at **MINOR** when the violation produces a user-visible defect (e.g., FOIT > 3s, layout shift on font load, hardcoded color that breaks in dark mode). None default to MAJOR / CRITICAL because legal/safety overrides (WCAG, ADA, FTC) live in `accessibility/` and forthcoming `compliance.md` — VD-* rules defer-to those when the compliance variant exists.

**Scope**: code-observable patterns only. Visual concerns that require rendered-output measurement (actual computed contrast under live theme, measured motion timing, pixel-diff regression, real font-load timing) route to `visual-verification-triggers/` triggers and the runtime-visual lens (planned). VD-* rules flag the *pattern* in source; the runtime layer measures the *outcome*.

**Rule-count contract (maintainer-side):** the maintainer validator recurses this directory (`grep -rhcE '^### VD-[A-Z]+-[0-9]+:' .aivv/standards/visual-design/`) and asserts the count matches the documented total. When adding new rules, place each in the appropriate by-domain subfile.

**Rule-ID conventions**:
- `VD-TYPE-NN` — typography (font scale, line-height, weight, family, loading, wrap, line length) — see [typography.md](typography.md)
- `VD-SPACE-NN` — spacing, rhythm, touch targets, grid — see [spacing.md](spacing.md)
- `VD-COLOR-NN` — color tokens, semantic naming, opacity-as-signal, contrast tokens, gradients, modern syntax — see [color.md](color.md)
- `VD-ICON-NN` — iconography consistency, accessible icon-only buttons, filled-vs-outline, sizing — see [iconography.md](iconography.md)
- `VD-MOTION-NN` — durations, easing, reduced-motion, GPU-only props, animation hygiene — see [motion.md](motion.md)
- `VD-LAYOUT-NN` — container queries, intrinsic sizing, aspect-ratio, gap, mobile-first, logical properties — see [layout.md](layout.md)

## Rule index (73 rules)

| File | Range | Count |
|---|---|---|
| [typography.md](typography.md) | `VD-TYPE-01` … `VD-TYPE-12` | 12 |
| [spacing.md](spacing.md) | `VD-SPACE-01` … `VD-SPACE-10` | 10 |
| [color.md](color.md) | `VD-COLOR-01` … `VD-COLOR-14` | 14 |
| [iconography.md](iconography.md) | `VD-ICON-01` … `VD-ICON-08` | 8 |
| [motion.md](motion.md) | `VD-MOTION-01` … `VD-MOTION-12` | 12 |
| [layout.md](layout.md) | `VD-LAYOUT-01` … `VD-LAYOUT-17` | 17 |
| **Total** | | **73** |

## Out-of-static-review scope

The following visual-design concerns require **runtime confirmation** and are NOT in scope for code-only review:

- Actual computed contrast under live theme (system dark-mode + custom theme override + dynamic color)
- Real font-load timing (FOIT / FOUT duration measured at first-paint)
- Pixel-diff regression detection across deploys
- Layout shift under real network / device-pixel-ratio combinations
- Actual measured motion timing under throttled-CPU conditions
- Live carousel pause-behavior across input modalities

These route to `visual-verification-triggers/` triggers and the runtime-visual lens.

## Source reference map

| Source | URL | Coverage in this directory |
|---|---|---|
| Refactoring UI | https://www.refactoringui.com/ | Typography, spacing, color, motion (Wathan/Schoger book) |
| Material Design 3 | https://m3.material.io/ | Typography scale, color tokens, motion easing, layout, elevation |
| Apple HIG | https://developer.apple.com/design/human-interface-guidelines/ | Typography, color, motion, layout, SF Symbols |
| GOV.UK Design System | https://design-system.service.gov.uk/ | Typography, spacing, colour (UK Gov accessibility baselines) |
| web.dev | https://web.dev/ | CSS modern features (Learn courses), performance-conscious motion, responsive |
| MDN | https://developer.mozilla.org/ | CSS reference (Logical Properties, aspect-ratio, gap, color, font-display, etc.) |
| Material Symbols | https://fonts.google.com/icons | Icon family guidance |
| W3C TR | https://www.w3.org/TR/css-color-4/ | CSS Color Module Level 4 (modern color syntax — color-mix, lab, oklch) |
| WebKit blog | https://webkit.org/blog/7929/designing-websites-for-iphone-x/ | Safe-area-inset / notched-device viewport (canonical introduction) |
| Smashing Magazine | https://www.smashingmagazine.com/2015/01/designing-for-print-with-css/ | Print-stylesheet conventions |

**Citation-grounding policy** (post-dev.46): every URL in this directory resolved to HTTP 200 at authoring time (dev.54 + dev.67 retrofit verification). When citing in findings, prefer the most-specific landing page; if a future deep-link 404s due to source-system reorganization, swap to the source-system root + topic-prose and surface the swap in a future cycle's citation-grounding pass.
