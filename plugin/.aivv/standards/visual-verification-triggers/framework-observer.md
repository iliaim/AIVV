# Visual Verification Triggers — Framework boundaries & DOM observers

Part of [.aivv/standards/visual-verification-triggers/](README.md) (VVT-043..046). Added dev.85 = T23 phase 2 — JavaScript-framework boundary triggers (React Suspense) + Web Components encapsulation + DOM-mutation-driven UI observers (IntersectionObserver, ResizeObserver). Each trigger carries an inline `Source:` line per the dev.84 corrective discipline (Beta F2 close).

<!-- POLICY-NOTE (dev.86 by-domain partition policy): this file and `modern-platform.md` are CLOSED historical by-date batches with stable rule-ID ranges (VVT-043..046 here, VVT-031..042 in `modern-platform.md`). Future VVT additions append to by-domain subfiles (`css-styling.md` / `state-interaction.md` / `component-composition.md` / `accessibility-code.md` / `assets.md` / `responsive.md`) per maintainer guidance "By-date-vs-by-domain VVT subfile policy". Re-evaluate redistribution if either by-date file crosses 300 lines individually. -->

**Last MDN/React-checked**: 2026-05-12. Framework-version-anchored claims drift fast; re-verify before citing past 2026-12.

### VVT-043: React Suspense boundary additions / changes (explicit + implicit)

**Pattern (diff-observable)**:
- **Explicit boundaries**: added or modified `<Suspense fallback={...}>` boundary, lazy-loaded component import via `React.lazy()` or framework equivalents (Next.js dynamic import, Vue `defineAsyncComponent`, Solid `lazy`)
- **Implicit framework boundaries**: Next.js App Router `loading.tsx` or `error.tsx` route-convention file creations / modifications (file-system routing creates implicit Suspense boundaries that contain no literal `<Suspense>` keyword)
- **Server / Client Component boundary directives**: `'use client'` or `'use server'` directive additions or removals (React 19+ / Next.js 14+ — RSC boundaries that interact with Suspense and streaming SSR)
- File/path match: any JSX/TSX/Vue/Svelte/JS/TS, plus `app/**/{loading,error}.{tsx,jsx}` (Next.js App Router conventions)

**Why runtime verification is needed**: A Suspense boundary changes the rendering sequence — children that "suspend" (throw a promise during render) trigger the boundary to render `fallback` instead. Diffs show the boundary placement but cannot reveal: (a) which children actually suspend at runtime (depends on data-fetching, lazy-import resolution); (b) which boundary catches the suspension (the *nearest* parent Suspense boundary wins); (c) whether the `fallback` itself suspends (which would activate the next-parent boundary); (d) streaming-SSR selective-hydration races when RSC boundaries interleave with Suspense (the server may emit fragments in a different order than expected, causing visible reflow as client hydration catches up). The rendered fallback can also flash briefly during transitions even when the network is fast, causing perceptible loading shimmer that diff review doesn't capture.

**What to verify externally**:
- Fallback renders when expected (network-throttled to surface the loading state)
- Fallback does NOT flash on fast transitions (consider `startTransition` / `useDeferredValue` for non-urgent updates)
- Boundary catches suspensions at the intended level (nearest-parent rule — adding a higher Suspense boundary can silently absorb suspensions that previously surfaced lower)
- No "loading…" double-render or layout shift when content resolves
- **Streaming-SSR selective-hydration**: server-emitted fragment order matches user-perceived rendering order; no visible reflow as client hydration catches up (Next.js App Router `loading.tsx` + RSC streaming is the common case)
- AT exposure: fallback content is announced appropriately (a bare spinner is not announced as "loading" to screen readers — pair with `role="status"` per UX-043 if announcement matters)

**Source**: https://react.dev/reference/react/Suspense ("React will display your loading fallback until all the code and data needed by the children has been loaded"; nearest-parent-boundary rule; `startTransition`/`useDeferredValue` mute fallback re-display) + https://nextjs.org/docs/app/api-reference/file-conventions/loading (Next.js App Router `loading.tsx` is an implicit Suspense boundary at the route segment)

**Suggested tooling**: Playwright-class browser automation with network throttling | React DevTools' "Suspense" mode | manual reduced-motion + AT walk

---

### VVT-044: Shadow DOM encapsulation (imperative `attachShadow` + Declarative Shadow DOM) + Custom Element lifecycle

