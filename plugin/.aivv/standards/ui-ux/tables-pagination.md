# UI/UX — Data tables & pagination

Part of [.aivv/standards/ui-ux/](README.md) (UX-037..041). Added dev.82 = T22 phase 2 — ARIA-APG-anchored + GOV.UK-pagination-anchored patterns for tabular data, sortable column headers, grid widgets, and pagination controls. Each rule cites a WebFetch-verified authoritative source per maintainer guidance "Per-rule WebFetch-verification discipline (dev.80+)".

**Scope discipline (peer-overlap deferrals):** static table semantics (`<table>` + `<caption>` + `<th scope>`) live in **A11Y-008** (`accessibility/semantic-structure.md`) — rules here cover *interactive* / *navigational* concerns layered on top of that baseline. Filter-chip patterns, page-size selectors, "Showing X–Y of Z" status text, and bulk-action toolbars were drafted but DEFERRED to a future phase because the NN/g + Baymard + Material-3 source URLs returned 404 on WebFetch verification (2026-05-11). Discipline-following per dev.80+: ship verified, defer unverifiable.

### UX-037: Sortable column headers communicate sort state via `aria-sort`

**Severity**: MAJOR
**Rationale**: Users who navigate with assistive technology cannot infer column sort state from visual chevrons / arrow icons alone. `aria-sort` exposes the current sort direction to screen readers; without it, sorted tables surface as undifferentiated columns to AT users. Only **one** column at a time may carry a non-`none` `aria-sort` value — multi-column sort state is not representable by this attribute.
**Source**: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-sort (WebFetch-verified 2026-05-11: "The `aria-sort` attribute should only be added to a single table or grid header at a time"; allowed values "`ascending`", "`descending`", "`none`", "`other`"; "Used in roles: `columnheader`, `rowheader`") + https://www.w3.org/WAI/ARIA/apg/patterns/grid/ (WebFetch-verified 2026-05-11: "If the grid provides sort functions, aria-sort is set to an appropriate value on the header cell element for the sorted column or row")

**The rule**: Sortable column header cells must (a) be activatable as buttons (keyboard- and pointer-clickable) and (b) carry `aria-sort="ascending"` / `"descending"` / `"none"` reflecting the current state. At most one column header in a given table carries a non-`none` value at a time. Permitted roles: `columnheader` (native `<th scope="col">` provides this) or `rowheader` (rare; for tables sorted by row).

**Code patterns to flag**:
- `<th>` rendered with a sort-chevron icon but no `aria-sort` attribute
- `<th aria-sort="ascending">` AND `<th aria-sort="descending">` on the same table (non-conformant — MDN guidance is to set on a single header at a time; multi-column sort state is not representable by this attribute)
- Sort indicator implemented purely as a CSS pseudo-element on a `<div>` header (`<div class="th">…<span class="sort-arrow"/></div>`) with no `<th>` semantics and no `aria-sort`
- Sort toggle bound to the chevron `<svg>` only (clickable area excludes the column label text)
- `aria-sort` on a non-header element (`<td>`, `<div>` outside a header context)

**Correct pattern**:
```html
<table>
  <caption>Open issues</caption>
  <thead>
    <tr>
      <th scope="col" aria-sort="ascending">
        <button type="button">Title <span aria-hidden="true">▲</span></button>
      </th>
      <th scope="col" aria-sort="none">
        <button type="button">Priority</button>
      </th>
      <th scope="col" aria-sort="none">
        <button type="button">Updated</button>
      </th>
    </tr>
  </thead>
  ...
</table>
```

**Quick-fix hint**: Apply `aria-sort` to exactly the currently sorted `<th>`; flip to `"none"` on every other header. Wrap the header label in a `<button>` so the activation target spans the whole cell, not just the chevron.

---

### UX-038: Use `role="grid"` only for interactive cell-navigation widgets; basic data tables use plain `<table>`

**Severity**: MAJOR
**Rationale**: The ARIA APG distinguishes two patterns for tabular content: (a) **table** — a static structure (no internal keyboard navigation, every focusable cell content participates in the page tab sequence individually), and (b) **grid** — an interactive composite widget with internal cell navigation and a single page-level tab stop. Applying `role="grid"` to a static table activates an interaction contract the implementation does not satisfy — AT users will press Arrow keys expecting cell navigation and find nothing happens. Conversely, omitting `role="grid"` on a spreadsheet-style interactive widget hides the composite-widget semantics from AT.
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/grid/ (WebFetch-verified 2026-05-11: "Only one of the focusable elements contained by the grid is included in the page tab sequence"; "using the `grid` role on an element does not necessarily imply that its visual presentation is tabular") + https://www.w3.org/WAI/ARIA/apg/patterns/table/ (WebFetch-verified 2026-05-11: "a WAI-ARIA table is a static tabular structure containing one or more rows that each contain one or more cells; it is not an interactive widget"; "All focusable elements contained in a table are included in the page tab sequence"; authors should use "a native HTML `table` element whenever possible")

