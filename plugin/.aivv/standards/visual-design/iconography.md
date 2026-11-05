# Visual Design — Iconography (VD-ICON-01..08)

Part of [.aivv/standards/visual-design/](README.md).

**i18n composition note (dev.104+):** The VD-ICON-* iconography-design rules compose with **I18N-RTL-04** (`i18n/rtl-bidi.md`, "Directional icons mirror under RTL; non-directional icons do NOT mirror") on the RTL-safety surface. VD-ICON-* governs icon-design baselines (single-family consistency, weight, optical alignment, semantic clarity); I18N-RTL-04 governs the per-icon mirror-decision under RTL locales (arrows + chevrons + back-buttons + undo arrows DO mirror; search magnifier + info + warning + brand logos + media-time-direction-icons do NOT mirror). The two layers compose: a well-designed icon set per VD-ICON-* baselines, with RTL-04's mirror-decision applied per icon kind, produces a coherent RTL UI.

### VD-ICON-01: Single icon set consistency

**Severity**: POLISH
**Rationale**: Mixing icon families (Material Symbols + Heroicons + Lucide in the same UI) produces visual inconsistency — different stroke weights, grid sizes, optical alignment. One family per project is the conventional baseline.
**Source**: Material Symbols guidelines — https://fonts.google.com/icons

**The rule**: one icon family is the default; secondary families allowed only for context-specific gaps (brand logos, specialized domain icons) with explicit justification.

**Code patterns to flag**:
- Imports from multiple icon libraries in the same file (`@heroicons/react` + `lucide-react`)
- Inline SVG icons mixed with library icons at different stroke weights / grid sizes
- Migration leftovers (old icon library still imported alongside new one)

**Correct pattern**: single library import; SVG icons hand-authored to match family grid + stroke weight.

**Quick-fix hint**: scan import statements for icon libraries; > 1 family in same surface is a smell.

---

### VD-ICON-02: Icon + label for ambiguous icons

**Severity**: MINOR
**Rationale**: Icons without labels fail when the icon's meaning is non-obvious (gear=settings is conventional; gear+star=??? is not). Industry research (NN/g) shows icon-only buttons have higher mis-tap rates than icon+label. Defer-to A11Y-027 (lives in `accessibility/aria/fundamentals.md` per dev.80 nested retrofit — "Accessible name must include visible label") and A11Y-021 (lives in `accessibility/images-media.md` per dev.61 retrofit — "Inline SVG needs accessible naming or hiding") for the compliance variants.
**Source**: Apple HIG sf-symbols — https://developer.apple.com/design/human-interface-guidelines/sf-symbols

**The rule**: icons used as buttons are paired with text labels (visible or tooltip-on-hover) unless the icon is universally recognizable (×=close, ?=help, gear=settings, magnifying-glass=search).

**Code patterns to flag**:
- Icon-only buttons for non-conventional actions (`<IconButton><CustomIcon /></IconButton>` for "Export to PDF")
- Toolbar with row of icon-only buttons (cognitive load high)
- Mobile nav with icon-only tabs (label fits)

**Correct pattern**: icon + visible label, OR icon + tooltip for space-constrained surfaces, OR icon-only ONLY for universally-recognized actions.

**Quick-fix hint**: list icon-only buttons; verify recognizability.

---

### VD-ICON-03: Accessible icon-only buttons (defer-to A11Y-021 + A11Y-026 + A11Y-027)

**Severity**: MINOR
**Rationale**: Icon-only buttons without an accessible name are invisible to screen readers. `aria-label` or `aria-labelledby` is required. The WCAG-compliance variants live at A11Y-021 (lives in `accessibility/images-media.md` per dev.61 retrofit — inline SVG accessible naming), A11Y-026 + A11Y-027 (live in `accessibility/aria/fundamentals.md` per dev.80 nested retrofit — `aria-label`/`aria-labelledby` valid target + Label-in-Name); VD-ICON-03 surfaces the aesthetic+accessibility intersection.
**Source**: MDN ARIA button role — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/button_role (cross-reference: ARIA APG button pattern)

**The rule**: every icon-only `<button>` has an accessible name via `aria-label`. Defer-to A11Y-021 (in `accessibility/images-media.md`) / A11Y-026 + A11Y-027 (in `accessibility/aria/fundamentals.md`) for the compliance variants (all MAJOR severity).

