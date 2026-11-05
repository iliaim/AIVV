# UI/UX — Search inputs, filter grouping & status messages

Part of [.aivv/standards/ui-ux/](README.md) (UX-042..046). Added dev.83 = T22 phase 3 — MDN-`<search>` + MDN-`<input type="search">` + ARIA-APG-search-landmark + WCAG-4.1.3-status-messages + ARIA-APG-checkbox-mixed + MDN-aria-checked + MDN-`<fieldset>`/`<legend>` + W3C-WAI-forms-grouping anchored patterns for search inputs, filter checkbox grouping, tri-state select-all, and live-announced result counts. Each rule cites a WebFetch-verified authoritative source per maintainer guidance "Per-rule WebFetch-verification discipline (dev.80+)".

**Scope discipline (peer-overlap deferrals):** combobox / autocomplete / typeahead semantics live in **A11Y-048** (`accessibility/aria/apg-widgets.md`); debounce timing for search-as-you-type lives in **HEU-LUX-doherty** (`ux-heuristics/laws-of-ux/timing-perception.md`); empty filter-results microcopy lives in **MC-023** (`microcopy/empty-states.md`); URL state for filter/sort/pagination lives in **UX-022** (`ui-ux/data-performance.md`). Rules here cover *complementary* concerns: search-input landmarking, filter-group labelling, tri-state select-all semantics, and result-count live-announcement under WCAG 4.1.3. Initially-drafted candidate rules covering visible filter chip pattern and "Clear all filters" affordance and page-size selector and bulk-action toolbar were DEFERRED again from phase 3 because the NN/g + Material 3 source URLs continue to 404; phase 4 should attempt yet-other sources (`role="toolbar"` APG pattern for bulk action toolbars; `<output>` HTML element + ARIA 1.2 spec section 6.7 for result-count semantics if WebFetch can reach it).

### UX-042: Search inputs are wrapped in `<search>` (or `<form role="search">`) with a descriptive accessible name

**Severity**: MAJOR
**Rationale**: A search input outside a search landmark surfaces as a plain text field to AT region navigation — users who jump by landmark (a primary AT navigation mode) cannot find the search functionality. The `<search>` HTML element (Baseline widely available since October 2023) defines the search landmark natively; `<form role="search">` is the pre-`<search>`-element fallback. The accessible name distinguishes the search from other landmarks on the page (per APG: "If a page includes more than one `search` landmark, each should have a unique label").
**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/search (WebFetch-verified 2026-05-12: "The `<search>` element semantically identifies the purpose of the element's contents as having search or filtering capabilities"; "The `<search>` element defines a `search` landmark. This removes the need for adding `role=search` to a `<form>` element"; "Baseline Widely available... since October 2023") + https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/search.html (WebFetch-verified 2026-05-12: "Use the `search` landmark instead of the `form` landmark when the form is used for search functionality"; "If a page includes more than one `search` landmark, each should have a unique label")

**The rule**: A site-or-page search facility SHOULD be wrapped in `<search>` (preferred — modern Baseline element) OR `<form role="search">` (pre-`<search>` fallback), and SHOULD carry an accessible name via `aria-label` / `aria-labelledby` when (a) the page has more than one search landmark (per APG: "each should have a unique label") or (b) the visible label is not adjacent to the input. The accessible name should describe what is being searched — "Search the docs" beats bare "Search". The SHOULD-not-MUST framing reflects the cited sources' descriptive-not-mandatory language; MAJOR severity reflects the user-impact (AT region-navigation breakage) even though no source uses normative-MUST wording.

**Code patterns to flag**:
- `<input type="search">` placed in body markup with no surrounding `<search>` or `role="search"` form
- `<form>` containing search controls with no `role="search"` (and not wrapped in `<search>`)
- Multiple search landmarks on one page with identical or missing accessible names
- Search input with `placeholder` text as the only label and no `aria-label` (placeholder-as-label anti-pattern; defer-to UX-002 in `ui-ux/forms.md` + MC-013 in `microcopy/labels-fields.md`)
- `<div>`/`<section>` mimicking a search form with no landmark role

