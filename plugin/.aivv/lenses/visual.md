---
name: visual
description: UI + accessibility review lens — component correctness, WCAG 2.1/2.2 AA, visual-consistency heuristics; static review default, optional externalized runtime evidence via generated Playwright probes and ingested user-run JSON
calibration_lens: visual
applies_to: JSX/TSX, Vue, Svelte, HTML, CSS/SCSS/Tailwind, component props, form controls
detect_paths: "**/*.tsx, **/*.jsx, **/*.vue, **/*.svelte, **/*.html, **/*.css, **/*.scss, **/*.less, **/*.sass, **/components/**, **/*.stories.*"
detect_keywords: "ui, component, layout, styling, render, screen, button, modal, responsive, design"
detect_high_risk: false
runtime_driver: optional (externalized B3 probe scaffolds + user-run Playwright JSON ingest by default; host browser-driver adapters are gated alternatives)
runtime_driver_status: B3 externalized runtime evidence — RTV-* rule catalog at .aivv/standards/runtime-visual.md (25 rules: 10 AXE + 7 CONTRAST + 8 DIFF); opt-in via /aivv --runtime or explicit emit/ingest flags; graceful degradation when no runtime artifacts are supplied
---

## Focus

Apply these concerns **in addition to** the universal Phase 2 VERIFY rules. The visual lens extends code review with UI/UX and accessibility concerns that are code-observable without running the app.

### Component & prop correctness

- Required props missing; optional props overused (destructuring with defaults vs. silent `undefined`)
- Controlled vs. uncontrolled inputs — mixed state management breaks forms
- Event handlers bound correctly (no stale closures; dependency arrays complete in `useEffect`/`useCallback`/`useMemo`)
- Key prop on list items — unique, stable, not index-based when list can reorder
- Ref forwarding where needed (custom inputs wrapped by design-system components)

### Form UX (see `.aivv/standards/ui-ux.md` UX-001 through UX-010)

- Every input has a programmatically associated label (not placeholder-as-label)
- Error messages are associated with their field (`aria-describedby`, not color-only)
- Submit buttons have accessible text (not icon-only without `aria-label`)
- Disabled-state semantics correct (`disabled` attribute vs. CSS-only gray-out)
- Autocomplete attributes on standard fields (email, tel, name, address)

### Accessibility — WCAG 2.1 AA + WCAG 2.2 NEW SC code-reviewable baseline (see `.aivv/standards/accessibility.md`)

- `<html lang="...">` present (A11Y-001)
- Heading hierarchy: no skipped levels (h1 → h3 without h2)
- Landmarks: one `<main>`, nav/aside/header/footer used semantically
- Images: `alt=""` for decorative, descriptive alt for meaningful; no alt-as-description-duplication
- Buttons vs. links: actions = button, navigation = anchor; never a `<div onClick>` for a control
- Focus management: no `tabindex > 0`, focus trap in modals, focus returned on close
- Color is not the only carrier of information (error = text + color, not just color)
- ARIA: prefer native semantics; `role=` and `aria-*` used correctly if at all (broken ARIA is worse than no ARIA)
- `prefers-reduced-motion` honored for animations > 5s or > subtle transitions

### Visual verification triggers (see `.aivv/standards/visual-verification-triggers.md`)

When a diff matches a VVT-* pattern, emit `⚠ Visual verification required` as part of the finding. This advisory tells the user that runtime rendered-output verification (Playwright, Chrome DevTools, manual screenshot comparison) is needed in addition to this static review. Code-level review stands on its own; the advisory is a heads-up, not a finding.

Common triggers:
- New/modified positioning (`position:`, `top/left/right/bottom`, `transform:`) — VVT-001
- New/modified layout primitives (flex/grid, float) — VVT-002
- Breakpoint or media-query changes — VVT-003
- Z-index stacking changes — VVT-004
- Component library upgrades or swaps — VVT-005+

Enumerate matched VVT-IDs in the advisory body.

## Severity anchors

