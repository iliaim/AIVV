# Visual Verification Triggers

This document tells the AIVV code reviewer when to emit a `⚠ Visual verification required` advisory in its review output. It does **not** trigger AIVV to execute verification itself — AIVV is static-artifact-scope (see `.aivv/methodology.md` Scope boundary). The advisory is a heads-up for the user to run external runtime verification (Playwright, Chrome DevTools, manual browser inspection) before merging. All heuristics below are diff-observable: a reviewer reading file paths and hunk content can evaluate them without running the code.

**Placement:** add new triggers to the matching by-domain subfile (`css-styling.md`, `state-interaction.md`, `component-composition.md`, `accessibility-code.md`, `assets.md`, `responsive.md`). Do not extend `modern-platform.md` or `framework-observer.md`.

## Runtime-verification composition note

When `/aivv --runtime` is invoked, B3 runtime evidence is externalized by default: AIVV emits reviewable Playwright probe scaffolds and ingests user-run Playwright JSON. The runtime-visual rule catalog at [`.aivv/standards/runtime-visual.md`](../runtime-visual.md) (RTV-AXE-* + RTV-CONTRAST-* + RTV-DIFF-*) describes what those artifacts should verify. The VVT advisory remains the static-review hand-off ("you need to verify this rendered output"); RTV-DIFF-* (screenshot diff + multi-viewport + animation-freezing + theme/cross-browser baseline pairs) are the runtime-verification path that operationalizes VVT-style advisories when runtime artifacts are supplied.

## When to emit the advisory

The reviewer emits `⚠ Visual verification required` when **one or more** triggers below match the diff. Multiple triggers stack — enumerate every matched trigger ID and reason in the advisory body so the user knows exactly what to look at. If zero triggers match, do not emit the advisory (code-level review stands on its own).

Advisory template:

> ⚠ Visual verification required. This change alters rendered behavior ({files/components}). Code-level review found {N} findings; runtime rendered-output verification is needed to catch issues code review cannot. Matched triggers: {VVT-IDs}. Verify via Playwright-class browser automation, Chrome DevTools-class in-browser inspection, or manual screenshot comparison before merge.

## Files

For exact rule IDs per file, run `node <plugin>/tools/standards-lookup.mjs --family visual-verification-triggers`.

| File | Category |
|---|---|
| [css-styling.md](css-styling.md) | CSS and styling changes |
| [component-composition.md](component-composition.md) | Component composition and layout primitive changes |
| [state-interaction.md](state-interaction.md) | State, interaction, and form-flow changes |
| [assets.md](assets.md) | Asset changes (images, SVG, media) |
| [responsive.md](responsive.md) | Responsive and mobile-specific changes |
| [accessibility-code.md](accessibility-code.md) | Accessibility-code changes |
| [modern-platform.md](modern-platform.md) | Modern web-platform features (2022+ Baseline) |
| [framework-observer.md](framework-observer.md) | Framework boundaries + DOM observers |

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
