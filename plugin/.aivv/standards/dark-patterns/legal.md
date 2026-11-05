# Dark Patterns — Legal-risk subset (L1 forced-show, context-gated legal floor) (DP-LEGAL-01..13)

Part of [.aivv/standards/dark-patterns/](README.md).

These rules carry **L1 source class** — direct citation to FTC enforcement, EU DSA Article 25, or GDPR articles. They are forced-shown by the L1 detection regex in `/aivv` Step 6 output regardless of `severity_threshold` configuration. Apply the CRITICAL/DISPOSITION floor when Project Context makes the cited authority applicable, or when applicability is undeclared and the pattern plausibly falls inside that authority; declared-inapplicable context renders as a context note / POLISH or lower-priority DISPOSITION rather than borrowing the hard legal floor.

### DP-LEGAL-01: FTC Negative Option Rule — easy cancellation

**Severity**: CRITICAL
**Rationale**: The FTC Negative Option Rule (under "Click to Cancel" enforcement) requires cancellation be at least as easy as signup. Violations carry monetary penalties.
**Source**: FTC Negative Option Rule — https://www.ftc.gov/legal-library/browse/rules/negative-option-rule

**The rule**: subscription cancellation must be available in the same channel and with at least the same ease as signup. (Compliance variant of DP-SUB-01.)

**Code patterns to flag**:
- Web signup + no web cancel path
- "Call to cancel" requirement when signup was self-service
- Cancel flow with >2× the steps of signup flow

**Correct pattern**: symmetric signup / cancel channel + ease; documented cancellation flow.

**Quick-fix hint**: compare signup vs cancel flows for channel + click parity.

**See also**: **COMP-LEGAL-02** (`compliance/legal-risk.md`, "GDPR Article 17 — provide a working 'right to erasure' mechanism") — DP-LEGAL-01 covers the *FTC cancellation-friction* axis (US authority); COMP-LEGAL-02 covers the *GDPR erasure-mechanism-presence* axis (EU/UK authority). A "Delete account requires phone call" pattern triggers both regulatory regimes simultaneously.

---

### DP-LEGAL-02: FTC Channel-Asymmetric Cancellation

**Severity**: CRITICAL
**Rationale**: FTC enforcement has specifically targeted services that require phone-cancellation after online-signup. Direct enforcement risk.
**Source**: FTC Negative Option Rule — https://www.ftc.gov/legal-library/browse/rules/negative-option-rule

**The rule**: in-channel cancellation is mandatory for all subscription types under FTC jurisdiction. (Compliance variant of DP-SUB-04.)

**Code patterns to flag**:
- Cancel-account UI that opens a `tel:` link
- "Please email cancel@example.com" without in-app cancel option

**Correct pattern**: in-app cancel button that performs the cancellation.

**Quick-fix hint**: cancel flow — verify in-channel completion.

**See also**: **COMP-LEGAL-02** (`compliance/legal-risk.md`, "GDPR Article 17 — provide a working 'right to erasure' mechanism") — DP-LEGAL-02 covers FTC channel-asymmetry (US); COMP-LEGAL-02 covers GDPR Article 17's "without undue delay" erasure mechanism requirement (EU/UK). Phone-only cancellation flows fail BOTH regulatory regimes.

---

### DP-LEGAL-03: FTC Misrepresentation of Pricing

**Severity**: CRITICAL
**Rationale**: FTC enforces against pricing misrepresentations — hidden fees, fake discounts, drip pricing — across multiple enforcement actions.
**Source**: FTC Online Advertising — https://www.ftc.gov/business-guidance/advertising-marketing/online-advertising-marketing

**The rule**: total price (including mandatory fees, taxes where displayable) shown with the same prominence as the headline price.

**Code patterns to flag**:
- Hidden mandatory fees added at last step (DP-PRICE-01 compliance variant)
- Fictitious anchor pricing (DP-PRICE-03 compliance variant)

**Correct pattern**: total-with-fees price disclosed prominently at every step.

**Quick-fix hint**: pricing-display chain — verify total-inclusive at all steps.

---

### DP-LEGAL-04: FTC Trial-to-Paid Disclosure