**Code patterns to flag**:
- `<button><CloseIcon /></button>` without aria-label
- `<button aria-label=""><Icon /></button>` (empty)
- `<button title="Close"><CloseIcon /></button>` (title alone isn't enough for screen readers)

**Correct pattern**: `<button aria-label="Close dialog"><CloseIcon /></button>`.

**Quick-fix hint**: every icon-only button needs aria-label — quick grep.

---

### VD-ICON-04: Filled vs outline state consistency

**Severity**: POLISH
**Rationale**: Material Design + Apple HIG conventions: filled icons signal active/selected state, outline icons signal inactive/default. Inverting this convention or mixing in the same surface confuses users.
**Source**: Material Symbols guidelines — https://fonts.google.com/icons

**The rule**: in a UI surface where filled/outline icons coexist, the filled variant maps consistently to active state (or inactive — pick one, hold it).

**Code patterns to flag**:
- Tab bar where some active tabs use filled icons, others outline
- Nav list where filled and outline are mixed without state correspondence

**Correct pattern**: tab bar: outline default, filled when active; same applied to bottom-nav, settings list, etc.

**Quick-fix hint**: review active-state-icon rendering for filled/outline consistency.

---

### VD-ICON-05: Icon sizing via em not px

**Severity**: POLISH
**Rationale**: Icons sized in `px` don't scale with text. Sized in `em` (or relative units), icons grow / shrink with their surrounding text — useful for icon + text in headings vs body.
**Source**: MDN font-size relative units — https://developer.mozilla.org/en-US/docs/Web/CSS/font-size

**The rule**: inline icons inside text contexts size in `em` (or `1em` Tailwind `size-[1em]`); standalone-icon-in-button can size in `px` because it's not inside running text.

**Code patterns to flag**:
- Inline `<Icon className="w-4 h-4" />` next to heading text (icon doesn't scale with heading)
- Bullet-list icons fixed at `w-5 h-5` regardless of list-item text size

**Correct pattern**: `<Icon className="w-[1em] h-[1em]" />` inline with text; `<Icon className="w-5 h-5" />` standalone.

**Quick-fix hint**: icons inside `<h*>` / `<p>` / `<li>` text contexts — verify em-sizing.

---

### VD-ICON-06: SVG sprite vs inline tradeoffs

**Severity**: POLISH
**Rationale**: Inline SVG inflates JSX / HTML payload but allows per-instance styling (CSS color, transitions). SVG sprite (`<use href="#icon-foo">`) deduplicates but loses some styling flexibility. Choose deliberately; mixing both in the same project is fragmenting.
**Source**: MDN SVG use element — https://developer.mozilla.org/en-US/docs/Web/SVG/Element/use

**The rule**: project commits to one icon-distribution pattern (inline SVG component, sprite via `<use>`, or icon-font). Mixed patterns flagged unless context justifies (e.g., decorative one-offs inline + main set as sprite).

**Code patterns to flag**:
- Some icons imported as React components, others as `<use>` references
- Icon-font (Font Awesome) mixed with SVG icons

**Correct pattern**: one source of truth per project; documented choice.

**Quick-fix hint**: audit icon imports / `<use>` references — count source patterns.

---

### VD-ICON-07: Decorative icons hidden from assistive tech

**Severity**: MINOR
**Rationale**: Decorative icons (a bullet star next to a list item, a paragraph-flourish glyph) that are read by screen readers add noise. They should have `aria-hidden="true"`. The text content remains the accessible semantic. Defer-to A11Y-021 (lives in `accessibility/images-media.md` per dev.61 retrofit — "Inline SVG needs accessible naming or hiding") and A11Y-025 (lives in `accessibility/aria/fundamentals.md` per dev.80 nested retrofit — "Do not put `aria-hidden=true` on focusable elements") for the compliance variants.
**Source**: MDN aria-hidden — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden

**The rule**: decorative icons (icons whose meaning is fully captured by adjacent text) carry `aria-hidden="true"` to suppress duplicate screen-reader announcement.

**Code patterns to flag**:
- `<Icon>` next to label text without `aria-hidden="true"` (assistive tech announces "image" plus label)
- Bullet / star / arrow icons rendered as SVG without `aria-hidden`

**Correct pattern**: `<Icon aria-hidden="true" />` next to descriptive text label.

**Quick-fix hint**: decorative icons paired with labels — verify aria-hidden.

---

### VD-ICON-08: Icon style consistency at multiple sizes

**Severity**: POLISH
**Rationale**: Icons designed for one size (24px) but rendered at another (16px) often look wrong — strokes too thick or too thin. Icon families that ship multi-size variants (Material Symbols 20/24/40/48; SF Symbols S/M/L) should be sized to their designed grid.
**Source**: Material Symbols guidelines — https://fonts.google.com/icons

**The rule**: icons render at their designed sizes (or close to them). Arbitrary scaling between native sizes (rendering 24px-designed icon at 17px) produces stroke artifacts.

**Code patterns to flag**:
- Material Symbols rendered at `font-size: 17px` (not on designed grid)
- Heroicons rendered at `w-3 h-3` (12px, below designed 16px minimum)

**Correct pattern**: stick to icon-family designed sizes; if smaller needed, choose a smaller-designed variant.

**Quick-fix hint**: icon sizes outside the family's documented sizes — flag.
