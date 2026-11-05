# Visual Design — Layout & responsive (VD-LAYOUT-01..17)

Part of [.aivv/standards/visual-design/](README.md).

### VD-LAYOUT-01: Container queries over media queries

**Severity**: POLISH
**Rationale**: Media queries respond to viewport — too coarse for component-level responsiveness. Container queries respond to a component's own width — a card behaves correctly in a sidebar AND in main content without per-context overrides.
**Source**: web.dev cq-stable — https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries

**The rule**: components designed for multiple parent contexts use container queries (`@container`) over media queries (`@media`). Top-level layout (which depends on viewport) still uses media queries.

**Code patterns to flag**:
- Card component with media-query breakpoints for "mobile" / "desktop" layout
- Sidebar widget with `@media (min-width: 768px)` (responds to viewport, not sidebar width)

**Correct pattern**: `@container (min-width: 400px) { .card { flex-direction: row; } }` + parent declares `container-type: inline-size`.

**Quick-fix hint**: component-scoped breakpoints — convert to container queries.

---

### VD-LAYOUT-02: Intrinsic sizing keywords

**Severity**: POLISH
**Rationale**: Fixed widths / heights brittle. Intrinsic sizing keywords (`min-content`, `max-content`, `fit-content`) let the browser compute size from content — robust across content lengths and i18n.
**Source**: MDN sizing — https://developer.mozilla.org/en-US/docs/Glossary/Intrinsic_Size

**The rule**: where size should adapt to content, use intrinsic keywords over fixed values. `width: max-content` for "as wide as it needs"; `width: min-content` for "narrowest the content allows."

**Code patterns to flag**:
- `width: 200px` on chip / pill / badge components (fails for long labels in different locales)
- `width: 100%` when `fit-content` would be more semantic

**Correct pattern**: `width: max-content; max-width: 100%;` for chips; `width: fit-content;` for form-field-aligned controls.

**Quick-fix hint**: fixed-width on text-bearing components — consider intrinsic keywords.

---

### VD-LAYOUT-03: aspect-ratio over padding hacks

**Severity**: POLISH
**Rationale**: The classic 16:9 ratio achieved via `padding-bottom: 56.25%` works but is opaque. Modern `aspect-ratio` property is direct and supports `min-`/`max-` prefixes.
**Source**: MDN aspect-ratio — https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio

**The rule**: aspect-locked containers (video, hero images, cards with image headers) use `aspect-ratio` property over `padding-bottom` hacks.

**Code patterns to flag**:
- `padding-bottom: 56.25%;` for 16:9
- `padding-top: 100%;` for square thumbnails

**Correct pattern**: `aspect-ratio: 16 / 9;` or `aspect-ratio: 1;` for square.

**Quick-fix hint**: percentage `padding-bottom` / `padding-top` patterns — replace with `aspect-ratio`.

---

### VD-LAYOUT-04: gap over margin for flex/grid spacing

**Severity**: POLISH
**Rationale**: `margin` between flex/grid children is per-child responsibility; `gap` on the parent is single-source-of-truth. `gap` handles wrap correctly, doesn't accumulate at edges, doesn't conflict with `space-between` justification.
**Source**: MDN gap — https://developer.mozilla.org/en-US/docs/Web/CSS/gap

**The rule**: flex / grid parents use `gap` for child spacing. Children use `margin` only for offset from the parent boundary, not for inter-child spacing.

**Code patterns to flag**:
- `.flex > * + * { margin-left: 1rem; }` pattern (still works but verbose)
- `.grid > * { margin: 0.5rem; }` (creates double-spacing at junctions)

**Correct pattern**: `.flex { display: flex; gap: 1rem; }`; `.grid { display: grid; gap: 1rem; }`.

**Quick-fix hint**: margin-between-flex-children patterns — convert to gap.

---

### VD-LAYOUT-05: grid-template-areas for named regions

**Severity**: POLISH
**Rationale**: Complex layouts (header / sidebar / main / footer) expressed via `grid-template-areas` are self-documenting — the area names appear in the parent stylesheet. Compared to numeric `grid-column-start: 2; grid-row-start: 1;` on each child, the named-area version is far more legible.
**Source**: MDN grid-template-areas — https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-areas

