# Dark Patterns — Gamification / dark engagement (DP-GAME-01..10)

Part of [.aivv/standards/dark-patterns/](README.md).

### DP-GAME-01: Streak-shame to coerce return

**Severity**: MAJOR
**Rationale**: "You'll lose your 47-day streak if you don't come back today!" pressure based on engineered emotional investment.
**Source**: deceptive.design "Nagging" — https://www.deceptive.design/types

**The rule**: streak / progress mechanics may exist, but pressure-laden notifications about streak loss are minimized; user can disable streak-tracking entirely.

**Code patterns to flag**:
- Push-notification template: "You're about to lose your N-day streak!"
- App-open prompt that surfaces streak-imminent-loss

**Correct pattern**: streaks visible if user opts in; notifications about loss are factual / one-time / dismissible.

**Quick-fix hint**: streak-notification copy — review pressure framing.

---

### DP-GAME-02: Variable-reward push notifications

**Severity**: MAJOR
**Rationale**: Engineering app-open notifications with variable-reward schedules (sometimes you'll see your messages, sometimes you'll see a "you might have missed...") to hijack dopamine response.
**Source**: NN/g deceptive patterns — https://www.nngroup.com/articles/deceptive-patterns/

**The rule**: notification content reflects real, immediate value (a specific message arrived); not engineered surprise / variable rewards.

**Code patterns to flag**:
- Notification template selecting between specific-content and curiosity-gap copy at random
- A/B test on notification-content type optimizing for open rate

**Correct pattern**: notifications report actual events specifically.

**Quick-fix hint**: notification-template engine — review randomization on user-facing copy.

---

### DP-GAME-03: Endless scroll / no stopping cues

**Severity**: MAJOR
**Rationale**: Removing pagination / endpoints / "Done for the day?" prompts to maximize session duration is dark engagement (a documented pattern).
**Source**: deceptive.design — https://www.deceptive.design/types

**The rule**: long content feeds include stopping cues (pagination, daily-limit, summary-of-progress) at reasonable intervals; not infinite-scroll without breaks. Defer-to UX-025 (lives in `ui-ux/data-performance.md` per dev.62 retrofit — "Use 'Load more' over pure infinite scroll", severity MINOR).

**Code patterns to flag**:
- `<InfiniteScroll>` with no `<EndOfDay>` or pagination break
- Feed where the "you're caught up" state never renders

**Correct pattern**: include "you're caught up" / "load more" affordances; defer-to UX-025.

**Quick-fix hint**: infinite-scroll component — verify stopping-cue presence.

---

### DP-GAME-04: Pull-to-refresh as Skinner-box mechanic

**Severity**: MINOR
**Rationale**: Designing pull-to-refresh interactions to feel like a slot-machine pull (with delayed-reveal of new content for emotional effect).
**Source**: NN/g deceptive patterns — https://www.nngroup.com/articles/deceptive-patterns/

**The rule**: pull-to-refresh has minimal mandatory delay; doesn't engineer suspense.

**Code patterns to flag**:
- `setTimeout` in pull-to-refresh handler beyond data-fetch time
- Pull-to-refresh animations longer than ~500ms when data is already available

**Correct pattern**: refresh resolves as soon as data arrives; no engineered suspense.

**Quick-fix hint**: pull-to-refresh component — verify no artificial delay.

---

### DP-GAME-05: Achievement-locked notification flood

**Severity**: MINOR
**Rationale**: Bombarding users with badge-unlock / level-up notifications to keep them engaged; cognitive-overload pattern.
**Source**: deceptive.design "Nagging" — https://www.deceptive.design/types

**The rule**: achievement notifications batched (daily summary) rather than per-event; user can disable.

**Code patterns to flag**:
- Per-achievement push notification without batching
- No "Mute achievement notifications" toggle

**Correct pattern**: batched / opt-in / disable-able achievement notifications.

**Quick-fix hint**: achievement-notification scheduler — verify batching + opt-out.

---

### DP-GAME-06: Default-loud sound / vibration on engagement events

**Severity**: MINOR
**Rationale**: Default-on sound effects, haptics, and notifications to maximize attention; users opt-in to quiet, not opt-in to engagement.
**Source**: deceptive.design "Nagging" — https://www.deceptive.design/types

**The rule**: sound / haptics default to user-preferred state (respecting system sound settings); engagement-mechanic sounds are opt-in.

**Code patterns to flag**:
- App startup playing welcome sound / haptic regardless of system mute state
- Default haptics on every UI tap

**Correct pattern**: respect system sound/haptic state; opt-in to extra feedback.

**Quick-fix hint**: sound/haptic system — verify respects system preferences.

---

### DP-GAME-07: FOMO-engineered "Limited time event" features

**Severity**: MINOR
**Rationale**: Time-limited "special events" / "double XP weekends" that pressure users to engage during specific windows or miss out.
**Source**: deceptive.design "Urgency" / "Scarcity" — https://www.deceptive.design/types

**The rule**: time-limited events are clearly bounded with reasonable advance notice; engagement isn't punitive outside event windows.

**Code patterns to flag**:
- Frequent "limited event" overlays without scheduling discipline
- Penalties (lost rewards) for missing event windows

**Correct pattern**: clear event-calendar; missing events doesn't penalize base experience.

**Quick-fix hint**: event-system UI — review pressure framing + opt-out paths.

---

### DP-GAME-08: Default re-enable of notifications

**Severity**: MAJOR
**Rationale**: After user disables a notification category, silently re-enabling it on app update or arbitrary trigger.
**Source**: deceptive.design — https://www.deceptive.design/types

**The rule**: user notification preferences persist across updates; re-enabling requires explicit user action.

**Code patterns to flag**:
- Migration logic resetting `notification_prefs` to defaults on schema change
- Post-update prompt that asks consent but defaults all categories to enabled

**Correct pattern**: preserve user prefs across all updates; consent re-prompts default to user's last choice.

**Quick-fix hint**: notification-pref migration code — verify preservation.

---

### DP-GAME-09: Read receipts / "last seen" without symmetric disclosure

**Severity**: MINOR
**Rationale**: Showing "last seen X minutes ago" or read receipts unilaterally — without giving the user the same visibility about who's watching them.
**Source**: NN/g — https://www.nngroup.com/articles/

**The rule**: presence / last-seen / read-receipt features are reciprocal (you see what others see about you) and disable-able.

**Code patterns to flag**:
- `<LastSeen>` component with no setting to hide own status
- Read-receipt always-on with no toggle

**Correct pattern**: presence features default to symmetric / disable-able.

**Quick-fix hint**: presence components — verify settings + symmetry.

---

### DP-GAME-10: Sunk-cost emphasis in upgrade flows

**Severity**: MINOR
**Rationale**: "You've earned 47 hours of progress! Don't lose it — upgrade now!" copy that leverages sunk-cost bias to push upgrade.
**Source**: deceptive.design — https://www.deceptive.design/types

**The rule**: upgrade copy emphasizes forward value, not loss-aversion / sunk-cost framing.

**Code patterns to flag**:
- Upgrade modal copy: "Don't lose your..." / "All your progress will be wasted unless..."
- Migration screens framing data preservation as upgrade-gated

**Correct pattern**: upgrade UI shows forward benefits; loss-aversion framing avoided.

**Quick-fix hint**: upgrade-modal copy review for sunk-cost / loss-framing.
