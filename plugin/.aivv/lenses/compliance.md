---
name: compliance
description: Regulatory + accessibility-conformance + legal-risk review lens — WCAG 2.1 AAA realistic subset, full ARIA APG widget conformance, FTC + GDPR + CCPA/CPRA + COPPA + ADA + Section 508 + EU EAA legal-risk subset
calibration_lens: compliance
applies_to: source code touching WCAG-AAA-relevant surfaces, ARIA-widget implementations, legal-risk surfaces (cookie consent, account deletion, age verification, marketing copy, opt-out flows, payment forms)
detect_paths: "**/*consent*, **/*cookie*, **/*gdpr*, **/*ccpa*, **/*privacy*, **/*terms*, **/*tracking*, **/*analytics*, **/*.tsx, **/*.jsx, **/*.vue, **/*.svelte, **/*.html"
detect_keywords: "accessibility, wcag, aria, compliance, gdpr, ccpa, consent, privacy, cookie, legal, screen reader, a11y"
detect_high_risk: true
high_risk_paths: "**/*consent*, **/*gdpr*, **/*ccpa*, **/*privacy*, **/*cookie*, **/*terms*, **/*pii*, **/*personal*, **/*tracking*, **/*dsar*, **/*data-deletion*"
runtime_driver: none
---

> ⚠️ **NOT LEGAL ADVICE.** AIVV identifies code patterns that correlate with documented regulatory enforcement actions or accessibility conformance criteria. AIVV does NOT determine legal applicability to a specific business, jurisdiction, or fact pattern. **Consult qualified counsel before relying on AIVV compliance findings for any production deployment or external commitment.** The `compliance` lens surfaces patterns; counsel determines whether and how each pattern applies to the project under review.

## Focus

Apply these review concerns **in addition to** the universal Phase 2 VERIFY rules. The compliance lens extends code review with regulatory, accessibility-conformance, and legal-risk concerns code-observable without running the app.

### WCAG 2.1 AAA realistic subset (see `.aivv/standards/compliance/wcag-aaa.md`)

AAA conformance is opt-in beyond AA-baseline (which is covered by the `visual` lens via `accessibility/`). The 15 COMP-WCAG-AAA-* rules surface code-observable AAA criteria most commonly project-targeted:

- COMP-WCAG-AAA-01 Contrast Enhanced (7:1 for normal text, 4.5:1 for large text)
- COMP-WCAG-AAA-02 Visual Presentation (5-sub-req: line-spacing, paragraph-spacing, letter/word-spacing, line-length ≤ 80 chars, justification, foreground/background user-selectable)
- COMP-WCAG-AAA-03 Images of Text No Exception
- COMP-WCAG-AAA-04 Keyboard No Exception
- COMP-WCAG-AAA-05 No Timing
- COMP-WCAG-AAA-06 Three Flashes (general flash threshold)
- COMP-WCAG-AAA-07 Identify Purpose (input purpose + region/landmark purpose)
- COMP-WCAG-AAA-08 Re-authenticating data preservation
- COMP-WCAG-AAA-09 Location (breadcrumbs/site-map for multi-page processes)
- COMP-WCAG-AAA-10 Link Purpose Link Only
- COMP-WCAG-AAA-11 Change on Request (no auto-context-change without explicit user action)
- COMP-WCAG-AAA-12 Error Prevention All (legal/financial/data-modification: review + confirm + reverse)
- COMP-WCAG-AAA-13 Help (context-sensitive help available)
- COMP-WCAG-AAA-14 Section Headings
- COMP-WCAG-AAA-15 Timeouts (warning + extension required)

