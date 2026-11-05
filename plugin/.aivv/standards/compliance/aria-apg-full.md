# Compliance — Full ARIA APG widget conformance

Part of [.aivv/standards/compliance/](README.md) (COMP-APG-NN). Each rule captures one ARIA Authoring Practices Guide widget pattern at **full conformance** — meaning all REQUIRED roles, all REQUIRED ARIA properties, and the full canonical keyboard interaction model. The existing [`accessibility/aria/apg-widgets.md`](../accessibility/aria/apg-widgets.md) catalog (A11Y-045..060) covers a baseline subset of APG widgets at minimum-conformance level (the most common defects); this file extends to (a) widgets not in the baseline (Carousel, Date Picker, Feed, Grid, Meter, Multi-thumb Slider, Spinbutton, Treegrid, Window Splitter, interactive Table) AND (b) full-conformance enhancements on existing baseline widgets (full keyboard model, SHOULD-class ARIA properties, all required descendant relationships) where the baseline only covers the minimum.

**Source authority:** the W3C WAI ARIA Authoring Practices Guide at https://www.w3.org/WAI/ARIA/apg/patterns/ is the canonical specification for each pattern. Per maintainer guidance operating principle 9 + dev.80+ per-rule WebFetch-verification discipline, each rule cites the canonical APG pattern URL and quotes verbatim normative text per dev.91+ Discipline 1.

**Severity convention:** APG widget rules default to **MAJOR** severity (matching the baseline A11Y APG widget severity per `accessibility/aria/apg-widgets.md`) — widget pattern violations break assistive-tech interaction substantively. Compare to `wcag-aaa.md` which defaults to MINOR (AAA conformance is opt-in beyond AA-baseline). APG conformance is part of WCAG 4.1.2 Name, Role, Value (Level A) when ARIA roles are used — widget pattern compliance is therefore an A-level requirement, not an AAA enhancement.

**Out-of-scope for this file:** APG widgets already at full coverage in [`accessibility/aria/apg-widgets.md`](../accessibility/aria/apg-widgets.md) (A11Y-045 Accordion, A11Y-046 Alert, A11Y-047 Alertdialog, A11Y-049 Dialog, A11Y-050 Disclosure, A11Y-051 Listbox baseline, A11Y-052 Menu/Menubar baseline, A11Y-053 Menu Button, A11Y-054 Radio Group, A11Y-055 Slider baseline, A11Y-056 Switch, A11Y-057 Tabs baseline, A11Y-058 Toolbar, A11Y-059 Tooltip, A11Y-060 Tree View baseline) are NOT re-stated here at minimum-conformance level. Where COMP-APG-* rules cover the same widget at enhanced conformance, the See-also block cites the baseline A11Y-* rule.

Added dev.103 = T43 Wave 2 phase 1 batch 6.

---

### COMP-APG-01: Carousel — `aria-roledescription="carousel"` + rotation control + per-slide naming

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/carousel/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/carousel/ — verbatim keyboard requirement: "Tab and Shift + Tab: Move focus through the interactive elements of the carousel as specified by the page tab sequence." Auto-rotation must stop when keyboard focus enters the carousel.

**The rule**: Carousels (rotating image/content sliders) must wrap the carousel container in a `<section>` or `<div>` with `role="region"` (or `role="group"`) + `aria-roledescription="carousel"` + accessible name (`aria-labelledby` or `aria-label`). Each slide is a `<div role="group" aria-roledescription="slide">` with its own accessible name. Auto-rotating carousels must expose a rotation-control button (pause/play) as the first focusable element, and auto-rotation must pause on (a) keyboard focus entering the carousel AND (b) hover. Slide-picker controls (dots, thumbnails) implement either the Tabs pattern (per A11Y-057) or a grouped buttons pattern with `aria-disabled="true"` on the current-slide button.

**Code patterns to flag**:
- Carousel container is a `<div>` with no `aria-roledescription="carousel"` and no accessible name
- Slides are `<div>` blocks with no `role="group"` + `aria-roledescription="slide"` and no per-slide accessible name
- Auto-rotating carousel with no pause control OR a pause control that does not stop auto-rotation on keyboard focus entering the carousel
- Slide-picker dots that are `<span>` / `<div>` with `onClick` handlers rather than `<button>` elements
- React libraries used out-of-the-box (e.g., `react-slick`, `swiper` with default settings) without APG-conformant configuration

**Correct pattern**:
```html
<section role="region" aria-roledescription="carousel" aria-label="Featured products">
  <button id="rotation-toggle" aria-pressed="false">Pause auto-rotation</button>

  <div role="group" aria-roledescription="slide" aria-label="1 of 3: Summer collection">
    <h3>Summer collection</h3>
    <p>…</p>
  </div>
  <div role="group" aria-roledescription="slide" aria-label="2 of 3: Fall preview">…</div>
  <div role="group" aria-roledescription="slide" aria-label="3 of 3: Winter gear">…</div>

  <div role="group" aria-label="Slide controls">
    <button aria-disabled="true">Slide 1</button>
    <button>Slide 2</button>
    <button>Slide 3</button>
  </div>
</section>
```

**Quick-fix hint**: Replace generic `<div>` carousel containers with `<section role="region" aria-roledescription="carousel">`; add accessible name; wrap each slide in `<div role="group" aria-roledescription="slide">` with per-slide name; expose pause/play as a `<button>` first in tab order; pause auto-rotation on `focusin` AND `mouseenter`.

**See also**: **A11Y-057** (`accessibility/aria/apg-widgets.md`, "Tabs — `role='tablist'` + `role='tab'` + `role='tabpanel'` + roving tabindex") — when the carousel's slide-picker uses the tabbed-carousel variant, the Tabs pattern requirements apply directly; COMP-APG-01 references the Tabs pattern by composition. **A11Y-018** (`accessibility/interactive-elements.md`, "Do not use positive `tabindex` values") — the carousel's tab order should follow DOM order; positive tabindex on slide-picker controls violates A11Y-018 and breaks the APG-recommended sequence.

---

### COMP-APG-02: Checkbox (tri-state / mixed) — `role="checkbox"` + `aria-checked="mixed"` cycle

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/ — verbatim keyboard requirement: "Pressing the Space key changes the state of the checkbox." Verbatim semantic: "Checking the overall checkbox checks all options in the group. Unchecking the overall checkbox will uncheck all options in the group."

**The rule**: Tri-state checkboxes (parent controls a group of child checkboxes) must use `role="checkbox"` + `aria-checked="true"`, `"false"`, OR `"mixed"` reflecting the actual group state. The parent must derive its `aria-checked` value from the child states: all children checked → `"true"`, no children checked → `"false"`, partial → `"mixed"`. Space toggles the parent which cascades to all children (all → checked OR all → unchecked; the third Space-press may restore prior partial state per APG note). Native HTML `<input type="checkbox" indeterminate>` provides the visual "—" but does NOT set `aria-checked="mixed"` — JS must explicitly set the ARIA state for AT.

**Code patterns to flag**:
- "Select all" checkbox implemented as `<input type="checkbox" indeterminate>` with no `aria-checked="mixed"` state — visual indeterminate ≠ AT-announced mixed
- Tri-state checkbox built from `<div role="checkbox">` with `aria-checked` toggled only between `"true"` and `"false"` (no `"mixed"` state)
- Parent checkbox whose `aria-checked` doesn't update when child checkboxes change (state-derivation bug)
- Space-key handler that only flips between two states ignoring the partial state semantics

