# Accessibility — Semantic structure & landmarks

Part of [.aivv/standards/accessibility/](README.md) (A11Y-004..008, A11Y-041, A11Y-065..067).

### A11Y-004: Use landmark elements for page regions

**Severity**: MAJOR
**WCAG**: 1.3.1 Level A, 2.4.1 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/

**The rule**: Top-level page regions must be expressed with semantic landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`) or equivalent ARIA roles, not generic `<div>`s.

**Code patterns to flag**:
- Page layouts built entirely from `<div>`s for header/nav/main/footer
- Multiple `<main>` elements on the same page
- Redundant role on native landmark (e.g., `<nav role="navigation">`)
- Landmarks missing accessible names when the same type appears more than once (e.g., two `<nav>`s without `aria-label`)

**Correct pattern**:
```html
<header>…</header>
<nav aria-label="Primary">…</nav>
<main>…</main>
<aside aria-label="Related">…</aside>
<footer>…</footer>
```

**Quick-fix hint**: Replace layout `<div>`s with the matching semantic element; label repeated landmarks with `aria-label`.

**See also**: **COMP-WCAG-AAA-07** (`compliance/wcag-aaa.md`, "Identify purpose of UI components, icons, and regions") — A11Y-004 enforces landmark structure as the AA-baseline 1.3.1 mechanism; COMP-WCAG-AAA-07 elevates landmark coverage to the strict-AAA programmatically-identifiable-purpose requirement (WCAG 1.3.6) extending beyond page regions to UI components and icons.

---

### A11Y-005: Provide a skip link to bypass repeated navigation

**Severity**: MAJOR
**WCAG**: 2.4.1 Level A
**Source**: https://www.w3.org/WAI/WCAG21/Techniques/general/G1

**The rule**: The first focusable element of the page must allow keyboard users to jump past repeated navigation to the main content.

**Code patterns to flag**:
- No `<a href="#main">` (or equivalent) at the top of `<body>`
- Skip link exists but target `id` does not exist in the DOM
- Skip link permanently hidden with `display: none` (removes it from tab order) instead of visually-hidden-until-focus

**Correct pattern**:
```html
<a class="skip-link" href="#main">Skip to main content</a>
…
<main id="main" tabindex="-1">…</main>
```

**Quick-fix hint**: Add a top-of-page `<a href="#<main-id>">` styled as visually-hidden until focused.

**See also**: **COMP-WCAG-AAA-09** (`compliance/wcag-aaa.md`, "Provide location information within a set of pages") — A11Y-005 is a navigation-bypass mechanism (WCAG 2.4.1 AA) complementary to AAA-09's location-disclosure mechanisms (breadcrumbs, site maps, `aria-current="page"`); together they support landmark-based wayfinding within a multi-page site.

---

### A11Y-006: Heading hierarchy must be logical and not skip levels

**Severity**: MAJOR
**WCAG**: 1.3.1 Level A, 2.4.6 Level AA
**Source**: https://www.a11yproject.com/checklist/

**The rule**: Headings must express content structure: exactly one `<h1>` per page, and subsequent levels descend without skipping (no `<h2>` directly followed by `<h4>`).

**Code patterns to flag**:
- Zero or multiple `<h1>` elements on the same page
- A level skipped on the way down (`<h2>` → `<h4>`)
- Styled `<div>` or `<p>` with class like `heading-lg` instead of an actual heading element
- Empty heading (`<h2></h2>`)
- Heading used purely for visual size (content isn't a section title)

**Correct pattern**:
```html
<h1>Product</h1>
  <h2>Specs</h2>
    <h3>Dimensions</h3>
  <h2>Reviews</h2>
