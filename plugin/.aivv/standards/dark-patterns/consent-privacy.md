# Dark Patterns — Consent + privacy (DP-CONSENT-01..12)

Part of [.aivv/standards/dark-patterns/](README.md).

### DP-CONSENT-01: Pre-checked opt-in for non-essential cookies

**Severity**: MAJOR
**Rationale**: Cookie-consent banners with non-essential categories (analytics, advertising, social) pre-checked violate GDPR Article 7 (consent must be active, freely given, specific).
**Source**: GDPR Cookies guidance — https://gdpr.eu/cookies/

**The rule**: cookie banners pre-check ONLY strictly-necessary cookies; analytics / advertising / social-media categories start unchecked. Defer-to DP-LEGAL-06 for the compliance variant.

**Code patterns to flag**:
- `<Checkbox checked={true}>` for `marketing` / `analytics` / `social` categories on first render
- Default consent object: `{necessary: true, analytics: true, marketing: true}` — last two should be false

**Correct pattern**: `{necessary: true, analytics: false, marketing: false, social: false}` initially; user must check to enable.

**Quick-fix hint**: cookie-consent initial state — verify only necessary is true.

---

### DP-CONSENT-02: Asymmetric Accept/Reject buttons

**Severity**: MAJOR
**Rationale**: "Accept all" button styled as primary CTA while "Reject all" is a hidden text link or buried two clicks deep violates GDPR Article 7 (consent must be freely given — equal prominence required).
**Source**: GDPR Article 7 — https://gdpr-info.eu/art-7-gdpr/

**The rule**: "Accept all" and "Reject all" buttons have equal visual prominence — same size, same step depth, same visual hierarchy. Defer-to DP-LEGAL-07 for the GDPR compliance variant.

**Code patterns to flag**:
- `<Button variant="primary">Accept all</Button>` next to `<a href="#">Reject</a>`
- Reject option only accessible via "Manage preferences" → toggle each → "Save"

**Correct pattern**: two equal-weight buttons: "Accept all" / "Reject all" / "Customize" — all at the first banner level.

**Quick-fix hint**: cookie-banner buttons — verify same component / variant for both.

---

### DP-CONSENT-03: "Necessary" cookie misclassification

**Severity**: MAJOR
**Rationale**: Marking advertising cookies as "necessary" to bypass consent requirements is a documented dark pattern caught by EU regulators in enforcement actions.
**Source**: GDPR Cookies — https://gdpr.eu/cookies/

**The rule**: "Necessary" / "Strictly necessary" category contains ONLY cookies essential for site function (session, security, load balancing). Marketing pixels and analytics never qualify.

**Code patterns to flag**:
- Cookie-category config with `necessary: ['_ga', 'fbp', 'fbc', ...]`
- Marketing-pixel scripts loading before consent check

**Correct pattern**: necessary = session / CSRF / security only; everything else awaits explicit consent.

**Quick-fix hint**: cookie-category mapping — audit which categories include tracking IDs.

---

### DP-CONSENT-04: Hidden "Reject" in "Manage preferences"

**Severity**: MAJOR
**Rationale**: Banner shows only "Accept all" + "Manage preferences" — no top-level "Reject all" — forcing users to click through, toggle each category off, and click Save. Cookie-consent dark pattern.
**Source**: GDPR Article 7 — https://gdpr-info.eu/art-7-gdpr/

**The rule**: "Reject all" / "Decline" available at the first banner level, not behind a multi-click preferences flow.

**Code patterns to flag**:
- `<CookieBanner>` with only "Accept" + "Manage" buttons
- "Reject all" requiring users to first open the preferences modal

**Correct pattern**: three buttons at first level: Accept / Reject / Customize.

**Quick-fix hint**: cookie-banner first-render buttons — count and verify all three CTAs.

---

### DP-CONSENT-05: Re-prompting after rejection

**Severity**: MAJOR
**Rationale**: Re-showing the consent banner on every page load after the user already rejected — wearing them down — violates GDPR's "freely given" consent principle.
**Source**: GDPR Article 7 — https://gdpr-info.eu/art-7-gdpr/

**The rule**: rejection is remembered for at least 6 months (or session lifetime, whichever longer); re-prompting only on substantive policy changes.

**Code patterns to flag**:
- `localStorage.getItem('consent-status') === null` check that ignores `'rejected'` value
- Consent-banner displays whenever any non-necessary category is missing, without distinguishing "never decided" from "rejected"

**Correct pattern**: store `{status: 'rejected', expiresAt: now + 6mo}`; re-prompt only after expiry or policy change.

**Quick-fix hint**: consent-storage logic — verify rejection persists.

---

### DP-CONSENT-06: Confirmshaming in privacy choices

**Severity**: MAJOR
**Rationale**: "No thanks, I don't want to receive helpful updates" — using guilt-laden copy on opt-out buttons. Confirmshaming dark pattern.
**Source**: deceptive.design "Confirmshaming" — https://www.deceptive.design/types

**The rule**: opt-out copy is neutral ("Decline", "Not now", "No"), never guilt-laden.

