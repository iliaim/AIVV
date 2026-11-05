# Visual Verification Triggers — Asset changes

Part of [.aivv/standards/visual-verification-triggers/](README.md) (VVT-020..022, VVT-051..052). Extended dev.87 = T23 phase 4 — image-loading hints (`loading="lazy"` per VVT-051; `decoding` + `fetchpriority` per VVT-052) appended per the dev.86 by-domain partition policy.

### VVT-020: New or replaced image / icon / SVG

**Pattern (diff-observable)**:
- File/path match: added/modified files under `**/*.{png,jpg,jpeg,webp,avif,gif,svg,ico}`, or changed `src=`/`href=` attributes referencing image paths
- Content match: changed `alt=` text, removed `alt` attribute, new `<img>` without `alt`

**Why runtime verification is needed**: Intrinsic image dimensions, color-against-background, and whether the alt text describes the rendered content are runtime-visible only.

**What to verify externally**:
- Image renders at expected dimensions without distortion
- Image contrast against background for icons used as UI affordances (3:1 minimum)
- `alt` text matches rendered meaning (or `alt=""` for decorative)
- `loading="lazy"` does not skip above-the-fold images

**See also**: **VVT-051** for the dedicated `loading="lazy"` trigger (above-the-fold misuse, JS-disabled fallback, `width`/`height` CLS interaction). **VVT-052** for the `decoding` + `fetchpriority` hints that interact with this trigger's lazy-load behavior.

**Suggested tooling**: manual screenshot comparison | aXe DevTools | Lighthouse audit

---

### VVT-021: SVG structure or viewBox change

**Pattern (diff-observable)**:
- Content match: modified SVG `viewBox`, `width`/`height` attributes, `<path>` `d=` values, or removed/added `<title>`/`<desc>` children

**Why runtime verification is needed**: SVGs scale differently based on the interplay of `viewBox`, CSS dimensions, and `preserveAspectRatio`; icon alignment against neighboring text is only verifiable when rendered.

**What to verify externally**:
- Icon aligns vertically with adjacent text (baseline, cap-height)
- Icon scales correctly at 1x, 2x, 3x device-pixel ratios
- `<title>` content is announced by assistive tech when needed

**Suggested tooling**: manual screenshot comparison | Chrome DevTools-class in-browser inspection

---

### VVT-022: Video, audio, or embedded-media addition

**Pattern (diff-observable)**:
- Content match: new `<video>`, `<audio>`, `<iframe>` (YouTube/Vimeo embeds), `<source>` tags

**Why runtime verification is needed**: Autoplay policies, captions rendering, poster-image layout shift, and responsive sizing of embedded media are runtime concerns.

**What to verify externally**:
- No autoplay with sound (browser-blocks)
- Captions/subtitles track loads and renders
- Poster image prevents CLS
- Responsive sizing at small viewports

**See also**: **VVT-051** for `loading="lazy"` applied to `<iframe>` embeds (YouTube / Vimeo lazy-loading) — pairs with this trigger whenever an iframe-embedded media surface adds lazy-load deferral.

**Suggested tooling**: Chrome DevTools-class in-browser inspection | manual viewport resize test

---

### VVT-051: HTML `loading="lazy"` attribute on `<img>` / `<iframe>` — Baseline Widely available since March 2022

**Pattern (diff-observable)**:
- Content match: added/changed `loading="lazy"` (or `loading="eager"`) attribute on `<img>` or `<iframe>` elements; switched between `lazy` ↔ `eager` ↔ omitted
- File/path match: any template / JSX / SFC / handlebars / partial that renders image or iframe markup; image-component prop changes

