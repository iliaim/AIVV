# Visual Verification Triggers — Modern web-platform features (2022+ baseline)

Part of [.aivv/standards/visual-verification-triggers/](README.md) (VVT-031..042). Added dev.84 = T23 phase 1 — modern web-platform feature triggers covering CSS layout / cascade / selector / animation primitives and HTML interaction primitives that have crossed Baseline status (or are Baseline newly-available) since 2022. Each trigger names MDN's Baseline-status string where present AND carries an inline `Source:` line linking to the canonical MDN / WHATWG page (added dev.84 post-ship IV&V corrective; closes Beta F2 citation-trail-on-disk gap).

<!-- POLICY-NOTE (dev.86 retired the dev.85 DEFERRED-RETIRE-WHEN sigil): this file and `framework-observer.md` are CLOSED historical by-date batches with stable rule-ID ranges (VVT-031..042 here, VVT-043..046 in framework-observer.md). Future VVT additions append to by-domain subfiles (css-styling.md / state-interaction.md / component-composition.md / accessibility-code.md / assets.md / responsive.md) per maintainer guidance "By-date-vs-by-domain VVT subfile policy". Re-evaluate redistribution if either by-date file crosses 300 lines individually. -->

**Last MDN/WHATWG-checked**: 2026-05-12. Baseline-status strings drift as features age; re-verify before citing in calibration corpus past 2026-12.

### VVT-031: CSS container queries (`@container`, `container-type`, `container-name`)

**Pattern (diff-observable)**:
- Content match: added `@container` at-rule, OR new `container-type: (size|inline-size)` / `container-name:` / `container:` shorthand declaration on any selector
- File/path match: `**/*.{css,scss,sass,less}`, CSS-in-JS template literals, Tailwind `@container` directive use

**Why runtime verification is needed**: Container queries change layout based on the container's inline (or block) size at render time, NOT viewport size. Diffs reveal the rule but not the actual computed `inline-size` of each instance of the component — a `.card` rendered at 300px inside a 700px sidebar will respond differently than the same `.card` rendered at 600px in a content well. Additionally, `container-type: size` applies size containment, which makes the element compute its own size in isolation from its children — if no contextual or explicit size is available, the container itself collapses to zero, breaking layout in non-obvious ways (size containment does NOT clip descendants — that's paint containment; size containment affects the container's own intrinsic-content sizing).

**What to verify externally**:
- Component renders correctly at every container width it can be instantiated at (not just every viewport width)
- Container-typed element does NOT collapse to zero — content-based intrinsic sizing is replaced by isolated size computation
- Container-named declarations resolve to the intended ancestor (especially in nested containers)
- Backwards-compatible fallback styles render in browsers without container-query support (if targeting pre-2023 browsers)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries + https://developer.mozilla.org/en-US/docs/Web/CSS/contain (paint vs size containment distinction — size does not create a new containing block for absolutely-positioned descendants)

**See also**: **VVT-046** (`framework-observer.md`) for imperative ResizeObserver use — the escape-hatch when container queries cannot express the responsive logic (measuring text overflow for tooltip placement, dynamic SVG viewbox calculation, framework-coupled measurement, etc.).

**Suggested tooling**: Playwright-class browser automation with multiple viewport+container-width permutations | Chrome DevTools-class element-resize testing

---

### VVT-032: CSS `:has()` selector usage

**Pattern (diff-observable)**:
- Content match: added or modified selectors containing `:has(...)` (e.g., `.card:has(img)`, `form:has(input:invalid)`)
- File/path match: any stylesheet, CSS-in-JS, design-system token files

**Why runtime verification is needed**: `:has()` performs parent / previous-sibling selection — a new `:has()` rule can re-style elements far from the diff hunk, anywhere the descendant condition matches. Specificity inherits from the most-specific argument; cascade interactions with non-`:has()` rules may shift unexpectedly. Performance: a `:has()` rule with broad anchor (`body:has(...)`, `*:has(...)`) can trigger style invalidation across the document on every DOM mutation. MDN explicitly warns against this (Baseline 2023 — Newly available; "make sure your A does not have too many children").

