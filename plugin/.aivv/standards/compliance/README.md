# Compliance — standards catalog index

Part of [.aivv/standards/](../README.md). The `compliance.md` catalog covers regulatory + legal-risk + AAA-enhancement rules grouped by topical sub-domain. Each subfile carries a contiguous rule-ID range under the `COMP-*` namespace.

**Status:** Shipped.

## Subdomains

| Subfile | Rule-ID range | Rules | Focus |
|---|---|---|---|
| [`wcag-aaa.md`](wcag-aaa.md) | `COMP-WCAG-AAA-01..15` | 15 | WCAG 2.1 Level AAA realistic subset (NOT duplicating AAA SCs already in `accessibility/` like 2.3.3 / 2.4.13 / 2.5.5 / 3.3.9) |
| [`aria-apg-full.md`](aria-apg-full.md) | `COMP-APG-01..15` | 15 | Full ARIA APG widget conformance (NOT duplicating APG patterns already in `accessibility/aria/apg-widgets.md` A11Y-045..060 at minimum-conformance level; extends to additional widgets + enhanced-conformance) |
| [`legal-risk.md`](legal-risk.md) | `COMP-LEGAL-01..09` | 9 | FTC + EU DSA + GDPR + ADA + Section 508 + EU EAA legal-risk rules (companion to `dark-patterns/legal.md` DP-LEGAL-* subset on disclosure/transparency/data-subject-rights axis; rule-ID prefix `COMP-LEGAL-` triggers L1-source forced-show per `skills/aivv-fix/references/polish-and-l1-source-policy.md` canonical detection logic) |

## Severity discipline

- **WCAG AAA rules** default to MINOR severity (escalate to MAJOR when project declares AAA-conformance target). Rationale: AAA conformance is opt-in beyond the regulatory AA baseline.
- **ARIA APG rules** default to MAJOR severity. Rationale: APG patterns are normative for the WAI-ARIA conformance class.
- **Legal-risk rules** are forced-shown regardless of `severity_threshold`. Rationale: legal-risk findings trigger L1-source forced-show per the `^(COMP-LEGAL-|A11Y-|DP-LEGAL-)` regex prefix-match documented at `skills/aivv-fix/references/polish-and-l1-source-policy.md` (canonical home of the L1-source detection logic; result rendering references this policy). The CRITICAL/DISPOSITION floor applies when Project Context makes the cited authority applicable, or when applicability is undeclared and the pattern plausibly falls inside that authority.

## Lens routing

Findings in this catalog route to the `compliance` lens (shipped dev.105 = T45 Wave 2 phase 3). Pre-dev.105 invocations may route them to `code` lens as fallback. The `--full-ui-ux` (T47) + `--full-a11y` (T48) + `--full` (T49) flags will include the `compliance` lens once shipped.

## Legal disclaimer

**AIVV does NOT provide legal advice.** The `legal-risk.md` rules cite enforcement actions, statutory text, and authoritative guidance from FTC / EU DSA / GDPR / ADA / Section 508 sources — but applicability and exemptions are jurisdiction-specific and fact-dependent. Consult qualified counsel for compliance determinations affecting your jurisdiction, market segment, or specific product. The rules here are pattern-detection heuristics, NOT legal conclusions.
