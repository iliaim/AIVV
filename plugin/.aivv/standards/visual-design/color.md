# Visual Design — Color & contrast (VD-COLOR-01..14)

Part of [.aivv/standards/visual-design/](README.md).

### VD-COLOR-01: Color tokens, not hex literals

**Severity**: POLISH
**Rationale**: `color: #3B82F6` in component code defeats theming. Hex literals at consumption sites prevent dark-mode, brand-recolor, and accessibility-mode swaps without a refactor.
**Source**: Material Design 3 color-system — https://m3.material.io/styles/color/system/overview

**The rule**: color values come from design tokens (CSS custom properties, theme objects, Tailwind theme keys). Hex / rgb / hsl literals appear only in token-definition sites.

**Code patterns to flag**:
- `style={{ color: '#3B82F6' }}` inline literal in components
- Tailwind arbitrary `text-[#3B82F6]` when a theme color exists
- SCSS `$brand-blue: #3B82F6;` used inline (works for SCSS theming but flag for CSS-custom-property migration)

**Correct pattern**: `className="text-primary"` or `style={{ color: 'var(--color-primary)' }}`.

**Quick-fix hint**: grep for hex literals in `.tsx` / `.jsx` / `.vue` / component CSS.

---

### VD-COLOR-02: Semantic color naming at consumption

**Severity**: POLISH
**Rationale**: `text-red-600` couples a component to the literal hue. Semantic names (`text-error`, `text-danger`, `text-destructive`) survive brand recolor and dark-mode swaps. Refactoring UI: name colors by *role*, not appearance.
**Source**: Refactoring UI Ch.6 color — https://www.refactoringui.com/

**The rule**: at consumption sites, prefer semantic role tokens (`error`, `success`, `warning`, `info`, `primary`, `secondary`, `surface`, `on-surface`) over palette tokens (`red-600`, `blue-500`).

**Code patterns to flag**:
- `text-red-600` for error messages (couples error to specific red)
- `bg-green-500` for success states
- `border-yellow-400` for warning states

**Correct pattern**: `text-error`, `bg-success`, `border-warning` — palette layer hides behind role layer.

**Quick-fix hint**: scan for palette names (color + numeric) in component code; replace with role tokens.

---

### VD-COLOR-03: Opacity as state signal

**Severity**: MINOR
**Rationale**: Disabled state communicated only via opacity (`opacity: 0.5`) hurts contrast (compound with low-contrast text → fails WCAG; contrast compliance is runtime-deferred, see `visual-verification-triggers/`). Opacity also breaks colors-against-non-default-backgrounds. Prefer state-token color swap.
**Source**: Material Design 3 color-system — https://m3.material.io/styles/color/system/overview

**The rule**: disabled / inactive / loading state uses dedicated state tokens (`color-disabled`, `bg-disabled`) — not `opacity` reduction on the active state.

**Code patterns to flag**:
- `<button className={disabled ? 'opacity-50' : ''}>` for disabled
- `disabled:opacity-50` Tailwind variant on interactive elements
- `opacity-60` on inactive nav items

**Correct pattern**: `<button className="text-on-primary disabled:text-on-disabled disabled:bg-disabled">`.

**Quick-fix hint**: grep `opacity-` and `:opacity` variants on interactive components.

---

### VD-COLOR-04: Color-only state signaling (defer-to A11Y-032)

**Severity**: MINOR
**Rationale**: Error indicated only by red border is invisible to color-blind users; success indicated only by green check + green text fails the same way. Combine color with shape / icon / text. The WCAG-compliance variant lives at A11Y-032 (in `accessibility/color-motion.md`, severity MAJOR); VD-COLOR-04 flags the aesthetic-tier pattern.
**Source**: web.dev color-and-contrast — https://web.dev/learn/css/color (cross-reference: WCAG 1.4.1 Use of Color)

**The rule**: state changes that rely on color also surface a non-color signal (icon, text, shape, position). Defer-to A11Y-032 ("Do not convey information by color alone") for the compliance variant.

