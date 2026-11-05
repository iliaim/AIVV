# UI/UX Standards — Code-Reviewable Patterns

Curated checklist of UI/UX pattern violations that an IV&V reviewer can catch by reading code alone — no runtime, no rendered output. Each rule cites an authoritative source (NN/g, GOV.UK, WCAG, MDN, Smashing, Baymard, web.dev, Inclusive Components). Out of scope: design aesthetics ("use blue, not green"), design-system choices (Tailwind vs. Material), and rendered-output concerns (cross-browser visual regression, real touch-target size on physical devices, animation timing). Those belong to Tier 2 visual/runtime verification; a flag-list appears at the bottom of this README.

**Rule-count contract (maintainer-side):** the maintainer validator recurses this directory (`grep -rhcE '^### UX-[0-9]+:' .aivv/standards/ui-ux/`) and asserts the count matches the documented total. When adding `UX-030` or beyond, place the new rule in the appropriate by-domain subfile so the recursive grep continues to enforce.

## Rule index (46 code-reviewable rules)

| File | Rules | Section |
|---|---|---|
| [forms.md](forms.md) | UX-001..007 | Form UX |
| [state-handling.md](state-handling.md) | UX-008..011 | State handling (loading / empty / error) |
| [feedback-confirmation.md](feedback-confirmation.md) | UX-012..014 | Feedback & confirmation (destructive actions, toasts, modals) |
| [navigation.md](navigation.md) | UX-015..017 | Navigation (active state, skip links, link-vs-button) |
| [responsive-touch.md](responsive-touch.md) | UX-018..019 | Responsive & touch (viewport, hit area) |
| [ux-microcopy.md](ux-microcopy.md) | UX-020..021 | UX-lens microcopy (peer file [`microcopy.md`](../microcopy.md) covers the full `MC-*` catalog) |
| [data-performance.md](data-performance.md) | UX-022..026 | Data UX & performance-UX (URL state, LCP, alt text, infinite scroll, responsive tables) |
| [progressive-enhancement.md](progressive-enhancement.md) | UX-027..029 | Progressive enhancement (form action, forward-looking errors, silent retry) |
| [checkout-payment.md](checkout-payment.md) | UX-030..036 | Checkout & payment (dev.81 = T22 phase 1; Baymard checkout-usability + web.dev forms + NN/g error-messages anchored; 8-rule initial ship trimmed to 7 by post-ship IV&V corrective) |
| [tables-pagination.md](tables-pagination.md) | UX-037..041 | Data tables & pagination (dev.82 = T22 phase 2; ARIA APG Grid + W3C Table pattern + MDN aria-sort + GOV.UK pagination anchored) |
| [search-filter-status.md](search-filter-status.md) | UX-042..046 | Search inputs, filter grouping & status messages (dev.83 = T22 phase 3; MDN `<search>` + WCAG 4.1.3 Status Messages + ARIA APG checkbox-mixed + MDN `<fieldset>`/`<legend>` + W3C WAI forms-grouping anchored) |

### Content-extension coverage (dev.81 / T22 phase 1; post-corrective state)

The 7 new rules (UX-030..036) extend production-quality checkout flow patterns. **dev.81 post-ship IV&V corrective**: both reviewers cross-convergently flagged that the initially-shipped UX-036 (on-blur validation) substantially duplicated UX-004 (already at MAJOR severity in `ui-ux/forms.md`); deleted with renumber UX-037 → UX-036. The initially-shipped UX-034 ("extends A11Y-061 into commerce domain") was reframed to acknowledge A11Y-061 as the cc-* token authority and narrow UX-034's distinct scope to the shipping/billing mode-prefix disambiguation + `autocomplete="off"` anti-pattern callout.

- **UX-030** (MAJOR): Offer guest checkout — Baymard "84% fail to delay account creation" (top-3 abandonment cause)
- **UX-031** (MINOR): Single name field — Baymard "89% use multi-name fields" (non-Western naming friction)
- **UX-032** (MINOR): Collapse Address Line 2 — Baymard "75% don't hide" (parsing-breakage risk)
- **UX-033** (MINOR): Collapse coupon-code field — Baymard "35% display by default" (signals "you should have a code")
- **UX-034** (MAJOR): Shipping/billing mode-prefix disambiguation + no `autocomplete="off"` on payment — web.dev/forms/autofill — A11Y-061 is the cc-* token authority
- **UX-035** (MINOR): inputmode=numeric on card-number/CVV/postal — web.dev/forms/payment
- **UX-036** (MAJOR): Preserve entered form data on validation error — NN/g error-message guidelines (A11Y-042 is the cross-step authority; UX-036 is the cross-error-render extension)

