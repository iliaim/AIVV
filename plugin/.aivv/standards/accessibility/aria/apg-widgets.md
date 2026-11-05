# Accessibility — ARIA APG widget patterns

Part of [.aivv/standards/accessibility/aria/](README.md) (A11Y-045..060). Each rule captures one ARIA [Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/) widget pattern. Per maintainer guidance operating principle 9, rules cite the canonical W3C APG pattern page. Each rule scopes its code-reviewable subset; full keyboard-semantics testing is runtime-deferred per the parent [`accessibility/README.md`](../README.md) runtime-deferred list.

Added dev.78 = T21 phase 2 (16 patterns selected from APG's 30 by frequency-in-production-codebases). Foundational rules referenced from each pattern live in [`fundamentals.md`](fundamentals.md) (A11Y-024..029).

### A11Y-045: Accordion — paired `<button aria-expanded>` + `aria-controls`

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A, 2.1.1 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/accordion/

**The rule**: Accordion sections must use a `<button>` trigger inside the heading carrying `aria-expanded` (true/false) and `aria-controls` referencing the panel's `id`. Panel `role="region"` + `aria-labelledby` is optional per APG and is best avoided when accordions have more than ~6 panels (to prevent landmark proliferation).

**Code patterns to flag**:
- `<div onClick>` toggling content without `<button>` or `role="button"`
- Heading wrapping the panel content rather than the trigger (`<h3><button>` is correct; `<button><h3>` is wrong)
- `aria-expanded` missing or stuck at one value
- `aria-controls` referencing a non-existent `id`

**Correct pattern**:
```html
<h3>
  <button aria-expanded="false" aria-controls="sect-1-panel" id="sect-1-trigger">
    Section 1
  </button>
</h3>
<!-- role="region" + aria-labelledby is optional per APG; avoid when >6 panels -->
<section id="sect-1-panel" hidden>…</section>
```

**Quick-fix hint**: Wire `aria-expanded` to open/closed state; `aria-controls` to panel id; `hidden` on the panel when closed.

**Runtime caveat**: keyboard semantics (Enter/Space toggle, optional Up/Down between section triggers) require runtime verification.

**See also**: **VVT-064** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code uses native `<details>` `name` attribute for accordion-grouping (native equivalent of the ARIA-driven pattern this rule defines).

---

### A11Y-046: Alert — `role="alert"` for time-sensitive, transient announcements

**Severity**: MAJOR
**WCAG**: 4.1.3 Level AA
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/alert/

**The rule**: Use `role="alert"` ONLY for transient, time-sensitive notifications that need immediate AT announcement. The role implies `aria-live="assertive"` + `aria-atomic="true"` — it interrupts the current AT speech. Static / persistent content should NOT carry `role="alert"`.

**Code patterns to flag**:
- `role="alert"` on persistent banner / notification stream (use `role="status"` or `aria-live="polite"` instead)
- Empty `<div role="alert"></div>` on initial mount with text appended later via DOM mutation (some AT does not re-announce; prefer remounting with text inside)
- Multiple `role="alert"` regions firing rapidly — AT behavior varies across NVDA / JAWS / VoiceOver and announcements may be missed or queued unpredictably; design for one alert at a time
- Alert content that re-renders on every state change (each render fires AT — over-noisy)

**Correct pattern**:
```jsx
{showError && <div role="alert">Could not save changes. Try again.</div>}
<output role="status">Saved successfully.</output>
```

**Quick-fix hint**: Reserve `role="alert"` for true interruption-worthy events; use `role="status"` / `aria-live="polite"` for non-urgent feedback.

---

### A11Y-047: Alertdialog — `role="alertdialog"` requires name + describedby + focus trap

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A, 2.4.3 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/

**The rule**: Alert dialogs (confirmation prompts, destructive-action warnings) use `role="alertdialog"` with an accessible name (`aria-labelledby` or `aria-label`) AND `aria-describedby` referencing the alert message. Focus moves to the safest action button on open; the dialog traps focus; Esc closes; focus returns to the trigger.

**Code patterns to flag**:
- `role="alertdialog"` without `aria-labelledby` / `aria-label`
- `role="alertdialog"` without `aria-describedby` pointing at the warning message
- No `<dialog>` element OR no focus-trap library wired up
- Initial focus not set; Esc-to-close not wired

**Correct pattern**:
```html
<dialog open role="alertdialog" aria-labelledby="dlg-title" aria-describedby="dlg-desc">
  <h2 id="dlg-title">Delete account?</h2>
  <p id="dlg-desc">This action cannot be undone.</p>
  <button autofocus>Cancel</button>
  <button>Delete</button>
</dialog>
```

**Quick-fix hint**: Prefer native `<dialog>`; add `aria-labelledby` + `aria-describedby`; initial focus on the safe default action.

**Runtime caveat**: focus-trap and Esc-restore-focus behaviors require keyboard testing per the parent runtime-deferred list.

**See also**: **VVT-067** (`visual-verification-triggers/component-composition.md`) — runtime-verification trigger when code authors HTML `<dialog>` + `.showModal()` for alertdialog patterns (destructive-confirmation flows); this rule defines the WCAG/APG alertdialog-specific policy (`role="alertdialog"` + `aria-describedby`), VVT-067 flags the runtime verification of focus + Esc + return-focus on the underlying `<dialog>` primitive.

---

### A11Y-048: Combobox — input + popup with full ARIA pattern

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A, 2.1.1 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

**The rule**: Comboboxes (autocomplete inputs, select-search inputs) use `<input role="combobox">` carrying `aria-expanded`, `aria-controls` (popup id), `aria-autocomplete` (`list` / `both` / `inline` / `none`), and `aria-activedescendant` (current option id while navigating with arrows without moving DOM focus).

**Code patterns to flag**:
- `<input>` with attached dropdown but no `role="combobox"` / `aria-expanded` / `aria-controls`
- Popup with no `role="listbox"` and no `role="option"` children
- Arrow-key navigation that moves DOM focus into the popup (vs setting `aria-activedescendant` on the input)
- `aria-autocomplete="off"` paired with a visible filtering list (mismatch)
- No `aria-selected` on the currently-highlighted option

**Correct pattern**:
```html
<input
  role="combobox"
  aria-expanded="true"
  aria-controls="city-listbox"
  aria-autocomplete="list"
  aria-activedescendant="city-3"
/>
<ul id="city-listbox" role="listbox">
  <li id="city-1" role="option" aria-selected="false">Aalborg</li>
  <li id="city-3" role="option" aria-selected="true">Århus</li>
</ul>
```

**Quick-fix hint**: Match the canonical APG combobox pattern; prefer mature libraries (Downshift, react-aria, Headless UI) that implement full ARIA semantics correctly.

**Runtime caveat**: keyboard semantics (Down/Up to navigate, Enter to select, Esc to close+restore) require runtime verification.

**See also**: **VVT-073** (`visual-verification-triggers/css-styling.md`, "CSS Anchor Positioning") — runtime-verification trigger when the combobox popup surface migrates to native CSS Anchor Positioning (replacing JS-positioned popup via Floating UI / Popper.js / Downshift's positioning). Verify the anchored popup respects this rule's keyboard semantics (Down/Up navigation, Enter to select, Esc to close + restore focus to input) under the anchored layout — anchor positioning resolves at layout time, so SSR / hydration timing may briefly mis-position the popup before keyboard handlers are wired. **COMP-APG-03** (`compliance/aria-apg-full.md`, "Combobox — `role='combobox'` + `aria-expanded` + `aria-activedescendant` + popup `role='listbox'`") — A11Y-048 is the baseline-conformance rule (most common combobox defects); COMP-APG-03 extends to FULL APG conformance including the four `aria-autocomplete` variants + complete keyboard model + strict `aria-activedescendant` tracking semantics.

---

### A11Y-049: Dialog (Modal) — focus trap + initial focus + Esc + return focus

**Severity**: CRITICAL
**WCAG**: 2.4.3 Level A, 4.1.2 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

**The rule**: Modal dialogs must (1) use `role="dialog"` (or `<dialog>`) with `aria-modal="true"`, (2) carry an accessible name (`aria-labelledby` or `aria-label`), (3) move focus to a sensible element on open, (4) trap focus inside the dialog while open, (5) close on Esc, (6) restore focus to the triggering element on close.

**Code patterns to flag**:
- `role="dialog"` without `aria-modal="true"` on a modal
- No `aria-labelledby` / `aria-label`
- No `inert` on the underlying page content — Tab can escape
- Missing Esc-handler; no focus-restore on close
- Custom dialog without focus-trap library AND without inert backdrop

**Correct pattern**:
```html
<div inert>{/* main page */}</div>
<dialog open aria-labelledby="dlg-title">
  <h2 id="dlg-title">Edit profile</h2>
  <button autofocus>Cancel</button>
  …
</dialog>
```

**Quick-fix hint**: Use native `<dialog>.showModal()` — it provides focus trap, inert backdrop, and Esc handling automatically. For React/Vue, use Radix / react-aria / Headless UI dialog primitives.

**Runtime caveat**: focus-trap effectiveness + return-focus require keyboard testing. Severity is CRITICAL because broken modal dialogs are a top-impact accessibility blocker.

**See also**: **VVT-067** (`visual-verification-triggers/component-composition.md`) — runtime-verification trigger when code authors HTML `<dialog>` + `.showModal()` or imperative `.show()` API; this rule defines the WCAG/APG modal-dialog focus + Esc + return-focus policy that VVT-067's runtime checks verify on the native primitive. **COMP-APG-07** (`compliance/aria-apg-full.md`, "Date Picker Dialog — text input + button trigger + dialog with `role='grid'` calendar + full keyboard model") — the Date Picker Dialog composes the Dialog pattern; A11Y-049's focus-trap + initial-focus + Esc + return-focus requirements apply directly to the date-picker dialog surface. **COMP-APG-14** (`compliance/aria-apg-full.md`, "Dialog (Modal) — initial-focus selection rule + return-focus exceptions") — A11Y-049 covers baseline focus-management presence (trap, Esc, return); COMP-APG-14 formalizes the initial-focus decision tree (complex content → focus title with `tabindex="-1"`; destructive action → focus Cancel; info-only → focus close/OK) + the return-focus workflow-advance exception.

---

### A11Y-050: Disclosure — `<button aria-expanded>` toggling a region

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/

**The rule**: Disclosure widgets (FAQ rows, "Show more" toggles, expandable settings) use a `<button>` with `aria-expanded` (required) — optionally `aria-controls` referencing the disclosed content's `id` (recommended, APG explicitly optional). Simpler than accordion (no heading wrapper, no peer-toggling semantics).

**Code patterns to flag**:
- `<div onClick>` or `<a onClick>` toggling visibility (use `<button>`)
- `aria-expanded` missing or hard-coded
- Native `<details>` / `<summary>` would have been simpler — flag custom implementations as a refactor opportunity
- "Show more" link that becomes "Show less" without `aria-expanded` updating

**Correct pattern**:
```html
<button aria-expanded="false" aria-controls="more-detail">Show more</button>
<div id="more-detail" hidden>…</div>

<details>
  <summary>Show more</summary>
  …
</details>
```

**Quick-fix hint**: Prefer `<details>` / `<summary>` for simple disclosure; reach for custom only when styling makes native impossible.

**See also**: **VVT-064** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code adopts the native `<details>` / `<summary>` disclosure widget; this rule defines the policy + recommends the native primitive, VVT-064 flags when code changes warrant runtime check (UA-default triangle rendering, `open` boolean semantics, keyboard interaction, AT announcement).

---

### A11Y-051: Listbox — `role="listbox"` + `role="option"` + `aria-selected`

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A, 2.1.1 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/

**The rule**: Custom listboxes (when native `<select>` won't do) use `role="listbox"` on the container and `role="option"` on each item. Single-select listboxes use `aria-selected="true"` on the current option; multi-select use `aria-multiselectable="true"` on the listbox and `aria-selected` on each option.

**Code patterns to flag**:
- Custom `<ul>` / `<div>` rendering options without `role="listbox"` / `role="option"`
- Selection state communicated only via CSS class (`.selected`) with no `aria-selected`
- Multi-select listbox missing `aria-multiselectable="true"`
- `<select>` replaced by custom widget without complete APG semantics — prefer native `<select>` unless filtering is needed (in which case use combobox A11Y-048)

**Correct pattern**: prefer native `<select>` whenever possible. For custom listboxes, follow the APG single-select or multi-select template with full keyboard arrow navigation.

**Runtime caveat**: arrow navigation + Home/End + type-ahead require keyboard testing.

**See also**: **COMP-APG-03** (`compliance/aria-apg-full.md`, "Combobox — `role='combobox'` + `aria-expanded` + `aria-activedescendant` + popup `role='listbox'`") — A11Y-051 covers standalone listbox composition; the combobox popup IS a listbox, so COMP-APG-03 references A11Y-051's rules for the popup composition (role / option / aria-selected / aria-multiselectable when applicable). **COMP-APG-13** (`compliance/aria-apg-full.md`, "Listbox (multi-select with virtual focus) — `aria-multiselectable` + `aria-activedescendant` + range-extending keyboard model") — A11Y-051 covers the baseline single-select listbox; COMP-APG-13 extends to multi-select with virtual focus (DOM focus stays on listbox container; aria-activedescendant tracks virtually-focused option) + full range-extending keyboard set (Shift+arrows, Ctrl+Space, Ctrl+A).

---

### A11Y-052: Menu / Menubar — `role="menu"` + `role="menuitem"` + roving-tabindex

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A, 2.1.1 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/menubar/

**The rule**: `role="menu"` / `role="menubar"` is most appropriate for application-style menus offering actions/functions. Children are `role="menuitem"` (or `menuitemcheckbox` / `menuitemradio` for stateful items). Menus require keyboard navigation via roving-tabindex OR `aria-activedescendant` (both APG-sanctioned).

**Note on site-navigation use** (doctrinal split): MDN's [menu role reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menu_role) explicitly recommends NOT using menu role for site navigation. The cited APG menubar page does publish a "Navigation Menubar Example" alongside the editor example as a recognized correct use case. Resolve by codebase preference: most production codebases follow MDN guidance (use `<nav>` + `<ul>` + `<a>` for site nav, no ARIA menu roles); APG-compliant site-nav menubars are also valid.

**Code patterns to flag**:
- `<nav role="menu">` site navigation when the codebase otherwise follows MDN-style "don't use menu for site nav" — surface as preference-driven recommendation, not strict defect
- `<a role="menuitem">` for site links — menuitems are typically app actions; reframe as link or evaluate against codebase convention
- All children have `tabindex="0"` AND no `aria-activedescendant` on container — should be roving-tabindex OR aria-activedescendant pattern
- Esc does not close the menu / restore focus to the trigger

**Correct pattern**: use menu/menubar for application menus (code-editor File/Edit/View bar; dropdown action menu). For site navigation, prefer `<nav>` + `<ul>` + `<a>` unless the codebase has explicit conventions to use menubar (rare but APG-valid).

**Quick-fix hint**: When in doubt, prefer `<nav>` + links over menu roles for site navigation; reach for menu/menubar when the UI is genuinely an application command surface. Use roving-tabindex OR `aria-activedescendant` — both APG-sanctioned.

**Runtime caveat**: keyboard semantics (arrows, Home, End, Esc, type-ahead) require runtime verification.

**See also**: **VVT-073** (`visual-verification-triggers/css-styling.md`, "CSS Anchor Positioning") — runtime-verification trigger when the menu / menubar surface migrates to native CSS Anchor Positioning for popup placement (replacing JS-positioned menus via Floating UI / Popper.js / Headless UI's positioning). Verify this rule's arrow / Home / End / Esc / type-ahead keyboard semantics still resolve correctly under the anchored layout — anchored popups can be clipped by ancestor `overflow: hidden` (VVT-009 territory) without explicit ancestor allowlisting.

---

### A11Y-053: Menu Button — `<button aria-haspopup aria-expanded aria-controls>`

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/

**The rule**: A button that opens a menu must declare `aria-haspopup` (per APG menu-button: `menu` or `true`; WAI-ARIA 1.2 also accepts `listbox` / `tree` / `grid` / `dialog` for non-menu popups) and `aria-expanded` reflecting open state. `aria-controls` referencing the popup's `id` is optional per APG (recommended for clarity).

**Code patterns to flag**:
- Dropdown button without `aria-haspopup`
- `aria-expanded` missing (AT cannot announce open/closed state)
- `aria-controls` present but pointing at a non-existent id (broken reference, not a missing-required-attr issue)
- Click-only opening with no keyboard handler (real `<button>` activates via Enter/Space natively; `<div role="button">` requires manual wiring)

**Correct pattern**:
```html
<button aria-haspopup="menu" aria-expanded="false" aria-controls="actions-menu">
  Actions ▾
</button>
<ul id="actions-menu" role="menu" hidden>
  <li role="menuitem">Duplicate</li>
  …
</ul>
```

**Quick-fix hint**: Required: `aria-haspopup` + `aria-expanded` on the trigger; switch `aria-expanded` on open/close. `aria-controls` optional but recommended. Compose with Menu (A11Y-052) for the full dropdown pattern.

**See also**: **VVT-073** (`visual-verification-triggers/css-styling.md`, "CSS Anchor Positioning") — runtime-verification trigger when the menu-button + popup composition migrates to native CSS Anchor Positioning (the menu button is the anchor; the popup is the positioned element). Verify this rule's `aria-haspopup` + `aria-expanded` + `aria-controls` semantics resolve correctly under the anchored layout — `aria-controls` must reference the anchored popup's id, which must remain valid through anchored-popup mount/unmount lifecycle.

---

### A11Y-054: Radio Group — `<fieldset><legend>` or `role="radiogroup"` with name

**Severity**: MAJOR
**WCAG**: 1.3.1 Level A, 3.3.2 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/radio/

**The rule**: A group of related radio buttons must have a group-level accessible name. Native: `<fieldset><legend>Question</legend><input type="radio">…</fieldset>`. Custom: `<div role="radiogroup" aria-labelledby="q1-title">` with `<div role="radio" aria-checked>` children + roving tabindex.

**Code patterns to flag**:
- Multiple `<input type="radio">` with same `name` but no `<fieldset>` / `<legend>` wrapper
- Custom radio group without `role="radiogroup"` or accessible name
- All radio elements have `tabindex="0"` AND no `aria-activedescendant` on the radiogroup container (must be roving-tabindex OR aria-activedescendant — both APG-sanctioned)

**Correct pattern**:
```html
<fieldset>
  <legend>Plan</legend>
  <label><input type="radio" name="plan" value="free"> Free</label>
  <label><input type="radio" name="plan" value="pro"> Pro</label>
</fieldset>
```

**Quick-fix hint**: Use native `<fieldset><legend>` unless visual styling makes that impossible.

**See also**: **COMP-APG-02** (`compliance/aria-apg-full.md`, "Checkbox (tri-state / mixed) — `role='checkbox'` + `aria-checked='mixed'` cycle") — A11Y-054 is the mutually-exclusive group-control pattern (radio group); COMP-APG-02 covers the independent-multi-select group pattern (checkbox group with tri-state parent). Together the two rules cover the canonical group-control compositional space.

---

### A11Y-055: Slider — `role="slider"` + `aria-valuemin/max/now` + `aria-valuetext` where needed

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A, 2.1.1 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/slider/

**The rule**: Custom sliders (when native `<input type="range">` won't do) must declare `role="slider"`, `tabindex="0"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext` when the numeric `aria-valuenow` doesn't convey the meaning (e.g., "Low / Medium / High" for a 3-position slider).

**Code patterns to flag**:
- Custom `<div>` thumb without `role="slider"` / `tabindex="0"`
- Missing `aria-valuenow` (no live value announcement)
- Arrow-key handlers not wired (must respond to Left/Right/Up/Down + Home/End + PageUp/PageDown)
- Slider with semantic labels (Low/Medium/High) where `aria-valuenow="1"` is announced without context — needs `aria-valuetext`

**Correct pattern**:
```html
<input type="range" min="0" max="100" value="50" aria-label="Volume">

<div role="slider" tabindex="0"
     aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"
     aria-label="Volume">…</div>
```

**Quick-fix hint**: Use native `<input type="range">` whenever possible.

**Runtime caveat**: keyboard semantics (arrows, Home, End, PageUp/Down) require runtime verification.

**See also**: **COMP-APG-06** (`compliance/aria-apg-full.md`, "Spinbutton — `role='spinbutton'` + `aria-valuemin/max/now` + arrow-key step") — Slider is the *continuous-range* input pattern (typically with a draggable thumb across a 2D track); Spinbutton is the *discrete-step* variant (Up/Down arrows step by 1, no draggable thumb). Choose Slider when the UI affords both keyboard + draggable thumb; Spinbutton when the value is keyboard-only-step (numeric inputs, date components). **COMP-APG-08** (`compliance/aria-apg-full.md`, "Slider (Multi-thumb) — each thumb is `role='slider'` with independent valuenow + mutually-constrained min/max") — A11Y-055 covers the single-thumb baseline; COMP-APG-08 extends to the multi-thumb compositional case (price-range, time-range filters) with mutual min/max constraints + constant-tab-order requirement when thumbs cross visually.

---

### A11Y-056: Switch — `role="switch"` + `aria-checked`

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/switch/

**The rule**: A toggle widget that flips a setting on/off uses `<button role="switch" aria-checked="true|false">` with click + Space + Enter handlers, OR `<input type="checkbox" role="switch">` (UA support uneven). Visually styled as track + thumb but semantically a two-state toggle.

**Code patterns to flag**:
- `<div onClick>` toggle without `role="switch"` or `<button>`
- `role="switch"` without `aria-checked`
- `<input type="checkbox">` styled as a switch but no `role="switch"` (some AT will still announce as checkbox)
- No keyboard handler on a custom switch (must respond to Enter and Space)

**Correct pattern**:
```html
<button role="switch" aria-checked="true" aria-labelledby="notif-label">
  <span id="notif-label">Email notifications</span>
</button>
```

**Quick-fix hint**: Prefer `<button role="switch">` over native checkbox-styled-as-switch; supports keyboard activation cleanly.

---

### A11Y-057: Tabs — `role="tablist"` + `role="tab"` + `role="tabpanel"` + roving tabindex

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A, 2.1.1 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/

**The rule**: Tab widgets use `<div role="tablist">` containing `<button role="tab" aria-selected aria-controls="panel-id">` triggers, and `<div role="tabpanel" id="panel-id" aria-labelledby="tab-id">` for each panel. Roving-tabindex on tabs (selected = 0, others = -1). Arrow keys navigate; Tab moves out of tablist into the active panel.

**Code patterns to flag**:
- Tab buttons without `role="tab"` / `aria-selected`
- Tab panels without `role="tabpanel"` / `aria-labelledby`
- All tabs have `tabindex="0"` AND no `aria-activedescendant` on the tablist (should be roving-tabindex OR aria-activedescendant — both APG-sanctioned)
- `aria-selected="true"` on tab without `aria-controls` to the panel
- Multiple tabs `aria-selected="true"` simultaneously

**Correct pattern**: follow the canonical APG tabs pattern. Prefer mature libraries (Radix, react-aria, Headless UI) — getting roving tabindex + arrow nav right manually is error-prone.

**Runtime caveat**: arrow-key navigation + automatic vs. manual activation choice require runtime verification.

**See also**: **COMP-APG-01** (`compliance/aria-apg-full.md`, "Carousel — `aria-roledescription='carousel'` + rotation control + per-slide naming") — A11Y-057 covers standalone Tabs composition; the tabbed-carousel variant composes Tabs as its slide-picker mechanism, so COMP-APG-01 references A11Y-057's rules when the carousel uses tab semantics. **COMP-APG-12** (`compliance/aria-apg-full.md`, "Tabs (full keyboard model) — automatic-vs-manual activation choice + full keyboard set") — A11Y-057 covers the baseline Tabs requirements (roles, roving tabindex, basic arrow nav); COMP-APG-12 extends to formalize the automatic-vs-manual activation choice + Home/End + wrap-around at ends + sync between `aria-selected` and the active tab.

---

### A11Y-058: Toolbar — `role="toolbar"` + arrow-key + roving tabindex

**Severity**: MINOR
**WCAG**: 4.1.2 Level A, 2.1.1 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/

**The rule**: A toolbar (a row of related buttons / toggles, e.g., a rich-text editor toolbar) uses `role="toolbar"` with `aria-label` or `aria-labelledby`. Tab moves the entire toolbar in/out of focus as a single stop; arrow keys move between toolbar items (roving tabindex).

**Code patterns to flag**:
- Tabbing through every toolbar button individually (no roving tabindex)
- Toolbar without `role="toolbar"` or accessible name
- Mixed-purpose action row labeled as toolbar (toolbar should be related controls)

**Correct pattern**:
```html
<div role="toolbar" aria-label="Text formatting">
  <button tabindex="0">Bold</button>
  <button tabindex="-1">Italic</button>
  <button tabindex="-1">Underline</button>
</div>
```

**Quick-fix hint**: Reach for toolbar only when there's a clear "set of related controls" semantic; otherwise an unstyled `<div>` of buttons works fine without ARIA.

---

### A11Y-059: Tooltip — `role="tooltip"` + `aria-describedby` + hover + focus + Esc

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A, 1.4.13 Level AA
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/

**The rule**: Tooltips use `role="tooltip"` on the tooltip content and `aria-describedby` on the trigger referencing the tooltip's `id`. Tooltip must be triggered by BOTH hover AND keyboard focus (this is a WCAG 2.1.1 Keyboard / 2.4.7 Focus Visible requirement — APG describes both activation scenarios but does not strictly mandate both). WCAG 1.4.13 also requires dismissable via Esc without moving focus, hoverable without disappearing, and persistent until dismissed / focus lost. Note: APG tooltip pattern is marked as work-in-progress without task-force consensus.

**Code patterns to flag**:
- `title="…"` used as a tooltip — `title` is inconsistently exposed and broken on touch
- Tooltip on hover only (no focus trigger) — keyboard users can't see it
- Tooltip dismissed only on mouse-leave (no Esc handler)
- Tooltip disappears when user moves pointer onto the tooltip
- Trigger has no `aria-describedby`

**Correct pattern**:
```html
<button aria-describedby="save-tip">Save</button>
<span role="tooltip" id="save-tip" hidden>Saves the current draft.</span>
```

**Quick-fix hint**: Show on hover AND focus; dismiss on Esc; keep visible while pointer is over the tooltip.

**Runtime caveat**: 1.4.13 dismissability + hoverability behaviors require runtime testing.

**See also**: **VVT-073** (`visual-verification-triggers/css-styling.md`, "CSS Anchor Positioning") — runtime-verification trigger when code adopts native CSS Anchor Positioning (`anchor-name` / `position-anchor` / `anchor()` / `position-area`) for tooltip surfaces (a primary use case named in VVT-073's diff-observable Pattern). When tooltip layout migrates from JS-positioned (Floating UI / Popper.js) to native CSS anchor positioning, verify this rule's WCAG 1.4.13 dismissability + persistence + hoverability + 2.1.1 keyboard + 2.4.7 focus-visible requirements still hold on the anchored render path (anchor positioning resolves at layout time, NOT during hydration — verify SSR-rendered tooltips do not flash mis-positioned during the hydration window where keyboard activation may be ambiguous).

---

### A11Y-060: Tree View — `role="tree"` + `role="treeitem"` + `aria-expanded` / `aria-level`

**Severity**: MINOR
**WCAG**: 4.1.2 Level A, 2.1.1 Level A
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/treeview/

**The rule**: Hierarchical tree widgets (file browsers, nav trees) use `role="tree"` on the container and `role="treeitem"` on each node, with `aria-expanded` (true/false) on expandable nodes, `aria-level` indicating depth, and `aria-selected` on the current selection.

**Code patterns to flag**:
- Nested `<ul>` rendered as a tree without `role="tree"` / `role="treeitem"`
- Expandable nodes without `aria-expanded`
- `aria-level` / `aria-setsize` / `aria-posinset` missing on a tree with **dynamic loading or virtualization** where the complete hierarchy is NOT in the DOM (APG: these attributes are conditionally required only when nodes are not all present in the DOM)
- All treeitems have `tabindex="0"` AND no `aria-activedescendant` on the tree container (should be roving-tabindex OR aria-activedescendant — both APG-sanctioned)

**Correct pattern**: follow the canonical APG tree pattern — tree is one of the more complex APG widgets; prefer mature libraries (react-aria, Headless UI, RC Tree) over hand-rolling.

**Quick-fix hint**: For simple hierarchical navigation, consider whether disclosure (A11Y-050) or accordion (A11Y-045) would suffice; reach for full tree semantics only when the hierarchy is deep + interactive.

**Runtime caveat**: arrow-key navigation (Left collapse, Right expand, Up/Down between visible items) requires runtime verification.

**See also**: **COMP-APG-09** (`compliance/aria-apg-full.md`, "Treegrid — `role='treegrid'` + `aria-expanded` on parent rows + `aria-level` + cell navigation with expand/collapse") — Tree is the non-tabular hierarchical pattern (single column of items with expand/collapse); Treegrid extends Tree with multi-column tabular cells. When a hierarchy has no tabular columns, use Tree (A11Y-060); when it has tabular cells, use Treegrid (COMP-APG-09).
