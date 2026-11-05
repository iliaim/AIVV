# Accessibility — Forms & inputs

Part of [.aivv/standards/accessibility/](README.md) (A11Y-009..014, A11Y-042..044, A11Y-061..064).

### A11Y-009: Every form control must have a programmatic label

**Severity**: CRITICAL
**WCAG**: 1.3.1 Level A, 3.3.2 Level A, 4.1.2 Level A
**Source**: https://webaim.org/techniques/forms/controls

**The rule**: Every `<input>` (except `type="hidden"`, `submit`, `button`, `reset`, `image`), `<select>`, and `<textarea>` must have an accessible name via `<label for>`, wrapping `<label>`, `aria-label`, or `aria-labelledby`.

**Code patterns to flag**:
- `<input>` with no adjacent `<label for="...">`, no wrapping `<label>`, no `aria-label`, no `aria-labelledby`
- `<label>` whose `for` does not match any `id` in the DOM
- Placeholder used as the sole label (`<input placeholder="Email">`)
- Icon-only form controls with no `aria-label`
- Multiple inputs sharing the same `id`

**Correct pattern**:
```jsx
<label htmlFor="email">Email</label>
<input id="email" name="email" type="email" autoComplete="email" />
```

**Quick-fix hint**: Add `<label for="<id>">` or `aria-label`; stop using placeholder as a label.

**See also**: **I18N-RTL-06** (`i18n/rtl-bidi.md`, "Form-control alignment respects `dir` attribute") — A11Y-009 ensures programmatic LABEL presence on every form control; I18N-RTL-06 ensures the form control itself ALIGNS correctly under RTL (native controls auto-handle; custom controls need explicit logical-property styling). The two rules compose: a labeled form control + correct direction-aware alignment together produce a usable RTL form.

---

### A11Y-010: Related controls must be grouped with `<fieldset>`/`<legend>`

**Severity**: MAJOR
**WCAG**: 1.3.1 Level A, 3.3.2 Level A
**Source**: https://www.w3.org/WAI/WCAG21/Techniques/html/H71

**The rule**: Radio-button groups, checkbox groups, and semantically related input clusters (e.g., address fields) must be wrapped in `<fieldset>` with a `<legend>`.

**Code patterns to flag**:
- Multiple `<input type="radio">` sharing a `name` but no `<fieldset>` wrapper
- `<fieldset>` with no `<legend>` or empty `<legend>`
- Checkbox groups (select-many) without a group label
- `<legend>` that is not the first child of `<fieldset>`

**Correct pattern**:
```html
<fieldset>
  <legend>Shipping speed</legend>
  <label><input type="radio" name="ship" value="std"> Standard</label>
  <label><input type="radio" name="ship" value="exp"> Express</label>
</fieldset>
```

**Quick-fix hint**: Wrap the group in `<fieldset>` with a descriptive `<legend>` as its first child.

---

### A11Y-011: Common inputs should declare `autocomplete`

**Severity**: MINOR
**WCAG**: 1.3.5 Level AA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/identify-input-purpose.html

**The rule**: Inputs collecting a user's identity/contact/payment data must carry an `autocomplete` token from the WCAG-defined list so UA autofill and cognitive-aid tools can identify the purpose.

**Code patterns to flag**:
- Email / name / phone / address / postal / payment inputs with no `autocomplete`
- `autocomplete="off"` on personal-data inputs without a documented security/privacy reason
- Invalid autocomplete token (e.g., `autocomplete="username-field"`)

**Correct pattern**:
```html
<input type="email"    autocomplete="email">
<input type="tel"      autocomplete="tel">
<input type="text"     autocomplete="given-name">
<input type="text"     autocomplete="postal-code">
```

**Quick-fix hint**: Add the appropriate `autocomplete` token from the WHATWG/WCAG list.

**See also**: **COMP-WCAG-AAA-07** (`compliance/wcag-aaa.md`, "Identify purpose of UI components, icons, and regions") — A11Y-011 enforces input-field purpose-identification via `autocomplete` tokens (WCAG 1.3.5 AA); COMP-WCAG-AAA-07 extends the programmatically-determinable-purpose requirement beyond input fields to UI components, icons, and page regions (WCAG 1.3.6 AAA).

