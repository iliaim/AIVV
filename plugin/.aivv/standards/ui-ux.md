# UI/UX Standards — Code-Reviewable Patterns

**This file is a TOC stub.** Rule content lives in the [`ui-ux/`](ui-ux/) subdirectory (dev.62 subdir-pattern retrofit per master spec T19; content-extended dev.81 — T22 phase 1 = 29 → 36 rules, Baymard-checkout-research-anchored; content-extended dev.82 — T22 phase 2 = 36 → 41 rules, ARIA-APG-Grid + W3C-Table-pattern + GOV.UK-pagination anchored; content-extended dev.83 — T22 phase 3 = 41 → 46 rules, MDN-`<search>` + WCAG-4.1.3-Status-Messages + ARIA-APG-checkbox-mixed + W3C-WAI-forms-grouping anchored). The 46 code-reviewable rules `UX-001..046` are split across 11 by-domain files.

> **Reviewers consulting this file:** open the relevant subfile(s) below for actual rule content. This stub contains no rule bodies — only the rule-ID-to-subfile mapping.

## Rule index

| File | Rules | Section |
|---|---|---|
| [ui-ux/forms.md](ui-ux/forms.md) | UX-001..007 | Form UX |
| [ui-ux/state-handling.md](ui-ux/state-handling.md) | UX-008..011 | State handling |
| [ui-ux/feedback-confirmation.md](ui-ux/feedback-confirmation.md) | UX-012..014 | Feedback & confirmation |
| [ui-ux/navigation.md](ui-ux/navigation.md) | UX-015..017 | Navigation |
| [ui-ux/responsive-touch.md](ui-ux/responsive-touch.md) | UX-018..019 | Responsive & touch |
| [ui-ux/ux-microcopy.md](ui-ux/ux-microcopy.md) | UX-020..021 | UX-lens microcopy |
| [ui-ux/data-performance.md](ui-ux/data-performance.md) | UX-022..026 | Data UX & performance-UX |
| [ui-ux/progressive-enhancement.md](ui-ux/progressive-enhancement.md) | UX-027..029 | Progressive enhancement |
| [ui-ux/checkout-payment.md](ui-ux/checkout-payment.md) | UX-030..036 | Checkout & payment (dev.81 = T22 phase 1; Baymard + web.dev + NN/g anchored; UX-036 deleted in dev.81 IV&V corrective, UX-037 renumbered → UX-036) |
| [ui-ux/tables-pagination.md](ui-ux/tables-pagination.md) | UX-037..041 | Data tables & pagination (dev.82 = T22 phase 2; ARIA APG Grid + W3C Table + MDN aria-sort + GOV.UK pagination anchored) |
| [ui-ux/search-filter-status.md](ui-ux/search-filter-status.md) | UX-042..046 | Search inputs, filter grouping & status messages (dev.83 = T22 phase 3; MDN `<search>` + WCAG 4.1.3 Status Messages + ARIA APG checkbox-mixed + MDN `<fieldset>`/`<legend>` + W3C WAI forms-grouping anchored) |

## Runtime-deferred concerns (Tier 2 visual verification)

UX properties that require rendered output, device testing, or real-user measurement (rendered touch-target size, contrast ratios, focus-ring perceivability, LCP/CLS/INP timings, cross-browser rendering, prefers-reduced-motion behavior, screen-reader announcement quality, cross-viewport overflow, loading perception, keyboard trap behavior under real browsers) are out of code-review scope and route to Tier 2 visual verification. See [`ui-ux/README.md`](ui-ux/README.md) for the full list with rationale.

## Maintenance

See [`ui-ux/README.md`](ui-ux/README.md) for: full curation rationale (sourcing rules — NN/g, GOV.UK, WCAG, MDN, Smashing, Baymard, web.dev, Inclusive Components), content-fidelity guarantees, and the runtime-deferred list. When adding `UX-030` or beyond, place the rule in the appropriate by-domain subfile; the maintainer validator recurses [`ui-ux/`](ui-ux/) to enforce the count contract.