**The rule**: multi-region layouts (3+ named areas) use `grid-template-areas` over per-child grid-line specifications.

**Code patterns to flag**:
- 4-region layout where each child has explicit `grid-column-start/end` declarations
- Header + sidebar + main + footer expressed via line numbers

**Correct pattern**:
```css
.layout {
  display: grid;
  grid-template-areas: "header header" "sidebar main" "footer footer";
}
.layout > header { grid-area: header; }
```

**Quick-fix hint**: multi-region layouts — refactor to grid-template-areas.

---

### VD-LAYOUT-06: Mobile-first breakpoint declarations

**Severity**: POLISH
**Rationale**: Mobile-first (`min-width: <breakpoint>` queries) progressively enhances larger screens — the base styles work on the most-constrained device, additions apply on roomier ones. Desktop-first (`max-width:`) inverts this and tends to ship complex mobile workarounds.
**Source**: web.dev responsive-web-design-basics — https://web.dev/articles/responsive-web-design-basics

**The rule**: media queries use `min-width` (mobile-first). `max-width` reserved for genuine viewport upper-bounds (e.g., print, max-width container).

**Code patterns to flag**:
- `@media (max-width: 767px) { /* mobile */ }` (desktop-first)
- Mixed `min-width` and `max-width` queries in the same stylesheet without rationale

**Correct pattern**: `@media (min-width: 768px) { /* tablet+ */ }`, `@media (min-width: 1024px) { /* desktop+ */ }`.

**Quick-fix hint**: max-width media queries — verify intent (mobile-first inversion?).

---

### VD-LAYOUT-07: clamp() for fluid type/space

**Severity**: POLISH
**Rationale**: Stepped breakpoints (`text-base` mobile, `text-lg` desktop) feel jumpy. `clamp(min, preferred-vw, max)` interpolates smoothly with viewport — `font-size: clamp(1rem, 1rem + 1vw, 2rem)` flows from 16px (mobile) to 32px (large desktop) without breakpoint discontinuity.
**Source**: web.dev min-max-clamp — https://web.dev/articles/min-max-clamp

**The rule**: heading sizes, hero typography, section padding — values that should grow continuously with viewport — use `clamp()` over stepped breakpoint declarations.

**Code patterns to flag**:
- `h1` with 3 breakpoint declarations stepping from 24px → 32px → 48px
- Hero padding declared as `py-12 md:py-16 lg:py-24` (functional but stepped)

**Correct pattern**: `h1 { font-size: clamp(1.5rem, 1rem + 2.5vw, 3rem); }`.

**Quick-fix hint**: typography / spacing with 3+ breakpoint steps — candidate for clamp.

---

### VD-LAYOUT-08: viewport units pitfalls (dvh / svh / lvh)

**Severity**: MINOR
**Rationale**: `100vh` on mobile includes the browser address bar in some states and not others — a "100vh" hero changes height when the user scrolls and the bar collapses. Modern units (`100dvh` = dynamic; `100svh` = small; `100lvh` = large) provide explicit behavior.
**Source**: web.dev viewport-units — https://developer.mozilla.org/en-US/docs/Web/CSS/length#viewport-percentage_lengths

**The rule**: full-viewport-height surfaces use `dvh` (dynamic) for stable rendering, or `svh` (small viewport) for the conservative bound. Bare `vh` on mobile produces layout shift on bar collapse.

**Code patterns to flag**:
- `height: 100vh;` on hero / full-page sections (mobile bar shifts cause shift)
- `min-height: 100vh` on full-page layout

**Correct pattern**: `height: 100dvh;` for full-viewport that follows the dynamic chrome.

**Quick-fix hint**: `100vh` declarations — consider `dvh` / `svh` migration.

---

### VD-LAYOUT-09: CSS Logical Properties for i18n

**Severity**: POLISH
**Rationale**: `margin-left` doesn't flip in RTL languages — content drifts inconsistent with reading direction. Logical Properties (`margin-inline-start`) auto-swap with `dir="rtl"`. Required for i18n-correct layout.
**Source**: MDN CSS Logical Properties — https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values

