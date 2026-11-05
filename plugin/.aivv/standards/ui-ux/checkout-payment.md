# UI/UX — Checkout & payment

Part of [.aivv/standards/ui-ux/](README.md) (UX-030..036). Added dev.81 = T22 phase 1 — Baymard-checkout-research-anchored + web.dev-payment-form-anchored patterns for e-commerce checkout flows. Each rule cites a WebFetch-verified authoritative source per maintainer guidance "Per-rule WebFetch-verification discipline (dev.80+)".

Rules in this subfile are conversion-rate-and-UX-oriented (cart abandonment, friction). Where a payment-form pattern intersects with accessibility (e.g., autocomplete tokens on personal-info fields), the **A11Y-NNN** rule is the WCAG-compliance authority and rules here cross-reference it explicitly — do NOT duplicate the cc-* enumeration that A11Y-061 already owns. The dev.81 IV&V corrective (cross-reviewer-convergent finding) trimmed the initial 8-rule ship to 7 rules by deleting UX-036 (duplicated UX-004 on-blur-validation) and renumbering UX-037 → UX-036.

### UX-030: Offer guest checkout (do not force account creation)

**Severity**: MAJOR
**Rationale**: Baymard's e-commerce checkout-usability research (2024) finds that **84% of top US sites still force or strongly nudge account creation during checkout** — a top-3 driver of cart abandonment. Account creation, when desired, should happen after the order is placed (one or two password fields on the confirmation page, since user info is already entered).
**Source**: https://baymard.com/blog/checkout-flow-average-form-fields (WebFetch-verified 2026-05-11: "84% fail to delay account creation"; "delaying account creation until after checkout is more effective")

**The rule**: Checkout flows must surface a "Guest checkout" / "Check out as guest" affordance with equal or greater visual weight than the "Create account" / "Sign in" affordances. Account creation, if offered, must not block order completion.

**Code patterns to flag**:
- Checkout page that lands on a login form with no "Continue as guest" button
- Account-creation fields (password, password-confirm) embedded inside the checkout form as required inputs
- "Sign in to continue" gate at checkout step 1 with no guest-checkout alternative
- Guest-checkout link styled visually subordinate ("Or check out as guest..." in small grey text below a prominent signup CTA)

**Correct pattern**:
```jsx
<div className="checkout-entry">
  <button onClick={beginGuestCheckout}>Check out as guest</button>
  <p>Already have an account? <a href="/login">Sign in</a></p>
</div>
{/* Account creation offered AFTER order placed: */}
<aside className="post-order-account-offer">
  <p>Save your details for next time? Set a password — we'll keep everything else you entered.</p>
</aside>
```

**Quick-fix hint**: If checkout requires login, add a "Continue as guest" button with equal weight; defer account creation to the order-confirmation page.

---

### UX-031: Use a single name field, not split first-name + last-name

**Severity**: MINOR
**Rationale**: Baymard's 2024 benchmark found **89% of top US e-commerce sites still use multiple name fields** despite splitting names being a top-7 friction source: non-Western naming conventions break (single-name cultures, patronymic, mononym, multi-part surnames), users hesitate where to put a middle initial, and the second field adds zero conversion value. A single `name` field also enables one-line `autocomplete="name"` autofill on mobile.
**Source**: https://baymard.com/blog/checkout-flow-average-form-fields (WebFetch-verified 2026-05-11: "89% of sites still use multiple name fields (rather than one)")

**The rule**: Prefer a single name input (`<input autocomplete="name">`) over split first-name + last-name inputs in checkout / signup / shipping forms. Reserve split fields ONLY when downstream business logic genuinely requires the surname-vs-given-name distinction (e.g., legal-document generation, formal correspondence) AND that requirement is documented.

**Code patterns to flag**:
- Checkout form with `<input autocomplete="given-name"> <input autocomplete="family-name">` for normal shipping/billing
- Signup form requiring "First name" + "Last name" with no documented business reason
- "Name on card" split into two fields (the card itself prints a single line)

**Correct pattern**:
```jsx
<label htmlFor="name">Full name</label>
<input id="name" name="name" autoComplete="name" required />
```

**Quick-fix hint**: Replace `given-name` + `family-name` field pair with one `autocomplete="name"` field unless legal/business requirements justify the split.

