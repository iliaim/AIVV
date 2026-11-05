# Visual Design — Motion (VD-MOTION-01..12)

Part of [.aivv/standards/visual-design/](README.md).

### VD-MOTION-01: Duration range for UI transitions

**Severity**: POLISH
**Rationale**: Motion that lasts too long (> 500ms) feels sluggish; too short (< 100ms) doesn't register. Material 3: 100-250ms for in/out transitions; longer for complex coordinated motion. Apple HIG: 0.25-0.5s for most UI motion.
**Source**: Material Design 3 motion-easing-and-duration — https://m3.material.io/styles/motion/easing-and-duration/tokens-specs

**The rule**: UI transition durations fall in the 100-300ms band for simple state changes; 300-500ms for complex multi-element motion; > 500ms reserved for narrative animation.

**Code patterns to flag**:
- `transition: all 1s;` (1000ms — too slow for UI)
- `transition: all 50ms;` (too fast to perceive smoothly)
- `animation-duration: 2s` on a button-hover state

**Correct pattern**: `transition: background-color 150ms ease-out;` for hover; `transition: transform 250ms ease-in-out;` for entrance.

**Quick-fix hint**: grep `transition:` and `animation-duration:` — outliers > 500ms or < 100ms.

---

### VD-MOTION-02: Easing curves, not linear

**Severity**: POLISH
**Rationale**: Linear easing produces robotic motion. Natural motion accelerates and decelerates — ease-in (start slow, end fast) for exits, ease-out (start fast, end slow) for entrances, ease-in-out for round-trips. Linear reserved for infinite loops (spinners) where ease creates jank.
**Source**: Material Design 3 easing — https://m3.material.io/styles/motion/easing-and-duration

**The rule**: transitions use easing curves matched to motion type. `transition-timing-function: linear` is flagged outside spinner contexts.

**Code patterns to flag**:
- `transition: ... linear` on entrance / exit animations
- No `transition-timing-function` (defaults to ease, which is acceptable, but explicit is better)
- Custom cubic-bezier with extreme overshoot for everyday UI

**Correct pattern**: entrance: `ease-out`; exit: `ease-in`; round-trip: `ease-in-out`; spinner: `linear infinite`.

**Quick-fix hint**: `transition.*linear` matches; `animation:` with `linear` on non-infinite animations.

---

### VD-MOTION-03: prefers-reduced-motion (defer-to A11Y-033)

**Severity**: MINOR
**Rationale**: Users with vestibular disorders or motion sensitivity have OS-level `prefers-reduced-motion` set. Sites that ignore this trigger headaches, nausea, dizziness. The WCAG-compliance variant lives at A11Y-033 ("Respect `prefers-reduced-motion`", severity MAJOR per `accessibility/color-motion.md`); VD-MOTION-03 surfaces the aesthetic+accessibility intersection.
**Source**: web.dev prefers-reduced-motion — https://web.dev/articles/prefers-reduced-motion

**The rule**: motion is wrapped in `@media (prefers-reduced-motion: no-preference) { ... }` or `@media (prefers-reduced-motion: reduce)` opt-out, OR animations are kept subtle (no large translates, no parallax, no full-page transitions).

**Code patterns to flag**:
- `animation: slide-in 500ms` without `prefers-reduced-motion` guard
- Hero parallax scroll without reduced-motion fallback
- Auto-playing background video without `prefers-reduced-motion` check

**Correct pattern**:
```css
@media (prefers-reduced-motion: no-preference) {
  .card { transition: transform 250ms ease-out; }
}
```

**Quick-fix hint**: any `transform:` / `animation:` declaration — should have a reduced-motion guard.

**See also**: **VVT-054** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code authors a `@media (prefers-reduced-motion: …)` block; this rule defines the aesthetic+accessibility intersection policy, VVT-054 flags when code changes warrant runtime verification (OS-toggle test, cascade integrity, JS-driven motion path coverage). **VVT-065** (`visual-verification-triggers/responsive.md`) — runtime-verification trigger when code authors CSS scroll-snap; the aesthetic+a11y intersection here applies — scroll-snap should respect reduced-motion preference per this rule's policy. **VVT-069** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger for CSS scroll-driven animations (`animation-timeline: scroll()` / `view()`); pair when scroll-bound animation surfaces are added, since they require a reduced-motion alternative per this rule's aesthetic+a11y intersection. **VVT-071** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger for CSS `interpolate-size`; intrinsic-size animations (height/width from `0` to `auto`) fall under the aesthetic+a11y intersection — require a reduced-motion alternative per this rule's policy.

---

### VD-MOTION-04: GPU-only animated properties