**Correct pattern**:
```jsx
function SelectAllCheckbox({ children, allChecked, someChecked, onToggleAll }) {
  const ariaChecked = allChecked ? "true" : someChecked ? "mixed" : "false";
  return (
    <div
      role="checkbox"
      aria-checked={ariaChecked}
      tabIndex={0}
      onClick={onToggleAll}
      onKeyDown={(e) => { if (e.code === "Space") { e.preventDefault(); onToggleAll(); } }}
    >
      <span aria-hidden="true">{allChecked ? "☑" : someChecked ? "▣" : "☐"}</span>
      {children}
    </div>
  );
}
```

**Quick-fix hint**: For "select all" / tri-state checkboxes, compute `aria-checked` from the child state (`"true"` / `"false"` / `"mixed"`) and update reactively. If using native `<input>`, set `aria-checked="mixed"` explicitly in addition to the `indeterminate` DOM property. Space must toggle; Enter must NOT (per APG).

**See also**: **A11Y-054** (`accessibility/aria/apg-widgets.md`, "Radio Group — `<fieldset><legend>` or `role='radiogroup'` with name") — analogous group-control pattern; COMP-APG-02 covers the checkbox-group case (independent multi-select) where Radio Group is the mutually-exclusive case. **A11Y-029** (`accessibility/aria/fundamentals.md`, "Use `disabled` on native controls; `aria-disabled` only when needed") — when individual child checkboxes are conditionally disabled, use the native `disabled` attribute per A11Y-029; the parent's `aria-checked` derivation must ignore disabled children or include them per the group's documented semantics.

---

### COMP-APG-03: Combobox — `role="combobox"` + `aria-expanded` + `aria-activedescendant` + popup `role="listbox"`

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ — verbatim keyboard requirement (Down Arrow): "If the popup is available, moves focus into the popup." Verbatim keyboard requirement (Escape): "Dismisses the popup if it is visible."

**The rule**: Comboboxes (typeahead inputs with a filtered popup) must implement the full APG pattern: the input element carries `role="combobox"` + `aria-controls="<popup-id>"` + `aria-expanded` (boolean reflecting popup-visible state) + `aria-autocomplete` (one of `"none"` / `"list"` / `"both"`) + `aria-activedescendant` (id of the currently-focused popup option). The popup is `role="listbox"` (or `role="grid"` / `role="tree"` / `role="dialog"` for complex variants) with each item `role="option"` and `aria-selected="true"` on the focused/selected item. Required keyboard: ArrowDown moves focus into popup; ArrowUp/Down navigate options; Enter selects + closes; Escape closes without selecting; printable chars filter (when editable); Home/End jump to first/last option. The four `aria-autocomplete` variants (`"none"` / `"list"` / `"both"`) each require distinct visual + behavior treatment per APG.

**Code patterns to flag**:
- Search input + dropdown built as `<input>` + `<ul>` with no `role="combobox"` on input and no `aria-controls` / `aria-expanded`
- Combobox popup items as `<li>` or `<div>` with no `role="option"` and no `aria-selected` state-tracking
- React-Select / Downshift / Headless UI components configured without `aria-autocomplete` value (defaults often `"list"` but should be explicit)
- Combobox with `aria-haspopup="listbox"` (deprecated combination — `aria-expanded` is the correct mechanism per APG)
- Missing `aria-activedescendant` — popup item appears visually highlighted but AT cannot determine the focused option

**Correct pattern**:
```jsx
<div>
  <label htmlFor="city-input" id="city-label">City</label>
  <input
    id="city-input"
    role="combobox"
    aria-controls="city-popup"
    aria-expanded={popupOpen}
    aria-autocomplete="list"
    aria-activedescendant={popupOpen ? `city-opt-${activeIdx}` : undefined}
    value={query}
    onChange={(e) => { setQuery(e.target.value); openPopup(); }}
    onKeyDown={handleKey} /* Down/Up/Enter/Esc */
  />

  {popupOpen && (
    <ul id="city-popup" role="listbox" aria-labelledby="city-label">
      {filtered.map((city, i) => (
        <li
          key={city.id}
          id={`city-opt-${i}`}
          role="option"
          aria-selected={i === activeIdx}
          onClick={() => commitSelection(city)}
        >
          {city.name}
        </li>
      ))}
    </ul>
  )}
</div>
```

**Quick-fix hint**: For typeahead inputs, ensure the input is `role="combobox"` (HTML `<input>` does not get the role by default); add `aria-controls` pointing at the popup; toggle `aria-expanded`; explicitly set `aria-autocomplete`; track focused option via `aria-activedescendant` rather than moving DOM focus. Popup items must be `role="option"` with `aria-selected` reflecting the current focus.

**See also**: **A11Y-048** (`accessibility/aria/apg-widgets.md`, "Combobox — input + popup with full ARIA pattern") — baseline-conformance rule covering the same widget at minimum-required-properties level; COMP-APG-03 extends to full conformance including the four `aria-autocomplete` variants + complete keyboard model + `aria-activedescendant` tracking. A11Y-048 flags the most common combobox defects (missing role, missing aria-expanded); COMP-APG-03 flags partial-implementation gaps when the basics are present but full APG conformance is the project target. **A11Y-051** (same file, "Listbox — `role='listbox'` + `role='option'` + `aria-selected`") — the combobox popup IS a listbox; A11Y-051's rules apply to the popup composition.

---

### COMP-APG-04: Feed — `role="feed"` + `aria-busy` + per-article `aria-posinset` / `aria-setsize`

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/feed/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/feed/ — verbatim keyboard requirement: "Page Down: Move focus to next article. Page Up: Move focus to previous article. Control + End: Move focus to first focusable element after the feed. Control + Home: Move focus to first focusable element before the feed."

**The rule**: Infinite-scroll lists / lazy-loaded article feeds must declare `role="feed"` on the container with `aria-labelledby` or `aria-label`. Each article is `role="article"` with its own accessible name (`aria-labelledby`), `aria-posinset` (1-indexed position), and `aria-setsize` (total article count, or `-1` when count is unknown). During DOM updates (loading more articles), the feed sets `aria-busy="true"` and must reset to `false` once the DOM mutation completes. The full APG keyboard model is required: Page Down/Up to navigate between articles, Ctrl+End/Home to exit the feed in either direction. Articles SHOULD use `aria-describedby` to point at primary content for AT preview.

**Code patterns to flag**:
- Twitter/Mastodon-style infinite-scroll feed implemented as `<ul>` / `<div>` with no `role="feed"` and no per-article structure
- Lazy-loading list that never sets `aria-busy="true"` during fetch / `false` after completion
- Articles without `aria-posinset` / `aria-setsize` (AT cannot announce "Article 5 of 200")
- Custom keyboard handling that responds only to ArrowDown/ArrowUp without Page Down / Page Up / Ctrl+End / Ctrl+Home (APG requires the full set)
- React libraries (`react-window`, `react-virtualized`) configured without ARIA Feed pattern (virtualization is orthogonal to feed semantics)