**What to verify externally**:
- Targeted elements receive the intended styles; no over-matching cascade hits
- Page-level interaction performance does not regress (especially on DOM-mutation-heavy surfaces — form input, infinite scroll, drag-drop)
- Fallback styles render for browsers without `:has()` support (if targeting pre-Dec-2023 browsers)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/:has (Baseline 2023 — Newly available; specificity rules; broad-anchor performance caveat)

**See also**: **VVT-070** (`css-styling.md`) for CSS `@scope` at-rule — `:has()` is a parent / relational selector (per MDN: "presents a way of selecting a parent element or a previous sibling element with respect to a reference element by taking a relative selector list as an argument") and `@scope` is a subtree-bounded selector reach + new scoping-proximity cascade tier; both are DOM-structure-aware CSS-native patterns. Pair when an author is choosing between component-state-driven class hooks (BEM-style compound classes, framework-injected scope IDs) and CSS-native primitives — the typical `:has()` migration is from BEM `--has-child` modifier classes; the typical `@scope` migration is from CSS Modules / Vue scoped styles / JS-injected scope IDs.

**Suggested tooling**: Chrome DevTools-class Performance profiler for invalidation cost | Playwright-class automation for cascade-impact regression coverage

---

### VVT-033: CSS cascade layers (`@layer`) — Baseline widely available since March 2022

**Pattern (diff-observable)**:
- Content match: added `@layer <name>;` ordering declaration, `@layer <name> { ... }` content block, or layered import (`@import url(...) layer(<name>);`)
- File/path match: any stylesheet, build-time CSS bundling configs

**Why runtime verification is needed**: `@layer` changes the cascade order — declarations within named layers cascade among themselves first, then by layer ordering. A new layer ordering can demote or promote existing rules' precedence without changing any individual selector. Important-flag declarations REVERSE the ordering (earlier layers win for `!important`). Diff review sees the at-rule but cannot trace which existing rules now lose or win the cascade.

**What to verify externally**:
- Existing components retain their intended styling after layer ordering changes
- `!important` declarations behave as expected in the new ordering (reversed)
- Third-party-imported stylesheets land in the intended layer (no precedence leak from unlayered code)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/@layer (Baseline Widely available, available across browsers since March 2022; layer ordering + !important inversion)

**See also**: **VVT-070** (`css-styling.md`) for CSS `@scope` at-rule — `@layer` and `@scope` are both cascade-control primitives that commonly co-occur in design-system stylesheets. Per MDN's `@scope` page, scoping proximity is a NEW cascade criterion that "overrules source order but is itself overridden by other, higher-priority criteria such as importance, layers, and specificity"; bare selectors inside `@scope` add zero specificity weight (they behave as if `:where(:scope)` were prepended). Verify the computed-style winner when both are active — the cascade resolves importance > layers > specificity > scope-proximity > source-order; `@scope` does NOT shield scoped rules from higher-specificity selectors in later-cascading `@layer`s.

**Suggested tooling**: Chrome DevTools-class Computed-styles + Cascade-view inspection | Playwright-class screenshot diff

---

### VVT-034: CSS logical properties (`*-inline-start`, `*-block-end`, etc.) replacing physical (`left`, `top`)

**Pattern (diff-observable)**:
- Content match: added `margin-inline-start`, `padding-block-end`, `border-inline-end`, `inset-block-start`, `start`/`end` shorthands replacing `left`/`right`/`top`/`bottom`
- Removal of physical-direction declarations: `margin-left`, `padding-top`, `border-right`, etc., in favor of logical equivalents
- File/path match: any stylesheet, CSS-in-JS, theme tokens

**Why runtime verification is needed**: Logical properties resolve relative to the inline / block axis at render time, which depends on `direction` (LTR/RTL) and `writing-mode`. A page that has never been tested in `dir="rtl"` may have been silently mixing physical and logical declarations; introducing a logical property where a physical-direction declaration previously existed can flip layout for RTL users (intentional) or break LTR users if the swap was incorrect. Pages in vertical writing modes (Japanese, Chinese, Mongolian) are most exposed.