**Severity**: POLISH
**Rationale**: Animating `top` / `left` / `width` / `height` triggers layout + paint, capping at ~30fps under load. Animating `transform` / `opacity` runs on the compositor at 60fps. The performance budget is 16ms/frame; non-compositor animations rarely hit it.
**Source**: web.dev animations-guide — https://web.dev/articles/animations-guide

**The rule**: continuous / interaction-driven animations use only `transform` and `opacity`. Layout-triggering properties (`width`, `height`, `top`, `left`, `padding`, `margin`) reserved for one-off transitions.

**Code patterns to flag**:
- `@keyframes slide { from { left: 0 } to { left: 100% } }` (animate transform instead)
- `transition: width 300ms` on hover
- `transition: padding 200ms` for "growing" cards

**Correct pattern**: `@keyframes slide { from { transform: translateX(0) } to { transform: translateX(100%) } }`.

**Quick-fix hint**: `transition:` / `@keyframes` animating layout properties.

**See also**: **VVT-069** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger for CSS scroll-driven animations (`animation-timeline: scroll()` / `view()`); the GPU-friendly-property discipline here applies directly to scroll-driven animations, where main-thread work during scroll produces immediately-visible jank.

---

### VD-MOTION-05: will-change overuse

**Severity**: POLISH
**Rationale**: `will-change: transform` creates a new compositor layer — good for active animations, costly when applied speculatively. Spamming `will-change` on every interactive element bloats memory.
**Source**: web.dev will-change — https://developer.mozilla.org/en-US/docs/Web/CSS/will-change

**The rule**: `will-change` applied only to elements actively animating (set right before, unset right after) — not preemptively on every button.

**Code patterns to flag**:
- Global `* { will-change: auto }` or per-element `will-change` set in stylesheet (always-on)
- Component CSS with `will-change: transform` as a permanent declaration

**Correct pattern**: set `will-change` via JS just before animation starts (`element.style.willChange = 'transform'`), unset after (`element.style.willChange = 'auto'`).

**Quick-fix hint**: stylesheet `will-change:` declarations — verify they're for actively-animating elements.

---

### VD-MOTION-06: Animation jank from layout-triggering CSS

**Severity**: POLISH
**Rationale**: Even when the animated property is `transform`, sibling reflows can jank the animation. Animating an element that triggers neighbor layout changes (e.g., expanding accordion that pushes next item) produces stutter.
**Source**: web.dev animations-guide — https://web.dev/articles/animations-guide

**The rule**: expanding / collapsing surfaces use `max-height` transition cautiously or use a grid-row-template trick that the compositor can handle; alternative is FLIP (First-Last-Invert-Play) pattern via Web Animations API.

**Code patterns to flag**:
- `transition: height 300ms` on accordion (always janks for variable content)
- `transition: max-height 300ms` on accordion with `max-height: 9999px` open (works but easing applies to placeholder height)

**Correct pattern**: `grid-template-rows: 0fr` ↔ `1fr` transition (modern CSS); or FLIP via `getBoundingClientRect` + `transform`.

**Quick-fix hint**: `transition: height` / `max-height` on collapsible surfaces.

**See also**: **VVT-069** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger for CSS scroll-driven animations; layout-triggering properties bound to scroll progress produce continuous jank during scroll (the failure mode this rule warns about is amplified when the animation is scroll-bound rather than time-bound).

---

### VD-MOTION-07: Animation fill-mode correctness

**Severity**: POLISH
**Rationale**: `@keyframes` without explicit `animation-fill-mode` leaves elements snapping back to initial state after the animation ends. `animation-fill-mode: forwards` retains the end state.
**Source**: MDN animation-fill-mode — https://developer.mozilla.org/en-US/docs/Web/CSS/animation-fill-mode

**The rule**: animations where the end state should persist set `animation-fill-mode: forwards`. Bare `animation:` with no fill-mode is a common bug for fade-in patterns.

**Code patterns to flag**:
- `animation: fadeIn 300ms;` (snaps back to opacity 0 at end)
- Element animates to visible, then disappears
- Notification toast animates in, snaps out

**Correct pattern**: `animation: fadeIn 300ms ease-out forwards;` or via Web Animations API `commitStyles()`.

**Quick-fix hint**: `animation:` shorthand without `forwards` / `both` keyword.

---

### VD-MOTION-08: Spring / physics-based motion

**Severity**: POLISH
**Rationale**: For UI motion that needs to feel responsive (drag, swipe, gesture-driven), spring physics (overshoot + settle) feels more natural than fixed-duration easing. Modern frameworks (Framer Motion, React Spring) expose this.
**Source**: Apple HIG motion — https://developer.apple.com/design/human-interface-guidelines/motion