---

### A11Y-012: Required fields must be programmatically indicated

**Severity**: MAJOR
**WCAG**: 3.3.2 Level A
**Source**: https://webaim.org/techniques/forms/controls

**The rule**: Required inputs must expose `required` (or `aria-required="true"`); a visible asterisk alone is not sufficient.

**Code patterns to flag**:
- Visual `*` in label text but no `required` attribute on the input
- `aria-required="true"` applied to a native `<input required>` (redundant — flag as MINOR)
- `required` on a non-form-control element

**Correct pattern**:
```html
<label for="pwd">Password <span aria-hidden="true">*</span></label>
<input id="pwd" type="password" required autocomplete="new-password">
```

**Quick-fix hint**: Add `required` to required inputs; keep the visual asterisk decorative with `aria-hidden="true"`.

---

### A11Y-013: Error messages must be associated with their inputs

**Severity**: MAJOR
**WCAG**: 3.3.1 Level A, 3.3.3 Level AA
**Source**: https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA18

**The rule**: Inline field errors and hints must be associated with the input via `aria-describedby`, and the input flagged with `aria-invalid="true"` when in an error state.

**Code patterns to flag**:
- Error `<div>` / `<p>` rendered near input with no `aria-describedby` linking it to the input
- Input in visible error state without `aria-invalid="true"`
- `aria-describedby` referencing an `id` that doesn't exist
- Error text inserted only via `::before`/`::after` CSS content (invisible to AT)

**Correct pattern**:
```jsx
<label htmlFor="email">Email</label>
<input id="email" type="email"
       aria-invalid={hasError}
       aria-describedby={hasError ? "email-err" : undefined} />
{hasError && <p id="email-err" role="alert">Enter a valid email address.</p>}
```

**Quick-fix hint**: Wire error text via `aria-describedby`; toggle `aria-invalid` on the input.

---

### A11Y-014: Do not use `autofocus` on page load

**Severity**: MINOR
**WCAG**: 2.4.3 Level A (best practice)
**Source**: https://www.a11yproject.com/checklist/

**The rule**: `autofocus` on initial load disorients screen-reader and magnifier users by bypassing page context.

**Code patterns to flag**:
- `autofocus` attribute on any top-level form on a page's initial render
- React `autoFocus` in components rendered at route entry

**Correct pattern**: Remove `autofocus`; rely on user action. Inside a modal dialog, setting focus via JS to the first focusable element is acceptable and expected.

**Quick-fix hint**: Delete the attribute; move focus programmatically only after an explicit user trigger (dialog open, step transition).

**See also**: **COMP-WCAG-AAA-11** (`compliance/wcag-aaa.md`, "Context changes only on user request") — A11Y-014 enforces the no-auto-focus best practice (focus-change on page load is a context-change variant); COMP-WCAG-AAA-11 is the broader AAA SC (WCAG 3.2.5) covering all automatic context-changes (focus, navigation, refresh, layout) not just initial focus.

---

### A11Y-042: Do not require redundant entry of previously-provided information

**Severity**: MINOR
**WCAG**: 3.3.7 Level A (WCAG 2.2 NEW)
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html

**The rule**: Information previously entered by or provided to the user in the same process must be auto-populated or available for the user to select — not re-prompted for fresh entry. Exceptions: when re-entry is essential (security-critical confirmation), when previous info is no longer valid, or when the user has explicitly cleared it.

**Code patterns to flag**:
- Multi-step checkout / signup forms that re-prompt for email, name, or address already collected in a prior step with no pre-fill
- "Shipping address" form with no "same as billing" toggle / pre-fill button when billing was already entered
- Password-reset flow asking for username on step 1 and step 3 with no carry-over
- React form components that reset internal state on step-back (`useState` without persistence across step navigation)
- "Confirm email" patterns that require manual re-entry instead of allowing paste/auto-fill from step 1

**Correct pattern**:
```jsx
<input
  name="shippingEmail"
  defaultValue={previouslyEnteredEmail}
  autoComplete="email"
/>
{/* OR offer a "same as billing" toggle */}
<label>
  <input type="checkbox" onChange={(e) => e.target.checked && copyBillingToShipping()} />
  Same as billing address
</label>
```

