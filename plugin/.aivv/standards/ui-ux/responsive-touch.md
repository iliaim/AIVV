# UI/UX — Responsive & Touch

Part of [.aivv/standards/ui-ux/](README.md) (UX-018..019).

### UX-018: Include the viewport meta tag; don't disable user scaling

**Severity**: MAJOR
**Rationale**: Missing viewport tag breaks mobile layouts; `user-scalable=no` blocks low-vision users from zooming.
**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag

**The rule**: Every page has `<meta name="viewport" content="width=device-width, initial-scale=1">`. Do not set `maximum-scale=1` or `user-scalable=no`.

**Code patterns to flag**:
- Missing `<meta name="viewport">` in `<head>`
- `user-scalable=no` or `maximum-scale=1` / `maximum-scale=1.0` in viewport content
- `initial-scale` other than `1`

**Correct pattern**:
```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

**Quick-fix hint**: Never lock zoom; zoom accessibility outweighs "pixel-perfect mobile".

---

### UX-019: Interactive targets must have a minimum 24×24 CSS-pixel hit area

**Severity**: MAJOR
**Rationale**: Tiny buttons cause mis-taps, especially on mobile and for motor-impaired users. WCAG 2.2 AA minimum is 24×24 CSS px.
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

**The rule**: Buttons, links, inputs, and custom controls render at `min-height`/`min-width` of 24 CSS pixels (prefer 44×44 where space allows, per Apple HIG).

**Code patterns to flag**:
- Icon-only buttons sized purely by the icon (e.g., 16×16 SVG with no padding / min-size)
- Dense action rows where multiple controls are <24 CSS px apart with no padding
- Tailwind classes like `h-4 w-4` / `p-0` on a clickable element

**Correct pattern**:
```css
button, a[role="button"], [role="menuitem"] {
  min-width: 24px;
  min-height: 24px;
}
```

**Quick-fix hint**: Give icon buttons padding so hit area ≥ 24×24 even if the glyph is smaller.
