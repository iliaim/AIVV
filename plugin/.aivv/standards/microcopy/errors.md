# Microcopy — Error Messages

Part of [.aivv/standards/microcopy/](README.md) (MC-016..021).

### MC-016: Error messages tell the user what's wrong AND what to do

**Severity**: MAJOR
**Rationale**: NN/g's error-message guidelines specify the message must offer constructive advice or suggested remedies — naming the problem without offering recovery forces the user to guess. Recovery framing is one of NN/g's stated error-message principles, alongside plain-language description and respectful tone.
**Source**: https://www.nngroup.com/articles/error-message-guidelines/

**The rule**: Every error message has two parts: (a) what the system detected as wrong, (b) what the user can do to fix it. If the error is system-side and the user can do nothing, the message says so plainly and offers a retry / contact path.

**Code patterns to flag**:
- "Invalid input" (too vague — what's invalid? What should the user do?)
- "Error 400" / "ValidationError" (machine output reaching the UI)
- One-clause errors that name the problem but stop there ("Email is required.")

**Correct pattern**: "Email is required — enter the email you'd like to use for sign-in." / "We couldn't reach the server. Check your internet connection and try again."

**Quick-fix hint**: Read the error aloud. Can the user act on it? If not, add the action.

---

### MC-017: Don't expose stack traces, error codes, or exception class names to users

**Severity**: MAJOR
**Rationale**: Stack traces leak internal architecture, alarm non-technical users, and obscure the actual problem. Error codes alone ("Error E_PERMISSION_DENIED") are meaningless without a lookup. Both correlate with measurable trust loss in usability studies.
**Source**: https://www.nngroup.com/articles/error-message-guidelines/

**The rule**: User-facing error messages are written in plain language. Error codes can be present *in addition to* the plain-language message (helpful when users contact support), but never instead of.

**Code patterns to flag**:
- `catch(e) { showError(e.message) }` where `e.message` is "TypeError: cannot read property 'foo' of undefined"
- Error UIs that render the full exception object's `toString()`
- Plain error code with no human-readable explanation

**Correct pattern**: `catch(e) { logger.error(e); showError("We couldn't save your changes. Try again or contact support if this keeps happening.") }`

**Quick-fix hint**: If the error string contains the word "Error:", a colon, or backticks, it's probably a developer message that escaped to users.

---

### MC-018: Validation error placement: next to the field, not in a top banner only

**Severity**: MAJOR
**Rationale**: Top-of-form summaries make users hunt for the offending field. WCAG 2.1 SC 3.3.1 (Error Identification) and SC 3.3.3 (Error Suggestion) both recommend per-field placement with `aria-describedby` association.
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/error-identification.html

**The rule**: Field-level errors render adjacent to the offending field (typically below) AND are programmatically associated via `aria-describedby` and `aria-invalid="true"`. A top-of-form summary is acceptable as an addition for screen-reader announcement but never as the only error surface.

**Code patterns to flag**:
- `<div class="error-summary">…</div>` at the top with no per-field error elements
- Field errors rendered without `aria-describedby` linking to them
- Errors rendered only via toast / notification (transient — user loses the message after dismissing)

**Correct pattern**:
```jsx
<input id="email" aria-invalid={!!error} aria-describedby="email-error" />
{error && <p id="email-error" role="alert">{error}</p>}
```

**Quick-fix hint**: If the error message vanishes, dismisses, or only appears at the top, the user can't fix the field without scrolling/searching.

---

### MC-019: Color is not the only carrier of error state

**Severity**: MAJOR
**Rationale**: Cross-references A11Y-032 (lives in `accessibility/color-motion.md` per dev.61 retrofit). Red borders alone fail WCAG 1.4.1 (Use of Color). Users with color-vision differences or in high-glare environments lose the signal entirely.
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html

**The rule**: Error states combine color (red) + icon + text. Removing any one of the three should still leave the error visible.

**Code patterns to flag**:
- `<input className={hasError && "border-red-500"} />` with no associated text or icon
- Form validation that styles the input but adds no `<p>` / icon describing the error

**Correct pattern**: Red border + warning icon + `<p role="alert">` text.

**Quick-fix hint**: Disable color in your CSS. Is the error still visible? If no, the color is doing too much work.

---

### MC-020: Distinguish "couldn't" (system) from "can't" (rule)

**Severity**: MINOR
**Rationale**: Error UX research distinguishes transient system failures (network, server) from policy enforcement (validation, permission). Users react differently — retry for the former, change input for the latter. Mixing them confuses recovery.
**Source**: https://www.atlassian.design/content/voice-and-tone

**The rule**: Use "We couldn't…" / "Something went wrong…" for transient system failures (suggests retry). Use "You can't…" / "X is not allowed…" for policy enforcement (suggests change-input). Pair the framing with the appropriate recovery affordance.

**Code patterns to flag**:
- "You can't save" used for a network error (the user CAN save; the system just failed this time)
- "Couldn't validate email" used for a format error (the system DID validate; the email is just wrong)

**Correct pattern**: "We couldn't reach the server — try again." / "Email format isn't recognized — check for typos."

**Quick-fix hint**: Will retrying the same input fix it? "Couldn't…" If the user must change input, "Can't…" / "Not valid because…"

---

### MC-021: Don't show errors before the user has had a chance to act

**Severity**: MINOR
**Rationale**: Forms that show "required" errors on first render — before the user has typed anything — are anxiety-inducing and pre-emptively scolding. Validation should fire on blur or submit, not on mount.
**Source**: https://www.nngroup.com/articles/errors-forms-design-guidelines/

**The rule**: Field-level validation activates after the user has interacted with the field (typically on blur, optionally on first non-empty input). Form-level validation activates on submit. Neither activates on mount.

**Code patterns to flag**:
- `useState(initialValidate(values))` that pre-marks empty required fields as in-error
- Components that render errors based on initial state without checking "has the user touched this field?"

**Correct pattern**: Track a `touched: Record<field, boolean>` map; only show errors for fields where `touched[field] === true`.

**Quick-fix hint**: If errors show before the user has typed a single character, they're firing too early.
