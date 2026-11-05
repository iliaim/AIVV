# Compliance — Legal risk

Part of [.aivv/standards/compliance/](README.md) (COMP-LEGAL-NN). Each rule captures a **regulatory or statutory** legal-risk concern that may trigger civil enforcement, class-action liability, regulator fines, or platform bans when violated. These are the **L1 source class** of AIVV's severity framework — citations come from primary statute / regulation / formal regulator guidance, not from style guides or best-practice opinion. Per the L1-source detection logic at `skills/aivv-fix/references/polish-and-l1-source-policy.md` (canonical home; result rendering references this policy), COMP-LEGAL-* rule IDs match the forced-show prefix regex `^(COMP-LEGAL-|A11Y-|DP-LEGAL-)` — these findings always surface in reviewer output regardless of the severity threshold (the user has explicit visibility into legal-risk patterns even when filtering MAJOR/MINOR/POLISH).

**⚠️ NOT LEGAL ADVICE.** AIVV is a code-review tool, not a legal advisor. Findings under COMP-LEGAL-* identify code patterns that *correlate with* documented enforcement actions, regulator guidance, or statutory text. They are NOT a substitute for review by qualified counsel in your jurisdiction. Statutes evolve; enforcement priorities shift; jurisdiction-specific interpretation matters. Treat AIVV findings as a screening layer that points at "this pattern has been the subject of [regulator] actions / [statute] §[N]" — then consult counsel before acting on the finding's "fix" suggestion in a production legal-sensitive context.

**Severity convention:** COMP-LEGAL-* findings are forced-shown regardless of `severity_threshold`. Apply the CRITICAL/DISPOSITION floor when declared Project Context makes the cited authority applicable, or when applicability is undeclared and the code pattern plausibly falls inside that authority. If declared context makes the authority inapplicable, render the L1 citation as a context note / POLISH or lower-priority DISPOSITION rather than borrowing the hard-statute floor. Legal-risk findings carry high reviewer urgency because the cost of a false-negative can be regulator action / lawsuit / platform delisting — not user inconvenience.

**Scope-relationship to `dark-patterns/legal.md`:** The DP-LEGAL-* subset (DP-LEGAL-01..13) covers manipulative-UX patterns that ALSO trigger legal risk (forced-continuity subscriptions, hidden recurring fees, fake scarcity disclosures, etc.) — those rules are anchored on the *behavioral-manipulation* axis with legal authority as supporting weight. COMP-LEGAL-* in this file covers the **transparency / disclosure / data-subject-rights / accessibility-lawsuit** legal-risk axis directly, where the rule's primary anchor IS the statute (GDPR / CCPA / FTC / ADA / Section 508 / COPPA / EU DSA / etc.) and dark-pattern UX is incidental. Both files contribute to the L1-source-class forced-show set per the canonical L1-source detection logic at `skills/aivv-fix/references/polish-and-l1-source-policy.md`.

Added dev.103 = T43 Wave 2 phase 1 batch 7.

---

### COMP-LEGAL-01: GDPR Article 13 — disclose required information at point of data collection

**Severity**: CRITICAL
**Authority**: EU GDPR Regulation (EU) 2016/679, Article 13
**Source**: https://gdpr-info.eu/art-13-gdpr/ — verbatim Article 13(1)(a): "the identity and the contact details of the controller and, where applicable, of the controller's representative". Verbatim Article 13(1)(c): "the purposes of the processing for which the personal data are intended as well as the legal basis for the processing".

**The rule**: When personal data is collected directly from the data subject (signup forms, contact forms, account-creation flows, newsletter-subscribe, comment-submission, any form where the user types their name / email / phone / address / IP-derived location / etc.), GDPR Article 13 requires the controller to provide AT LEAST: (1) identity + contact details of the controller; (2) contact details of the Data Protection Officer (DPO) where applicable; (3) purposes of processing AND legal basis (consent / contract / legitimate interest / legal obligation / vital interests / public task); (4) recipients or categories of recipients; (5) any third-country transfers + the safeguards used; (6) retention period (or the criteria for determining it); (7) the data subject's rights (access, rectification, erasure, restriction, portability, objection, withdraw-consent, complain-to-supervisory-authority); (8) whether providing the data is statutory / contractual / required-to-enter-contract AND the consequences of not providing it. The information must be provided AT or BEFORE collection — a privacy policy link in the page footer that the user might never visit is borderline; an in-form "Why we need this" / "Privacy notice" disclosure adjacent to the submit button is the safer practice.

**Code patterns to flag**:
- Signup / contact / newsletter form with NO adjacent privacy notice / "View privacy policy" link / disclosure of purposes (legal exposure when data subject is EU resident)
- Form submitting to `/api/signup` with retention period nowhere disclosed (Article 13(2)(a))
- Cookie-only privacy policy link in footer (`<a href="/privacy">Privacy</a>`) with no form-adjacent disclosure
- Newsletter subscribe component imported from a marketing-platform vendor (Mailchimp, ConvertKit, HubSpot) without confirming the vendor-rendered disclosure surfaces the required Article 13 items
- B2C signup form with no separate consent checkbox for marketing (vs. required-for-service-delivery data) — consent must be specific and granular per Article 7