When `severity_model: impact_likelihood` is active, use these anchors for visual/accessibility findings. In legacy mode, treat them as reviewer reasoning guidance, not an override of the configured shared severity model. WCAG level is not the severity by itself; severity follows task-blocking impact plus where the defect is reached.

### IMPACT: user-visible or accessibility harm

- **CATASTROPHIC** — primary flow is unusable or inaccessible, critical content/action is hidden, focus is trapped/lost in a way that blocks recovery, or a required legal/financial/data-modification task cannot be completed.
- **SEVERE** — core component, form, modal, navigation, or assistive-technology path is substantially degraded; users can recover only with non-obvious workarounds.
- **MODERATE** — visible layout, labeling, focus, motion, or semantic issue creates friction or confusion but the task remains completable.
- **NEGLIGIBLE** — cosmetic inconsistency, low-risk visual drift, advisory VVT trigger without observed breakage, or design-system preference with no user-visible harm.

### LIKELIHOOD: exposure in rendered use

- **CERTAIN** — appears on initial render, every visit to a primary screen, or every use of a required control.
- **PROBABLE** — appears in common responsive states, common component variants, or normal form/dialog interaction.
- **POSSIBLE** — appears only at a specific breakpoint, optional state, unusual content length, error path, or less common assistive-technology path.
- **UNLIKELY** — unreachable story/test-only state, disabled feature, hidden branch, or speculative visual issue without code evidence that users reach it.

Runtime axe-core evidence remains deterministic when available: preserve RTV-AXE-02's mapping (`critical` -> CRITICAL, `serious` -> MAJOR, `moderate` -> MINOR, `minor` -> POLISH). In static review, use task-blocking impact as the analogy; do not claim axe-core data unless runtime evidence exists.

### Tailwind / utility-CSS specifics

- `className` composition that depends on state — prefer `clsx`/`cn` helpers over string concatenation with spaces
- Conditional classes that produce different element-boxes between states (e.g., `p-2` ↔ `p-4` causes layout shift — flag)
- Arbitrary values `[123px]` — flag as design-system drift unless context justifies
- Tailwind v3 → v4 upgrade markers (`@tailwind`, `@apply`, preflight) require VVT advisory

## Trigger patterns (flag these explicitly)

- `<div onClick>` without `role="button"` + `tabIndex={0}` + keyboard handler
- `<img>` without `alt` attribute (even `alt=""` is fine; missing entirely is not)
- `placeholder="..."` used as the only label for an input
- `<a href="#">` or `<a href="javascript:">` used as an action trigger
- Fixed pixel font-sizes on body text (`font-size: 12px`) — breaks browser zoom
- `outline: none` / `outline: 0` on focusable elements without a visible replacement focus ring
- Color-only distinction in form errors (red border without text label)
- `dangerouslySetInnerHTML` without sanitization *also* fires for the `sec` lens
- `useEffect` dependency array missing a dependency the body references
- `key={index}` in a `.map()` rendering a list that can reorder or have items removed
- Modal / dialog without `role="dialog"` + `aria-modal="true"` + focus trap
- Autoplay video/audio without mute + user-controllable stop

## Standards to consult

