# Microcopy — Notifications & Toasts

Part of [.aivv/standards/microcopy/](README.md) (MC-033..035).

### MC-033: Toasts auto-dismiss; persistent notifications remain until acknowledged

**Severity**: MINOR
**Rationale**: Confirmation toasts ("Saved!") are transient — they confirm a recent action and disappear. Important state changes (errors, warnings, system messages) are persistent — they remain until acknowledged. Mixing the conventions (auto-dismissing errors, persistent confirmations) is the classic notification anti-pattern.
**Source**: https://www.atlassian.design/components/flag/usage

**The rule**: Toast = confirmation of a user-initiated action (auto-dismiss 4-7s, with optional manual close). Persistent notification = system-initiated info that the user did not trigger and may need to act on (no auto-dismiss; explicit close).

**Code patterns to flag**:
- Error toasts that auto-dismiss before the user can read them
- "Saved" confirmations that require manual close

**Correct pattern**: Save → auto-dismissing toast "Changes saved." Permission-denied → persistent banner with "Dismiss" button.

**Quick-fix hint**: If a user might miss this and the consequence matters, it can't auto-dismiss.

---

### MC-034: Notifications include a dismiss control

**Severity**: MAJOR
**Rationale**: Cross-references heuristic NN3 (user control). Even auto-dismissing toasts should offer manual close — users with cognitive disabilities, screen-reader users, and users on slow displays may need more time to read.
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/timing-adjustable.html

**The rule**: Every notification (toast, banner, in-app message) has a dismiss control with `aria-label="Dismiss"` or equivalent. Auto-dismiss timing pauses on hover/focus per WCAG 2.2.1 (Timing Adjustable).

**Code patterns to flag**:
- Toasts with no close button
- Banners that take focus but offer no dismiss key (Escape) or button
- Auto-dismiss timers that don't pause on hover

**Correct pattern**: Toast component renders a close `<button aria-label="Dismiss">×</button>` and pauses dismiss on hover/focus.

**Quick-fix hint**: Can the user close this without waiting? If no, it's not WCAG-compliant.

---

### MC-035: Notifications convey severity through more than color

**Severity**: MAJOR
**Rationale**: Same principle as MC-019 (color isn't the only carrier). A red banner without an icon or "Error:" prefix fails for color-vision-different users.
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html

**The rule**: Severity is conveyed via icon + color + (optionally) prefixed label. Removing color leaves the severity readable.

**Code patterns to flag**:
- Notification components that change only the background color across info / success / warning / error variants
- Toast components that distinguish error and warning purely via color

**Correct pattern**: Each variant pairs a distinct icon + color. Optional prefix ("Error:", "Success:") reinforces.

**Quick-fix hint**: Disable color. Can the user still tell error from success?
