# UX Heuristics — Schneiderman's 8 Golden Rules (HEU-SCH1..SCH8)

Part of [.aivv/standards/ux-heuristics/](README.md).

### HEU-SCH1: Strive for consistency

**Severity**: MINOR
**Rationale**: Schneiderman's first rule is the most-cited HCI consistency principle. Identical sequences of actions in similar contexts; identical terminology in prompts, menus, and help; consistent commands.
**Source**: https://www.cs.umd.edu/~ben/goldenrules.html

**The rule**: vocabulary, control placement, and command sequences match across related surfaces. Where the product spans multiple touchpoints (web, mobile, email), maintain consistency or document the deliberate divergence.

**Code patterns to flag**:
- Same conceptual action labeled "Save" on one screen and "Update" on another
- Modal layouts inverting confirm-and-cancel button order between screens
- Toast notification placement varying between top-right and bottom-center across components

**Correct pattern**: shared design tokens, vocabulary glossary, primitive components.

**Quick-fix hint**: pick a vocabulary, write it down once, reuse it.

---

### HEU-SCH2: Seek universal usability

**Severity**: MAJOR
**Rationale**: Surfaces should accommodate novice through expert users, varying age, ability, and device classes. Schneiderman's principle aligns with WCAG (legal/safety floor) but extends to plasticity — the surface adapts to the user's level.
**Source**: https://www.cs.umd.edu/~ben/goldenrules.html

**The rule**: provide both novice scaffolding (guided flows, tooltips, defaults) and expert accelerators (shortcuts, bulk operations, dense modes). Avoid forcing a single skill level.

**Code patterns to flag**:
- Power-user flows that require GUI navigation only (no keyboard shortcuts)
- Onboarding-only tooltips that disappear permanently after first dismissal (no way to re-trigger)
- Dense data tables without a "comfortable / compact" density toggle

**Correct pattern**: density toggle, optional onboarding replay, keyboard map.

**Quick-fix hint**: imagine 1st-day and 1000th-day usage of this surface. Does it serve both?

---

### HEU-SCH3: Offer informative feedback

**Severity**: MAJOR
**Rationale**: For every action, provide feedback proportional to the action's significance. Frequent low-stakes actions get modest feedback (cursor moves, toggle flips); infrequent or high-stakes actions get substantial feedback (success banner, audit-log entry).
**Source**: https://www.cs.umd.edu/~ben/goldenrules.html

**The rule**: feedback magnitude scales with action magnitude. Quiet actions need quiet acknowledgment; noisy actions need clear confirmation.

**Code patterns to flag**:
- Major actions (account deletion, financial transactions) ending with no feedback or only a quiet status change
- Minor actions (toggling a checkbox) firing a full-screen modal acknowledgment
- Save actions that succeed silently (user can't tell whether the click worked)

**Correct pattern**: toast for routine save; modal + redirect for irreversible payment; tactile feedback for routine toggles.

**Quick-fix hint**: rank actions by stakes. Do feedback magnitudes match?

---

### HEU-SCH4: Design dialogs to yield closure

**Severity**: MINOR
**Rationale**: Sequences of actions should have a clear beginning, middle, and end with explicit closure feedback. Half-finished flows leave users in cognitive limbo (Zeigarnik Effect — see HEU-LUX-zeigarnik, lives in `laws-of-ux/memory-cognition.md` per dev.69 nested retrofit).
**Source**: https://www.cs.umd.edu/~ben/goldenrules.html

**The rule**: every multi-step flow concludes with a definitive "done" state — confirmation page, success toast, redirect to a known landing.

**Code patterns to flag**:
- Wizards where the final step's success path leaves the user on the same form (no "Done" screen)
- Async submits that succeed but the form remains, indistinguishable from pre-submit state
- Bulk operations completing without a summary ("3 items deleted, 1 failed")

**Correct pattern**: explicit success state with summary + next-action affordance.

**Quick-fix hint**: at the end of the flow, ask: *can the user confidently say "I'm done"?*

---

### HEU-SCH5: Prevent errors

**Severity**: MAJOR
**Rationale**: Same intent as HEU-NN5; Schneiderman's framing is broader: *prevent serious errors* through input constraints, expert-level confirmation gates, and forgiveness mechanisms.
**Source**: https://www.cs.umd.edu/~ben/goldenrules.html

**The rule**: high-stakes operations are gated by intent confirmation; low-stakes operations are gated by constraint.

**Code patterns to flag**:
- Single-click destructive operations (delete account, send irreversible message) without typed-confirm or dwell
- Auto-save mutations on form fields without explicit save intent for fields with user-visible consequences

**Correct pattern**: typed-confirm for critical; opt-in auto-save for low-stakes.

**Quick-fix hint**: a misclick happens — what's the worst that can result? Calibrate the gate to that worst case.

---

### HEU-SCH6: Permit easy reversal of actions

**Severity**: MAJOR
**Rationale**: Reversibility removes the need for prevention dialogs in many cases. If a user knows they can always undo, they're free to explore.
**Source**: https://www.cs.umd.edu/~ben/goldenrules.html

**The rule**: every action that can be reversed should be — undo toast, version history, trash bin with restoration period.

**Code patterns to flag**:
- `await deleteItem(id)` with hard-delete semantics (no soft-delete column, no recovery path)
- Edit flows without revision history when the data has audit-log requirements
- Bulk operations with no per-item undo

**Correct pattern**: soft-delete + 30-day trash, undo toasts, revision history.

**Quick-fix hint**: every destructive verb gets paired with an inverse verb. If the inverse is "no recovery", the action needs a much stronger gate.

---

### HEU-SCH7: Keep users in control (internal locus of control)

**Severity**: MAJOR
**Rationale**: Users feel in control when the system responds to their actions, not the reverse. Surfaces that initiate state changes the user didn't request — surprise navigations, auto-submits, content shifts during read — break this principle.
**Source**: https://www.cs.umd.edu/~ben/goldenrules.html

**The rule**: state changes are initiated by the user. Background changes (incoming notifications, auto-refresh) surface non-disruptively; user-initiated changes are immediate and predictable.

**Code patterns to flag**:
- `setInterval` auto-refreshing a list the user is reading (content jumps mid-read)
- Modals appearing on time-based triggers (after N seconds idle, on first scroll)
- Auto-redirect on form completion without user click
- Server-pushed full-screen overlays interrupting current task

**Correct pattern**: "1 new item — refresh" affordance instead of auto-refresh; user-clicked submit triggers redirect.

**Quick-fix hint**: did the user request this state change? If no, surface it non-disruptively.

---

### HEU-SCH8: Reduce short-term memory load

**Severity**: MINOR
**Rationale**: Working memory is limited (Miller's Law). Display-based recognition is cheaper than memory-based recall.
**Source**: https://www.cs.umd.edu/~ben/goldenrules.html

**The rule**: don't ask users to remember things across screens. Persist context, use visible labels, reuse search query / filter values.

**Code patterns to flag**:
- Multi-step flows that don't summarize prior selections in the next step
- Filter UIs where filter values reset on navigation
- Modal dialogs that hide the underlying context the user was working with

**Correct pattern**: sticky filters, persistent context summary, breadcrumbs.

**Quick-fix hint**: same as HEU-NN6 — at every screen, the user should be able to see what they're working on.
