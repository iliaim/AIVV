# Dark Patterns — Urgency & Scarcity manipulation (DP-URGENCY-01..08 + DP-SCARCITY-01..06)

Part of [.aivv/standards/dark-patterns/](README.md). Combined per master spec retrofit naming.

## Urgency (DP-URGENCY-01..08)

### DP-URGENCY-01: Fake countdown timers

**Severity**: MAJOR
**Rationale**: Countdown timers that reset on page reload (or expire and start over) manufacture false urgency. FTC and EU regulators have enforced against this.
**Source**: deceptive.design "Urgency" — https://www.deceptive.design/types

**The rule**: countdown timers reflect real deadlines persisted server-side; do not restart on reload.

**Code patterns to flag**:
- `useState(initialTime)` for countdown without persistence
- Server-side timer that resets per-session

**Correct pattern**: timer tied to a fixed `deadline` timestamp; same value across sessions and reloads.

**Quick-fix hint**: countdown component — trace timer source; should be a fixed deadline, not session-relative.

---

### DP-URGENCY-02: "Ends today!" with no actual end

**Severity**: MAJOR
**Rationale**: "Sale ends today!" badges that perpetually claim "today" regardless of date are deceptive.
**Source**: FTC Online Advertising — https://www.ftc.gov/business-guidance/advertising-marketing/online-advertising-marketing

**The rule**: "Ends today" / "Ends in N hours" claims tie to actual sale-end timestamps with verifiable history.

**Code patterns to flag**:
- Hardcoded `<Badge>Ends today!</Badge>` rendered conditionally on every visit
- "Sale ends in 23:59:59" rolling display

**Correct pattern**: badge tied to a real `saleEndsAt` timestamp; "Ended" or hide after timestamp passes.

**Quick-fix hint**: "ends" / "deadline" badges — verify timestamp-driven rendering.

---

### DP-URGENCY-03: "Last chance!" without scarcity backing

**Severity**: MINOR
**Rationale**: "Last chance to lock in this price!" without an actual price change scheduled is manufactured urgency.
**Source**: deceptive.design "Urgency" — https://www.deceptive.design/types

**The rule**: "last chance" framing is backed by a documented future change; not perpetual messaging.

**Code patterns to flag**:
- "Last chance!" copy in promotional banners with no `priceChangeAt` data
- A/B test variants comparing "last chance" vs neutral copy without behind-the-scenes change

**Correct pattern**: tie urgency framing to an actual scheduled event.

**Quick-fix hint**: search "last chance" / "ends soon" copy for backing data source.

---

### DP-URGENCY-04: Cart-expiration countdowns

**Severity**: MINOR
**Rationale**: "Complete your purchase in 10:00 or items will be released!" pressure when there's no actual inventory contention.
**Source**: deceptive.design "Urgency" — https://www.deceptive.design/types

**The rule**: cart-expiration timers reflect real inventory lock semantics (e.g., concert tickets where inventory IS reserved); otherwise remove.

**Code patterns to flag**:
- `<CartTimer>` on retail e-commerce with no `inventoryLockId`
- Hardcoded 10-minute cart timer on configurable products

**Correct pattern**: cart timers only on flows with real inventory contention; document the lock-source.

**Quick-fix hint**: cart-timer component — verify it ties to actual inventory locks.

---

### DP-URGENCY-05: Push notifications timed for urgency

**Severity**: MINOR
**Rationale**: Notifications scheduled to maximize urgency-feeling ("Your cart is about to expire!" sent at predictably-emotional times like late evening).
**Source**: deceptive.design "Nagging" — https://www.deceptive.design/types

**The rule**: cart / abandonment notifications go out on a content-driven schedule, not engineered for emotional vulnerability windows.

**Code patterns to flag**:
- Scheduled-job config with cron times targeting evenings/weekends without business rationale
- A/B test exposing late-evening as the optimal-conversion time without ethical review

**Correct pattern**: notifications on user-friendly schedules (matching their stated quiet hours / timezone preferences).

**Quick-fix hint**: notification-scheduler — review timing-derivation.

---

### DP-URGENCY-06: Browser-tab manipulation for urgency

**Severity**: MAJOR
**Rationale**: Updating browser tab title with `(1) Cart expiring!` when user switches tabs is manipulative urgency. Also affects accessibility (interrupts focus).
**Source**: NN/g deceptive patterns — https://www.nngroup.com/articles/deceptive-patterns/

**The rule**: `document.title` does not change to manipulate user back to tab; notification badges acceptable for legitimate updates (new messages) but not for urgency-engineering.

**Code patterns to flag**:
- `document.title = '(!) Cart expiring soon — return now!'`
- `setInterval(() => document.title = ...)` for visibility flicker

**Correct pattern**: tab-title reflects content, not user-coercion.

**Quick-fix hint**: grep `document.title =` for marketing-driven mutations.

---

### DP-URGENCY-07: Toast notifications for fake urgency

**Severity**: MINOR
**Rationale**: "12 people just signed up in the last hour!" or "Your friend just purchased!" toast notifications often surface fake or stale data.
**Source**: deceptive.design "Social Proof" — https://www.deceptive.design/types

**The rule**: toast notifications about user activity tie to real, recent, verifiable data sources.

**Code patterns to flag**:
- `<Toast>${randomNames()} just purchased</Toast>` with hardcoded name list
- Toast cycle of "recent activity" backed by fixture data