**Code patterns to flag**:
- Form-field error border with no icon + no error-text
- "Online" / "Offline" status dots with no text label
- Required-field asterisk styled only with `text-red-*`

**Correct pattern**: error: red border + error icon + descriptive text; status dot: green-dot + "Online" label.

**Quick-fix hint**: state-change components — verify ≥ 2 channels (color + shape/text).

---

### VD-COLOR-05: Dark-mode token coverage

**Severity**: MINOR
**Rationale**: A surface that looks fine in light mode but breaks in dark mode (white text on white bg, low-contrast hover states) is a common failure mode of "we added dark mode later." Token-based color systems prevent this — every color used in light mode must have a dark counterpart.
**Source**: Material Design 3 color-system — https://m3.material.io/styles/color/system/overview

**The rule**: if the project supports dark mode, every color token used has both light- and dark-mode value definitions. Hardcoded white / black in component code breaks dark mode.

**Code patterns to flag**:
- `bg-white` in components when project has dark mode (should be `bg-surface`)
- `text-black` literal (should be `text-on-surface`)
- `border-gray-200` literal (should be `border-default`)
- `dark:` variants applied unevenly (some components themed, others not)

**Correct pattern**: `bg-surface text-on-surface border-default` — single token works in both modes.

**Quick-fix hint**: grep `bg-white`, `bg-black`, `text-white`, `text-black` in components.

**See also**: **VVT-057** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code adds or changes the `color-scheme` CSS property or `<meta name="color-scheme">` tag; this rule defines the *design-token coverage policy*, VVT-057 flags when UA-chrome (form controls, scrollbars, spellcheck) coverage needs runtime check. **VVT-058** (same file) — runtime-verification trigger when code uses the `light-dark()` CSS color function (Baseline 2024 Newly available); `light-dark()` is one of the canonical implementation paths for the dark-mode token-coverage policy defined here.

---

### VD-COLOR-06: Hardcoded brand colors

**Severity**: POLISH
**Rationale**: Brand colors at literal hex prevent brand swaps (rebrand, white-label, multi-tenant theming). Brand-specific tokens (`--brand-primary`) absorb the literal.
**Source**: Refactoring UI Ch.6 color — https://www.refactoringui.com/

**The rule**: brand-specific colors are tokenized at the theme layer; component code uses `--brand-*` references.

**Code patterns to flag**:
- Hero-section CSS with `background: #FF6B35` (brand orange literal)
- Logo SVG with hardcoded fill (acceptable if logo IS the brand mark; flag if used as background)

**Correct pattern**: `background: var(--brand-primary);` + token defined at theme root.

**Quick-fix hint**: identify brand colors; verify they're tokenized.

---

### VD-COLOR-07: Gradient stop choice

**Severity**: POLISH
**Rationale**: Two-stop gradients between adjacent-hue colors produce "muddy" intermediate colors (e.g., red→green muddles through brown). Stops in HCL or LCH color space, or multi-stop gradients through neutral, avoid the muddy midpoint.
**Source**: web.dev color-spaces-and-functions — https://www.w3.org/TR/css-color-4/

**The rule**: multi-stop gradients between distinct hues use intermediate stops or LCH/Oklch interpolation to avoid muddy midpoints.

**Code patterns to flag**:
- `linear-gradient(red, green)` (muddy through brown)
- `linear-gradient(#FF6B35, #34D399)` (warm-cool transition through gray)
- 2-stop gradients spanning > 60° hue rotation

**Correct pattern**: 3+ stops, OR `linear-gradient(in oklch, red, green)` for perceptually-uniform interpolation.

**Quick-fix hint**: `linear-gradient(` calls with 2 distant-hue stops — preview the midpoint.

**See also**: **VVT-068** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code adds or modifies `oklch()` / `oklab()` color declarations; gradient stops using `in oklch` color-interpolation-method produce visibly different midpoints than `in srgb` or `in hsl` — VVT-068 flags the runtime verification of gradient interpolation output when the recommended `in oklch` form is adopted per this rule.