**Quick-fix hint**: For multi-step forms, persist step data and pre-fill subsequent fields; for repeated-info patterns, offer a "use previous" toggle.

**See also**: **COMP-WCAG-AAA-12** (`compliance/wcag-aaa.md`, "Error prevention for all submissions (reversible / checked / confirmed)") — A11Y-042 covers the WCAG 2.2 NEW SC 3.3.7 Level A redundant-entry case; COMP-WCAG-AAA-12 covers the broader AAA error-prevention axis (WCAG 3.3.6) where redundant-entry reduction supports the "Checked" branch (less re-entry surface means fewer error-correction round trips).

---

### A11Y-043: Authentication must not require cognitive function tests without alternative

**Severity**: MAJOR
**WCAG**: 3.3.8 Level AA (WCAG 2.2 NEW)
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html

**The rule**: An authentication step in a process must not require the user to solve, recall, or transcribe information (cognitive function test) unless an alternative authentication method is available OR the test has assistance such as auto-fill / paste / password manager support.

**Code patterns to flag**:
- Password input with `autocomplete="off"` or `autocomplete="new-password"` on a sign-in form (blocks password manager — removes assistance)
- OTP / 2FA code input that disables paste (`onPaste={(e) => e.preventDefault()}`)
- Custom CAPTCHA implementation with no audio alternative, no honeypot fallback, no "skip via verified identity provider" path
- Per-character split OTP inputs (6 separate `<input maxLength="1">`) that fight password managers and break paste
- Re-entry of remembered info ("type your mother's maiden name") as the sole auth path
- Authentication challenge requiring user to memorize and type a code from email/SMS without a click-link alternative

**Correct pattern**:
```jsx
/* sign-in form */
<input
  name="password"
  type="password"
  autoComplete="current-password"  /* "current-password" on sign-in; "new-password" only on signup */
/>

/* OTP / 2FA input on any form */
<input
  name="otp"
  inputMode="numeric"
  autoComplete="one-time-code"     /* allows OS-level OTP autofill */
  maxLength={6}
  onPaste={undefined}              /* DO NOT block paste */
/>
```

**Quick-fix hint**: Allow `autocomplete`, allow paste, support `one-time-code` autofill; if a CAPTCHA is in the flow, provide an audio variant or a verified-identity-provider alternative.

---

### A11Y-044: Authentication must not rely solely on object/media recognition

**Severity**: MINOR
**WCAG**: 3.3.9 Level AAA (WCAG 2.2 NEW)
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-enhanced.html

**The rule**: AAA-level extension of A11Y-043 — even with assistance, the cognitive function test must not require recognizing objects in images or identifying non-text content. SC 3.3.9 differs from SC 3.3.8 specifically by REMOVING the "Object Recognition" and "Personal Content" exceptions that 3.3.8 grants — at AAA conformance, an image CAPTCHA or "pick the photos containing X" gate is NOT permitted even if a non-cognitive alternative is also offered.

**Code patterns to flag**:
- reCAPTCHA v2 image-grid challenges ("select all photos with traffic lights") as the only auth gate
- Audio CAPTCHA with no text alternative for cognitively-impaired users
- Picture-password / pick-your-image authentication with no text-password alternative
- Custom "recognize this brand logo" / "click the cat photos" gates

**Correct pattern**: pair any media-recognition gate with a non-media alternative (verified email link, hardware security key, federated identity provider, text-based password manager flow).

**Quick-fix hint**: Most production apps target AA (A11Y-043) baseline; this AAA rule applies when the codebase declares WCAG 2.2 AAA conformance. At AAA, replace any media-recognition CAPTCHA with non-cognitive alternatives (verified email link, hardware security key, federated identity provider) — even pairing the CAPTCHA with a non-cognitive path does not satisfy 3.3.9.

---

### A11Y-061: Use HTML `autocomplete` attribute on personal-information fields