**Severity**: CRITICAL
**Rationale**: The FTC has enforced specific disclosure requirements for free-trial-to-paid conversions, particularly under the Negative Option Rule.
**Source**: FTC Negative Option Rule — https://www.ftc.gov/legal-library/browse/rules/negative-option-rule

**The rule**: trial-to-paid conversion requires clear, conspicuous, advance disclosure (post-trial price + cadence) at point of sale AND pre-conversion reminder.

**Code patterns to flag**:
- Trial signup without post-trial price disclosed at same prominence (DP-PRICE-08 compliance variant)
- Silent trial-to-paid conversion (DP-SUB-06 compliance variant)

**Correct pattern**: prominent disclosure at signup + pre-conversion reminder ≥ 3 days before charge.

**Quick-fix hint**: trial signup + trial-end notification scheduler — verify both.

---

### DP-LEGAL-05: GDPR Article 7 — Active Consent

**Severity**: CRITICAL
**Rationale**: GDPR Article 7 requires consent to be active, unambiguous, freely given, and as easy to withdraw as to give. Violations carry up to 4% global revenue penalties.
**Source**: GDPR Article 7 — https://gdpr-info.eu/art-7-gdpr/

**The rule**: consent flows in the EU (or where GDPR applies) meet Article 7 standards — opt-in, not opt-out; freely given; revocable.

**Code patterns to flag**:
- Pre-checked consent boxes (DP-SUB-05, DP-CONSENT-01 compliance variants)
- Bundled consent (DP-CONSENT-10 compliance variant)
- Withdrawal harder than signup (DP-CONSENT-09 compliance variant)

**Correct pattern**: all consent flows symmetric, active opt-in, revocable.

**Quick-fix hint**: consent forms — verify Article 7 conformance.

**See also**: **COMP-LEGAL-01** (`compliance/legal-risk.md`, "GDPR Article 13 — disclose required information at point of data collection") — DP-LEGAL-05 covers the consent-mechanism manipulation axis (pre-checked, bundled, asymmetric); COMP-LEGAL-01 covers the disclosure-presence axis. When legal basis IS consent (per Article 6(1)(a)), both rules apply: DP-LEGAL-05 enforces the consent's quality (active, freely given); COMP-LEGAL-01 enforces the surrounding Article 13 disclosure that contextualizes the consent.

---

### DP-LEGAL-06: GDPR Cookie Consent

**Severity**: CRITICAL
**Rationale**: EU cookie-consent requirements (under ePrivacy + GDPR) prohibit pre-checked non-essential cookies, asymmetric Accept/Reject UX, and tracking-before-consent.
**Source**: GDPR Cookies — https://gdpr.eu/cookies/

**The rule**: cookie consent meets GDPR / ePrivacy standards. (Compliance variant of DP-CONSENT-01.)

**Code patterns to flag**:
- Non-essential cookies pre-checked (DP-CONSENT-01)
- Tracking scripts before consent (DP-CONSENT-08)
- "Necessary" misclassification (DP-CONSENT-03)

**Correct pattern**: GDPR-compliant consent banner with symmetric controls + consent-gated tracking.

**Quick-fix hint**: cookie-consent system — full GDPR audit.

**See also**: **COMP-LEGAL-03** (`compliance/legal-risk.md`, "CCPA / CPRA — provide a 'Do Not Sell or Share My Personal Information' link") — adjacent cross-jurisdiction consent-mechanism rule (US CCPA/CPRA opt-out vs EU GDPR cookie opt-in). Both apply to businesses serving both jurisdictions; the technical implementation (consent banner + suppression flag + downstream-tracking gating) is shared infrastructure across both rules.

---

### DP-LEGAL-07: EU DSA Article 25 — Online Interface Design

**Severity**: CRITICAL
**Rationale**: EU Digital Services Act Article 25 explicitly prohibits "dark patterns" — manipulative interface designs that deceive or impair user decisions. Direct DSA enforcement risk for online platforms serving EU users.
**Source**: EU DSA Article 25 — Regulation (EU) 2022/2065 (full text via EUR-Lex CELEX): https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065 — Article 25 is the binding provision; EUR-Lex's ELI URI scheme does not support direct article fragments, so the citation lands at the regulation level. Navigate to Article 25 via the document's section index.

