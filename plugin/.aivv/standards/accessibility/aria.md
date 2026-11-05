# Accessibility — ARIA usage (TOC stub)

Part of [.aivv/standards/accessibility/](README.md) (A11Y-024..029, A11Y-045..060, A11Y-073..074). This file is a **TOC stub** as of dev.80 — the rule content lives in by-domain subfiles under [`aria/`](aria/). Reviewers consulting this file MUST open the relevant subfile below for actual rule content; the TOC stub itself ships no rule text.

## Subfiles (rule-ID-to-subfile mapping)

| Subfile | Rules | Scope |
|---|---|---|
| [`aria/fundamentals.md`](aria/fundamentals.md) | A11Y-024..029 | First rule of ARIA + name/label/state/live-region foundations |
| [`aria/apg-widgets.md`](aria/apg-widgets.md) | A11Y-045..060 | 16 ARIA APG widget patterns (Accordion through Tree View) |
| [`aria/sr-divergence.md`](aria/sr-divergence.md) | A11Y-073..074 | Screen-reader implementation divergences (NVDA/JAWS/VoiceOver) |
| [`aria/README.md`](aria/README.md) | — | Subdir index + per-subfile rule list |

## Cycle history

See [`aria/README.md`](aria/README.md) (subdir index) for the dev.61 → dev.78 → dev.79 → dev.80 evolution narrative — single source of truth, kept current alongside the subdir-index table.

## Runtime-deferred reminder

Full keyboard-semantics testing, focus-trap verification, SR-mode-switching observation, and live-region announcement timing are **runtime-deferred** — they require Tier 2 (`/aivv --lens=visual` Playwright/DevTools MCP runs or manual screen-reader testing). The per-rule "**Runtime caveat**" lines in each subfile name the specific behaviors that need runtime verification. The consolidated runtime-deferred list lives in the parent [`accessibility/README.md`](README.md).

## Maintenance

When adding ARIA rules:
- Append to the matching subfile (fundamentals / apg-widgets / sr-divergence); do NOT add rule content to this TOC stub.
- Update the parent [`accessibility/README.md`](README.md) rule-index table.
- If a new domain emerges (e.g., ARIA 1.3-specific patterns, mobile-AT divergence), add a new subfile under `aria/` and add a row above.
- Per maintainer guidance "Per-rule WebFetch-verification discipline (dev.80+)", WebFetch every cited source before ship — especially for cycles adding ≥3 rules.