**Correct pattern**:
```jsx
<section role="feed" aria-labelledby="feed-title" aria-busy={loading}>
  <h2 id="feed-title">Recent posts</h2>
  {articles.map((article, i) => (
    <article
      key={article.id}
      aria-posinset={i + 1}
      aria-setsize={totalCount ?? -1}
      aria-labelledby={`post-${article.id}-title`}
      aria-describedby={`post-${article.id}-excerpt`}
      tabIndex={0}
      onKeyDown={handleFeedKey} /* PageDown/PageUp/Ctrl+End/Ctrl+Home */
    >
      <h3 id={`post-${article.id}-title`}>{article.title}</h3>
      <p id={`post-${article.id}-excerpt`}>{article.excerpt}</p>
    </article>
  ))}
</section>
```

**Quick-fix hint**: For infinite-scroll lists, declare `role="feed"` on the container with an accessible name; wrap each item in `<article aria-posinset aria-setsize aria-labelledby>`; toggle `aria-busy` around fetch operations; wire the full Page Down / Page Up / Ctrl+End / Ctrl+Home keyboard model. Use `aria-setsize="-1"` when total count is unknown (e.g., open-ended infinite feed).

**See also**: **A11Y-007** (`accessibility/semantic-structure.md`, "Use list elements for list content") — when a feed is a *finite* enumerable list (not infinite-scroll), A11Y-007's `<ul>` / `<ol>` patterns apply instead; COMP-APG-04 governs the infinite-scroll / progressive-load case where list semantics don't fit. **A11Y-028** (`accessibility/aria/fundamentals.md`, "`role='alert'` / `role='status'` / `aria-live` must be present before content changes") — the feed pattern's `aria-busy` toggle is the in-pattern mechanism for announcing the loading state; live-region announcements per A11Y-028 are not required when `aria-busy` is correctly toggled.

---

### COMP-APG-05: Grid — `role="grid"` + cell navigation keyboard model + `aria-rowindex` / `aria-colindex` for virtual grids

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/grid/ — verbatim keyboard requirement (cell editing mode): "Enter or F2: Enter edit mode, disable grid navigation. Escape: restores grid navigation." Verbatim arrow navigation: "Right Arrow: Moves focus one cell to the right."

**The rule**: Interactive data grids (spreadsheets, sortable/editable tables with arrow-key cell navigation) must use `role="grid"` on the container with `role="row"` for each row and `role="gridcell"` / `role="columnheader"` / `role="rowheader"` for cells. Required keyboard: arrow keys move focus cell-to-cell (NOT the surrounding page); Tab moves focus OUT of the grid as a single stop (Tab does not iterate cells); Home/End within row; Ctrl+Home/End to grid boundaries; Page Up/Down for multi-row scroll; Enter or F2 enters cell-edit mode (suspending grid navigation); Escape restores grid navigation from edit mode. When the grid is virtualized (rows/columns lazily loaded), `aria-rowcount` / `aria-colcount` on the grid + `aria-rowindex` / `aria-colindex` on each cell must reflect the conceptual position, not the DOM position.

**Code patterns to flag**:
- Editable / sortable / filterable `<table>` with no `role="grid"` and no arrow-key cell navigation
- Spreadsheet-style UI built on `<div>` / `<span>` without any ARIA grid roles
- Virtualized grid (`react-window`, `ag-grid`, `tanstack-table` in headless mode) that renders only visible rows without `aria-rowcount` / `aria-rowindex` reflecting the full dataset position
- Tab iterating through every cell in the grid (Tab should be a single stop entering/exiting the grid; arrows navigate cells)
- Cell-edit mode entered without `Enter` or `F2` or with no way to exit edit mode back to grid navigation via `Escape`

**Correct pattern**:
```jsx
<div role="grid" aria-label="Order data" aria-rowcount={totalRows} aria-colcount={5}>
  <div role="row" aria-rowindex={1}>
    <div role="columnheader" aria-colindex={1}>Order ID</div>
    <div role="columnheader" aria-colindex={2}>Customer</div>
    <div role="columnheader" aria-colindex={3}>Date</div>
    <div role="columnheader" aria-colindex={4}>Total</div>
    <div role="columnheader" aria-colindex={5}>Status</div>
  </div>
  {visibleRows.map((row, i) => (
    <div key={row.id} role="row" aria-rowindex={row.absoluteIndex}>
      {row.cells.map((cell, j) => (
        <div
          key={j}
          role="gridcell"
          aria-colindex={j + 1}
          tabIndex={isFocused(row, j) ? 0 : -1}
          onKeyDown={handleGridKey} /* arrows, Home/End, Ctrl+Home/End, PageUp/Down, Enter/F2, Esc */
        >
          {cell}
        </div>
      ))}
    </div>
  ))}
</div>
```

**Quick-fix hint**: For interactive grids (editable cells, arrow-key navigation, virtualized data), use `role="grid"` + the full keyboard model. For *read-only* tabular data, prefer native `<table>` per A11Y-008 — grid role overhead is not justified when no cell interaction exists. For virtualization, ensure `aria-rowindex` / `aria-colindex` reflect the *conceptual* dataset position, not the rendered DOM position.

**See also**: **A11Y-008** (`accessibility/semantic-structure.md`, "Tabular data must use `<table>` with header cells") — A11Y-008 governs the read-only tabular-data case (native `<table>` + `<th>` headers); COMP-APG-05 covers the interactive-grid case where arrow-key navigation + cell editing + virtualization compose. The two rules are mutually exclusive: a UI is *either* a read-only table (A11Y-008) *or* an interactive grid (COMP-APG-05), not both. **A11Y-018** (`accessibility/interactive-elements.md`, "Do not use positive `tabindex` values") — grid implementation uses roving-tabindex (one cell `tabIndex={0}`, rest `tabIndex={-1}`); positive tabindex breaks the grid's tab-as-single-stop semantics and violates A11Y-018.

---

### COMP-APG-06: Spinbutton — `role="spinbutton"` + `aria-valuemin/max/now` + arrow-key step

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/ — verbatim ARIA-property requirement (aria-valuenow): "set to a decimal value representing the current value." Verbatim keyboard requirement: "Up Arrow: Increases value. Down Arrow: Decreases value. Home: Sets to minimum (if defined). End: Sets to maximum (if defined)."

**The rule**: Custom numeric input widgets that step a value via arrow keys (NOT `<input type="number">` which gets `spinbutton` role automatically from the UA) must declare `role="spinbutton"` on the focusable element, with `aria-valuenow` (decimal current value), `aria-valuemin` / `aria-valuemax` (bounds when defined), and optionally `aria-valuetext` when the numeric value needs friendly translation (e.g., `aria-valuenow="2" aria-valuetext="Tuesday"`). Required keyboard: Up/Down arrows step by 1; Page Up/Page Down step by larger increments (optional but conventional); Home/End jump to bounds (when defined). `aria-invalid="true"` when the entered value falls outside the bounds.

**Code patterns to flag**:
- Custom date / time / quantity / rating widget built from `<input>` + `<button>` increment/decrement controls without `role="spinbutton"` and `aria-valuenow`
- Spinbutton missing `aria-valuemin` / `aria-valuemax` when the widget has documented bounds (AT cannot announce "minimum reached")
- Day-of-week / month-name spinbutton with `aria-valuenow="2"` but no `aria-valuetext="Tuesday"` (AT announces "2" not "Tuesday")
- Custom spinbutton that does NOT respond to Up/Down arrow keys (must do so per APG)
- React quantity-stepper / number-input components configured without role="spinbutton" or with `<button>` increment/decrement composed as siblings instead of integrated