- [.aivv/standards/ui-ux.md](../standards/ui-ux.md) — UX-001 through UX-046 (form UX, navigation, error states, loading states; UX-030..036 added dev.81 = T22 phase 1 = Baymard-checkout patterns; UX-037..041 added dev.82 = T22 phase 2 = data-tables & pagination patterns; UX-042..046 added dev.83 = T22 phase 3 = MDN-`<search>` + WCAG-4.1.3 + ARIA-APG-checkbox-mixed + W3C-WAI-forms-grouping search-input + filter-grouping + tri-state-select-all + result-count-status-message patterns, first cycle to dogfood the dev.82-surfaced Step 0.5 code-block-lint + Step 0.6 cross-reference rule-ID grep disciplines)
- [.aivv/standards/accessibility.md](../standards/accessibility.md) — A11Y-001 through A11Y-074 (WCAG 2.1 AA + WCAG 2.2 NEW SC + ARIA APG widget patterns + COGA + SR-divergence code-reviewable baseline; A11Y-036..044 added dev.77 = WCAG 2.2 NEW SC; A11Y-045..060 added dev.78 = 16 ARIA Authoring Practices Guide patterns; A11Y-061..074 added dev.79 = T21 phase 3 = 14 COGA + SR-divergence rules; T21 substantively complete at 74 — master spec target was ~80). **Subdir-retrofitted dev.61** — TOC stub + 8 by-domain subfiles in `accessibility/` (`document-language.md`, `semantic-structure.md`, `forms.md`, `interactive-elements.md`, `images-media.md`, `aria.md`, `keyboard-focus.md`, `color-motion.md`). **Nested retrofit dev.80** — `aria.md` itself now a TOC stub + 3 by-domain sub-subfiles in `accessibility/aria/` (`fundamentals.md`, `apg-widgets.md`, `sr-divergence.md`) — retires dev.78 DEFERRED-RETIRE-WHEN sigil.
- [.aivv/standards/visual-verification-triggers.md](../standards/visual-verification-triggers.md) — VVT-001 through VVT-073 (when to emit runtime-verification advisory; VVT-031..042 added dev.84 = T23 phase 1 = modern web-platform 2022+ baseline features; VVT-043..046 added dev.85 = T23 phase 2 = React Suspense, Web Components / Shadow DOM, IntersectionObserver, ResizeObserver; VVT-047..050 added dev.86 = T23 phase 3 = `:user-valid`/`:user-invalid` + `@starting-style` + `field-sizing` + `text-wrap: balance | pretty`, appended to by-domain subfiles per the dev.86 by-domain partition policy in maintainer guidance; `modern-platform.md` and `framework-observer.md` are CLOSED historical batches; VVT-051..054 added dev.87 = T23 phase 4 = `loading="lazy"` + `decoding`/`fetchpriority` (assets.md) + `font-display` + `prefers-reduced-motion` (css-styling.md), first downstream application of the dev.86 by-domain policy + N=3 back-reference-asymmetry codification in maintainer guidance; VVT-055..058 added dev.89 = T23 phase 5 = `inputmode` + `enterkeyhint` (state-interaction.md) + `color-scheme` + `light-dark()` (css-styling.md), first dogfood of dev.88 per-feature-page N=1 watch + back-reference symmetry corrective-binding extension; VVT-059..062 added dev.90 = T23 phase 6 = `autocomplete` (state-interaction.md) + `accent-color` (Limited availability) + `prefers-contrast` (css-styling.md) + `forced-colors` (accessibility-code.md), second downstream application of dev.88 disciplines; VVT-063..066 added dev.92 = T23 phase 7 = `:focus-visible` + `<details>`/`<summary>` (state-interaction.md) + `appearance` (css-styling.md) + scroll-snap (responsive.md), first dogfood of dev.91 3-discipline codification with Discipline 3 catching 3 pre-authoring miscites; VVT-067..068 added dev.98 = T23 phase 8 batch 1 = HTML `<dialog>` element + `.showModal()` / `.show()` API (component-composition.md, Baseline Widely available since March 2022) + CSS `oklch()` / `oklab()` perceptually-uniform color functions (css-styling.md, Baseline Widely available since May 2023), second dogfood of dev.91 Discipline 3 (semantic-fit-of-citation) catching the initial VVT-067/068/069 plan duplicating pre-existing VVT-031 Container Queries + VVT-036 subgrid + VVT-039 popover before authoring; VVT-069..070 added dev.100 = T23 phase 8 batch 2 = CSS scroll-driven animations `animation-timeline` / `view-timeline-name` / `scroll-timeline-name` (Limited availability — progressive enhancement only) + CSS `@scope` at-rule (Baseline 2025 Newly available since December 2025), both appended to css-styling.md per dev.86 by-domain partition policy; VVT-071..073 added dev.101 = T23 phase 8 batch 3 = CSS `interpolate-size` (Limited availability) + CSS `text-spacing-trim` (Limited availability, CJK typography) + CSS Anchor Positioning split-Baseline (`anchor-name` Baseline 2026 Newly available since January 2026 + `position-anchor`/`anchor()` Limited availability), all appended to css-styling.md per dev.86 by-domain partition policy)
- [.aivv/standards/visual-design.md](../standards/visual-design.md) — VD-* (typography, spacing, color, iconography, motion, layout — code-reviewable aesthetic baselines, predominantly POLISH severity). **Subdir-retrofitted dev.67** — TOC stub + 6 subfiles in `visual-design/`.
- [.aivv/standards/dark-patterns.md](../standards/dark-patterns.md) — DP-* (manipulative-UX detection: pricing, subscription, consent, urgency, scarcity, social-proof, gamification, accessibility-trap, dark-PR; **DP-LEGAL-*** subset is L1 source class — forced-shown regardless of `severity_threshold`; hard legal floor is context-gated). **Subdir-retrofitted dev.68** — TOC stub + 9 by-domain subfiles in `dark-patterns/`; DP-LEGAL-* in `legal.md`.
- [.aivv/standards/runtime-visual.md](../standards/runtime-visual.md) — RTV-AXE-01..10 + RTV-CONTRAST-01..07 + RTV-DIFF-01..08 (25 runtime-visual rules). **Opt-in via `/aivv --runtime` or explicit runtime-evidence emit/ingest flags.** B3 default behavior is to generate reviewable Playwright probe scaffolds and ingest user-run JSON results. Host Playwright/DevTools drivers are optional adapters, not the default review path. RTV-AXE-* catches a11y defects axe-core surfaces only at runtime; RTV-CONTRAST-* measures rendered computed-pixel contrast; RTV-DIFF-* operationalizes screenshot-diff advisories when runtime artifacts exist. When no runtime artifacts are supplied, static A11Y/UX/VVT/VD/DP coverage remains the lens baseline.