**The rule**: directional CSS properties prefer logical equivalents: `margin-left` → `margin-inline-start`, `padding-right` → `padding-inline-end`, `text-align: left` → `text-align: start`.

**Code patterns to flag**:
- `margin-left: 1rem;` in i18n-bearing layouts
- `text-align: left;` for body copy (doesn't flip in RTL)
- `border-left: 4px solid;` for sidebar accent (doesn't flip)

**Correct pattern**: `margin-inline-start: 1rem;`, `text-align: start;`, `border-inline-start: 4px solid;`.

**Quick-fix hint**: directional `margin-*`, `padding-*`, `text-align`, `border-*-left/right` — convert to logical equivalents.

---

### VD-LAYOUT-10: Sticky positioning context awareness

**Severity**: POLISH
**Rationale**: `position: sticky` only sticks within its scrolling-ancestor container. An element nested inside `overflow: hidden` won't stick visibly. Common confusion when nav-stick fails because a parent container clips it.
**Source**: MDN position sticky — https://developer.mozilla.org/en-US/docs/Web/CSS/position

**The rule**: `position: sticky` elements verify their scroll-context ancestor does not have `overflow: hidden` (or any clipping property) that would obscure the sticky behavior.

**Code patterns to flag**:
- `position: sticky; top: 0;` on element nested 3 levels inside `overflow: auto` containers (works) vs `overflow: hidden` containers (doesn't stick visibly)
- Sticky table header inside `overflow-x: auto` (works horizontally but not vertically as expected)

**Correct pattern**: sticky elements within deliberately-scrolling containers; verify no clipping ancestor.

**Quick-fix hint**: `position: sticky` — trace scroll-ancestor; check for `overflow: hidden`.

---

### VD-LAYOUT-11: Scrollbar gutter stability

**Severity**: POLISH
**Rationale**: When content grows past viewport height, the scrollbar appears and shifts content (on non-overlay scrollbar OSes — Windows). `scrollbar-gutter: stable` reserves space for the scrollbar even when not needed, preventing layout shift on content change.
**Source**: MDN scrollbar-gutter — https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter

**The rule**: surfaces where dynamic content can push past viewport height use `scrollbar-gutter: stable` to prevent shift.

**Code patterns to flag**:
- Long-form pages on Windows / Linux with no scrollbar-gutter declaration
- Modal / drawer with internal scroll that shifts content on overflow

**Correct pattern**: `html { scrollbar-gutter: stable; }` or per-container.

**Quick-fix hint**: dynamic-content containers — verify scrollbar-gutter set.

---

### VD-LAYOUT-12: Z-index scale, not magic numbers

**Severity**: POLISH
**Rationale**: `z-index: 9999` ad hoc in components produces stacking-context wars. A scale (10, 20, 30, ..., or named tokens `z-modal`, `z-dropdown`, `z-toast`) lets stacking order be reasoned about globally.
**Source**: Material Design 3 elevation — https://m3.material.io/styles/elevation/applying-elevation

**The rule**: z-index values come from a documented scale or named-token set. Arbitrary literals (`z-index: 9999`, `z-index: 50`) without scale reference are flagged.

**Code patterns to flag**:
- `z-index: 9999` for "above everything" without rationale
- Inline `z-index: 1` vs `z-index: 2` adjacent in code
- Multiple components claiming `z-index: 100`

**Correct pattern**: Tailwind `z-50` (or design tokens `--z-modal`, `--z-toast`); modal: 50, dropdown: 40, sticky-header: 30, base: 0.

**Quick-fix hint**: grep `z-index:` literals — verify they reference a scale.

---

### VD-LAYOUT-13: Overflow hidden vs clip

**Severity**: POLISH
**Rationale**: `overflow: hidden` creates a scrolling context (can be programmatically scrolled, blocks position:sticky as noted in VD-LAYOUT-10). `overflow: clip` clips visually without creating a scroll context — better when only clipping behavior is wanted.
**Source**: MDN overflow — https://developer.mozilla.org/en-US/docs/Web/CSS/overflow

**The rule**: when the intent is purely visual clipping (decorative overflow on cards, image masks), use `overflow: clip`. `overflow: hidden` reserved for actual scroll-blocked contexts.

**Code patterns to flag**:
- Cards with `overflow: hidden` for visual clipping that breaks `position: sticky` children
- Image masks using `overflow: hidden` when clipping alone is the goal

**Correct pattern**: `overflow: clip;` for visual-only; `overflow: hidden;` for scroll-blocked.

**Quick-fix hint**: `overflow: hidden` usage — evaluate intent (clip vs scroll-block).

---

### VD-LAYOUT-14: Print stylesheet basics

**Severity**: POLISH
**Rationale**: Pages without print styles produce poor PDF / printed output — sidebars and nav bleed into print, links lose their URLs, page breaks happen mid-element. Even minimal print styles (`@media print`) dramatically improve output.
**Source**: web.dev print-stylesheets — https://www.smashingmagazine.com/2015/01/designing-for-print-with-css/

**The rule**: content-bearing pages (articles, reports, invoices) have at least minimal `@media print` styles hiding nav / footer and ensuring URLs are visible on links.

**Code patterns to flag**:
- No `@media print` rules in stylesheet of long-form content pages
- Invoice / receipt pages with no print-specific layout

**Correct pattern**: `@media print { nav, footer { display: none; } a::after { content: " (" attr(href) ")"; } }`.

**Quick-fix hint**: long-form / printable content pages — check for print styles.

---

### VD-LAYOUT-15: Safe-area-inset for notched devices

**Severity**: MINOR
**Rationale**: iOS-notched devices reserve viewport edges for system UI (status bar, home indicator). Content placed flush to viewport edges via `padding: 0` gets clipped or obscured. `env(safe-area-inset-*)` exposes these bounds.
**Source**: web.dev safe-area-inset — https://webkit.org/blog/7929/designing-websites-for-iphone-x/

**The rule**: full-viewport-width layouts (PWAs, mobile apps, full-bleed sections) include safe-area-inset padding on top / bottom / sides.

**Code patterns to flag**:
- PWA manifest with `display: fullscreen` and no safe-area padding
- Mobile-web full-screen views (`100vw` width, `0` padding) on iOS

**Correct pattern**: `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);` + meta `viewport-fit=cover`.

**Quick-fix hint**: PWAs / full-bleed sections — verify safe-area-inset use.

---

### VD-LAYOUT-16: Grid fallback for older browsers (when applicable)

**Severity**: POLISH
**Rationale**: Modern CSS Grid is universally supported (97%+ as of 2024). Subgrid (CSS Grid Level 2) is newer — Safari 16+, Chrome 117+, Firefox 71+. Projects with older-browser support requirements need `@supports` fallback for subgrid.
**Source**: MDN subgrid — https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid

**The rule**: layouts using subgrid include `@supports (grid-template-rows: subgrid)` fallback if the project's browser support matrix includes pre-subgrid versions.

**Code patterns to flag**:
- `grid-template-rows: subgrid;` without `@supports` fallback in projects targeting older browsers
- Subgrid use without browserlist verification

**Correct pattern**:
```css
.grid { display: grid; /* fallback */ }
@supports (grid-template-rows: subgrid) {
  .grid { grid-template-rows: subgrid; }
}
```

**Quick-fix hint**: subgrid usage + project browser support matrix — verify fallback need.

---

### VD-LAYOUT-17: Avoid fixed pixel breakpoints

**Severity**: POLISH
**Rationale**: Fixed breakpoints (`@media (min-width: 1024px)`) ignore user font-size preferences. A user who bumps default font from 16px → 20px should see "desktop" layout at a smaller actual viewport. Em-based breakpoints respect this.
**Source**: web.dev em-rem-vh-vw — https://developer.mozilla.org/en-US/docs/Web/CSS/length

**The rule**: media-query breakpoints prefer `em` units over `px` — `@media (min-width: 64em)` over `@media (min-width: 1024px)`. The breakpoint adapts to user font-size.

**Code patterns to flag**:
- Stylesheet with all `min-width: <Npx>` breakpoints
- Tailwind config with `px`-based screens unless deliberate

**Correct pattern**: `@media (min-width: 48em) { /* tablet */ }`, `@media (min-width: 64em) { /* desktop */ }`.

**Quick-fix hint**: pixel-based breakpoints — consider em-based migration for new projects.
