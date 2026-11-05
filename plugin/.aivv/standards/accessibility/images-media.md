# Accessibility — Images & media

Part of [.aivv/standards/accessibility/](README.md) (A11Y-020..023).

### A11Y-020: Every `<img>` must have an `alt` attribute

**Severity**: CRITICAL
**WCAG**: 1.1.1 Level A
**Source**: https://www.w3.org/WAI/tutorials/images/

**The rule**: Every `<img>` must carry `alt`. Informative images get a descriptive value; purely decorative images get `alt=""` (present, empty).

**Code patterns to flag**:
- `<img>` with no `alt` attribute at all
- `alt` containing the filename (e.g., `alt="hero_v2_final.png"`)
- `alt="image"` / `alt="photo"` / `alt="icon"` (generic, non-informative)
- Alt text repeating adjacent visible caption verbatim (redundant)
- Decorative image with descriptive alt (should be `alt=""`)

**Correct pattern**:
```jsx
<img src="/chart.png" alt="Revenue rose 18% from Q1 to Q2." />
<img src="/divider.svg" alt="" />           {/* decorative */}
```

**Quick-fix hint**: Add meaningful `alt` for informative images; `alt=""` for decoration. Never omit the attribute.

---

### A11Y-021: Inline SVG needs accessible naming or hiding

**Severity**: MAJOR
**WCAG**: 1.1.1 Level A, 4.1.2 Level A
**Source**: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/role

**The rule**: Inline `<svg>` that conveys meaning needs `role="img"` plus an accessible name (`<title>` referenced by `aria-labelledby`, or `aria-label`). Decorative SVGs need `aria-hidden="true"` (and often `focusable="false"`).

**Code patterns to flag**:
- Informative inline `<svg>` with no `<title>`, no `aria-label`, no `aria-labelledby`
- Decorative inline `<svg>` with no `aria-hidden="true"` inside an otherwise-named button
- `<title>` that is not the first child of its `<svg>` parent
- Interactive SVG missing `tabindex="0"` when intended to be focusable

**Correct pattern**:
```html
<svg role="img" aria-labelledby="chartTitle" viewBox="…">
  <title id="chartTitle">Revenue by quarter</title>
  …
</svg>

<button type="button" aria-label="Close">
  <svg aria-hidden="true" focusable="false" viewBox="…"><path …/></svg>
</button>
```

**Quick-fix hint**: Decide informative vs decorative; add `role="img"` + `<title>`, or `aria-hidden="true"`.

---

### A11Y-022: `<video>` and `<audio>` must not autoplay with sound

**Severity**: MAJOR
**WCAG**: 1.4.2 Level A
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/audio-control.html

**The rule**: Media that plays automatically for more than 3 seconds must have a pause/stop/mute mechanism; the safe default in code review is: flag any `autoplay` that is not also `muted`.

**Code patterns to flag**:
- `<video autoplay>` without `muted`
- `<audio autoplay>`
- JS calling `.play()` on page load without user gesture

**Correct pattern**:
```html
<video src="/hero.mp4" autoplay muted loop playsinline></video>
```

**Quick-fix hint**: Remove `autoplay`, or pair with `muted` and provide controls.

---

### A11Y-023: Video needs a captions `<track>`

**Severity**: MAJOR
**WCAG**: 1.2.2 Level A
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/captions-prerecorded.html

**The rule**: Pre-recorded `<video>` with audio must include a `<track kind="captions">` (or `subtitles`) referencing a captions file.

**Code patterns to flag**:
- `<video>` with audio content and no `<track kind="captions">`
- `<track>` with a `src` that does not resolve (404) — code review can catch by pointing at non-existent path
- Missing `srclang` or `label` on `<track>`

**Correct pattern**:
```html
<video controls>
  <source src="/intro.mp4" type="video/mp4">
  <track kind="captions" src="/intro.en.vtt" srclang="en" label="English" default>
</video>
```

**Quick-fix hint**: Add a `<track kind="captions">` pointing at a VTT captions file.
