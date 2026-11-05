# Accessibility — Interactive elements

Part of [.aivv/standards/accessibility/](README.md) (A11Y-015..019, A11Y-039..040, A11Y-068..069).

### A11Y-015: Use the correct element — link vs button

**Severity**: CRITICAL
**WCAG**: 1.3.1 Level A, 4.1.2 Level A
**Source**: https://www.w3.org/TR/using-aria/#rule1

**The rule**: Use `<a href>` for navigation; `<button>` for in-page actions. Do not substitute one for the other, and do not reinvent either with `<div>`/`<span>`.

**Code patterns to flag**:
- `<a>` with `onClick` that triggers an action and no `href` (no role, not keyboard-activatable)
- `<a href="#">` or `<a href="javascript:void(0)">` used as an action trigger
- `<div>` / `<span>` with `onClick` but no `role`, no `tabindex`, no keyboard handler
- `<button>` used purely for navigation to another URL

**Correct pattern**:
```jsx
<a href="/settings">Settings</a>          {/* navigates */}
<button type="button" onClick={open}>Open panel</button>  {/* acts */}
```

**Quick-fix hint**: Swap to the native element that matches the behavior; delete `role="button"` workarounds.

---

### A11Y-016: `<button>` must declare `type`

**Severity**: MAJOR
**WCAG**: 3.2.2 Level A (unexpected submission)
**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-type

**The rule**: Buttons inside a `<form>` default to `type="submit"`. Every `<button>` should state its `type` explicitly to prevent accidental form submission.

**Code patterns to flag**:
- `<button>` inside `<form>` with no `type` attribute and an `onClick` that is not the form submit handler
- React `<button onClick={...}>` with no `type` prop inside form markup

**Correct pattern**:
```jsx
<button type="button" onClick={toggleMenu}>Menu</button>
<button type="submit">Save</button>
```

**Quick-fix hint**: Add `type="button"` to action buttons; `type="submit"` to the form's submit control.

---

### A11Y-017: Custom controls built from `<div>`/`<span>` must wire keyboard support

**Severity**: CRITICAL
**WCAG**: 2.1.1 Level A, 4.1.2 Level A
**Source**: https://webaim.org/techniques/keyboard/

**The rule**: If a non-interactive element is made clickable, it must also have `role`, `tabindex="0"`, and keyboard handlers for Enter/Space (for button semantics) or arrow keys (for composite widgets).

**Code patterns to flag**:
- `<div onClick={...}>` with no `role`, no `tabindex`, no `onKeyDown`
- `role="button"` with no `tabindex="0"` (unreachable by keyboard)
- `tabindex="0"` with no keyboard handler (focusable but non-operable)
- Using `onKeyPress` (deprecated) instead of `onKeyDown`

**Correct pattern** (prefer native `<button>`; this is the retrofit shape):
```jsx
<div
  role="button"
  tabIndex={0}
  onClick={doThing}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doThing(); } }}
>Do thing</div>
```

**Quick-fix hint**: Replace the `<div>` with `<button type="button">`. If that's blocked, add the four pieces above together.

**See also**: **COMP-WCAG-AAA-04** (`compliance/wcag-aaa.md`, "Full keyboard operability (No Exception)") — A11Y-017 enforces the AA-baseline 2.1.1 keyboard reachability for custom controls; COMP-WCAG-AAA-04 extends to the strict-AAA case removing path-dependent-input exceptions.

---

### A11Y-018: Do not use positive `tabindex` values

**Severity**: MAJOR
**WCAG**: 2.4.3 Level A
**Source**: https://webaim.org/techniques/keyboard/

**The rule**: Allowed `tabindex` values are `0` (follow DOM order) and `-1` (programmatically focusable, not in tab order). Positive values (`tabindex="1"`, `"2"`, …) override natural order and almost always break focus flow.

**Code patterns to flag**:
- Any `tabindex="<positive integer>"`
- `tabindex="0"` added to already-focusable elements (`<button>`, `<a href>`, `<input>`) — redundant

**Correct pattern**:
```html
<button>OK</button>            <!-- naturally focusable, no tabindex -->
<div tabindex="0" role="…">…</div>  <!-- custom widget opt-in -->
<div tabindex="-1">…</div>     <!-- scripted focus target only -->
```

