# Visual Design — Spacing & rhythm (VD-SPACE-01..10)

Part of [.aivv/standards/visual-design/](README.md).

### VD-SPACE-01: Baseline spacing scale

**Severity**: POLISH
**Rationale**: Arbitrary spacing values (`margin: 13px`, `padding: 11px 17px`) produce visual disharmony. A scale (multiples of 4px or 8px) creates implicit alignment between unrelated elements.
**Source**: Material Design 3 layout-spacing — https://m3.material.io/foundations/layout/applying-layout/window-size-classes

**The rule**: spacing values come from a 4px or 8px baseline scale (or design tokens). Inline literal margins/padding that bypass the scale are flagged.

**Code patterns to flag**:
- `style={{ marginTop: '13px' }}` (off-grid literal)
- Tailwind `mt-[13px]` arbitrary value when a scale step exists
- Mixed scales across the same surface (Tailwind `gap-4` + inline `margin: 10px`)

**Correct pattern**: `className="mt-3"` (12px on Tailwind default) or `style={{ marginTop: 'var(--space-3)' }}`.

**Quick-fix hint**: search for arbitrary values `\[[0-9]+px\]` and inline `margin:` / `padding:` literals.

---

### VD-SPACE-02: Vertical rhythm via line-height not margin

**Severity**: POLISH
**Rationale**: Stacking margin between paragraphs achieves rhythm but is brittle (margin collapse, conflicts with `gap`). Line-height-based rhythm — body line-height drives implicit vertical rhythm — is more robust.
**Source**: Refactoring UI Ch.4 spacing — https://www.refactoringui.com/

**The rule**: prefer `gap` on flex/grid parents over `margin-bottom` on children for vertical stacking. When `margin` is needed for rhythm, use it consistently (single direction, no conflicting `margin-top` + `margin-bottom` pairs).

**Code patterns to flag**:
- `<div className="space-y-4">` mixed with explicit `margin-top` on children (double-spacing)
- `.stack > * + * { margin-top: 1rem; }` adjacent-sibling reset (works but fragile under sort/filter)
- `<p>` children with both `margin-top` AND `margin-bottom` (collapse-dependent)

**Correct pattern**: parent: `gap-4` on flex/grid, OR `space-y-4` (Tailwind); children: no individual margin.

**Quick-fix hint**: when refactoring stack-spacing, prefer `gap` on the parent.

---

### VD-SPACE-03: Padding inside, margin between

**Severity**: POLISH
**Rationale**: `padding` is inside-the-box (element's own space); `margin` is between-the-box (element's relationship to neighbors). Using margin for internal spacing creates collapse / overflow bugs.
**Source**: Refactoring UI Ch.4 spacing — https://www.refactoringui.com/

**The rule**: spacing *within* a component (e.g., space between icon and label inside a button) uses `padding` or `gap`. Spacing *between* components uses `margin` or `gap` on the parent.

**Code patterns to flag**:
- `<button>` with `margin` between icon and label child elements
- Card-internal spacing achieved via child `margin`
- Wrapper `<div>` with `padding` used to push neighboring component away (should be `margin`)

**Correct pattern**: `<button><Icon /> Save</button>` styled `button { gap: 0.5rem; padding: 0.5rem 1rem; }`; neighboring buttons: `margin-right` or grid `gap`.

**Quick-fix hint**: any `margin` *inside* a component boundary; any `padding` *between* components.

---

### VD-SPACE-04: Touch target minimums

**Severity**: MINOR
**Rationale**: Touch targets < 44×44 CSS pixels (iOS) / < 48×48 (Material) are mis-tappable, especially on mobile. Tap-loss is a measurable conversion cost. Targets include hit areas, not just visible pixel boxes — invisible `padding` counts.
**Source**: Apple HIG layout-and-organization — https://developer.apple.com/design/human-interface-guidelines/layout

**The rule**: interactive elements (`<button>`, `<a>`, form controls, icon-buttons) have computed bounding box ≥ 44×44 (web/iOS) or ≥ 48×48 (Material/Android).

**Code patterns to flag**:
- Icon-only buttons with `w-6 h-6` (24px) hit area
- Inline links in densely-packed lists without padding
- `<button>` with `padding: 0.25rem` on small text (compact total height)

**Correct pattern**: icon-only buttons: `<button className="p-2 -m-2">` (visible 24px icon, 40-44px hit area via padding); inline links: vertical padding or list-item padding.

**Quick-fix hint**: icon-only buttons / interactive icons — measure rendered hit area.

---

### VD-SPACE-05: Whitespace as visual grouping

**Severity**: POLISH
**Rationale**: Gestalt proximity — elements close together are perceived as a group. Inadequate whitespace between groups breaks the grouping signal. Generous whitespace around section boundaries is the cheapest way to communicate hierarchy.
**Source**: Refactoring UI Ch.4 spacing — https://www.refactoringui.com/

**The rule**: spacing between unrelated sections is meaningfully larger than spacing within a section (often 2-3× larger). Uniform spacing everywhere collapses grouping.

