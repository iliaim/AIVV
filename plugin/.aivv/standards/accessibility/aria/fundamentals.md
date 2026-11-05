# Accessibility — ARIA fundamentals

Part of [.aivv/standards/accessibility/aria/](README.md) (A11Y-024..029). These rules cover the "first rule of ARIA" and the name/label/state/live-region foundations that the APG widget patterns (A11Y-045..060 in [`apg-widgets.md`](apg-widgets.md)) build on.

### A11Y-024: Prefer native HTML over ARIA (first rule of ARIA)

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A
**Source**: https://www.w3.org/TR/using-aria/#rule1

**The rule**: If a native HTML element or attribute provides the needed semantics and behavior, use it instead of repurposing a generic element with ARIA.

**Code patterns to flag**:
- `<div role="button">` where `<button>` would work
- `<div role="link">` instead of `<a href>`
- `<div role="navigation">` instead of `<nav>`
- `<div role="heading" aria-level="2">` instead of `<h2>`
- `<ul role="list">` (redundant — flag as MINOR)

**Correct pattern**:
```html
<button type="button">Open</button>
<nav aria-label="Primary">…</nav>
<h2>Section title</h2>
```

**Quick-fix hint**: Replace the role-decorated `<div>` with the native element.

---

### A11Y-025: Do not put `aria-hidden="true"` on focusable elements or their ancestors

**Severity**: CRITICAL
**WCAG**: 4.1.2 Level A
**Source**: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden

**The rule**: `aria-hidden="true"` removes an element (and its subtree) from the accessibility tree. Applying it to an element that can receive focus — or that contains one — makes it operable but invisible to assistive tech.

**Code patterns to flag**:
- `aria-hidden="true"` on `<button>`, `<a href>`, `<input>`, `<select>`, `<textarea>`
- `aria-hidden="true"` on a container that holds any of the above
- `aria-hidden="true"` combined with `display: none` / `hidden` attribute (redundant — flag as MINOR)
- `aria-hidden="false"` on a child whose ancestor has `aria-hidden="true"` (has no effect)

**Correct pattern**:
```html
<!-- icon is decoration; button itself is not hidden -->
<button type="button">
  <svg aria-hidden="true" focusable="false">…</svg>
  Delete
</button>
```

**Quick-fix hint**: Move `aria-hidden="true"` onto the decorative descendant (icon); never on interactive or interactive-containing elements.

---

### A11Y-026: `aria-label` / `aria-labelledby` require a valid target element

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A
**Source**: https://www.w3.org/TR/wai-aria-1.2/#aria-labelledby

**The rule**: `aria-labelledby` and `aria-describedby` must reference `id` values that exist in the DOM; `aria-label` must have a non-empty string. These attributes apply to elements with a role that accepts naming (most interactive and landmark roles).

**Code patterns to flag**:
- `aria-labelledby="xyz"` where `id="xyz"` is not in the document (or is itself hidden)
- `aria-label=""` (empty)
- `aria-label` duplicating the element's visible text verbatim (redundant, also risks failing 2.5.3 Label in Name if they don't match)
- `aria-label` on a `<div>` / `<span>` with no role — ignored by AT

**Correct pattern**:
```html
<button type="button" aria-labelledby="saveBtnLabel">
  <span id="saveBtnLabel">Save changes</span>
</button>

<nav aria-label="Footer">…</nav>
```

**Quick-fix hint**: Verify the referenced `id` exists; remove empty / redundant labels.

**See also**: **COMP-WCAG-AAA-07** (`compliance/wcag-aaa.md`, "Identify purpose of UI components, icons, and regions") — A11Y-026 enforces correct attachment of `aria-label` / `aria-labelledby` to elements with naming-capable roles (WCAG 4.1.2 A); COMP-WCAG-AAA-07 builds on this baseline to require that the accessible names themselves convey component purpose programmatically (WCAG 1.3.6 AAA).

---

### A11Y-027: Accessible name must include visible label text (Label in Name)

**Severity**: MAJOR
**WCAG**: 2.5.3 Level A
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/label-in-name.html

**The rule**: If a control has visible text, its accessible name (from `aria-label` or `aria-labelledby`) must contain that visible text verbatim — otherwise voice-control users cannot reach it by speaking what they see.

**Code patterns to flag**:
- `<button aria-label="Submit form">Save</button>` (visible "Save" is absent from the accessible name)
- Icon-button with visible text-tooltip that differs from its `aria-label`

**Correct pattern**:
```html
<button type="button" aria-label="Save changes">Save</button>
<!-- visible "Save" is a substring of accessible name "Save changes" -->
```

**Quick-fix hint**: Include the visible text at the start of the `aria-label`, or drop the `aria-label` and let the visible text become the accessible name.