These six files ship with the plugin — they are the authoritative rule catalog for this lens. Reviewer should grep/read them for specific rule text when flagging a pattern.

The `visual-design.md` rules are L4 source-class (aesthetic / improvement) — most surface as POLISH; some at MINOR when the violation produces a user-visible defect (e.g., `VD-TYPE-06` FOIT timeout, `VD-SPACE-04` touch-target undersize, `VD-COLOR-04` color-only signal). The compliance variants of cross-cutting concerns live in `accessibility/<domain>.md` (per dev.61 retrofit — cite via `defer-to A11Y-NNN` per rule's prose; the rule itself names the specific subfile).

## Graceful degradation

The visual lens ships in v0.1 as **static review** — JSX/HTML/CSS/component-code inspection against the six standards files above. Runtime-visual.md becomes in-scope when `/aivv --runtime` is invoked and either runtime probe artifacts are emitted/ingested or an explicit host runtime adapter is available. This requires no browser, no MCP, no runtime for the static-review baseline.

**Runtime evidence path:** AIVV generates probe scaffolds and a manifest under `<target>/.aivv/runtime-probes/`; the user or target project runs those specs; AIVV ingests Playwright JSON reporter output back into review-log `runtime_evidence`. Runtime upgrade is **opt-in** and **not required for the lens to function**.

**Host adapter detection:** if an explicitly supported browser driver is available, the orchestrator may name it as an optional read-only evidence source. If absent, do not mark the review failed; emit/runtime-ingest workflow remains available and the static-review baseline stands on its own. The VVT-* advisory remains the hand-off mechanism for "user should run Playwright externally" when runtime artifacts are missing.

**No-UI-in-change-set case**: if the review target contains no UI code (pure backend change), the visual lens returns zero findings with: "Visual lens: no UI code in review target; no findings applicable." Do not force-apply UI heuristics to non-UI code.
