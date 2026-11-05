# Dark Patterns — Subscription manipulation (DP-SUB-01..10)

Part of [.aivv/standards/dark-patterns/](README.md).

### DP-SUB-01: Hard-to-find cancel

**Severity**: MAJOR
**Rationale**: "Roach motel" pattern — easy to sign up, hard to cancel. Subscription cancellation must be at least as easy as signup (FTC "click to cancel" rule applies).
**Source**: FTC Negative Option Rule — https://www.ftc.gov/legal-library/browse/rules/negative-option-rule

**The rule**: cancellation entry point reachable from the same surface as signup (account page, settings) in N≤2 clicks. Defer-to DP-LEGAL-01 for the compliance variant.

**Code patterns to flag**:
- Settings route `/account/billing` has no "Cancel subscription" link or button
- Cancel flow requires phone call when signup was online-only
- Cancel link hidden in `<Footer>` or `<Help>` rather than in account settings

**Correct pattern**: "Cancel subscription" button on the billing/subscription page; same channel as signup.

**Quick-fix hint**: trace cancel-link discoverability from account dashboard.

---

### DP-SUB-02: Cancellation requires extra confirmation steps

**Severity**: MAJOR
**Rationale**: Forcing the user through 5+ "Are you sure?" / "But you'll lose features!" steps to cancel is a friction-engineered dark pattern.
**Source**: deceptive.design "Roach Motel" — https://www.deceptive.design/types

**The rule**: cancellation flow has at most 1 confirmation step (matching MC-026 destructive-confirmation discipline). Defer-to MC-027 (severity MAJOR — "Confirm destructive actions; don't gate non-destructive actions", lives in `microcopy/confirmations.md` per dev.64 retrofit) for the microcopy rule.

**Code patterns to flag**:
- Multi-step cancel wizard (`<Step1Reason>` → `<Step2Discount>` → `<Step3Survey>` → `<Step4Confirm>`)
- Cancel button that re-routes to a "wait, let us help" surface

**Correct pattern**: single confirmation modal with "Yes, cancel" + "Keep subscription".

**Quick-fix hint**: cancel-flow component — count steps from "Cancel" click to actual cancellation.

---

### DP-SUB-03: Retention offer interstitials

**Severity**: MINOR
**Rationale**: Showing a "Wait! Have 50% off!" offer between clicking "Cancel" and the cancel-confirmation step is a manipulation lever — even when the offer is legitimate.
**Source**: NN/g deceptive patterns — https://www.nngroup.com/articles/deceptive-patterns/

**The rule**: retention offers (if shown) are dismissable in one click and never block the path to cancellation.

**Code patterns to flag**:
- Modal with "Cancel" disabled until user views the offer
- Re-presentation of the same retention offer on retry

**Correct pattern**: retention offer presented once; dismiss = continue to cancel flow.

**Quick-fix hint**: retention-modal — verify "Cancel anyway" path is one click + visible.

---

### DP-SUB-04: Cancellation requires phone / chat / email

**Severity**: MAJOR
**Rationale**: Channel-asymmetric cancellation (online signup but phone-only cancel) is explicitly prohibited by the FTC negative-option rule for many subscription types.
**Source**: FTC Negative Option Rule — https://www.ftc.gov/legal-library/browse/rules/negative-option-rule

**The rule**: cancellation available in the same channel as signup. Defer-to DP-LEGAL-02 for the compliance variant.

**Code patterns to flag**:
- "To cancel, please call us at 1-800-..." in account settings
- `<CancelButton>` that opens a `mailto:` link rather than performing cancellation

**Correct pattern**: web-signup → web-cancel; in-app signup → in-app cancel.

**Quick-fix hint**: cancel-flow component — verify in-channel completion.

---

### DP-SUB-05: Pre-checked "auto-renew" with no opt-out

**Severity**: MAJOR
**Rationale**: Auto-renewal opt-in checked by default without an explicit user action violates GDPR Article 7 valid-consent requirements (must be active, unambiguous opt-in for EU users).
**Source**: GDPR Article 7 — https://gdpr-info.eu/art-7-gdpr/

**The rule**: auto-renewal is opt-in via active user choice — not default-checked. Defer-to DP-LEGAL-05 for the GDPR compliance variant.