---

### VD-COLOR-08: Modern CSS color syntax

**Severity**: POLISH
**Rationale**: Modern CSS color functions (`color-mix()`, `lab()`, `oklch()`, `color()` with `display-p3`) are widely supported and produce better perceptual color manipulation than `rgb()` arithmetic. Legacy `rgba(0, 0, 0, 0.5)` for alpha + neutral mix is brittle.
**Source**: MDN CSS color — https://developer.mozilla.org/en-US/docs/Web/CSS/color_value

**The rule**: for color mixing / lightening / darkening / alpha overlays, prefer `color-mix()` over hardcoded `rgba` arithmetic where supported.

**Code patterns to flag**:
- `rgba(0, 0, 0, 0.05)` overlay manually computed
- `darken($brand, 10%)` SCSS function calls (works but pre-modern)
- Manual hue shifts via decimal HSL arithmetic

**Correct pattern**: `color-mix(in oklch, var(--surface) 90%, black 10%)` for "10% darker surface."

**Quick-fix hint**: alpha-overlay patterns and lighten/darken manual math.

**See also**: **VVT-068** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code adds or modifies `oklch()` / `oklab()` declarations or `color-mix(in oklch, ...)` calls; this rule defines the design-system policy preferring modern color syntax, VVT-068 flags the runtime verification of rendered output (gamut mapping on sRGB displays, hue-angle differences from HSL, fallback declaration order on pre-Baseline browsers).

---

### VD-COLOR-09: Color contrast at token level (compliance is runtime-deferred)

**Severity**: MINOR
**Rationale**: Background + foreground token pairs must meet 4.5:1 contrast for normal text, 3:1 for large text (WCAG 1.4.3 SC AA). Computed contrast is runtime-deferred per `accessibility/` (no code-reviewable A11Y rule covers ratio measurement) — VD-COLOR-09 surfaces the design-system *pattern* of validating contrast at token-pair level. For runtime measurement, see `visual-verification-triggers/` and the planned runtime-visual lens.
**Source**: web.dev color-and-contrast — https://web.dev/learn/css/color

**The rule**: token pairs documented for use together (`--bg-surface` + `--text-on-surface`) have documented contrast ratios. Per-instance contrast checking is too late.

**Code patterns to flag**:
- New token pair introduced without contrast-pair documentation
- Theme override that swaps one token of a pair without re-validating
- Custom color combinations in component code (`text-gray-400` on `bg-white` = ~3:1, fails 4.5)

**Correct pattern**: design-system docs list contrast ratios for token pairs; new pairs validated before merge.

**Quick-fix hint**: new color token introductions; new theme variants.

**See also**: **VVT-068** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code adopts `oklch()` / `oklab()` for token pairs; perceptual-uniformity is NOT the same as WCAG contrast (WCAG uses relative luminance, not Oklab L*), so token-pair contrast validation under this policy must still measure WCAG ratios on the rendered output — VVT-068 names this gotcha explicitly.

---

### VD-COLOR-10: Hover/focus state contrast

**Severity**: POLISH
**Rationale**: Hover state often loses contrast (lightened text on lightened background). Focus rings that pick a color barely-distinct-from-content fail to communicate focus.
**Source**: Material Design 3 color-system — https://m3.material.io/styles/color/system/overview

**The rule**: hover and focus state tokens preserve contrast against the surface; focus rings choose high-contrast colors against both background and adjacent content.

**Code patterns to flag**:
- `:hover { color: var(--text-muted); }` (lower contrast than default — backwards)
- `:focus { outline: 1px solid #DDD; }` (low contrast against any light bg)

**Correct pattern**: hover state slightly increases contrast OR adds an underline / background; focus ring is 2-3px with a high-contrast color.

**Quick-fix hint**: review interactive-state CSS for contrast preservation.