**Default severity:** MINOR. Escalate to MAJOR when project declares AAA conformance as a target (per project's accessibility statement or contract requirement).

### Full ARIA APG widget conformance (see `.aivv/standards/compliance/aria-apg-full.md`)

The 15 COMP-APG-* rules cover full conformance to ARIA Authoring Practices Guide (APG) patterns where the `visual` lens's A11Y-045..060 baseline subset is not sufficient. Full-conformance applies when project declares ARIA APG conformance OR when implementing the widget at production-quality level (custom date picker, complex grid, treegrid, multi-thumb slider, listbox with virtual focus, etc.):

- COMP-APG-01 Carousel
- COMP-APG-02 Checkbox tri-state (mixed)
- COMP-APG-03 Combobox (4 aria-autocomplete variants + virtual focus)
- COMP-APG-04 Feed
- COMP-APG-05 Grid (cell navigation + virtualization + cell-edit mode)
- COMP-APG-06 Spinbutton
- COMP-APG-07 Date Picker Dialog (composes Dialog + Grid)
- COMP-APG-08 Multi-thumb Slider
- COMP-APG-09 Treegrid (composes Grid + Tree expand/collapse)
- COMP-APG-10 Meter (NOT progress)
- COMP-APG-11 Window Splitter
- COMP-APG-12 Tabs full keyboard (automatic-vs-manual activation choice)
- COMP-APG-13 Listbox virtual focus
- COMP-APG-14 Dialog initial-focus decision tree
- COMP-APG-15 Table interactive sorting

**Default severity:** MAJOR. APG conformance is part of WCAG 4.1.2 Name/Role/Value when ARIA roles are used — code shipping `role="<APG-pattern>"` without conforming to the APG keyboard + state-management requirements is a compliance defect.

### Regulatory + statutory legal-risk subset (see `.aivv/standards/compliance/legal-risk.md`)

The 9 COMP-LEGAL-* rules cover L1 source-class patterns from primary statute, regulation, or regulator guidance. **Default handling:** forced-show always; CRITICAL/DISPOSITION floor only when declared or plausibly undeclared Project Context makes the cited authority applicable. If declared `project_context` makes the cited authority inapplicable, render the L1 citation as a context note / POLISH or lower-priority DISPOSITION rather than applying the hard-statute floor. Per-rule "Consult counsel" notes are mandatory inline.

- COMP-LEGAL-01 GDPR Article 13 (Information at Collection)
- COMP-LEGAL-02 GDPR Article 17 (Right to Erasure / Right to be Forgotten)
- COMP-LEGAL-03 CCPA/CPRA Do-Not-Sell-Or-Share-My-PI link + clear-and-conspicuous
- COMP-LEGAL-04 FTC Endorsement Guides 16 CFR Part 255 §255.5 (Material Connection Disclosure)
- COMP-LEGAL-05 Children's Privacy (COPPA + GDPR Article 8 + UK ICO AADC)
- COMP-LEGAL-06 ADA Title III (WCAG 2.1 AA practical baseline; range-cite to entire `accessibility/` catalog)
- COMP-LEGAL-07 Section 508 (US federal procurement + VPAT 2.5)
- COMP-LEGAL-08 GDPR Article 20 (Data Portability)
- COMP-LEGAL-09 EU Accessibility Act 2019/882 (in-force 2025-06-28)

**Code patterns to flag — common across LEGAL rules:**
- Cookie consent banner that auto-accepts on page-load without user interaction (GDPR violation)
- "Sign Up" button that creates account without explicit consent checkbox for terms/privacy
- Affiliate link, sponsored content, or paid endorsement without disclosure (FTC violation)
- Age-gate that accepts a clicked "I am 13+" without verification when service collects PII (COPPA violation)
- "Delete my account" UX that requires email-to-support rather than self-service deletion (GDPR Art 17 friction)
- Personal data export that returns unstructured PDF rather than machine-readable JSON/CSV (GDPR Art 20)
- E-commerce checkout in EU market without screen-reader-accessible form-control labels (EU EAA violation post-2025-06-28)

## Severity anchors

When `severity_model: impact_likelihood` is active, use these anchors for compliance accessibility-conformance findings (WCAG AAA and ARIA APG). In legacy mode, treat them as reviewer reasoning guidance, not an override of the configured shared severity model. Legal-risk COMP-LEGAL-* findings keep the context-gated policy in the section above; do not force GDPR/FTC/COPPA findings into the accessibility task-blocking taxonomy.

### IMPACT: accessibility task-blocking harm

- **CATASTROPHIC** — prevents completion of a legal, financial, health, safety, account-access, or data-modification task for a protected user group, with no equivalent accessible path.
- **SEVERE** — blocks or substantially degrades a primary task, custom widget, form, dialog, or navigation path for keyboard or assistive-technology users.
- **MODERATE** — creates recoverable friction, extra steps, confusing state, or partial loss of semantics while the user can still complete the task.
- **NEGLIGIBLE** — conformance or advisory mismatch with no current task impact, cosmetic accessibility-adjacent issue, or AAA/APG uplift that is not a declared target and does not weaken baseline access.

### LIKELIHOOD: where users encounter it

- **CERTAIN** — present on every page load or on a required primary flow.
- **PROBABLE** — present in a common flow, common viewport/state, or production widget pattern.
- **POSSIBLE** — present only in a less common role, optional workflow, error state, breakpoint, or specific assistive-technology path.
- **UNLIKELY** — unreachable/dead code, disabled feature, test-only fixture, or context that declared project scope makes inapplicable.

Runtime axe-core evidence remains deterministic when available: preserve RTV-AXE-02's mapping (`critical` -> CRITICAL, `serious` -> MAJOR, `moderate` -> MINOR, `minor` -> POLISH). In static review, use task-blocking impact as the analogy; do not claim axe-core data unless runtime evidence exists.

## Trigger patterns (flag these explicitly)

These patterns produce findings that must be rendered. Apply the hard-statute CRITICAL/DISPOSITION floor when `project_context` makes the cited authority applicable, or when context is undeclared and the code pattern plausibly falls inside that authority. If declared context makes the authority inapplicable, render a context note / POLISH or lower-priority DISPOSITION instead of the legal floor:

- Cookie consent that pre-checks marketing/analytics options
- Subscription cancellation flow with materially more steps than the signup flow (FTC Negative Option Rule + dark-pattern DP-LEGAL-01 also fires)
- Hardcoded "13+" age-gate without subsequent age verification on service collecting child PII
- Account deletion UX requiring email-to-support OR multi-step phone-call confirmation
- Marketing copy with `<a href="...amazon.com/...?tag=...">` affiliate link without `rel="sponsored"` AND without disclosure within the same content view
- Federal-agency public-facing site that fails Section 508 baseline (no `<html lang>`, no skip-links, no alt text)
- Cookie that sets `Set-Cookie: ...; SameSite=None; Secure` for tracking without prior consent

## Standards to consult

- [.aivv/standards/compliance/wcag-aaa.md](../standards/compliance/wcag-aaa.md) — COMP-WCAG-AAA-01..15
- [.aivv/standards/compliance/aria-apg-full.md](../standards/compliance/aria-apg-full.md) — COMP-APG-01..15
- [.aivv/standards/compliance/legal-risk.md](../standards/compliance/legal-risk.md) — COMP-LEGAL-01..09
- [.aivv/standards/accessibility/](../standards/accessibility/) — A11Y baseline (COMP-LEGAL-06 ADA Title III range-cites the entire 74-rule catalog)
- [.aivv/standards/dark-patterns/legal.md](../standards/dark-patterns/legal.md) — DP-LEGAL-01..13 (L1 dark-pattern subset; forced-show, context-gated legal floor)

## L1-source detection

The compliance lens has the highest density of L1-source rules in AIVV's catalog. Per the `skills/aivv-fix/references/polish-and-l1-source-policy.md` L1-source detection regex `^(COMP-LEGAL-|A11Y-|DP-LEGAL-)`, ALL COMP-LEGAL-* findings are forced-shown regardless of `severity_threshold` config. The L1 forced-show is the canonical defense against silent-suppression of legal-risk-class findings. Forced-show does not itself decide applicability: use `project_context.data_classes`, `project_context.jurisdictions`, and `project_context.compliance_targets` to state whether the rule is applicable, inapplicable, or undeclared-context.

## Graceful degradation

The compliance lens operates on static artifacts only — no live regulatory database query, no runtime browser checks, no jurisdictional-IP-detection. If the change set contains no code (pure doc/config change), return zero compliance findings: "Compliance lens: no code in review target; no findings applicable."

If the reviewer encounters jurisdiction-specific compliance frameworks NOT in this lens (HIPAA, PCI-DSS, SOC2, ISO 27001, NIST 800-171, sector-specific finance/healthcare/utilities regs), note them as out-of-lens with: "This change touches {jurisdiction}/{framework}; specialist review beyond AIVV's compliance lens required."

**Counsel-determination boundary:** AIVV cites the regulatory authority + identifies the code pattern. AIVV does NOT determine:
- Whether the project is subject to the cited authority (territorial/sectoral applicability)
- Whether the project qualifies for an exception or safe-harbor
- The remediation that satisfies the cited authority for the project's specific business model
- Whether the regulator would, in fact, enforce in this case

Reviewer prose MUST include the per-rule "Consult counsel" note inline when surfacing COMP-LEGAL-* findings. Do not paraphrase the counsel-determination boundary out of existence.
