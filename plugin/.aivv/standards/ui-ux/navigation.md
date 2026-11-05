# UI/UX — Navigation

Part of [.aivv/standards/ui-ux/](README.md) (UX-015..017).

### UX-015: Current page / section indicated with `aria-current`

**Severity**: MAJOR
**Rationale**: A purely visual active-state indicator excludes screen reader users; they don't know where they are.
**Source**: https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/

**The rule**: Active nav items and the final breadcrumb segment carry `aria-current="page"` (or `"location"`, `"step"` as appropriate).

**Code patterns to flag**:
- `<a className={isActive ? 'active' : ''}>` with no `aria-current`
- Breadcrumb last item styled as link, no `aria-current="page"`
- Step indicators with no `aria-current="step"`

**Correct pattern**:
```jsx
<a href={href} aria-current={isActive ? "page" : undefined}>Projects</a>
```

**Quick-fix hint**: Add `aria-current="page"` wherever you add an `.active` class.

---

### UX-016: Provide a skip-link to main content

**Severity**: MAJOR
**Rationale**: Keyboard users shouldn't Tab through dozens of nav links on every page load.
**Source**: https://webaim.org/techniques/skipnav/

**The rule**: The first focusable element in `<body>` is a "Skip to main content" link targeting `#main` (or similar). It may be visually hidden until focused, but must never be `display: none` / `hidden`.

**Code patterns to flag**:
- No `<a href="#main">` before the header
- Skip link hidden with `display: none` (removes from tab order)
- Target anchor (`id="main"`) absent or on a non-focusable element

**Correct pattern**:
```jsx
<a href="#main" className="skip-link">Skip to main content</a>
…
<main id="main" tabIndex={-1}>…</main>
```

**Quick-fix hint**: Use `position: absolute; left: -9999px;` with `:focus` reposition, never `display: none`.

---

### UX-017: Use `<a>` for navigation and `<button>` for actions

**Severity**: MAJOR
**Rationale**: Anchors as action triggers break right-click / middle-click / Cmd-click affordances; buttons as nav break open-in-new-tab and don't work without JS.
**Source**: https://css-tricks.com/use-button-element/

**The rule**: If activation changes the URL or opens a new document, use `<a href>`. If activation triggers behavior on the current page, use `<button type="...">`.

**Code patterns to flag**:
- `<a onClick={doThing}>` with no `href` (or `href="#"`, `href="javascript:void(0)"`)
- `<button onClick={() => navigate('/x')}>` for normal navigation
- `<div onClick={...}>` where a button or link belongs

**Correct pattern**:
```jsx
<a href="/projects/123">View project</a>
<button type="button" onClick={openModal}>Rename</button>
```

**Quick-fix hint**: If it goes somewhere, it's a link; if it does something, it's a button.