**See also**: A11Y-061 (`accessibility/forms.md`) — WCAG 1.3.5 personal-info-field token authority. **VVT-059** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code adds or changes `autocomplete` token-list attributes; this rule defines the single-`autocomplete="name"` checkout-conversion policy, VVT-059 flags when code changes warrant runtime check (browser autofill UI variation, password-manager respect of `autocomplete="off"`, Firefox dynamic-state persistence).

---

### UX-032: Collapse "Address Line 2" by default

**Severity**: MINOR
**Rationale**: Baymard's 2024 benchmark found **75% of top US sites still display Address Line 2 by default** despite the field being relevant to a minority of addresses (apartment, suite, unit number). The visual weight of two address-line inputs incorrectly suggests Line 2 is required — many users add their first address line to Line 1 and the second half to Line 2, breaking parsing downstream.
**Source**: https://baymard.com/blog/checkout-flow-average-form-fields (WebFetch-verified 2026-05-11: "75% don't hide Address Line 2")

**The rule**: "Address Line 2" should be hidden behind a disclosure ("+ Add apartment / suite / unit") rather than rendered as a sibling field next to "Address Line 1". When expanded, the input gets the appropriate `autocomplete="address-line2"` token.

**Code patterns to flag**:
- Checkout form rendering `<input autocomplete="address-line1">` + `<input autocomplete="address-line2">` side-by-side or as adjacent inputs by default
- "Address Line 2" labeled as required or styled identically to Address Line 1
- No disclosure / expand affordance for apartment-or-suite entry

**Correct pattern**:
```jsx
<label htmlFor="addr1">Address</label>
<input id="addr1" autoComplete="address-line1" required />
<button type="button" onClick={() => setShowLine2(true)}>+ Add apartment, suite, or unit</button>
{showLine2 && (
  <>
    <label htmlFor="addr2">Apartment / suite / unit</label>
    <input id="addr2" autoComplete="address-line2" />
  </>
)}
```

**Quick-fix hint**: Wrap `<input autocomplete="address-line2">` in a collapse-by-default disclosure with an "+ Add apartment" expand button.

---

### UX-033: Collapse coupon / promo code field by default

**Severity**: MINOR
**Rationale**: Baymard's 2024 benchmark found **35% of top US sites display the coupon-code field by default** — a high-impact friction source. A prominent coupon field signals "you should have a code; pause and search for one." Users who don't have a code experience guilt or anxiety; users who have one don't need the field surfaced upfront.
**Source**: https://baymard.com/blog/checkout-flow-average-form-fields (WebFetch-verified 2026-05-11: "35% display coupon code fields by default")

**The rule**: Coupon / promo / gift-card code fields should be hidden behind a disclosure ("Have a coupon code?") rather than rendered as a primary field in the checkout form. When expanded, the input accepts the code.

**Code patterns to flag**:
- Checkout summary panel with `<input name="coupon">` rendered at full width by default
- Promo-code field above the "Place order" button without an "Apply" affordance
- Multiple discount fields (coupon + gift-card + loyalty-points) all displayed by default

**Correct pattern**:
```jsx
<button type="button" onClick={() => setShowCoupon(true)}>Have a coupon code?</button>
{showCoupon && (
  <div className="coupon-row">
    <label htmlFor="coupon">Coupon code</label>
    <input id="coupon" name="coupon" />
    <button type="button" onClick={applyCoupon}>Apply</button>
  </div>
)}
```

**Quick-fix hint**: Hide coupon-code inputs behind a "Have a coupon code?" disclosure button; expand on click.

---

### UX-034: Disambiguate shipping vs billing addresses via `autocomplete` mode prefix; never `autocomplete="off"` on payment