---

### VD-COLOR-11: Color-coding in data viz

**Severity**: MINOR
**Rationale**: Data-visualization that distinguishes categories by color alone fails color-blind users (8% of men, 0.5% of women). Pair color with pattern, label, or shape. Sequential data uses perceptually-uniform palettes (Viridis, Cividis), not rainbow.
**Source**: web.dev color-and-contrast — https://web.dev/learn/css/color

**The rule**: data viz uses color + a second channel (pattern, direct label, icon, shape) for categorical data; sequential data uses perceptually-uniform palettes.

**Code patterns to flag**:
- Chart libraries with default category colors (often non-color-blind-friendly) without override
- Rainbow palette (red→green) for sequential data
- Legend referencing color names only (no shape / pattern)

**Correct pattern**: categorical data: distinct hues + direct labels OR icons; sequential: Viridis-family.

**Quick-fix hint**: chart-library default-palette use; verify color-blind-safe palette selected.

---

### VD-COLOR-12: Color as decoration vs signal

**Severity**: POLISH
**Rationale**: Saturating every UI element with brand color overloads the visual hierarchy — "if everything is highlighted, nothing is." Refactoring UI: most UI surface is grayscale; color is reserved for emphasis, CTAs, status.
**Source**: Refactoring UI Ch.6 color — https://www.refactoringui.com/

**The rule**: most surface (cards, panels, background, body text) is grayscale or near-neutral; brand color reserved for primary CTAs, active states, and signaling.

**Code patterns to flag**:
- Cards with brand-color borders + brand-color headings + brand-color body links (all-brand surface)
- Background gradient using brand colors on every section

**Correct pattern**: grayscale surfaces; primary brand color on primary CTA + active nav item; accent on hover.

**Quick-fix hint**: count brand-color references per surface; if > 3 per card, hierarchy is flat.

---

### VD-COLOR-13: Theme override surface

**Severity**: POLISH
**Rationale**: Components hardcoded with theme-specific colors (light-only) cannot be reused inside a dark-mode override container. CSS custom properties cascade and provide per-subtree theming; hardcoded colors do not.
**Source**: Material Design 3 color-system — https://m3.material.io/styles/color/system/overview

**The rule**: components rely on CSS custom properties for color so a theme override at any ancestor swaps the palette automatically.

**Code patterns to flag**:
- Component CSS using SCSS variables for color (compiled at build, not runtime-swappable)
- React component reading theme from JS prop only (no CSS-var fallback)
- Hardcoded `color: white` inside a card component (breaks if card placed on dark bg)

**Correct pattern**: `.card { color: var(--text-on-surface); }` — cascades from theme root.

**Quick-fix hint**: SCSS color variables in component partials — candidates for migration to CSS custom properties.

---

### VD-COLOR-14: Focus ring color contrast against multiple backgrounds

**Severity**: POLISH
**Rationale**: A focus ring chosen for one background (white card) may be invisible on another (dark card). Single focus-ring color across the app misses this. Either use two-tone rings (outer dark + inner light) or theme the ring with a CSS variable that flips with surface.
**Source**: web.dev focus-rings — https://web.dev/learn/accessibility/focus

**The rule**: focus rings are visible on every surface they appear on. Use ring shadows that compose (outer + inner) or theme-aware ring color tokens.

**Code patterns to flag**:
- `outline: 2px solid blue;` global focus style (invisible on blue surfaces)
- Focus rings using only `outline` without `outline-offset` (can be obscured by adjacent elements)

**Correct pattern**: `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; box-shadow: 0 0 0 4px var(--focus-ring-halo); }`.

**Quick-fix hint**: global focus styles — verify visibility across multiple surface colors.

**See also**: **VVT-063** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code adds or modifies `:focus-visible` rules; this rule defines the design-token policy for theme-aware focus-ring color, VVT-063 flags when code changes warrant runtime check (per-surface contrast verification, UA heuristic behavior, fallback rendering).