```

**Quick-fix hint**: Renumber to close any skipped levels; convert class-styled "headings" to real `<h2>`–`<h6>`.

**See also**: **COMP-WCAG-AAA-14** (`compliance/wcag-aaa.md`, "Section headings organize the content") — A11Y-006 enforces *correct heading hierarchy* (WCAG 1.3.1 A + 2.4.6 AA); COMP-WCAG-AAA-14 enforces *coverage*: that sufficient section headings exist to organize long-form content (WCAG 2.4.10 AAA). The two rules are orthogonal axes — hierarchy correctness vs. heading coverage.

---

### A11Y-007: Use list elements for list content

**Severity**: MINOR
**WCAG**: 1.3.1 Level A
**Source**: https://www.a11yproject.com/checklist/

**The rule**: Series of related items must be marked up as `<ul>`, `<ol>`, or `<dl>` with proper children, not as sibling `<div>`s or `<p>`s.

**Code patterns to flag**:
- Repeated cards / menu items rendered as sibling `<div>`s with no list wrapper
- `<ul>` containing non-`<li>` children other than script-supporting tags
- Definition data in raw `<div>`s instead of `<dl>`/`<dt>`/`<dd>`

**Correct pattern**:
```jsx
<ul>
  {items.map(i => <li key={i.id}>{i.label}</li>)}
</ul>
```

**Quick-fix hint**: Wrap iterable UI groups in `<ul>`/`<ol>` and render each item as `<li>`.

**See also**: **COMP-APG-04** (`compliance/aria-apg-full.md`, "Feed — `role='feed'` + `aria-busy` + per-article `aria-posinset` / `aria-setsize`") — A11Y-007 covers finite enumerable list semantics (`<ul>` / `<ol>`); COMP-APG-04 covers the infinite-scroll / progressive-load case where list semantics don't fit and the APG Feed pattern governs instead (lazy-loaded articles, position-in-set announcement, busy state during fetches).

---

### A11Y-008: Tabular data must use `<table>` with header cells

**Severity**: MAJOR
**WCAG**: 1.3.1 Level A
**Source**: https://www.w3.org/WAI/WCAG21/Techniques/html/H51

**The rule**: Two-dimensional data relationships must use `<table>` with `<th>` header cells carrying a `scope` attribute; a `<caption>` describes the table.

**Code patterns to flag**:
- Tabular data built from `<div>` grids
- `<table>` with no `<th>` (all `<td>`)
- `<th>` without `scope="col"` or `scope="row"`
- Missing `<caption>` on a data table
- `role="presentation"` or `role="none"` on a data table

**Correct pattern**:
```html
<table>
  <caption>Quarterly revenue</caption>
  <thead>
    <tr><th scope="col">Quarter</th><th scope="col">USD</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Q1</th><td>1.2M</td></tr>
  </tbody>