**What to verify externally**:
- LTR layout unchanged where the logical-property swap was intended as a no-op
- RTL layout (`dir="rtl"`) renders the mirror layout as intended
- No remaining hardcoded physical-direction declarations (`left:`/`right:`/`margin-left:`/`padding-right:`) survive the swap — verify cascade does not silently win the wrong rule via specificity tie + source order (most common drift after a partial swap)
- Vertical writing modes (if applicable) render correctly
- Browser RTL mode for the locale switches the intended properties

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values (writing-direction-relative properties; inline vs block dimension definitions)

**Suggested tooling**: Playwright-class automation across `dir="ltr"` and `dir="rtl"` permutations | manual locale-switch test

---

### VVT-035: CSS anchor positioning (`anchor-name`, `position-anchor`, `position-area`)

**Pattern (diff-observable)**:
- Content match: added `anchor-name: --<ident>`, `position-anchor: --<ident>`, `position-area:`, `position-try-fallbacks:`, or `position-try` declarations
- File/path match: any stylesheet, popover/tooltip/dropdown component files

**Why runtime verification is needed**: Anchor positioning tethers an anchored element to a separately-positioned anchor element. Diffs show the declaration but not the runtime spatial relationship at every viewport / scroll / container-width combination. Fallback positions (`position-try`) silently rearrange when the default position overflows the containing block — verifying which fallback fires requires live rendering. Limited rollout as of 2026-05: Chromium 125+ ships most properties; Safari and Firefox support is still in progress — treat as a progressive enhancement only, with explicit fallback rendering verified.

**What to verify externally**:
- Anchored element renders adjacent to its anchor at every supported viewport
- Fallback positions trigger correctly when the default overflows
- Unsupported-browser fallback (CSS @supports) renders an acceptable shape (Safari + Firefox as of 2026-05)
- Anchored element follows the anchor on scroll / layout shift

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning (current property names: `anchor-name`, `position-anchor`, `position-area`, `position-try-fallbacks`, `position-try` — NOT the older `inset-area` from earlier drafts)

**Suggested tooling**: Playwright-class browser automation across viewports + scroll positions | manual test in non-supporting browser via CSS @supports query

---

### VVT-036: CSS subgrid (`grid-template-columns: subgrid`, `grid-template-rows: subgrid`)

**Pattern (diff-observable)**:
- Content match: added `subgrid` value on `grid-template-columns` / `grid-template-rows` / `grid-template:` shorthand
- File/path match: any stylesheet, CSS-in-JS

**Why runtime verification is needed**: Subgrid inherits the parent grid's track sizing across the subgrid's span — but only if the parent's grid container is an actual grid container and the subgrid's outer dimensions match the parent's track boundaries. Diffs show the declaration but not whether the subgrid's content actually aligns at the gutters / column boundaries the author intended. Cards in a card grid that each use `subgrid` for internal heading / body / CTA alignment regress visibly if one card's content height differs.

**What to verify externally**:
- Subgrid children align to parent grid tracks (heading row, body row, CTA row across all cards in a grid)
- No vertical-axis misalignment when card content lengths differ
- Fallback rendering in non-supporting browsers is acceptable

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid

**Suggested tooling**: Playwright-class screenshot diff for grid alignment regression | manual variable-content-length test

---

### VVT-037: CSS / JS view transitions (`document.startViewTransition`, `view-transition-name`, `@view-transition`, framework wrappers)

**Pattern (diff-observable)**:
- Content match: added `document.startViewTransition(...)` calls, `view-transition-name: <ident>` declarations, `::view-transition-*` pseudo-element styles, `@view-transition` rule, OR framework-config flags (Next.js 15+ experimental `viewTransition` config, Astro `<ViewTransitions />` directive, React 19+ `<ViewTransition>` primitive)
- File/path match: any JS/TS, any stylesheet, route-component files (SPA navigation transitions), MPA navigation handlers, framework config files

