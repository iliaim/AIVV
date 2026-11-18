# UI/UX Standards — Code-Reviewable Patterns

Curated checklist of UI/UX pattern violations that an IV&V reviewer can catch by reading code alone — no runtime, no rendered output. Each rule cites an authoritative source (NN/g, GOV.UK, WCAG, MDN, Smashing, Baymard, web.dev, Inclusive Components). Out of scope: design aesthetics ("use blue, not green"), design-system choices (Tailwind vs. Material), and rendered-output concerns (cross-browser visual regression, real touch-target size on physical devices, animation timing). Those belong to Tier 2 visual/runtime verification; a flag-list appears at the bottom of this README.

## Files

For exact rule IDs per file, run `node <plugin>/tools/standards-lookup.mjs --family ui-ux`.

| File | Section |
|---|---|
| [forms.md](forms.md) | Form UX |
| [state-handling.md](state-handling.md) | State handling (loading / empty / error) |
| [feedback-confirmation.md](feedback-confirmation.md) | Feedback & confirmation (destructive actions, toasts, modals) |
| [navigation.md](navigation.md) | Navigation (active state, skip links, link-vs-button) |
| [responsive-touch.md](responsive-touch.md) | Responsive & touch (viewport, hit area) |
| [ux-microcopy.md](ux-microcopy.md) | UX-lens microcopy (the full `MC-*` catalog is in [`microcopy/`](../microcopy/README.md)) |
| [data-performance.md](data-performance.md) | Data UX & performance-UX (URL state, LCP, alt text, infinite scroll, responsive tables) |
| [progressive-enhancement.md](progressive-enhancement.md) | Progressive enhancement (form action, forward-looking errors, silent retry) |
| [checkout-payment.md](checkout-payment.md) | Checkout & payment (Baymard checkout usability, web.dev forms, NN/g error messages) |
| [tables-pagination.md](tables-pagination.md) | Data tables & pagination (ARIA APG Grid, W3C Table pattern, MDN aria-sort, GOV.UK pagination) |
| [search-filter-status.md](search-filter-status.md) | Search inputs, filter grouping & status messages (MDN `<search>`, WCAG 4.1.3, ARIA APG checkbox-mixed, W3C WAI forms grouping) |

## Out of code-review scope — flag for visual/runtime verification

These UX properties require rendered output, device testing, or real-user measurement. A code-reviewer should NOT attempt to verify these statically; surface them to Tier 2 visual/runtime verification instead.

- **Actual rendered touch-target size** on physical devices across viewports (code-min-height enforces a floor but doesn't guarantee the rendered hit area).
- **Color contrast ratios** for text, icons, focus rings, and state indicators (requires computed styles and rendering).
- **Focus ring visibility** — whether `:focus-visible` styles are actually visible against the background.
- **LCP / CLS / INP timings** under realistic network and CPU conditions (Lighthouse / real-user monitoring).
- **Cross-browser rendering** — Safari/Firefox/Chromium layout and form-control differences.
- **Animation timing / prefers-reduced-motion** behavior under real vestibular-sensitivity conditions.
- **Screen-reader announcement quality** — how NVDA / JAWS / VoiceOver actually voice live regions, errors, and dynamic updates.
- **Cross-viewport overflow / wrapping** — e.g., long labels in constrained columns, tabular-number font rendering on mobile.
- **Loading perception** — whether the skeleton/spinner choice feels fast to real users (qualitative UX research).
- **Keyboard trap / escape behavior** in real browsers — code review can see the attributes but not whether the trap holds under every tab path.