**Why runtime verification is needed**: `loading="lazy"` defers fetching the resource until it reaches a browser-calculated distance from the viewport. Diff review shows the attribute swap but cannot reveal: (a) **above-the-fold misuse** — lazy-loading the hero / LCP image silently delays the Largest Contentful Paint metric because the fetch is deferred until the layout engine determines the image is "near" the viewport, by which point first-paint has elapsed; (b) **`width`/`height` absence on lazy images** — per MDN, "unloaded images have a `width` and `height` of `0`" so the layout reserves no space and content reflows on each lazy-image resolve, producing visible CLS jank; (c) **`load` event timing change** — per MDN, "Lazy-loaded images located in the visual viewport may not yet be visible when the Window `load` event is fired. This is because the event is fired based on eager-loaded images — lazy-loaded images are not considered" — scripts that gate behavior on `load` may run before lazy in-viewport images are visible; (d) **JS-disabled fallback** — per MDN, "Loading is only deferred when JavaScript is enabled" (anti-tracking measure), so the JS-disabled rendering eagerly fetches all images regardless of attribute — verify the JS-disabled baseline is acceptable; (e) **distance-from-viewport heuristic** is browser-dependent and varies with network/device — exact pre-load distance cannot be statically verified.

**What to verify externally**:
- Above-the-fold / LCP-candidate images use `loading="eager"` (or omit the attribute, which defaults to eager) — verify by inspecting `<img>` markup positions against rendered viewport
- All lazy-loaded images carry explicit `width` and `height` attributes (or CSS `aspect-ratio`) — verify no CLS shift when scrolling past the lazy threshold
- `load`-event-dependent scripts behave correctly when lazy images are in-viewport but unresolved at fire time
- JS-disabled rendering remains usable (eager-load-all fallback)
- Cross-browser parity: the distance-from-viewport heuristic differs between Chromium, Firefox, WebKit; verify no perceptible "scroll into view → blank-then-resolve" flash in normal scroll speeds

