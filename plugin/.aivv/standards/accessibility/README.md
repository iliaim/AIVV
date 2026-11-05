# Accessibility Standards — WCAG 2.1 AA + WCAG 2.2 NEW SC Code-Reviewable Baseline

This subdir is a lookup reference for the AIVV code-reviewer when inspecting diffs that touch UI code (HTML, JSX/TSX, Vue, Svelte, CSS). It curates WCAG 2.1 Level A/AA + WCAG 2.2 NEW Level A/AA/AAA rules that can be verified by reading source code alone — no runtime, no rendered output, no screen-reader testing required. Rules requiring rendered output (computed contrast ratios, actual focus appearance, live screen-reader announcements) are flagged at the bottom of this README for Tier 2 visual verification. All rules cite an authoritative source (W3C WAI, WebAIM, MDN, or The A11y Project). Severities are assigned on impact: CRITICAL blocks assistive tech; MAJOR degrades UX for disabled users; MINOR is best-practice drift.

**Rule-count contract (maintainer-side):** the maintainer validator recurses this directory (`grep -rhcE '^### A11Y-[0-9]+:' .aivv/standards/accessibility/`) and asserts the count matches the documented total. When adding `A11Y-075` or beyond, place the new rule in the appropriate by-domain subfile so the recursive grep continues to enforce.

## Rule index (74 code-reviewable rules)

| File | Rules | Section |
|---|---|---|
| [document-language.md](document-language.md) | A11Y-001..003, A11Y-072 | Document structure & language |
| [semantic-structure.md](semantic-structure.md) | A11Y-004..008, A11Y-041, A11Y-065..067 | Semantic structure & landmarks |
| [forms.md](forms.md) | A11Y-009..014, A11Y-042..044, A11Y-061..064 | Forms & inputs |
| [interactive-elements.md](interactive-elements.md) | A11Y-015..019, A11Y-039..040, A11Y-068..069 | Interactive elements |
| [images-media.md](images-media.md) | A11Y-020..023 | Images & media |
| [aria.md](aria.md) | A11Y-024..029, A11Y-045..060, A11Y-073..074 | ARIA usage + APG widget patterns + SR-divergence |
| [keyboard-focus.md](keyboard-focus.md) | A11Y-030..031, A11Y-036..038 | Keyboard & focus |
| [color-motion.md](color-motion.md) | A11Y-032..035, A11Y-070..071 | Color, meaning, and motion |

**WCAG 2.2 NEW SC coverage (dev.77 / T21 phase 1):** A11Y-036..044 = the 9 new SC added between WCAG 2.1 and WCAG 2.2 (2.4.11, 2.4.12, 2.4.13, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8, 3.3.9). Per W3C, WCAG 2.2 was published as a W3C Recommendation 2023-10-05.

**Legal-risk axis (dev.103+ Wave 2 phase 1):** the full A11Y baseline catalog (A11Y-001..074 — WCAG 2.1 AA + WCAG 2.2 NEW + COGA + ARIA APG baseline) is the practical compliance target for **COMP-LEGAL-06** (`compliance/legal-risk.md`, "ADA Title III — public-accommodation digital accessibility (WCAG 2.1 AA as practical baseline)"). Passing the A11Y baseline substantially reduces ADA Title III lawsuit exposure for public-accommodation websites; documented WCAG 2.1 AA conformance has been accepted as the practical compliance target by US federal courts (Robles v. Domino's 2019 + multiple subsequent settlements). COMP-LEGAL-06 makes that conformance an explicit legal-risk axis that is forced-shown by L1-source-class detection; the hard legal floor applies when Project Context makes the cited authority applicable.

**ARIA APG widget patterns (dev.78 / T21 phase 2):** A11Y-045..060 = 16 ARIA Authoring Practices Guide widget patterns covering accordion, alert, alertdialog, combobox, dialog (modal), disclosure, listbox, menu/menubar, menu button, radio group, slider, switch, tabs, toolbar, tooltip, tree view. Each cites the canonical W3C APG pattern page.

**COGA + SR-divergence coverage (dev.79 / T21 phase 3):** A11Y-061..074 = 14 rules from W3C COGA "Making Content Usable for People with Cognitive and Learning Disabilities" (https://www.w3.org/TR/coga-usable/) + screen-reader divergence patterns. Coverage:
- Forms (4): autocomplete attributes (A11Y-061), `required` + `aria-required` redundancy (A11Y-062), multi-step progress (A11Y-063), destructive-action confirmation (A11Y-064).
- Semantic structure (3): unique `<h1>` per page (A11Y-065), heading hierarchy source order (A11Y-066), breadcrumb pattern (A11Y-067).
- Interactive elements (2): no autoplay without muted (A11Y-068), session-timeout warning + extend (A11Y-069).
- Color & motion (2): `prefers-reduced-motion` (A11Y-070), `prefers-color-scheme` (A11Y-071).
- Document language (1): BCP 47 region-qualified `lang` (A11Y-072).
- ARIA SR-divergence (2): `role="application"` overuse (A11Y-073), `aria-live` / role-implicit mismatch (A11Y-074).

T21 master spec target was ~80 rules; phase 3 substantively achieves the goal at 74. Further extension awaits dogfood-signaled gaps.

## Out of code-review scope — flag for visual verification

The rules below are important but require a rendered page, real keyboard input, or screen-reader output to verify. If the diff touches UI that plausibly implicates one of these, raise it as a Tier 2 (visual / runtime) verification item rather than a code-review finding.

- **WCAG 1.4.3 Contrast (Minimum), AA** — text vs background contrast ratio ≥ 4.5:1 (3:1 for large text). Requires computed color values against actual backgrounds, including image overlays.
- **WCAG 1.4.11 Non-text Contrast, AA** — UI component and graphical object contrast ≥ 3:1. Requires rendered output.
- **WCAG 2.4.7 Focus Visible, AA (appearance)** — actual focus indicator must be perceivable. Code review can confirm a `:focus-visible` rule exists (A11Y-030); only rendering confirms it is visible against the background. Code review can also confirm focus-ring thickness ≥ 2px (A11Y-038); only rendering confirms the 3:1 contrast ratio.
- **WCAG 2.4.11/2.4.12 Focus Not Obscured (Minimum AA / Enhanced AAA)** — code review can flag sticky/fixed elements lacking `scroll-padding` (A11Y-036..037); only rendering at varying viewport sizes confirms actual obscuring.
- **WCAG 2.5.5 Target Size (Enhanced), AAA / 2.5.8 Target Size (Minimum), AA** — interactive target ≥ 24×24 CSS px. Code review catches hard-coded too-small dimensions (A11Y-040); cascade-dependent computed-only cases still require visual verification.
- **WCAG 1.4.10 Reflow, AA** — content reflows at 320 CSS px width without loss. Requires viewport testing.
- **Screen-reader announcement quality** — whether `aria-live` updates are actually spoken, and at the right verbosity, requires NVDA / JAWS / VoiceOver testing.
- **Focus-trap behavior in dialogs** — code review can confirm an `inert` / trap library is wired up; only keyboard testing confirms Tab/Shift-Tab cannot escape and Esc restores focus to the opener.
- **Keyboard operation of custom widgets** (menus, comboboxes, tabs, grids) — arrow-key semantics per WAI-ARIA APG require runtime testing.
- **WCAG 2.3.1 Three Flashes, A** — three or more flashes per second in animated content / video requires playback analysis.
- **WCAG 1.2.4 Captions (Live), AA / 1.2.5 Audio Description, AA** — caption and audio-description content quality requires watching the media.