**Pattern (diff-observable)** — note: this trigger fires on SHADOW-DOM-attaching components specifically. A `customElements.define(...)` for a *light-DOM* custom element (no `attachShadow`, no `<template shadowrootmode>`) has lifecycle concerns only — those are non-controversial vs `<div>`-based components and rarely warrant the visual-verification advisory:
- **Imperative shadow DOM**: `attachShadow({mode: 'open'|'closed'})` calls, `class extends HTMLElement` with `attachShadow` in the constructor, framework wrappers (Lit `LitElement` default-creates a shadow root, Stencil `shadow: true`, Vue 3 `customElement` with shadow option, React `createRoot` mounted inside a custom element's shadow root)
- **Declarative Shadow DOM**: `<template shadowrootmode="open|closed">...</template>` HTML usage (server-side-rendered shadow DOM, Lit-SSR / Astro shadow-streaming) — pure-HTML diff with no JS surface
- **Custom element form participation**: classes with `static formAssociated = true` + `attachInternals()` (ElementInternals API)
- **Slot composition**: `<slot>` usage inside a shadow root, `::slotted(...)` styles in the shadow-scope stylesheet
- File/path match: any JS/TS, any HTML (specifically `<template shadowrootmode>` patterns), any web-component-targeting framework file

**Why runtime verification is needed**: Shadow DOM creates an encapsulated subtree — styles from the outer document do NOT apply inside (except CSS custom properties and `::part`/`::slotted` opt-ins), and styles inside the shadow root do NOT leak out. Diffs show the component definition but cannot reveal: (a) which design-system tokens cross the shadow boundary (CSS custom properties yes; classes no); (b) how `<slot>` content is styled (slotted content lives in the light DOM but is styled in the shadow scope); (c) form-internals support for custom elements participating in form validation (requires `ElementInternals` API + `static formAssociated = true`); (d) AT exposure (shadow content is part of the accessibility tree by default but with engine-specific quirks); (e) event retargeting (event handlers attached at the document level see `event.target` set to the *host* element, not the inner shadow-DOM origin — only `event.composedPath()` reveals the true origin chain). Encapsulation breakage is a common regression class.

**What to verify externally**:
- Component renders with the intended visual design (CSS custom properties from outer scope resolve correctly; no missed `::part` styling hooks)
- Slotted content renders inside the slot AND inherits outer styles where intended (`::slotted(...)` rules apply)
- Form-associated custom elements participate in form submission + validation (test with native `<form>` submit; check `formData` payload)
- Event delegation from outside the shadow boundary correctly resolves the inner target via `event.composedPath()` (default `event.target` is retargeted to the host)
- AT walk reveals the component's role + label + state in the same way as a native equivalent (custom select vs `<select>`)
- Component lifecycle (`connectedCallback`, `attributeChangedCallback`, `disconnectedCallback`) fires reliably in framework-mounted contexts
- For Declarative Shadow DOM: SSR-emitted markup hydrates without re-attaching duplicate shadow roots on the client

**Source**: https://developer.mozilla.org/en-US/docs/Web/Web_Components ("encapsulated 'shadow' DOM tree to an element — which is rendered separately from the main document DOM"; slots and templates; encapsulation goals) + https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals (form-internals: `static formAssociated = true` + `attachInternals()` — Baseline Widely available since March 2023) + https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template#shadowrootmode (Declarative Shadow DOM `<template shadowrootmode>` syntax)

**Suggested tooling**: Chrome DevTools-class Elements panel with "Show user agent shadow DOM" enabled | Playwright-class automation with shadow-root-piercing selectors (`>>>`) | manual AT walk

---

### VVT-045: `IntersectionObserver`-driven UI changes — Baseline widely available since March 2019

**Pattern (diff-observable)**:
- Content match: `new IntersectionObserver(...)` instantiation, `IntersectionObserver`-using library calls (`react-intersection-observer`, `@vueuse/core` `useIntersectionObserver`), or `observe(...)` calls against observed targets
- File/path match: any JS/TS, lazy-load library wrappers, infinite-scroll components, scroll-driven-animation components

**Why runtime verification is needed**: IntersectionObserver fires callbacks asynchronously when a target's intersection ratio with an ancestor (or the viewport) crosses configured thresholds. Diffs show the callback but cannot reveal: (a) when entries actually fire — depends on scroll position, viewport size, DOM mutation timing; (b) whether the callback debounces correctly when entries fire in quick succession (rapid scroll); (c) whether the root + rootMargin are correctly configured (a common bug is observing against `document` when the scroll container is a nested element); (d) cleanup on unmount (forgetting `disconnect()` leaks observers across SPA navigations). Common UI patterns built on IntersectionObserver — lazy-image-loading, infinite-scroll pagination, viewport-tracking analytics, scroll-driven animations — each have failure modes that only surface at runtime.

**What to verify externally**:
- Targets are lazy-loaded / animated / counted at the expected scroll positions (not before; not after)
- No double-firing of `loadItems` / similar handlers on rapid scroll (debounce / `once: true` semantics correct)
- Root + rootMargin correctly point at the actual scroll container (not the default viewport when a nested scroll exists)
- Observer disconnects on component unmount (no leak across SPA navigation)
- `rootMargin` uses correct sign and unit: negative values defer firing (e.g., `"-100px 0px 0px 0px"` fires after element passes 100px past the root's top edge); percentage values compute against the *root's bounding box*, not the viewport — common off-by-one in nested-scroll-container cases
- Fallback path renders content for users who reach the deep-page-link without triggering the observer (anchor-link from another page; back-nav from detail page) — observer-gated lazy-content should pre-render or render-on-first-paint if AT-reachable

**Source**: https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver (Baseline Widely available since March 2019; async callbacks fire when thresholds cross; common patterns: lazy-load, infinite-scroll) + https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/rootMargin (rootMargin sign + unit semantics)

**See also**: **VVT-069** (`css-styling.md`) for CSS scroll-driven animations (`animation-timeline: scroll()` / `view()`) — the declarative CSS alternative to imperative IntersectionObserver use for many reveal / progress-bar / parallax patterns; teams migrating IntersectionObserver-based scroll-reactive UI to scroll-driven animations should re-verify both before/after rendering.

**Suggested tooling**: Playwright-class browser automation with scroll-step + assertion waits | Chrome DevTools-class Performance profiler to count callback invocations under stress scroll

---

### VVT-046: `ResizeObserver`-driven UI changes — Baseline widely available since July 2020

**Pattern (diff-observable)**:
- Content match: `new ResizeObserver(...)` instantiation, `ResizeObserver`-using library calls (`react-use-measure`, `@vueuse/core` `useResizeObserver`), or `observe(...)` calls against observed elements
- File/path match: any JS/TS, responsive-typography components, dynamic-layout components, draggable-resize components

**Why runtime verification is needed**: ResizeObserver fires before paint when an observed element's dimensions change — including changes caused BY the callback itself. The browser detects same-frame resize-loops and emits the warning *"ResizeObserver loop completed with undelivered notifications"*, deferring the offending invocation to the next paint. Diffs show the observer setup but cannot reveal: (a) whether the callback inadvertently causes its own resize trigger (writing to a height that affects layout that re-fires the observer); (b) whether the callback runs at sufficient throttle to avoid visible jank on continuous resize (drag-to-resize, animated container); (c) whether the observed element-vs-callback-target relationship makes sense (observing a child but updating the parent — the parent change can re-fire the child observation); (d) cleanup on unmount. Container queries (VVT-031) are now the preferred alternative for responsive design driven by element dimensions — ResizeObserver should generally only fire when imperative JS work is required.

**What to verify externally**:
- No "ResizeObserver loop completed with undelivered notifications" warnings in the browser console under continuous resize / drag interactions
- Callback throttles or defers expensive work (recalculating-layout in callback can cause jank at high frequency)
- Observer disconnects on component unmount
- **SVG element observation**: observing inline SVG elements (`<g>`, `<rect>`, `<path>`, `<svg>` containers) has historically been engine-specific — reliable in Chromium since ~2022, Firefox since ~2023. Common pattern in responsive D3 / chart libraries and dynamic SVG diagram layout. Verify in all target browsers.
- Consider replacing imperative ResizeObserver use with `@container` queries if the use case is purely styling-responsive (the declarative alternative — see "See also" below).

**Source**: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver (Baseline Widely available since July 2020; "resize events ... before paint"; loop-warning + deferred-invocation behavior; container queries as alternative)

**See also**: **VVT-031** (`modern-platform.md`) for `@container` queries — the declarative alternative to imperative ResizeObserver use for purely-styling-responsive design.

**Suggested tooling**: Chrome DevTools-class Console panel (watch for ResizeObserver loop warnings) | Playwright-class browser automation with viewport resize sequence | manual drag-to-resize interaction