**Severity**: MAJOR
**WCAG**: 1.3.5 Identify Input Purpose Level AA, 3.3.2 Labels or Instructions Level A
**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete (HTML autocomplete spec, MDN canonical reference)
**COGA**: O6 (Help users avoid mistakes by not requiring memory) — https://www.w3.org/TR/coga-usable/

**The rule**: Personal-information form fields must carry the canonical HTML `autocomplete` attribute value matching the field's purpose. This enables password managers, autofill, and assistive-tech "fill in known info" behaviors — especially important for cognitive-disability users per COGA Objective 6.

**Code patterns to flag**:
- `<input type="email">` without `autocomplete="email"`
- Name fields without `autocomplete="given-name"` / `family-name"` / `name"` (per field semantics)
- Address fields without `autocomplete="street-address"` / `postal-code"` / `address-level1"` etc.
- Phone fields without `autocomplete="tel"`
- Credit-card fields without `autocomplete="cc-number"` / `cc-name"` / `cc-exp"` / `cc-csc"`
- Sign-in form without `autocomplete="username"` on the user input

**Correct pattern**:
```jsx
<input name="email" type="email" autoComplete="email" />
<input name="firstName" autoComplete="given-name" />
<input name="lastName" autoComplete="family-name" />
<input name="zip" autoComplete="postal-code" inputMode="numeric" />
<input name="cc-number" autoComplete="cc-number" inputMode="numeric" />
```

**Quick-fix hint**: Map each personal-info input to its canonical `autocomplete` token per MDN/HTML spec. Use `shipping`/`billing` **mode tokens** (and `section-*` for named subgroups) when a form has multiple address sections (e.g., `autocomplete="shipping street-address"` for a shipping address form; `section-checkout postal-code` to disambiguate same-mode sections).

**See also**: **VVT-059** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code adds or changes `autocomplete` token-list attributes; this rule defines the WCAG-1.3.5 + COGA-O6 personal-info-field policy + cc-* commerce token authority, VVT-059 flags when code changes warrant runtime check (browser autofill UI variation, password-manager interaction with `autocomplete="off"`, multi-address mode-prefix disambiguation, Firefox dynamic-state persistence). **COMP-WCAG-AAA-07** (`compliance/wcag-aaa.md`, "Identify purpose of UI components, icons, and regions") — A11Y-061 enforces input-field purpose-identification on personal-information fields (WCAG 1.3.5 AA); COMP-WCAG-AAA-07 extends purpose-identification to components, icons, and regions (WCAG 1.3.6 AAA). **COMP-LEGAL-01** (`compliance/legal-risk.md`, "GDPR Article 13 — disclose required information at point of data collection") — A11Y-061's `autocomplete` tokens for personal-info fields are themselves a GDPR data-subject signal (the field is collecting personal data); COMP-LEGAL-01 enforces Article 13 disclosure presence whenever the form collects personal data — these autocomplete-tokened fields are the canonical triggering signal.

---

### A11Y-062: Pair HTML `required` with `aria-required` redundantly for assistive-tech coverage

**Severity**: MINOR
**WCAG**: 3.3.2 Level A, 4.1.2 Level A
**Source**: https://www.w3.org/TR/wai-aria-1.2/#aria-required

**The rule**: When a form input is required, ensure required-state is communicated to AT. For native inputs (`<input required>`), modern AT consume the implicit accessibility-tree mapping correctly — `aria-required` is redundant per WAI-ARIA "use host-language semantics" authoring guidance. However, for **custom widgets** (`<div role="combobox">`, `<div role="textbox">`, etc.) WITHOUT native HTML required-state, explicit `aria-required="true"` is necessary. For maximum coverage across legacy JAWS versions + custom-widget patterns, the redundant pairing (`required` + `aria-required="true"`) is also a defensible defensive choice.

**Code patterns to flag**:
- Required field with only visual `*` indicator (no `required` + no `aria-required`)
- Native `<input required>` paired with no `aria-required` AND a known custom widget wrapping it
- Custom widget (`<div role="textbox">`, etc.) marked "required" via label only with no `aria-required="true"`

**Correct pattern**:
```jsx
<label htmlFor="email">
  Email <span aria-hidden="true">*</span>
</label>
<input
  id="email"
  type="email"
  required
  aria-required="true"
  autoComplete="email"
/>
```