**Correct pattern**:
```jsx
function DayOfWeekSpinner({ value, onChange, min = 0, max = 6 }) {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return (
    <div
      role="spinbutton"
      tabIndex={0}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={days[value]}
      aria-label="Day of week"
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") onChange(Math.min(max, value + 1));
        else if (e.key === "ArrowDown") onChange(Math.max(min, value - 1));
        else if (e.key === "Home") onChange(min);
        else if (e.key === "End") onChange(max);
      }}
    >
      {days[value]}
    </div>
  );
}
```

**Quick-fix hint**: Prefer native `<input type="number">` (UA provides `spinbutton` role + arrow-key behavior for free). For non-numeric stepped widgets (days of week, months, brightness levels), build the spinbutton manually: `role="spinbutton"` + `aria-valuenow` + `aria-valuetext` for friendly value names + the canonical keyboard model.

**See also**: **A11Y-055** (`accessibility/aria/apg-widgets.md`, "Slider — `role='slider'` + `aria-valuemin/max/now` + `aria-valuetext` where needed") — Slider is the sibling range-input pattern (continuous value across a 2D track); Spinbutton is the discrete-step variant (Up/Down arrows step by 1, no draggable thumb). When the UI affords both keyboard step + draggable thumb, use Slider; when the value is keyboard-only-step (typical numeric inputs, date components), use Spinbutton.

---

### COMP-APG-07: Date Picker Dialog — text input + button trigger + dialog with `role="grid"` calendar + full keyboard model

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/ — verbatim keyboard requirement (Page Down): "Navigate to next month, focus same day number." Verbatim keyboard requirement (Shift + Page Down): "Navigate to next year, focus same day number." Verbatim selection-state property: "`aria-selected='true'`" applied only to the cell containing the currently selected date.

**The rule**: Date pickers composed as text input + "Choose date" button + popup calendar dialog must implement the full APG pattern. The trigger button opens a `role="dialog"` with `aria-modal="true"` + accessible name. Inside the dialog, the calendar is a `role="grid"` on a `<table>` (so cells inherit implicit `gridcell` from `<td>`) with `aria-labelledby` pointing at a month/year heading. Selected date carries `aria-selected="true"` (only one cell). Today may carry `aria-current="date"` for visual + AT distinguishability. Required keyboard: arrow keys step by day (Up/Down by week, Left/Right by day); Page Up/Page Down step by month preserving same day-of-month; Shift+Page Up/Page Down step by year; Home/End jump to start/end of current week; Enter/Space select + close + update input; Esc closes without selection. Roving tabindex applies (one cell `tabindex="0"`, rest `tabindex="-1"`). On dialog close, focus returns to the trigger button (per A11Y-049 dialog requirement).

**Code patterns to flag**:
- React date picker (`react-datepicker`, `@mui/x-date-pickers`, custom) using `<div>` cells without `role="grid"` and without arrow-key cell navigation
- Dialog without `role="dialog"` / `aria-modal="true"` / accessible name
- Calendar grid without `aria-labelledby` pointing at the month/year title
- Only the input is focusable; selecting a date requires mouse (no keyboard path to navigate or select)
- Selected date communicated only via CSS class (`.selected`) with no `aria-selected="true"`
- Missing focus-return to trigger on dialog close (violates A11Y-049 baseline + breaks the APG date picker pattern)

**Correct pattern**:
```html
<label for="dob-input">Birth date</label>
<input id="dob-input" type="text" placeholder="YYYY-MM-DD" aria-describedby="dob-format">
<button id="dob-trigger" aria-haspopup="dialog" aria-expanded="false">Choose date</button>

<div role="dialog" aria-modal="true" aria-labelledby="dlg-title" hidden id="dob-dialog">
  <h2 id="dlg-title">Choose birth date</h2>
  <div>
    <button aria-label="Previous month">‹</button>
    <span id="month-year-title">April 2026</span>
    <button aria-label="Next month">›</button>
  </div>
  <table role="grid" aria-labelledby="month-year-title">
    <thead>
      <tr>
        <th scope="col" abbr="Sunday">Su</th>
        <th scope="col" abbr="Monday">Mo</th>
        <!-- … -->
      </tr>
    </thead>
    <tbody>
      <tr>
        <td role="gridcell" tabindex="-1" aria-current="date">23</td>
        <td role="gridcell" tabindex="0" aria-selected="true">24</td>
        <!-- arrows / Page Up / Page Down / Home / End / Enter / Esc wired -->
      </tr>
    </tbody>
  </table>
</div>
```

**Quick-fix hint**: For date-picker dialogs, follow the canonical APG pattern: text input + button trigger + `role="dialog"` (full focus-trap per A11Y-049) + `<table role="grid">` with the full APG date-grid keyboard model. Prefer mature libraries (react-aria, Headless UI, @mui/x-date-pickers) that implement the pattern correctly out-of-the-box. For simple date entry, native `<input type="date">` may be sufficient — the UA's built-in date picker is APG-conformant.

**See also**: **A11Y-049** (`accessibility/aria/apg-widgets.md`, "Dialog (Modal) — focus trap + initial focus + Esc + return focus") — the date-picker dialog composes the Dialog pattern; A11Y-049's focus-trap + initial-focus + Esc + return-focus requirements apply directly. **COMP-APG-05** (this file, "Grid — `role='grid'` + cell navigation keyboard model + `aria-rowindex` / `aria-colindex` for virtual grids") — the calendar inside the date-picker dialog IS a grid; COMP-APG-05's arrow-key cell-navigation requirements apply (date-picker extends with month-step / year-step via Page Up/Down + Shift+Page Up/Down).

---

### COMP-APG-08: Slider (Multi-thumb) — each thumb is `role="slider"` with independent valuenow + mutually-constrained min/max

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/ — verbatim mutual-constraint requirement: "When the range (e.g. minimum and/or maximum value) of another slider is dependent on the current value of a slider, the values of aria-valuemin or aria-valuemax of the dependent sliders are updated when the value changes." Verbatim tab-order requirement: "The tab order remains constant regardless of thumb value and visual position within the slider."