**Correct pattern**:
```html
<!-- Modern Baseline: <search> element provides landmark natively -->
<search aria-label="Search documentation">
  <form action="/search">
    <label for="q">Search</label>
    <input id="q" type="search" name="q" />
    <button type="submit">Search</button>
  </form>
</search>

<!-- Pre-<search>-element fallback -->
<form role="search" aria-label="Search documentation" action="/search">
  <label for="q">Search</label>
  <input id="q" type="search" name="q" />
  <button type="submit">Search</button>
</form>
```

**Quick-fix hint**: Wrap the search `<form>` in `<search>` (or add `role="search"`); add `aria-label="Search …"` when ambiguity is possible.

---

### UX-043: Result counts after a filter / search / sort change are announced via `role="status"` (WCAG 4.1.3 Status Messages, AA)

**Severity**: MAJOR
**Rationale**: After a filter or search updates the list of results, sighted users perceive the change immediately ("now showing 12 results, was 47"). Keyboard / AT users who issued the filter from a checkbox or sort dropdown often do not receive equivalent feedback unless the result-count region is a live region — the page silently re-renders and the user has no signal that anything changed. WCAG 4.1.3 Status Messages (Level AA) mandates this kind of status be programmatically determined without receiving focus. `role="status"` carries implicit `aria-live="polite"` and `aria-atomic="true"` — designed exactly for non-urgent advisory information like result counts. `role="alert"` is too aggressive (interrupts current activity); `role="log"` is for sequential additions (chat / log streams), not updated counts.
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html (WebFetch-verified 2026-05-12 + IV&V re-verified: WCAG 4.1.3 example list for search-status messages — `"Searching..."`, `"18 results returned"`, `"No results returned"` are listed verbatim as Status Message examples; conformance: "status messages can be programmatically determined through role or properties such that they can be presented to the user by assistive technologies without receiving focus"; allowed roles: `role="status"`, `role="alert"`, `role="log"`) + https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role (WebFetch-verified 2026-05-12: "Elements with the role `status` have an implicit `aria-live` value of `polite`"; "implicit `aria-atomic` value of `true`"; "a type of live region providing advisory information that is not important enough to justify an alert"; "Do not give focus to the status when its content updates")

**The rule**: A region surfacing the count or summary of filtered / searched results uses `role="status"` (or a native element with the equivalent live-region behavior such as `<output>`). The element must exist in the DOM at page load (live regions cannot be added at the same time their first message appears — the AT polls only pre-existing live regions). The element MUST NOT receive focus when its content updates.

**Code patterns to flag**:
- `<div>Showing {count} results</div>` rendered conditionally — no live-region role; AT users get no announcement
- `<p role="alert">{count} results</p>` for routine filter changes — aggressive interruption; misuse of `alert` for advisory info (cf. A11Y-046)
- `aria-live="polite"` added programmatically AFTER the count first updates — the region must pre-exist before its first content change
- `tabIndex` set on the result-count region (causes focus shift — violates WCAG 4.1.3 "without receiving focus")
- `aria-live="assertive"` on result counts — should be polite for advisory info

**Correct pattern**:
```jsx
function ResultsList({ items, query }) {
  return (
    <>
      <p role="status">
        {items.length === 0
          ? `No results for "${query}"`
          : `${items.length} result${items.length === 1 ? "" : "s"} for "${query}"`}
      </p>
      <ul>
        {items.map(i => <li key={i.id}>{i.title}</li>)}
      </ul>
    </>
  );
}
```

**Quick-fix hint**: Add `role="status"` to the existing result-count line; never `role="alert"` for routine filter updates.

---

### UX-044: Tri-state "Select all" checkbox uses `aria-checked="mixed"` (or DOM `indeterminate`) when some-but-not-all rows are selected

**Severity**: MAJOR
**Rationale**: A multi-select list with a "Select all" master checkbox at the top has three logical states — none selected (unchecked), all selected (checked), some selected (partial). Without a tri-state indicator, AT users hear "checkbox checked" or "checkbox not checked" when the actual state is "partial" — losing essential information about the current selection. ARIA defines `aria-checked="mixed"` precisely for this case; the DOM `indeterminate` property on native checkboxes produces the equivalent AT exposure via accessibility-tree mapping.
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-mixed/ (WebFetch-verified 2026-05-12: "If the set contains both some checked and unchecked checkboxes, the mixed state checkbox is partially checked"; "Indicates the tri-state `checkbox` is mixed. In this state, some controlled checkboxes are unchecked and some are checked") + https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-checked (WebFetch-verified 2026-05-12: "for `checkbox` and `menuitemcheckbox` only, equivalent to `indeterminate`, indicating a mixed mode value of neither checked nor unchecked"; "The `mixed` value is not supported on `radio`, `menuitemradio`, or `switch`")