**Code patterns to flag**:
- `<Button>No, I don't want to save money</Button>`
- `<Button>Skip — I prefer the harder way</Button>`

**Correct pattern**: "No thanks", "Decline", "Not now" — neutral framing.

**Quick-fix hint**: grep opt-out button labels for emotional/judgmental adjectives.

---

### DP-CONSENT-07: Privacy-policy link absent from consent surface

**Severity**: MAJOR
**Rationale**: Consent banners that don't link to the privacy policy at the point of consent violate GDPR Article 13 transparency requirements.
**Source**: GDPR — https://gdpr.eu/

**The rule**: every consent surface includes a visible link to the privacy policy at the same level as Accept/Reject. Defer-to DP-LEGAL-08 for the compliance variant.

**Code patterns to flag**:
- `<CookieBanner>` with copy + buttons only; no privacy-policy `<a>`
- Privacy link only in the footer of the consent-management modal

**Correct pattern**: privacy-policy link visible in the initial banner alongside the action buttons.

**Quick-fix hint**: cookie-banner first-render — verify privacy-policy link presence.

---

### DP-CONSENT-08: Tracking before consent

**Severity**: MAJOR
**Rationale**: Loading Google Analytics, Facebook Pixel, or any tracking script before the user has consented violates GDPR.
**Source**: GDPR Cookies — https://gdpr.eu/cookies/

**The rule**: tracking scripts load only after `consent.analytics === true` (or equivalent category). Pre-consent loads are violations.

**Code patterns to flag**:
- `<script src="https://www.googletagmanager.com/gtm.js"></script>` in `<head>` unconditional
- `gtag('config', ...)` called on app mount before consent state is loaded

**Correct pattern**: consent-conditional script injection (`if (consent.analytics) inject(gtm)`), or Consent Mode v2.

**Quick-fix hint**: third-party tracking scripts — verify each is consent-gated.

---

### DP-CONSENT-09: Withdrawal at least as hard as consent

**Severity**: MAJOR
**Rationale**: GDPR Article 7(3) requires consent withdrawal to be "as easy" as giving consent. A consent banner that takes 1 click but a withdrawal flow that takes 5 clicks violates this.
**Source**: GDPR Article 7 — https://gdpr-info.eu/art-7-gdpr/

**The rule**: a "Withdraw consent" / "Manage privacy" link accessible from every page (typically in the footer); withdrawal flow ≤ N+1 clicks where N is the original consent depth. Defer-to DP-LEGAL-09 for the compliance variant.

**Code patterns to flag**:
- No footer link to consent-management
- Withdrawal requires email to support@

**Correct pattern**: `<Footer><Link to="/privacy-settings">Privacy preferences</Link></Footer>` reachable everywhere.

**Quick-fix hint**: site-wide footer — verify privacy-settings link.

---

### DP-CONSENT-10: Bundled consent (forced action)

**Severity**: MAJOR
**Rationale**: Consent that bundles unrelated purposes ("Sign up to agree to terms AND receive marketing emails AND share data with partners") — user cannot accept terms without accepting the others.
**Source**: GDPR Article 7 — https://gdpr-info.eu/art-7-gdpr/

**The rule**: each purpose has its own consent toggle; only legally-required consents are bundled with primary action.

**Code patterns to flag**:
- `<Checkbox required>I agree to terms AND marketing AND data-sharing</Checkbox>`
- Signup flow with single "I agree" covering 3+ unrelated purposes

**Correct pattern**: terms = mandatory bundled with signup; marketing / data-sharing = separate optional checkboxes.

**Quick-fix hint**: signup terms checkbox — verify scope is terms only.

---

### DP-CONSENT-11: Personalization gated behind consent without alternative

**Severity**: MINOR
**Rationale**: "Accept cookies to personalize your experience" framing implies consent is the only path to a good experience — coercion vs free choice.
**Source**: GDPR Article 7 — https://gdpr-info.eu/art-7-gdpr/

**The rule**: site functionality must work for users who reject non-essential consent; copy avoids "Accept to enjoy the full experience" framing.

**Code patterns to flag**:
- Cookie-banner copy: "Accept all cookies for the best experience"
- Site features locked behind analytics-consent state

**Correct pattern**: site works in baseline form without non-essential consent; consent-gated features clearly labeled.

**Quick-fix hint**: cookie-banner copy + post-reject site behavior — verify usability preserved.

---

### DP-CONSENT-12: Dark-patterned data-portability request flows

**Severity**: MAJOR
**Rationale**: GDPR Article 20 requires data portability; some sites bury the export request behind multi-day delays, identity-verification beyond what's necessary, or PDF-only exports that defeat portability.
**Source**: GDPR — https://gdpr.eu/

**The rule**: data-export request reachable from account settings; export delivered in machine-readable format (JSON / CSV) within the GDPR 30-day window.

**Code patterns to flag**:
- "Request data export" button that opens a `mailto:` to support
- Export route returning PDF-only when user requested raw data

**Correct pattern**: in-app export flow with JSON/CSV download; clear ETA.

**Quick-fix hint**: account-data-export feature — verify in-app + machine-readable.