**Code patterns to flag**:
- `<Checkbox checked={true} name="autoRenew">` as the default state at checkout
- Auto-renewal toggle pre-flipped in account settings on first visit

**Correct pattern**: `<Checkbox checked={false} name="autoRenew">` with explicit user action to enable.

**Quick-fix hint**: checkout form — auto-renew checkbox default state.

---

### DP-SUB-06: Trial silently converts to paid

**Severity**: MAJOR
**Rationale**: Trial-to-paid conversion with no pre-conversion email, in-app notification, or prominent disclosure is a "forced continuity" subscription dark pattern.
**Source**: deceptive.design "Forced Continuity" — https://www.deceptive.design/types

**The rule**: trial conversion to paid is preceded by at least one explicit notification (email + in-app) at least 3 days before the charge. Defer-to DP-LEGAL-04 for the compliance variant.

**Code patterns to flag**:
- Trial-conversion job that charges without a preceding notification trigger
- `sendTrialEndingNotification()` function absent or commented-out

**Correct pattern**: scheduled trial-ending notification at trial-end minus 3 days, AND email confirmation at charge.

**Quick-fix hint**: trial-conversion flow — verify notification-trigger exists.

---

### DP-SUB-07: Account deletion = subscription cancellation entanglement

**Severity**: MAJOR
**Rationale**: Forcing the user to cancel a subscription before deleting an account (or vice versa) without a single combined flow makes both actions harder. Some patterns hide one path behind the other.
**Source**: deceptive.design "Roach Motel" — https://www.deceptive.design/types

**The rule**: account-deletion and subscription-cancellation are accessible independently; account deletion implicitly cancels active subscriptions with one confirmation.

**Code patterns to flag**:
- "Delete account" disabled while a subscription is active without a "Cancel subscription first" combined flow
- Subscription-cancel that requires account-delete

**Correct pattern**: clear "Delete account" affordance that cancels subscriptions as part of the same transaction.

**Quick-fix hint**: account-settings flow — verify orthogonal delete vs cancel paths.

---

### DP-SUB-08: Auto-resubscribe on payment-method update

**Severity**: MAJOR
**Rationale**: When a user updates a payment method after their card expired and the subscription lapsed, automatically resuming the subscription without explicit re-confirmation is dark.
**Source**: FTC Negative Option Rule — https://www.ftc.gov/legal-library/browse/rules/negative-option-rule

**The rule**: payment-method update on a lapsed subscription requires explicit "Resume subscription" action — does not auto-resume.

**Code patterns to flag**:
- `updatePaymentMethod()` handler that calls `resumeSubscription()` unconditionally
- Webhook that resumes on `card_updated` without `user.intent.resume = true`

**Correct pattern**: payment-method update is independent of subscription state; "Resume subscription" is a separate user action.

**Quick-fix hint**: payment-update handler — trace whether it triggers subscription-resume.

---

### DP-SUB-09: Downgrade hidden behind cancel

**Severity**: MAJOR
**Rationale**: Forcing users who want a cheaper plan to go through the cancel flow (and getting offered the downgrade as a "retention offer") rather than offering downgrade as a first-class option.
**Source**: deceptive.design — https://www.deceptive.design/types

**The rule**: plan-change UI exposes downgrade options at the same level as upgrade options; downgrade is not gated behind "Cancel".

**Code patterns to flag**:
- Subscription-settings page with "Upgrade plan" but no "Change plan" / "Downgrade" option
- Downgrade path only accessible after clicking "Cancel"

**Correct pattern**: "Change plan" surface with all tiers shown; both up and down are first-class actions.

**Quick-fix hint**: plan-management UI — verify downgrade is discoverable without entering cancel flow.

---

### DP-SUB-10: Subscription-status surface omissions

**Severity**: MINOR
**Rationale**: Account dashboard doesn't show the next billing date, current plan name, or cancellation status — forcing users to dig through emails or call support.
**Source**: Baymard subscription-UX — https://www.baymard.com/blog

**The rule**: subscription dashboard shows plan name, billing amount, next billing date, and cancellation status at a glance.

**Code patterns to flag**:
- `<BillingPage>` showing only a list of past invoices without forward-looking renewal info
- Status field rendered as "Active" without renewal date

**Correct pattern**: card-style summary at top of billing page with plan / amount / next-date / status.

**Quick-fix hint**: billing-page top component — verify summary card is present.
