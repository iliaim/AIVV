# Microcopy Standards — UX Writing Patterns

Curated checklist of UX-writing pattern violations that an IV&V reviewer can catch by reading code alone — copy strings, button labels, error messages, empty-state prose, confirmation dialogs, notification text. Each rule cites an authoritative source (NN/g, Apple HIG, Material Design, GOV.UK Design System, Mailchimp Content Style Guide, Shopify Polaris, Atlassian Design System, USWDS).

The audience for this document is the AIVV reviewer agent applying the `ux` or `polish` lens (see `.aivv/lenses/ux.md`, `.aivv/lenses/polish.md`). Rules carry severities (CRITICAL / MAJOR / MINOR / POLISH) consistent with the orchestrator's severity-inference 4-pass rule (`.aivv/methodology.md` Severity inference). Microcopy findings are commonly POLISH-tier value-add suggestions, but a subset (destructive-action language, error messages that mislead, missing labels) escalates to MAJOR or higher.

**Scope:** rendered UI copy only — button labels, field labels, error/empty/loading prose, dialog text, toast/notification body, page metadata visible to users. Out of scope: contributor-facing prose (commit messages, code comments, internal docs), generated machine output (logs, debug strings), trademarked names and product nouns where the project's brand guidelines override these defaults.

**Rule-count contract (maintainer-side):** the maintainer validator recurses this directory (`grep -rhcE '^### MC-[0-9]+:' .aivv/standards/microcopy/`) and asserts the count matches the documented total. When adding `MC-039` or beyond, place the new rule in the appropriate by-domain subfile so the recursive grep continues to enforce.

## Rule index (38 code-reviewable rules)

| File | Rules | Section |
|---|---|---|
| [voice-tone.md](voice-tone.md) | MC-001..005 | Voice & Tone |
| [buttons-ctas.md](buttons-ctas.md) | MC-006..010 | Buttons & CTAs |
| [labels-fields.md](labels-fields.md) | MC-011..015 | Labels & Field Names |
| [errors.md](errors.md) | MC-016..021 | Error Messages |
| [empty-states.md](empty-states.md) | MC-022..025 | Empty States |
| [confirmations.md](confirmations.md) | MC-026..029 | Confirmations & Destructive Actions |
| [loading-progress.md](loading-progress.md) | MC-030..032 | Loading & Progress |
| [notifications.md](notifications.md) | MC-033..035 | Notifications & Toasts |
| [punctuation.md](punctuation.md) | MC-036..038 | Capitalization & Punctuation |

## Cross-references and lens routing

These rules are loaded by the `ux` lens (operationalized heuristic walkthrough — see `.aivv/lenses/ux.md`) and the `polish` lens (improvement-articulation — see `.aivv/lenses/polish.md`). Many rules also surface under the `visual` lens when they intersect with WCAG (MC-019, MC-034, MC-035 in particular). The `code` lens does NOT consult this file unless the change set touches user-facing copy.

When a finding cites a rule from this file, use the format: `MC-NNN — <one-line summary> [grounded_by: <source URL>]` in the prose review. Emit the finding's `rule_id` field with the full ID (`MC-007`) in the machine-readable sidecar.

## Maintenance

These rules are curated content, not author-invented. When extending:

1. **Cite an authoritative source** — NN/g, Apple HIG, Material Design, GOV.UK, USWDS, Mailchimp, Polaris, Atlassian, web.dev, W3C. No "we think it's good" entries.
2. **Verify the rule is code-reviewable** — if verification requires running the app or measuring copy in a real layout, route to a runtime-visual rule, not here.
3. **Follow the numbering convention** — `MC-NNN`, sequential. Do not renumber existing rules.
4. **Severity calibration** — most microcopy rules are MINOR or POLISH. MAJOR is reserved for rules whose violation actively misleads or harms (MC-004 blame language, MC-007 destructive button labels, MC-026 destructive confirmations).
