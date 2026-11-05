# UI/UX — Feedback & Confirmation

Part of [.aivv/standards/ui-ux/](README.md) (UX-012..014).

### UX-012: Destructive actions need confirmation or a reliable undo

**Severity**: CRITICAL
**Rationale**: One-click delete without confirmation or undo causes irreversible data loss; the user cannot recover.
**Source**: https://www.nngroup.com/articles/confirmation-dialog/

**The rule**: Destructive actions (delete, remove, archive-without-trash, send, publish, pay) either (a) open a confirmation dialog that restates the target and consequence, or (b) apply immediately with an Undo affordance visible for at least 5 seconds.

**Code patterns to flag**:
- `<button onClick={() => deleteItem(id)}>Delete</button>` with no confirm prompt and no undo
- `confirm("Are you sure?")` — browser default confirm lacks restatement / specificity
- Undo toast that auto-dismisses in <3s

**Correct pattern**:
```jsx
<ConfirmDialog
  title={`Delete "${project.name}"?`}
  description="This permanently removes all 23 tasks. This cannot be undone."
  confirmLabel="Delete project"
  onConfirm={() => deleteProject(project.id)} />
```

**Quick-fix hint**: Name the exact target ("Delete project 'Q3 launch'?") and describe the consequence.

---

### UX-013: Toast/snackbar notifications must have a minimum 5s dwell and be screen-reader-announceable

**Severity**: MAJOR
**Rationale**: Toasts that vanish in 2s leave slow readers / AT users behind; missing aria-live silently excludes screen readers.
**Source**: https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/

**The rule**: Auto-dismissing toasts live at least 5 seconds and the container uses `role="status"` with `aria-live="polite"` (or `role="alert"` for errors). **Error/destructive toasts must not auto-dismiss at all** — they persist until the user dismisses them (WCAG 2.2 SC 2.2.1; see also A11Y-035). Toasts containing interactive actions (Undo, Retry) must not auto-dismiss.

**Code patterns to flag**:
- `setTimeout(() => dismiss(), 2000)` on a toast
- Toast container with no `role` / `aria-live`
- Auto-dismissing toast containing an `<button>Undo</button>`
- Error toast (`variant="destructive"`) with a finite `duration` — must use `Infinity` or no auto-dismiss

**Correct pattern**:
```jsx
// Success toast — 5s auto-dismiss OK
<div role="status" aria-live="polite">Project saved</div>

// Error toast — must persist until dismissed
toast({ variant: "destructive", duration: Infinity, ... });
<div role="alert" aria-live="assertive">Save failed — try again.</div>
```

**Quick-fix hint**: 5s minimum for info toasts; `duration: Infinity` for error toasts; no auto-dismiss when actions are inside.

---

### UX-014: Modal dialogs must trap focus, close on Escape, and restore focus on close

**Severity**: MAJOR
**Rationale**: Keyboard users get stranded when focus leaks out of a modal; no Escape key means they can't exit.
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

**The rule**: Modals use `role="dialog" aria-modal="true"` with `aria-labelledby`, trap Tab/Shift+Tab focus inside the dialog, close on Escape, and return focus to the trigger element on close.

**Code patterns to flag**:
- `<div className="modal">` with no `role`, `aria-modal`, or focus management
- Close handler wired only to the X button (no Escape key handler)
- No stored reference to the triggering element to restore focus

**Correct pattern**: Use a vetted primitive (native `<dialog>`, Radix/Headless UI, etc.) that implements the APG pattern.

**Quick-fix hint**: Prefer `<dialog>` element or an audited headless-UI primitive over hand-rolled modals.

**See also**: **VVT-067** (`visual-verification-triggers/component-composition.md`) — runtime-verification trigger when code authors HTML `<dialog>` + `.showModal()` or imperative `.show()` API; this rule defines the UX-discipline policy (focus trap + Esc + focus restore), VVT-067 flags the runtime verification when the native primitive is adopted. **A11Y-049** (`accessibility/aria/apg-widgets.md`, "Dialog (Modal) — focus trap + initial focus + Esc + return focus") — the WCAG/APG compliance authority sibling to this UX-discipline rule.