**Code patterns to flag**:
- Page with `space-y-4` between every block (sections undifferentiated from rows-within-sections)
- Card lists where card-to-card spacing equals title-to-body spacing inside a card

**Correct pattern**: explicit spacing scale: intra-component (4-8px) < intra-section (12-24px) < inter-section (32-64px).

**Quick-fix hint**: examine top-level page layout; verify section-break spacing dominates row-spacing.

---

### VD-SPACE-06: Asymmetric padding for visual weight

**Severity**: POLISH
**Rationale**: Equal padding all sides (`padding: 16px`) reads as boxy / formal. Slightly more horizontal than vertical padding (`padding: 12px 16px`) feels lighter; vice versa for tall cards. Refactoring UI: deliberate asymmetry is professional.
**Source**: Refactoring UI Ch.4 spacing — https://www.refactoringui.com/

**The rule**: card / button / chip padding uses asymmetric values reflecting content type. Pure-symmetric `padding: N` everywhere is a smell.

**Code patterns to flag**:
- Every button / card / input has `p-4` (uniform 16px)
- No design-token differentiation between button-padding-x and button-padding-y

**Correct pattern**: buttons: `px-4 py-2`; cards: `px-6 py-4`; chips: `px-3 py-1`.

**Quick-fix hint**: review `p-*` Tailwind class usage; symmetric padding is the default — confirm intentional.

---

### VD-SPACE-07: Negative space in compositions

**Severity**: POLISH
**Rationale**: Content squeezed to viewport edges feels cramped. Generous outer margins / container padding (especially on landing / marketing pages) is a quality signal. Refactoring UI: "give content room to breathe."
**Source**: Refactoring UI Ch.4 spacing — https://www.refactoringui.com/

**The rule**: top-level page containers have explicit horizontal padding scaled to viewport. Content does not flush to viewport edges on desktop.

**Code patterns to flag**:
- `<main className="w-full">` without inner `px-*`
- Marketing hero / CTA sections with content at `padding: 0`
- Forms / dialogs where labels touch the modal edge

**Correct pattern**: `<main className="max-w-7xl mx-auto px-6 lg:px-8">` (Tailwind convention).

**Quick-fix hint**: top-level `<main>` / route wrappers — verify horizontal padding.

---

### VD-SPACE-08: Spacing-token consumption consistency

**Severity**: POLISH
**Rationale**: Codebases that drift from "spacing scale" to "use the scale OR an arbitrary value" lose the scale's benefits. Enforcing scale consumption is a maintainability concern.
**Source**: Material Design 3 layout — https://m3.material.io/foundations/layout/understanding-layout/overview

**The rule**: spacing literals appear only in design-token definition sites; consumption sites reference tokens by name (CSS custom property or Tailwind class). Tailwind arbitrary-value spacing (`mt-[17px]`) is flagged as scale drift unless context justifies.

**Code patterns to flag**:
- Mixed `mt-3` and `mt-[12px]` in the same file (12px is mt-3 already — redundant arbitrary form)
- Direct `margin: 16px` in component code when `--space-md` exists
- Arbitrary values for documented scale values

**Correct pattern**: `mt-3` everywhere; arbitrary values reserved for true exceptions with comment.

**Quick-fix hint**: grep for arbitrary-value spacing classes; cross-reference against the design-token list.

---

### VD-SPACE-09: Optical alignment vs mathematical alignment

**Severity**: POLISH
**Rationale**: Icons inside buttons rarely look centered at mathematical center — visual weight is offset by stroke direction or fill density. Manual nudge (1-2px) often required. Slot-based icon-button components should account for this.
**Source**: Refactoring UI Ch.4 spacing — https://www.refactoringui.com/

**The rule**: icon-only button components have configurable optical-centering (slight asymmetric padding) — not blindly centered via `flex: items-center justify-center`.

**Code patterns to flag**:
- Triangle / play / arrow icons centered with pure `justify-center` (visually off-center)
- Asymmetric icons (caret, chevron) without acknowledgment of visual weight imbalance

**Correct pattern**: design-token `--icon-optical-shift-x` applied to specific asymmetric icons via per-icon className.

**Quick-fix hint**: review icon-button component for asymmetric-icon edge cases.

---

### VD-SPACE-10: Layout breakpoint spacing scales

**Severity**: POLISH
**Rationale**: Spacing scales differ between mobile and desktop — 16px gutter on mobile may be 32px on desktop. Hardcoded spacing that doesn't scale with breakpoint produces cramped desktop or sprawling mobile.
**Source**: Material Design 3 layout — https://m3.material.io/foundations/layout/applying-layout/window-size-classes

**The rule**: container padding / section gaps scale at breakpoints (`px-4 md:px-6 lg:px-8`). Single-value padding across all breakpoints is acceptable for non-container content but flagged for top-level layout.

**Code patterns to flag**:
- `<main className="px-4">` (4 = 16px) at all breakpoints
- Section gap (`space-y-8`) that doesn't open up on desktop

**Correct pattern**: `<main className="px-4 sm:px-6 lg:px-8 space-y-12 md:space-y-16 lg:space-y-24">`.

**Quick-fix hint**: top-level layout — verify breakpoint-scaled padding/spacing.