**Correct pattern**: notifications only when backed by real activity-stream data with verifiable user privacy considerations.

**Quick-fix hint**: live-activity toasts — trace data source.

---

### DP-URGENCY-08: "Hurry!" framing in confirmation modals

**Severity**: MINOR
**Rationale**: Confirmation modals with "Hurry — confirm before the offer expires!" framing pressure quick decisions and prevent considered choice.
**Source**: NN/g deceptive patterns — https://www.nngroup.com/articles/deceptive-patterns/

**The rule**: confirmation modals use neutral framing; urgency context (if real) is provided as information, not pressure.

**Code patterns to flag**:
- `<Modal title="Hurry! Confirm your purchase before timer ends" />`
- Confirm buttons with countdown directly on the button

**Correct pattern**: confirmation modals state facts; user pace controlled by user.

**Quick-fix hint**: modal title / copy review for urgency framing.

---

## Scarcity (DP-SCARCITY-01..06)

### DP-SCARCITY-01: Fake "only N left in stock!"

**Severity**: MAJOR
**Rationale**: Stock-count messaging that doesn't reflect actual inventory misleads users into bias-driven purchase decisions.
**Source**: deceptive.design "Scarcity" — https://www.deceptive.design/types

**The rule**: "only N left" messaging ties to real inventory counts from the source-of-truth system; not hardcoded thresholds.

**Code patterns to flag**:
- `inventory < 10 ? 'Only ${inventory} left!' : ''` rendering without verifying `inventory` is real
- `Math.floor(Math.random() * 5) + 1` driving "left in stock" displays

**Correct pattern**: tie to real inventory; show only when count is genuinely low.

**Quick-fix hint**: "left in stock" / "almost gone" UI — trace data source.

---

### DP-SCARCITY-02: "N people viewing this"

**Severity**: MAJOR
**Rationale**: "12 people are viewing this listing right now!" with no real concurrent-viewer tracking is fabricated scarcity.
**Source**: deceptive.design "Social Proof" / "Scarcity" — https://www.deceptive.design/types

**The rule**: concurrent-viewer counts reflect real session telemetry; not randomized.

**Code patterns to flag**:
- `<ViewerCount>${faker.number({min: 5, max: 20})} viewing now</ViewerCount>`
- Hardcoded viewer-count display always showing 8-25

**Correct pattern**: real-time viewer count from analytics, OR remove the affordance entirely.

**Quick-fix hint**: "viewing now" / "currently shopping" components — verify telemetry-backed.

---

### DP-SCARCITY-03: "N booked in the last 24 hours"

**Severity**: MAJOR
**Rationale**: Travel / booking sites that surface "booked X times in 24h" without verifiable activity data manipulate via fabricated demand signals.
**Source**: deceptive.design "Scarcity" — https://www.deceptive.design/types

**The rule**: booking-activity counts tie to real booking-log data.

**Code patterns to flag**:
- Hotel listing component with hardcoded "booked 47 times this week"
- Activity-count badge unconnected to bookings DB

**Correct pattern**: activity counts pulled from actual bookings tables; clearly labeled with time window.

**Quick-fix hint**: booking-activity badges — verify data source.

---

### DP-SCARCITY-04: "Limited edition" with no actual limit

**Severity**: MAJOR
**Rationale**: "Limited edition" / "Exclusive batch" framing without an actual production cap — patterns used to manufacture perceived scarcity on standard inventory.
**Source**: FTC truth-in-advertising — https://www.ftc.gov/business-guidance/advertising-marketing

**The rule**: "limited edition" claims tied to documented production caps; "exclusive" framing tied to actual exclusivity.

**Code patterns to flag**:
- "Limited edition" tag on perpetually-stocked items
- Marketing copy using "exclusive" / "limited" without backing data

**Correct pattern**: scarcity claims documented in product master data; UI removes badge after cap is hit.

**Quick-fix hint**: "limited" / "exclusive" badges — verify backing data.

---

### DP-SCARCITY-05: Scarcity messaging in checkout

**Severity**: MAJOR
**Rationale**: "1 of these is in someone else's cart!" or "Hurry — almost out!" introduced in the checkout flow (not the product page) is engineered to overcome late-stage abandonment.
**Source**: deceptive.design "Scarcity" — https://www.deceptive.design/types

**The rule**: scarcity messaging (if shown) is consistent across product page and checkout; not introduced at the final purchase moment to coerce.

**Code patterns to flag**:
- `<CheckoutScarcityBanner>` component without corresponding product-page variant
- Scarcity copy only on the final review step

**Correct pattern**: scarcity surface from product-listing through checkout consistently, OR not shown.

**Quick-fix hint**: checkout components — search for scarcity-related copy / banners.

---

### DP-SCARCITY-06: "Locked-in" pricing manipulation

**Severity**: MINOR
**Rationale**: "Your price expires in 5 minutes!" on quotes that aren't actually time-locked at the supplier level — fabricated scarcity to compel quick decision.
**Source**: NN/g deceptive patterns — https://www.nngroup.com/articles/deceptive-patterns/

**The rule**: price-lock timers reflect real supplier/system constraints; not perpetual UI urgency.

**Code patterns to flag**:
- Quote-expiry timer that always shows ~5 minutes regardless of underlying state
- "Your price expires" without a real `priceLockExpiresAt`

**Correct pattern**: price-lock UI only when there's a real lock; without it, no timer.

**Quick-fix hint**: quote / pricing-timer components — trace real lock semantics.