</table>
```

**Quick-fix hint**: Convert the grid to a real `<table>`; add `scope` to every `<th>` and a descriptive `<caption>`.

**See also**: **COMP-APG-05** (`compliance/aria-apg-full.md`, "Grid — `role='grid'` + cell navigation keyboard model + `aria-rowindex` / `aria-colindex` for virtual grids") — A11Y-008 governs the read-only tabular-data case (native `<table>` + `<th>` headers); COMP-APG-05 covers the *interactive*-grid case where arrow-key cell navigation + cell editing + virtualization compose. The two rules are mutually exclusive — a UI is either a read-only table (A11Y-008) OR an interactive grid (COMP-APG-05), not both. **COMP-APG-15** (`compliance/aria-apg-full.md`, "Table (interactive sorting) — `aria-sort` on `columnheader` + grid-role when interactivity dominates") — A11Y-008 covers the read-only baseline; COMP-APG-15 extends to interactive-sort tables that retain `<table>` semantics (when sort is the ONLY interactivity), elevating to `role="grid"` (COMP-APG-05) when cell-level navigation or editing also exist.

---

### A11Y-041: Help mechanism placement must be consistent across pages

**Severity**: MINOR
**WCAG**: 3.2.6 Level A (WCAG 2.2 NEW)
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html

**The rule**: When a set of pages provides one or more help mechanisms (contact details, contact mechanism, self-help option, automated contact mechanism), they must occur in the same relative order across pages where they appear.

**Code patterns to flag**:
- A help mechanism added in a layout component for one route's wrapper (e.g., `app/(marketing)/layout.tsx`) but not its sibling routes that share the same site shell
- "Contact us" / "Help" / chatbot trigger moved between header and footer across page templates with no shared layout primitive
- Per-route hard-coded placement (vs. shared `<SiteHeader>` / `<SiteFooter>` component) that drifts between pages
- Layout-restructure PR where a help link's position changes relative to its sibling navigation items

**Correct pattern**: place help mechanisms inside a shared layout primitive (`<SiteHeader>`, `<SiteFooter>`, persistent `<HelpWidget>`) used across the page set. Per-page omission is allowed; per-page reordering is not.

**Quick-fix hint**: When a PR introduces or moves a help mechanism, confirm it lives in a layout primitive shared by the page set OR that the change is applied consistently to every page in the set.

**Diff-scope caveat**: hard to verify from a single-file diff. Raise when a layout/route restructure changes a help mechanism's position OR when a help link is added to one page but not its siblings.

**See also**: **COMP-WCAG-AAA-13** (`compliance/wcag-aaa.md`, "Context-sensitive help is available") — A11Y-041 enforces WCAG 3.2.6 Consistent Help (Level A) requiring help-mechanism *placement consistency* across pages; COMP-WCAG-AAA-13 is the orthogonal AAA SC (WCAG 3.3.5) requiring that *context-sensitive help itself exists* on every page that requests user input. A11Y-041 governs WHERE help lives, AAA-13 governs that it lives at all.

---

### A11Y-065: Each page should have a clear, descriptive `<h1>` (typically one) near the top of main content

**Severity**: MAJOR
**WCAG**: 2.4.6 Headings and Labels Level AA (descriptiveness only; single-h1 is best practice, not a WCAG requirement)
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html, https://html.spec.whatwg.org/multipage/sections.html#headings-and-sections
**COGA**: O1 (Help users understand what things are)

**The rule**: Every distinct page (or route in an SPA) should have a clear `<h1>` near the top of main content, describing the page's purpose. HTML5 sectioning content (`<article><h1>...</h1></article>`) permits multiple `<h1>` within nested sections — but for top-level page identity, prefer a single, descriptive `<h1>` for AT navigation predictability. SPA route changes must update the `<h1>` and ideally move focus to it.

**Code patterns to flag**:
- Page template with **no `<h1>`** at all (most common defect; AT users lose the "where am I" landmark) — MAJOR
- `<h1>` content is a logo image / brand mark only with no text equivalent (use `<h1><img alt="Site Name">` OR keep `<h1>` text + logo as background image) — MAJOR
- SPA route change does not update the `<h1>` or focus position — MAJOR (real AT regression on every navigation)
- Multiple top-level `<h1>` outside `<article>`/`<section>` sectioning context (multiple page-identity h1s; pick one) — MINOR best-practice drift

**Correct pattern**:
```html
<main>
  <h1>Edit profile</h1>
  <section>
    <h2>Personal information</h2>
    …
  </section>