**The rule**: A master / "select all" checkbox controlling a set of child checkboxes (e.g., row-selection in a data list, "select all permissions" in a settings panel) must reflect the three-state model:
- All children unchecked → master is unchecked
- All children checked → master is checked
- Some children checked, some unchecked → master is `aria-checked="mixed"` (custom checkbox) or DOM `indeterminate = true` (native `<input type="checkbox">`).

When the user activates a mixed-state master, behavior MUST be deterministic and reversible — either "check all" or "deselect all" is APG-sanctioned (the APG mixed example demonstrates "check all"; the inverse is equally valid as long as activation is predictable and reversible). What is NOT acceptable: silently toggling to an arbitrary remembered prior state, or no-op activation.

**Code patterns to flag**:
- "Select all" checkbox bound to `checked = allSelected` — silently flat-binary; partial state is unrepresented
- Custom-rendered checkbox with no `aria-checked` attribute (relies on visual-only state)
- `aria-checked="mixed"` on `role="radio"` / `role="switch"` (unsupported per MDN — silently falls back to `false`)
- `<input type="checkbox" checked={someSelected}>` for a master — produces `checked=true` on any selection, never `indeterminate`

**Correct pattern**:
```jsx
function SelectAllCheckbox({ rows, selected, setSelected }) {
  const allSelected = rows.every(r => selected.has(r.id));
  const someSelected = !allSelected && rows.some(r => selected.has(r.id));
  const ref = useRef(null);

  // DOM indeterminate is not a React-controlled prop; set imperatively.
  // useLayoutEffect (not useEffect) to avoid one-frame indeterminate=false
  // flash on first mount with partial selection (e.g., URL-state restoration).
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <input
      type="checkbox"
      ref={ref}
      checked={allSelected}
      aria-label="Select all rows"
      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.id)))}
    />
  );
}
```

**Quick-fix hint**: For native `<input type="checkbox">`, set DOM `indeterminate` via `ref` when partial; for `role="checkbox"` custom widgets, set `aria-checked="mixed"` directly.

---

### UX-045: Filter-panel UX framing for grouped checkboxes — single-vs-multi-fieldset choice, visually-hidden-legend acceptability, facet labelling (defers to A11Y-010 for baseline semantics)

**Severity**: MAJOR
**Rationale**: The WCAG 1.3.1 / 3.3.2 baseline for grouping related form controls (radio / checkbox groups, semantically related input clusters) lives in **A11Y-010** (`accessibility/forms.md`) — that rule owns the `<fieldset>` + `<legend>` mandate at MAJOR. **UX-045 is NOT a re-statement of A11Y-010 — it covers filter-panel-specific UX decisions on top of that baseline**: how to decide between one-fieldset-per-facet vs one-fieldset-for-the-whole-filter-panel, when a visually-hidden `<legend>` is acceptable, how to name facets (noun phrases vs verb phrases), and the ARIA-`role="group"` + `aria-labelledby` equivalent for styling-constrained surfaces. Both forms (`<fieldset>` + `<legend>` and `role="group"` + `aria-labelledby`) are equally W3C-WAI-sanctioned — choice is contextual, not normative.
**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fieldset (WebFetch-verified 2026-05-12: implicit ARIA role is `group`; "The caption for the fieldset is given by the first `<legend>` element nested inside it") + https://www.w3.org/WAI/tutorials/forms/grouping/ (WebFetch-verified 2026-05-12: "the `div` element has `role=group` to indicate that the contained elements are members of a group and the `aria-labelledby` attribute references the `id` for text that will serve as the label"; "This technique provides additional styling possibilities" — i.e., the ARIA form is presented as functionally equivalent, not as a fallback) + A11Y-010 in `accessibility/forms.md` (baseline mandate: WCAG 1.3.1 Level A + 3.3.2 Level A)

