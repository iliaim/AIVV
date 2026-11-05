# UI/UX — Data UX & Performance-UX

Part of [.aivv/standards/ui-ux/](README.md) (UX-022..026).

### UX-022: Filter / sort / pagination state persists in the URL

**Severity**: MAJOR
**Rationale**: If state lives only in memory, users lose their view on reload, can't share it, and the back button skips over state changes.
**Source**: https://blog.logrocket.com/url-state-usesearchparams/

**The rule**: For list pages with filters, sort, pagination, or tabs, the state is reflected in query params (or route segments) and drives rendering on load.

**Code patterns to flag**:
- `const [filter, setFilter] = useState()` driving a list, with no URL sync
- Tab UI that uses local state and resets on reload
- A "Share this view" feature that can't reconstruct the view from the URL

**Correct pattern**:
```jsx
const [params, setParams] = useSearchParams();
const status = params.get("status") ?? "all";
```

**Quick-fix hint**: Move filter/sort/page state to `useSearchParams` (or equivalent); read from URL, write via `setSearchParams`.

---

### UX-023: Never lazy-load the LCP / above-the-fold image

**Severity**: MAJOR
**Rationale**: `loading="lazy"` on the hero image delays LCP by hundreds of ms; Lighthouse flags it, users perceive a slower page.
**Source**: https://web.dev/articles/fetch-priority

**The rule**: Above-the-fold critical images use `loading="eager"` (or no `loading` attr) and, for the LCP candidate, `fetchpriority="high"`. Only below-the-fold images use `loading="lazy"`.

**Code patterns to flag**:
- `<img loading="lazy">` on the hero / first-screen image
- Every `<img>` getting `loading="lazy"` via blanket lint/codemod
- LCP image with `fetchpriority="low"` or `loading="lazy"`

**Correct pattern**:
```html
<img src="/hero.jpg" fetchpriority="high" alt="…" />
<img src="/thumb.jpg" loading="lazy" alt="…" />
```

**Quick-fix hint**: Reserve `loading="lazy"` for off-screen images; add `fetchpriority="high"` to the LCP image.

**See also**: **VVT-051** (`visual-verification-triggers/assets.md`) — runtime-verification trigger for `loading="lazy"` / `loading="eager"` changes, including viewport-position, CLS, JS-disabled, and browser-threshold behavior. **VVT-052** (same file) — runtime-verification trigger for `decoding` / `fetchpriority` hints, including resource-waterfall and LCP attribution checks.

---

### UX-024: Images require meaningful `alt` text (or `alt=""` if decorative)

**Severity**: MAJOR
**Rationale**: Missing alt causes screen readers to announce the filename; missing `alt=""` on decorative images pollutes the SR experience.
**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#authoring_meaningful_alternate_descriptions

**The rule**: Every `<img>` carries an `alt` attribute. Decorative images use `alt=""`. Content images describe the content / function.

**Code patterns to flag**:
- `<img src="logo.png">` with no `alt`
- `<img alt="image">` / `alt="photo"` / `alt={filename}`
- Icon-only buttons where the icon is `<img>` with no alt and no accessible button label

**Correct pattern**:
```jsx
<img src="/team.jpg" alt="Four engineers reviewing a whiteboard diagram" />
<img src="/divider.svg" alt="" />
```

**Quick-fix hint**: If the image conveys meaning, describe it; if not, `alt=""`.

---

### UX-025: Use a "Load more" button over pure infinite scroll for task-oriented lists

**Severity**: MINOR
**Rationale**: Pure infinite scroll hijacks scroll position, makes the footer unreachable, and loses users' place on back-navigation.
**Source**: https://www.nngroup.com/articles/infinite-scrolling-tips/

**The rule**: For lists where users hunt for specific items or need footer access, prefer paginated or "Load more" patterns. Pure infinite scroll is acceptable for discovery feeds only.

**Code patterns to flag**:
- `IntersectionObserver`-driven auto-pagination on a search results / task list page
- No restore of scroll position after back-navigation from a detail page
- Footer rendered once below a list that grows infinitely (unreachable)

**Correct pattern**:
```jsx
{hasMore && <button onClick={loadMore}>Load more</button>}
```

**Quick-fix hint**: Reach for "Load more" by default; justify pure infinite scroll case-by-case.

---

### UX-026: Responsive tables use an overflow container, card layout, or priority columns — not silent clipping

**Severity**: MAJOR
**Rationale**: A raw `<table>` on mobile overflows the viewport; content is clipped or triggers horizontal page-scroll on the whole body.
**Source**: https://css-tricks.com/under-engineered-responsive-tables/

**The rule**: Tables ship with either (a) a wrapping overflow container (`overflow-x: auto`, focusable with role="region"), (b) a mobile card-view breakpoint, or (c) a priority-columns strategy.

**Code patterns to flag**:
- Bare `<table>` with no wrapping `div` and no mobile-specific styles
- `table { overflow-x: auto }` (wrong element; belongs on a wrapper)
- Wrapping div has overflow but no `tabindex="0"` / `role="region"` / aria label

**Correct pattern**:
```html
<div role="region" aria-labelledby="tbl-caption" tabindex="0" style="overflow-x:auto">
  <table aria-labelledby="tbl-caption">…</table>
</div>
```

**Quick-fix hint**: Wrap the table and make the wrapper keyboard-scrollable and labeled.
