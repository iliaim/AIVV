# Visual Verification Triggers

This document tells the AIVV code reviewer when to emit a `⚠ Visual verification required` advisory in its review output. It does **not** trigger AIVV to execute verification itself — AIVV is static-artifact-scope (see `.aivv/methodology.md` Scope boundary). The advisory is a heads-up for the user to run external runtime verification (Playwright, Chrome DevTools, manual browser inspection) before merging. All heuristics below are diff-observable: a reviewer reading file paths and hunk content can evaluate them without running the code.

**Rule-count contract (maintainer-side):** the maintainer validator recurses this directory (`grep -rhcE '^### VVT-[0-9]+:' .aivv/standards/visual-verification-triggers/`) and asserts the count matches the documented total. When adding `VVT-074` or beyond, place the new rule in the appropriate **by-domain** subfile (`css-styling.md` / `state-interaction.md` / `component-composition.md` / `accessibility-code.md` / `assets.md` / `responsive.md`) per the dev.86 by-domain partition policy in maintainer guidance. The by-date-grouped `modern-platform.md` (VVT-031..042) and `framework-observer.md` (VVT-043..046) are CLOSED historical batches; do NOT append new triggers there. The recursive grep enforces the count regardless of subfile placement. Any new content-extension cycle that adds rules citing pre-existing peers MUST add reciprocal back-citations in the same atomic commit (dev.87+ back-reference symmetry rule in maintainer guidance).

## Runtime-verification composition note (dev.106+)

When `/aivv --runtime` is invoked, B3 runtime evidence is externalized by default: AIVV emits reviewable Playwright probe scaffolds and ingests user-run Playwright JSON. The runtime-visual rule catalog at [`.aivv/standards/runtime-visual.md`](../runtime-visual.md) (RTV-AXE-* + RTV-CONTRAST-* + RTV-DIFF-*) describes what those artifacts should verify. The VVT advisory remains the static-review hand-off ("you need to verify this rendered output"); RTV-DIFF-01..08 (screenshot diff + multi-viewport + animation-freezing + theme/cross-browser baseline pairs) are the runtime-verification path that operationalizes VVT-style advisories when runtime artifacts are supplied. Catalog-scope back-cite per the dev.103 COMP-LEGAL-06 → A11Y-001..074 range-cite precedent (avoids per-VVT-rule duplication across 73 surfaces).

## When to emit the advisory

The reviewer emits `⚠ Visual verification required` when **one or more** triggers below match the diff. Multiple triggers stack — enumerate every matched trigger ID and reason in the advisory body so the user knows exactly what to look at. If zero triggers match, do not emit the advisory (code-level review stands on its own).

Advisory template:

> ⚠ Visual verification required. This change alters rendered behavior ({files/components}). Code-level review found {N} findings; runtime rendered-output verification is needed to catch issues code review cannot. Matched triggers: {VVT-IDs}. Verify via Playwright-class browser automation, Chrome DevTools-class in-browser inspection, or manual screenshot comparison before merge.

## Trigger index (73 code-reviewable triggers)

| File | Triggers | Category |
|---|---|---|
| [css-styling.md](css-styling.md) | VVT-001..009, VVT-048..050, VVT-053..054, VVT-057..058, VVT-060..061, VVT-066, VVT-068..073 | CSS and styling changes (dev.86 extension: `@starting-style`, `field-sizing`, `text-wrap: balance \| pretty`; dev.87 extension: `font-display`, `prefers-reduced-motion`; dev.89 extension: `color-scheme`, `light-dark()`; dev.90 extension: `accent-color`, `prefers-contrast`; dev.92 extension: `appearance`; dev.98 extension: `oklch()`/`oklab()`; dev.100 extension: scroll-driven animations + `@scope`; dev.101 extension: `interpolate-size` + `text-spacing-trim` + CSS Anchor Positioning) |
| [component-composition.md](component-composition.md) | VVT-010..013, VVT-067 | Component composition and layout primitive changes (dev.98 extension: HTML `<dialog>` + `.showModal()`/`.show()` API) |
| [state-interaction.md](state-interaction.md) | VVT-014..019, VVT-047, VVT-055..056, VVT-059, VVT-063..064 | State, interaction, and form-flow changes (dev.86 extension: `:user-valid` / `:user-invalid`; dev.89 extension: `inputmode`, `enterkeyhint`; dev.90 extension: `autocomplete`; dev.92 extension: `:focus-visible`, `<details>`/`<summary>`) |
| [assets.md](assets.md) | VVT-020..022, VVT-051..052 | Asset changes (images, SVG, media; dev.87 extension: `loading="lazy"`, `decoding` + `fetchpriority`) |
| [responsive.md](responsive.md) | VVT-023..025, VVT-065 | Responsive and mobile-specific changes (dev.92 extension: scroll-snap) |
| [accessibility-code.md](accessibility-code.md) | VVT-026..030, VVT-062 | Accessibility-code changes (dev.90 extension: `forced-colors`) |
| [modern-platform.md](modern-platform.md) | VVT-031..042 | **CLOSED batch.** Modern web-platform features (2022+ baseline; dev.84 = T23 phase 1) |
| [framework-observer.md](framework-observer.md) | VVT-043..046 | **CLOSED batch.** Framework boundaries + DOM observers (dev.85 = T23 phase 2) |

## Decision examples

**Example 1 — CSS-only refactor**

Diff: `src/components/Navbar.module.css` adds `position: sticky; top: 0; z-index: 40;` to `.navbar`.

Matched triggers: **VVT-001** (position sticky added), **VVT-002** (new z-index).

Advisory:
> ⚠ Visual verification required. This change alters rendered behavior (`src/components/Navbar.module.css`). Code-level review found 0 findings; runtime rendered-output verification is needed to catch issues code review cannot. Matched triggers: VVT-001 (new `position: sticky`), VVT-002 (new `z-index: 40`). Verify via Playwright-class browser automation or Chrome DevTools-class in-browser inspection: navbar stays pinned on scroll, does not hide modal or dropdown content, and renders correctly at mobile/tablet/desktop.

---

**Example 2 — Form validation addition**

Diff: `src/forms/SignupForm.tsx` adds a zod schema, `aria-invalid`, and `aria-describedby` wiring to inputs; new `<p className="error">` elements rendered conditionally.

Matched triggers: **VVT-014** (form validation logic), **VVT-026** (ARIA additions).

Advisory:
> ⚠ Visual verification required. Matched triggers: VVT-014 (validation + error UI), VVT-026 (aria-invalid / aria-describedby). Verify: submit-with-empty-fields focuses first invalid field, screen reader announces error text, error color meets 4.5:1 contrast. Suggested: Playwright-class browser automation + aXe DevTools.

---

**Example 3 — Icon swap**

Diff: replaced `<MenuIcon />` with `<HamburgerIcon />` in `src/components/Header.tsx`; imported from the same design-system package.

Matched triggers: **VVT-020** (icon replacement).

Advisory:
> ⚠ Visual verification required. Matched triggers: VVT-020 (icon replacement). Verify: new icon aligns with adjacent text, contrast ratio ≥ 3:1 against header background, `aria-label` still describes the rendered meaning. Suggested: manual screenshot comparison + aXe DevTools.

---

**Example 4 — No advisory emitted**

Diff: `src/utils/dateFormat.ts` changes a date-formatting function's implementation; no JSX, CSS, or asset changes.

Matched triggers: none.

Advisory: *(not emitted — pure logic change with no diff-observable rendered-output implications)*.