**The rule**: Multi-thumb sliders (price-range, time-range, salary-range filters) place each thumb in the page tab sequence with its own `role="slider"` + `aria-valuenow` + `aria-valuemin` + `aria-valuemax` + `aria-label` (e.g., "Minimum price" / "Maximum price"). When thumbs constrain each other (the min-thumb cannot exceed the max-thumb's value), the dependent thumb's `aria-valuemin` / `aria-valuemax` must update reactively. The keyboard model per thumb matches the single-thumb Slider pattern (A11Y-055). Critically: the **tab order remains constant regardless of thumb value and visual position** — if the min-thumb is dragged past the max-thumb, the DOM/tab order does NOT swap (only the value semantics do).

**Code patterns to flag**:
- Price-range slider with one `role="slider"` container and two visual thumbs but no per-thumb `role="slider"` + `aria-valuenow`
- Multi-thumb slider where `aria-valuemax` on the min-thumb does not reactively decrease when max-thumb decreases (or `aria-valuemin` on max-thumb does not reactively increase when min-thumb increases)
- Tab order that swaps when thumbs cross (violates the constant-tab-order requirement — when min-thumb is dragged above max-thumb in value, the DOM order must remain the same; only the values invert)
- Both thumbs share the same `aria-label` (no distinguishing "Minimum" / "Maximum" semantics)
- Both thumbs in a single SVG `<rect>` element with no individual focusable elements (no keyboard path)

**Correct pattern**:
```jsx
function PriceRangeSlider({ min, max, value, onChange }) {
  return (
    <div className="range-slider">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Minimum price"
        aria-valuemin={min}
        aria-valuemax={value.max}     /* dependent on max-thumb */
        aria-valuenow={value.min}
        aria-valuetext={`$${value.min}`}
        onKeyDown={(e) => handleMinKey(e, value, onChange)}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Maximum price"
        aria-valuemin={value.min}     /* dependent on min-thumb */
        aria-valuemax={max}
        aria-valuenow={value.max}
        aria-valuetext={`$${value.max}`}
        onKeyDown={(e) => handleMaxKey(e, value, onChange)}
      />
    </div>
  );
}
```

**Quick-fix hint**: For range sliders, render two separate focusable elements (one per thumb), each with `role="slider"` + per-thumb `aria-valuenow` + `aria-label` distinguishing them ("Minimum price" / "Maximum price"). When thumbs constrain each other, update `aria-valuemin` / `aria-valuemax` on the dependent thumb reactively. Keep DOM/tab order constant — when thumbs cross visually, the values invert but the DOM does not reorder.

**See also**: **A11Y-055** (`accessibility/aria/apg-widgets.md`, "Slider — `role='slider'` + `aria-valuemin/max/now` + `aria-valuetext` where needed") — A11Y-055 covers the single-thumb baseline; COMP-APG-08 extends to the multi-thumb compositional case with mutual min/max constraints + constant-tab-order requirement. **COMP-APG-06** (this file, "Spinbutton — `role='spinbutton'` + `aria-valuemin/max/now` + arrow-key step") — Spinbutton is the discrete-step variant; multi-thumb sliders are continuous-range (typically with draggable thumbs). When two discrete-step values constrain each other, COMP-APG-06 + reactive valuemin/valuemax may compose instead of multi-thumb slider.

---

### COMP-APG-09: Treegrid — `role="treegrid"` + `aria-expanded` on parent rows + `aria-level` + cell navigation with expand/collapse

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/ — verbatim role classification: "Each cell is either a DOM descendant of or owned by a `row` element and has one of the following roles: `columnheader` if the cell contains a title or header information for the column, `rowheader` if the cell contains title or header information for the row, `gridcell` if the cell does not contain column or row header information." Verbatim focusability requirement: "Every row and cell contains a focusable element or is itself focusable, regardless of whether individual cell content is editable or interactive."

**The rule**: Treegrids (hierarchical tabular data — file managers, employee org charts, threaded conversations with sub-rows) compose Grid (COMP-APG-05) with Tree expand/collapse semantics. Container is `role="treegrid"`; each row is `role="row"` with `aria-level` reflecting depth (1-indexed), `aria-posinset` (position among siblings at the same level), and `aria-setsize` (total siblings at the same level). Parent rows (rows with children) carry `aria-expanded="true"` / `"false"` reflecting the expanded state. Cells are `role="gridcell"` / `"columnheader"` / `"rowheader"`. Required keyboard: arrow keys navigate cells; Right Arrow on a collapsed parent expands it; Left Arrow on an expanded parent collapses it (Left Arrow on a non-expandable row moves focus to the parent row); Down/Up navigate visible rows (skipping hidden descendants of collapsed parents); Enter activates the row's default action (or expand/collapse depending on focus mode). Single-select treegrids use `aria-selected` on the selected row; multi-select adds `aria-multiselectable="true"` on the container.

**Code patterns to flag**:
- File-manager / org-chart / threaded-comment UI built as nested `<ul>` / `<li>` (this is a Tree, not Treegrid — use only when no tabular columns)
- Hierarchical `<table>` rendering parent + child rows without `role="treegrid"` and without `aria-expanded` on parent rows
- Tree-grid where Right Arrow does NOT expand collapsed rows (only moves focus right) — must do both depending on row state
- Missing `aria-level` (AT cannot announce "level 3 of 5")
- Row-selection state communicated only via CSS class without `aria-selected`

**Correct pattern**:
```html
<table role="treegrid" aria-label="Project files" aria-multiselectable="true">
  <thead>
    <tr role="row">
      <th role="columnheader">Name</th>
      <th role="columnheader">Size</th>
      <th role="columnheader">Modified</th>
    </tr>
  </thead>
  <tbody>
    <tr role="row" aria-level="1" aria-posinset="1" aria-setsize="2" aria-expanded="true" aria-selected="false">
      <td role="rowheader">📁 src/</td>
      <td role="gridcell">—</td>
      <td role="gridcell">2026-05-13</td>
    </tr>
    <tr role="row" aria-level="2" aria-posinset="1" aria-setsize="3" aria-selected="false">
      <td role="rowheader">  📄 index.ts</td>
      <td role="gridcell">2.4 KB</td>
      <td role="gridcell">2026-05-13</td>
    </tr>
    <!-- … -->
  </tbody>
</table>
```

**Quick-fix hint**: For hierarchical tabular data, use `role="treegrid"` (NOT plain `role="grid"` + ad-hoc nesting). Every parent row needs `aria-expanded`; every row needs `aria-level` + `aria-posinset` + `aria-setsize`. Wire Right Arrow to expand-OR-move-right + Left Arrow to collapse-OR-move-to-parent depending on row state. Prefer libraries with treegrid support (ag-grid, react-aria) over hand-rolled implementations.

**See also**: **COMP-APG-05** (this file, "Grid — `role='grid'` + cell navigation keyboard model + `aria-rowindex` / `aria-colindex` for virtual grids") — Treegrid composes Grid + Tree semantics; COMP-APG-05's cell-navigation requirements apply, and COMP-APG-09 extends with expand/collapse via Right/Left Arrow + hierarchical `aria-level`. **A11Y-060** (`accessibility/aria/apg-widgets.md`, "Tree View — `role='tree'` + `role='treeitem'` + `aria-expanded` / `aria-level`") — Tree is the non-tabular hierarchical pattern (single column of items with expand/collapse); Treegrid extends Tree with multi-column tabular cells. When a hierarchy has no tabular columns, use Tree (A11Y-060); when it has tabular cells, use Treegrid (COMP-APG-09).

---

### COMP-APG-10: Meter — `role="meter"` + `aria-valuenow/min/max` for static measurement (NOT progress)

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/meter/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/meter/ — verbatim scope-boundary requirement: "The meter should not be used to indicate progress, such as loading or percent completion of a task. To communicate progress, use the progressbar role instead." Verbatim aria-valuenow requirement: "set to a decimal value between `aria-valuemin` and `aria-valuemax` representing the current value."

**The rule**: Meters (static measurements within a bounded range — battery level, disk usage, score, rating-out-of-5) must use `role="meter"` (or the native HTML `<meter>` element which the UA maps to the role) with `aria-valuenow` between `aria-valuemin` and `aria-valuemax`, plus accessible name (`aria-labelledby` or `aria-label`). Optional `aria-valuetext` provides a friendly translation when the numeric value alone is insufficient (e.g., `aria-valuenow="0.5" aria-valuetext="50% (6 hours) remaining"`). Critically: meter is for **static** measurements only — operation-in-progress indicators (loading bars, upload progress) must use `role="progressbar"` instead. Meters also require meaningful bounds; values without a maximum (e.g., world population, cumulative views) should not use meter role.

**Code patterns to flag**:
- Loading spinner / upload progress bar with `role="meter"` (wrong role — should be `progressbar`)
- Battery / disk-usage / rating gauge as a `<div>` with no `role="meter"` and no aria-value properties
- Custom rating widget (5 stars filled out of 7) with no `role="meter"` + `aria-valuenow="5"` + `aria-valuemin="0"` + `aria-valuemax="7"`
- Unbounded counter (e.g., "1,234,567 views") rendered as meter — meter requires meaningful bounds; for unbounded counts, use plain text with `aria-live`
- Meter with `aria-valuenow="50"` `aria-valuemin="0"` `aria-valuemax="100"` rendering "50%" but missing `aria-label` (AT announces "50, slider" or worse — no name to anchor the measurement)

**Correct pattern**:
```html
<!-- Native HTML meter — preferred when visual styling allows -->
<label for="storage-meter">Storage used</label>
<meter id="storage-meter" value="0.62" min="0" max="1" low="0.3" high="0.8" optimum="0.5">62%</meter>

<!-- Custom meter when native styling is insufficient -->
<div role="meter"
     aria-label="Battery"
     aria-valuenow="0.18"
     aria-valuemin="0"
     aria-valuemax="1"
     aria-valuetext="18% — 42 minutes remaining">
  <div class="bar" style={{ width: "18%" }} />
</div>
```

**Quick-fix hint**: For static measurements, use native `<meter>` (UA renders + applies `role="meter"` automatically) — gives accessible defaults. For operation-in-progress, use `role="progressbar"` (different pattern). Always provide an accessible name + bounded min/max. Add `aria-valuetext` when the percentage alone is not user-friendly (battery level, score-out-of-N).

**See also**: **A11Y-028** (`accessibility/aria/fundamentals.md`, "`role='alert'` / `role='status'` / `aria-live` must be present before content changes") — for unbounded dynamic values (view counts, real-time scores) that don't fit the meter pattern's "meaningful maximum" requirement, prefer plain text in an `aria-live` region per A11Y-028.

---

### COMP-APG-11: Window Splitter — `role="separator"` + `aria-controls` + arrow-key resize + Enter to collapse/restore

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/ — verbatim keyboard requirement (Left Arrow): "Moves a vertical splitter to the left." Verbatim keyboard requirement (Enter): "If the primary pane is not collapsed, collapses the pane. If the pane is collapsed, restores the splitter to its previous position."

**The rule**: Resizable-pane dividers (IDE sidebars, two-column resizable layouts, code-editor split views) must use `role="separator"` on the focusable divider element with `aria-valuenow` (current position as decimal), `aria-valuemin` (position giving primary pane its min size), `aria-valuemax` (position giving primary pane its max size), `aria-controls` referencing the primary pane's id, and `aria-label`. Required keyboard: Left/Right arrows resize a vertical splitter; Up/Down arrows resize a horizontal splitter; Home/End (optional) jump to bounds; **Enter toggles** — if pane is expanded, Enter collapses; if pane is collapsed, Enter restores to the previous position. The Enter-toggle is the canonical APG mechanism for pane collapse/restore — distinct from a separate "collapse" button.

**Code patterns to flag**:
- VS Code-style resizable sidebar built as `<div onMouseDown>` with no `role="separator"` and no keyboard support
- Splitter without `aria-controls` referencing the resized pane (AT cannot identify what the splitter controls)
- Splitter that resizes via drag-only with no arrow-key handler
- Pane-collapse implemented as a separate "Hide sidebar" button without the canonical Enter-toggle behavior on the splitter itself (acceptable as augmentation; flag when ONLY the button exists with no Enter-toggle path)
- Multiple splitters on a page sharing the same `aria-label` (no distinguishing context — "Sidebar splitter" vs "Outline splitter")

**Correct pattern**:
```html
<div class="layout">
  <div id="left-pane" class="pane">…</div>

  <div
    role="separator"
    tabindex="0"
    aria-controls="left-pane"
    aria-label="Resize sidebar"
    aria-valuenow={currentPercent}
    aria-valuemin={20}
    aria-valuemax={80}
    onKeyDown={(e) => {
      if (e.key === "ArrowLeft") setPercent(Math.max(20, currentPercent - 1));
      else if (e.key === "ArrowRight") setPercent(Math.min(80, currentPercent + 1));
      else if (e.key === "Home") setPercent(20);
      else if (e.key === "End") setPercent(80);
      else if (e.key === "Enter") collapsed ? restore() : collapse();
    }}
  />

  <div id="right-pane" class="pane">…</div>
</div>
```

**Quick-fix hint**: For draggable pane separators, add `role="separator"` + `tabindex="0"` + `aria-controls` pointing at the primary pane + `aria-valuemin/max/now` + arrow-key handlers + Enter-toggle for collapse/restore. Mature libraries like `react-resizable-panels` implement the pattern correctly.

**See also**: **A11Y-018** (`accessibility/interactive-elements.md`, "Do not use positive `tabindex` values") — the splitter element gets `tabindex="0"` to enter the tab sequence; nested controls inside the resized panes follow DOM order without positive tabindex. **A11Y-029** (`accessibility/aria/fundamentals.md`, "Use `disabled` on native controls; `aria-disabled` only when needed") — when a pane is collapsed, the splitter remains focusable (so Enter can restore it); do NOT set `aria-disabled="true"` on the splitter in collapsed state, only update `aria-valuenow` to reflect the collapsed position.

---

### COMP-APG-12: Tabs (full keyboard model) — automatic-vs-manual activation choice + full keyboard set

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ — verbatim activation-choice guidance: "It is recommended that tabs activate automatically when they receive focus as long as their associated tab panels are displayed without noticeable latency. This typically requires tab panel content to be preloaded. Otherwise, automatic activation slows focus movement, which significantly hampers users' ability to navigate efficiently across the tab list."

**The rule**: Tabs must explicitly choose between **automatic activation** (Left/Right arrow keys move focus AND activate the focused tab — recommended when panel content is preloaded with no perceptible latency) OR **manual activation** (arrow keys move focus only; Enter/Space activates — required when panel content loads asynchronously and automatic activation would cause perceptible loading flicker on each arrow press). Required keyboard set: Left/Right (horizontal tabs) or Up/Down (vertical tabs) move focus among tabs with wrap-around at ends; Home jumps to first tab; End jumps to last tab; Enter/Space activates focused tab (in manual mode) — in automatic mode, activation happens automatically. Required ARIA: `aria-selected="true"` on the active tab (`"false"` on others); `aria-controls` on each tab referencing its panel's id; `aria-labelledby` on each panel referencing its tab's id. Extends A11Y-057 baseline by formalizing the automatic-vs-manual choice + Home/End + wrap-around behavior.

**Code patterns to flag**:
- Tabs implementation with no documented activation-mode choice — code reviewer cannot tell whether arrow-key behavior is correct
- Async-loaded tab panels paired with automatic activation (every arrow press triggers a fetch + flicker — should be manual)
- Preloaded tab panels paired with manual activation (extra keystrokes per tab; should be automatic per APG recommendation)
- Missing Home / End keyboard support
- Arrow keys that do NOT wrap at the ends of the tablist (Right at last tab should focus the first; APG specifies wrap-around)
- `aria-selected` not updating on tab activation (automatic) or on Enter/Space (manual)

**Correct pattern**:
```jsx
function Tabs({ tabs, mode = "auto" }) {
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(0);

  function handleKey(e) {
    let nextFocus = focused;
    if (e.key === "ArrowRight") nextFocus = (focused + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextFocus = (focused - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextFocus = 0;
    else if (e.key === "End") nextFocus = tabs.length - 1;
    else if ((e.key === "Enter" || e.key === " ") && mode === "manual") {
      setActive(focused);
      return;
    } else { return; }

    e.preventDefault();
    setFocused(nextFocus);
    if (mode === "auto") setActive(nextFocus);
  }

  return (
    <>
      <div role="tablist" onKeyDown={handleKey}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={i === active}
            aria-controls={`panel-${t.id}`}
            tabIndex={i === focused ? 0 : -1}
            onFocus={() => setFocused(i)}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={i !== active}
        >
          {t.content}
        </div>
      ))}
    </>
  );
}
```

**Quick-fix hint**: Choose automatic activation when panel content is preloaded (default per APG recommendation); choose manual when async loading would cause perceptible flicker on each arrow press. Always wire the full keyboard set: arrows + Home/End + wrap-around at ends + Enter/Space in manual mode. `aria-selected` must reflect the active tab (not just the focused tab in manual mode).

**See also**: **A11Y-057** (`accessibility/aria/apg-widgets.md`, "Tabs — `role='tablist'` + `role='tab'` + `role='tabpanel'` + roving tabindex") — A11Y-057 covers the baseline Tabs requirements (roles, roving tabindex, basic arrow nav); COMP-APG-12 extends to formalize the automatic-vs-manual activation choice + Home/End + wrap-around at ends. A11Y-057 flags the most common Tabs defects (missing roles); COMP-APG-12 flags partial-implementation gaps when basics are correct but full APG conformance is the target.

---

### COMP-APG-13: Listbox (multi-select with virtual focus) — `aria-multiselectable` + `aria-activedescendant` + range-extending keyboard model

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ — verbatim focus-management property: "The `listbox` role supports the aria-activedescendant property, which provides an alternative to moving DOM focus among `option` elements when implementing keyboard navigation." Verbatim focus-vs-selection distinction: "DOM focus (the active element) is functionally distinct from the selected state."

**The rule**: Multi-select listboxes implementing virtual focus must declare `aria-multiselectable="true"` on the listbox container, retain DOM focus on the listbox itself (NOT moving DOM focus to options as the user navigates), and track the virtually-focused option via `aria-activedescendant` pointing at that option's id. Each option carries `aria-selected="true"|"false"` reflecting its selection state. Required keyboard set: Up/Down arrows move virtual focus; **Space toggles** the focused option's selection; Shift+Up/Down moves focus AND toggles selection of the new option (range-extending); Ctrl+Space toggles selection of the focused option without moving focus; Shift+Space selects the contiguous range from last-selected to focused option; Ctrl+A optionally selects all (or toggles between select-all / clear-all). This extends A11Y-051 baseline by formalizing the virtual-focus mechanism (vs. moving DOM focus into options) AND the full multi-select keyboard model.

**Code patterns to flag**:
- Multi-select listbox where arrow keys move DOM focus into `<li role="option">` elements (works but is the LESS-recommended alternative; APG explicitly recommends virtual focus via aria-activedescendant)
- Multi-select listbox missing `aria-multiselectable="true"` (AT cannot announce multi-select capability)
- Custom multi-select missing Shift+Arrow range-extension keyboard support
- Multi-select that supports Ctrl+Space but not the simpler Space-toggle on focused item
- Library-implemented listbox (react-select multi-mode) configured without `aria-activedescendant` tracking — common when wiring multi-select onto a single-select primitive

**Correct pattern**:
```jsx
function MultiSelectListbox({ options, selectedIds, onChange, label }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const listboxRef = useRef(null);

  function handleKey(e) {
    let nextIdx = activeIdx;
    if (e.key === "ArrowDown") nextIdx = Math.min(options.length - 1, activeIdx + 1);
    else if (e.key === "ArrowUp") nextIdx = Math.max(0, activeIdx - 1);
    else if (e.key === " " && !e.ctrlKey) { toggleSelection(options[activeIdx].id); e.preventDefault(); return; }
    else if (e.key === "ArrowDown" && e.shiftKey) { nextIdx = activeIdx + 1; toggleSelection(options[nextIdx].id); }
    else if (e.ctrlKey && (e.key === "a" || e.key === "A")) { toggleSelectAll(); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    setActiveIdx(nextIdx);
  }

  return (
    <div
      role="listbox"
      aria-multiselectable="true"
      aria-label={label}
      aria-activedescendant={`opt-${options[activeIdx].id}`}
      tabIndex={0}
      ref={listboxRef}
      onKeyDown={handleKey}
    >
      {options.map(opt => (
        <div
          key={opt.id}
          id={`opt-${opt.id}`}
          role="option"
          aria-selected={selectedIds.includes(opt.id)}
        >
          {opt.label}
        </div>
      ))}
    </div>
  );
}
```

**Quick-fix hint**: For multi-select listboxes, prefer **virtual focus** via `aria-activedescendant` over moving DOM focus into options — the APG explicitly recommends this. Keep DOM focus on the listbox container; update `aria-activedescendant` to point at the focused option's id; wire the full multi-select keyboard set (Space, Shift+arrows, Ctrl+Space, optional Ctrl+A).

**See also**: **A11Y-051** (`accessibility/aria/apg-widgets.md`, "Listbox — `role='listbox'` + `role='option'` + `aria-selected`") — A11Y-051 covers the baseline listbox semantics (roles, single-select via aria-selected). COMP-APG-13 extends to multi-select with virtual focus + range-extending keyboard. **A11Y-018** (`accessibility/interactive-elements.md`, "Do not use positive `tabindex` values") — virtual-focus listbox keeps `tabIndex={0}` on the listbox container; options have NO tabindex (they are not in the DOM tab sequence at all — they are addressed only via aria-activedescendant). Positive tabindex on options breaks the virtual-focus pattern.

---

### COMP-APG-14: Dialog (Modal) — initial-focus selection rule + return-focus exceptions

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ — verbatim initial-focus normative: "When a dialog opens, focus moves to an element inside the dialog." Verbatim return-focus rule: "When a dialog closes, focus returns to the element that invoked the dialog unless either: The invoking element no longer exists... [or] workflow design includes [specific conditions]."

**The rule**: Extends A11Y-049 baseline (dialog focus-trap + Esc + return-focus) by formalizing the **initial-focus selection** decision tree per APG guidance: (a) **Complex content** (lists, tables, multi-paragraph content) — set `tabindex="-1"` on a static element at content start (typically the dialog title) and focus IT, enabling AT users to read structure before encountering action buttons; (b) **Large content** that scrolls — focus a static element near the top (title or first paragraph with `tabindex="-1"`) to prevent scrolling the beginning out of view; (c) **Destructive actions** — focus the LEAST destructive option (typically Cancel) rather than the most likely action — protects users from accidental Enter-key activation; (d) **Information-only dialogs** — focus the most frequently used element (OK / Close button). Return-focus exception: focus may shift forward to a logically subsequent workflow step IF the dialog's task directly transitions to that step (e.g., "Sign in" dialog completing → focus moves to the now-revealed account dashboard's main content, not back to the "Sign in" link that's no longer visible).

**Code patterns to flag**:
- Confirmation dialog ("Delete account?") with autofocus on the destructive "Delete" button — violates the destructive-action rule (should focus Cancel instead)
- Multi-paragraph informational dialog with autofocus on the OK button at the bottom — sighted users can scan; AT/screen-reader users skip the content entirely (focus the dialog title with `tabindex="-1"` instead so screen reader announces title first)
- Large scrollable dialog with autofocus on the last/bottom action — visual focus jumps to bottom, scrolling content past the top before user can read
- Dialog close without focus-return (regression of A11Y-049 baseline)
- Form dialog where return-focus brings user back to a stale invoking element that was removed by the form submit — focus is "lost" to document body; need to advance focus to the logical-next workflow step instead

**Correct pattern**:
```jsx
function ConfirmDeleteDialog({ open, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  // Focus the LEAST destructive option (Cancel) on open per COMP-APG-14
  return (
    <dialog open={open} aria-labelledby="dlg-title" aria-describedby="dlg-desc">
      <h2 id="dlg-title" tabIndex={-1}>Delete account?</h2>
      <p id="dlg-desc">This action cannot be undone.</p>
      <button ref={cancelRef} autoFocus onClick={onCancel}>Cancel</button>
      <button onClick={onConfirm}>Delete forever</button>
    </dialog>
  );
}

function InformationalDialog({ open, title, body, onClose }) {
  // Complex content — focus the title (tabindex="-1") so AT announces structure first
  return (
    <dialog open={open} aria-labelledby="dlg-title">
      <h2 id="dlg-title" tabIndex={-1} autoFocus>{title}</h2>
      <div>{body}</div>
      <button onClick={onClose}>Close</button>
    </dialog>
  );
}
```

**Quick-fix hint**: Choose initial focus by dialog purpose: (a) complex/large content → focus title with `tabindex="-1"`; (b) destructive action → focus Cancel; (c) info-only → focus the primary close/OK button. For return-focus, default to the invoking element; advance to the logical next-step ONLY when the invoking element no longer exists or the workflow's next step is now the page's primary content.

**See also**: **A11Y-049** (`accessibility/aria/apg-widgets.md`, "Dialog (Modal) — focus trap + initial focus + Esc + return focus") — A11Y-049 covers the baseline dialog requirements (focus trap, Esc, return-focus). COMP-APG-14 extends to formalize the initial-focus decision tree (which element gets initial focus depends on dialog purpose) + the return-focus workflow-advance exception. A11Y-049 flags missing focus-management altogether; COMP-APG-14 flags incorrect initial-focus selection (e.g., autofocus on a destructive action button).

---

### COMP-APG-15: Table (interactive sorting) — `aria-sort` on `columnheader` + grid-role when interactivity dominates

**Severity**: MAJOR
**APG**: https://www.w3.org/WAI/ARIA/apg/patterns/table/
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/table/ — verbatim role-selection guidance: "The [grid pattern] is used to make an interactive widget that has a tabular structure." Verbatim aria-sort placement: "If the table contains sortable columns or rows, [aria-sort] is set to an appropriate value on the header cell element for the sorted column or row."

**The rule**: Tables with interactive sortable columns must declare `aria-sort` on the active sort `<th>` (or `role="columnheader"` cell) with one of four values: `"ascending"`, `"descending"`, `"none"` (sortable but not currently sorted), or `"other"` (sorted in a non-standard direction — alphabetical-by-language-rules, custom comparator). Only ONE column at a time should carry an `aria-sort` value other than `"none"` (matching the single-sort-direction visual indicator). Choose role wisely per APG guidance: **`role="table"`** (or plain `<table>` with no explicit role) when the only interactivity is column-sort + row-selection; **`role="grid"`** (COMP-APG-05) when cell-level keyboard navigation, in-cell editing, or virtualization is required. The decision boundary: if Tab traverses each cell, it's a grid (problematic for long tables — Tab should be a single stop); if Tab skips over cells and only hits the sort buttons, it's a table.

**Code patterns to flag**:
- Sortable data table (`<table>` with click handlers on `<th>` for sort) lacking `aria-sort` on the active column header
- Sort button rendered as `<th><button>Name ↑</button></th>` without `aria-sort` on the `<th>` (the sort button is the trigger; `aria-sort` is the state announcement)
- Multiple columns simultaneously carrying `aria-sort="ascending"` or `"descending"` (only one column can be the active sort)
- Table with cell-level arrow-key navigation but using `role="table"` (should be `role="grid"` per COMP-APG-05)
- Table with Tab iterating through every cell (should not happen on `role="table"`; if cell-by-cell tab is intentional, use `role="grid"` instead)

**Correct pattern**:
```html
<table>
  <caption>Orders</caption>
  <thead>
    <tr>
      <th scope="col" aria-sort="ascending">
        <button onClick={() => sortBy("date")}>Date ↑</button>
      </th>
      <th scope="col" aria-sort="none">
        <button onClick={() => sortBy("customer")}>Customer</button>
      </th>
      <th scope="col" aria-sort="none">
        <button onClick={() => sortBy("total")}>Total</button>
      </th>
    </tr>
  </thead>
  <tbody>
    <tr><td>2026-04-21</td><td>Acme Corp</td><td>$1,234</td></tr>
    <!-- … -->
  </tbody>
</table>
```

**Quick-fix hint**: For sortable tables, add `aria-sort` to the active column header with value reflecting direction (`"ascending"` / `"descending"`) — other sortable columns get `"none"`. Render the sort trigger as a `<button>` inside `<th>` (the button is the actionable element; `aria-sort` is the state on the `<th>`). For tables with cell-level keyboard navigation OR in-cell editing OR row-virtualization, use the Grid pattern (COMP-APG-05) instead — `aria-sort` semantics apply identically on `role="columnheader"` cells inside a grid.

**See also**: **A11Y-008** (`accessibility/semantic-structure.md`, "Tabular data must use `<table>` with header cells") — A11Y-008 covers the read-only baseline (`<table>` + `<th>` + `scope` + `<caption>`); COMP-APG-15 extends to *interactive*-sort tables that retain the table semantics (vs. needing grid). When sort is the ONLY interactivity, COMP-APG-15 + A11Y-008 cover the case; when cell-level keyboard navigation also exists, switch to COMP-APG-05 Grid. **COMP-APG-05** (this file, "Grid — `role='grid'` + cell navigation keyboard model + `aria-rowindex` / `aria-colindex` for virtual grids") — sibling-pattern for the case where interactivity goes beyond column sort (cell navigation, editing, virtualization).