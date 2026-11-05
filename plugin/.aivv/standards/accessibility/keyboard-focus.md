# Accessibility — Keyboard & focus

Part of [.aivv/standards/accessibility/](README.md) (A11Y-030..031, A11Y-036..038).

### A11Y-030: Never remove focus outline without providing a replacement

**Severity**: MAJOR
**WCAG**: 2.4.7 Level AA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html

**The rule**: `outline: none` / `outline: 0` on focusable elements without a replacement `:focus` / `:focus-visible` indicator removes keyboard users' only way to see where they are.

**Code patterns to flag**:
- Global `*:focus { outline: none; }` or `a:focus { outline: 0; }` with no replacement rule
- Reset stylesheet that zeroes outline without restoring `:focus-visible`
- `outline: none` on `<button>` / `<a>` / `<input>` inside component CSS with no paired focus style

**Correct pattern**:
```css
:focus { outline: none; }
:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
```

**Quick-fix hint**: If you remove `outline`, always pair with a visible `:focus-visible` style (border/ring/box-shadow).

**See also**: **VVT-063** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code adds or modifies `:focus-visible` rules; this rule defines the WCAG 2.4.7 compliance policy, VVT-063 flags when code changes warrant runtime check (UA heuristic behavior, mouse-click no-ring default, @supports fallback, JS-driven focus paths). **VVT-066** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code adds `appearance: none` on form controls; stripping UA chrome removes the native focus ring and triggers this rule's policy.

---

### A11Y-031: Do not make hidden content focusable

**Severity**: MAJOR
**WCAG**: 2.4.3 Level A
**Source**: https://www.a11yproject.com/checklist/

**The rule**: An element hidden with `display: none` is already out of the tab order, but `visibility: hidden` content, off-screen menus kept visible-for-transition, and `.sr-only` wrappers that accidentally contain interactive children must not remain in the tab order.

**Code patterns to flag**:
- Off-canvas / collapsed nav with focusable descendants and no `inert`, `tabindex="-1"`, or conditional rendering
- Modal overlay that does not remove focus from underlying page content (no `inert` / no focus trap)
- `.visually-hidden` utility used on containers with interactive children

**Correct pattern**:
```html
<!-- closed menu: no focusable descendants in tab order -->
<nav id="menu" hidden>…</nav>

<!-- or with inert (HTML standard) -->
<div inert class="drawer closed">…</div>
```

**Quick-fix hint**: Use `hidden` / `inert` / conditional render to pull the subtree from the tab order when it's not visible.

---

### A11Y-036: Sticky/fixed elements must not fully obscure focused content

**Severity**: MAJOR
**WCAG**: 2.4.11 Level AA (WCAG 2.2 NEW)
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html

**The rule**: When a component receives keyboard focus, at least part of it must remain visible — not entirely hidden by author-created overlays, sticky/fixed headers, sticky footers, or non-modal popovers.

**Code patterns to flag**:
- `position: sticky` / `position: fixed` headers/footers on a scroll container with no `scroll-padding-top` / `scroll-padding-bottom` on the scrollable ancestor
- Skip-link target lands under a sticky header (`scroll-margin-top` missing on anchor targets)
- Cookie banners / chat widgets pinned with `position: fixed` and high `z-index` over an input that can receive focus on scroll-into-view
- Non-modal disclosure panels rendered as overlays that don't shift focus away from underlying focusable content

**Correct pattern**:
```css
html { scroll-padding-top: 4rem; /* matches sticky header height */ }
:target, :focus-visible { scroll-margin-top: 4rem; }
```

**Quick-fix hint**: When introducing or modifying sticky/fixed positioned elements, add `scroll-padding-*` on the scroll container matching the sticky element's size.

**Runtime caveat**: actual obscuring depends on viewport size and scroll position — visual verification confirms the static-review finding.

**See also**: **VVT-063** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code adds or modifies `:focus-visible` rules that may interact with sticky/fixed-overlay placement; this rule defines the WCAG 2.4.11 (AA) Focus Not Obscured Minimum policy, VVT-063 flags when code changes warrant runtime check.

---

### A11Y-037: Focused element must be fully visible (Enhanced)

**Severity**: MINOR
**WCAG**: 2.4.12 Level AAA (WCAG 2.2 NEW)
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-enhanced.html

**The rule**: AAA-level extension of A11Y-036 — no part of the focused component may be obscured by author-created content (not just partially visible).

**Code patterns to flag**: same patterns as A11Y-036 but evaluated against the stricter "no part obscured" criterion. Most authors target AA (A11Y-036) baseline; raise this only when the codebase declares AAA conformance or when a sticky element is large enough to plausibly fully hide common focus targets.

**Quick-fix hint**: Reduce sticky-element footprint or increase `scroll-padding` so the entire focus target remains visible after scroll-into-view.

**See also**: **VVT-063** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code adds or modifies `:focus-visible` rules that may interact with sticky/fixed-overlay placement.

---

### A11Y-038: Focus indicator must meet thickness and contrast minimums

**Severity**: MINOR
**WCAG**: 2.4.13 Level AAA (WCAG 2.2 NEW)
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html

**The rule**: Focus indicators (outline, ring, shadow) must occupy an area at least equivalent to a 2 CSS pixel perimeter around the focused element AND have a contrast ratio of at least 3:1 between the focused and unfocused states. The simpler reading "outline-width ≥ 2px" is the safe conservative interpretation, but thin-line-plus-offset-glow patterns (e.g., 1px outline + 2px outline-offset + 2px outer ring) can also satisfy the SC's area threshold.

**Code patterns to flag**:
- `:focus-visible { outline: 1px solid ... }` (under 2px minimum thickness)
- `box-shadow: 0 0 0 1px ...` used as focus ring (under 2px)
- Focus ring using a near-background color (e.g., light-gray ring on white card) — the 3:1 state-change ratio likely fails
- `outline-style: dotted` with `outline-width: 1px` (visually fragile even when thickness reads as 1px)

**Correct pattern**:
```css
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

**Quick-fix hint**: Use ≥2px outline width with `outline-offset` for separation; pick a color that contrasts both the focused element and its surrounding background.

**Runtime caveat**: actual contrast ratio depends on rendered colors against rendered backgrounds — code review can confirm thickness; visual verification confirms contrast.

**See also**: **VVT-063** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger for `:focus-visible` rules; pair these whenever code adds or modifies focus-indicator styling (VVT-063 flags the trigger; A11Y-038 specifies the WCAG 2.4.13 thickness + contrast policy). **VVT-066** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code adds `appearance: none` on form controls; the custom focus ring that replaces stripped UA chrome must meet this rule's thickness + contrast minimums.