**Why runtime verification is needed**: View transitions snapshot the old + new DOM states and animate between them. The visual result depends on (a) which elements carry `view-transition-name`, (b) computed styles of those elements before + after, (c) the animation curve (CSS-default vs custom), and (d) browser engine support. As of 2026-05, Chrome 111+, Safari 18.0+ (desktop + iOS), and Firefox 144+ all ship same-document view transitions; cross-document support is rolling out and may diverge by engine — re-check current compat tables before assuming parity. Diff review cannot predict the animated motion. Reduced-motion preference (`prefers-reduced-motion`) interactions matter — view transitions should degrade gracefully.

**What to verify externally**:
- Transitions render as intended in Chrome, Safari, and Firefox (each engine paints the snapshot pseudo-elements slightly differently)
- Non-supporting browser versions (pre-Chrome-111, pre-Safari-18, pre-Firefox-144) fall back to instant transition without breaking the parent navigation
- `prefers-reduced-motion: reduce` user setting disables or shortens the transition appropriately
- No layout shift / flicker on navigation start or end
- Snapshot-pair symmetry: if an element on the old page carries `view-transition-name: hero`, the new page should also have an element with the same name — orphaned name on one side produces a glitchy crossfade

**Source**: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API + https://caniuse.com/view-transitions (current cross-browser support: Chrome 111+, Safari 18.0+, Firefox 144+ for same-document; cross-document still rolling out)

**See also**: **VVT-054** (`css-styling.md`) for the dedicated `prefers-reduced-motion` trigger — view transitions are a vestibular-trigger-prone animation surface and must degrade per user preference; pair these triggers whenever a view transition is added.

**Suggested tooling**: Playwright-class browser automation across Chrome/Safari/Firefox with `prefers-reduced-motion` media-feature emulation | manual visual regression test

---

### VVT-038: CSS `aspect-ratio` property additions or changes

**Pattern (diff-observable)**:
- Content match: added or modified `aspect-ratio: <ratio>` declarations
- File/path match: any stylesheet, CSS-in-JS, image / video / iframe container components

**Why runtime verification is needed**: `aspect-ratio` reserves vertical space without explicit `height`, but interacts with `width`, `max-width`, and intrinsic content sizing in non-obvious ways. When the constrained dimension changes (e.g., flexbox / grid resizes the element), the computed `height` follows — diffs cannot show the resulting box at every viewport. CLS (Cumulative Layout Shift) regressions and image-load-time space-reservation correctness are common issues this property is supposed to fix; runtime verification confirms it actually does.

**What to verify externally**:
- Reserved space appears immediately on render (no CLS as images / iframes load)
- Element box matches design intent across viewports (e.g., 16:9 video container stays 16:9 down to mobile)
- No content overflow inside the aspect-ratio-locked box at content-heavy edge cases

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio

**Suggested tooling**: Lighthouse / WebPageTest CLS measurement | Playwright-class screenshot at multiple viewports

---

### VVT-039: HTML `popover` attribute / Popover API usage — Baseline 2024 (Newly available since April 2024)

**Pattern (diff-observable)**:
- Content match: added `popover` attribute on any element (`popover`, `popover="auto"`, `popover="manual"`, `popover="hint"`), or `popovertarget` / `popovertargetaction` attributes on a `<button>` / `<input type="button">`, or `HTMLElement.showPopover()` / `hidePopover()` / `togglePopover()` JS calls
- File/path match: any HTML, JSX/TSX/Vue/Svelte, JS/TS

**Why runtime verification is needed**: Popovers render in the top layer (above everything else) when open and are hidden via `display: none` when closed. Top-layer rendering bypasses parent `position` and `overflow` constraints — diffs show the markup but cannot reveal how the popover actually positions, animates, or stacks against existing dialogs / toasts / fixed-position chrome. Light-dismiss behavior (Esc, outside-click) and focus management are spec-defined but vary in implementation across engines. Focus-on-open is conditional on the WHATWG spec's "popover focusing steps": focus moves to the popover or one of its descendants ONLY when the popover itself or a descendant carries the `autofocus` attribute; otherwise focus stays on the invoker.