**The rule**: gesture-driven motion uses spring physics; non-gesture UI transitions use timed easing. Mixing creates inconsistent feel.

**Code patterns to flag**:
- Drag-to-dismiss with fixed-duration `transition`
- Swipe-to-delete with linear timing
- Pull-to-refresh without overshoot

**Correct pattern**: gesture-driven: `<motion.div animate={{ x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} />`.

**Quick-fix hint**: gesture handlers (drag / swipe / pan) using timed easing.

---

### VD-MOTION-09: Sequential motion choreography

**Severity**: POLISH
**Rationale**: Multiple elements animating simultaneously can overwhelm. Staggered / sequential motion (each child enters 50-100ms after the previous) draws the eye through the sequence and feels intentional.
**Source**: Material Design 3 motion — https://m3.material.io/styles/motion/overview

**The rule**: list / grid entrance animations stagger child animations by 30-100ms each, not all-at-once.

**Code patterns to flag**:
- List entrance with all items `animation-delay: 0`
- Modal entrance with all child elements animating in parallel

**Correct pattern**: `animation-delay: calc(var(--index) * 50ms);` or Framer Motion `staggerChildren: 0.05`.

**Quick-fix hint**: list / grid mount animations — verify staggered delay.

---

### VD-MOTION-10: Hover transition coverage

**Severity**: POLISH
**Rationale**: A button with `:hover { background: ... }` but no `transition` switches color instantly — feels mechanical. Adding a 150-200ms transition makes the hover feel intentional.
**Source**: Refactoring UI Ch.9 finishing-touches — https://www.refactoringui.com/

**The rule**: interactive elements with hover state declarations include matching transitions for the changed properties.

**Code patterns to flag**:
- `button:hover { background: blue; }` without `button { transition: background-color 150ms; }`
- Hover states with `transition: all` (cheap but wasteful — pick specific properties)

**Correct pattern**: `button { transition: background-color 150ms ease-out, color 150ms ease-out; }` paired with hover.

**Quick-fix hint**: `:hover` declarations — verify matching `transition` on the base element.

---

### VD-MOTION-11: Loading-state motion ergonomics

**Severity**: POLISH
**Rationale**: Indeterminate loading (spinner) hides indefinite wait. Determinate progress (progress bar / percentage) is more informative when duration is knowable. Skeleton screens are best for content-shaped loads (list / card placeholders).
**Source**: Material Design 3 motion — https://m3.material.io/styles/motion/overview

**The rule**: choose loading affordance based on what's loading: spinner for indeterminate < 5s; progress bar for determinate / longer; skeleton for content with known shape.

**Code patterns to flag**:
- Spinner used for a content-list load (skeleton would be more informative)
- Progress bar shown without `aria-valuenow` update (defer-to-A11Y for compliance)
- Spinner that pulses / changes speed unpredictably

**Correct pattern**: list page-load: skeleton; form submit: spinner inside button; file upload: progress bar.

**Quick-fix hint**: loading-state components — match affordance to load shape.

---

### VD-MOTION-12: Auto-advance / carousel motion ethics

**Severity**: MINOR
**Rationale**: Auto-advancing carousels (banners, hero slideshows) without user control distract from content, fail accessibility (WCAG 2.2.2 Pause/Stop/Hide), and are flagged as dark-pattern when used to push content past the user. A11Y-022 ("`<video>`/`<audio>` must not autoplay with sound") is the closest existing code-reviewable compliance variant; full WCAG 2.2.2 Pause/Stop/Hide for carousels has no shipped A11Y rule yet — `compliance.md` (planned dev.60+) will cover it. `dark-patterns/` (planned dev.55+, shipped dev.56) covers the manipulation variant.
**Source**: web.dev carousel-best-practices — https://web.dev/articles/carousel-best-practices

**The rule**: auto-advancing motion (carousels, slideshows, ticker tape) is user-pausable via visible control, OR auto-advance is disabled by default and user opts in.

**Code patterns to flag**:
- `<Carousel autoplay={true} interval={3000} />` without pause control
- Banner ad slideshow with no stop button

**Correct pattern**: `<Carousel autoplay={true} pauseOnHover pauseOnFocus showPauseButton />` or `autoplay={false}` default.

**Quick-fix hint**: carousel / slideshow components — verify pause controls.

**See also**: **VVT-065** (`visual-verification-triggers/responsive.md`) — runtime-verification trigger when code authors CSS scroll-snap; scroll-snap-implemented carousels intersect this rule's auto-advance / pause-control policy. Pair these triggers whenever scroll-snap is used in a carousel-pattern.