**The rule** (filter-panel-specific UX framing layered on A11Y-010's baseline):
- **One fieldset per facet** (Color, Size, Brand) is the default — Miller's Law / cognitive-chunking favors discrete facet groupings (cf. HEU-LUX-millers). A single fieldset wrapping all facets across the entire panel obscures facet boundaries to AT users navigating by group.
- **Visually-hidden `<legend>` is acceptable** when the visible facet heading is rendered as an `<h*>` outside the `<fieldset>` AND the `<legend>` text matches the visible heading text (so AT-exposed name matches the on-screen name). When using `role="group"` + `aria-labelledby`, the referenced heading element itself is the accessible name — no duplication needed.
- **Facet labels are noun phrases** describing the dimension being filtered ("Color", "Brand", "Price range") not verb phrases ("Filter by color"). Verb-phrase legends create AT redundancy ("Filter by color, group, Red, checkbox not checked").
- **A single standalone checkbox** (e.g., "Show only available items") does NOT require a fieldset wrapper — A11Y-010 already exempts single-control cases.

**Code patterns to flag** (UX-lens findings; A11Y-010 catches the baseline missing-fieldset case):
- Filter panel where one `<fieldset>` wraps the ENTIRE panel (Color + Size + Brand all under one legend) — facet boundaries lost to AT navigation
- `<legend>` text mismatched against the visible facet heading rendered outside the fieldset (AT name ≠ on-screen name)
- Verb-phrase legends like `<legend>Filter by color</legend>` creating "Filter by color, group" AT readout
- Visually-hidden `<legend>` with no visible heading anywhere (the AT-exposed name exists but sighted users have no group label)
- Two-or-more sibling `<fieldset>` instances re-stating an outer common label (e.g., redundant "Filter by …" prefix on each legend)

**Correct pattern** (both forms equally W3C-sanctioned per the WAI tutorial; chosen by context — `<fieldset>` for default-CSS scenarios, `role="group"` when CSS resets or layout require non-`<fieldset>` markup):
```html
<!-- Form A: one fieldset per facet (default UX choice) -->
<fieldset>
  <legend>Color</legend>
  <label><input type="checkbox" name="color" value="red"> Red</label>
  <label><input type="checkbox" name="color" value="blue"> Blue</label>
  <label><input type="checkbox" name="color" value="green"> Green</label>
</fieldset>

<!-- Form B: ARIA-equivalent for styling-constrained surfaces -->
<h3 id="size-h">Size</h3>
<div role="group" aria-labelledby="size-h">
  <label><input type="checkbox" name="size" value="s"> Small</label>
  <label><input type="checkbox" name="size" value="m"> Medium</label>
  <label><input type="checkbox" name="size" value="l"> Large</label>
</div>
```

**Quick-fix hint**: One fieldset per facet (Color, Size, Brand) — never one fieldset wrapping the entire panel. Use noun-phrase legends ("Color", not "Filter by color"). Either `<fieldset>`/`<legend>` or `role="group"`/`aria-labelledby` works; choose by styling constraints, not by perceived hierarchy.

---

### UX-046: Search inputs use `<input type="search">` rather than `type="text"` for native clear-button + browser search semantics

**Severity**: MINOR
**Rationale**: `type="search"` is functionally identical to `type="text"` but unlocks user-agent affordances most users expect from a search field: the visible clear ("×") button to wipe the query in one click (also Esc in Chromium), opt-in `<datalist>`-driven suggestions, and the on-screen-keyboard search-action key on mobile. Shipping search functionality as `type="text"` is a small consistent-affordance loss across all users; MINOR severity because the behavior is otherwise functional and the keyboard / AT experience is intact.
**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/search (WebFetch-verified 2026-05-12: "`<input>` elements of type `search` are text fields designed for the user to enter search queries into. These are functionally identical to `text` inputs, but may be styled differently by the user agent"; clear-button: "some browsers show a cross icon that can be clicked on to remove the search term instantly if desired, in Chrome this action is also triggered when pressing escape"; datalist support: "the `list` attribute… provides a list of predefined values to suggest to the user")

**The rule**: The input that captures a search query should be `<input type="search">`. The surrounding form should also be a `<search>` landmark per UX-042 (the two rules are independent — landmark gives AT semantics; input type gives UX affordances).

**Code patterns to flag**:
- `<input type="text" name="q" placeholder="Search…">` for the site / table / list search input
- Custom clear-button (`×`) reimplemented over `<input type="text">` when the native `type="search"` clear-button would render automatically
- Multiple search forms on one page where some use `type="search"` and others `type="text"` (inconsistency)

**Correct pattern**:
```html
<search aria-label="Search products">
  <form action="/products/search">
    <label for="q">Search</label>
    <input id="q" type="search" name="q" />
    <button type="submit">Search</button>
  </form>
</search>
```

**Quick-fix hint**: Change `type="text"` → `type="search"` on any input whose semantic purpose is search.

---

## See also (cross-references)

- **A11Y-008** (`accessibility/semantic-structure.md`) — `<table>` + `<caption>` + `<th scope>`; the static-table baseline that data-list filter panels often render against (pairs with UX-022 / UX-045 in faceted-search UIs).
- **A11Y-010** (`accessibility/forms.md`) — **Baseline mandate for grouping radio/checkbox/related-input clusters with `<fieldset>` + `<legend>`** (WCAG 1.3.1 Level A + 3.3.2 Level A). UX-045 layers filter-panel-specific UX framing on top of A11Y-010 — UX-045 is NOT a re-statement of the baseline mandate. Cross-reviewer-convergent IV&V finding from the dev.83 post-ship corrective surfaced this peer-overlap (the initial UX-045 framing duplicated A11Y-010's territory); the corrective narrowed UX-045's scope and added this explicit defer-to.
- **A11Y-028** (`accessibility/aria/fundamentals.md`) — Live-region elements must exist BEFORE the first content change announces — owns the pre-existence requirement that UX-043's "Code patterns to flag" item 3 asserts. UX-043 layers the WCAG 4.1.3 filter-results mapping on top.
- **A11Y-074** (`accessibility/aria/sr-divergence.md`) — Don't override `role="status"` implicit `aria-live="polite"` with `aria-live="assertive"`. UX-043's "Code patterns to flag" item 5 references the same anti-pattern.
- **A11Y-048** (`accessibility/aria/apg-widgets.md`) — Combobox pattern; owns autocomplete / typeahead / inline-suggestion semantics for search inputs that surface suggestions. UX-042 is the landmark layer; A11Y-048 is the widget layer.
- **UX-002** (`ui-ux/forms.md`) — Do not use placeholder text as the only label. UX-042's flag-item 4 (placeholder-as-only-label on search input) defers to UX-002.
- **HEU-LUX-doherty** (`ux-heuristics/laws-of-ux/timing-perception.md`) — Doherty Threshold + debounced server calls (300–500 ms); pairs with UX-042 / UX-043 for search-as-you-type implementations.
- **HEU-LUX-millers** (`ux-heuristics/laws-of-ux/memory-cognition.md`) — Miller's Law + chunking; rationale for limiting facet count and grouping filters into named fieldsets per UX-045.
- **UX-022** (`ui-ux/data-performance.md`) — Filter / sort / pagination state persists in the URL; required pairing for the filter / search controls that UX-042..046 add semantics to.
- **UX-025** (`ui-ux/data-performance.md`) — "Load more" over pure infinite scroll for task-oriented lists; complementary pagination pattern for filtered result lists.
- **UX-040** (`ui-ux/tables-pagination.md`) — `<nav aria-label="Pagination">` + `aria-current="page"`; sister landmark pattern to UX-042's `<search>`.
- **MC-023** (`microcopy/empty-states.md`) — Empty filter / search results microcopy; UX-043's no-results case ("No results for X") should follow MC-023's prose conventions ("show me how to recover, not just that nothing matched").
- **IS-002** (`interaction-states/buttons-ctas.md`) — Async-action button must clear loading state in `finally`; applies to "Search" / "Apply filters" submit buttons.
- **IS-013** (`interaction-states/async-lists.md`) — Initial / loading / empty / populated / error state inventory; the result list controlled by these filter / search semantics must implement all five states.