### Content-extension coverage (dev.82 / T22 phase 2)

The 5 new rules (UX-037..041) cover sortable column headers, the grid-vs-table widget distinction, the ARIA APG grid keyboard model, and accessible pagination semantics. **Step 0 cross-catalog peer-overlap grep** (dev.81 lesson dogfooded) caught the would-be UX-037 candidate "use native `<table>` + caption + scope" as a peer-overlap with **A11Y-008** and dropped it. **WebFetch discipline (dev.80+)** verified all 5 ship-cited URLs (MDN aria-sort, ARIA APG Grid pattern + Data Grids example, ARIA APG Table pattern, GOV.UK pagination) and DEFERRED 6 additional candidate rules (filter chips, "Clear all filters" affordance, page-size selector, "Showing X–Y of Z" status text, bulk-action toolbar, expandable rows) because their primary NN/g / Baymard / Material 3 source URLs returned 404 — discipline-following defer-to-phase-3 rather than fabricate.

- **UX-037** (MAJOR): Sortable column headers communicate sort state via `aria-sort` (single column at a time) — MDN aria-sort + ARIA APG Grid
- **UX-038** (MAJOR): Use `role="grid"` only for interactive cell-navigation widgets; basic data tables use plain `<table>` — ARIA APG Grid + Table patterns
- **UX-039** (MAJOR): Grid widgets follow the APG keyboard model (Arrow + Home/End + Ctrl+Home/End + roving tabindex) — ARIA APG Grid Data Grids example
- **UX-040** (MAJOR): Pagination wraps in `<nav aria-label="Pagination">` with `aria-current="page"` on active page — GOV.UK pagination
- **UX-041** (MINOR): Previous/Next pagination links carry `rel="prev"`/`rel="next"` + visually-hidden "page" suffix — GOV.UK pagination

### Content-extension coverage (dev.83 / T22 phase 3)

The 5 new rules (UX-042..046) cover search input landmarking, filter-group labelling, tri-state select-all checkboxes, and live-announced result counts under WCAG 4.1.3. **Step 0 cross-catalog peer-overlap grep** (dev.81 lesson, dev.82 first dogfood) again caught upstream overlap territories — combobox / typeahead semantics own by **A11Y-048**, debounce timing owns by **HEU-LUX-doherty**, empty filter-result microcopy owns by **MC-023**, URL state owns by **UX-022** — and dev.83 rules layer complementary concerns (landmarking, result-count announcement, group labelling, tri-state semantics) rather than re-asserting baseline territory. **Step 0.5 mental code-block lint** (new dev.82-surfaced N=1 watch dogfooded) verified no if/else-ordering bugs or undeclared variables in the JSX/HTML examples. **Step 0.6 cross-reference rule-ID grep** (new dev.82-surfaced N=1 watch dogfooded) pre-validated all 10 prospective cross-reference rule-IDs (A11Y-008, A11Y-048, HEU-LUX-doherty, HEU-LUX-millers, UX-022, UX-025, UX-040, MC-023, IS-002, IS-013) before authoring — zero fabricated cross-references in the ship. **WebFetch discipline (dev.80+)** verified all 5 ship-cited URL families (MDN `<search>`, MDN `<input type="search">`, ARIA APG search-landmark example, WCAG 4.1.3 Status Messages, MDN role=status, ARIA APG checkbox-mixed example, MDN aria-checked, MDN `<fieldset>`, W3C WAI tutorials/forms/grouping); 4+ candidate rules from earlier deferral pile (visible filter chips, "Clear all filters" affordance, page-size selector, bulk-action toolbar) DEFERRED AGAIN to phase 4+ because the NN/g visible-filters URL still 404'd and Material 3 chips URL returned empty.

- **UX-042** (MAJOR): Search inputs wrap in `<search>` (preferred) or `<form role="search">` with descriptive accessible name — MDN `<search>` + ARIA APG search-landmark example
- **UX-043** (MAJOR): Result counts after filter/search/sort use `role="status"` (WCAG 4.1.3 Status Messages, AA) — MDN role=status + WCAG 4.1.3
- **UX-044** (MAJOR): Tri-state "Select all" checkbox uses `aria-checked="mixed"` (or DOM `indeterminate`) on partial selection — ARIA APG checkbox-mixed + MDN aria-checked
- **UX-045** (MAJOR): Filter-checkbox groups use `<fieldset>` + `<legend>` (or `role="group"` + `aria-labelledby`) — MDN `<fieldset>` + W3C WAI forms-grouping tutorial
- **UX-046** (MINOR): Search inputs use `<input type="search">` rather than `type="text"` for native clear-button + browser search semantics — MDN `<input type="search">`

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
