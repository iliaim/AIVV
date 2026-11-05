# Visual Verification Triggers — CSS and styling changes

Part of [.aivv/standards/visual-verification-triggers/](README.md) (VVT-001..009, VVT-048..050, VVT-053..054, VVT-057..058, VVT-060..061, VVT-066, VVT-068). Extended dev.86 = T23 phase 3 — `@starting-style` entry transitions (Baseline 2024), `field-sizing` form-control intrinsic sizing (Limited availability — progressive enhancement only), `text-wrap: balance | pretty` typography (Baseline 2024), appended per the dev.86 by-domain partition policy. Extended dev.87 = T23 phase 4 — `font-display` (Baseline 2020) and `prefers-reduced-motion` (Baseline 2020) appended per same policy. Extended dev.89 = T23 phase 5 — `color-scheme` (Baseline 2022) and `light-dark()` (Baseline 2024 Newly available) appended per same policy. Extended dev.90 = T23 phase 6 — `accent-color` (Limited availability — progressive enhancement only) and `prefers-contrast` (Baseline 2022) appended per same policy. Extended dev.92 = T23 phase 7 — `appearance` form-control style reset (Baseline 2022) appended per same policy. Extended dev.98 = T23 phase 8 batch 1 — `oklch()` / `oklab()` perceptually-uniform color functions (Baseline Widely available since May 2023) appended per same policy.

### VVT-001: New or modified positioning rules

**Pattern (diff-observable)**:
- File/path match: `**/*.{css,scss,sass,less,styl}`, `**/*.{module.css,module.scss}`, `**/*.{tsx,jsx,vue,svelte}` containing inline styles or styled-components
- Content match: added or changed `position:\s*(absolute|fixed|sticky)`, or removed `position:\s*relative` from a parent

**Why runtime verification is needed**: Positioning cascades depend on the nearest positioned ancestor at render time — diffs don't reveal whether the new `position: absolute` will anchor to the intended container or escape to `<body>`.

**What to verify externally**:
- Element anchors to expected container at all tested viewports
- No overflow off-screen or overlap with sibling elements
- Sticky/fixed elements do not cover interactive controls at small viewports

**Suggested tooling**: Playwright-class browser automation | Chrome DevTools-class in-browser inspection | manual screenshot comparison

---

### VVT-002: z-index changes

**Pattern (diff-observable)**:
- Content match: added, removed, or numerically changed `z-index:` declarations
- File/path match: any stylesheet or inline-style location

**Why runtime verification is needed**: Stacking-context interactions are non-local; a single `z-index` edit can reveal or hide content anywhere in the page depending on ancestor `transform`, `opacity`, `filter`, or `will-change` declarations not visible in the hunk.

**What to verify externally**:
- Modals, dropdowns, tooltips, toasts render above their intended siblings
- No content leaks through overlays
- Focus rings remain visible above surrounding chrome

**Suggested tooling**: Playwright-class browser automation | manual interaction test

---

### VVT-003: Transform, filter, or opacity added to a layout ancestor

**Pattern (diff-observable)**:
- Content match: new `transform:`, `filter:`, `backdrop-filter:`, `perspective:`, `will-change:`, or `opacity: <1` on a container selector (not a leaf element)

**Why runtime verification is needed**: Any of these properties creates a new stacking context and containing block for `position: fixed` descendants, which silently re-anchors fixed-positioned children to the ancestor instead of the viewport.

**What to verify externally**:
- All `position: fixed` descendants still pin to the viewport
- Child modals/overlays are not clipped by the ancestor

**Suggested tooling**: Chrome DevTools-class in-browser inspection (check computed `containing block`) | Playwright-class browser automation

---

### VVT-004: Breakpoint additions or media-query edits

**Pattern (diff-observable)**:
- Content match: added/modified `@media`, `@container`, or changed numeric breakpoint values in config files (`tailwind.config.*`, `theme.js`, SCSS variables like `$breakpoint-*`)

**Why runtime verification is needed**: Code review sees one breakpoint rule at a time; the cumulative effect across the breakpoint ladder (including gaps and overlaps between rules) is only visible when actually resizing the viewport.

**What to verify externally**:
- Layout at mobile (< 640px), tablet (640–1024px), desktop (> 1024px), and the new/edited breakpoint's inflection points (N−1px, Npx, N+1px)
- No layout gap or sudden jump at breakpoint boundaries

