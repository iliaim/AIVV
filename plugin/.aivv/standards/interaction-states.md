# Interaction States — Per-Primitive State Inventories

**This file is a TOC stub.** Rule content lives in the [`interaction-states/`](interaction-states/) subdirectory (dev.66 subdir-pattern retrofit per Wave A discipline). The 30 code-reviewable rules `IS-001..030` are split across 6 by-primitive files.

> **Reviewers consulting this file:** open the relevant subfile(s) below for actual rule content. This stub contains no rule bodies — only the rule-ID-to-subfile mapping.

## Rule index

| File | Rules | Primitive class |
|---|---|---|
| [interaction-states/buttons-ctas.md](interaction-states/buttons-ctas.md) | IS-001..005 | Buttons & CTAs |
| [interaction-states/form-fields.md](interaction-states/form-fields.md) | IS-006..012 | Form Fields & Inputs |
| [interaction-states/async-lists.md](interaction-states/async-lists.md) | IS-013..018 | Async Lists & Data Fetching |
| [interaction-states/dialogs-modals.md](interaction-states/dialogs-modals.md) | IS-019..023 | Dialogs & Modals |
| [interaction-states/navigation.md](interaction-states/navigation.md) | IS-024..026 | Navigation & Routing |
| [interaction-states/notifications.md](interaction-states/notifications.md) | IS-027..030 | Notifications & Toasts |

See [`interaction-states/README.md`](interaction-states/README.md) for the principle of finite state inventories, calibration routing, source-class layer, and maintenance rules.

## Maintenance

When adding new IS-* rules, place each in the appropriate by-primitive subfile; the maintainer validator recurses [`interaction-states/`](interaction-states/) to enforce the count contract.
