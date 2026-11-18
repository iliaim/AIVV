---
name: visual
description: UI + accessibility review lens — component correctness, WCAG 2.1/2.2 AA, visual-consistency heuristics; static review default, optional externalized runtime evidence via generated Playwright probes and ingested user-run JSON
calibration_lens: visual
applies_to: JSX/TSX, Vue, Svelte, HTML, CSS/SCSS/Tailwind, component props, form controls
detect_paths: "**/*.tsx, **/*.jsx, **/*.vue, **/*.svelte, **/*.html, **/*.css, **/*.scss, **/*.less, **/*.sass, **/components/**, **/*.stories.*"
detect_keywords: "ui, component, layout, styling, render, screen, button, modal, responsive, design"
detect_high_risk: false
runtime_driver: optional (externalized B3 probe scaffolds + user-run Playwright JSON ingest by default; host browser-driver adapters are gated alternatives)
runtime_driver_status: B3 externalized runtime evidence — RTV-* rule catalog at .aivv/standards/runtime-visual.md (AXE, CONTRAST, DIFF); opt-in via /aivv --runtime or explicit emit/ingest flags; graceful degradation when no runtime artifacts are supplied
---

## Focus

Apply these concerns **in addition to** the universal Phase 2 VERIFY rules. The visual lens extends code review with UI/UX and accessibility concerns that are code-observable without running the app.

### Component & prop correctness

- Required props missing; optional props overused (destructuring with defaults vs. silent `undefined`)
- Controlled vs. uncontrolled inputs — mixed state management breaks forms
- Event handlers bound correctly (no stale closures; dependency arrays complete in `useEffect`/`useCallback`/`useMemo`)
- Key prop on list items — unique, stable, not index-based when list can reorder
- Ref forwarding where needed (custom inputs wrapped by design-system components)

### Form UX (see `.aivv/standards/ui-ux/forms.md`)

- Every input has a programmatically associated label (not placeholder-as-label)
- Error messages are associated with their field (`aria-describedby`, not color-only)
- Submit buttons have accessible text (not icon-only without `aria-label`)
- Disabled-state semantics correct (`disabled` attribute vs. CSS-only gray-out)
- Autocomplete attributes on standard fields (email, tel, name, address)

### Accessibility — WCAG 2.1 AA + WCAG 2.2 NEW SC code-reviewable baseline (see `.aivv/standards/accessibility/README.md`)

- `<html lang="...">` present (A11Y-001)
- Heading hierarchy: no skipped levels (h1 → h3 without h2)
- Landmarks: one `<main>`, nav/aside/header/footer used semantically
- Images: `alt=""` for decorative, descriptive alt for meaningful; no alt-as-description-duplication
- Buttons vs. links: actions = button, navigation = anchor; never a `<div onClick>` for a control
- Focus management: no `tabindex > 0`, focus trap in modals, focus returned on close
- Color is not the only carrier of information (error = text + color, not just color)
- ARIA: prefer native semantics; `role=` and `aria-*` used correctly if at all (broken ARIA is worse than no ARIA)
- `prefers-reduced-motion` honored for animations > 5s or > subtle transitions

### Visual verification triggers (see `.aivv/standards/visual-verification-triggers/README.md`)

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

## Trigger patterns

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

- [.aivv/standards/ui-ux/README.md](../standards/ui-ux/README.md) — UX-* (form UX, navigation, error and loading states, checkout, tables and pagination, search and filters)
- [.aivv/standards/accessibility/README.md](../standards/accessibility/README.md) — A11Y-* (WCAG 2.1 AA + WCAG 2.2 new SC + ARIA APG widget patterns + COGA + SR-divergence code-reviewable baseline).
- [.aivv/standards/visual-verification-triggers/README.md](../standards/visual-verification-triggers/README.md) — VVT-* (when to emit the runtime-verification advisory)
- [.aivv/standards/visual-design/README.md](../standards/visual-design/README.md) — VD-* (typography, spacing, color, iconography, motion, layout — code-reviewable aesthetic baselines, predominantly POLISH severity).
- [.aivv/standards/dark-patterns/README.md](../standards/dark-patterns/README.md) — DP-* (manipulative-UX detection: pricing, subscription, consent, urgency, scarcity, social-proof, gamification, accessibility-trap, dark-PR; **DP-LEGAL-*** subset is L1 source class — forced-shown regardless of `severity_threshold`; hard legal floor is context-gated). DP-LEGAL-* live in `dark-patterns/legal.md`.
- [.aivv/standards/runtime-visual.md](../standards/runtime-visual.md) — RTV-AXE-*, RTV-CONTRAST-*, RTV-DIFF-* runtime-visual rules. **Opt-in via `/aivv --runtime` or explicit runtime-evidence emit/ingest flags.** B3 default behavior is to generate reviewable Playwright probe scaffolds and ingest user-run JSON results. Host Playwright/DevTools drivers are optional adapters, not the default review path. RTV-AXE-* catches a11y defects axe-core surfaces only at runtime; RTV-CONTRAST-* measures rendered computed-pixel contrast; RTV-DIFF-* operationalizes screenshot-diff advisories when runtime artifacts exist. When no runtime artifacts are supplied, static A11Y/UX/VVT/VD/DP coverage remains the lens baseline.

These files ship with the plugin — they are the authoritative rule catalog for this lens. Reviewer should grep/read them for specific rule text when flagging a pattern.

The `visual-design/` rules are L4 source-class (aesthetic / improvement) — most surface as POLISH; some at MINOR when the violation produces a user-visible defect (e.g., `VD-TYPE-06` FOIT timeout, `VD-SPACE-04` touch-target undersize, `VD-COLOR-04` color-only signal). The compliance variants of cross-cutting concerns live in `accessibility/<domain>.md` (cite via `defer-to A11Y-NNN` per the rule's prose; the rule itself names the specific subfile).

## Graceful degradation

The visual lens is a **static review** — JSX/HTML/CSS/component-code inspection against the standards files above. Runtime-visual.md becomes in-scope when `/aivv --runtime` is invoked and either runtime probe artifacts are emitted/ingested or an explicit host runtime adapter is available. This requires no browser, no MCP, no runtime for the static-review baseline.

**Runtime evidence path:** AIVV generates probe scaffolds and a manifest under `<target>/.aivv/runtime-probes/`; the user or target project runs those specs; AIVV ingests Playwright JSON reporter output back into review-log `runtime_evidence`. Runtime upgrade is **opt-in** and **not required for the lens to function**.

**Host adapter detection:** if an explicitly supported browser driver is available, the orchestrator may name it as an optional read-only evidence source. If absent, do not mark the review failed; emit/runtime-ingest workflow remains available and the static-review baseline stands on its own. The VVT-* advisory remains the hand-off mechanism for "user should run Playwright externally" when runtime artifacts are missing.

**No-UI-in-change-set case**: if the review target contains no UI code (pure backend change), the visual lens returns zero findings with: "Visual lens: no UI code in review target; no findings applicable." Do not force-apply UI heuristics to non-UI code.