**Severity**: MAJOR
**Rationale**: For the cc-* token enumeration (cc-name, cc-number, cc-exp, cc-csc) on credit-card inputs, **A11Y-061** is the authority — it covers WCAG 1.3.5 personal-info autocomplete AND the commerce cc-* tokens AND the shipping/billing mode-prefix pattern. UX-034's distinct contribution: (a) the **explicit anti-pattern callout** that `autocomplete="off"` on payment fields blocks browser autofill (a conversion-rate-relevant framing not in A11Y-061's compliance-oriented framing), and (b) the **multi-address disambiguation rule** that becomes load-bearing when a checkout form has BOTH shipping and billing in the same DOM (browsers autofill both with the same stored value if mode-prefixes are absent — a checkout-specific friction A11Y-061 doesn't surface).
**Source**: https://web.dev/learn/forms/autofill (WebFetch-verified 2026-05-11: "To tell the browser which is the postal code for the billing address, you can use `autocomplete=\"billing postal-code\"`. For the shipping address, use `shipping` as the first value."); see A11Y-061 in `accessibility/forms.md` for the WCAG / cc-* enumeration authority.

**The rule**: When a checkout form has separate shipping and billing address blocks in the same DOM, every address input in each block MUST carry the `shipping` or `billing` mode prefix (`autocomplete="shipping street-address"` / `autocomplete="billing street-address"`). Payment inputs MUST NOT carry `autocomplete="off"` — that disables browser autofill, the single largest checkout-conversion lever. (For the cc-* token list itself, follow A11Y-061.)

**Code patterns to flag**:
- Payment input with `autocomplete="off"` (e.g., `<input name="cardnum" autocomplete="off">`)
- Checkout form with BOTH shipping AND billing address fields in the same DOM where any address input is missing the `shipping` / `billing` mode prefix
- Shipping-address postal-code with `autocomplete="postal-code"` (unprefixed) on a page that also has a billing-address postal-code with `autocomplete="postal-code"` (collision — browser autofills both identically)

(For "credit-card input missing `autocomplete="cc-name"|cc-number|cc-exp|cc-csc"`, see A11Y-061 — that rule owns the cc-* enumeration.)

**Correct pattern**:
```jsx
{/* Shipping block */}
<input autoComplete="shipping street-address" />
<input autoComplete="shipping postal-code" />

{/* Billing block (when distinct from shipping) */}
<input autoComplete="billing street-address" />
<input autoComplete="billing postal-code" />

{/* Payment block — see A11Y-061 for cc-* token enumeration; just don't disable autofill: */}
<input name="cardnum" autoComplete="cc-number" inputMode="numeric" pattern="[0-9 ]+" />
{/* NOT: <input name="cardnum" autoComplete="off" /> */}
```

**Quick-fix hint**: For the cc-* tokens, defer-to A11Y-061. For UX-034 specifically: add `shipping` / `billing` mode prefixes when both addresses appear in the same DOM; remove any `autocomplete="off"` from payment inputs.

**See also**: A11Y-061 (in `accessibility/forms.md`) — WCAG 1.3.5 / commerce autocomplete-token authority; UX-035 (`inputmode="numeric"`) — applied alongside UX-034 on numeric payment inputs. **VVT-059** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code adds or changes `autocomplete` token-list attributes; this rule defines the multi-address mode-prefix + payment-autocomplete-off-anti-pattern policy, VVT-059 flags when code changes warrant runtime check (mode-prefix collision verification, password-manager respect of `autocomplete="off"`).

---

### UX-035: Use `inputmode="numeric"` on numeric-only payment inputs

**Severity**: MINOR
**Rationale**: Per web.dev/learn/forms/payment, `inputmode="numeric"` shows the optimized numeric on-screen keyboard on mobile devices for card-number and security-code fields. This is distinct from `type="number"` (which adds spinner controls and rejects spaces — incorrect for card numbers that users often paste with spaces). `inputmode` only affects the on-screen keyboard; the input remains a `type="text"` for spaces / paste tolerance.
**Source**: https://web.dev/learn/forms/payment (WebFetch-verified 2026-05-11: "Use inputmode=\"numeric\" for the card number and security code fields to show an optimized on-screen keyboard for entering numbers"; "use pattern=\"[0-9 ]+\" to allow spaces" for card-number)

**The rule**: Card-number, security-code (CVV), expiry, postal-code, and other numeric-only checkout inputs should carry `inputmode="numeric"` for mobile keyboard optimization. Use `type="text"` (not `type="number"`) so users can paste card numbers with spaces from password managers or card-storage apps.

**Code patterns to flag**:
- `<input type="number">` for card number (rejects pasted "4242 4242 4242 4242" format with spaces)
- Card-number / CVV / postal-code inputs without `inputmode="numeric"`
- Card-number input with `pattern="[0-9]+"` (no space) — blocks valid paste from card-on-file apps that store with separator spaces

**Correct pattern**:
```jsx
<input id="cardnum" type="text"
       autoComplete="cc-number"
       inputMode="numeric"
       pattern="[0-9 ]+"
       required />
```

**Quick-fix hint**: Replace `type="number"` with `type="text" inputmode="numeric"` on card-number/CVV/postal-code inputs; allow spaces in `pattern`.

**See also**: UX-034 (shipping/billing mode prefix + `autocomplete="off"` anti-pattern); A11Y-061 (cc-* token enumeration authority per WCAG 1.3.5); **VVT-055** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger for `inputmode` changes broadly; this rule defines the payment-specific policy, VVT-055 flags when code changes warrant runtime verification (real-device virtual-keyboard layout test, paste-path validation gap, type-vs-inputmode separation).

---

### UX-036: Preserve entered form data on validation failure

**Severity**: MAJOR
**Rationale**: Per NN/g error-message guidelines, when validation fails the form must display the user's original entries so they can edit rather than re-enter. Clearing the form on error (especially after a long checkout flow) is a top abandonment cause — users do not retry. This is also a WCAG 3.3.4 (Error Prevention: Legal, Financial, Data) consideration for legal/financial transactions. **A11Y-042 (Redundant Entry, WCAG 3.3.7 Level A) is the compliance authority for cross-step data-preservation**; UX-036 is the cross-error-render extension — the two are complementary, not duplicative (A11Y-042 fires on multi-step navigation; UX-036 fires on submission-error re-render).
**Source**: https://www.nngroup.com/articles/error-message-guidelines/ (WebFetch-verified 2026-05-11: "Let users correct errors by editing their original action instead of starting over"; "Display the original text entered into fields so users can modify rather than re-enter information")

**The rule**: Form submission failures (server-side validation errors, payment-processor declines, address-verification fails) must re-render the form with all user-entered values preserved. Sensitive fields (CVV, password) may be re-cleared for security, but every other field's value persists.

**Code patterns to flag**:
- Server-error response rendered as a redirect to a fresh form (loses entered data)
- Form-state stored only in component state without persistence across validation-error renders
- Error-render path that calls `form.reset()` or sets all fields to empty
- React form using uncontrolled inputs that re-mount on error (losing the DOM-stored values)

**Correct pattern**:
```jsx
const [values, setValues] = useState(initialValues);
const [errors, setErrors] = useState({});

async function handleSubmit(e) {
  e.preventDefault();
  try {
    await submitForm(values);
  } catch (err) {
    // Preserve entered values; only update errors.
    setErrors(err.fieldErrors);
    // Do NOT setValues(initialValues) or reset the form.
  }
}
```

**Quick-fix hint**: On validation-error / server-error response, preserve `values` state; only update `errors`. Never call `form.reset()` on error.

**See also**: A11Y-042 (in `accessibility/forms.md`) — Redundant Entry, WCAG 3.3.7 Level A authority for cross-step data-preservation; UX-004 (in `ui-ux/forms.md`) — Validate on blur, show errors inline next to the field (the on-blur validation timing UX-036 implicitly assumes); UX-005 — Validation summary at form level for screen readers.

---

## Maintenance

When adding checkout / payment rules:
- Cite a WebFetch-verifiable authoritative source (Baymard checkout-usability research, web.dev/learn/forms, NN/g articles, MDN attribute references). Per maintainer guidance "Per-rule WebFetch-verification discipline (dev.80+)", WebFetch every cited URL before ship and record the verified quote inline as `(WebFetch-verified <date>: "<quote>")`.
- Distinguish from peer A11Y-* (WCAG-compliance authority) and MC-* (UX-writing patterns). Where the same pattern intersects accessibility AND conversion-rate, the A11Y-NNN rule is the compliance authority and the UX-NNN rule names the commerce-specific extension.
- Runtime-deferred concerns (rendered button-tap-target, perceived load time of the checkout summary, actual conversion-rate measurement) stay in the parent README's runtime-deferred list — UX rules here are code-reviewable patterns only.