**Correct pattern**:
```jsx
<form onSubmit={handleSignup}>
  <fieldset>
    <legend>Create account</legend>
    <label>Email <input type="email" name="email" autoComplete="email" required /></label>
    <label>Name <input type="text" name="name" autoComplete="name" required /></label>

    {/* Article 13 disclosure adjacent to submit */}
    <div aria-describedby="signup-privacy">
      <details id="signup-privacy">
        <summary>How we use your data</summary>
        <p>We (Acme Corp, EU rep: Acme EU Ltd, DPO: dpo@acme.com) collect this data to create your account
           (legal basis: contract — Art. 6(1)(b)). We retain it until account deletion + 7 years for legal records.
           You have rights to access, rectification, erasure, portability — see <a href="/privacy#rights">/privacy#rights</a>.
           You can lodge a complaint with your supervisory authority.</p>
      </details>

      <label>
        <input type="checkbox" name="marketing_consent" />
        Also send me product updates (optional; legal basis: consent — Art. 6(1)(a); withdraw any time)
      </label>
    </div>

    <button type="submit">Create account</button>
  </fieldset>
</form>
```

**Quick-fix hint**: For every form that collects personal data from EU/UK users (or where you can't reliably exclude EU/UK users), provide adjacent disclosure of: who you are, what you're collecting, why, on what legal basis, how long you keep it, and what rights the user has. The form-adjacent `<details>` / `<aside>` disclosure pattern is more defensible than a footer-only privacy policy link.

**Consult counsel**: this rule identifies the code-reviewable form-adjacent disclosure gap. Determining the *correct content* of the Article 13 notice (purpose statement, legal basis, retention period, recipient categories) requires legal review of your specific data flows and downstream third-parties. AIVV cannot tell you what your retention period should be or whether your legal basis is "consent" vs "legitimate interest" — those are jurisdiction- + counsel-specific.

**See also**: **DP-LEGAL-08** (`dark-patterns/legal.md`, "GDPR Article 13 — Transparency at Collection") — DP-LEGAL-08 covers the *behavioral-manipulation* facet of Article 13 violations (e.g., disclosure language designed to obscure rather than inform, "ugly" privacy notices contrasted with attractive marketing copy); COMP-LEGAL-01 covers the *disclosure-mechanism-presence* facet (is the required information disclosed at all, in the right place, before collection). The two rules are complementary axes on the same Article 13 surface — DP-LEGAL-08 triggers when disclosure is present-but-manipulative; COMP-LEGAL-01 triggers when disclosure is absent or insufficient. **DP-LEGAL-05** (`dark-patterns/legal.md`, "GDPR Article 7 — Active Consent") — sibling rule for the consent-mechanism axis when legal basis IS consent (pre-checked boxes / nested-consent dialogs are DP-LEGAL-05 findings; COMP-LEGAL-01 covers the disclosure-of-legal-basis axis regardless of which basis applies). **A11Y-061** (`accessibility/forms.md`, "Use HTML `autocomplete` attribute on personal-information fields") — the autocomplete tokens for personal-info fields are themselves a GDPR data-subject signal (the field is collecting personal data); ensure Article 13 disclosure presence whenever the form has `autocomplete` tokens for name/email/phone/address.

---

### COMP-LEGAL-02: GDPR Article 17 — provide a working "right to erasure" mechanism

**Severity**: CRITICAL
**Authority**: EU GDPR Regulation (EU) 2016/679, Article 17 ("Right to erasure / right to be forgotten")
**Source**: https://gdpr-info.eu/art-17-gdpr/

**The rule**: Data subjects (EU/UK residents) have the right under GDPR Article 17 to request erasure of their personal data without undue delay when one of six grounds applies (data no longer necessary, consent withdrawn, objection upheld, unlawful processing, legal obligation, child's data collected for information-society services). The controller MUST provide a working mechanism for this request — typically an in-app "Delete my account" flow OR a contact mechanism (email / form) that initiates the deletion process. The mechanism must be at least as easy to find as the account-creation flow. Critically, "Delete my account" buttons that route to a customer-service ticket queue with weeks-long backlogs may fail Article 17's "without undue delay" requirement.

**Code patterns to flag**:
- Account-settings page with NO "Delete account" / "Delete my data" / "Request data erasure" path
- "Delete account" button that only disables the account (preserves data) without an actual erasure path
- Erasure-request flow that requires the user to mail a physical letter / fax a form / call a phone number (vs. providing an in-app or email submission path)
- Soft-delete with no documented hard-delete schedule (data retained indefinitely in the deleted-account state defeats Article 17 unless legal-retention obligations explicitly apply)
- Account-deletion that wipes the account UI surface but leaves user records in analytics platforms / email service providers / data warehouses without a documented downstream-deletion pipeline

**Correct pattern**:
```jsx
function AccountSettingsPage() {
  return (
    <main>
      <h1>Account settings</h1>
      {/* … other settings … */}

      <section aria-labelledby="data-rights">
        <h2 id="data-rights">Your data rights</h2>
        <ul>
          <li><a href="/account/data-export">Export my data (GDPR Art. 20)</a></li>
          <li><a href="/account/correction">Correct my data (GDPR Art. 16)</a></li>
          <li><a href="/account/erasure">Delete my account and erase my data (GDPR Art. 17)</a></li>
        </ul>
      </section>
    </main>
  );
}

// Erasure flow
async function eraseAccount(userId: string, requestedAt: Date) {
  // 1. Confirm with user (per COMP-WCAG-AAA-12 + A11Y-064)
  // 2. Soft-delete with documented 30-day grace period for cancellation
  // 3. Hard-delete after grace period — propagate to:
  //    - primary DB (transactional erasure)
  //    - analytics platforms (Segment forget API / Mixpanel delete API / Amplitude DSR endpoint)
  //    - email service provider (Mailchimp delete API / SendGrid suppression list)
  //    - data warehouse + backups (per documented retention schedule)
  //    - third-party processors per DPA (Data Processing Agreement)
  // 4. Audit log retained per legal-records retention; data-subject record purged
}
```

**Quick-fix hint**: Provide an in-app "Delete account" flow accessible from account settings. Document the deletion pipeline: which downstream systems also delete (analytics, email, warehouse), what's retained for legal/audit reasons, and what the timeline is. Test the end-to-end flow against a test account before shipping.

**Consult counsel**: legal-retention obligations vary by jurisdiction + industry (e.g., financial transactions: 7 years US, longer in some EU jurisdictions; healthcare: HIPAA / equivalents; tax: 7 years; AML/KYC: 5 years). Determine what MUST be retained vs. what CAN be erased with counsel; encode the retention exemptions in code rather than discovering them post-hoc.

**See also**: **DP-LEGAL-01** (`dark-patterns/legal.md`, "FTC Negative Option Rule — easy cancellation") + **DP-LEGAL-02** (same file, "FTC Channel-Asymmetric Cancellation") — DP-LEGAL-01/02 cover the *cancellation-friction* manipulation axis (US FTC authority); COMP-LEGAL-02 covers the EU/UK GDPR Article 17 *erasure-mechanism-presence* axis. The two regulatory regimes overlap operationally — a "Delete account requires phone call" pattern triggers DP-LEGAL-02 (FTC Click-to-Cancel rule) AND COMP-LEGAL-02 (GDPR Article 17 "without undue delay" requirement). **DP-LEGAL-09** (`dark-patterns/legal.md`, "GDPR Article 7(3) — Withdrawal as Easy as Consent") — adjacent GDPR right (consent withdrawal, not data erasure — withdrawal stops future processing; erasure deletes past data). Both must be available. **COMP-LEGAL-03** (this file, "CCPA / CPRA — provide a 'Do Not Sell or Share My Personal Information' link") — sibling US-jurisdiction regulatory mechanism; data-subject rights mechanisms compose across jurisdictions (a US business serving EU users must provide both Article 17 erasure AND CCPA opt-out).

---

### COMP-LEGAL-03: CCPA / CPRA — provide a "Do Not Sell or Share My Personal Information" link

**Severity**: CRITICAL
**Authority**: California Consumer Privacy Act (CCPA, Civil Code §1798.100 et seq.) as amended by California Privacy Rights Act (CPRA)
**Source**: https://oag.ca.gov/privacy/ccpa — verbatim FAQ Section B.3 wording: "Businesses that sell personal information are subject to the CCPA's requirement to provide a clear and conspicuous 'Do Not Sell or Share My Personal Information' link on their website that allows you to submit an opt-out request."

**The rule**: California businesses (and businesses serving California residents that meet CCPA's thresholds — $25M+ annual revenue, OR processing 100K+ consumer records, OR 50%+ revenue from selling personal info) that "sell" OR "share" personal information (broadly construed to include third-party advertising trackers that match cookies across sites) MUST provide a clear-and-conspicuous "Do Not Sell or Share My Personal Information" link. The link's required placement is the homepage footer (or equivalent persistent surface) — not buried in a privacy policy. The opt-out mechanism behind the link must work without requiring account creation. CPRA (effective 2023) extended the right to "limit use of sensitive personal information" — businesses processing sensitive PI (precise geolocation, race, religion, sexual orientation, health, financial, biometric, etc.) need an additional "Limit the Use of My Sensitive Personal Information" link.

**Code patterns to flag**:
- Site loads third-party ad-tech / analytics tags (Google Ads, Meta Pixel, programmatic ad networks) but has NO "Do Not Sell or Share My Personal Information" link in the footer
- Footer link present but routes to a no-op page / says "We don't sell your data" without honoring a sale-suppression cookie / config-flag
- Opt-out mechanism requires account creation (explicitly disallowed — "Businesses cannot require you to create an account in order to submit your request")
- Opt-out flow puts a "Confirm opt-out" friction step that exceeds the friction to enable tracking (asymmetric friction — adjacent dark-pattern concern at DP-CONSENT-NN)
- Site processes "sensitive personal information" (per CPRA definition) without a "Limit Use of Sensitive Personal Information" link

**Correct pattern**:
```jsx
function SiteFooter() {
  return (
    <footer>
      <nav aria-label="Footer">
        <a href="/privacy">Privacy Policy</a>
        <a href="/do-not-sell">Do Not Sell or Share My Personal Information</a>
        <a href="/limit-sensitive">Limit the Use of My Sensitive Personal Information</a>
        <a href="/contact">Contact</a>
      </nav>
    </footer>
  );
}

// /do-not-sell page
function DoNotSellPage() {
  const [optedOut, setOptedOut] = useState(getOptOutCookie());
  return (
    <main>
      <h1>Do Not Sell or Share My Personal Information</h1>
      <p>California residents can opt out of the sale or sharing of their personal information.
         No account required.</p>
      <form onSubmit={(e) => { e.preventDefault(); setOptOutCookie(true); setOptedOut(true); }}>
        <button type="submit">{optedOut ? "Opted out — re-enable" : "Opt me out"}</button>
      </form>
    </main>
  );
}
```

**Quick-fix hint**: Add a footer link with the exact text "Do Not Sell or Share My Personal Information" (CPRA-amended wording — the older CCPA-only "Do Not Sell My Personal Information" is still accepted but the longer form is the safer choice forward). The opt-out mechanism must work without account creation. Support the [Global Privacy Control (GPC)](https://globalprivacycontrol.org/) header signal — browsers/extensions sending `Sec-GPC: 1` must be honored as an opt-out signal under CPRA without requiring user action.

**Consult counsel**: whether your business "sells" or "shares" personal information under CCPA/CPRA's broad definitions (which include common third-party ad-tech behaviors) requires legal review. Most consumer-facing businesses serving California users WILL meet the threshold — counsel can confirm + advise on the specific link wording, opt-out mechanism scope, and GPC honoring.

**See also**: **COMP-LEGAL-01** (this file, "GDPR Article 13 — disclose required information at point of data collection") — sibling regulatory regime; data-subject rights mechanisms compose across jurisdictions. **DP-CONSENT-*** (`dark-patterns/consent-privacy.md`) — dark-pattern variants of consent / opt-out mechanisms (asymmetric friction, pre-checked boxes, nested rejection) are DP-CONSENT findings on the manipulation axis; COMP-LEGAL-03 is the regulatory-mechanism-presence axis regardless of UX intent. **DP-LEGAL-06** (`dark-patterns/legal.md`, "GDPR Cookie Consent") — adjacent EU regulatory mechanism (cookie consent banners under ePrivacy Directive + GDPR); CCPA's CPRA-amended right + EU cookie consent compose into the cross-jurisdiction consent-mechanism stack.

---

### COMP-LEGAL-04: FTC Endorsement Guides — disclose material connections clearly + conspicuously

**Severity**: CRITICAL
**Authority**: FTC Endorsement Guides — 16 CFR Part 255 §255.5 "Disclosure of material connections"
**Source**: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255 (16 CFR Part 255 official text; FTC's plain-language guidance at https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking — direct fetch returned 403 due to FTC.gov restrictions; citation by section number is authoritative)

**The rule**: When a "material connection" exists between an endorser and the advertiser (any payment, free product, employee relationship, family/friend connection, or other consideration that could affect endorsement weight), the connection must be disclosed clearly and conspicuously alongside the endorsement. Per FTC guidance: disclosures must be in the same medium as the endorsement (a video endorsement needs in-video disclosure, not video-description-only); placed above-the-fold / before the endorsement content; using clear unambiguous language (`#ad`, `#sponsored`, `Paid partnership with [brand]`) not platform-buried indicators alone (e.g., Instagram's small "Paid partnership" label that requires expanding the post header is not sufficient as the SOLE disclosure mechanism). This applies to influencer marketing, affiliate-link content, employee-authored review/social content, and product-review aggregator content.

**Code patterns to flag**:
- Influencer-content management system that surfaces creator posts WITHOUT a "Sponsored" / "Paid partnership" badge on the post component itself (relying solely on platform-native indicators like Instagram's expandable header is insufficient)
- Affiliate-link rendering in editorial content with no inline "(affiliate link)" disclosure adjacent to the link
- User-generated-content surface where employees can post product reviews without an "Employee review" badge
- Sponsored-content card that adopts the same visual treatment as organic content with no clear "Sponsored" badge above-the-fold
- Hashtag-based disclosure rendered inline at the END of caption text (`...all-day comfort and style #ad`) — `#ad` at the END is "buried" disclosure per FTC guidance; should appear BEFORE the content or visually distinct at the top

**Correct pattern**:
```jsx
function SponsoredContentCard({ post, sponsor }) {
  return (
    <article aria-labelledby={`post-${post.id}-title`}>
      <div className="sponsored-banner" role="note">
        <strong>Sponsored by {sponsor.name}</strong> · This is a paid partnership.
      </div>
      <h3 id={`post-${post.id}-title`}>{post.title}</h3>
      <p>{post.body}</p>
    </article>
  );
}

function AffiliateLink({ href, productName, children }) {
  return (
    <span>
      <a href={href} rel="sponsored noopener" target="_blank">{children}</a>
      <span className="affiliate-disclosure"> (affiliate link)</span>
    </span>
  );
}
```

**Quick-fix hint**: Add visible "Sponsored" / "Paid partnership" / "Affiliate link" disclosure at the same prominence as the endorsement. Use `rel="sponsored"` on affiliate links (the W3C/Google-recognized link type — also helps with SEO compliance). For influencer content, disclose at the top of the post body, not at the end.

**Consult counsel**: the FTC has actively enforced against influencers, brands, and platforms for inadequate disclosure (e.g., Lord & Taylor 2016 settlement, CSGO Lotto 2017, multiple 2023 influencer warnings). Whether your content surfaces meet "clear and conspicuous" depends on the specific UI patterns + audience — counsel can advise on platform-specific (Instagram, TikTok, YouTube) acceptable forms.

**See also**: **DP-LEGAL-10** (`dark-patterns/legal.md`, "FTC Endorsement Guides — Sponsored Disclosure") — DP-LEGAL-10 covers the *manipulation* facet (sponsored content adopting organic visual treatment to deceive); COMP-LEGAL-04 covers the *disclosure-presence + placement* facet (is the disclosure present, in the same medium, before the endorsement content). Both rules apply: DP-LEGAL-10 triggers when disclosure is technically present but visually de-emphasized; COMP-LEGAL-04 triggers when disclosure is absent OR buried (end of long caption, expandable-only platform indicator).

---

### COMP-LEGAL-05: Children's privacy — verifiable parental consent for users below the consent-age threshold

**Severity**: CRITICAL
**Authority**: COPPA (Children's Online Privacy Protection Act, 15 U.S.C. §§6501-6506 + 16 CFR Part 312) for US users under 13; GDPR Article 8 for EU users below 13-16 (per Member State); Age Appropriate Design Code (UK ICO) for UK users under 18
**Source**: https://gdpr-info.eu/art-8-gdpr/ — verbatim GDPR Article 8(1) (preamble): "Where point (a) of Article 6(1) applies, in relation to the offer of information society services directly to a child, the processing of the personal data of a child shall be lawful where the child is at least 16 years old." Verbatim Article 8(1) (continuation): "Where the child is below the age of 16 years, such processing shall be lawful only if and to the extent that consent is given or authorised by the holder of parental responsibility over the child." Verbatim Article 8(2): "The controller shall make reasonable efforts to verify in such cases that consent is given or authorised by the holder of parental responsibility over the child, taking into consideration available technology." COPPA at https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa (direct fetch 403; citation by US Code + CFR is authoritative).

**The rule**: When a service is directed to children OR has actual knowledge of collecting personal data from children below the consent-age threshold (US: 13 per COPPA; EU: 16 default with Member State authority to lower to 13 per GDPR Art 8; UK: per ICO Age Appropriate Design Code), verifiable parental consent is required before collecting, using, or disclosing personal information. "Personal information" under COPPA is broadly defined: name, email, screen-name, phone, photos, video, audio, geolocation, persistent identifier (cookie ID), and any "information concerning the child... that the operator collects online from the child and combines with an identifier" (§312.2). Verification mechanisms recognized by COPPA: signed consent form by parent (mail/fax/electronic), credit-card verification with notice (de-minimis charge), parental "ID verification" using known parental data, video conference with trained personnel, government-ID verification.

**Code patterns to flag**:
- Signup form with no age-gate (no `<input type="number">` or date-of-birth field) on a service whose content is plausibly directed to children (educational, gaming, social, video-streaming, kids-focused brand)
- Age-gate that's a single checkbox ("I am 13 or older") with no verification mechanism — COPPA does NOT consider self-attestation alone sufficient where the operator has reason to know users may be under 13
- Service collecting persistent identifiers (cookies, device IDs) on under-13 users (or, in EU, under 13-16 per Member State) without verifiable parental consent flow
- Content-moderation pipeline that flags user-reported "this user appears to be a minor" but has no actual-knowledge handling path triggering COPPA's consent flow + data-deletion for past collection

**Correct pattern**:
```jsx
function SignupForm() {
  const [birthDate, setBirthDate] = useState(null);
  const age = birthDate ? computeAge(birthDate) : null;
  const requiresParentalConsent = age !== null && age < 13; // COPPA threshold for US users
  // EU users: check against Member-State-specific threshold (13-16); UK: age-appropriate design code

  if (requiresParentalConsent) {
    return <ParentalConsentFlow childDob={birthDate} />;
  }

  return (
    <form>
      <label>Date of birth <input type="date" onChange={(e) => setBirthDate(new Date(e.target.value))} /></label>
      {/* … standard signup */}
    </form>
  );
}

function ParentalConsentFlow({ childDob }) {
  // Routes to one of the FTC-approved verification mechanisms:
  // - parent email + signed consent form
  // - credit-card verification with de-minimis charge + notice
  // - government-ID upload + manual verification
  // - video conference with trained personnel
  return <p>Please ask your parent or guardian to complete the consent process at parent@example.com…</p>;
}
```

**Quick-fix hint**: Add a date-of-birth or age field at signup; route under-threshold users to a parental-consent flow using one of the FTC-approved verification mechanisms (NOT bare self-attestation). For EU users, default to the strictest applicable threshold (16) unless you can geo-filter to a Member State that lowered to 13. For UK users, apply the ICO Age Appropriate Design Code's privacy-by-default principles (high-privacy defaults, no profile-based ads, no nudging away from privacy-protective options).

**Consult counsel**: COPPA + GDPR Article 8 + UK Age Appropriate Design Code have detailed jurisdiction-specific verification mechanism rules. Determine your service's "directed to children" status (FTC multi-factor test: subject matter, visual content, language, music, presence of child celebrities, ads marketed to children, etc.) with counsel; if directed, COPPA applies regardless of user-claimed age.

**See also**: **COMP-LEGAL-01** (this file, "GDPR Article 13 — disclose required information at point of data collection") — Article 13 disclosure applies to all data collection, including children's data; COMP-LEGAL-05 adds the consent + verification overlay specific to under-age data subjects. **DP-LEGAL-13** (`dark-patterns/legal.md`, "State-Level UDAP / 'All Consumers Act' Patterns") — multiple state-level "Age Appropriate Design" Acts (California AB-2273, Maryland HB-901) extend children's-privacy protections beyond COPPA's 13-and-under scope to age 17 — adjacent jurisdictional layer.

---

### COMP-LEGAL-06: ADA Title III — public-accommodation digital accessibility (WCAG 2.1 AA as practical baseline)

**Severity**: CRITICAL
**Authority**: Americans with Disabilities Act (ADA) Title III, 42 U.S.C. §§12181-12189 (public accommodations); DOJ April 2024 Final Rule under Title II for state/local governments (adopts WCAG 2.1 AA as technical standard); standing DOJ position that Title III applies to private-business websites of public accommodations
**Source**: https://www.ada.gov/topics/web/ (DOJ ADA web accessibility topic page; direct fetch 404 — content available at https://www.ada.gov/resources/web-guidance/ as of 2024-2025; citation by statute + DOJ rulemaking is authoritative)

**The rule**: Websites and mobile apps of "public accommodations" under ADA Title III (broadly defined: restaurants, hotels, retailers, banks, education, healthcare, professional services, online-only services that are functionally public-facing) must be accessible to people with disabilities. While Title III itself does NOT codify a specific technical standard, the DOJ's April 2024 final rule under Title II (state/local government services) adopts WCAG 2.1 Level AA as the technical standard — and US federal courts have repeatedly accepted WCAG 2.1 AA as the practical compliance baseline for Title III private-sector defendants (Robles v. Domino's 2019, NFB v. Target 2008, multiple subsequent settlements). Lawsuits under Title III have surged: Seyfarth Shaw's 2023 report documents 14,481 federal ADA Title III website-accessibility lawsuits filed 2018-2022 — concentrated in NY, FL, CA. Settlement costs typically $10-100k per case plus attorney fees + ongoing remediation obligations.

**Code patterns to flag**:
- Production-facing website / web-app / mobile-app of any business that physically operates restaurants, hotels, retail stores, gyms, banks, healthcare practices, professional offices, theaters, museums, or transportation (the Title III "public accommodation" enumeration is broad)
- Site lacking any documented WCAG conformance (no accessibility statement, no axe-core / Lighthouse pass record, no documented WCAG audit)
- Site with documented accessibility failures (failing A11Y baseline rules from `accessibility/` catalog) AND public-accommodation status — each failure compounds litigation exposure
- E-commerce site processing payments without WCAG conformance — heightened risk because the WCAG-AA failures intersect with consumer-protection class-action standing
- "Accessibility statement" page that disclaims "we strive to be accessible" without specific conformance target (WCAG 2.1 AA) or audit cadence — disclaimers do NOT provide a safe harbor; the site is either accessible or it's not

**Correct pattern**:
- Conformance: pass all A11Y baseline rules in `.aivv/standards/accessibility/` (74 rules per current catalog) — these encode WCAG 2.1 AA + COGA + ARIA APG baseline.
- Accessibility statement: publish a per-page-section conformance commitment, audit cadence (typically annual), and direct contact for accessibility issues (e.g., `accessibility@example.com`).
- Audit: annual third-party WCAG 2.1 AA audit + remediation OR documented in-house audit by qualified accessibility specialist + axe-core / Lighthouse / WAVE automated scan in CI.
- Remediation SLA: respond to user-reported accessibility issues within a defined timeframe (typically 30 days for non-critical, 7 days for blocking issues).

**Quick-fix hint**: Run an `axe-core` / Lighthouse accessibility audit on the production site. Cross-reference findings against the A11Y baseline rules in `accessibility/`. Prioritize fixes by severity (CRITICAL > MAJOR > MINOR). Publish an accessibility statement linking to your conformance target + audit cadence + contact. Document any known issues with remediation timelines — proactive disclosure is more defensible than discovered-by-plaintiff issues.

**Consult counsel**: Title III website-accessibility lawsuits are jurisdiction-sensitive. Counsel familiar with ADA Title III litigation (NY, FL, CA, PA plaintiff firms) can advise on (a) whether your specific business model triggers public-accommodation status, (b) the safe-harbor effect of documented remediation efforts, (c) accessibility-statement language that minimizes admissions of non-conformance, (d) demand-letter response strategy.

**See also**: **A11Y-001..074** (`accessibility/`) — the AIVV A11Y baseline catalog encodes WCAG 2.1 AA + COGA + ARIA APG conformance; COMP-LEGAL-06 makes that conformance an explicit legal-risk axis. A WCAG-AA-conformant site (passing the A11Y baseline) substantially reduces Title III lawsuit exposure but does NOT eliminate it (plaintiffs can still claim functional inaccessibility). **COMP-WCAG-AAA-01..15** (this file's `wcag-aaa.md` sibling) — AAA conformance exceeds Title III's practical baseline; AAA findings under COMP-WCAG-AAA-* are MINOR by default but escalate to MAJOR/CRITICAL when the project's stated target is AAA conformance.

---

### COMP-LEGAL-07: Section 508 — US federal procurement accessibility minimum (revised 2018, WCAG 2.0 AA)

**Severity**: CRITICAL
**Authority**: Section 508 of the Rehabilitation Act of 1973 (29 U.S.C. §794d), as amended by the Workforce Investment Act of 1998; Section 508 Refresh Final Rule (Jan 2017 / effective Jan 2018, "ICT Final Rule") which adopts WCAG 2.0 Level A and AA as the technical standard for electronic content
**Source**: https://www.section508.gov/manage/laws-and-policies/ + https://www.access-board.gov/ict/

**The rule**: ICT (Information and Communications Technology) procured, developed, maintained, or used by US federal agencies — including websites, web applications, software, electronic documents, multimedia — must conform to WCAG 2.0 Level A and AA per the Section 508 Refresh. This applies to (a) software running on federal infrastructure, (b) web applications federal employees use to perform their jobs (HR systems, productivity tools, agency-internal apps), (c) software sold to federal agencies via GSA schedules or direct procurement, (d) federally-funded research / education / state-program tools where federal funding triggers federal accessibility requirements. Conformance is documented via VPAT (Voluntary Product Accessibility Template), now in version 2.5 — the standard accessibility-conformance disclosure required during federal procurement.

**Code patterns to flag**:
- B2G (business-to-government) software product without a documented VPAT 2.5 (or successor template) covering WCAG 2.0 AA conformance
- Federal-customer-facing application that fails the A11Y baseline catalog (which encodes WCAG 2.1 AA — superset of Section 508's 2.0 AA target)
- VPAT documenting "supports" or "supports with exceptions" for WCAG criteria that the A11Y baseline catalog detects as defective
- US Federal Government RFP response that claims Section 508 conformance without a backing VPAT + audit cadence

**Quick-fix hint**: For B2G products, maintain a current VPAT (template at https://www.itic.org/policy/accessibility/vpat). Run an axe-core / Lighthouse audit; cross-reference against WCAG 2.0 AA (a subset of WCAG 2.1 AA covered by A11Y baseline). Document conformance status per success criterion; mark "Does Not Support" where defects exist + provide remediation timeline. Refresh annually.

**Consult counsel**: Section 508 compliance is jurisdiction-specific to US federal procurement. Counsel familiar with federal-acquisition regulations (FAR Subpart 39.2) can advise on (a) VPAT requirements per agency, (b) Buy Accessible Wizard tool use, (c) the safe-harbor effect of documented good-faith remediation efforts, (d) state-level analogs (California Government Code §11135, Texas Government Code §2054.451 — state-level Section 508 parallels).

**See also**: **COMP-LEGAL-06** (this file, "ADA Title III — public-accommodation digital accessibility") — Section 508 applies to federal-procurement context; ADA Title III applies to private public-accommodation context. The same WCAG-AA conformance work substantially satisfies both — Section 508 cites WCAG 2.0 AA, Title III's practical baseline is WCAG 2.1 AA, and AIVV's A11Y catalog encodes the 2.1 AA superset. **A11Y-001..074** (`accessibility/`) — same baseline conformance applies; documented conformance to the A11Y baseline supports both COMP-LEGAL-06 + COMP-LEGAL-07 simultaneously.

---

### COMP-LEGAL-08: GDPR Article 20 — provide data portability mechanism (structured, machine-readable export)

**Severity**: CRITICAL
**Authority**: EU GDPR Regulation (EU) 2016/679, Article 20 ("Right to data portability")
**Source**: https://gdpr-info.eu/art-20-gdpr/ — verbatim Article 20(1): "The data subject shall have the right to receive the personal data concerning him or her, which he or she has provided to a controller, in a structured, commonly used and machine-readable format and have the right to transmit those data to another controller without hindrance from the controller to which the personal data have been provided, where: (a) the processing is based on consent pursuant to point (a) of Article 6(1) or point (a) of Article 9(2) or on a contract pursuant to point (b) of Article 6(1); and (b) the processing is carried out by automated means." Verbatim Article 20(2): "In exercising his or her right to data portability pursuant to paragraph 1, the data subject shall have the right to have the personal data transmitted directly from one controller to another, where technically feasible."

**The rule**: Data subjects have the right under GDPR Article 20 to receive personal data they have provided to a controller in a "structured, commonly used and machine-readable format", AND to transmit those data to another controller without hindrance — provided processing is based on consent (Art 6(1)(a) / Art 9(2)(a)) OR on a contract (Art 6(1)(b)) AND is carried out by automated means. The controller MUST provide a self-service export mechanism — typically a "Download my data" / "Export account data" button in account settings — that produces a complete, structured, downloadable archive (JSON, CSV, XML — NOT a screenshot, NOT a PDF report) of the user's data. Format must be reusable (JSON is the safer choice). Where technically feasible, the controller must support direct controller-to-controller transmission upon request.

**Code patterns to flag**:
- Account-settings page lacking a "Download my data" / "Export account data" path
- Export mechanism that produces only PDF reports or screenshots (not structured/machine-readable)
- Export that only includes user-visible profile fields, missing the broader scope of "personal data provided by the data subject" (which can include uploaded content, behavioral data the user originated, comments/messages they authored)
- Export-request flow routed to customer-service with manual processing (acceptable for backup; primary path should be self-service per "without hindrance")
- Export mechanism producing data without documented schema (the receiving controller cannot reuse arbitrary undocumented JSON shapes)

**Quick-fix hint**: Provide an in-app "Download my data" button in account settings. Produce JSON (preferred) or CSV/XML archive containing the user's personal data: profile fields, uploaded content, user-authored comments/messages, behavioral data the user originated (NOT derived analytics — Article 20 applies to data the user "provided"). Document the export schema for receiving-controller reuse.

**Consult counsel**: Article 20 scope ("data provided by the data subject") is narrower than Article 15 (right of access). Determine what counts as "provided" vs. "observed" vs. "derived" with counsel — the export scope is jurisdiction- + interpretation-specific.

**See also**: **COMP-LEGAL-02** (this file, "GDPR Article 17 — provide a working 'right to erasure' mechanism") — sibling data-subject right; account-settings UI typically composes both: "Download my data" (Art 20) + "Delete my account" (Art 17) as adjacent options. **COMP-LEGAL-01** (this file, "GDPR Article 13 — disclose required information at point of data collection") — Article 13 disclosure must inform users of their Article 20 right; the existence of an export mechanism is part of the disclosure that's required at collection time.

---

### COMP-LEGAL-09: EU Accessibility Act 2025 — accessibility requirements for in-scope products + services (effective June 28 2025)

**Severity**: CRITICAL
**Authority**: EU Directive 2019/882 ("European Accessibility Act" / EAA), in-force date June 28, 2025 (national-law transposition deadline June 28, 2022; enforcement begins June 28, 2025)
**Source**: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L0882 (Directive 2019/882 official text)

**The rule**: The EU Accessibility Act applies to products and services placed on the EU market from June 28, 2025 onward in the following in-scope categories: (a) consumer general-purpose computer hardware + operating systems; (b) self-service terminals (ATMs, ticketing, check-in); (c) consumer terminal equipment with interactive computing for electronic communications services (smartphones, etc.); (d) e-readers; (e) consumer terminal equipment with interactive computing for accessing audiovisual media services (smart TVs, set-top boxes); (f) **e-commerce services** (websites, mobile apps offering online retail); (g) banking services for consumers; (h) e-books; (i) electronic communications services; (j) audiovisual media services. Affected services must meet the accessibility requirements in Annex I of the Directive — broadly aligning with WCAG 2.1 AA (the European harmonized standard EN 301 549 specifies the technical baseline). Micro-enterprises (< 10 employees + < €2M turnover) providing services are EXEMPT but recommended to comply. Products from micro-enterprises are NOT exempt.

**Code patterns to flag**:
- B2C e-commerce service serving EU users without documented EN 301 549 / WCAG 2.1 AA conformance, post-June 28 2025
- Banking app or web frontend serving EU consumers without accessibility conformance documentation
- E-reader / EPUB-reader app or web component without accessibility metadata + reading-mode features (TTS support, navigation, font size, contrast)
- Consumer-electronics manufacturer's marketing/support websites lacking accessibility statement + EN 301 549 conformance for in-scope product categories
- Smart-TV or audiovisual-media app lacking required accessibility features (captions display, audio description support, subtitle controls)

**Quick-fix hint**: For EU-market e-commerce, banking, e-books, or audiovisual-media services, document EN 301 549 / WCAG 2.1 AA conformance. Publish an accessibility statement per the directive's transparency requirements. The A11Y baseline catalog substantially covers the technical requirements; supplement with category-specific Annex I requirements (e.g., e-books need TTS support + EPUB 3 accessibility metadata).

**Consult counsel**: National-law transposition varies across EU Member States — penalties + enforcement bodies differ. Counsel familiar with the specific Member State's implementing law (e.g., Germany BFSG, France LRAPS-extension, Spain Real Decreto) can advise on (a) Member-State-specific scoping + exemptions, (b) the conformity-assessment + market-surveillance procedure, (c) labeling + accessibility statement requirements per Member State.

**See also**: **COMP-LEGAL-06** (this file, "ADA Title III — public-accommodation digital accessibility") — sibling jurisdictional accessibility-lawsuit-risk rule; EU EAA + US ADA together cover the major Western-jurisdiction accessibility-lawsuit exposures for international consumer-facing services. **A11Y-001..074** (`accessibility/`) — the A11Y baseline catalog covers most EN 301 549 requirements (which is itself harmonized with WCAG 2.1 AA); supplement with category-specific Annex I requirements per service type.