**Quick-fix hint**: Remove positive values; rely on DOM order. Strip redundant `tabindex="0"` from native controls.

**See also**: **COMP-APG-01** (`compliance/aria-apg-full.md`, "Carousel — `aria-roledescription='carousel'` + rotation control + per-slide naming") — A11Y-018 enforces the no-positive-tabindex rule across all widgets; COMP-APG-01 references this when establishing carousel tab order (rotation control first, then slide content, then slide-picker controls) — positive tabindex on carousel slide-picker controls breaks the APG-recommended sequence. **COMP-APG-05** (`compliance/aria-apg-full.md`, "Grid — `role='grid'` + cell navigation keyboard model + `aria-rowindex` / `aria-colindex` for virtual grids") — grid implementation uses roving-tabindex (one cell `tabIndex={0}`, rest `tabIndex={-1}`); positive tabindex violates A11Y-018 and breaks the grid's tab-as-single-stop semantics. **COMP-APG-11** (`compliance/aria-apg-full.md`, "Window Splitter — `role='separator'` + `aria-controls` + arrow-key resize + Enter to collapse/restore") — the splitter element gets `tabindex="0"` to enter the page tab sequence; nested controls inside the resized panes follow DOM order without positive tabindex. **COMP-APG-13** (`compliance/aria-apg-full.md`, "Listbox (multi-select with virtual focus) — `aria-multiselectable` + `aria-activedescendant` + range-extending keyboard model") — virtual-focus listbox keeps `tabIndex={0}` on the listbox container; options have NO tabindex (they're addressed only via aria-activedescendant). Positive tabindex on options breaks the virtual-focus pattern.

---

### A11Y-019: Links that open in a new tab/window must announce that

**Severity**: MINOR
**WCAG**: G201 (advisory), 3.2.5 (AAA but widely applied)
**Source**: https://www.a11yproject.com/checklist/

**The rule**: Links using `target="_blank"` must tell users (screen-reader or sighted) that a new tab/window will open, and should carry `rel="noopener"` (or `rel="noreferrer"`) for security.

**Code patterns to flag**:
- `target="_blank"` with no accompanying icon + visually-hidden text or `aria-label` mentioning "(opens in new tab)"
- `target="_blank"` without `rel="noopener"` (security, not a11y — still flag as MINOR)

**Correct pattern**:
```html
<a href="https://example.com" target="_blank" rel="noopener">
  Report <span class="visually-hidden">(opens in new tab)</span>
</a>
```

**Quick-fix hint**: Append visually-hidden "(opens in new tab)" text or an icon with an equivalent label; add `rel="noopener"`.

**See also**: **COMP-WCAG-AAA-10** (`compliance/wcag-aaa.md`, "Link purpose identifiable from link text alone") — A11Y-019 enforces destination-disclosure for the new-tab case (programmatic + visible indication of `target="_blank"`); COMP-WCAG-AAA-10 is the broader link-purpose-identification AAA SC (WCAG 2.4.9) covering all links — the new-tab-disclosure mechanism is one instance of the broader purpose-identification requirement.

---

### A11Y-039: Provide a single-pointer alternative for any dragging-based interaction

**Severity**: MAJOR
**WCAG**: 2.5.7 Level AA (WCAG 2.2 NEW)
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html

**The rule**: All functionality that uses a dragging movement must also be achievable with a single pointer action (click/tap) — unless dragging is essential to the function (e.g., signature pad, freehand drawing).

**Code patterns to flag**:
- Sortable lists implemented via drag-only libraries (`react-dnd`, `sortablejs`) with no exposed up/down reorder buttons
- Range sliders (`<input type="range">`) styled with a custom thumb that only responds to `pointerdown`+`pointermove` and overrides keyboard arrow handling
- Kanban / drag-to-resize / drag-to-pan widgets without click-button or numeric-input fallbacks
- Color picker / image-crop UIs that only expose drag handles

**Correct pattern**:
```jsx
<li>
  Task A
  <button aria-label="Move task up" onClick={() => moveUp(id)}>↑</button>
  <button aria-label="Move task down" onClick={() => moveDown(id)}>↓</button>
</li>
```
Keep the drag behavior for users who prefer it; add visible single-pointer alternatives.

**Quick-fix hint**: For any drag-based UI in the diff, confirm a click/tap alternative exists or add buttons (or numeric input fields for sliders).

