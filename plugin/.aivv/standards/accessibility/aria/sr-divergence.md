# Accessibility — Screen-reader divergence rules

Part of [.aivv/standards/accessibility/aria/](README.md) (A11Y-073..074). These patterns address known behavior divergences between NVDA / JAWS / VoiceOver. Each cites the underlying WAI-ARIA spec section + a divergence reference. Per maintainer guidance operating principle 9, divergence claims are grounded in published vendor or WAI documentation.

Added dev.79 = T21 phase 3 (screen-reader divergence component of COGA + SR-divergence cycle).

### A11Y-073: Avoid `role="application"` except for true app-like contexts

**Severity**: MAJOR
**WCAG**: 4.1.2 Level A
**Source**: https://www.w3.org/TR/wai-aria-1.2/#application

**The rule**: Per WAI-ARIA 1.2 §application, some assistive technologies (notably NVDA and JAWS) respond to `role="application"` by switching to a focus/forms-interaction mode that disables their built-in keyboard shortcuts (heading nav, link list, etc.) in favor of the app's own keyboard model. The mode-switching behavior is AT-implementation specific, not strictly normative — but the practical effect on NVDA/JAWS users is well-established. Use `role="application"` ONLY for genuinely application-like UIs that own their entire keyboard model (e.g., a full-screen graphical editor); otherwise it removes AT navigation aids users depend on.

**Code patterns to flag**:
- `<div role="application">` wrapping a normal page (forms, articles, listings)
- `role="application"` on a widget that contains text content, links, or headings users need to navigate (the role suppresses AT's text-navigation mode)
- Documentation-site or marketing-site wrappers using `role="application"` (anti-pattern)
- `role="application"` on a single complex widget (combobox / grid) — narrow to that widget; do NOT scope the role to the whole page

**Correct pattern**: omit `role="application"` for typical apps. Reach for it only when:
- The UI is a genuinely application-like environment (image editor, code editor, game) where AT browse-mode shortcuts would interfere
- The application implements its own complete keyboard navigation
- Falling back to browse mode would produce a worse experience

**Quick-fix hint**: When in doubt, do not use `role="application"`. NVDA and JAWS users have learned to expect default browse-mode navigation; surprising them with focus-mode breaks muscle memory. If a specific widget needs application semantics, scope the role to that widget only.

**Runtime caveat**: actual NVDA/JAWS mode-switching behavior requires runtime testing in those readers; VoiceOver does not have a forms/application mode distinction and treats `role="application"` differently.

---

### A11Y-074: Don't override implicit `aria-live` defaults on `alert`/`status`/`log` roles

**Severity**: MINOR
**WCAG**: 4.1.3 Level AA
**Source**: https://www.w3.org/TR/wai-aria-1.2/#alert (and /#status, /#log)

**The rule**: `role="alert"` has implicit `aria-live="assertive"` + implicit `aria-atomic="true"`; `role="status"` has implicit `aria-live="polite"` + implicit `aria-atomic="true"`; `role="log"` has implicit `aria-live="polite"` + implicit `aria-atomic="false"` (log entries are typically additive, not announced as full-context). Explicit overrides that contradict the role's implicit defaults (`role="alert" aria-live="off"`, `role="status" aria-live="assertive"`) produce inconsistent AT behavior across NVDA/JAWS/VoiceOver — some honor the explicit value, some honor the role default.

**Code patterns to flag**:
- `role="alert" aria-live="off"` (contradiction — alert IS implicit-assertive)
- `role="status" aria-live="assertive"` (over-escalation; if assertive is needed, use `role="alert"`)
- `role="log" aria-live="assertive"` (over-escalation; log is implicit-polite)
- Custom live-region patterns with `aria-live` + a role whose implicit value differs (mixed-signal)

**Correct pattern**:
```html
<!-- transient interruption -->
<div role="alert">Network connection lost.</div>

<!-- non-urgent status -->
<div role="status">Saved.</div>

<!-- continuous append (chat log, console output) -->
<div role="log">…</div>

<!-- if you need bespoke live-region behavior, omit role + use aria-live directly -->
<div aria-live="polite" aria-atomic="false">…</div>
```

**Quick-fix hint**: Pick the role that matches the implicit live-region behavior you want; don't fight the role with explicit `aria-live`. If your case doesn't match any role's implicit default, omit the role and set `aria-live` directly.

**Runtime caveat**: cross-SR divergence in handling mixed role+aria-live signals requires testing in NVDA + JAWS + VoiceOver to confirm consistent behavior.
