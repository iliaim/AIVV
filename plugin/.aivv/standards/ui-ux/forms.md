# UI/UX — Form UX

Part of [.aivv/standards/ui-ux/](README.md) (UX-001..007).

### UX-001: Every input must have a programmatically-associated `<label>`

**Severity**: MAJOR
**Rationale**: Label-less inputs break screen readers, defeat click-to-focus (bad for motor-impaired users), and fail auto-translation — users don't know what to type.
**Source**: https://www.smashingmagazine.com/2018/06/placeholder-attribute/

**The rule**: Every form control carries either a wrapping `<label>` or an explicit `for=`/`id=` pair. `aria-label` is an exception only when a visible label is intentionally omitted (e.g., search icon button).

**Code patterns to flag**:
- `<input type="text" placeholder="Email">` with no sibling/wrapping `<label>`
- `<label>Email</label><input ...>` with no `for`/`id` binding
- Floating-label libraries where the label element is decorative only

**Correct pattern**:
```jsx
<label htmlFor="email">Email</label>
<input id="email" type="email" name="email" autoComplete="email" />
```

**Quick-fix hint**: Add `<label htmlFor={id}>` outside the input, not as placeholder text.

---

### UX-002: Do not use placeholder text as the only label

**Severity**: MAJOR
**Rationale**: Placeholders vanish on focus, are low-contrast by default, aren't translated, and are frequently mistaken for pre-filled values — users skip required fields.
**Source**: https://www.nngroup.com/articles/form-design-placeholders/

**The rule**: `placeholder` is for example/format hints only. It is never a substitute for a visible `<label>`.

**Code patterns to flag**:
- `<input placeholder="Email">` with no visible label element
- `<input placeholder="Name *">` using placeholder to convey required state
- CSS that hides the `<label>` with `display: none` while retaining the placeholder

**Correct pattern**:
```jsx
<label htmlFor="phone">Phone number</label>
<input id="phone" type="tel" placeholder="e.g. 555-0123" autoComplete="tel" />
```

**Quick-fix hint**: Use `placeholder` for format examples only; keep the label outside the input.

---

### UX-003: Submit buttons must disable during in-flight submission

**Severity**: CRITICAL
**Rationale**: Without a disabled state during submit, users double-click slow forms and create duplicate orders, payments, or records.
**Source**: https://www.bennadel.com/blog/4419-the-user-experience-ux-of-disabled-form-buttons.htm

**The rule**: Any async-submitting form must disable its submit control (or otherwise guard against re-entry) until the request resolves.

**Code patterns to flag**:
- `<button type="submit" onClick={submit}>` with no `disabled` coupled to a pending/loading state
- `onSubmit={async (e) => { await api.post(...) }}` on a form with no `isSubmitting` tracked
- A spinner appearing next to the button but the button itself is still clickable

**Correct pattern**:
```jsx
<button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
  {isSubmitting ? "Saving…" : "Save changes"}
</button>
```

**Quick-fix hint**: Bind `disabled` to the same state that drives the loading UI.

---

### UX-004: Validate on blur, show errors inline next to the field

**Severity**: MAJOR
**Rationale**: Validating on every keystroke feels like scolding; validating only on submit forces the user to re-hunt for broken fields. On-blur with inline placement minimizes interaction cost.
**Source**: https://www.nngroup.com/articles/errors-forms-design-guidelines/

**The rule**: Field-level validation fires on blur (or with a short debounce for format-specific fields), and errors render adjacent to the offending field, not only in a top-of-page banner.

**Code patterns to flag**:
- `onChange` handlers that set field-level errors on every keystroke
- Error rendering only in a top summary with no per-field anchor / `aria-describedby`
- Validation fires only in `onSubmit` with no on-blur hook

**Correct pattern**:
```jsx
<label htmlFor="email">Email</label>
<input id="email" aria-describedby="email-error" aria-invalid={!!error}
  onBlur={validate} />
{error && <p id="email-error" role="alert">{error}</p>}
```

**Quick-fix hint**: Wire `onBlur` validation + an `id`-anchored error element referenced by `aria-describedby`.

---

### UX-005: Error messages must be specific, plain-language, and actionable