**See also**: **COMP-WCAG-AAA-04** (`compliance/wcag-aaa.md`, "Full keyboard operability (No Exception)") — A11Y-039 enforces the AA-baseline WCAG 2.5.7 single-pointer-alternative requirement for drag interactions; COMP-WCAG-AAA-04 is the strict-AAA companion (WCAG 2.1.3) requiring a full keyboard alternative for path-dependent input (vs A11Y-039's pointer-alternative scope).

---

### A11Y-040: Pointer targets must be at least 24×24 CSS pixels (or have ≥24px spacing)

**Severity**: MAJOR
**WCAG**: 2.5.8 Level AA (WCAG 2.2 NEW)
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

**The rule**: Pointer targets (links, buttons, form controls, custom interactive elements) must be at least 24×24 CSS pixels OR positioned with adequate spacing so a 24px circle centered on the target does not overlap another target.

**Code patterns to flag**:
- Tailwind / utility classes that explicitly under-size: `h-4 w-4`, `text-xs px-0` on `<button>` / `<a>` with no padding compensation, `min-h-[16px]` on a touch target
- Inline icon links rendered without padding (e.g., `<a class="inline-block"><svg width="16" height="16" /></a>` — total target 16×16)
- Close `×` buttons on toasts/chips/banners with `width:20px;height:20px` and no surrounding hit-area
- Dropdown chevron / menu trigger with `padding: 2px` on a 16px icon (computed 20×20 still under 24)
- Adjacent action icons placed `gap-0` / `gap-px` so spacing fails too

**Correct pattern**:
```jsx
<button className="min-w-[24px] min-h-[24px] p-1 inline-flex items-center justify-center">
  <CloseIcon className="w-4 h-4" />
</button>
```

**Exceptions (WCAG 2.5.8)** — DO NOT flag when:
- **Inline**: the target is in a sentence or its size is constrained by the line-height of non-target text (e.g., an `<a>` inside `<p>` body text). This is the most common false-positive class — body-text links are explicitly exempt.
- **Spacing**: undersized targets surrounded by enough space that a 24px-diameter circle centered on each target does not overlap another target's bounding box (target + spacing ≥ 24px).
- **Equivalent**: the same function is available via a same-page target that does meet the 24px minimum.
- **User-Agent Control**: native form controls before any author CSS (e.g., default `<select>`, `<input type="checkbox">`) — the SC defers to UA defaults.
- **Essential**: the specific presentation is essential (e.g., dense map markers, music-notation hit-areas — uncommon outside specialized UIs).

**Quick-fix hint**: Apply `min-width: 24px; min-height: 24px` (or `min-h-6 min-w-6` in Tailwind) on interactive elements; pad icon-only buttons with at least 4px on each side around a 16px glyph. Skip when the target is inline-text or has compliant spacing.

**Runtime caveat**: cascade-dependent sizing (parent inherited font-size, ancestor flex-shrink) must be confirmed visually. Code review catches hard-coded too-small dimensions outside the exception cases; computed-only cases route to visual verification per the README's runtime-deferred list (which previously surfaced 2.5.8 unconditionally; A11Y-040 narrows the code-review-capable subset).

---

### A11Y-068: When media autoplays audio for >3 seconds, provide pause/stop or independent volume control

**Severity**: MAJOR
**WCAG**: 1.4.2 Audio Control Level A (applies specifically to audio playing automatically for >3 seconds)
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/audio-control.html
**COGA**: O5 (Help users focus — autoplay disrupts attention)

**The rule**: Per WCAG 1.4.2, when ANY audio plays automatically for more than 3 seconds, the page must provide either (a) a mechanism to pause/stop the audio, or (b) a mechanism to control audio volume independently from the overall system volume. Silent/muted autoplay video does NOT trigger 1.4.2 — but COGA O5 still motivates muting decorative hero videos by default.

**Code patterns to flag (WCAG 1.4.2 violations)**:
- `<audio autoplay>` (any duration ≥3s) without `controls`
- `<video autoplay>` with an audio track playing >3s without `muted` AND without `controls`
- Embed iframes (YouTube, Vimeo) with autoplay query params (`?autoplay=1`) without `&mute=1` AND no on-page controls
- `<audio autoplay loop>` with no pause/stop control

**Code patterns to flag (COGA-advisory, not WCAG violation)**:
- `<video autoplay loop>` with NO audio track and NO `muted` attribute (defensive practice — set `muted` so any future audio track addition doesn't introduce a 1.4.2 violation)
- Carousel of decorative `<video>` elements auto-playing on slide change (focus-disruption per COGA O5, even when silent)

**Correct pattern**:
```html
<video autoplay muted loop playsinline>  <!-- decorative hero, no audio -->
  <source src="hero-bg.mp4" type="video/mp4">
</video>

<video autoplay controls>  <!-- has audio; controls satisfy 1.4.2 -->
  <source src="story.mp4" type="video/mp4">
</video>
```

**Quick-fix hint**: For decorative video, always `muted` (defensive practice + COGA O5). For content video with audio, prefer no `autoplay`; if `autoplay` is essential, ensure `controls` are visible from the start (within first 3 seconds).

---

### A11Y-069: Session timeout warning + extend mechanism BEFORE expiration

**Severity**: MAJOR
**WCAG**: 2.2.1 Timing Adjustable Level A
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/timing-adjustable.html
**COGA**: O6 (Help users avoid mistakes — memory burden)

**The rule**: When a session, form, or page has a timeout that loses user state, the application must (per WCAG 2.2.1) offer at least one of: (a) **Turn off** — user can disable the timeout entirely; (b) **Adjust** — user can adjust the timeout to at least 10× the default; OR (c) **Extend** — user is warned at least 20 seconds before time expires and can extend the timeout simply (e.g., pressing the space bar), and is allowed to extend at least 10 times. Exceptions: real-time required (live auction), essential (banking session security), or timeout ≥ 20 hours.

**Code patterns to flag**:
- Session-timeout logic that fires logout/data-loss with no prior warning dialog
- Idle-timeout countdown in source code (e.g., `setTimeout(logout, 600000)`) with no paired warning
- "Click to extend" UI that surfaces AFTER timeout (post-loss)
- Form auto-save absent on long forms (separate but related — auto-save mitigates timeout risk)

**Correct pattern**:
```jsx
// Show warning 2 minutes before timeout
useEffect(() => {
  const warnAt = TIMEOUT_MS - 2 * 60 * 1000;
  const timer = setTimeout(() => setShowTimeoutWarning(true), warnAt);
  return () => clearTimeout(timer);
}, []);

{showTimeoutWarning && (
  <dialog open role="alertdialog" aria-labelledby="t-title" aria-describedby="t-desc">
    <h2 id="t-title">Your session is about to expire</h2>
    <p id="t-desc">You'll be signed out in 2 minutes. Want to stay signed in?</p>
    <button autofocus onClick={extendSession}>Stay signed in</button>
    <button onClick={signOut}>Sign out now</button>
  </dialog>
)}
```

**Quick-fix hint**: Show an alertdialog (A11Y-047) warning at least 60s before timeout, with a clearly-labeled extend button focused by default. Banking/legal applications may exempt per the SC's listed exceptions.

**See also**: **COMP-WCAG-AAA-05** (`compliance/wcag-aaa.md`, "No timing constraints on essential interactions") — A11Y-069 enforces the AA-baseline WCAG 2.2.1 timing-adjustable requirement (warn + extend before expiration); COMP-WCAG-AAA-05 is the strict-AAA companion (WCAG 2.2.3) eliminating essential-interaction time-limits entirely (vs A11Y-069's adjust/extend/warn approach). **COMP-WCAG-AAA-08** (`compliance/wcag-aaa.md`, "Re-authenticating must preserve user data") — complementary to A11Y-069's *pre-expiration* warn-and-extend mechanism: COMP-WCAG-AAA-08 covers the *post-expiration* data-preservation requirement (WCAG 2.2.5 AAA) for the case where session expiration nonetheless occurs. **COMP-WCAG-AAA-15** (`compliance/wcag-aaa.md`, "Warn users of inactivity timeouts that could cause data loss") — A11Y-069 enforces *mid-session* warn-and-extend (WCAG 2.2.1 AA); COMP-WCAG-AAA-15 covers *upfront-disclosure* of the inactivity-timeout duration so users can plan their work (WCAG 2.2.6 AAA). Together AAA-05 / AAA-08 / AAA-15 + A11Y-069 cover the full session-timing-axis policy stack.
