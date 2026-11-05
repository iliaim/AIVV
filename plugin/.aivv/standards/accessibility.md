# Accessibility Standards — WCAG 2.1 AA + WCAG 2.2 NEW SC + ARIA APG + COGA + SR-divergence Code-Reviewable Baseline

**This file is a TOC stub.** Rule content lives in the [`accessibility/`](accessibility/) subdirectory (dev.61 subdir-pattern retrofit per master spec T18; content-extended dev.77–79 from 35 → 74 rules; aria.md sub-split dev.80). The 74 code-reviewable rules `A11Y-001..074` are split across 8 by-domain files (with `aria.md` itself a TOC stub → 3 by-domain sub-subfiles in [`accessibility/aria/`](accessibility/aria/)).

> **Reviewers consulting this file:** open the relevant subfile(s) below for actual rule content. This stub contains no rule bodies — only the rule-ID-to-subfile mapping.

## Rule index

| File | Rules | Section |
|---|---|---|
| [accessibility/document-language.md](accessibility/document-language.md) | A11Y-001..003 | Document structure & language |
| [accessibility/semantic-structure.md](accessibility/semantic-structure.md) | A11Y-004..008 | Semantic structure & landmarks |
| [accessibility/forms.md](accessibility/forms.md) | A11Y-009..014 | Forms & inputs |
| [accessibility/interactive-elements.md](accessibility/interactive-elements.md) | A11Y-015..019 | Interactive elements |
| [accessibility/images-media.md](accessibility/images-media.md) | A11Y-020..023 | Images & media |
| [accessibility/aria.md](accessibility/aria.md) (TOC stub) → [accessibility/aria/](accessibility/aria/) subdir (3 by-domain files, dev.80 nested retrofit) | A11Y-024..029, 045..060, 073..074 | ARIA usage + APG widget patterns + SR-divergence |
| [accessibility/keyboard-focus.md](accessibility/keyboard-focus.md) | A11Y-030..031 | Keyboard & focus |
| [accessibility/color-motion.md](accessibility/color-motion.md) | A11Y-032..035 | Color, meaning, and motion |

## Runtime-deferred SCs (Tier 2 visual verification)

The rules below require a rendered page, real keyboard input, or screen-reader output to verify. If the diff touches UI that plausibly implicates one of these, raise it as a Tier 2 (visual / runtime) verification item rather than a code-review finding. See [`accessibility/README.md`](accessibility/README.md) for the full list with rationale; one-line summary here:

- Contrast ratios (WCAG 1.4.3 / 1.4.11), focus-appearance perceivability (2.4.7), target size (2.5.5/2.5.8), reflow (1.4.10), screen-reader announcement quality, focus-trap behavior in dialogs, keyboard operation of custom widgets (menus/comboboxes/tabs/grids), three-flashes (2.3.1), captions/audio-description content quality (1.2.4/1.2.5).

## Maintenance

See [`accessibility/README.md`](accessibility/README.md) for: full curation rationale (sourcing rules — W3C WAI / WebAIM / MDN / The A11y Project), content-fidelity guarantees, and the full runtime-deferred list. When adding A11Y-036 or beyond, place the rule in the appropriate by-domain subfile; `validate.sh` Stage 8 recurses [`accessibility/`](accessibility/) to enforce the count contract.