**See also**: **COMP-WCAG-AAA-07** (`compliance/wcag-aaa.md`, "Identify purpose of UI components, icons, and regions") — A11Y-027 enforces the Label-in-Name rule that the accessible name contains visible label text verbatim (WCAG 2.5.3 A); COMP-WCAG-AAA-07 extends to the strict-AAA programmatically-typed-purpose requirement covering icon-only components where the accessible name carries purpose semantics beyond visible text (WCAG 1.3.6 AAA). **COMP-WCAG-AAA-10** (`compliance/wcag-aaa.md`, "Link purpose identifiable from link text alone") — A11Y-027 ensures visible link text appears verbatim in the accessible name (WCAG 2.5.3 A); COMP-WCAG-AAA-10 extends to require that the accessible name itself is sufficient for purpose-identification without surrounding-context disambiguation (WCAG 2.4.9 AAA).

---

### A11Y-028: `role="alert"` / `role="status"` / `aria-live` must be present before content changes

**Severity**: MAJOR
**WCAG**: 4.1.3 Level AA
**Source**: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions

**The rule**: Live-region containers must exist in the DOM before their content is updated. Adding `aria-live` at the same moment new text is injected leads to silent announcements.

**Code patterns to flag**:
- JS that first `setAttribute("aria-live", "polite")` and *then* writes text — flip the order
- `aria-live="assertive"` on non-urgent status (confirmations, saves) — should be `polite`
- `role="alert"` *and* `aria-live="assertive"` on the same element (redundant; `role="alert"` implies `assertive`)
- `aria-live="off"` (does not disable — misleading; use `aria-hidden` instead)

**Correct pattern**:
```jsx
{/* region persists in the tree, text swaps in on update */}
<div role="status" aria-live="polite">{statusText}</div>

{/* critical errors only */}
{error && <div role="alert">{error}</div>}
```

**Quick-fix hint**: Render the live region once as empty; update its text later. Reserve `assertive`/`alert` for errors and time-critical warnings.

**See also**: **COMP-WCAG-AAA-11** (`compliance/wcag-aaa.md`, "Context changes only on user request") — A11Y-028 ensures dynamic-content updates ARE announced to assistive tech via live regions (WCAG 4.1.3 AA); COMP-WCAG-AAA-11 ensures dynamic-content updates are USER-initiated in the first place (WCAG 3.2.5 AAA) — the two rules are complementary axes on the dynamic-content surface. **COMP-APG-04** (`compliance/aria-apg-full.md`, "Feed — `role='feed'` + `aria-busy` + per-article `aria-posinset` / `aria-setsize`") — A11Y-028 governs live-region announcements for dynamic content generally; COMP-APG-04 covers the *in-pattern* announcement mechanism (`aria-busy` toggle) for the feed-specific lazy-loading case where the APG Feed pattern's own state announcement supersedes generic live-region announcements. **COMP-APG-10** (`compliance/aria-apg-full.md`, "Meter — `role='meter'` + `aria-valuenow/min/max` for static measurement (NOT progress)") — for unbounded dynamic values (view counts, real-time scores) that don't fit the meter pattern's "meaningful maximum" requirement, prefer plain text in an `aria-live` region per A11Y-028 instead of mis-using meter role.

---

### A11Y-029: Use `disabled` on native controls; `aria-disabled` only when needed

**Severity**: MINOR
**WCAG**: 4.1.2 Level A
**Source**: https://www.w3.org/TR/wai-aria-1.2/#aria-disabled

**The rule**: Native form controls should use the `disabled` attribute (removes from tab order, blocks interaction). Use `aria-disabled="true"` only when the control must remain focusable (e.g., to explain *why* it's disabled) — and then block activation in JS.

**Code patterns to flag**:
- `<button disabled aria-disabled="true">` (redundant)
- `<div role="button" disabled>` (`disabled` is not valid on `<div>`)
- `aria-disabled="true"` on a control with no JS guard against click/Enter/Space
- "Disabled" styling via CSS class alone, with no `disabled` / `aria-disabled` attribute

**Correct pattern**:
```html
<button type="submit" disabled>Save</button>

<button type="submit" aria-disabled="true" onClick={guardedSave}>
  Save (fix errors first)
</button>
```

**Quick-fix hint**: Use `disabled` unless the element must stay focusable; if `aria-disabled`, block the action in the handler.

**See also**: **COMP-APG-02** (`compliance/aria-apg-full.md`, "Checkbox (tri-state / mixed) — `role='checkbox'` + `aria-checked='mixed'` cycle") — A11Y-029 governs disabled-state coding for individual controls; COMP-APG-02 references A11Y-029 when child checkboxes in a tri-state group are conditionally disabled (parent `aria-checked` derivation must handle disabled children per the group's documented semantics). **COMP-APG-11** (`compliance/aria-apg-full.md`, "Window Splitter — `role='separator'` + `aria-controls` + arrow-key resize + Enter to collapse/restore") — when a splitter's pane is in the collapsed state, the splitter remains focusable so Enter can restore; do NOT set `aria-disabled="true"` on the splitter, only update `aria-valuenow` to reflect the collapsed position.
