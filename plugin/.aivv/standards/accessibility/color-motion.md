# Accessibility — Color, meaning, and motion

Part of [.aivv/standards/accessibility/](README.md) (A11Y-032..035, A11Y-070..071).

### A11Y-032: Do not convey information by color alone

**Severity**: MAJOR
**WCAG**: 1.4.1 Level A
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html

**The rule**: Any information signaled by color (required fields, errors, success, link state, chart series) must also be conveyed by text, icon, pattern, or underline.

**Code patterns to flag**:
- Error state rendered only as `color: red` on input text with no icon / text / `aria-invalid`
- Chart legend that distinguishes series by color only (no label, no pattern, no marker shape in markup)
- Links in body text styled `text-decoration: none` with color as the sole differentiator from surrounding text
- Required field shown purely by red border

**Correct pattern**:
```jsx
<label htmlFor="email">
  Email <span aria-hidden="true">*</span>
</label>
<input id="email" required aria-invalid={hasError} aria-describedby="email-err" />
{hasError && <p id="email-err"><Icon name="warning" aria-hidden="true" /> Enter a valid email.</p>}
```

**Quick-fix hint**: Pair color with an icon, a label, or `aria-*` state so the signal survives in grayscale or for colorblind users.

---

### A11Y-033: Respect `prefers-reduced-motion`

**Severity**: MAJOR
**WCAG**: 2.3.3 Level AAA (widely treated as AA baseline)
**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

**The rule**: Non-essential animations, transitions, and auto-scrolling must be reduced or removed when the user has requested reduced motion.

**Code patterns to flag**:
- Large-movement animations / parallax / autoplaying sliders with no `@media (prefers-reduced-motion: reduce)` override
- JS animation libraries (GSAP, Framer Motion, Lottie autoplay) with no guard on `window.matchMedia('(prefers-reduced-motion: reduce)').matches`

**Correct pattern**:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Quick-fix hint**: Add a global `prefers-reduced-motion` media query that disables or shortens non-essential motion.

**See also**: **VVT-054** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code authors a `@media (prefers-reduced-motion: …)` block; this rule defines the policy (WCAG compliance), VVT-054 flags when code changes warrant runtime verification (OS-toggle test, cascade integrity, JS-driven motion path coverage). **VVT-065** (`visual-verification-triggers/responsive.md`) — runtime-verification trigger when code authors CSS scroll-snap; scroll-snap is motion and must respect this rule's policy. **VVT-069** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger for CSS scroll-driven animations (`animation-timeline: scroll()` / `view()`); scroll-driven animations are visually intense motion that MUST honor this rule's policy via a `prefers-reduced-motion: reduce` override block or alternative. **VVT-071** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger for CSS `interpolate-size` declarations; intrinsic-size animations (height/width from `0` to `auto`) are motion under this rule's scope and MUST honor `prefers-reduced-motion: reduce` via animation-shortening or discrete state change. **A11Y-070** for the broader COGA-grounded animation policy variant. **COMP-WCAG-AAA-06** (`compliance/wcag-aaa.md`, "No flashing more than 3 times per second regardless of brightness/size") — A11Y-033 covers user-preference-driven motion reduction (WCAG 2.3.3 AAA); COMP-WCAG-AAA-06 is the orthogonal flash-rate-cap rule (WCAG 2.3.2 AAA) that fires regardless of user preference.

---

### A11Y-034: Do not disable viewport zoom

**Severity**: MAJOR
**WCAG**: 1.4.4 Level AA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html

**The rule**: The viewport meta tag must not prevent users from zooming.

**Code patterns to flag**:
- `<meta name="viewport" content="... user-scalable=no">`
- `<meta name="viewport" content="... maximum-scale=1">` (or any value < 2)
- `<meta name="viewport" content="... minimum-scale=1, maximum-scale=1">`

**Correct pattern**:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

**Quick-fix hint**: Drop `user-scalable=no` and `maximum-scale`; keep only `width=device-width, initial-scale=1`.

---

### A11Y-035: Error notifications must not auto-dismiss

**Severity**: CRITICAL
**WCAG**: 2.2.1 Level A (Timing Adjustable)
**Source**: https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html

**The rule**: Toast/snackbar notifications that convey error states must persist until the user explicitly dismisses them. Auto-dismissing error messages violate SC 2.2.1 because users with cognitive disabilities, slow readers, or screen-reader users may not process the content before it disappears. Success/informational toasts may auto-dismiss (minimum 5s per UX-013). Error toasts must use `role="alert"` with `aria-live="assertive"` (not `polite`).

**Code patterns to flag**:
- Toast with `variant="destructive"` (or equivalent error styling) using a finite `duration` or `setTimeout`
- Error toast container using `aria-live="polite"` instead of `assertive`
- Error toast relying on color alone (red background) without an icon or text indicator

**Correct pattern**:
```jsx
toast({ title: "Save failed", description: "...", variant: "destructive", duration: Infinity });
// Container: <div role="alert" aria-live="assertive">
```

**Quick-fix hint**: Set `duration: Infinity` (or equivalent no-auto-dismiss) for error/destructive toasts. Use `aria-live="assertive"` and include a visible error icon alongside the text.

**See also**: **COMP-WCAG-AAA-12** (`compliance/wcag-aaa.md`, "Error prevention for all submissions (reversible / checked / confirmed)") — A11Y-035 ensures errors stay visible long enough to process (WCAG 2.2.1 Timing Adjustable A); COMP-WCAG-AAA-12's "Checked" mechanism (validate + give correction opportunity) is satisfied by the persistent error display A11Y-035 enables — the two rules are complementary on the error-handling axis.

