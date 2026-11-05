# UI/UX — UX-lens microcopy (subset; see peer `microcopy.md` for the MC-* catalog)

Part of [.aivv/standards/ui-ux/](README.md) (UX-020..021).

**Note:** these are the UX-lens microcopy rules. The full microcopy rule catalog (38 `MC-*` rules covering buttons, labels, errors, empty states, confirmations, loading, notifications, capitalization) lives in a peer file at [`.aivv/standards/microcopy.md`](../microcopy.md). UX-020 and UX-021 are the UX-lens-specific subset that ships alongside the broader microcopy standards.

### UX-020: Button labels describe the resulting action, not "OK" / "Submit" / "Yes"

**Severity**: MINOR
**Rationale**: Generic labels force users to re-read the dialog; specific verbs reduce misclicks on confirmation dialogs.
**Source**: https://www.nngroup.com/articles/ui-copy/

**The rule**: Action buttons name the outcome ("Delete project", "Save changes", "Send invite") rather than generic assent ("OK", "Yes", "Submit").

**Code patterns to flag**:
- `<button>OK</button>` / `<button>Yes</button>` / `<button>Submit</button>` in dialogs
- Confirmation dialog with `Cancel` / `Confirm` buttons (use the verb of the action)

**Correct pattern**:
```jsx
<button>Delete project</button>
<button>Keep project</button>
```

**Quick-fix hint**: Replace "OK" with the verb phrase from the question.

---

### UX-021: Error microcopy uses plain language, not codes or "hostile" wording

**Severity**: MINOR
**Rationale**: "ERR_422" or "You did it wrong" alienates users; plain, polite, constructive copy preserves trust.
**Source**: https://www.nngroup.com/articles/hostile-error-messages/
**See also**: [`forms.md` UX-005](forms.md) (form-validation error specifics), [`progressive-enhancement.md` UX-028](progressive-enhancement.md) (forward-looking framing — flag list for "Could not"/"Failed to"/"please"/"contact support").

**The rule**: User-facing errors are in plain English, don't blame the user, and suggest next steps.

**Code patterns to flag**:
- Rendering backend error codes directly: `{error.code}`
- "Invalid input" / "You forgot to..." / "Wrong!"
- All-caps error text

**Correct pattern**: "Enter a valid email address, e.g. name@example.com."

**Quick-fix hint**: Audit rendered error strings; rewrite anything starting with "ERROR", "Invalid", or "You".