**The rule**: Decision tree for tabular content:
1. **Static display data** (read-only rows + optional sort + optional pagination): use native HTML `<table>` per A11Y-008. Do NOT add `role="grid"`.
2. **Interactive cell-navigation widget** (spreadsheet, editable data grid, file-manager grid view): use `role="grid"` + roving-tabindex keyboard model (see UX-039). Native `<table>` may still be the host element, with grid/row/gridcell roles overlaid.
3. **Long lists of selectable items** (email inbox, search results): a `role="grid"` may be appropriate to collapse N row-level tab stops to 1 page-level tab stop, but only with the full grid keyboard model implemented.

**Code patterns to flag**:
- `<table role="grid">` with no internal arrow-key navigation handler (broken contract)
- `<div role="grid">` re-implementing what a `<table>` provides natively (use the native element)
- `role="grid"` applied because "it sounds like a table" without composite-widget interaction implemented
- `role="grid"` on a display-only data table where users only sort / filter / paginate (no cell-level focus)

**Correct pattern**:
```html
<!-- Static display table: NO role="grid" -->
<table>
  <caption>Open issues (sortable; one tab stop per row link)</caption>
  ...
</table>

<!-- Interactive grid widget: role="grid" + arrow-key handler.
     aria-rowcount applies only when the DOM does NOT contain every row
     (virtualized / lazy-loaded grids); omit for fully-rendered grids. -->
<div role="grid" aria-rowcount="500" aria-label="Inventory editor"
     onKeyDown={handleGridArrowKeys}>
  <div role="row">
    <div role="gridcell" tabIndex={isActive ? 0 : -1}>...</div>
  </div>
</div>
```

**Quick-fix hint**: If the widget does NOT implement Arrow / Home / End / Ctrl+Home / Ctrl+End cell navigation per UX-039, drop `role="grid"` and use a plain `<table>`. Static tables get full AT support without the role.

---

### UX-039: Grid widgets follow the ARIA APG keyboard model — Arrow keys + Home/End + Ctrl+Home/End + single tab stop via roving tabindex

