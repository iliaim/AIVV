# Visual Verification Triggers — Accessibility-code changes

Part of [.aivv/standards/visual-verification-triggers/](README.md) (VVT-026..030, VVT-062). Extended dev.90 = T23 phase 6 — `forced-colors` media query (Baseline Widely available since September 2022) appended per the dev.86 by-domain partition policy. forced-colors is fundamentally an accessibility-mode trigger (Windows High Contrast Mode for low-vision users), placed here rather than `css-styling.md` for semantic correctness.

### VVT-026: ARIA attribute additions or modifications

**Pattern (diff-observable)**:
- Content match: added/changed `aria-*` attributes (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-expanded`, `aria-controls`, `aria-live`, `aria-hidden`, `aria-current`, `aria-selected`, `aria-pressed`)

**Why runtime verification is needed**: ARIA correctness is measurable only by the accessibility tree a screen reader builds — name/role/state computed values are runtime artifacts.

**What to verify externally**:
- Screen reader announces the intended name, role, and state
- `aria-hidden` does not hide content that receives focus
- `aria-live` regions announce at the intended politeness

**Suggested tooling**: aXe DevTools | screen-reader manual test (VoiceOver/NVDA/JAWS) | Chrome DevTools-class in-browser inspection (Accessibility tab)

---

### VVT-027: Role or landmark changes

**Pattern (diff-observable)**:
- Content match: added/changed `role="..."`, new landmark elements (`<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>`), removed semantic elements

**Why runtime verification is needed**: Landmark structure is navigated by assistive tech; duplicate/missing landmarks silently degrade navigation.

**What to verify externally**:
- Exactly one `<main>` per page
- Landmarks can be listed and jumped to via screen reader rotor
- No redundant or orphaned roles

**Suggested tooling**: aXe DevTools | screen-reader rotor/landmarks navigation | Lighthouse a11y audit

---

### VVT-028: Semantic element swap (div → button / a)

**Pattern (diff-observable)**:
- Content match: `<div onClick={...}>` changed to `<button>`/`<a>`, or vice versa; `<span role="button">` additions

**Why runtime verification is needed**: Native elements come with default keyboard handling, focus outlines, and form-submit semantics that a `<div>` replacement must reimplement; the presence of the correct element does not prove the behavior is equivalent.

**What to verify externally**:
- Element is keyboard-activatable (Enter for links, Space+Enter for buttons)
- Visible focus indicator when tabbed to
- Correct cursor style on hover

**Suggested tooling**: manual keyboard test | aXe DevTools | Playwright-class browser automation

---

### VVT-029: tabindex changes

**Pattern (diff-observable)**:
- Content match: new `tabindex="-1"`, `tabindex="0"`, or any positive `tabindex` value

**Why runtime verification is needed**: Positive `tabindex` values disrupt tab order globally; `tabindex="-1"` removes keyboard reachability. Diff review cannot predict the resulting traversal sequence.

**What to verify externally**:
- Tab order matches visual reading order
- No focusable element is skipped
- Positive tabindex values are avoided unless intentional and documented

**Suggested tooling**: manual keyboard walk | Playwright-class browser automation

---

### VVT-030: Language, direction, or locale attribute changes

**Pattern (diff-observable)**:
- Content match: changed `lang="..."`, new `dir="rtl"`/`dir="auto"`, i18n library config changes that affect direction or fonts

**Why runtime verification is needed**: RTL mirroring, localized string length, and language-specific font rendering are runtime concerns that expand or truncate layout unpredictably.

**What to verify externally**:
- RTL locales mirror layout correctly (icons, paddings, alignment)
- Longest-known translation does not overflow containers
- Screen reader announces in the correct language

**Suggested tooling**: Playwright-class browser automation (per-locale screenshots) | manual locale switch

---

### VVT-062: CSS `forced-colors` media-query handling — Baseline Widely available since September 2022

**Pattern (diff-observable)**:
- Content match: added or modified `@media (forced-colors: active)` / `@media (forced-colors: none)` blocks; added `forced-color-adjust: none` / `forced-color-adjust: preserve-parent-color` / `forced-color-adjust: auto` declarations; new uses of CSS system-color keywords (`Canvas`, `CanvasText`, `LinkText`, `ButtonText`, `ButtonFace`, `ButtonBorder`, `Field`, `FieldText`, `Highlight`, `HighlightText`, etc.)
- File/path match: any stylesheet, accessibility-tier component styles, design-system root styles, custom-component-with-color styles

**Why runtime verification is needed**: `forced-colors: active` indicates the user has enabled a forced-color mode (primarily Windows High Contrast Mode) — the browser substitutes its own limited color palette via CSS system-color keywords, overriding author-specified colors. Per MDN, when `forced-colors: active`, the following properties have their values treated as if no author-level values were specified: `color`, `background-color`, `text-decoration-color`, `text-emphasis-color`, `border-color`, `outline-color`, `column-rule-color`, `box-shadow` (forced to `none`), `text-shadow` (forced to `none`), `background-image` (forced to `none` for non-URL values). Diff review shows the media-query block but cannot reveal: (a) **system-color substitution rendering** — verify the system-palette rendering (Windows High Contrast Mode active) produces a usable interface — particularly important for components that previously relied on `box-shadow` for elevation (now `none`) or `background-image` for visual affordances (now `none` for non-URL values); (b) **`forced-color-adjust: none` opt-out** — per MDN verbatim, "When `forced-color-adjust` is set to `none` on an element, none of the forced color values will apply, and author styles will be applied as normal." Use sparingly — opting out of forced colors defeats the user's accessibility setting; verify any `forced-color-adjust: none` deployment has a documented reason (e.g., a brand-color-critical logo where contrast is already manually managed); (c) **`preserve-parent-color` semantics** — per MDN, when `forced-color-adjust: preserve-parent-color` is set on an element, the `color` property computes to the parent's used `color` if it inherits from the parent; "In all other cases, it behaves the same as `none`" — non-obvious edge case worth verifying; (d) **`prefers-color-scheme` interaction** — per MDN: when `forced-colors: active`, the browser "triggers the appropriate value of `prefers-color-scheme`" based on the lightness of the `Canvas` system color. Verify the resulting `prefers-color-scheme` value when forced-colors is active matches design intent; (e) **`box-shadow` / `text-shadow` substitution** — verify components that used shadows for elevation / focus-ring rendering have an alternative affordance under forced-colors (e.g., `border: 2px ButtonText solid;` replacing `box-shadow: 0 2px 4px rgba(0,0,0,0.1);`).

**What to verify externally**:
- Enable Windows High Contrast Mode (Settings > Accessibility > Contrast themes > pick a theme) — verify the entire UI renders coherently with the system palette; no invisible text / borders / focus indicators
- Components relying on `box-shadow` for elevation or focus visibility have an alternative under forced-colors (typically `border: 2px ButtonText solid;` or `outline: 2px solid Highlight;`)
- Components relying on `background-image` for non-URL values (e.g., CSS-gradient-based icons / patterns) degrade acceptably (the gradient becomes `none`; verify the underlying `background-color` or fallback affordance is visible)
- Any `forced-color-adjust: none` deployment has a documented reason and the opted-out element still meets the forced-colors user's accessibility need
- `prefers-color-scheme` derived value when forced-colors is active matches design intent (typically dark in dark-themed High Contrast modes; light in white-on-black modes)
- System-color keywords used (e.g., `ButtonText`, `Canvas`, `LinkText`) render correctly across Windows High Contrast themes (multiple preset themes exist; verify at least Aquatic / Desert / Dusk / Night Sky)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors (per-feature page; Baseline banner verbatim: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since September 2022"; 2 values — `none`, `active`; MDN verbatim on `active`: "Indicates that forced colors mode is active. The browser provides the color palette to authors through the CSS system color keywords and, if appropriate, triggers the appropriate value of `prefers-color-scheme` so that authors can adapt the page"; MDN verbatim on `forced-color-adjust: none`: "When `forced-color-adjust` is set to `none` on an element, none of the forced color values will apply, and author styles will be applied as normal")

**See also**: **VVT-008** (`css-styling.md`) for the broader color / contrast / theme-token-change trigger — pair when adding `forced-colors` overrides to a design-token system. **VVT-061** (`css-styling.md`) for `prefers-contrast` — closely paired: `prefers-contrast: custom` matches when `forced-colors: active`; verify both media-query paths render coherently. **VVT-057** (`css-styling.md`) for `color-scheme` — `forced-colors: active` triggers the appropriate value of `prefers-color-scheme` based on the lightness of the `Canvas` system color; the two interact at runtime. **VVT-026** for ARIA attribute changes — forced-colors interacts with focus-indicator rendering (which often relies on ARIA-driven styling); pair when adding `:focus-visible` styles.

**Suggested tooling**: Manual Windows High Contrast Mode toggle (Settings > Accessibility > Contrast themes) | Playwright-class browser automation with `page.emulateMedia({ forcedColors: 'active' })` + per-element computed-style assertions | Chrome DevTools-class Rendering panel (emulate CSS forced-colors)
