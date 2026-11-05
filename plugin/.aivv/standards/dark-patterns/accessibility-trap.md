# Dark Patterns — Accessibility-as-trap (DP-A11Y-01..06)

Part of [.aivv/standards/dark-patterns/](README.md).

### DP-A11Y-01: Accessibility-overlay widgets claiming WCAG compliance

**Severity**: MAJOR
**Rationale**: Third-party "accessibility overlay" widgets (AccessiBe, UserWay, EqualWeb, etc.) that claim to make sites WCAG-compliant but actually fail to fix structural issues — and often break native assistive-tech behavior. Documented widely by the accessibility community.
**Source**: Overlay Fact Sheet — https://overlayfactsheet.com/

**The rule**: accessibility overlays are not substitutes for native accessibility work; their "WCAG compliant" claims are not endorsed by the assistive-tech community.

**Code patterns to flag**:
- `<script src="https://acsbap.com/..."></script>` / accessiBe.js / userway.js / equalweb.js / audioeye.js
- Banner: "Compliant with WCAG 2.1 AA" tied to an overlay-widget script

**Correct pattern**: native accessibility implementation per `accessibility/` rules; no overlay substitute.

**Quick-fix hint**: search for overlay-widget script tags / domain references.

---

### DP-A11Y-02: "Skip to content" link visually hidden permanently

**Severity**: MAJOR
**Rationale**: A skip-link that's CSS-hidden (`display: none`) instead of visually-hidden-but-focusable defeats its accessibility purpose AND creates a false-compliance signal.
**Source**: WCAG — https://www.w3.org/WAI/standards-guidelines/wcag/

**The rule**: skip-links are visually-hidden via the standard pattern (`clip: rect(0 0 0 0)`) and become visible on focus. Defer-to UX-016 (lives in `ui-ux/navigation.md` per dev.62 retrofit — Provide a skip-link; severity MAJOR).

**Code patterns to flag**:
- `.skip-link { display: none; }`
- Skip-link as a hidden link with no `:focus { ... }` reveal

**Correct pattern**: visually-hidden-on-blur, fully-visible-on-focus pattern.

**Quick-fix hint**: search for `.skip-link` / `[href="#main"]` CSS — verify focus-reveal.

---

### DP-A11Y-03: ARIA-roles used to suppress accessibility warnings

**Severity**: MAJOR
**Rationale**: Adding `role="..."` not to improve semantics but to silence automated-accessibility-checker warnings.
**Source**: deceptive.design — https://www.deceptive.design/types

**The rule**: `role` attributes reflect actual semantic purpose; "we added role X to silence the warning" is the anti-pattern.

**Code patterns to flag**:
- `<div role="main">` on multiple containers (only one `<main>` allowed)
- Custom roles added with comments like "// to satisfy axe"

**Correct pattern**: use native elements (`<main>`, `<nav>`, `<button>`) over ARIA roles; ARIA only when no native equivalent.

**Quick-fix hint**: grep for `role=` attributes; review for "silence the linter" intent.

---

### DP-A11Y-04: Color-contrast falsely claimed via theme metadata

**Severity**: MAJOR
**Rationale**: Components or design tokens labeled "WCAG-AA-contrast" or `wcagAACompliant: true` without runtime contrast verification.
**Source**: WCAG — https://www.w3.org/WAI/standards-guidelines/wcag/

**The rule**: contrast claims are runtime-verified per actual rendered output; design-token labels alone aren't sufficient. Defer-to runtime-visual lens for measurement.

**Code patterns to flag**:
- Theme JSON: `{"primary": "#0066CC", "wcag_aa": true}` without measurement evidence
- Design-system docs claiming AA compliance without contrast audit

**Correct pattern**: contrast audit run at design-token introduction; measurement evidence in tooling.

**Quick-fix hint**: theme / design-token files — verify contrast claims are evidence-backed.

---

### DP-A11Y-05: Auto-translate / TTS as accessibility substitute

**Severity**: MINOR
**Rationale**: Auto-translation widgets or text-to-speech overlays presented as "accessibility features" when they don't address the actual barrier (a deaf user doesn't need TTS).
**Source**: Overlay Fact Sheet — https://overlayfactsheet.com/

**The rule**: accessibility features address specific barriers; TTS / auto-translate are useful additions but don't substitute for proper a11y implementation.

**Code patterns to flag**:
- "Accessibility" menu offering only TTS / translate / font-resize as "compliance"
- Marketing copy framing TTS as WCAG compliance

**Correct pattern**: TTS / translation as additive features; not labeled as compliance substitutes.

**Quick-fix hint**: accessibility-menu component — review feature framing.

---

### DP-A11Y-06: "Disability assistance" gated behind extra steps

**Severity**: MAJOR
**Rationale**: A "Need accessibility help?" path that requires phone-only / chat-only contact for disabled users while abled users use self-service.
**Source**: WCAG — https://www.w3.org/WAI/standards-guidelines/wcag/

**The rule**: support channels are accessible to all users equally; "disability assistance" doesn't gate self-service.

**Code patterns to flag**:
- Support page: "For accessibility issues, please call..."
- Account-recovery flow routing screen-reader users to phone

**Correct pattern**: equal-access support paths.

**Quick-fix hint**: support / help pages — verify channel-symmetric access.