**Severity**: MAJOR
**Rationale**: "Invalid input" or "ERROR 500" leaves the user unable to recover; users contact support or abandon the flow.
**Source**: https://design-system.service.gov.uk/components/error-message/
**See also**: [`ux-microcopy.md` UX-021](ux-microcopy.md) (plain-language error microcopy), [`progressive-enhancement.md` UX-028](progressive-enhancement.md) (forward-looking framing — the stricter flag list for "Could not"/"Failed to"/"please"/"contact support").

**The rule**: Error copy must describe what went wrong and how to fix it, using the same words as the field label. Use **forward-looking framing** — lead with context, end with action. Avoid backward-looking openers ("Could not...", "Failed to...", "Unable to..."). Drop "please" from retry prompts (filler that delays the useful instruction — GOV.UK Content Design). Drop "contact support" from transient-error messages (dead-end — users rarely follow through; use retry buttons or "Copy details" for request IDs instead).

**Code patterns to flag**:
- String literals like `"Invalid"`, `"Error"`, `"Wrong format"`, `"Please try again"`, `"Something went wrong"`
- Backward-looking framing: `"Could not ..."`, `"Failed to ..."`, `"Unable to ..."`
- Vague validation messages: `"Check your input"`, `"Invalid field"`, `"Correct the errors"` — must reference the specific field and constraint
- Raw error objects rendered: `{error.message}` showing `"E_VALIDATION_422"`
- Status-code messages leaked to UI: `"Error: 500 Internal Server Error"`
- Dead-end CTAs in toasts: `"contact support"`, `"reach out to support"` (acceptable only in inline blocking errors, not toasts)

**Correct pattern**:
```jsx
// Validation — specific, forward-looking
<p role="alert">Enter an email address in the format name@example.com</p>

// Transient error — forward-looking with action
toast({ title: "Save failed", description: "Your resume didn't save — try again." });

// NOT: "Could not save your resume. Please try again, or contact support."
```

**Quick-fix hint**: Map backend error codes to human strings at the UI boundary. Use "{Context} didn't {verb} — {action}" structure. Include the expected format for validation errors. Drop "please" and "contact support" from retry messages.

---

### UX-006: Use the `autocomplete` attribute on standard fields

**Severity**: MAJOR
**Rationale**: Missing `autocomplete` defeats browser/password-manager autofill — users abandon on mobile where typing is painful.
**Source**: https://web.dev/learn/forms/autofill

**The rule**: Standard fields (email, tel, name, address, username, password, one-time codes) carry the correct `autocomplete` token.

**Code patterns to flag**:
- `<input type="email" name="email">` with no `autocomplete="email"`
- `<input type="password">` with no `autocomplete="current-password"` or `"new-password"`
- `autocomplete="off"` on account / payment / contact fields without a documented reason

**Correct pattern**:
```jsx
<input type="email" name="email" autoComplete="email" />
<input type="password" name="password" autoComplete="current-password" />
```

**Quick-fix hint**: Consult MDN's autocomplete token list; default to specific tokens over `off`.

**See also**: A11Y-061 (`accessibility/forms.md`) — WCAG 1.3.5 personal-info-field token authority (this rule defers to A11Y-061 for the canonical token enumeration). **VVT-059** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code adds or changes `autocomplete` token-list attributes; UX-006 defines the conversion-rate policy ("standard fields carry the correct token"), VVT-059 flags when code changes warrant runtime check (browser autofill UI variation, password-manager respect of `autocomplete="off"`, Firefox dynamic-state persistence).

---

### UX-007: Mark optional fields, or all-required-by-default

**Severity**: MINOR
**Rationale**: Mixed conventions (some required, some optional, no marker) force users to guess — which causes submit-time errors they could have avoided.
**Source**: https://design-system.service.gov.uk/patterns/question-pages/

**The rule**: Pick a convention per form: either every field is required and optional ones are marked `(optional)` in the label, or required ones are explicitly marked. Don't mix.

**Code patterns to flag**:
- A form where some labels carry `*` and others don't, with no "required" legend
- `required` attribute present on some inputs, absent on others, with no visual marker

**Correct pattern**:
```jsx
<label htmlFor="phone">Phone number (optional)</label>
<input id="phone" type="tel" autoComplete="tel" />
```

**Quick-fix hint**: Add `(optional)` to the label text for non-required fields, drop the `*` convention.
