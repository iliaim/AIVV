# Interaction States — Dialogs & Modals

Part of [.aivv/standards/interaction-states/](README.md) (IS-019..023).

### IS-019: Modal must trap focus while open

**Severity**: MAJOR
**Rationale**: Focus that escapes a modal to the page beneath produces accessibility violations and UX confusion. WCAG SC 2.4.3 (Focus Order) is L1 legal/safety.
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ + WCAG 2.1 AA

**The rule**: while a modal is open, Tab/Shift-Tab cycle within modal contents only. The page behind is inert (`inert` attribute, `aria-hidden="true"` on background).

**Code patterns to flag**:
- Custom modal implementations with no focus-trap library or manual handler
- `<Dialog>` opened without setting `aria-modal="true"`
- Modals where Esc doesn't close (keyboard-trap escape route missing)

**Correct pattern**: `<dialog>` element OR `aria-modal="true"` + focus-trap (e.g., focus-trap-react, headless-ui).

**Quick-fix hint**: open the modal, Tab repeatedly. Does focus stay in the modal?

---

### IS-020: Modal must restore focus on close

**Severity**: MAJOR
**Rationale**: When a modal closes without restoring focus to the trigger, keyboard / screen-reader users lose their position in the page — disorienting and a WCAG violation.
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ + WCAG 2.1 AA

**The rule**: on modal close, focus returns to the element that triggered the open. If the trigger is gone, focus moves to a sensible default (parent container, page heading).

**Code patterns to flag**:
- Modal close handlers without `triggerRef.current?.focus()` (or framework equivalent)
- Modals using `headless-ui` / `radix` correctly but custom modals omitting return-focus
- Routes that destroy the trigger via navigation, leaving focus orphaned

**Correct pattern**: capture trigger ref on open; restore on close.

**Quick-fix hint**: open modal via Tab+Enter, Esc to close. Is focus back on the trigger?

---

### IS-021: Modal must close via Esc

**Severity**: MAJOR
**Rationale**: Esc-to-close is universal modal convention. Missing it forces keyboard users to navigate to the close button, often hidden by focus-trap mechanics.
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

**The rule**: every modal closes on Escape key. The handler is global to the modal, not just on the close button.

**Code patterns to flag**:
- Custom modals with no `keydown` listener for `Escape`
- Modals with Esc handler only on the close button (works only if button is focused)
- Confirmation dialogs without Esc-as-cancel

**Correct pattern**: `<dialog>` element (Esc native), or `useEffect` with global keydown listener registered on open.

**Quick-fix hint**: open modal. Press Esc. Does it close?

---

### IS-022: Modal close affordance must be keyboard-reachable

**Severity**: MAJOR
**Rationale**: A modal close button reachable only by mouse violates WCAG SC 2.1.1 (Keyboard).
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html

**The rule**: close button is a `<button>` (or has `role="button"` + key handlers); it's in the focus-trap cycle; it has accessible name (visible text or `aria-label`).

**Code patterns to flag**:
- `<div onClick={close}>X</div>` (not keyboard-reachable)
- Close button rendered with `tabindex="-1"`
- Close icon with no `aria-label` or visible text

**Correct pattern**: `<button onClick={close} aria-label="Close">×</button>`.

**Quick-fix hint**: Tab through modal. Is the close affordance one of the stops?

---

### IS-023: Confirmation dialog title must name the object and consequence

**Severity**: MINOR
**Rationale**: "Are you sure?" without object reference or consequence forces users to remember context — recognition-over-recall violation (HEU-NN6) and a top-five microcopy defect (NN/g).
**Source**: https://www.nngroup.com/articles/confirmation-dialog/

**The rule**: confirmation dialog headlines name the object ("Delete project Acme") and state the consequence ("This cannot be undone").

**Code patterns to flag**:
- `<Dialog title="Are you sure?">` with no object reference
- "Confirm action" headlines without naming the action
- "Delete?" without specifying which object

**Correct pattern**: `Delete project Acme — this cannot be undone.` See also MC-007 / MC-026.

**Quick-fix hint**: read the dialog headline aloud. Does it tell you what's about to happen?