**The rule**: online interface designs do not deceive or manipulate users into decisions that impair their autonomy. (Catch-all compliance variant for the dark-patterns category.)

**Code patterns to flag**:
- Asymmetric Accept/Reject prominence (DP-CONSENT-02)
- Confirmshaming on critical-path decisions (DP-CONSENT-06)
- Misdirected UI cues steering toward profitable outcomes (e.g., DP-PRICE-04)

**Correct pattern**: design choices documented as decision-neutral; A/B tests reviewed for DSA Article 25 compliance.

**Quick-fix hint**: review critical-path decision surfaces for DSA Article 25 conformance.

---

### DP-LEGAL-08: GDPR Article 13 — Transparency at Collection

**Severity**: CRITICAL
**Rationale**: GDPR Article 13 requires data-collection transparency at the point of collection — what data, who controls it, retention period, rights.
**Source**: GDPR Article 13 — https://gdpr-info.eu/art-13-gdpr/

**The rule**: consent surface (or any data-collection point) links to privacy policy or surfaces equivalent transparency information. (Compliance variant of DP-CONSENT-07.)

**Code patterns to flag**:
- Forms collecting personal data without privacy-link adjacent
- Cookie banner without privacy-policy link at first level

**Correct pattern**: privacy-policy link at every data-collection surface.

**Quick-fix hint**: data-collection forms — verify privacy-link presence.

**See also**: **COMP-LEGAL-01** (`compliance/legal-risk.md`, "GDPR Article 13 — disclose required information at point of data collection") — DP-LEGAL-08 covers the *behavioral-manipulation* facet of Article 13 violations (manipulative privacy-notice presentation, "ugly notice next to attractive marketing copy"); COMP-LEGAL-01 covers the *disclosure-mechanism-presence* facet (is the required information disclosed at all, in the right place, before collection). The two rules are complementary axes on the same Article 13 surface.

---

### DP-LEGAL-09: GDPR Article 7(3) — Withdrawal as Easy as Consent

**Severity**: CRITICAL
**Rationale**: Article 7(3) explicitly requires withdrawal of consent be "as easy" as giving it. Multi-click withdrawal flows after single-click consent are direct violations.
**Source**: GDPR Article 7 — https://gdpr-info.eu/art-7-gdpr/

**The rule**: withdrawal-of-consent flow has equal or lower click depth than consent flow. (Compliance variant of DP-CONSENT-09.)

**Code patterns to flag**:
- Single-click "Accept all" + multi-step withdrawal
- Withdrawal requires email or phone when consent was in-app

**Correct pattern**: symmetric click-depth; in-channel withdrawal.

**Quick-fix hint**: compare consent-flow vs withdrawal-flow step count.

**See also**: **COMP-LEGAL-02** (`compliance/legal-risk.md`, "GDPR Article 17 — provide a working 'right to erasure' mechanism") — DP-LEGAL-09 covers GDPR Article 7(3) consent-withdrawal (stops FUTURE processing); COMP-LEGAL-02 covers GDPR Article 17 right-to-erasure (deletes PAST data). The two rights are distinct but complementary — a user wanting to fully sever the data relationship needs both withdrawal (stops new collection) and erasure (deletes existing records). Both rules apply.

---

### DP-LEGAL-10: FTC Endorsement Guides — Sponsored Disclosure

**Severity**: CRITICAL
**Rationale**: FTC Endorsement Guides require clear disclosure of paid endorsements, sponsorships, and incentivized reviews. Enforcement against both platforms and creators.
**Source**: FTC Endorsements — https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews

**The rule**: sponsored content and paid endorsements carry visible disclosure at the same prominence as the content itself. (Compliance variant of DP-SOCIAL-01.)

**Code patterns to flag**:
- Sponsored content without `<Badge>Sponsored</Badge>` rendering
- Incentivized reviews displayed identically to organic reviews

**Correct pattern**: clear, persistent, visible disclosure badges.

