# Interaction States — Per-Primitive State Inventories

Curated checklist of interaction-state defects that an IV&V reviewer can catch by reading code alone — JSX/HTML markup for buttons, inputs, dialogs, lists, async fetchers, navigation. Each rule cites an authoritative design-system, accessibility, or HCI source (Apple HIG, Material Design, ARIA APG, NN/g, GOV.UK Design System, USWDS).

The audience for this document is the AIVV reviewer agent applying the `ux` or `polish` lens (see [`.aivv/lenses/ux.md`](../../lenses/ux.md), [`.aivv/lenses/polish.md`](../../lenses/polish.md)). Rules carry severities (CRITICAL / MAJOR / MINOR / POLISH) consistent with the orchestrator's severity-inference 4-pass rule ([`.aivv/methodology.md`](../../methodology.md) Severity inference).

**Scope**: code-observable state defects — branches missing from a render path, state values set but unread (or read but never set), state transitions without UI feedback, async operations without intermediate UI. Out of scope: actual rendered output (whether the spinner is visible, whether the focus ring contrasts), which routes to `visual-verification-triggers/`.

**Source-class layer**: predominantly **L2 cognitive-psychology** (visibility-of-system-status, error-prevention) with overlap into **L1 legal/safety** when missing states create accessibility violations (focus-trap absent on modal = WCAG SC 2.4.3 Focus Order).

**The principle**: every interactive primitive has a finite state inventory. A button is `default | hover | focus | active | disabled | loading | success | error`. A form field is `empty | typing | valid | invalid | disabled | readonly | submitting | submitted | error`. An async list is `initial | loading | empty | populated | error | refreshing`. A dialog is `closed | opening | open | closing | error`. Code that introduces a primitive without covering its full inventory produces a finding.

**Rule-count contract (maintainer-side):** the maintainer validator recurses this directory (`grep -rhcE '^### IS-[0-9]+:' .aivv/standards/interaction-states/`) and asserts the count matches the documented total. When adding `IS-031` or beyond, place the rule in the appropriate by-primitive subfile.

## Rule index (30 code-reviewable rules)

| File | Rules | Primitive class |
|---|---|---|
| [buttons-ctas.md](buttons-ctas.md) | IS-001..005 | Buttons & CTAs |
| [form-fields.md](form-fields.md) | IS-006..012 | Form Fields & Inputs |
| [async-lists.md](async-lists.md) | IS-013..018 | Async Lists & Data Fetching |
| [dialogs-modals.md](dialogs-modals.md) | IS-019..023 | Dialogs & Modals |
| [navigation.md](navigation.md) | IS-024..026 | Navigation & Routing |
| [notifications.md](notifications.md) | IS-027..030 | Notifications & Toasts |

## Calibration

Findings emitted under IS-* rules should populate `rule_id` in the calibration entry per [.aivv/calibration/README.md](../../calibration/README.md). The aggregator can then track per-state-defect FP rate and calibration evolution.

When a state defect aligns with an L1 source-class rule (WCAG focus order, focus visibility, keyboard accessibility), the L1 rule wins per the methodology's source-precedence layers — IS-005 / IS-019 / IS-020 / IS-021 / IS-022 are all WCAG-backed.

## Maintenance

These rules are curated content, not author-invented:

1. **Cite an authoritative source** — Apple HIG, Material Design, ARIA APG, NN/g, GOV.UK Design System, USWDS, web.dev, WCAG. No "we think it's good practice" entries.
2. **Verify the rule is code-reviewable** — if verification requires runtime measurement (does the spinner actually render?, does the focus ring contrast?), put it in `visual-verification-triggers/`, not here.
3. **Follow the numbering convention** — `IS-NNN`; sequential.