**Quick-fix hint**: When in doubt, add both `required` + `aria-required="true"` — the redundancy is harmless and increases AT coverage. Pair with visible "* required" label-suffix or "(required)" text for sighted users.

---

### A11Y-063: Multi-step processes must indicate current step via `aria-current="step"`

**Severity**: MAJOR
**WCAG**: 1.3.1 Level A
**Source**: https://www.w3.org/TR/wai-aria-1.2/#aria-current
**COGA**: O1 (Help users understand what things are and how to use them)

**The rule**: Wizards, checkout flows, signup forms, and any multi-step UI must mark the active step with `aria-current="step"` on the step indicator. Sighted users see a visual highlight; AT users hear the step announced explicitly.

**Code patterns to flag**:
- Step indicator (`<ol class="steps">` / `<nav class="wizard-steps">`) without `aria-current="step"` on the active item
- Step numbers communicated only via CSS class (`.active`) with no ARIA equivalent
- Multi-step form lacking visible step labels in source (steps shown only via icons)

**Correct pattern**:
```html
<nav aria-label="Checkout progress">
  <ol>
    <li><a href="/checkout/cart">Cart</a></li>
    <li aria-current="step">Shipping</li>
    <li>Payment</li>
    <li>Review</li>
  </ol>
</nav>
```

**Quick-fix hint**: Add `aria-current="step"` to the active item; visible labels for each step in source (icons alone are not text-equivalent).

**See also**: **COMP-WCAG-AAA-09** (`compliance/wcag-aaa.md`, "Provide location information within a set of pages") — A11Y-063 enforces step-location-within-flow via `aria-current="step"` (WCAG 1.3.1 A); COMP-WCAG-AAA-09 covers the broader cross-page location-disclosure requirement (WCAG 2.4.8 AAA) where the wizard/multi-step pattern is one of the canonical location-indication forms.

---

### A11Y-064: Destructive actions require confirmation OR undo

**Severity**: MAJOR
**WCAG**: 3.3.4 Error Prevention (Legal, Financial, Data) Level AA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/error-prevention-legal-financial-data.html
**COGA**: O4 (Help users avoid mistakes / correct them)

**The rule**: Actions that delete user data, send messages, complete legal/financial transactions, or otherwise have hard-to-reverse consequences must provide AT LEAST ONE of: (a) confirmation dialog (A11Y-047 alertdialog pattern), (b) undo mechanism within a reasonable time window, OR (c) review-before-submit page.

**Code patterns to flag**:
- "Delete" / "Remove" / "Cancel subscription" / "Send" button with no confirmation dialog AND no undo path AND no review step
- Bulk-delete UI (select-all + delete) without alertdialog (A11Y-047) confirming the action
- Form submission to legal/financial endpoint with no review/edit step
- Single-click "Send to all contacts" / "Publish to all subscribers" patterns

**Correct pattern**:
```jsx
<button onClick={() => setShowConfirm(true)}>Delete account</button>

{showConfirm && (
  <dialog open role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
    <h2 id="confirm-title">Delete account?</h2>
    <p id="confirm-desc">This action cannot be undone. All your data will be permanently removed.</p>
    <button autofocus onClick={() => setShowConfirm(false)}>Cancel</button>
    <button onClick={handleDelete}>Delete forever</button>
  </dialog>
)}
```

**Quick-fix hint**: Wrap destructive actions in an alertdialog (A11Y-047) for hard-to-reverse ones; offer toast+undo for soft-deletes (e.g., trash with restore). Match the severity of the action to the friction of the confirmation.

**See also**: **COMP-WCAG-AAA-12** (`compliance/wcag-aaa.md`, "Error prevention for all submissions (reversible / checked / confirmed)") — A11Y-064 enforces the AA-baseline WCAG 3.3.4 case (destructive / legal / financial / data submissions only); COMP-WCAG-AAA-12 extends to ALL form submissions regardless of consequence (WCAG 3.3.6 AAA). A11Y-064's "confirmation OR undo OR review" mechanism choice maps onto COMP-WCAG-AAA-12's Confirmed / Reversible / Checked options.
