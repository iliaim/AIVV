# Interaction States — Notifications & Toasts

Part of [.aivv/standards/interaction-states/](README.md) (IS-027..030).

### IS-027: Toasts must be dismissible

**Severity**: MINOR
**Rationale**: Toasts that linger without dismiss control trap user attention; auto-dismiss-only without manual dismiss is a user-control violation (HEU-NN3).
**Source**: https://m3.material.io/components/snackbar + Apple HIG Notifications

**The rule**: toasts have either (a) explicit dismiss (X button), (b) auto-dismiss timer (5–10s for info, 0 = no auto for errors), or both. Errors should not auto-dismiss.

**Code patterns to flag**:
- `<Toast>` components without close button or auto-dismiss timer
- Error toasts that auto-dismiss before user can read them
- Persistent toasts (no timer, no close) blocking primary content

**Correct pattern**: dismiss button on errors; 5s auto-dismiss with manual close on info / success.

**Quick-fix hint**: a toast appears. Can the user close it manually if needed?

---

### IS-028: Toasts must not stack indefinitely

**Severity**: MINOR
**Rationale**: Unbounded toast stacks block primary content and create attention overflow. Material limits to one snackbar at a time; web convention is 3–5 max.
**Source**: https://m3.material.io/components/snackbar + general toast-stack pattern

**The rule**: toast container limits visible stack (1–5); excess queues or replaces. Identical-content toasts dedupe (don't show "Saved" 7 times in 3 seconds).

**Code patterns to flag**:
- Toast manager allowing unlimited concurrent toasts
- `setToast(...)` called in a tight loop with no debounce / dedup
- Toast component rendering `toasts.map(...)` without slice/limit

**Correct pattern**: cap visible toasts (e.g., 3); queue or drop excess; dedupe identical content.

**Quick-fix hint**: trigger 10 toasts rapidly. Does the screen flood, or does it cap gracefully?

---

### IS-029: Live-region announcements must respect priority

**Severity**: MINOR
**Rationale**: ARIA live regions broadcast updates to screen readers; misconfigured priority spams users (everything `aria-live="assertive"`) or misses updates (everything `polite`).
**Source**: https://www.w3.org/WAI/ARIA/apg/practices/live-regions/

**The rule**: `aria-live="polite"` for non-urgent updates (success, info); `aria-live="assertive"` for urgent (error, alert). Don't apply assertive to routine confirmations.

**Code patterns to flag**:
- `<Toast aria-live="assertive">` for routine "Saved" confirmations
- Error toasts with `aria-live="polite"` (screen-reader user misses critical info)
- Live regions that re-announce same content on every render

**Correct pattern**: severity-driven politeness; stable content (no re-announce on identical state).

**Quick-fix hint**: a screen-reader user receives every announcement. Is the priority right for each?

---

### IS-030: Critical errors must surface persistently, not via auto-dismissed toast

**Severity**: MAJOR
**Rationale**: Toasts that auto-dismiss after 5s while a critical operation has failed may be missed entirely — the user is left believing the operation succeeded.
**Source**: https://www.nngroup.com/articles/error-message-guidelines/ + Apple HIG alerts

**The rule**: errors that block downstream actions or indicate data loss surface persistently — banner, modal, inline section. Toasts are acceptable only for non-critical feedback.

**Code patterns to flag**:
- "Save failed" rendered as auto-dismissing toast
- Network errors shown only via toast on data-loading screens
- Validation errors collapsed into toasts (rather than inline-at-field per IS-007)

**Correct pattern**: persistent error banner; modal for high-stakes; toast only for completed-successfully or routine info.

**Quick-fix hint**: the operation failed. Can the user still see the error 30 seconds later if they were looking elsewhere?
