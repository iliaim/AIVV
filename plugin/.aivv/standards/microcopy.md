# Microcopy Standards — UX Writing Patterns

**This file is a TOC stub.** Rule content lives in the [`microcopy/`](microcopy/) subdirectory (dev.64 subdir-pattern retrofit per Wave A discipline). The 38 code-reviewable rules `MC-001..038` are split across 9 by-domain files.

> **Reviewers consulting this file:** open the relevant subfile(s) below for actual rule content. This stub contains no rule bodies — only the rule-ID-to-subfile mapping.

## Rule index

| File | Rules | Section |
|---|---|---|
| [microcopy/voice-tone.md](microcopy/voice-tone.md) | MC-001..005 | Voice & Tone |
| [microcopy/buttons-ctas.md](microcopy/buttons-ctas.md) | MC-006..010 | Buttons & CTAs |
| [microcopy/labels-fields.md](microcopy/labels-fields.md) | MC-011..015 | Labels & Field Names |
| [microcopy/errors.md](microcopy/errors.md) | MC-016..021 | Error Messages |
| [microcopy/empty-states.md](microcopy/empty-states.md) | MC-022..025 | Empty States |
| [microcopy/confirmations.md](microcopy/confirmations.md) | MC-026..029 | Confirmations & Destructive Actions |
| [microcopy/loading-progress.md](microcopy/loading-progress.md) | MC-030..032 | Loading & Progress |
| [microcopy/notifications.md](microcopy/notifications.md) | MC-033..035 | Notifications & Toasts |
| [microcopy/punctuation.md](microcopy/punctuation.md) | MC-036..038 | Capitalization & Punctuation |

## Cross-references and lens routing

Loaded by the `ux` lens (see `.aivv/lenses/ux.md`) and the `polish` lens (see `.aivv/lenses/polish.md`). Many rules also surface under the `visual` lens when they intersect with WCAG (MC-019, MC-034, MC-035). The `code` lens does NOT consult this file unless the change set touches user-facing copy. See [microcopy/README.md](microcopy/README.md) for full curation rationale, lens routing detail, and the `rule_id` emission format.

## Maintenance

See [`microcopy/README.md`](microcopy/README.md) for the curation rules (cite an authoritative source — NN/g / Apple HIG / Material / GOV.UK / Polaris / etc., verify code-reviewability, severity calibration). When adding `MC-039` or beyond, place the rule in the appropriate by-domain subfile; the maintainer validator recurses [`microcopy/`](microcopy/) to enforce the count contract.