**Source**: https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading (per-feature Baseline banner: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since March 2022."). MDN element-level reference: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#loading + https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#loading (iframe lazy-loading documentation). Quoted runtime-behavior: "Defers loading of the image until it reaches a calculated distance from the viewport, as defined by the browser"; "unloaded images have a `width` and `height` of `0`"; "Loading is only deferred when JavaScript is enabled".

**See also**: **VVT-020** for the broader image-replacement trigger that this attribute commonly accompanies. **VVT-022** for the video/audio/embedded-media trigger — `<iframe>` lazy-loading covered here intersects VVT-022's YouTube/Vimeo iframe-embed surface. **VVT-052** for `decoding` + `fetchpriority` hints that interact with lazy-load timing (`fetchpriority="high"` on a lazy LCP image partially recovers some lost time). **Cross-catalog peers**: **UX-023** (`ui-ux/data-performance.md`, "Never lazy-load the LCP / above-the-fold image") — the performance-UX policy for the highest-risk `loading="lazy"` misuse; VVT-051 is the runtime-verification trigger for confirming rendered viewport position, LCP attribution, CLS behavior, and browser lazy-load timing.

**Suggested tooling**: Playwright-class browser automation with `page.locator('img[loading=\"lazy\"]')` + viewport-position checks | Chrome DevTools-class Performance + Network panels (LCP attribution; lazy-image fetch timing) | Lighthouse audit (LCP, CLS metrics)

---

### VVT-052: HTML `<img>` `decoding` + `fetchpriority` attribute additions — `decoding` Baseline Widely available since January 2020; `fetchpriority` Baseline 2024 Newly available since October 2024 (progressive enhancement framing)

**Pattern (diff-observable)**:
- Content match: added/changed `decoding="async"` / `decoding="sync"` / `decoding="auto"` and/or `fetchpriority="high"` / `fetchpriority="low"` / `fetchpriority="auto"` on `<img>` elements (also applies to `<link rel="preload">` and `fetch()` for `fetchpriority`)
- File/path match: any template / JSX / SFC that renders image markup; image-component prop changes

**Why runtime verification is needed**: `decoding` hints at whether the next paint waits for image decode (`sync`) or proceeds without (`async`); `fetchpriority` hints at the relative priority among other resources during fetch. **Important Baseline note (per MDN, verified 2026-05-13)**: `decoding` is Baseline Widely available since January 2020 (cross-browser); `fetchpriority` is Baseline Newly available — only since October 2024 (Chrome 101 April 2023, Safari 17.2 December 2023, Firefox 132 October 2024). Treat `fetchpriority` as a progressive-enhancement hint that older browsers (and the long tail still on pre-2024 Firefox / pre-17.2 Safari) will silently ignore — verify the LCP / resource-waterfall behavior is acceptable WITHOUT `fetchpriority` as a baseline before relying on the hint. Diff review shows the attributes but cannot reveal: (a) **LCP-attribution impact** — `fetchpriority="high"` on the LCP image meaningfully advances the Largest Contentful Paint metric in supporting browsers; `fetchpriority="low"` on a critical image silently regresses it; the actual numeric impact depends on the network waterfall, simultaneous resource count, and connection class — AND on whether the user's browser supports the hint at all; (b) **`decoding="async"` paint-flash** — per MDN, "the next paint does not wait for the image to decode" — visually, large images may briefly render as blank-then-resolve even after fetch completes, particularly on slower CPUs; (c) **interaction with `loading="lazy"`** — both hints work independently; `fetchpriority="high"` on a lazy LCP image does NOT defeat lazy-loading but does prioritize the eventual fetch when triggered in supporting browsers; verify the combination produces the intended ordering; (d) **dynamically-inserted-via-JS images** — per MDN, decoding-mode differences are "more noticeable with dynamically inserted `<img>` elements" — verify dynamic-insertion paths separately from static-markup paths; (e) **`fetchpriority` is a hint, not a guarantee** — browsers may ignore or downweight hints under network pressure or simultaneous high-priority resource demand.

**What to verify externally**:
- LCP image carries `fetchpriority="high"` (or is positioned early enough in the markup that auto-prioritization works) — verify via Chrome DevTools Performance panel LCP attribution
- Below-the-fold or non-critical images do NOT carry `fetchpriority="high"` (would steal bandwidth from LCP candidate)
- `decoding="async"` images do not produce noticeable blank-then-resolve flash on target devices / CPU profiles
- Dynamically-inserted images via JS retain intended decode/priority behavior (test the JS-driven insertion path explicitly)
- Combined `loading="lazy"` + `fetchpriority="high"` (the "lazy LCP" pattern) produces the intended timing — fetch is deferred but high-priority when triggered

**Source**: `decoding` per-feature page: https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding (Baseline banner: "Baseline Widely available ... It's been available across browsers since January 2020"). `fetchpriority` per-feature page: https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/fetchPriority (Baseline banner: "Baseline 2024 — Newly available ... Since October 2024, this feature works across the latest devices and browser versions"). Element-level reference: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#fetchpriority. Quoted runtime-behavior: "the next paint does not wait for the image to decode" for `async`; "It is often difficult to perceive any noticeable effect when using `decoding` on static `<img>` elements ... performance differences are more noticeable with dynamically inserted `<img>` elements".

**See also**: **VVT-020** for the broader image-replacement trigger. **VVT-051** for `loading="lazy"` — the most common attribute that pairs with these hints on the same `<img>` element. **Cross-catalog peers**: **UX-023** (`ui-ux/data-performance.md`, "Never lazy-load the LCP / above-the-fold image") — the performance-UX policy that requires `fetchpriority="high"` on the LCP candidate and forbids `fetchpriority="low"` / lazy loading on first-screen images; VVT-052 is the runtime-verification trigger for confirming resource-waterfall and LCP behavior.

**Suggested tooling**: Chrome DevTools-class Performance panel (LCP attribution view; fetchpriority effect on resource waterfall) | Playwright-class browser automation with `page.locator('img[fetchpriority=\"high\"]')` + LCP measurement | Lighthouse audit (LCP, TBT)
