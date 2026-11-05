# Accessibility — ARIA subdir index

Part of [.aivv/standards/accessibility/](../README.md). This subdir holds the ARIA-related rules originally consolidated in `accessibility/aria.md` (dev.61 accessibility-parent retrofit) and content-extended in dev.78 (ARIA APG widget patterns) + dev.79 (screen-reader divergence). The dev.80 retrofit splits the file into three by-domain subfiles per the maintainer guidance "Subdir-pattern retrofit discipline" once aria.md crossed the 500-line threshold post-dev.78.

## Subfiles

| File | Rules | Scope |
|---|---|---|
| [`fundamentals.md`](fundamentals.md) | `A11Y-024..029` | First rule of ARIA + name/label/state/live foundations (prefer-native, `aria-hidden`, `aria-label`/`aria-labelledby`, Label-in-Name, live-region setup, `disabled` vs `aria-disabled`) |
| [`apg-widgets.md`](apg-widgets.md) | `A11Y-045..060` | 16 ARIA Authoring Practices Guide widget patterns (Accordion, Alert, Alertdialog, Combobox, Dialog, Disclosure, Listbox, Menu/Menubar, Menu Button, Radio Group, Slider, Switch, Tabs, Toolbar, Tooltip, Tree View) |
| [`sr-divergence.md`](sr-divergence.md) | `A11Y-073..074` | Screen-reader implementation divergences (NVDA/JAWS/VoiceOver) — `role="application"` overuse, mixed role + `aria-live` signals |

## How to use

- The top-level [`accessibility/aria.md`](../aria.md) is a **TOC stub** — reviewer prompts naming "aria.md" should resolve to the matching subfile above.
- Each subfile is self-contained — read the matching one, not all three, when looking up a specific rule.
- Runtime-deferred caveats per rule are repeated in-rule (look for "**Runtime caveat**" lines); the consolidated runtime-deferred list lives in the parent [`accessibility/README.md`](../README.md).