**What to verify externally**:
- Popover renders in the correct screen location relative to its invoker
- Light-dismiss (Esc, outside-click) closes the popover as expected
- Focus behavior on open/close matches design intent: focus moves INTO the popover only when `autofocus` is set on the popover or a descendant (per WHATWG popover focusing steps) — bare `<div popover>` does NOT auto-focus on open. Verify the markup matches the design's focus expectation.
- Top-layer stacking interaction with concurrent `<dialog open>` / toast / fixed-position chrome is correct (most-recently-promoted-to-top-layer wins; concurrent dialog + popover open can produce surprising stack ordering)
- AT exposure: popover content is reachable and labeled (popover ≠ dialog; screen readers may not announce open/close — pairs with VVT-019, A11Y dialog rules)
- Non-supporting browsers fall back gracefully (or polyfill renders identically)

**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover (Baseline 2024 — Newly available since April 2024) + https://html.spec.whatwg.org/multipage/popover.html (WHATWG popover focusing steps: focus moves only if popover OR descendant has `autofocus`)

**See also**: **VVT-067** (`component-composition.md`) for HTML `<dialog>` + `.showModal()` — the sibling Top Layer primitive; both render to Top Layer but differ on modal semantics (popover is non-modal by default, `<dialog>.showModal()` is modal with native inert backdrop + native Escape handling). Pair these triggers whenever both top-layer surface types coexist in the same component / page (concurrent open produces surprising stack ordering per the "most-recently-promoted-to-top-layer wins" rule). **VVT-019** (`state-interaction.md`) for the broader dialog/modal/popover/tooltip behavior-change trigger. **VVT-048** (`css-styling.md`) for `@starting-style` — the canonical entry-animation primitive for popovers (popover open/close in the top layer is the MDN-named primary use case for `@starting-style`). **VVT-054** (`css-styling.md`) for `prefers-reduced-motion` — popover entry/exit animations need a reduced-motion override to avoid vestibular-trigger motion when the user preference is set.

**Suggested tooling**: Playwright-class automation with `dialog`/`popover` semantics testing | manual keyboard + AT walkthrough

---

### VVT-040: HTML `inert` attribute additions

**Pattern (diff-observable)**:
- Content match: added `inert` boolean attribute on any element or wrapper, or reactive binding to `inert` prop (`<div inert={isModalOpen ? false : true}>`)
- File/path match: any HTML, JSX/TSX/Vue/Svelte

**Why runtime verification is needed**: `inert` removes the subtree from the tab order, accessibility tree, find-in-page search, click handling, and text selection — a powerful focus / interaction trap. Diff review shows the attribute but cannot show whether the inert subtree's *visual* state matches its inert *behavioral* state. MDN warning: "there is no visual way to tell whether or not an element or its subtree is inert" — so the author must add explicit visual cues (opacity, pointer cursor change). Common regressions: forgetting to remove `inert` after a modal closes (trapping the user permanently); adding `inert` to a wrapper that contains the close button (creating an unclosable dialog).

**What to verify externally**:
- Inert subtree is genuinely uninteractable (Tab does not reach it; click is silent; AT skips it)
- Visual treatment of inert subtree (typically opacity reduction, pointer-event disable hint) matches the behavioral state
- Inert state correctly toggles off when the modal / dialog / overlay closes — user can interact with the page again
- The control that EXITS the inert state (close button, escape handler) is NOT itself inside the inert subtree

**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert (Baseline Widely available — available across browsers since April 2023; subtree removed from tab order + accessibility tree + find-in-page + click handling)

**See also**: **VVT-067** (`component-composition.md`) for HTML `<dialog>` + `.showModal()` — `.showModal()` makes all other elements in the document inert AUTOMATICALLY (no manual `inert` attribute needed); verify any manual `inert` toggling alongside `.showModal()` does not double-up or conflict. **VVT-017** (`state-interaction.md`) for the broader focus-management trigger — `inert` is one declarative primitive among several focus-management primitives.

**Suggested tooling**: Playwright-class keyboard-Tab walk to verify tab-order excludes inert subtree | manual AT walk through inert section

---

### VVT-041: CSS native nesting (`& selector` inside a rule) — Baseline 2023 (Newly available since December 2023)