</main>
```

**Quick-fix hint**: Each page/route has ≥1 descriptive `<h1>` near the top of `<main>`. For SPAs, programmatically update the `<h1>` and move focus to it on route change. Multiple `<h1>` inside HTML5 sectioning content is technically valid but harder for AT users to scan — prefer one top-level page-identity `<h1>` when feasible.

**See also**: **COMP-WCAG-AAA-14** (`compliance/wcag-aaa.md`, "Section headings organize the content") — A11Y-065 enforces page-level `<h1>` presence (WCAG 2.4.6 AA on descriptiveness); COMP-WCAG-AAA-14 extends the requirement to *intra-page section* headings (WCAG 2.4.10 AAA) — long-form content needs `<h2>` / `<h3>` section headings beyond the top-level `<h1>` that A11Y-065 covers.

---

### A11Y-066: Heading levels in source order should not skip (best practice)

**Severity**: MINOR
**WCAG**: G141 Advisory technique for 1.3.1 / 2.4.6 (not a Sufficient technique — heading-level-skip is widely-recognized best-practice violation but not a strict WCAG conformance failure)
**Source**: https://www.w3.org/WAI/WCAG21/Techniques/general/G141 (Advisory), https://webaim.org/techniques/semanticstructure/

**The rule**: Heading levels in DOM source order should form a contiguous hierarchy: `<h1>` → `<h2>` → `<h3>` etc. Avoid skipping a level descending (e.g., `<h1>` directly to `<h3>` with no `<h2>` between). Visual styling is separate from semantic level — use CSS to restyle, not the heading element to "skip" levels. Note: this is best-practice advisory per G141, not a strict WCAG SC failure — WCAG 1.3.1 + 2.4.6 require programmatic structure + descriptive headings respectively, neither mandates hierarchical level use.

**Code patterns to flag**:
- `<h1>...</h1><h3>...</h3>` with no `<h2>` between them (skip)
- `<h1>` followed by `<h4>` in source order
- Custom heading-style components (e.g., `<Heading variant="large">`) where the rendered `<h*>` element is decoupled from visual size and produces source-order skips
- "Visually a heading" `<div role="heading" aria-level>` with level-skip vs surrounding native headings

**Correct pattern**:
```html
<h1>Page title</h1>
<h2>Major section</h2>
<h3>Subsection</h3>
<h3>Another subsection</h3>
<h2>Next major section</h2>
```

**Quick-fix hint**: When restyling, use CSS class on the heading element, not a different `<h*>` level. If a `<h3>` needs to look like a `<h2>`, write `<h3 className="text-2xl">`, not `<h2>`.

**See also**: **COMP-WCAG-AAA-14** (`compliance/wcag-aaa.md`, "Section headings organize the content") — A11Y-066 enforces heading-level non-skipping in source order (advisory per G141); COMP-WCAG-AAA-14 is the orthogonal AAA SC (WCAG 2.4.10) requiring that section headings *exist* to organize content (heading coverage vs. heading-hierarchy correctness).

---

### A11Y-067: Breadcrumb navigation uses `<nav aria-label="breadcrumb">` + `aria-current="page"`

**Severity**: MINOR
**WCAG**: 2.4.8 Location Level AAA (informational), 1.3.1 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
**COGA**: O2 (Help users find what they need)

**The rule**: Breadcrumb trails must be wrapped in `<nav>` with `aria-label="breadcrumb"` (distinguishes from main nav for AT users); the current page item carries `aria-current="page"` so AT announces "current page" when navigating.

**Code patterns to flag**:
- Breadcrumb rendered as plain `<ul>` / `<div>` chevron-separated text with no `<nav>` wrapper
- Multiple `<nav>` landmarks on a page without `aria-label` distinguishing them (breadcrumb vs primary nav vs sidebar nav)
- Current page in breadcrumb rendered as a non-link with no `aria-current="page"`
- Visual chevron separators (`>`) inserted via CSS `::before` content — fine for sighted, but AT announces them; use `aria-hidden` on the separator or omit from text

**Correct pattern**:
```html
<nav aria-label="breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/blog">Blog</a></li>
    <li aria-current="page">Article title</li>
  </ol>
</nav>
```

**Quick-fix hint**: `<nav aria-label="breadcrumb">` + ordered list + `aria-current="page"` on the leaf. Hide CSS-injected chevron separators from AT (`::before { content: ">"; speak: never; }` is non-standard but useful with `aria-hidden` on wrapper, OR use a real `<span aria-hidden="true">›</span>` between items).

**See also**: **COMP-WCAG-AAA-09** (`compliance/wcag-aaa.md`, "Provide location information within a set of pages") — A11Y-067 enforces the *structural* form of breadcrumb markup (correct `<nav aria-label="breadcrumb">` + `aria-current="page"`); COMP-WCAG-AAA-09 is the *coverage* AAA SC requiring some location-disclosure mechanism (breadcrumb, site map, current-page indication, or `aria-current`) exists on every page within a set.