**Severity**: MAJOR
**Rationale**: A widget that announces `role="grid"` to AT but does not implement the canonical keyboard model is worse than a plain table — AT users press the expected keys, nothing happens, and the focus model is broken (they cannot escape the widget except by Tab back through every cell). The ARIA APG defines a precise key set; partial implementations consistently surface as severe usability defects in AT testing.
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/data-grids/ (WebFetch-verified 2026-05-11: "Moves focus one cell to the right/left/up/down. If focus is on the right-most/left-most/bottom/top cell, focus does not move"; "Home moves focus to the first cell in the row that contains focus. End moves focus to the last cell in the row that contains focus"; "Control + Home moves focus to the first cell in the first row. Control + End moves focus to the last cell in the last row"; "the grid element is not focusable because it implements the practice described in the section on Managing Focus Within Components Using a Roving tabindex") + https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ (APG-OPTIONAL note: the APG Keyboard Interface practice explicitly sanctions TWO strategies — "creating a roving `tabindex` and using the `aria-activedescendant` property" — for managing focus inside composite widgets; this rule's "Single tab stop" bullet accepts either)

**The rule**: A widget with `role="grid"` must implement ALL of:
- **Single tab stop**: exactly one focusable element at a time within the grid; all others are removed from the page tab sequence. APG sanctions **two equivalent strategies** for managing this — (a) **roving `tabindex`** (one cell carries `tabindex="0"`, others carry `tabindex="-1"`, focus moves with the active cell), or (b) **`aria-activedescendant`** (grid container itself is focusable with `tabindex="0"`, `aria-activedescendant` points to the active cell's `id`, DOM focus never moves). Either is APG-sanctioned per APG's Keyboard Interface practice. Repo-internal precedent for the OR framing: A11Y-052 (Menu), A11Y-054 (Radio Group), A11Y-057 (Tabs).
- **Arrow keys**: ← / → / ↑ / ↓ move the active cell by one within the grid. Arrow at the edge does not wrap (focus stays).
- **Home / End**: move to the first / last cell of the current row.
- **Ctrl+Home / Ctrl+End**: move to the first cell of the first row / last cell of the last row.
- **Tab**: leaves the grid (focus / active cell moves to the next page-level tab stop). Shift+Tab returns to the previously active cell.

**Code patterns to flag**:
- `role="grid"` with every cell carrying `tabindex="0"` (defeats the single-tab-stop contract)
- Arrow-key handler that updates DOM focus on Arrow keys but does NOT also move the `tabindex="0"` marker to the new cell (focus reverts on next Tab)
- Missing Home/End handling (Arrow-only widgets fail screen-reader user expectations)
- Arrow at the edge wraps to the opposite side (non-standard; APG specifies "focus does not move")
- Grid container has its own `tabindex="0"` in addition to a cell (double tab stop)

**Correct pattern** (roving-tabindex strategy):
```jsx
function DataGrid({ rows }) {
  const numRows = rows.length;
  const numCols = rows[0]?.cells.length ?? 0;
  const [active, setActive] = useState({ row: 0, col: 0 });
  const onKey = (e) => {
    const { row, col } = active;
    // Ctrl-modified branches MUST precede plain Home/End — plain branches
    // would otherwise match first and shadow the Ctrl-qualified behavior.
    if      (e.key === "Home" && e.ctrlKey) setActive({ row: 0, col: 0 });
    else if (e.key === "End"  && e.ctrlKey) setActive({ row: numRows - 1, col: numCols - 1 });
    else if (e.key === "ArrowRight") setActive({ row, col: Math.min(col + 1, numCols - 1) });
    else if (e.key === "ArrowLeft")  setActive({ row, col: Math.max(col - 1, 0) });
    else if (e.key === "ArrowDown")  setActive({ row: Math.min(row + 1, numRows - 1), col });
    else if (e.key === "ArrowUp")    setActive({ row: Math.max(row - 1, 0), col });
    else if (e.key === "Home")       setActive({ row, col: 0 });
    else if (e.key === "End")        setActive({ row, col: numCols - 1 });
    else return;
    e.preventDefault();
  };
  return (
    <div role="grid" aria-label="..." onKeyDown={onKey}>
      {rows.map((r, ri) => (
        <div role="row" key={ri}>
          {r.cells.map((c, ci) => (
            <div role="gridcell"
                 tabIndex={ri === active.row && ci === active.col ? 0 : -1}>
              {c}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Alternative correct pattern** (aria-activedescendant strategy — equivalent under APG):
```jsx
<div role="grid" aria-label="..." tabIndex={0}
     aria-activedescendant={`cell-${active.row}-${active.col}`}
     onKeyDown={onKey}>
  {rows.map((r, ri) => (
    <div role="row" key={ri}>
      {r.cells.map((c, ci) => (
        <div role="gridcell" id={`cell-${ri}-${ci}`}>{c}</div>
      ))}
    </div>
  ))}
</div>
```

**Quick-fix hint**: If you cannot commit to implementing the full key set (Arrow + Home + End + Ctrl+Home + Ctrl+End + roving tabindex OR aria-activedescendant), drop `role="grid"` and ship a plain `<table>` per UX-038.

---

### UX-040: Pagination wraps in `<nav aria-label="Pagination">` with `aria-current="page"` on the active page

**Severity**: MAJOR
**Rationale**: A pagination control is a navigation region — assistive technology surfaces `<nav>` landmarks for jump-to-region navigation. Without the `<nav>` wrapper and explicit `aria-label`, AT users cannot distinguish pagination from primary site navigation. `aria-current="page"` is the standard way to communicate "this link points to the page you are currently viewing"; visual-only highlighting (background color, bold weight) does not reach AT.
**Source**: https://design-system.service.gov.uk/components/pagination/ (WebFetch-verified 2026-05-11: `<nav class="govuk-pagination" aria-label="Pagination">`; `<a class="govuk-link govuk-pagination__link" href="#" aria-label="Page 2" aria-current="page">2</a>`) + https://www.w3.org/TR/wai-aria-1.2/#aria-current (ARIA 1.2: `aria-current` "marks the element that represents the current item within a container or set of related elements" — single-item semantics)

**The rule**: A pagination control consists of (a) a `<nav>` element wrapping the entire control, (b) `aria-label="Pagination"` (or equivalent localized string) distinguishing it from main navigation, and (c) on the currently displayed page's link, `aria-current="page"`. Per ARIA 1.2's single-item semantics for `aria-current`, only one link in the set carries the attribute at a time. Numbered page links may additionally carry `aria-label="Page N"` to give AT users a more descriptive announcement than the bare number.

**Code patterns to flag**:
- `<div>` or `<ul>` wrapping pagination links with no surrounding `<nav>`
- `<nav>` with no `aria-label` (collides with main `<nav>` landmark in AT region list)
- Current page rendered as a visually-styled `<span>` / `<a>` with no `aria-current="page"` attribute
- `aria-current="true"` instead of `aria-current="page"` (non-canonical; less informative announcement)
- `aria-current` applied to multiple links simultaneously (violates ARIA 1.2 single-item semantics)

**Correct pattern**:
```html
<nav class="pagination" aria-label="Pagination">
  <ul>
    <li><a href="?page=1" aria-label="Page 1">1</a></li>
    <li><a href="?page=2" aria-label="Page 2" aria-current="page">2</a></li>
    <li><a href="?page=3" aria-label="Page 3">3</a></li>
  </ul>
</nav>
```

**Quick-fix hint**: Wrap the pagination region in `<nav aria-label="Pagination">`; replace the current-page styling marker with `aria-current="page"` on exactly the active link.

---

### UX-041: Previous / Next pagination links use `rel="prev"` / `rel="next"` + visually-hidden "page" suffix for screen-reader clarity

**Severity**: MINOR
**Rationale**: Stand-alone "Previous" / "Next" links are ambiguous in AT link-list mode where surrounding context is stripped — a screen-reader user reading the list of links hears "Previous, Next" without knowing what's being paged. Visually-hidden " page" suffix produces the AT-rendered phrase "Previous page" / "Next page" while keeping the visual label compact. `rel="prev"` / `rel="next"` provides machine-readable navigation semantics that user agents and assistive technology can expose as keyboard shortcuts.
**Source**: https://design-system.service.gov.uk/components/pagination/ (WebFetch-verified 2026-05-11: `<a class="govuk-link govuk-pagination__link" href="#" rel="prev">`; `<a class="govuk-link govuk-pagination__link" href="#" rel="next">`; `<span class="govuk-visually-hidden"> page</span>` pattern producing "Previous page" / "Next page" for AT while showing only "Previous" / "Next" visually)

**The rule**: When a pagination control includes "Previous" / "Next" links (either alone in a "block" pagination layout, or alongside numbered links in a "numbered" layout), each link should carry: (a) `rel="prev"` or `rel="next"` respectively, and (b) either a full accessible name ("Previous page" / "Next page" via `aria-label` or visible text) or a visually-hidden `<span>` providing the " page" suffix when the visible label is the short form.

**Code patterns to flag**:
- `<a href="?page=3">Previous</a>` with no `rel` and no AT-name extension
- `<button>‹</button>` / `<button>›</button>` arrow-only pagination with no accessible label (icon-only; fails by buttons-vs-icons rule too)
- `rel="prev"` AND `rel="next"` on the same link (illegal)
- `aria-label="Previous"` without including "page" — same ambiguity as the visible-text-only case

**Correct pattern**:
```html
<!-- Block pagination (content paging): -->
<nav class="pagination" aria-label="Pagination">
  <a class="prev" href="?page=2" rel="prev">
    Previous<span class="visually-hidden"> page</span>
  </a>
  <a class="next" href="?page=4" rel="next">
    Next<span class="visually-hidden"> page</span>
  </a>
</nav>

<!-- Numbered pagination: prev/next alongside page numbers -->
<nav class="pagination" aria-label="Pagination">
  <a href="?page=2" rel="prev" aria-label="Previous page">‹ Prev</a>
  <ol>
    <li><a href="?page=2" aria-label="Page 2">2</a></li>
    <li><a href="?page=3" aria-label="Page 3" aria-current="page">3</a></li>
    <li><a href="?page=4" aria-label="Page 4">4</a></li>
  </ol>
  <a href="?page=4" rel="next" aria-label="Next page">Next ›</a>
</nav>
```

**Quick-fix hint**: Add `rel="prev"` / `rel="next"` to the navigation links AND extend their accessible name to include "page" via visually-hidden text or `aria-label`. The visible label can remain short.

---

## See also (cross-references)

- **A11Y-008** (`accessibility/semantic-structure.md`) — static table semantics (`<table>` + `<caption>` + `<th scope="col"/"row">`); the WCAG-baseline foundation that UX-037..039 build on.
- **A11Y-067** (`accessibility/semantic-structure.md`) — `<nav aria-label="breadcrumb">` + `aria-current="page"`; sister pattern to UX-040 for breadcrumb navigation.
- **UX-022** (`ui-ux/data-performance.md`) — filter / sort / pagination state persists in URL; required pairing for any UX-040 pagination control (page number lives in URL, not local state).
- **UX-025** (`ui-ux/data-performance.md`) — "Load more" over pure infinite scroll for task-oriented lists; complementary pagination pattern for cases where numbered pagination is not the right fit.
- **UX-026** (`ui-ux/data-performance.md`) — responsive tables use overflow container / card layout / priority columns; pairs with UX-037..039 for mobile table rendering.
- **IS-018** (`interaction-states/async-lists.md`) — pagination must preserve scroll position on back-nav; runtime-state companion to URL-state rule UX-022.
- **HEU-LUX-millers** + **HEU-LUX-chunking** (`ux-heuristics/laws-of-ux/memory-cognition.md`) — Miller's Law (7±2 working-memory chunks) and chunking; rationale for paginating long lists.