**Pattern (diff-observable)**:
- Content match: added CSS using native nesting syntax — selectors containing `&` (e.g., `.card { &:hover { ... } &__heading { ... } }`), nested at-rules (`@media (min-width: ...) { ... }` inside a regular rule), or `&` combinators
- File/path match: `**/*.css` (NOT `.scss` / `.sass` — those have preprocessor-nested for years; this trigger is for *native* CSS nesting in `.css` files). NOTE the diff-observable limit: a `.css` file may have been emitted by a build pipeline (PostCSS preset-env, esbuild, Lightning CSS) from a preprocessor source, in which case the runtime-cascade-difference concern still applies; the source-of-truth is the build config rather than the file extension alone.

**Why runtime verification is needed**: Native CSS nesting compiles at runtime, not at build time. The compiled cascade may differ subtly from Sass/Less / PostCSS-nesting equivalents — specifically around specificity. The `&` parent reference takes on **the largest specificity in the parent selector list** (analogous to `:is()`): single-selector parent rules behave intuitively (`& > .child` inside `.parent { ... }` has the same specificity as `.parent > .child`), BUT multi-selector parent rules silently elevate specificity (e.g., `#a, .b { & i { ... } }` gives the nested `& i` rule specificity `1-0-1`, NOT `0-1-1`). Diffs converted from preprocessor-nested code lose the original concrete-selector form, which can change runtime computed styles in subtle ways.

**What to verify externally**:
- Computed styles match the preprocessor-compiled equivalent (if the nesting was a preprocessor → native migration)
- Cascade interactions with other selectors hold (no specificity regression) — pay particular attention to nested rules under multi-selector parent rules (`.foo, .bar { & ... }`)
- Non-supporting browsers fall back acceptably (or build pipeline auto-flattens for those targets)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting/Nesting_and_specificity (Baseline 2023 — Newly available; `&` specificity = largest specificity in parent selector list, analogous to `:is()`)

**See also**: **VVT-070** (`css-styling.md`) for CSS `@scope` at-rule — nesting inside `@scope` blocks is the idiomatic authoring pattern; the multi-selector parent specificity rule documented here propagates into `@scope` nested rules (verify nested-selector resolution under scope).

**Suggested tooling**: Chrome DevTools-class Computed-styles inspection in supporting + non-supporting browsers | screenshot diff at the cascade-interaction-prone components

---

### VVT-042: CSS `content-visibility` property (`auto`, `hidden`, `visible`)

**Pattern (diff-observable)**:
- Content match: added `content-visibility: (auto|hidden|visible)` declaration, or `contain-intrinsic-size` / `contain-intrinsic-block-size` / `contain-intrinsic-inline-size` on the same selector
- File/path match: any stylesheet, performance-pass commits (long-form articles, infinite-scroll containers, gallery components)

**Why runtime verification is needed**: `content-visibility: auto` defers off-screen subtree rendering until needed (a performance optimization). Without companion `contain-intrinsic-size`, off-screen sections may be 0×0 in the layout, breaking anchor-link scrolling, page-length indicators, and screen-reader DOM traversal expectations. The optimization can also cause "jumpy" scrollbar behavior on rapid scroll if reserved size doesn't match the rendered size. `content-visibility: hidden` makes the subtree unreachable to find-in-page / tab navigation / focus / selection (per the spec, "must not be accessible to user-agent features"). AT-tree exposure varies by browser implementation; do not rely on `content-visibility: hidden` alone to hide content from screen readers — pair with `aria-hidden="true"` when AT-hiding is the explicit intent.

**What to verify externally**:
- Scroll-jump performance is acceptable (no visible content-snap during fast scroll)
- Anchor-link scrolling to deep-page elements still works
- Page-length indicator (scrollbar thumb size, "X of Y" page numbering) is accurate
- `content-visibility: hidden` subtree's AT exposure matches design intent — test with NVDA/JAWS/VoiceOver to confirm intentional vs accidental hiding (the spec language is permissive across implementations)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility (`content-visibility: hidden` "similar to" `display: none` per spec; AT-tree behavior is implementation-defined — pair with `aria-hidden` for explicit AT-hiding intent)

**Suggested tooling**: Playwright-class scroll-performance test | Chrome DevTools-class Performance profiler for paint cost | manual AT walk to confirm intentional vs accidental hiding