---

### A11Y-070: Respect `prefers-reduced-motion` for animations

**Severity**: MAJOR
**WCAG**: 2.3.3 Animation from Interactions Level AAA covers motion-from-interaction scope specifically; COGA O5/O8 motivate broader reduced-motion adoption (entrance animations, parallax, auto-scroll carousels) beyond 2.3.3's AAA scope. Rule severity is MAJOR on COGA grounds + practical UX impact, not WCAG-AAA mandatory authority.
**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion, https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
**COGA**: O5 (Help users focus) + O8 (Support adaptation and personalization)

**The rule**: Animations longer than ~250ms, parallax effects, auto-scrolling carousels, and any motion that isn't directly user-triggered must be disabled or significantly reduced when `prefers-reduced-motion: reduce` is set. The OS-level preference is exposed via CSS media query AND `window.matchMedia()`.

**Code patterns to flag**:
- Long-running CSS animations / transitions (`animation: slide 800ms`) with no `@media (prefers-reduced-motion: reduce)` override
- Framer Motion / React Spring animations with no `useReducedMotion()` hook gating
- Parallax scroll effects with no reduced-motion fallback
- Carousel auto-rotate behaviors with no respect for user pref
- GSAP / Lottie / animated-illustration code paths without OS-pref check

**Correct pattern**:
```css
.fade-in {
  animation: fade 600ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .fade-in {
    animation: none; /* or much shorter, < 200ms */
  }
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

```jsx
import { useReducedMotion, motion } from "framer-motion";
const prefersReducedMotion = useReducedMotion();
<motion.div animate={{ x: prefersReducedMotion ? 0 : 100 }} />
```

**Quick-fix hint**: Add a global `@media (prefers-reduced-motion: reduce)` override that disables/shortens animations near the top of the stylesheet. For JS animation libraries, gate every animation behind a `useReducedMotion()` (or equivalent matchMedia) check.

**See also**: **VVT-054** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code authors a `@media (prefers-reduced-motion: …)` block or `matchMedia('(prefers-reduced-motion: reduce)')` listener; complements this rule's broader COGA-grounded policy by flagging the code-change-to-runtime-verification handoff. **VVT-065** (`visual-verification-triggers/responsive.md`) — runtime-verification trigger when code authors CSS scroll-snap; scroll-snap is motion and must respect this rule's COGA-grounded animation policy. **VVT-069** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger for CSS scroll-driven animations (`animation-timeline: scroll()` / `view()`); the scroll-progress-bound animation surface that this rule's COGA-grounded policy applies to (entrance + parallax + auto-scroll patterns are the primary scroll-driven animation use cases). **VVT-071** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger for CSS `interpolate-size`; intrinsic-size animations are motion under COGA O5/O8 and this rule's policy applies (shorten or replace with discrete state change under reduced-motion). **A11Y-033** for the WCAG 2.3.3 AAA-anchored variant of the same surface. **COMP-WCAG-AAA-06** (`compliance/wcag-aaa.md`, "No flashing more than 3 times per second regardless of brightness/size") — A11Y-070 covers user-preference-driven animation reduction; COMP-WCAG-AAA-06 is the orthogonal flash-rate-cap rule (WCAG 2.3.2 AAA) that applies regardless of `prefers-reduced-motion` setting.

---

### A11Y-071: Respect `prefers-color-scheme` for theme

**Severity**: MINOR
**WCAG**: 1.4.6 Contrast (Enhanced) Level AAA (informational), 1.4.8 Visual Presentation Level AAA
**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
**COGA**: O8 (Support adaptation and personalization)

**The rule**: When a site offers a dark or light theme, the OS-level user preference (`prefers-color-scheme: dark` / `light`) should be the default theme on first visit. Subsequent user overrides via in-app theme toggle persist (localStorage), but the initial state should match user pref.

**Code patterns to flag**:
- Theme toggle that ALWAYS defaults to light on first load, ignoring OS pref
- CSS variables that hard-code light theme with no `@media (prefers-color-scheme: dark)` override
- Image / illustration assets that don't have a dark-mode variant when the app offers dark mode
- `color-scheme` CSS property not set on `<html>` / `<body>` (UA-rendered form controls then stay light even in app's dark theme)

**Correct pattern**:
```css
:root {
  color-scheme: light dark;       /* tells the UA both schemes are supported */
  --bg: white;
  --fg: black;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b0d10;
    --fg: #e5e7eb;
  }
}
```

```jsx
// React/Next: initialize theme from OS pref, allow user override
const initial = localStorage.getItem("theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
```

**Quick-fix hint**: Use `color-scheme: light dark` on root; mirror CSS variables via the media query; on first visit, read OS pref before defaulting.

**See also**: **VVT-057** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code adds or changes the `color-scheme` CSS property or `<meta name="color-scheme">` tag; complements this policy rule by flagging the UA-chrome / form-control / scrollbar rendering changes that need runtime check. **VVT-058** (same file) — runtime-verification trigger when code uses the `light-dark()` CSS color function (Baseline 2024 Newly available); `light-dark()` is one of the canonical implementation paths for this rule (alongside the `@media (prefers-color-scheme: dark)` form shown above), but requires VVT-057's `color-scheme` prerequisite.