**See also**: **VVT-031** (`modern-platform.md`) for container-query-deep coverage (`@container` queries layout against the container's inline-size rather than the viewport — distinct concern).

**Suggested tooling**: Playwright-class browser automation (multi-viewport screenshots) | Chrome DevTools-class in-browser inspection (responsive mode)

---

### VVT-005: Flex or grid structural changes

**Pattern (diff-observable)**:
- Content match: added/changed `display: (flex|grid|inline-flex|inline-grid)`, `grid-template-*`, `flex-direction`, `flex-wrap`, `gap`, `place-items`, `justify-*`, `align-*`
- Utility-class equivalents: Tailwind `flex`, `grid`, `grid-cols-*`, `gap-*`, `justify-*`, `items-*` class additions

**Why runtime verification is needed**: Flex/grid behavior depends on intrinsic child sizes, content length, and implicit tracks — none of which are visible in the diff. Wrapping, overflow, and uneven track distribution surface only at runtime with real content.

**What to verify externally**:
- Wrapping behavior with long text / localized strings
- No unintended horizontal scroll
- Columns/rows distribute as intended with min/max content

**Suggested tooling**: Playwright-class browser automation | manual screenshot comparison across locales

---

### VVT-006: New or modified animations / transitions

**Pattern (diff-observable)**:
- Content match: added `@keyframes`, `animation:`, `transition:`, `animation-*`, `transition-*`, or framer-motion / GSAP / Web Animations API calls

**Why runtime verification is needed**: Animation timing, easing, and layout-shift impact (CLS) are invisible in code review. Reduced-motion preference handling is also only observable at runtime.

**What to verify externally**:
- Animation plays smoothly (no jank, no layout thrash)
- `prefers-reduced-motion: reduce` short-circuits or degrades the animation
- CLS score does not regress (animation uses `transform`/`opacity`, not `top`/`left`/`width`/`height`)

**See also**: **VVT-048** for the `@starting-style` entry-transition primitive — pairs with reduced-motion handling covered by this trigger; `@starting-style` declares the "from" state for first-render and `display: none → visible` transitions that this trigger does not otherwise capture. **VVT-054** for the dedicated `prefers-reduced-motion` trigger — required pairing whenever an animation/transition is added (this trigger flags the animation; VVT-054 flags the user-preference signal handling). **VVT-069** for CSS scroll-driven animations (`animation-timeline`, `view-timeline`) — the scroll-progress-bound subset of this trigger; pair when an animation timeline is tied to scroll position rather than time.

**Suggested tooling**: Chrome DevTools-class in-browser inspection (Performance panel + CLS) | Lighthouse audit

---

### VVT-007: Font, font-family, or font-loading changes

**Pattern (diff-observable)**:
- Content match: added `@font-face`, changed `font-family`, new `<link rel="preload" as="font">`, modified `font-display:`, or imports of font packages (`@fontsource/*`, Google Fonts URLs, `next/font`)

**Why runtime verification is needed**: Font swap (FOUT/FOIT) causes layout shift; fallback metrics (`size-adjust`, `ascent-override`) only show their effect once the font loads.

**What to verify externally**:
- CLS at first paint (load with throttled network)
- Fallback font's metric match to webfont (no visible reflow on swap)
- All glyph ranges present for localized content

**See also**: **VVT-053** for the dedicated `font-display` descriptor — the canonical control over the block/swap/failure-period trade-off this trigger touches; pair these triggers whenever a new `@font-face` is added or a `font-family:` declaration introduces a new webfont.

**Suggested tooling**: Chrome DevTools-class in-browser inspection (Network throttle + Performance) | Lighthouse audit

---

### VVT-008: Color, contrast, or theme-token changes

**Pattern (diff-observable)**:
- Content match: changed color values in design-token files (`tokens.*`, `theme.*`, CSS custom properties `--color-*`), new `color:`/`background:`/`border-color:` declarations, dark-mode overrides (`@media (prefers-color-scheme: dark)`, `.dark` class rules)

**Why runtime verification is needed**: Contrast ratio is a computed property of the rendered foreground over the rendered background (including semi-transparent overlays and backdrop-filter); it cannot be derived from the token values alone.

**What to verify externally**:
- WCAG AA contrast (4.5:1 text / 3:1 large text and UI) in both light and dark modes
- No invisible text on state changes (hover, focus, disabled)

**See also**: **VVT-057** for `color-scheme` — the canonical UA-chrome-theming trigger that complements design-token changes (a token-set change must pair with `color-scheme` so UA-rendered form controls / scrollbars match). **VVT-058** for `light-dark()` — the canonical app-content theming function for color-token migrations away from `prefers-color-scheme` media queries. **VVT-060** for `accent-color` — UA-rendered form-control tinting (Limited availability; progressive enhancement). **VVT-061** for `prefers-contrast` — OS-preference-driven contrast adjustment media query. **VVT-062** (`accessibility-code.md`) for `forced-colors` — Windows High Contrast Mode handling. **VVT-063** (`state-interaction.md`) for `:focus-visible` — pair when adding theme-aware focus-ring tokens (the ring color is part of the theme system). **VVT-066** for `appearance` — pair when a design-token system applies to stripped-UA-chrome form controls (custom styling carries the color burden).

**Suggested tooling**: aXe DevTools | Lighthouse a11y audit | manual contrast check via DevTools color picker

---

### VVT-009: Overflow, clip-path, or mask changes

**Pattern (diff-observable)**:
- Content match: added/changed `overflow:`, `overflow-x/y:`, `clip-path:`, `mask:`, `mask-image:`

**Why runtime verification is needed**: Overflow clipping can hide focus rings, tooltips, and dropdowns that were previously escaping the container; `clip-path`/`mask` shapes render differently per browser.

**What to verify externally**:
- Focus outlines remain visible when focused child is near container edge
- Dropdowns/tooltips are not clipped
- Cross-browser (Chromium, Firefox, WebKit) rendering of clip/mask

**Suggested tooling**: Playwright-class browser automation (multi-browser) | manual keyboard focus walk

---

### VVT-048: CSS `@starting-style` rule additions — Baseline 2024

**Pattern (diff-observable)**:
- Content match: added `@starting-style { ... }` at-rule, or new `transition` declarations on elements that toggle `display: none` ↔ visible, or appear in the top layer (popover / modal `<dialog>`), or first-render entry animations
- File/path match: any stylesheet, popover / dialog / overlay / toast / route-transition component styles, `display`-toggling component styles

**Why runtime verification is needed**: CSS transitions do NOT fire on an element's first style update or when `display` changes from `none` to a visible value. `@starting-style` declares the "from" state that the transition animates FROM when the element first renders or first transitions into visibility / the top layer. Diffs show the rule but cannot reveal: (a) whether the transition actually plays (depends on the matching of the original rule and the source-order of `@starting-style`); (b) whether the transition flickers on cycling (open → close → open); (c) whether reduced-motion preferences correctly short-circuit the entry. Specificity caveat: `@starting-style` and the matching "original" rule have IDENTICAL specificity — `@starting-style` MUST appear AFTER the original rule in source order, otherwise the original rule overrides the starting style and no transition plays (common authoring bug — silently breaks the entry animation). The behavior is one-way: when the element transitions back from visible → `display: none`, it does NOT consult `@starting-style` again — exit animation needs a separate explicit "to" state declaration.

**What to verify externally**:
- First-render entry transition plays (no instant pop-in)
- `display: none` → visible transition plays each time the element opens
- Source-ordering: `@starting-style` rule appears AFTER the "original rule" in the stylesheet (check Computed-styles panel; if the original rule wins, the transition silently fails)
- Exit transition (visible → hidden) plays independently — `@starting-style` is entry-only
- `prefers-reduced-motion: reduce` user setting degrades or shortens the transition appropriately
- Non-supporting browser fallback (instant entry without transition) is acceptable

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style (Baseline 2024 — Newly available since August 2024; "transitions are by default not triggered on an element's initial style update, or when its display type changes from none to another value"; specificity tie → source order matters; one-way entry-only behavior)

**See also**: **VVT-067** (`component-composition.md`) for HTML `<dialog>` + `.showModal()` — top-layer dialogs are a canonical pairing for `@starting-style` entry transitions (animate the open transition from a "from" state with `@starting-style` and the corresponding `::backdrop` from-state for the dialog backdrop). **VVT-039** (`modern-platform.md`) for the HTML `popover` attribute — popovers are the canonical use case for `@starting-style` (entry/exit animation pairing for top-layer elements). **VVT-019** (`state-interaction.md`) for dialog / modal behavior changes that often pair with entry/exit animations. **VVT-006** for the broader animation/transition trigger including reduced-motion handling. **VVT-054** for the dedicated `prefers-reduced-motion` trigger — `@starting-style` entry transitions must include a reduced-motion override block since they animate from a "from" state that becomes vestibular-trigger-prone on element entry.

**Suggested tooling**: Playwright-class browser automation with reduced-motion media-feature emulation | Chrome DevTools-class in-browser inspection (Animations panel + Computed-styles panel for source-order verification)

---

### VVT-049: CSS `field-sizing: content` declarations — Limited availability (progressive enhancement only)

**Pattern (diff-observable)**:
- Content match: added `field-sizing: content` declaration on `<input>`, `<textarea>`, `<select>`, or other form-control selectors
- File/path match: any stylesheet, form-component styles, design-token files for form controls

**Why runtime verification is needed**: `field-sizing: content` overrides the default fixed-size behavior of form controls — they shrinkwrap their content and grow as the user types, up to constraints set by the containing element or `max-width` / `max-height` / `maxlength`. As of 2026-05, MDN classifies this property as **Limited availability** (NOT Baseline) — supported in Chromium-based browsers, not yet in Firefox or Safari. Diff review shows the declaration but cannot reveal: (a) how the control actually behaves at typing time across browsers; (b) interaction with `width` / `height` declarations on the same element (a fixed `width: 200px` re-imposes fixed sizing and defeats `field-sizing: content`); (c) interaction with the HTML `maxlength` attribute (control stops growing at the character-count cap); (d) overflow behavior at the `max-width` / containing-element boundary (scroll vs clip). Authors should treat `field-sizing: content` as a progressive enhancement layered ABOVE an acceptable fixed-size baseline for non-supporting browsers — otherwise layout shifts unpredictably between user-agents.

**What to verify externally**:
- In supporting browsers (Chromium-based as of 2026-05): control shrinkwraps its placeholder / value and grows as the user types
- In non-supporting browsers (Firefox, Safari as of 2026-05): control renders at default fixed size — verify this fallback baseline is acceptable for the same layout
- `max-width` / `max-height` caps the growth at the intended boundary (use `min-width` / `max-width` alongside `field-sizing: content` per MDN guidance — they preserve the shrink-grow behavior while bounding it)
- HTML `maxlength` attribute caps growth at the character-count cap (verify the visible-size cap is the intended UX, not arbitrary)
- Avoid fixed `width:` / `height:` on the same selector — they re-impose fixed sizing and silently defeat `field-sizing: content`
- Containing layout (flex, grid, table) accommodates the variable-size control without breaking neighboring elements at typing-time growth

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/field-sizing (Limited availability — explicitly NOT Baseline as of 2026; "field-sizing: content overrides the default preferred sizing of form elements"; width/height/maxlength interaction)

**Suggested tooling**: Playwright-class automation — Chromium for supporting behavior (verify the shrinkwrap-and-grow path); Firefox + WebKit for fallback behavior (verify the default-fixed-size baseline renders acceptably) | manual typing test in supporting + non-supporting browsers

---

### VVT-050: CSS `text-wrap: balance` / `text-wrap: pretty` declarations — Baseline 2024

**Pattern (diff-observable)**:
- Content match: added `text-wrap: balance` or `text-wrap: pretty` declarations
- File/path match: any stylesheet, typography token files, heading / caption / blockquote / body-copy / paragraph component styles

**Why runtime verification is needed**: `text-wrap: balance` re-wraps lines to balance character counts per line — designed for short blocks (headings, captions, blockquotes). Per MDN, browsers cap the line count this applies to (**Chromium: 6 lines, Firefox: 10 lines**) — a paragraph that exceeds the cap gets default wrapping for the overflow lines, producing inconsistent rendering across blocks AND across engines. `text-wrap: pretty` runs a slower algorithm that minimizes orphans / improves typographic rhythm — designed for body copy — and per MDN explicitly **has a negative performance impact**, so should NOT be applied indiscriminately to all paragraph text or to large articles. Diff review shows the declaration but cannot reveal: (a) the actual line-break positions (depend on font, viewport width, container width, browser engine); (b) the cap-edge case where a heading that fits in 6 lines on desktop overflows to 7+ at narrow viewports (silent engine-specific drop-back to default wrap); (c) the layout-time cost of applying `pretty` to a long article.

**What to verify externally**:
- Headings styled with `balance` wrap symmetrically across viewports — verify at narrow widths where line count crosses the engine cap (6 in Chromium, 10 in Firefox); the cap-edge case silently falls back to default wrap
- Body copy styled with `pretty` does NOT produce visible jank on initial render of long articles (test with realistic article-length content and slower CPU emulation)
- Apply `balance` and `pretty` to APPROPRIATE element scopes (headings / captions / blockquotes vs paragraphs) — over-applying `pretty` to the entire document causes measurable layout-time cost
- Non-supporting browser fallback (default wrapping) renders acceptably
- Cross-engine line-break parity check (Chrome vs Firefox vs Safari) — the per-engine cap difference + algorithmic differences produce slightly different break positions; verify the design intent survives both

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap (Baseline 2024 — Newly available since March 2024; balance line-count cap: 6 Chromium / 10 Firefox; pretty "has a negative effect on performance, so it should be only used for longer blocks of text when the layout is more important than speed" per MDN)

**Suggested tooling**: Playwright-class browser automation with multi-viewport line-break screenshot diff | Chrome DevTools-class Performance profiler for `pretty` layout-time impact on long-form content

---

### VVT-053: CSS `font-display` descriptor additions or modifications — Baseline 2020

**Pattern (diff-observable)**:
- Content match: added or modified `font-display:` descriptor inside an `@font-face` block (values: `auto`, `block`, `swap`, `fallback`, `optional`); switching between values; removing the descriptor (reverts to UA default behavior, often `block`-like)
- File/path match: any CSS / SCSS / CSS-in-JS file containing `@font-face` declarations; font-loading helper config (`next/font` options, `@fontsource/*` overrides)

**Why runtime verification is needed**: `font-display` is a hint to the user-agent's font-loading state machine — it controls the durations of three runtime-only periods (block, swap, failure) that determine whether an element renders with invisible text (FOIT), with a fallback font (FOUT), or never swaps at all. Per MDN: `block` gives "a short block period and an infinite swap period" (FOIT-tolerant); `swap` gives "an extremely small block period and an infinite swap period" (FOUT-tolerant); `fallback` gives "an extremely small block period and a short swap period" (limited swap window); `optional` gives "an extremely small block period and no swap period" (never swap if not cached). Diff review shows the value swap but cannot reveal: (a) **actual block/swap timing** on the target audience's network and CPU profile (browser implementations differ in exact period durations within the spec-defined "short" / "extremely small" framing); (b) **CLS impact at the swap moment** — when the fallback font's metrics differ from the webfont's, the swap reflows text at the boundary, producing measurable CLS regression unless `size-adjust` / `ascent-override` / `descent-override` are also configured (VVT-007 territory); (c) **`optional` cache-dependence** — first-visit users may never see the webfont (correct per spec); verify the fallback's design fidelity is acceptable; (d) **interaction with `<link rel="preload" as="font">`** — preloading a font with `font-display: swap` still produces a FOUT if the preload hasn't completed by first paint; the combination is not a FOUT eliminator.

**What to verify externally**:
- `font-display` value matches the design intent — `swap` / `fallback` for body copy (perceptual readability primacy), `block` for short brand-critical text where FOUT is unacceptable, `optional` only when a non-swap-after-block behavior is desirable
- CLS at the swap moment is below the 0.1 Core Web Vital threshold — measure via Chrome DevTools Performance panel with throttled network; if elevated, configure `size-adjust` / `ascent-override` / `descent-override` on the `@font-face` declaration
- Throttled-network rendering (Slow 3G profile) does not produce extended FOIT — verify that `block`-period images-of-text are not blocked for >100ms on the throttled profile
- `optional` deployments: first-visit fallback rendering is design-acceptable (the webfont may never render); test first-load and cached-load paths separately
- Glyph-range / unicode-range deployments: verify each `unicode-range` subset's `font-display` matches the parent design (mixed values across subsets is usually a bug)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display (Baseline widely available since January 2020; "Font block period" + "Font swap period" + "Font failure period" three-period model; per-value qualitative descriptors — "extremely small", "short", "infinite" — quoted verbatim, no numerical durations in spec)

**See also**: **VVT-007** for the broader font-loading-change trigger (`@font-face`, `<link rel="preload" as="font">`, font-package imports) — pair these whenever a new webfont is introduced; this trigger captures the `font-display` descriptor specifically while VVT-007 captures the rest of the font-loading surface. **Cross-catalog peer**: **VD-TYPE-06** (`visual-design/typography.md`) covers the aesthetic-baseline / web-font-loading-strategy rule that this runtime-verification trigger complements — VD-TYPE-06 defines the policy; VVT-053 is the runtime trigger when `font-display` declarations change.

**Suggested tooling**: Chrome DevTools-class Network panel (throttle profile) + Performance panel (CLS attribution at font-swap moment) | Lighthouse audit (CLS, "Ensure text remains visible during webfont load") | manual swap-moment screenshot diff

---

### VVT-054: CSS `prefers-reduced-motion` media-query handling — Baseline 2020

**Pattern (diff-observable)**:
- Content match: added or modified `@media (prefers-reduced-motion: reduce)` / `@media (prefers-reduced-motion)` / `@media (prefers-reduced-motion: no-preference)` blocks; new `window.matchMedia('(prefers-reduced-motion: reduce)')` listeners; motion library opt-outs (framer-motion `useReducedMotion`, react-spring `useReducedMotion`); the **absence** of a reduced-motion block when adjacent diff adds new animations (VVT-006 / VVT-006-adjacent additions without the paired media query)
- File/path match: any stylesheet, motion-component file, animation token file

**Why runtime verification is needed**: `prefers-reduced-motion` is a user-OS preference signal — the browser reports the user's accessibility setting, but the **site is responsible for actually honoring it**. Diff review shows the media-query block was authored but cannot reveal: (a) **completeness of coverage** — did every adjacent animation/transition addition gain a reduced-motion override, or did some slip through (motion-library-defaults + CSS-module animations + Web Animations API calls + framework-managed transitions all need separate handling); (b) **tone-down vs. remove** — community a11y best practice (a11y-project, web.dev, WAI APG) recommends replacing problematic motion with a *muted alternative* (opacity-only, color-only, faster-and-shorter) rather than simply disabling animations to instant or `animation: none`, so that state-change communication is preserved — MDN's own code example demonstrates this pattern (pulse → dissolve) but does not frame it as normative guidance; verify replacement animations preserve the design intent; (c) **CSS source-order specificity** — per MDN verbatim, "the CSS within the reduced motion rules, with the same specificity but coming later in the CSS source order, will take precedence" — the cascade resolves equal-specificity rules by source order; the reduced-motion block must either be authored at higher specificity than the default motion OR placed later at equal specificity, otherwise the override silently breaks; (d) **vestibular-trigger taxonomy** — scaling/panning of large objects are vestibular triggers; opacity/color changes typically are not — diff cannot distinguish trigger categories; (e) **JS-driven motion paths** — CSS `prefers-reduced-motion` does NOT automatically affect `element.animate()` calls or motion-library JS animations; explicit `matchMedia` checks must guard those paths separately; (f) **OS-level preference link** — the preference toggles in System Settings on macOS/Windows/iOS/Android — manual testing must enable the OS preference, not just spoof via DevTools (some browsers report the DevTools-spoofed value inconsistently across CSS vs. JS contexts).

**What to verify externally**:
- Toggle the OS-level reduced-motion preference (NOT just DevTools emulation) — every animation, transition, and JS-driven motion produces a reduced/replaced result
- Replacement motion preserves communication of state change (e.g., "this element became visible" — still convey via opacity or instant snap, not silently nothing)
- No vestibular-trigger motion (large-scale scaling / panning / parallax / autoplay zoom) reaches the screen when `reduce` is active
- JS-driven motion paths (`element.animate()`, framer-motion, react-spring, GSAP) explicitly check `matchMedia('(prefers-reduced-motion: reduce)').matches` and degrade
- Cascade integrity: reduced-motion blocks are authored AT a specificity ≥ the default motion blocks, OR placed later in source order at equal specificity — verify refactors don't silently break the override semantics
- Cross-OS verification: the preference label and toggle behavior differ across macOS / Windows / iOS / Android / Linux GNOME / Linux KDE — verify the implementation degrades on at least 2 platforms

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion (Baseline widely available since January 2020; "The `prefers-reduced-motion` CSS media feature is used to detect if a user has enabled a setting on their device to minimize the amount of non-essential motion"; "the CSS within the reduced motion rules, with the same specificity but coming later in the CSS source order, will take precedence"; OS-level toggle paths per platform)

**See also**: **VVT-006** for the broader animation/transition trigger — pair these whenever a new animation is added; VVT-006 flags the animation itself, this trigger flags the user-preference signal handling. **VVT-019** (`state-interaction.md`) for dialog / modal animations that typically need reduced-motion overrides for entry/exit transitions. **VVT-067** (`component-composition.md`) for HTML `<dialog>` + `.showModal()` — `<dialog>` entry/exit animations (including `::backdrop` animation) need explicit reduced-motion override blocks; required pairing whenever `<dialog>` ships with `@starting-style` or transition declarations. **VVT-037** (`modern-platform.md`) for CSS / JS view transitions — view transitions must degrade gracefully per `prefers-reduced-motion`. **VVT-039** (`modern-platform.md`) for popover entry/exit animations — same reduced-motion-override requirement. **VVT-048** for `@starting-style` entry transitions — top-layer entry animations need explicit reduced-motion override blocks; the default styles must remain accessible without the entry transition. **VVT-057** and **VVT-058** for `color-scheme` / `light-dark()` — sibling OS-preference handling triggers (same architectural pattern of "code responds to OS-level user preference"; the OS-preference family includes reduced-motion + color-scheme + contrast). **VVT-061** for `prefers-contrast` — sibling OS-preference media-query handling trigger. **VVT-062** (`accessibility-code.md`) for `forced-colors` — sibling OS-preference handling trigger covering Windows High Contrast Mode. **VVT-065** (`responsive.md`) for CSS scroll-snap — required pairing: scroll-snap is motion; reduced-motion users should not be forced into snap behavior. **VVT-069** for CSS scroll-driven animations (`animation-timeline`, `view-timeline`) — required pairing: scroll-driven animations are visually intense and MUST provide a reduced-motion alternative; pair these triggers whenever scroll-bound animation is added. **Cross-catalog peers**: **A11Y-033** (`accessibility/color-motion.md`, "Respect `prefers-reduced-motion`") + **A11Y-070** (same file, broader animation policy on COGA grounds) define the WCAG/COGA compliance policy; **VD-MOTION-03** (`visual-design/motion.md`, "prefers-reduced-motion (defer-to A11Y-033)") covers the aesthetic-baseline / motion-design intersection. VVT-054 is the **runtime-verification trigger** for code that has authored a `prefers-reduced-motion` block — it complements those policy rules, does not duplicate them.

**Suggested tooling**: Playwright-class browser automation with `page.emulateMedia({ reducedMotion: 'reduce' })` + animation-played assertions | manual OS-preference toggle test | aXe DevTools (motion-related rules) | Lighthouse audit ("Tap targets" and related a11y rules surface adjacent issues)

---

### VVT-057: CSS `color-scheme` property + `<meta name="color-scheme">` additions or changes — Baseline Widely available since January 2022

**Pattern (diff-observable)**:
- Content match: added or changed `color-scheme: <value>` CSS declaration on `:root` / `html` / `body` (values: `normal`, `light`, `dark`, `light dark`, `only light`, `only dark`); added or changed `<meta name="color-scheme" content="...">` in `<head>`
- File/path match: global stylesheets, theme tokens, `index.html` / app-shell `<head>`, design-system root styles

**Why runtime verification is needed**: `color-scheme` tells the UA which color schemes the page can render in — the UA then automatically adjusts UA-rendered chrome (canvas surface, scrollbars, form controls, spellcheck underlines, system colors). Diff review shows the declaration but cannot reveal: (a) **UA-default form-control rendering** changes wholesale (button background, checkbox shading, select dropdown, scrollbar thumb) when `color-scheme: dark` is in effect — verify form controls are still readable and consistent with the app's intended palette; (b) **scrollbar color** changes with the scheme — pages with custom-colored content may show a light scrollbar on dark backgrounds (or vice versa) without `color-scheme` set; (c) **`system-color` CSS values** (`Canvas`, `CanvasText`, `LinkText`, `ButtonFace`, etc.) computed values change with the active scheme — components using system-colors will swap colors automatically; (d) **FOUC / flash-on-load** — per MDN, `<meta name="color-scheme">` in `<head>` BEFORE the stylesheet prevents an unwanted screen-flash from light→dark during page load; verify the meta tag is present AND before CSS includes (`<link rel="stylesheet">`); (e) **iOS-specific behavior** — `color-scheme` respects OS-level light/dark setting; verify the iOS Safari rendering matches the intended scheme; (f) **does NOT theme custom CSS** — `color-scheme` only adjusts UA chrome + system-colors; custom CSS variables / theme tokens for the app's own content must still be authored separately (e.g., via `prefers-color-scheme` media query OR `light-dark()` — see VVT-058).

**What to verify externally**:
- Toggle the OS-level dark/light preference and verify: UA scrollbars + form-control rendering + spellcheck underlines update correctly in both schemes
- No FOUC / flash from light→dark on page load — verify `<meta name="color-scheme">` is present in `<head>` BEFORE any `<link rel="stylesheet">` / inline `<style>` blocks
- Form controls (`<input>`, `<button>`, `<select>`, `<textarea>`) render readably in BOTH schemes without forced-color-mode-style overrides
- Verify in iOS Safari + Android Chrome + desktop Chrome / Firefox / Safari — the system-colors mapping differs per UA
- Custom-themed content (CSS variables, design-token classes) remains correct — `color-scheme` does NOT theme the app's own content; verify the app's theming layer (via VVT-058 `light-dark()` OR `prefers-color-scheme` media query) is wired alongside

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme (per-feature page; Baseline banner verbatim: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since January 2022"; MDN verbatim on UA chrome: "User agents change the following aspects of the UI chrome to match the used color scheme" — listing canvas surface, scrollbars, form controls, spellcheck underlines; FOUC prevention verbatim: "Along with the above CSS, also include the `<meta name="color-scheme">` HTML `<meta>` tag in the `<head>`, before any CSS style information, to inform user agents about the preferred color scheme, helping prevent unwanted screen flashes during the page load")

**See also**: **VVT-008** for the broader color / contrast / theme-token-change trigger — pair these whenever a theme system is introduced; VVT-008 covers the design-token surface, VVT-057 covers the UA-chrome surface they BOTH should target. **VVT-058** for `light-dark()` — the canonical sibling that handles app-content theming the way `color-scheme` handles UA-chrome theming (requires VVT-057 to be set; pair these in the same atomic change). **VVT-054** for `prefers-reduced-motion` — sibling OS-preference media-query handling trigger (same architectural pattern of "code responds to OS-level user preference"). **VVT-061** for `prefers-contrast` — sibling OS-preference handling trigger. **VVT-062** (`accessibility-code.md`) for `forced-colors` — sibling OS-preference handling trigger covering Windows High Contrast Mode. **Cross-catalog peers**: **A11Y-071** (`accessibility/color-motion.md`, "Respect `prefers-color-scheme` for theme") — the policy rule that mandates respecting OS color-scheme preference; A11Y-071 explicitly cites `color-scheme: light dark` as required so UA-rendered form controls follow the app's dark theme. **VD-COLOR-05** (`visual-design/color.md`, "Dark-mode token coverage") — the design-token-coverage policy that defines what a dark-mode system requires; VVT-057 is the runtime-verification trigger for the UA-chrome side of that policy (VD-COLOR-05 defines token coverage for app content; VVT-057 flags UA-chrome coverage gaps).

**Suggested tooling**: Manual OS-preference toggle on macOS + Windows + iOS + Android (each renders UA chrome differently) | Playwright-class browser automation with `page.emulateMedia({ colorScheme: 'dark' })` + UA-chrome screenshot diff | Chrome DevTools-class in-browser inspection (Rendering panel → emulate CSS color-scheme)

---

### VVT-058: CSS `light-dark()` color function — Baseline 2024 Newly available since May 2024

**Pattern (diff-observable)**:
- Content match: added or modified `light-dark(<color>, <color>)` color-function usage in any CSS property accepting `<color>` (e.g., `color:`, `background-color:`, `border-color:`, `box-shadow:`); also accepts `<image>` arguments for gradient / `url()` switches
- File/path match: global stylesheets, theme files, CSS-in-JS template literals, design-token files migrating from `prefers-color-scheme` media queries to inline `light-dark()`

**Why runtime verification is needed**: `light-dark(L, D)` returns L when the active color scheme is light, D when dark — but ONLY when `color-scheme: light dark` is set on an ancestor (typically `:root`). MDN's verbatim normative wording: "To enable support for the `light-dark()` color function, the `color-scheme` must have a value of `light dark`, usually set on the `:root` pseudo-class." A `color-scheme: dark` alone is insufficient — the dual-value `light dark` is required. Diff review shows the function usage but cannot reveal: (a) **silent breakage when `color-scheme` is missing** — without `color-scheme` set, `light-dark()` returns its FIRST argument (the light variant) regardless of user preference, producing a forced-light experience that looks "broken in dark mode" with no error; (b) **Baseline 2024 Newly available** — Chrome 123 (March 2024), Safari 17.5 (May 2024), Firefox 120 (November 2023); pre-version browsers parse-error the `light-dark()` declaration and discard it per standard CSS cascade behavior — the property resolves to any preceding valid declaration for the same property (inherited / cascaded / authored-fallback). The canonical progressive-enhancement pattern is to declare a fallback color value BEFORE the `light-dark()` declaration in source order (e.g., `color: #333; color: light-dark(#333, #fff);`) so pre-Baseline browsers use the explicit fallback; verify the fallback path renders acceptably without `light-dark()` support; (c) **interaction with `prefers-color-scheme` media query** — `light-dark()` and `@media (prefers-color-scheme: dark)` can coexist but produce confusing layered behavior if both target the same selector; the migration path from media-query-based theming to `light-dark()` requires removing the old media-query blocks to avoid double-application; (d) **does NOT respect in-app theme toggle** — `light-dark()` reads the user-agent's color-scheme state (controlled by `color-scheme: light` / `dark` / `light dark`), NOT a JS-managed theme variable; in-app dark-mode toggles must change `color-scheme` (or write to a CSS variable layer) for `light-dark()` to follow; (e) **gradient / image variants are runtime-only** — `light-dark(url(light.png), url(dark.png))` switches the resource at runtime; verify both resources load + render without flash on scheme change.

**What to verify externally**:
- `color-scheme: light dark` (or appropriate value) is set on `:root` BEFORE any `light-dark()` usage takes effect — if missing, `light-dark()` silently returns its first argument and dark-mode appearance breaks
- Toggle OS-level dark/light preference: every `light-dark()` declaration updates to the correct variant at the property level
- Pre-Baseline browser fallback (Chrome <123, Safari <17.5, Firefox <120) renders acceptably — `light-dark()` is parse-error-discarded on these per CSS cascade; declare an explicit fallback BEFORE the `light-dark()` declaration in source order (e.g., `color: #333; color: light-dark(#333, #fff);`) and verify the fallback path
- In-app theme toggle (if implemented via JS): the toggle MUST change `color-scheme` for `light-dark()` to follow — verify a JS-managed `--theme-mode` variable does not silently bypass `light-dark()` resolution
- Co-existence with `@media (prefers-color-scheme: dark)` blocks: verify no double-application of theming (the migration to `light-dark()` should remove the old media-query blocks for the same selectors)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark (per-feature page; Baseline banner verbatim: "Baseline 2024 — Newly available — Since May 2024, this feature works across the latest devices and browser versions. This feature might not work in older devices or browsers"; MDN verbatim on the color-scheme prerequisite: "To enable support for the `light-dark()` color function, the `color-scheme` must have a value of `light dark`, usually set on the `:root` pseudo-class"; cleaner syntax than `@media` wrapping). Browser-version cross-reference: https://caniuse.com/mdn-css_types_color_light-dark (Chrome 123 March 2024, Safari 17.5 May 2024, Firefox 120 November 2023).

**See also**: **VVT-008** for the broader color / contrast / theme-token-change trigger — pair when migrating a token set from media-query-based theming to `light-dark()`. **VVT-057** for the `color-scheme` property — REQUIRED prerequisite; `light-dark()` is functionally a no-op (returns first arg) without `color-scheme: light dark` set. **VVT-054** for `prefers-reduced-motion` — sibling OS-preference media-query handling trigger (same architectural pattern of "code responds to OS-level user preference"). **Cross-catalog peers**: **A11Y-071** (`accessibility/color-motion.md`, "Respect `prefers-color-scheme` for theme") — the policy rule on respecting OS color preference; `light-dark()` is one of the canonical implementation mechanisms A11Y-071 allows (the other being `prefers-color-scheme` media query). **VD-COLOR-05** (`visual-design/color.md`, "Dark-mode token coverage") — the design-token-coverage policy; `light-dark()` is the canonical inline-pair implementation path for that policy (alternative to the dual-CSS-variable + media-query pattern).

**Suggested tooling**: Manual OS-preference toggle + screenshot diff (light vs dark) | Playwright-class browser automation with `page.emulateMedia({ colorScheme: 'dark' })` + per-element computed-style assertions | Chrome DevTools-class Rendering panel (emulate CSS color-scheme) | pre-Baseline browser test (Chrome <123, Safari <17.5, Firefox <120) for fallback verification

---

### VVT-060: CSS `accent-color` property additions or changes — Limited availability (progressive enhancement only)

**Pattern (diff-observable)**:
- Content match: added or modified `accent-color: <value>` CSS declaration (values: `auto`, `<color>` like `accent-color: #5729e9`, `accent-color: rebeccapurple`, etc.)
- File/path match: any stylesheet, design-token files, form-component styles, checkbox / radio / range / progress component styles

**Why runtime verification is needed**: `accent-color` tints the UA-rendered chrome of form controls — checkboxes, radios, range sliders, and progress bars — with the specified color. Per MDN, `accent-color` is **Limited availability** (NOT Baseline as of 2026-05). The MDN per-feature page Baseline classification reads: "Limited availability — This feature is not Baseline because it does not work in some of the most widely-used browsers." Diff review shows the declaration but cannot reveal: (a) **non-supporting browser fallback** — browsers without `accent-color` support render form controls with the UA's default accent color (typically OS-themed blue on macOS, Windows accent color, or Material green on Android Chrome); verify the fallback baseline is acceptable; (b) **per-control applicability** — per MDN, browsers that support `accent-color` currently apply it to checkboxes, radios, range, and progress; other form controls (`<select>`, `<button>`, text `<input>`) are currently unaffected; verify the styling intent matches the current applicability surface (the spec leaves room for future expansion); (c) **automatic foreground-color adjustment** — per MDN: "Each user agent has an accent color, with variations to ensure legibility and contrast." When `accent-color` is set to a color too close to white or to the background, UAs may adjust the check-mark / radio-dot foreground for contrast — verify the resulting rendering at extreme accent values; (d) **`auto` value behavior** — `accent-color: auto` per MDN: "Represents a UA-chosen color, which should match the accent color of the platform, if any" — varies by OS (Windows respects user's system accent color; macOS uses system blue/graphite); verify the OS-default rendering is acceptable; (e) **inheritance** — `accent-color` is inherited; setting on `:root` cascades to all form-control descendants unless overridden — verify nested overrides at component boundaries.

**What to verify externally**:
- Render in supporting browsers (Chromium-based, Firefox) AND non-supporting browsers (older / Safari may still be partial as of 2026-05) — verify the fallback default-accent baseline is acceptable
- Form-control applicability: only checkboxes, radios, range, progress receive the tint; other form controls render with UA default — verify the styling intent matches
- Extreme-value contrast: at near-white or near-background `accent-color`, the UA-adjusted check-mark / radio-dot remains legible (UA contrast adjustment per MDN)
- Cross-OS rendering of `accent-color: auto` (Windows respects system accent; macOS uses system blue; Android may use Material default) — verify the `auto` baseline matches design intent
- Form controls inside design-system components (e.g., custom-styled radio groups): if the component overrides `-webkit-appearance: none` or `appearance: none`, `accent-color` no longer applies — verify the appearance-stripped path uses custom styling separately

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/accent-color (per-feature page; Baseline classification verbatim: "Limited availability — This feature is not Baseline because it does not work in some of the most widely-used browsers"; applies to `<input type="checkbox">`, `<input type="radio">`, `<input type="range">`, `<progress>` per MDN; verbatim on UA contrast: "Each user agent has an accent color, with variations to ensure legibility and contrast"; verbatim on `auto`: "Represents a UA-chosen color, which should match the accent color of the platform, if any")

**See also**: **VVT-008** for the broader color / contrast / theme-token-change trigger — pair when adding `accent-color` to a design-token system; VVT-008 covers contrast verification, this trigger covers the per-control applicability + non-supporting-browser fallback. **VVT-057** for `color-scheme` — UA-chrome theming-related sibling; both are UA-chrome control surfaces. **VVT-066** for `appearance` — IMPORTANT pairing: `appearance: none` strips UA chrome including the form-control accent color, silently disabling `accent-color` on the same selector; use one or the other, not both with conflicting styling intent. **Cross-catalog peer**: none currently — no existing rule in `accessibility/` or `visual-design/` directly addresses `accent-color` per Step 0 semantic-equivalent grep (dev.89 lesson applied).

**Suggested tooling**: Playwright-class automation — Chromium / Firefox for supporting behavior; Safari for partial-support baseline | manual OS-accent-color toggle test (Windows system accent change; macOS Appearance > Accent color) | Chrome DevTools-class Computed-styles panel for cascade verification

---

### VVT-061: CSS `prefers-contrast` media-query handling — Baseline Widely available since May 2022

**Pattern (diff-observable)**:
- Content match: added or modified `@media (prefers-contrast: more)` / `@media (prefers-contrast: less)` / `@media (prefers-contrast: no-preference)` / `@media (prefers-contrast: custom)` blocks; new `window.matchMedia('(prefers-contrast: more)')` listeners
- File/path match: any stylesheet, theme-token file, accessibility-tier component styles

**Why runtime verification is needed**: `prefers-contrast` is a user-OS preference signal — the browser reports the user's accessibility setting (macOS Increase Contrast / Windows Contrast Themes / iOS Increase Contrast), but the **site is responsible for actually honoring it**. Diff review shows the media-query block was authored but cannot reveal: (a) **`more` rendering** — verify the `prefers-contrast: more` path produces higher-contrast text/border/outline at the actual contrast ratios users with low-vision need (the user-agent does NOT enforce a specific contrast ratio; the site author chooses what "more contrast" means in CSS); (b) **`less` rendering** — `less` is the inverse signal (some users with cognitive sensitivities prefer reduced contrast) — verify the `less` path produces softer rendering without losing minimum-readable contrast (still WCAG-AA-compliant); (c) **`custom` ↔ `forced-colors` relationship** — per MDN, the `custom` value "will match the color palette specified by users of `forced-colors: active`"; in practice `custom` is most commonly observed when the user is in Windows High Contrast mode — `prefers-contrast` then matches `custom` AND `forced-colors` matches `active`; verify both media-query paths render coherently; (d) **OS-level toggle path differs per platform** — macOS Settings > Accessibility > Display > Increase contrast; Windows Settings > Accessibility > Contrast themes; iOS Settings > Accessibility > Display & Text Size > Increase Contrast; verify on at least 2 OSes; (e) **interaction with `color-scheme` + `prefers-color-scheme`** — a user may have both Dark + Increase-contrast set; verify the `(prefers-color-scheme: dark) and (prefers-contrast: more)` combined-state renders coherently.

**What to verify externally**:
- Toggle OS-level Increase-Contrast preference (NOT just DevTools emulation) — every `prefers-contrast: more` block produces visible higher-contrast rendering; verify against measured contrast ratios (WCAG AAA 7:1 for normal text is the typical target for `more`)
- `prefers-contrast: less` path (if implemented) — verify softer rendering still meets minimum WCAG AA 4.5:1
- Combined state: OS Dark + Increase-Contrast simultaneously — verify the cascade of `prefers-color-scheme: dark` + `prefers-contrast: more` produces a coherent rendering (not just one or the other applied)
- Cross-OS verification: macOS / Windows / iOS each render the system Increase-Contrast toggle differently — verify at least 2 platforms
- `custom` value path: if Windows High Contrast user lands on the page, `prefers-contrast` matches `custom` AND `forced-colors` matches `active` — verify both media queries' rules apply coherently (typically the `forced-colors` rules override author-set colors per system palette)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast (per-feature page; Baseline banner verbatim: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since May 2022"; 4 values — `no-preference`, `more`, `less`, `custom`; per MDN verbatim, the `custom` value "will match the color palette specified by users of `forced-colors: active`")

**See also**: **VVT-008** for the broader color / contrast / theme-token-change trigger — pair when authoring contrast variants in a design-token system. **VVT-054** for `prefers-reduced-motion` — sibling OS-preference media-query handling trigger (same architectural pattern: "code responds to OS-level user preference"). **VVT-057** for `color-scheme` — sibling UA-chrome / theme handling; the `prefers-color-scheme` + `prefers-contrast` + `prefers-reduced-motion` family of OS-preference queries forms the user-preference-respecting accessibility surface. **VVT-062** (`accessibility-code.md`) for `forced-colors` — closely paired: `prefers-contrast: custom` matches when `forced-colors: active`; pair these triggers whenever either is added.

**Suggested tooling**: Manual OS-preference toggle (macOS / Windows / iOS each render Increase-Contrast differently) | Playwright-class browser automation with `page.emulateMedia({ forcedColors: 'active' })` — sets the system-color palette but the contrast-emulation primitive for `prefers-contrast` specifically may need direct `window.matchMedia` invocation | manual screenshot diff at each contrast level

---

### VVT-066: CSS `appearance` property additions or changes — Baseline Widely available since March 2022

**Pattern (diff-observable)**:
- Content match: added or modified `appearance: <value>` CSS declaration (standard values: `none`, `auto`, `menulist-button`, `textfield`, `base-select`; compat-auto values that behave as `auto`: `button`, `checkbox`, `radio`, `searchfield`, etc.); vendor-prefixed `-webkit-appearance: none` for older browser support; design-system resets that zero out UA form-control styling
- File/path match: any stylesheet, design-token files, form-component styles (button, input, select, textarea, checkbox, radio), CSS-reset stylesheets

**Why runtime verification is needed**: `appearance: none` strips UA-native form-control rendering — removing the visual checkmark on checkboxes, the radio dot, the select dropdown arrow, etc. — but the control remains functionally interactive. Diff review shows the declaration but cannot reveal: (a) **stripped affordance must be replaced** — `appearance: none` on a checkbox makes the control invisible; custom CSS MUST provide an alternative visual indicator for checked / unchecked / focused / disabled / hovered states; verify every interaction state has a custom rendering; (b) **interaction with `accent-color` (VVT-060)** — `accent-color` only applies to UA-rendered chrome; once `appearance: none` strips that chrome, `accent-color` is silently inert on the element; verify the styling intent (use `accent-color` for tinting OR `appearance: none` + custom styling, not both); (c) **`<select>` `appearance: base-select`** — newer value that allows full styling of `<select>` + `::picker(select)` pseudo-element; support is narrower than the broader `appearance` Baseline (MDN: "Some parts of this feature may have varying levels of support"); verify the rendered control matches design intent in target browsers; (d) **focus-indicator preservation** — UA form controls have built-in focus rings; `appearance: none` strips them; verify the element still meets WCAG 2.4.7 + 1.4.11 via custom `:focus-visible` styling (VVT-063 pairing); (e) **AT semantics preserved** — `appearance: none` does NOT change the underlying element's role / state / aria semantics; AT continues to announce `<input type="checkbox">` as a checkbox regardless of styling; verify the visual rendering matches the announced semantics (don't style a checkbox to look like a toggle without also updating the role); (f) **non-supporting-value fallback** — older browsers that don't recognize a specific `appearance` value (e.g., `base-select`) fall back to UA default; verify the fallback rendering is acceptable.