**Quick-fix hint**: sponsored-content components — verify disclosure rendering.

**See also**: **COMP-LEGAL-04** (`compliance/legal-risk.md`, "FTC Endorsement Guides — disclose material connections clearly + conspicuously") — DP-LEGAL-10 covers the *manipulation* facet (sponsored content adopting organic visual treatment to deceive); COMP-LEGAL-04 covers the *disclosure-presence + placement* facet (is the disclosure present, in the same medium, before the endorsement content). Both rules apply: DP-LEGAL-10 triggers when disclosure is technically present but visually de-emphasized; COMP-LEGAL-04 triggers when disclosure is absent OR buried (end of long caption, expandable-only platform indicator).

---

### DP-LEGAL-11: FTC Green Guides — Environmental Claims

**Severity**: CRITICAL
**Rationale**: FTC Green Guides prohibit unqualified environmental claims without specific, verifiable backing.
**Source**: FTC Environmental Marketing — https://www.ftc.gov/business-guidance/advertising-marketing/environmental-marketing

**The rule**: environmental claims ("eco-friendly", "biodegradable", "recyclable", "carbon-neutral") meet Green Guides specificity requirements. (Compliance variant of DP-PR-01.)

**Code patterns to flag**:
- Generic "eco-friendly" badge without specific qualification
- "Carbon neutral" without offset / certification documentation

**Correct pattern**: specific, qualified, verifiable environmental claims.

**Quick-fix hint**: environmental-claim badges — verify specificity + backing.

---

### DP-LEGAL-12: FTC Health Claims Disclosure

**Severity**: CRITICAL
**Rationale**: Health-related claims (efficacy, treatment, prevention) carry FTC + FDA enforcement risk; "supports immunity" / "boosts metabolism" without backing is enforceable.
**Source**: FTC Health Claims — https://www.ftc.gov/business-guidance/advertising-marketing/health-claims

**The rule**: health claims tied to scientific evidence; disclaimers visible; FDA-cleared device claims marked accurately.

**Code patterns to flag**:
- Product copy claiming "treats" / "cures" without evidence
- Wellness app claiming clinical efficacy without trial data
- "Doctor-recommended" without sourced recommendation

**Correct pattern**: claims tied to evidence; disclaimers prominent.

**Quick-fix hint**: health / wellness product copy — verify evidence backing.

---

### DP-LEGAL-13: State-Level UDAP / "All Consumers Act" Patterns

**Severity**: CRITICAL
**Rationale**: US state-level Unfair and Deceptive Acts or Practices (UDAP) statutes (California's UCL, NY's GBL §349, etc.) capture dark patterns even when no specific federal rule applies. EU member-state implementations of DSA add jurisdiction-specific dark-pattern enforcement.
**Source**: FTC Legal Library — https://www.ftc.gov/legal-library/browse/rules

**The rule**: review dark-pattern exposure against state-level UDAP statutes in operating jurisdictions; what's allowed federally may still be enforceable at state level.

**Code patterns to flag**:
- Any DP-* pattern in a jurisdiction with active UDAP enforcement (CA, NY, IL, MA)
- Marketing copy targeted to CA users with pre-existing California-specific UDAP rulings

**Correct pattern**: jurisdiction-aware compliance review for dark-pattern surfaces.

**Quick-fix hint**: review dark-pattern surfaces against operating-jurisdiction legal exposure.

**See also**: **COMP-LEGAL-05** (`compliance/legal-risk.md`, "Children's privacy — verifiable parental consent for users below the consent-age threshold") — DP-LEGAL-13's "State-Level UDAP / 'All Consumers Act' Patterns" scope explicitly covers state-level "Age Appropriate Design" Acts (California AB-2273, Maryland HB-901) extending children's-privacy protections to age 17 beyond COPPA's 13-and-under scope; COMP-LEGAL-05 covers the federal COPPA + EU GDPR Article 8 baseline. The two rules compose: DP-LEGAL-13 catches state-jurisdiction UDAP exposure beyond federal floor; COMP-LEGAL-05 ensures the federal/EU baseline is met first.
