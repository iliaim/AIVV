# Visual Verification Triggers — Responsive and mobile-specific changes

Part of [.aivv/standards/visual-verification-triggers/](README.md) (VVT-023..025, VVT-065). Extended dev.92 = T23 phase 7 — CSS scroll-snap (`scroll-snap-type`, `scroll-snap-align`, Baseline 2022) appended per the dev.86 by-domain partition policy.

### VVT-023: Viewport meta or document-level scaling change

**Pattern (diff-observable)**:
- File/path match: `**/index.html`, `**/app/layout.*`, `**/_document.*`, `**/head.*`
- Content match: changed `<meta name="viewport" ...>` content, new `user-scalable=no`, changed `initial-scale`/`maximum-scale`

**Why runtime verification is needed**: The viewport meta tag globally affects mobile rendering; regressions are invisible until testing on device or emulation.

**What to verify externally**:
- Pinch-zoom still works (WCAG 1.4.4 — do not disable user scaling)
- Content fits at 320px width without horizontal scroll
- Text remains legible at default zoom

**Suggested tooling**: Chrome DevTools-class in-browser inspection (device emulation) | real device test

---

### VVT-024: Touch-target sizing or hit-area change

**Pattern (diff-observable)**:
- Content match: changes to `padding`/`min-height`/`min-width` on interactive elements (buttons, links, checkboxes), Tailwind `p-*`/`h-*`/`w-*` on `<button>`/`<a>`/`<input>`, new `hit-slop` style props

**Why runtime verification is needed**: WCAG 2.5.5 requires 44x44 CSS pixel minimum for touch targets; computed-box size depends on box-sizing, borders, and padding interaction not obvious in the hunk.

**What to verify externally**:
- Interactive elements are at least 44x44 CSS pixels
- No accidental overlap between adjacent touch targets

**Suggested tooling**: Chrome DevTools-class in-browser inspection (measure tool) | aXe DevTools

---

### VVT-025: Orientation- or hover-capability-specific code

**Pattern (diff-observable)**:
- Content match: `@media (orientation: ...)`, `@media (hover: hover)`, `@media (pointer: coarse|fine)`, `matchMedia` calls referencing these

**Why runtime verification is needed**: Hover-only affordances on touch devices are a common accessibility regression; orientation queries need real-device or emulation verification.

**What to verify externally**:
- All hover-revealed content is also reachable via tap/focus on touch devices
- Portrait + landscape layouts both render without breakage

**Suggested tooling**: Chrome DevTools-class in-browser inspection (touch emulation) | real device test

---

### VVT-065: CSS scroll-snap (`scroll-snap-type`, `scroll-snap-align`) additions or changes — Baseline Widely available since April 2022

**Pattern (diff-observable)**:
- Content match: added or modified `scroll-snap-type: <axis> <strictness>` declarations on scroll containers (values: `x`/`y`/`block`/`inline`/`both` axis + `mandatory`/`proximity` strictness); added `scroll-snap-align: start | center | end | none` declarations on snap children; new `scroll-margin` / `scroll-padding` declarations interacting with snap points
- File/path match: any stylesheet, carousel / paginated-list / horizontal-scroll-shelf component styles; `overflow-x: scroll` or `overflow-y: scroll` containers gaining snap behavior

**Why runtime verification is needed**: scroll-snap controls how scroll positions resolve as the user scrolls — but the actual snap behavior, including animation curves, snap-interruption handling, and input-method interaction, is implementation-defined. Per MDN scroll-snap-type spec: the property defines scroll-snap behavior but the specific animations or physics used to enforce snap points are not standardized; browser implementation details are left to the user agent. Diff review shows the snap configuration but cannot reveal: (a) **mandatory vs proximity behavior at edge cases** — `mandatory` forces snap; `proximity` snaps only when close. The user-experience difference between the two is meaningful: `mandatory` on a viewport-height-larger child can trap the user mid-content; verify the strictness choice matches design intent; (b) **touch-scroll vs mouse-wheel vs trackpad differences** — touch flick momentum, mouse-wheel discrete steps, and trackpad continuous scroll interact with snap differently across UAs; verify the snap feel matches design intent on each input method; (c) **`prefers-reduced-motion` interaction** — scroll-snap animation is motion; per WCAG and a11y best practice, reduced-motion users should see less-aggressive snap (or none); MDN does not explicitly mandate the UA respect `prefers-reduced-motion` for snap, but the discipline-by-design pattern is to wrap mandatory snap in `@media (prefers-reduced-motion: no-preference) { ... scroll-snap-type: x mandatory; ... }` so reduced-motion users get free scroll; (d) **keyboard scroll** — Arrow keys / Page Up / Page Down on a focused snap-container snap to next/previous snap point in supporting browsers; verify keyboard-only users can traverse the snapped items coherently; (e) **`scroll-snap-stop: always` / `normal`** — `always` prevents scrolling past an item during fast scroll; `normal` (default) allows momentum past; verify the chosen behavior matches design intent; (f) **child overflow + snap collision** — when a snap child is taller than the viewport, `mandatory` can trap the user; consider `scroll-snap-stop: normal` or `proximity` strictness.

**What to verify externally**:
- Touch-scroll on real devices (iOS Safari + Android Chrome): snap feel matches design intent; momentum + snap interaction is smooth
- Mouse-wheel + trackpad scroll on desktop: snap behavior is acceptable at varying scroll velocities
- `prefers-reduced-motion: reduce` user: verify scroll-snap is wrapped in `@media (prefers-reduced-motion: no-preference)` or otherwise opts out; reduced-motion users get unobstructed free scroll
- Keyboard traversal (Arrow / Page Up / Page Down on focused container): snap point progression is coherent
- Tall child interaction: scrolling past a viewport-larger snap child does NOT trap the user
- Cross-browser parity: snap feel + edge-case behavior verified across Chrome / Safari / Firefox / Edge (implementations diverge on physics)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type (per-feature page; Baseline banner verbatim: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since April 2022"; axis values `none` / `x` / `y` / `block` / `inline` / `both`; strictness values `mandatory` / `proximity`)

**See also**: **VVT-054** (`css-styling.md`) for `prefers-reduced-motion` — required pairing whenever scroll-snap is added; reduced-motion users should not be forced into snap behavior. **VVT-025** for orientation- and hover-capability-specific code — pair when scroll-snap is gated on `@media (pointer: coarse)` or `(hover: none)` (touch-only snap pattern). **VVT-024** for touch-target sizing — snap-child touch targets must still meet 44x44 CSS pixel minimum. **Cross-catalog peers**: **A11Y-033** (`accessibility/color-motion.md`, "Respect `prefers-reduced-motion`") + **A11Y-070** (same file, COGA broader animation policy) — the WCAG/COGA compliance authority for the prefers-reduced-motion pairing this trigger requires; VVT-065 is the runtime-verification trigger when code authors scroll-snap that must respect those policies. **VD-MOTION-03** (`visual-design/motion.md`, "prefers-reduced-motion (defer-to A11Y-033)") — the aesthetic+a11y intersection policy. **VD-MOTION-12** (same file, "Auto-advance / carousel motion ethics") — directly relevant when scroll-snap is used in carousel patterns; pair these triggers whenever scroll-snap implements a carousel.

**Suggested tooling**: Real-device testing on iOS Safari + Android Chrome (touch + momentum + snap interaction) | Chrome DevTools-class Rendering panel (emulate prefers-reduced-motion) | Playwright-class browser automation with `page.mouse.wheel()` + `page.evaluate` scroll-position assertions
