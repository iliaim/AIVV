# Accessibility — ARIA subdir index

Part of [.aivv/standards/accessibility/](../README.md). This subdir holds the ARIA-related accessibility rules in three by-domain subfiles.

## Subfiles

| File | Rules | Scope |
|---|---|---|
| [`fundamentals.md`](fundamentals.md) | `A11Y-024..029` | First rule of ARIA + name/label/state/live foundations (prefer-native, `aria-hidden`, `aria-label`/`aria-labelledby`, Label-in-Name, live-region setup, `disabled` vs `aria-disabled`) |
| [`apg-widgets.md`](apg-widgets.md) | `A11Y-045..060` | 16 ARIA Authoring Practices Guide widget patterns (Accordion, Alert, Alertdialog, Combobox, Dialog, Disclosure, Listbox, Menu/Menubar, Menu Button, Radio Group, Slider, Switch, Tabs, Toolbar, Tooltip, Tree View) |
| [`sr-divergence.md`](sr-divergence.md) | `A11Y-073..074` | Screen-reader implementation divergences (NVDA/JAWS/VoiceOver) — `role="application"` overuse, mixed role + `aria-live` signals |

## How to use

- Each subfile is self-contained — read the matching one, not all three, when looking up a specific rule.
- Runtime-deferred caveats per rule are repeated in-rule (look for "**Runtime caveat**" lines); the consolidated runtime-deferred list lives in the parent [`accessibility/README.md`](../README.md).