**What to verify externally**:
- Form control with `appearance: none` renders ALL interaction states with custom CSS: unchecked / checked / focus-visible / disabled / hover / active
- `:focus-visible` ring is present and meets WCAG 1.4.11 contrast (VVT-063 pairing)
- AT announcement matches visual rendering (a checkbox styled to look like a toggle still announces as "checkbox" unless `role` is updated)
- `accent-color` is NOT silently inert — if both `appearance: none` and `accent-color` are set, recognize that `accent-color` no longer applies and custom styling carries the color burden
- `appearance: base-select` deployments verified in target browsers; non-supporting browsers fall back acceptably
- Cross-browser parity: appearance reset behavior verified across Chrome / Safari / Firefox / Edge (each has slightly different default UA chrome to strip)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/appearance (per-feature page; Baseline banner verbatim: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since March 2022"; with note "Some parts of this feature may have varying levels of support" — the `base-select` value and `::picker(select)` pseudo-element are newer than the broader `appearance` Baseline)

**See also**: **VVT-008** for the broader color / contrast / theme-token-change trigger — pair when custom form-control styling introduces a design-token color set. **VVT-060** for `accent-color` — REQUIRED pairing check: `appearance: none` silently disables `accent-color` because `accent-color` applies only to UA-rendered chrome; if both declarations are present on the same selector, the styling intent must be reconciled (use one or the other, not both). **VVT-063** (`state-interaction.md`) for `:focus-visible` — REQUIRED pairing: stripping UA chrome removes the native focus ring; custom `:focus-visible` styling MUST replace it. **VVT-026** (`accessibility-code.md`) for ARIA attribute changes — `appearance: none` does NOT change role/state semantics; if the visual rendering implies a different role (checkbox styled as toggle), the ARIA must be updated. **Cross-catalog peers**: **A11Y-030** (`accessibility/keyboard-focus.md`, WCAG 2.4.7) — the focus-outline-replacement policy authority; `appearance: none` removes native focus rings and triggers A11Y-030's requirement directly. **A11Y-038** (same file, WCAG 2.4.13 AAA) — focus-indicator thickness/contrast policy for the custom focus ring that must replace the stripped UA chrome. **IS-005** (`interaction-states/buttons-ctas.md`) — the interaction-state-inventory authority for focus visibility on all interactive controls; `appearance: none` on a form control directly triggers this policy.

**Suggested tooling**: Manual interaction-state walk (unchecked → checked → focused → disabled → hover) | Playwright-class browser automation with state-permutation screenshot diff | screen-reader manual test (VoiceOver / NVDA) for semantics-vs-rendering mismatch | aXe DevTools (form-control labeling rules)

---

### VVT-068: CSS `oklch()` / `oklab()` perceptually-uniform color functions — Baseline Widely available since May 2023

**Pattern (diff-observable)**:
- Content match: added or modified `oklch(<L> <C> <H>[ / <alpha>])` or `oklab(<L> <a> <b>[ / <alpha>])` declarations in any CSS property accepting `<color>` (e.g., `color:`, `background-color:`, `border-color:`, `outline-color:`, `box-shadow:`, `fill:`, `stroke:`, gradient color stops, `color-mix()` arguments, custom-property values); also `lch()` / `lab()` companion-syntax declarations covered by the same Baseline classification family
- File/path match: global stylesheets, design-token files (`tokens.*`, `theme.*`, `colors.*`), CSS-in-JS template literals, theme files migrating from `rgb()` / `hsl()` to perceptually-uniform color spaces

**Why runtime verification is needed**: `oklch()` and `oklab()` express colors in a perceptually uniform color space — equal numerical steps correspond to equal perceived steps in lightness/chroma/hue, unlike `hsl()` where equal hue degrees produce wildly unequal perceived steps. Per MDN `oklch()` per-feature page, the function "expresses a given color in the Oklab color space" with the cylindrical form `oklch(L C H)`. Diff review shows the function call but cannot reveal: (a) **out-of-sRGB-gamut rendering** — Oklab/Oklch can express colors outside the sRGB gamut (the chroma `C` accepts values up to ~0.4, far beyond what sRGB can render); on sRGB-only displays the UA performs gamut mapping (typically by clipping chroma while preserving lightness/hue per the CSS Color 4 spec) — the rendered color may differ visibly from the authored intent. Verify on both sRGB displays and wide-gamut (P3 / Rec2020) displays; (b) **hue angle differs from `hsl()`** — per MDN the hue is "the same as the hue angles in `lch()`" — `oklch(50% 0.4 0)` is RED-ish (not the pure red `hsl(0deg 100% 50%)` produces); authors migrating from HSL must verify each hue value, since the same numerical hue produces a perceptually different color. Migration scripts (`hsl → oklch`) require per-color verification, not blind substitution; (c) **lightness perception differs from HSL** — `oklch(50% ...)` is perceptually middle-grey; `hsl(... 50%)` is NOT perceptually middle-grey (yellow at hsl 50% is much brighter-perceived than blue at hsl 50%). The migration produces visually different palettes even at "same lightness"; verify that the design intent is preserved; (d) **chroma clipping on grayscale and pastels** — very low chroma values (`oklch(50% 0.01 240)`) round-trip differently across UAs/displays — verify near-gray and pastel rendering; (e) **contrast at perceived-uniform lightness** — perceptually-uniform lightness is the SELLING POINT of OKLCH for design systems: building a palette where `oklch(70% 0.1 H)` produces consistent perceived contrast across all hues against a fixed background. Verify computed contrast ratios still meet WCAG (4.5:1 normal text, 3:1 large/UI) — perceptual uniformity is NOT the same as WCAG contrast (WCAG uses relative luminance, not Oklab L*); the two can diverge; (f) **`color-mix()` integration** — `color-mix(in oklch, c1, c2 50%)` mixes in Oklch space and produces different results than `in srgb` or `in hsl`; verify mixed palette colors render as intended; (g) **fallback declaration order** — older browsers (pre-Baseline May 2023) parse-error `oklch()` and discard the declaration, falling back to any preceding valid declaration per CSS cascade. Verify fallback path: `color: rgb(...); color: oklch(...);` ensures pre-Baseline browsers use the rgb fallback. Authors using oklch in CSS variables (`--brand: oklch(...);`) MUST also provide a fallback variable layer or accept the variable resolves to the initial value (`invalid value` → unset → cascades to parent or default).

**What to verify externally**:
- Rendered color on sRGB displays (most laptops, most external monitors) matches design intent — UA gamut-mapping clip behavior is acceptable
- Rendered color on wide-gamut displays (modern MacBook Pro, iPhone, iPad with P3 support) extends correctly into the wider gamut where the authored color is outside sRGB
- Computed contrast (use Chrome DevTools color picker → contrast ratio inspector, or aXe DevTools) meets WCAG AA for the palette pairs used together — perceptual uniformity is NOT the same as WCAG contrast
- Migration from HSL/RGB: side-by-side comparison with prior palette confirms intended perceptual hue/lightness shifts; no accidental hue drift on familiar colors (brand red, signal blue)
- Fallback render on pre-Baseline browsers (older Edge, IE11 if still in scope) renders the rgb/hsl fallback — verify the declaration order in computed styles
- `color-mix()` and gradient stops using oklch render smoothly without banding across the hue arc
- Dark-mode palette parity: oklch colors used in light AND dark tokens maintain consistent perceived weight across themes

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch (per-feature page; Baseline banner verbatim: "Baseline Widely available" with asterisked caveat-footnote "Some parts of this feature may have varying levels of support" + descriptor sentence "This feature is well established and works across many devices and browser versions. It's been available across browsers since May 2023"; the asterisk superscript marks "Some parts" as a footnote-on-the-banner, not a fourth declarative sentence. Companion `oklab()` per-feature page at `Web/CSS/color_value/oklab` carries the identical Baseline classification since May 2023.

**See also**: **VVT-008** for the broader "Color, contrast, or theme-token changes" trigger — VVT-068 is the specific oklch/oklab trigger; pair with VVT-008 for migration of an entire design-token palette. **VVT-058** for the sibling Color 4 function `light-dark()` — both are Color 4 modern color-syntax additions; commonly co-occur in dark-mode-aware design systems (`color: light-dark(oklch(20% 0.05 240), oklch(95% 0.05 240));`). **VVT-057** for `color-scheme` — REQUIRED prerequisite when oklch colors are used inside `light-dark()`. **VVT-060** for `accent-color` — accepts oklch values; pair when migrating accent-color tokens. **Cross-catalog peers**: **VD-COLOR-08** (`visual-design/color.md`, "Modern CSS color syntax") — the design-system-discipline authority that explicitly names `oklch()` / `lab()` / `color()` as preferred modern color syntax; VVT-068 is the runtime-verification trigger for the rendered output of those functions. **VD-COLOR-09** (same file, "Color contrast at token level (compliance is runtime-deferred)") — perceptually uniform palettes built with oklch must still validate at WCAG contrast ratios per token pair. **VD-COLOR-07** (same file, "Gradient stop choice") — gradient stops using oklch produce visibly different interpolation than rgb/hsl gradients; relevant runtime check.

**Suggested tooling**: Chrome DevTools-class color picker with gamut-mapping toggle (compare sRGB-clip vs P3 rendering) | side-by-side display comparison on sRGB + wide-gamut monitors | aXe DevTools / WAVE / WebAIM Contrast Checker (verify WCAG contrast on all palette pairs) | Playwright-class browser automation with `getComputedStyle().color` introspection to verify resolved values match expected oklch

---

### VVT-069: CSS scroll-driven animations (`animation-timeline`, `scroll-timeline-name`, `view-timeline-name`) — Limited availability (progressive enhancement only)

**Pattern (diff-observable)**:
- Content match: added or modified `animation-timeline: <name | scroll() | view()>` declarations; `scroll-timeline-name`, `scroll-timeline-axis`, `view-timeline-name`, `view-timeline-axis`, `view-timeline-inset` properties; shorthand `scroll-timeline:` / `view-timeline:` declarations; `@keyframes` referenced from a scroll-driven animation; `animation-range-start` / `animation-range-end` declarations bound to scroll progress
- File/path match: global stylesheets, component-level CSS modules, scroll-driven UI files (`scroll-progress.*`, `parallax.*`, `reveal.*`, `*-animation.*`), CSS-in-JS template literals containing `animation-timeline` or `scroll()` / `view()` timeline functions

**Why runtime verification is needed**: Scroll-driven animations bind animation progress directly to scroll position rather than time, eliminating the need for IntersectionObserver-orchestrated JavaScript for many reveal / parallax / progress-bar patterns. Per MDN `animation-timeline` per-feature page, the property specifies the timeline used to control the progress of a CSS animation. Diff review shows the property declaration but cannot reveal: (a) **scroll-progress mapping correctness** — `animation-timeline: scroll()` binds to the document's scroll progress by default; the scroller can be customized via `animation-timeline: scroll(<scroller> <axis>)`; verify the correct scroller is observed (the document, a specific named scroller, or a nearest-ancestor scroll-container); (b) **view-timeline subject visibility window** — `animation-timeline: view()` binds to the % of the viewport occupied by a specific subject element; `view-timeline-inset` offsets the start/end thresholds; verify the subject enters/exits the timeline window at the visually-intended scroll positions; (c) **`animation-range-start` / `animation-range-end` boundary mapping** — the animation can be constrained to a sub-range of the timeline (e.g., `cover 0%` to `cover 100%` of the view-timeline) — visually verify the start + end correspond to the intended visual milestones; (d) **fallback rendering without scroll-driven animation support** — pre-Limited-availability browsers (current Safari stable, current Firefox stable as of 2026-05) parse-error `animation-timeline`; the animation falls back to the default `animation-timeline: auto` (time-based) — if `@keyframes` defines `from { opacity: 0 }` to `to { opacity: 1 }` and `animation-duration: 1s` is also set, the fallback plays-once-on-load instead of binding-to-scroll; verify the fallback path is visually acceptable OR use `@supports (animation-timeline: scroll())` to gate the scroll-driven block; (e) **`prefers-reduced-motion` honoring** — REQUIRED per A11Y-070 / A11Y-033 / VD-MOTION-03: wrap scroll-driven animation in `@media (prefers-reduced-motion: no-preference) { ... }` OR provide a reduced-motion alternative inside `@media (prefers-reduced-motion: reduce) { ... }`; verify the reduced-motion path renders without scroll-bound animation; (f) **compositor performance under scroll** — scroll-driven animations CAN run on the compositor without main-thread work IF only GPU-friendly properties (transform / opacity) animate per VD-MOTION-04; layout-affecting properties (height, width, top) cause main-thread jank during scroll — verify scroll fps in DevTools Performance panel; (g) **nested-scroller behavior** — when the subject is inside a nested scroll container, `view()` defaults to the nearest scroll-container ancestor; verify the correct scroller is observed (matches the visual scroll the user perceives, not an enclosing overflow container); (h) **animation-range timeline keywords + percentages** — `animation-range: entry 0% exit 100%` and named-range syntax differ from time-based animation semantics; verify the keyword semantics produce the expected start/end positions.

**What to verify externally**:
- Scroll the affected page and verify the animation progresses with scroll (not time-bound) — manually scroll back and animation reverses correctly
- Verify on a browser without scroll-driven animation support (Safari stable / Firefox stable) — fallback path renders acceptably (typically: animation either plays-once-on-load or is gated by `@supports` and does not render at all)
- Test with `prefers-reduced-motion: reduce` enabled in OS / Chrome DevTools Rendering tab — scroll-bound animation does NOT play; the reduced-motion alternative renders correctly (per A11Y-033 / A11Y-070)
- DevTools Performance panel: scroll the page while recording — verify scroll fps stays above 50fps; compositor-only animation produces minimal main-thread work
- Verify `view-timeline` subjects enter/exit at intended scroll positions on multiple viewport sizes (mobile, tablet, desktop) — `view-timeline-inset` thresholds may need adjustment per viewport
- Verify nested-scroller scenarios (sticky headers, modal-with-internal-scroll) bind to the intended scroller, not the document

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline (per-feature page; Baseline banner verbatim: "Limited availability" + "This feature is not Baseline because it does not work in some of the most widely-used browsers." — the feature is progressive-enhancement-only as of 2026-05 with stable support in Chromium-based browsers only. Definition verbatim: "The `animation-timeline` CSS property specifies the timeline used to control the progress of a CSS animation.")

**See also**: **VVT-006** for the broader "New or modified animations / transitions" trigger — VVT-069 is the specific scroll-driven animation trigger; pair with VVT-006 for animations that mix time-based and scroll-based timelines. **VVT-045** (`framework-observer.md`) for `IntersectionObserver`-driven UI — the JavaScript alternative pattern that scroll-driven animations replace for many reveal / progress-bar patterns; teams migrating from IntersectionObserver-based scroll-reactive UI to scroll-driven animations should re-verify both before/after rendering. **VVT-054** for `prefers-reduced-motion` — REQUIRED to honor reduced motion per A11Y-033 / A11Y-070 / VD-MOTION-03; scroll-driven animations are visually intense and MUST provide a reduced-motion alternative. **Cross-catalog peers**: **A11Y-033** (`accessibility/color-motion.md`, "Respect `prefers-reduced-motion`") — the user-agent-level accessibility primitive that scroll-driven animations MUST honor. **A11Y-070** (same file, "Respect `prefers-reduced-motion` for animations") — the animation-specific reinforcement. **VD-MOTION-03** (`visual-design/motion.md`, "prefers-reduced-motion (defer-to A11Y-033)") — the visual-design discipline pointer. **VD-MOTION-04** (same file, "GPU-only animated properties") — scroll-driven animations on layout-affecting properties cause main-thread jank during scroll; pair with VD-MOTION-04 to verify only GPU-friendly properties animate. **VD-MOTION-06** (same file, "Animation jank from layout-triggering CSS") — adjacent runtime check for scroll-bound animations on width / height / top.

**Suggested tooling**: Chrome DevTools Performance panel (record scroll, verify fps + compositor activity) | Chrome DevTools Rendering tab `Emulate CSS media feature prefers-reduced-motion` toggle | Playwright-class browser automation with `page.evaluate(() => window.scrollTo(0, N))` + screenshot at multiple scroll positions | manual cross-browser test on Safari stable + Firefox stable for fallback path

---

### VVT-070: CSS `@scope` at-rule — Baseline 2025 Newly available since December 2025

**Pattern (diff-observable)**:
- Content match: added or modified `@scope (<scope-root>)` or `@scope (<scope-root>) to (<scope-limit>)` declarations; CSS rules nested inside `@scope { ... }` blocks; `:scope` pseudo-class references inside `@scope` rules; scoped selector usage replacing BEM-style class naming or CSS Modules
- File/path match: global stylesheets, component-level CSS modules, design-system files (`tokens.*`, `theme.*`), CSS-in-JS template literals migrating from compound-class naming to native scoping

**Why runtime verification is needed**: `@scope` enables selector scoping within DOM subtrees without depending on JavaScript-injected scope IDs (the mechanism CSS Modules and Vue scoped styles use). Per MDN `@scope` per-feature page, the at-rule enables you to select elements in specific DOM subtrees, targeting elements precisely without writing overly-specific selectors that are hard to override, and without coupling your selectors too tightly to the DOM structure. Diff review shows the `@scope` declaration but cannot reveal: (a) **inheritance leakage outside scope boundaries** — per MDN: "It is important to understand that, while `@scope` allows you to isolate the application of selectors to specific DOM subtrees, it does not completely isolate the applied styles to within those subtrees. This is most noticeable with inheritance — properties that are inherited by children (for example `color` or `font-family`) will still be inherited, beyond any set scope limit." — visually verify that inherited properties set inside the scope do NOT cascade past the scope-limit to siblings or unscoped descendants; (b) **scope-limit specification correctness** — `@scope (.card) to (.card-children)` confines styles to `.card` descendants up to but not including `.card-children` descendants — verify the limit selector matches the intended boundary in the live DOM, not just the conceptual boundary in the spec; (c) **scoping-proximity cascade-tier interaction with specificity + `@layer`** — per MDN's `@scope` Specificity section: "Inside an `@scope` rule, both bare selectors and the `&` nesting selector behave as if `:where(:scope)` were prepended to the selector. Because `:where()` has zero specificity, bare selectors and `&` add zero weight." Explicit `:scope` references add 0-1-0 specificity (pseudo-class); the scope-root selector itself does NOT contribute to inner-rule specificity. Per MDN's How `@scope` conflicts are resolved section: scoping proximity is a NEW cascade criterion that "overrules source order but is itself overridden by other, higher-priority criteria such as importance, layers, and specificity." Full cascade order (lowest to highest priority): source order → scoping proximity → specificity → layers → importance. When `@scope` co-occurs with `@layer` (per VVT-033), the common surprise is that `@scope` does NOT shield scoped rules from cross-layer specificity wars — a higher-specificity selector outside the scope (or in a later-cascading `@layer`) still wins. Verify computed styles in DevTools Cascade panel to confirm the intended rule wins; (d) **`:scope` pseudo-class binding** — inside `@scope`, `:scope` references the scope-root element; verify `:scope` selectors target the intended root (not the implicit descendant); (e) **fallback for pre-Baseline browsers** — pre-Baseline-Dec-2025 browsers parse-error `@scope` and discard the entire scoped block; verify the fallback render is visually acceptable OR gate behind `@supports at-rule(@scope) { ... }`; (f) **media-query nesting interaction** — `@scope` can contain `@media`, and `@media` can contain `@scope`; verify the cascade behavior is intended when nesting is multi-level; (g) **JavaScript-driven DOM mutation impact** — when a scope-root is dynamically added/removed (React conditional rendering, framework hydration), the scoped styles activate/deactivate at runtime; verify hydration flicker is acceptable; (h) **migration from BEM / CSS Modules** — teams migrating from `.card__title` (BEM) or `.title_abc123` (CSS Modules) to `@scope (.card) { .title { ... } }` must verify equivalent visual rendering — `@scope`'s implicit descendant matching differs subtly from BEM's compound-class matching.

**What to verify externally**:
- Apply the scoped styles in a live browser and verify the visual rendering matches the intent — particularly that inheritance (color, font-family) does NOT leak past the scope-limit to unscoped descendants
- DevTools Cascade panel: inspect a scoped element and verify the `@scope` rule wins over global styles per intended specificity
- Verify on a pre-Baseline browser (e.g., older Safari version or browser-stack equivalent) — fallback renders acceptably OR the `@supports at-rule(@scope)` gate correctly excludes the block
- Test SPA navigation / conditional rendering — adding + removing a scope-root mid-session activates/deactivates the scoped styles without flicker
- Cross-component verification: scoped styles intended for component A do not leak into nested component B inside the same scope-root

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/@scope (per-feature page; Baseline banner verbatim: "Baseline 2025" + "Newly available" + "Since December 2025, this feature works across the latest devices and browser versions. This feature might not work in older devices or browsers." Definition verbatim: "The `@scope` CSS at-rule enables you to select elements in specific DOM subtrees, targeting elements precisely without writing overly-specific selectors that are hard to override, and without coupling your selectors too tightly to the DOM structure." Inheritance-leakage Note verbatim: "It is important to understand that, while `@scope` allows you to isolate the application of selectors to specific DOM subtrees, it does not completely isolate the applied styles to within those subtrees. This is most noticeable with inheritance — properties that are inherited by children (for example `color` or `font-family`) will still be inherited, beyond any set scope limit.")

**See also**: **VVT-033** (`modern-platform.md`) for CSS cascade layers (`@layer`) — `@scope` and `@layer` are both cascade-control primitives; commonly co-occur in design-system stylesheets; verify the computed-style winner when both are active. **VVT-032** (`modern-platform.md`) for CSS `:has()` selector — `:has()` and `@scope` both enable DOM-structure-aware selector patterns; pair when migrating from JS-driven scoping. **VVT-041** (`modern-platform.md`) for CSS native nesting (`& selector`) — nesting inside `@scope` blocks is the idiomatic authoring pattern; verify nested-selector resolution under scope. **Cross-catalog peers**: no direct peer-rule pairing in `visual-design/*` or `accessibility/*` per Step 0 semantic-equivalent grep (dev.89 lesson applied) — `@scope` is a CSS authoring / cascade primitive without direct UX or accessibility-discipline implications beyond what existing cascade-discipline rules already cover.

**Suggested tooling**: Chrome DevTools Cascade panel (verify rule resolution) | Playwright-class browser automation with `getComputedStyle()` introspection on scoped + unscoped sibling elements | manual cross-browser test on pre-Dec-2025-Baseline browsers for fallback path

---

### VVT-071: CSS `interpolate-size` property — Limited availability (progressive enhancement only)

**Pattern (diff-observable)**:
- Content match: added or modified `interpolate-size: allow-keywords;` declarations (typically on `:root`, `html`, or component-scoped rules); CSS animations / transitions whose `height`, `width`, `block-size`, or `inline-size` end-states reference `auto`, `min-content`, `max-content`, `fit-content`, or `content` keywords; expand / collapse / accordion patterns relying on intrinsic-size interpolation rather than fixed-pixel or `max-height` tricks
- File/path match: global stylesheets that opt-in via `:root { interpolate-size: allow-keywords; }`, component CSS for collapsible / disclosure widgets, design-system motion primitives

**Why runtime verification is needed**: `interpolate-size` opts-in to interpolation between a `<length-percentage>` value and an intrinsic-size keyword (`auto`, `min-content`, `max-content`, `fit-content`, `content`) — a behavior that historically required JavaScript-driven `height: <measured-px>` workarounds. Per MDN's `interpolate-size` per-feature page Note: "The behavior opted-into by `interpolate-size` cannot be enabled by default across the web because many sites in the wild use stylesheets that assume intrinsic size values cannot be animated. Enabling it by default would cause several backwards-compatibility issues". Diff review shows the declaration but cannot reveal: (a) **interpolation constraint enforcement** — per MDN's `interpolate-size` per-feature page: "Setting `interpolate-size: allow-keywords` enables interpolation between a `<length-percentage>` value and an intrinsic size value. Note that it does not enable animating between two intrinsic size values. One end of the animation must be a `<length-percentage>`." — verify the animation's start and end states satisfy this constraint or the interpolation silently fails to a discrete jump; (b) **pre-Baseline-browser fallback rendering** — per the MDN per-feature page's "Limited availability" banner: "This feature is not Baseline because it does not work in some of the most widely-used browsers." — in unsupported browsers, the animation jumps directly from the start state to the end state without interpolating; verify the fallback discrete-jump is visually acceptable or wrap behind `@supports (interpolate-size: allow-keywords) { ... }`; (c) **inherited opt-in scope** — `interpolate-size` is inherited; setting it on `:root` enables interpolation site-wide, but a descendant rule can override it with `interpolate-size: numeric-only` — verify the opt-in surface matches intent (site-wide vs. component-scoped); (d) **`prefers-reduced-motion` interaction** — `interpolate-size`-enabled height/width animations are still motion under the WCAG 2.3.3 / COGA O5/O8 scope (VVT-054 / A11Y-033 / A11Y-070 / VD-MOTION-03); verify the reduced-motion override either disables the animation or shortens it under the user preference; (e) **CSS-property animation compatibility** — `interpolate-size` only affects size properties (`height`, `width`, `block-size`, `inline-size`, `min-*`, `max-*`); verify that side-effect properties like `padding`, `margin`, `border`, and computed-style observers in JS report the interpolated intermediate values as expected; (f) **`@starting-style` interaction** (VVT-048) — entry animations on newly-rendered or transitioned-from-`display: none` elements need `@starting-style` to define the start value; verify the combination works for both the initial render and subsequent toggles; (g) **layout-thrash performance** — interpolating from `0` to `auto` forces a layout calculation per frame to resolve the intrinsic-size end-state; verify there is no measurable jank on long lists, deep DOM trees, or low-end devices.

**What to verify externally**:
- Apply the rule in a live browser supporting `interpolate-size` and verify smooth interpolation between `<length>` and intrinsic-size values
- DevTools Performance panel: record the animation under a 4× CPU throttle and verify there is no main-thread layout jank
- Cross-browser test on a pre-Baseline browser (e.g., older Firefox or Safari version) — fallback discrete jump renders acceptably OR `@supports` gate excludes the rule
- Test under `prefers-reduced-motion: reduce` — animation is disabled, shortened, or replaced with a discrete state change per A11Y-033 / A11Y-070 policy
- Verify inheritance scope: a descendant set to `interpolate-size: numeric-only` correctly opts out

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/interpolate-size (per-feature page; Baseline banner verbatim: "Limited availability" + "This feature is not Baseline because it does not work in some of the most widely-used browsers." Property purpose verbatim: "The `interpolate-size` CSS property allows you to enable animations and transitions between a `<length-percentage>` value and an intrinsic size, `fit-content`, or `max-content`.")

**See also**: **VVT-006** for the broader "New or modified animations / transitions" trigger — `interpolate-size`-enabled animations are a subset; pair when an animation references an intrinsic-size keyword. **VVT-048** for `@starting-style` — combination needed for entry animations on `display: none` → visible elements. **VVT-054** for `prefers-reduced-motion` — REQUIRED to honor reduced motion per A11Y-033 / A11Y-070 / VD-MOTION-03. **VVT-069** for scroll-driven animations — both are motion-discipline-bound. **Cross-catalog peers**: **A11Y-033** (`accessibility/color-motion.md`, "Respect `prefers-reduced-motion`") — user-agent-level accessibility primitive. **A11Y-070** (same file, "Respect `prefers-reduced-motion` for animations") — animation-specific reinforcement. **VD-MOTION-03** (`visual-design/motion.md`, "prefers-reduced-motion (defer-to A11Y-033)") — visual-design discipline pointer.

**Suggested tooling**: Chrome DevTools Performance panel (verify no layout jank during interpolation) | Chrome DevTools Rendering tab `Emulate CSS media feature prefers-reduced-motion` toggle | Playwright-class browser automation with frame-by-frame screenshot at multiple animation positions | manual cross-browser test on pre-Baseline browsers for fallback path

---

### VVT-072: CSS `text-spacing-trim` property — Limited availability (progressive enhancement only)

**Pattern (diff-observable)**:
- Content match: added or modified `text-spacing-trim` declarations (`normal`, `space-all`, `space-first`, `trim-start`); CJK (Chinese / Japanese / Korean) text rendering changes; typography overrides on `body`, `article`, `.prose`, or language-specific selectors (`:lang(ja)`, `:lang(zh)`, `:lang(ko)`)
- File/path match: typography stylesheets, internationalization (i18n) CSS modules, design-system text primitives for multi-script support

**Why runtime verification is needed**: `text-spacing-trim` controls full-width CJK punctuation spacing — a feature that visually impacts line-start, line-end, and inter-character kerning in CJK text. Diff review shows the declaration but cannot reveal: (a) **font-feature dependency** — per MDN's `text-spacing-trim` per-feature page: "To avoid the risk of excessive kerning, fonts must have the OpenType Alternate Half Widths (`halt`) feature, the Contextual Half-width Spacing (`chws`) feature, or both. If the font doesn't have either feature, `text-spacing-trim` is disabled." — verify the loaded font actually has the required OpenType feature, otherwise the property is silently disabled and the rendering does not change; (b) **Limited-availability fallback** — per the MDN per-feature page's "Limited availability" banner: "This feature is not Baseline because it does not work in some of the most widely-used browsers." — verify the rendering in unsupported browsers (the property is ignored and default UA spacing applies); (c) **value-semantic interpretation** — the four supported values (`normal`, `space-all`, `space-first`, `trim-start`) produce visually distinct line-start and line-end punctuation behavior; verify the chosen value matches the intended typographic rule (e.g., `normal` collapses spacing between adjacent punctuation while `space-all` preserves full-width); (d) **partial-value-set support drift** — per MDN: "The CSS Text module also defines `trim-both`, `trim-all`, and `auto` values. However, these are not currently implemented in any browser." — if code references these values, they fall back to UA default rendering with no warning; (e) **mixed-script line breaking** — CJK text frequently mixes with Latin script (English brand names, numerals, technical terms); verify line breaks at the script boundary render acceptably with the chosen `text-spacing-trim` value; (f) **justified text interaction** — `text-align: justify` redistributes line-end spacing; verify the combination produces the intended visual outcome; (g) **language-tag scope** — applying `text-spacing-trim` site-wide vs. behind `:lang(ja)` / `:lang(zh)` / `:lang(ko)` selectors has different blast radius; verify Latin-script content is not unexpectedly affected.

**What to verify externally**:
- Apply the rule in a live browser supporting `text-spacing-trim` with a CJK font that has the required OpenType `halt` / `chws` features
- Visually compare line-start, line-end, and inter-punctuation spacing against the design intent
- Cross-browser test on a pre-Baseline browser (e.g., Firefox stable as of January 2026) — verify the fallback UA default rendering is visually acceptable
- Mixed-script test: render a paragraph with CJK + Latin text and verify the script-boundary line-break renders correctly
- Justified-text test: combine with `text-align: justify` and verify line-end spacing is consistent

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/text-spacing-trim (per-feature page; Baseline banner verbatim: "Limited availability" + "This feature is not Baseline because it does not work in some of the most widely-used browsers." Property purpose verbatim: "The `text-spacing-trim` CSS property controls the internal spacing set on Chinese/Japanese/Korean (CJK) punctuation characters between adjacent characters (kerning) and at the start or end of text lines.")

**See also**: **VVT-007** for the broader "Font, font-family, or font-loading changes" trigger — `text-spacing-trim` depends on OpenType font features; pair when changing the active CJK font family. **VVT-050** for `text-wrap: balance` / `text-wrap: pretty` — both are typography-layer triggers; commonly co-occur in design-system text primitives. **VVT-053** for `font-display` — both interact with font loading; verify the fallback font during the `font-display: swap` window also has the required OpenType features. **Cross-catalog peers**: **A11Y-003** (`accessibility/document-language.md`, "Language change within content needs `lang` attribute") — VVT-072's runtime concern (g) names `:lang(ja)` / `:lang(zh)` / `:lang(ko)` selectors as the primary scoping mechanism for CJK-specific text-spacing-trim application; the CSS `:lang()` pseudo-class matches only when the corresponding HTML `lang` markup is present per A11Y-003's WCAG 3.1.2 policy. Pair when language-scoped text-spacing-trim is authored to verify the supporting HTML `lang` attributes are present at the fragment level (otherwise `:lang()` selectors silently fail to match and the property does not apply). **COMP-WCAG-AAA-02** (`compliance/wcag-aaa.md`, "Visual presentation of text blocks") — WCAG 2.1 AAA 1.4.8 sub-requirement 2 caps line width at 80 characters / glyphs (40 if CJK); pair when text-spacing-trim is applied to CJK content to verify the line-width cap is also satisfied. **COMP-WCAG-AAA-03** (`compliance/wcag-aaa.md`, "Avoid images-of-text except for pure-decoration or essential-presentation") — WCAG 2.1 AAA 1.4.9 mandates live text (vs bitmap images of text); pair when CJK live-text rendering relies on `text-spacing-trim` for typographic correctness as the AAA case for the live-text requirement.

**Suggested tooling**: Chrome DevTools Rendering tab (verify CJK font has `halt` / `chws` features via Computed → Font) | Playwright-class browser automation with multi-script paragraph rendering + screenshot diff | manual cross-browser test on pre-Baseline browsers (Firefox / Safari) for fallback path | OpenType font-feature audit (e.g., `fontTools` CLI inspection of the font file)

---

### VVT-073: CSS Anchor Positioning (`anchor-name`, `position-anchor`, `anchor()`, `position-area`) — split Baseline 2-vs-2 (`anchor-name` + `position-area` Newly Jan 2026; `position-anchor` + `anchor()` Limited)

**Pattern (diff-observable)**:
- Content match: added or modified `anchor-name: --<name>;` declarations; `position-anchor: --<name>;` declarations; `anchor()` function references inside `top`, `left`, `right`, `bottom`, `inset`, or `inset-*` properties; `position-area` declarations; tooltip / popover / dropdown patterns migrating from JS-positioning (Floating UI, Popper.js) to native CSS anchor positioning
- File/path match: tooltip / popover / dropdown component stylesheets, design-system overlay primitives, Floating-UI-replacement diff hunks

**Why runtime verification is needed**: CSS Anchor Positioning is a SPLIT-Baseline feature — `anchor-name` is Baseline 2026 Newly available since January 2026 while `position-anchor` and the `anchor()` function remain at Limited availability per their per-feature MDN pages. This per-feature classification asymmetry means a single `@supports` test on one half does not guarantee the other half works. Diff review shows the property usage but cannot reveal: (a) **split-Baseline classification per-feature** — per MDN's `anchor-name` per-feature page: "Baseline 2026" / "Newly available" / "Since January 2026, this feature works across the latest devices and browser versions. This feature might not work in older devices or browsers." Per MDN's `position-anchor` per-feature page: "Limited availability" / "This feature is not Baseline because it does not work in some of the most widely-used browsers." — verify the runtime behavior in EACH target browser, do NOT assume the `anchor-name` Baseline status extends to consumer properties; (b) **`@supports` gating granularity** — `@supports (anchor-name: --x)` passes in Baseline-2026 browsers but does NOT guarantee `position-anchor` or `anchor()` work; the recommended idiomatic gate is `@supports (position-anchor: --x)` (the strictest constraint), with a JS-driven fallback for older browsers; (c) **Firefox-specific anchor-targeting limitations** — per MDN's `position-anchor` per-feature page Note: "The anchor positioning CSS for this demo currently doesn't work in Firefox. The slider's thumb can be targeted via the `::-moz-range-thumb` pseudo-element in Firefox, but it is currently not available as an anchor (see Firefox bug 1993699)." — verify the anchor element type is broadly targetable (form-control pseudo-elements may not be anchorable); (d) **positioned-element layout context** — `anchor()` only resolves on absolutely-positioned or fixed-positioned elements; verify the consumer has `position: absolute` or `position: fixed` set, otherwise `anchor()` falls back to its default value silently; (e) **anchor-element-positioning collapse** — if the named anchor is `display: none`, removed from the DOM, or has `anchor-name: none` overridden, the positioned element falls back to its default inset values; verify the visual fallback is acceptable; (f) **fallback-positioning under `position-try` / `position-try-fallbacks`** — when the anchor + positioned element combination produces an off-viewport result, modern browsers attempt the configured fallback positions; verify the fallback chain produces an acceptable visual result in every viewport size; (g) **SSR / hydration timing** — anchor positioning resolves at layout time, not at hydration; verify React / Vue / Svelte SSR'd markup does not flash unstyled or mis-positioned between server-render and client-hydration; (h) **JavaScript-driven anchor migration risk** — teams migrating from Floating UI / Popper.js to native anchor positioning must verify visual equivalence across the migration; the JS libraries handle edge cases (scroll containment, intersection-with-viewport, RTL flipping) that native anchor positioning handles differently or not yet at parity.

**What to verify externally**:
- Apply the rule in a live browser with full anchor-positioning support (Chrome / Edge stable as of January 2026) and verify the anchored element renders at the intended position relative to the anchor
- DevTools Layout panel: inspect the positioned element's computed `top` / `left` / `inset` to confirm `anchor()` resolves to the expected pixel values
- Cross-browser test on Firefox stable + Safari stable — verify the fallback rendering is acceptable OR the `@supports` gate correctly excludes the rule
- Test viewport-edge cases: anchor near the top, bottom, left, right of the viewport — verify `position-try-fallbacks` chain produces an on-viewport result
- Test the anchor element's removal / `display: none` / re-rendering — verify the positioned element gracefully falls back without flicker
- SSR test: verify React / Vue / Svelte SSR-rendered markup hydrates without visible re-positioning flash

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/anchor-name (per-feature page for `anchor-name`; Baseline banner verbatim: "Baseline 2026" + "Newly available" + "Since January 2026, this feature works across the latest devices and browser versions. This feature might not work in older devices or browsers."), https://developer.mozilla.org/en-US/docs/Web/CSS/position-anchor (per-feature page for `position-anchor`; Baseline banner verbatim: "Limited availability" + "This feature is not Baseline because it does not work in some of the most widely-used browsers." Property purpose verbatim: "The `position-anchor` CSS property specifies the default anchor element for a positioned element."), https://developer.mozilla.org/en-US/docs/Web/CSS/position-area (per-feature page for `position-area`; Baseline banner verbatim: "Baseline 2026" + "Newly available" + "Since January 2026, this feature works across the latest devices and browser versions. This feature might not work in older devices or browsers." — completes the split-Baseline observation: `anchor-name` + `position-area` are Baseline 2026 while `position-anchor` + `anchor()` remain Limited availability, a 2-vs-2 split across the 4 anchor-positioning primitives this rule's diff-observable Pattern names).

**See also**: **VVT-001** for the broader "New or modified positioning rules" trigger — anchor positioning is a positioning-discipline subset; pair when migrating from manual `position: absolute` with measured offsets to anchor-driven positioning. **VVT-003** for `transform` / `filter` / `opacity` containing-block effects — these properties create new containing blocks that affect anchor resolution; verify the anchor's containing block matches expectation. **VVT-009** for `overflow` / `clip-path` / `mask` — anchored popovers/tooltips can be clipped by ancestor `overflow: hidden`; verify the anchored element renders outside the clipping ancestor when intended. **VVT-049** for `field-sizing: content` — both are Limited availability progressive enhancements; pair when both apply to the same component. **Cross-catalog peers**: **A11Y-059** (`accessibility/aria/apg-widgets.md`, "Tooltip — `role=\"tooltip\"` + `aria-describedby` + hover + focus + Esc") — VVT-073 is the runtime-verification trigger when code adopts native CSS anchor positioning for tooltip surfaces; A11Y-059 is the corresponding ARIA-APG-widget accessibility-discipline policy (WCAG 1.4.13 dismissability + persistence + hoverability + WCAG 2.1.1 keyboard + 2.4.7 focus-visible activation parity). Pair when CSS Anchor Positioning replaces JS-positioned tooltip surfaces (Floating UI / Popper.js migration). Adjacent ARIA-APG-widget peers (**A11Y-048** Combobox — input + popup; **A11Y-052** Menu / Menubar; **A11Y-053** Menu button) cover the dropdown / menu / popover use cases for the same CSS Anchor Positioning surface; pair selectively when those widget patterns are the migration target.

**Suggested tooling**: Chrome DevTools Layout panel (verify `anchor()` resolves to expected pixel values) | Playwright-class browser automation with viewport-resize + screenshot at viewport-edge positions | manual cross-browser test on Firefox + Safari for fallback path | manual SSR/hydration test for framework integrations (React / Vue / Svelte)
