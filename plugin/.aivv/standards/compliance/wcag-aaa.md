# Compliance — WCAG 2.1 AAA realistic subset

Part of [.aivv/standards/compliance/](README.md) (COMP-WCAG-AAA-NN). Each rule captures one WCAG 2.1 Level AAA Success Criterion in the "realistic" subset — meaning AAA SCs that apply to general production web applications (NOT the impractical-for-most-sites subset like 3.1.5 Reading Level which requires lower-secondary-education reading level for non-essential content, or 2.2.4 Interruptions which requires defer-or-postpone of all interruptions). Per maintainer guidance operating principle 9 + dev.80+ per-rule WebFetch-verification discipline, each rule cites the canonical W3C WCAG Understanding page; the Source line carries the verbatim normative SC text per dev.91+ Discipline 1.

**Conformance reality:** AAA conformance is not required for the WCAG-compliance baseline (Level AA is the standard regulatory/legal baseline in most jurisdictions). AAA rules in this catalog represent **opt-in enhancements** that improve accessibility for users with cognitive disabilities, low vision, photosensitive epilepsy, or motor impairments beyond the AA threshold. AIVV surfaces them as MINOR or POLISH severity by default (vs MAJOR for AA-class A11Y rules) — escalation to MAJOR/CRITICAL is appropriate only when explicit AAA conformance is the stated project goal.

**Out-of-scope for this file:** WCAG AAA SCs that are already covered in [`accessibility/`](../accessibility/) (specifically 2.3.3 Animation from Interactions per A11Y-033 / A11Y-070, 2.4.13 Focus Appearance per A11Y-037 / A11Y-038, 2.5.5 Target Size Enhanced per A11Y-040, 3.3.9 Accessible Authentication Enhanced per A11Y-044) are NOT duplicated here — see those A11Y rules for the existing coverage.

Added dev.103 = T43 Wave 2 phase 1 batch 1.

### COMP-WCAG-AAA-01: Text contrast ratio ≥ 7:1 (Enhanced)

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 1.4.6 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html — verbatim normative text: "The visual presentation of text and images of text has a contrast ratio of at least 7:1, except for the following:"

**The rule**: Text contrast against its background must reach ≥ 7:1 (or ≥ 4.5:1 for large-scale text — text that is 18pt+ or 14pt+ bold). This is stricter than AA's 1.4.3 (4.5:1 / 3:1 large) — the existing A11Y catalog covers AA-baseline. Explicit exceptions per the normative SC: (a) large-scale text at 4.5:1; (b) **incidental** text (inactive UI components, pure decoration, not-visible-to-anyone, or text incidental to a picture with significant other visual content); (c) **logotypes** (text that is part of a logo or brand name).

**Code patterns to flag**:
- Color tokens / Tailwind utilities that resolve to < 7:1 for body text against background (when project declares AAA target)
- Hard-coded `color: #...` values that compute to 4.5:1 ≤ ratio < 7:1 on body text
- Theme switcher that meets 4.5:1 on body text but not 7:1
- Dark-mode tokens where body text on dark surface is < 7:1

**Correct pattern**:
```css
/* AAA-conformant body text: ratio ≥ 7:1 */
:root { --text-fg: #1a1a1a; --text-bg: #ffffff; } /* contrast 17.4:1 ✓ */
body { color: var(--text-fg); background: var(--text-bg); }

/* Large-scale text (≥ 18pt or ≥ 14pt bold) may use 4.5:1 */
h1 { color: #595959; } /* on #ffffff = 7.0:1 ✓ even at body-size */
```

**Quick-fix hint**: For body text, target ≥ 7:1 (compute via WebAIM contrast checker or similar). For headings ≥ 18pt (or 14pt bold), 4.5:1 is sufficient. Logotypes and incidental text are exempt.

**Runtime caveat**: Contrast ratio depends on computed color values; runtime check (axe-core / Lighthouse) is the authoritative verification. Static review can flag obvious low-contrast token combinations but cannot compute all rendered states (hover/focus/disabled).

**See also**: the runtime-deferred WCAG 1.4.3 Contrast (Minimum) AA baseline (per [`accessibility/README.md`](../accessibility/README.md) runtime-deferred list — actual contrast verification requires computed-color-vs-background rendering). COMP-WCAG-AAA-01 is the static-detectable AAA enhancement (7:1) of the same contrast-ratio axis; the AA 4.5:1 baseline remains runtime-only. **RTV-CONTRAST-04** (`runtime-visual.md`, AAA-enhanced 7:1 runtime measurement) — COMP-WCAG-AAA-01 covers static-detectable AAA pattern flagging; RTV-CONTRAST-04 covers the runtime computed-pixel measurement against this same 7:1 threshold when B3 runtime evidence artifacts or an explicit host runtime adapter are available. The two compose: static token-level flagging + runtime computed verification.

---

### COMP-WCAG-AAA-02: Visual presentation of text blocks (user-controllable colors, max 80 chars/line, no-justify, 1.5× leading, 200% zoom)

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 1.4.8 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/visual-presentation.html — verbatim normative text: "For the visual presentation of blocks of text, a mechanism is available to achieve the following:" (followed by five requirements)

**The rule**: For blocks of text (paragraph-or-longer content), a mechanism must be available achieving ALL FIVE: (1) "Foreground and background colors can be selected by the user." (2) "Width is no more than 80 characters or glyphs (40 if CJK)." (3) "Text is not justified (aligned to both the left and the right margins)." (4) "Line spacing (leading) is at least space-and-a-half within paragraphs, and paragraph spacing is at least 1.5 times larger than the line spacing." (5) "Text can be resized without assistive technology up to 200 percent in a way that does not require the user to scroll horizontally to read a line of text on a full-screen window."

**Code patterns to flag**:
- `text-align: justify` on body text blocks (violates sub-requirement 3)
- `line-height` < 1.5 on body paragraphs (violates sub-requirement 4)
- Fixed-pixel `max-width` on text blocks that exceeds 80 character-widths at the current font size (violates sub-requirement 2)
- No user-color-override CSS (e.g., user-stylesheet-overrideable variables OR theme picker) (violates sub-requirement 1)
- `overflow-x: scroll` on body content at 200% zoom (violates sub-requirement 5)
- `paragraph-spacing < 1.5 × line-height` (violates sub-requirement 4 second half)

**Correct pattern**:
```css
/* AAA-conformant text presentation */
:root { --text-fg: #1a1a1a; --text-bg: #ffffff; } /* user-overrideable via :root */
body { color: var(--text-fg); background: var(--text-bg); }

p {
  max-width: 65ch;           /* sub-requirement 2: ≤ 80 chars (40 CJK) */
  text-align: left;          /* sub-requirement 3: not justified */
  line-height: 1.6;          /* sub-requirement 4: ≥ 1.5 leading */
  margin-bottom: 1em;        /* sub-requirement 4: spacing ≥ 1.5× leading (1em ≈ 1.6× line-height in practice) */
}

/* sub-requirement 5: reflow at 200% zoom via responsive design */
html { font-size: clamp(1rem, 1rem + 0.25vw, 1.25rem); }
```

**Quick-fix hint**: Set `max-width: 65ch` on text blocks, `text-align: left` (drop `justify`), `line-height: 1.6` (or 1.5 minimum), `margin-bottom: 1em` (or larger) on paragraphs, and ensure user color override via CSS custom properties on `:root`.

**Runtime caveat**: "Mechanism is available" is the SC's actual gate — a project may meet sub-requirement 1 by relying on browser user-stylesheet support rather than building in-app color override. Static review can flag obvious violations (justify, low line-height) but the user-color-override sub-requirement is partially runtime-determinable.

**See also**: **VVT-072** (text-spacing-trim — CJK typography runtime trigger).

---

### COMP-WCAG-AAA-03: Avoid images-of-text except for pure-decoration or essential-presentation

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 1.4.9 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/images-of-text-no-exception.html — verbatim normative text: "Images of text are only used for pure decoration or where a particular presentation of text is essential to the information being conveyed."

**The rule**: Bitmap images containing rendered text (PNG/JPG/WebP/SVG-rasterized) are forbidden except (a) **pure decoration** — text where the words can be rearranged or substituted without changing their purpose; (b) **essential presentation** — where a particular presentation of text is required to convey the information AND that presentation cannot be achieved via styled live text. Logotypes (text that is part of a logo or brand name) qualify as essential. This is stricter than AA's 1.4.5 (Images of Text) which permits images-of-text when "the particular presentation of text is essential" with broader exception scope — the AAA "No Exception" form removes that broader scope.

**Code patterns to flag**:
- `<img src="hero-banner.png" alt="Welcome to Acme">` where the headline text is baked into a bitmap (use live text + CSS instead)
- `background-image: url(call-to-action.png)` where the button label is part of the image
- SVG with `<text>` elements that are NOT made accessible to AT (some SVG renderers don't expose text to AT; use `<title>` + `<text>` or convert to HTML)
- Email-only banner images with text content not duplicated in HTML body (email accessibility variant of the same rule)
- Hero images with stylized typography baked in when same text + Google Font would render equivalent live text

**Correct pattern**:
```html
<!-- Live text + CSS styling, NOT an image of text -->
<h1 class="hero-headline">Welcome to Acme</h1>

<style>
  .hero-headline {
    font-family: "Caudex", serif;   /* webfont; can be substituted */
    font-size: clamp(2rem, 4vw, 4rem);
    color: #1a3a5c;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
  }
</style>

<!-- Logotype (essential per SC exception) -->
<img src="/acme-logo.svg" alt="Acme Corporation" />
```

**Quick-fix hint**: Replace bitmap banners/CTAs/hero images carrying text with live HTML + CSS-styled equivalents using webfonts. Reserve image-of-text usage for logotypes (essential) and decoration that can be substituted without meaning loss.

**Runtime caveat**: Static review can flag `<img src="...png">` with text-heavy alt text as candidate violations; full verification requires examining the bitmap content (out of static-tool scope).

**See also**: **VVT-072** (`visual-verification-triggers/css-styling.md`, `text-spacing-trim`) — runtime-verification trigger when CJK live-text rendering relies on the language-scoped typography axis. The WCAG 1.4.5 AA baseline (Images of Text with broader exception scope) is not separately authored in the A11Y catalog; the AAA "No Exception" form COMP-WCAG-AAA-03 covers the stricter case.

---

### COMP-WCAG-AAA-04: Full keyboard operability (No Exception — no path-dependent input)

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 2.1.3 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/keyboard-no-exception.html — verbatim normative text: "All functionality of the content is operable through a keyboard interface without requiring specific timings for individual keystrokes."

**The rule**: ALL functionality must be reachable + operable via keyboard alone with no exceptions. The AA-level SC 2.1.1 Keyboard permits an exception for "path-dependent input" (drawing applications, signature pads, certain games where the input gesture's path is itself the data). AAA 2.1.3 removes that exception entirely — even path-dependent inputs must offer a keyboard alternative (which may degrade the interaction quality but must enable functional operation). The existing A11Y catalog covers AA 2.1.1; this rule adds the strict-AAA case.

**Code patterns to flag**:
- Drawing canvas / signature pad / freehand annotation surfaces with NO keyboard alternative (e.g., type-to-input fallback, voice-input pairing, arrow-key drawing mode)
- Drag-and-drop interactions WHERE the path of the drag carries semantic meaning (e.g., gesture-to-unlock patterns) AND no keyboard equivalent exists
- Map interactions that require mouse-drag for panning with no arrow-key or button-based panning
- Audio/video timeline scrubbers that ONLY accept mouse-drag (the AA-class A11Y catalog already covers basic audio controls; this rule adds the path-dependent-input strict case)
- Custom slider widgets where dragging the thumb is the only way to change value (vs. arrow keys, Home/End, Page Up/Down per ARIA APG slider pattern)

**Correct pattern**:
```html
<!-- Drawing surface with keyboard alternative -->
<canvas id="draw" role="application" aria-label="Freehand drawing — use mouse, touch, or arrow keys after activating cell-mode"></canvas>
<button type="button" aria-pressed="false" aria-controls="draw">Cell-mode (keyboard accessible)</button>

<!-- Signature with type-to-name fallback -->
<canvas id="sig"></canvas>
<details>
  <summary>Type your name instead</summary>
  <input type="text" name="signature" aria-label="Typed signature" />
</details>

<!-- Slider with full ARIA APG keyboard model -->
<div role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0">
  <!-- arrow keys, Home/End, Page Up/Down per APG -->
</div>
```

**Quick-fix hint**: For every drag-based / path-based interaction, add either (a) a keyboard alternative that achieves the same outcome (may be slower or less expressive), or (b) a type-input fallback for capture-style interactions (signatures, names). The keyboard alternative does not need to feel equivalent — it needs to enable the functionality.

**Runtime caveat**: Whether keyboard alternatives actually work + are discoverable requires keyboard-only manual testing (NVDA + JAWS + VoiceOver + browser-only-without-mouse). Static review flags missing keyboard alternatives at the markup layer; the experience quality is runtime-verified.

**See also**: **A11Y-039** (`accessibility/interactive-elements.md`, "Provide a single-pointer alternative for any dragging-based interaction") — A11Y-039 enforces the WCAG 2.5.7 AA single-pointer-alternative requirement for drag interactions; COMP-WCAG-AAA-04 is the strict-AAA companion requiring a full KEYBOARD alternative (not just pointer-alternative) for path-dependent input. **A11Y-017** (`accessibility/interactive-elements.md`, "Custom controls built from `<div>`/`<span>` must wire keyboard support") — A11Y-017 enforces the AA-baseline 2.1.1 keyboard reachability for custom controls; COMP-WCAG-AAA-04 extends this to the no-exception strict-AAA case.

---

### COMP-WCAG-AAA-05: No timing constraints on essential interactions (except synchronized media + real-time events)

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 2.2.3 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/no-timing.html — verbatim normative text: "Timing is not an essential part of the event or activity presented by the content, except for non-interactive synchronized media and real-time events."

**The rule**: User interactions must not have implicit time-limits unless either (a) the timing is part of non-interactive synchronized media (e.g., a video player UI where pause time is the user's choice but playback is naturally timed), or (b) the event is a real-time event simultaneous-with-viewing not entirely generated by the content (e.g., live auction, stock trading, real-time game). The existing A11Y catalog covers AA 2.2.1 Timing Adjustable (which allows time-limits with adjust/extend/turn-off options); this AAA rule eliminates time-limits on essential interactions entirely.

**Code patterns to flag**:
- Quiz / form-completion timers that auto-submit on expiration (e.g., "Complete in 60 seconds")
- Slideshow / carousel auto-advance without user-extendable pause control (the user-pause case is AA 2.2.1; the no-time-limit-at-all case is AAA 2.2.3)
- Session timeouts that interrupt in-progress work (the user-extendable case is AA 2.2.1; the no-timeout case is AAA 2.2.3 — typically achieved by saving partial state + offering re-authentication on demand)
- Single-use tokens that expire faster than realistic user-completion time (e.g., 60-second OTP for password-reset that requires multiple fields completion)
- Time-limited promotions / countdowns where the user CANNOT complete the action after timer expiration

**Correct pattern**:
```html
<!-- Form with NO timeout: state preserved, no auto-submit -->
<form id="multistep" data-autosave-interval="60000">
  <!-- on submit, NO 'expired' state; state preserved indefinitely server-side -->
</form>

<!-- Slideshow with NO auto-advance (user-controlled only) -->
<div role="region" aria-roledescription="carousel" aria-label="Featured products">
  <button type="button" aria-label="Previous">←</button>
  <button type="button" aria-label="Next">→</button>
  <!-- explicitly no setInterval-driven auto-advance -->
</div>

<!-- Time-extended OTP: longer window OR resend on-demand -->
<input type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" />
<button type="button">Send a new code</button>
```

**Quick-fix hint**: For form-completion / quiz / multi-step flows, eliminate auto-submit timers OR set them to indefinite. For carousels, drop the auto-advance interval (or default to off with user opt-in). For OTPs / session tokens, extend the validity window to a realistic completion time, and offer on-demand re-send.

**Runtime caveat**: Real-time event detection (live auction, stock trading) is a project-context judgment; static review cannot determine whether a timer's presence is justified by the real-time exception.

**See also**: **A11Y-069** (`accessibility/interactive-elements.md`, "Session timeout warning + extend mechanism BEFORE expiration") — A11Y-069 enforces the AA-baseline 2.2.1 timing-adjustable + 2.2.6 timeouts requirement (warn before expiration + offer extend mechanism); COMP-WCAG-AAA-05 is the strict-AAA companion eliminating essential-interaction time-limits entirely (vs A11Y-069's adjust/extend/warn approach).

---

### COMP-WCAG-AAA-06: No flashing more than 3 times per second regardless of brightness/size

**Severity**: MAJOR (photosensitive-epilepsy safety risk; escalate to CRITICAL when content is targeted at general audiences without warning + bypass option)
**WCAG**: 2.3.2 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/three-flashes.html — verbatim normative text: "Web pages do not contain anything that flashes more than three times in any one second period."

**The rule**: Content must NOT flash more than 3 times per second under any circumstances. The AA-level SC 2.3.1 (Three Flashes or Below) permits flashing > 3/sec when it is sufficiently dim OR occupies a small enough area; AAA 2.3.2 removes both exceptions — even small-area, dim flashes > 3/sec are forbidden. The existing A11Y catalog covers AA 2.3.1; this rule adds the strict-AAA case.

**Code patterns to flag**:
- CSS `@keyframes` animation with `animation-duration` < 333ms (1/3 second per cycle = 3 cycles/sec; faster than this exceeds 3/sec)
- `setInterval(toggleVisibility, <334)` — toggling visibility faster than every 334ms produces >3 flashes/sec
- WebGL / canvas-driven strobe effects (game intro screens, music-visualization, branding animations)
- Video / animated GIF content with rapid-cut sequences (the AA case requires the flash to also exceed brightness/area thresholds; the AAA case is absolute)
- CSS `animation: blink 200ms infinite` or any similar fast-cycle visibility toggle
- Hover-state flicker on rapidly-changing data displays (e.g., stock tickers, live sports scores) where the flicker cycles > 3 per second

**Correct pattern**:
```css
/* AAA-safe: cycle slower than 3/sec (i.e., ≥ 334ms per cycle) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.notification-pulse {
  animation: pulse 1s ease-in-out infinite;  /* 1 cycle/sec — well under the 3/sec limit */
}

/* If rapid flashing is content-essential, gate behind prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .strobe { animation: none; }
}
```

**Quick-fix hint**: Slow any flash/blink animation to ≥ 334ms per cycle (or longer). For unavoidable rapid-flash content (e.g., music visualizers), gate behind explicit user opt-in + `prefers-reduced-motion: reduce` override.

**Runtime caveat**: Animated GIFs / video content / WebGL-driven animation cannot be statically inspected for flash-rate; full verification requires runtime measurement (Photosensitive Epilepsy Analysis Tool — PEAT — is the canonical tool).

**See also**: **A11Y-033** (`accessibility/color-motion.md`, "Respect `prefers-reduced-motion`") — A11Y-033 covers user-preference-driven motion reduction (WCAG 2.3.3 AAA); COMP-WCAG-AAA-06 is the absolute-prohibition AAA case for flash rate (WCAG 2.3.2 AAA) that applies regardless of user preference. **A11Y-070** (same file, "Respect `prefers-reduced-motion` for animations") — sibling rule covering the animation case with the same user-preference axis; COMP-WCAG-AAA-06 is the orthogonal flash-rate-cap rule that fires regardless of `prefers-reduced-motion` setting.

---

### COMP-WCAG-AAA-07: Identify purpose of UI components, icons, and regions

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 1.3.6 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/identify-purpose.html — verbatim normative text: "In content implemented using markup languages, the purpose of user interface components, icons, and regions can be programmatically determined."

**The rule**: User interface components, icons, and page regions must be programmatically identifiable beyond the input-field scope of 1.3.5 (AA baseline). This enables assistive technologies and user-agent personalization layers to substitute familiar symbols or vocabulary. Three canonical mechanisms count toward conformance: (a) **ARIA landmark roles** for page regions (`role="main"`, `role="navigation"`, `role="search"`, `role="banner"`, `role="contentinfo"`, `role="complementary"`); (b) **explicit purpose attributes** on UI components (e.g., `aria-roledescription`, role-bearing custom elements with stable accessible names matching documented widget patterns); (c) **microdata or schema.org markup** providing typed semantics for icon-bearing components.

**Code patterns to flag**:
- Page lacks landmark structure (no `<main>` / `<nav>` / `role="main"` etc.) when project declares AAA target
- Icon-only buttons with no `aria-label` describing the action's purpose (overlaps A11Y baseline; AAA adds programmatically-typed-purpose requirement)
- Custom widgets (e.g., date pickers, color pickers, rating controls) with no role + accessible name combination that maps to a known WAI-ARIA pattern or schema vocabulary
- Region of repeated content (sidebar, footer, comment-thread) wrapped in plain `<div>` rather than landmark or `role="region"` + accessible name

**Correct pattern**:
```html
<!-- AAA-conformant landmarks -->
<header role="banner">…</header>
<nav role="navigation" aria-label="Primary">…</nav>
<main role="main">
  <section role="region" aria-labelledby="filters-h">
    <h2 id="filters-h">Filters</h2>
    …
  </section>
</main>
<aside role="complementary" aria-label="Related articles">…</aside>
<footer role="contentinfo">…</footer>

<!-- Icon button with typed-purpose accessible name -->
<button aria-label="Add to favorites" aria-pressed="false">
  <svg aria-hidden="true" focusable="false">…</svg>
</button>
```

**Quick-fix hint**: Wrap top-level page regions in HTML5 landmark elements (`<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>`) or apply explicit ARIA landmark roles. Ensure every icon-bearing UI component has an accessible name describing its purpose, not its visual appearance.

**See also**: **A11Y-004** (`accessibility/semantic-structure.md`, "Use landmark elements for page regions") — A11Y-004 enforces the landmark structure as a baseline best practice; COMP-WCAG-AAA-07 is the AAA-formal SC-1.3.6 anchor that elevates landmark coverage to a conformance requirement. **A11Y-011** (`accessibility/forms.md`, "Common inputs should declare `autocomplete`") and **A11Y-061** (same file, "Use HTML `autocomplete` attribute on personal-information fields") — these cover the AA-baseline 1.3.5 Identify Input Purpose (input-field scope); COMP-WCAG-AAA-07 extends to components + icons + regions beyond input fields. **A11Y-026** / **A11Y-027** (`accessibility/aria/fundamentals.md`, accessible-name rules) — accessible-name coverage is the mechanism by which icons and components become programmatically identifiable.

---

### COMP-WCAG-AAA-08: Re-authenticating must preserve user data

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 2.2.5 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/re-authenticating.html — verbatim normative text: "When an authenticated session expires, the user can continue the activity without loss of data after re-authenticating."

**The rule**: When an authenticated session expires mid-activity, the application must allow the user to resume that activity without losing data after re-authenticating. Inactivity-driven logouts that wipe in-progress form data, multi-step wizard state, or cart contents fail this SC. Two canonical mechanisms count toward conformance: (a) **server-side draft persistence** (the user's in-flight data is saved on submit-attempt-after-expiration, then re-attached to the session post-re-auth); (b) **encrypted client-side re-authorization payload** (the re-auth page carries the in-flight data as hidden / encrypted fields that re-post on successful re-auth).

**Code patterns to flag**:
- Session-timeout flow that redirects to `/login` and loses all form state
- Multi-step wizard whose step-state lives in server session and is wiped on session expiry without persistence
- "Your session has expired, please log in again" interstitial that discards the user's pending POST body
- Authentication middleware that intercepts a POST and 302-redirects to login without persisting the original request payload

**Correct pattern**:
```typescript
// Re-auth middleware preserves in-flight data
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    // Persist the original request (URL + body) for post-login replay
    const draftId = crypto.randomUUID();
    await draftStore.put(draftId, {
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
    return res.redirect(`/login?return_to=${draftId}`);
  }
  next();
}

// Post-login resume handler
async function postLogin(req: Request, res: Response) {
  const draftId = req.query.return_to;
  if (draftId) {
    const draft = await draftStore.get(draftId);
    if (draft) return res.render('resume-draft', { draft }); // re-submits original
  }
  res.redirect('/');
}
```

**Quick-fix hint**: At every authentication boundary, persist the user's in-flight request (form body, wizard step state, cart) keyed to a draft ID before redirecting to login. After re-auth, prompt the user to resume the saved draft or replay the original request.

**Runtime caveat**: End-to-end verification requires session-expiry + re-auth integration testing; static review can flag the absence of draft-persistence middleware but cannot confirm correct replay.

**See also**: **A11Y-069** (`accessibility/interactive-elements.md`, "Session timeout warning + extend mechanism BEFORE expiration") — A11Y-069 covers the *pre-expiration* warn-and-extend mechanism (WCAG 2.2.1 AA); COMP-WCAG-AAA-08 covers the *post-expiration* data-preservation requirement (WCAG 2.2.5 AAA). The two rules are complementary: A11Y-069 reduces the likelihood of unexpected expiration; COMP-WCAG-AAA-08 ensures that when expiration nonetheless occurs, the user's work survives. **COMP-WCAG-AAA-05** (this file, "No timing constraints on user activities") — sibling AAA rule on the timing axis; COMP-WCAG-AAA-05 eliminates timing as a factor for time-critical activities, COMP-WCAG-AAA-08 handles the case where session-based timing constraints nonetheless exist.

---

### COMP-WCAG-AAA-09: Provide location information within a set of pages

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 2.4.8 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/location.html — verbatim normative text: "Information about the user's location within a set of web pages is available."

**The rule**: Each page within a multi-page site must expose the user's current location relative to the site structure. Five sufficient techniques satisfy the SC: (a) **breadcrumb trail** showing the hierarchical path to the current page; (b) **site map** linked from a stable location showing overall site organization; (c) **current-page indication** within the primary navigation (e.g., visual marker + `aria-current="page"`); (d) **`aria-current` attribute** programmatically identifying the current item among a set; (e) **explicit relationship metadata** identifying the page's place in the broader collection (e.g., `<link rel="up">` / `<link rel="contents">` in `<head>`).

**Code patterns to flag**:
- Deep-navigation pages (e.g., `/products/categories/electronics/laptops/gaming/asus-rog-strix`) with no breadcrumb component
- Primary-navigation links where the current page has no visual marker AND no `aria-current="page"` attribute
- Multi-page wizard or article-series where the user has no way to determine "page 3 of 8" or where they are in the sequence
- Site map link absent from the global footer or persistent navigation (the canonical fallback when breadcrumbs are infeasible)

**Correct pattern**:
```html
<!-- Breadcrumb + aria-current="page" on the leaf -->
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/products/laptops">Laptops</a></li>
    <li><a href="/products/laptops/asus-rog-strix" aria-current="page">ASUS ROG Strix</a></li>
  </ol>
</nav>

<!-- Primary nav with current-page indication -->
<nav aria-label="Primary">
  <ul>
    <li><a href="/about">About</a></li>
    <li><a href="/products" aria-current="page">Products</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>
```

**Quick-fix hint**: Add a breadcrumb component to any page nested ≥ 2 levels deep. Apply `aria-current="page"` to the matching primary-navigation link on every page. Provide a sitemap link from the global footer as a fallback for sections where breadcrumbs are infeasible (e.g., flat archives).

**See also**: **A11Y-067** (`accessibility/semantic-structure.md`, "Breadcrumb navigation uses `<nav aria-label='breadcrumb'>` + `aria-current='page'`") — A11Y-067 enforces the *structural* form of breadcrumbs (correct markup); COMP-WCAG-AAA-09 is the *coverage* SC requiring that some location-disclosure mechanism (breadcrumb, site map, current-page indication, or `aria-current`) exists on every page within a set. **A11Y-063** (`accessibility/forms.md`, "Multi-step processes must indicate current step via `aria-current='step'`") — adjacent rule covering the wizard / multi-step process case (step location within a flow); COMP-WCAG-AAA-09 covers the broader cross-page case. **A11Y-005** (`accessibility/semantic-structure.md`, "Provide a skip link to bypass repeated navigation") — complementary navigation aid for landmark-based location.

---

### COMP-WCAG-AAA-10: Link purpose identifiable from link text alone

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 2.4.9 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-link-only.html — verbatim normative text: "A mechanism is available to allow the purpose of each link to be identified from link text alone, except where the purpose of the link would be ambiguous to users in general."

**The rule**: Every link's purpose must be determinable from its accessible name (text content + `aria-label` / `aria-labelledby` if present) without reference to surrounding context. This is stricter than AA-baseline 2.4.4 (which permits surrounding-context disambiguation). The SC's "ambiguous to users in general" exception applies when the destination cannot be predicted even by users without disabilities (e.g., a teaser link to an article whose topic shifts) — those cases are exempt. Canonical mechanisms: descriptive link text; supplementary `aria-label` on icon-only links; toggle between short and long link text (per the W3C technique list).

**Code patterns to flag**:
- Link text reads `"click here"`, `"here"`, `"more"`, `"read more"`, `"learn more"`, `"download"` (verb-only with no object) anywhere on the page
- Icon-only link (`<a><svg></svg></a>`) with no `aria-label` describing the destination
- Repeated `"View"` / `"Edit"` / `"Details"` link text in a table-row context without unique `aria-label` per row (each row's link is semantically distinct but text is identical out of context)
- Link whose accessible name is identical to the page heading it links to but the surrounding context is required to disambiguate from other identical links

**Correct pattern**:
```html
<!-- Bad: link purpose requires surrounding context -->
<p>Read about our pricing plans. <a href="/pricing">Click here</a>.</p>

<!-- Good: link text carries full purpose -->
<p><a href="/pricing">Read about our pricing plans</a>.</p>

<!-- Icon-only link with aria-label carrying purpose -->
<a href="/cart" aria-label="View shopping cart (3 items)">
  <svg aria-hidden="true" focusable="false">…</svg>
</a>

<!-- Table row with unique aria-label per row -->
<tr>
  <td>ASUS ROG Strix</td>
  <td><a href="/products/123/edit" aria-label="Edit ASUS ROG Strix">Edit</a></td>
</tr>
```

**Quick-fix hint**: Replace vague link verbs (`"click here"`, `"more"`, `"read more"`) with link text that carries the destination's purpose. For icon-only links and table-row action links where visible text must stay short, add `aria-label` extending the accessible name with the destination's specifics.

**See also**: **A11Y-019** (`accessibility/interactive-elements.md`, "Links that open in a new tab/window must announce that") — A11Y-019 enforces destination-disclosure for the new-tab case (programmatic + visible indication of `target="_blank"`); COMP-WCAG-AAA-10 is the broader link-purpose-identification SC at AAA (WCAG 2.4.9) covering all links, not just external ones. **A11Y-027** (`accessibility/aria/fundamentals.md`, "Accessible name must include visible label text (Label in Name)") — A11Y-027 enforces Label-in-Name (WCAG 2.5.3 A) so visible link text appears verbatim in the accessible name; COMP-WCAG-AAA-10 extends to require that accessible name itself sufficient for purpose-identification.

---

### COMP-WCAG-AAA-11: Context changes only on user request

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 3.2.5 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/change-on-request.html — verbatim normative text: "Changes of context are initiated only by user request or a mechanism is available to turn off such changes."

**The rule**: Significant changes of context — opening new windows, redirecting to different pages, shifting focus, rearranging layout, refreshing content — must originate from explicit user action (click, key activation, form-submit) OR the application must expose a user-controllable mechanism to suppress such changes. This is stricter than AA-baseline 3.2.1 (On Focus) and 3.2.2 (On Input) which only restrict context-change on focus/input *interactions*; 3.2.5 AAA extends to ALL automatic context-changes regardless of trigger.

**Code patterns to flag**:
- `setTimeout(() => location.href = "/somewhere", N)` — time-based auto-redirect with no opt-out
- `<meta http-equiv="refresh" content="N">` — auto-refresh with no user control
- WebSocket / SSE message handler that calls `window.location.reload()` or replaces large DOM regions without user-initiated trigger
- `onChange` on a `<select>` that immediately submits the form or navigates (the AA-baseline 3.2.2 violation extended to AAA: even with a `<button type="submit">` in place, programmatic form-submit on selection-change still violates 3.2.5 unless a "auto-submit on change" preference is user-controllable)
- Modal dialog that auto-opens on page load (not in response to user action)
- "Refreshed N seconds ago — page will reload in 30 seconds" countdown banner with no user opt-out

**Correct pattern**:
```jsx
// Bad: auto-refresh
useEffect(() => {
  const id = setInterval(() => refetchData(), 30_000);
  return () => clearInterval(id);
}, []);

// Good: user-initiated refresh with optional auto-refresh toggle
const [autoRefresh, setAutoRefresh] = useState(false);
useEffect(() => {
  if (!autoRefresh) return;
  const id = setInterval(() => refetchData(), 30_000);
  return () => clearInterval(id);
}, [autoRefresh]);

return (
  <>
    <button onClick={refetchData}>Refresh now</button>
    <label>
      <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
      Auto-refresh every 30 seconds
    </label>
  </>
);
```

**Quick-fix hint**: Replace automatic context-changes (auto-refresh, time-based redirect, auto-open modal) with a user-initiated trigger ("Refresh now" button, "Continue" link). When auto-behavior is essential, expose a user-controllable toggle to disable it.

**See also**: **A11Y-014** (`accessibility/forms.md`, "Do not use `autofocus` on page load") — A11Y-014 enforces the no-auto-focus best practice (focus-change on page load is a context-change variant); COMP-WCAG-AAA-11 is the broader AAA SC covering all automatic context-changes (focus, navigation, refresh, layout) not just initial focus. **A11Y-028** (`accessibility/aria/fundamentals.md`, "`role='alert'` / `role='status'` / `aria-live` must be present before content changes") — A11Y-028 ensures dynamic-content updates ARE announced to AT; COMP-WCAG-AAA-11 ensures dynamic-content updates are USER-initiated in the first place (the two rules are complementary axes on the dynamic-content surface).

---

### COMP-WCAG-AAA-12: Error prevention for all submissions (reversible / checked / confirmed)

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 3.3.6 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/error-prevention-all.html — verbatim normative text: "For web pages that require the user to submit information, at least one of the following is true: Reversible, Checked, or Confirmed."

**The rule**: Every form/submission flow must satisfy at least one of three mechanisms — (a) **Reversible**: the submission can be undone (e.g., 30-day cancellation, edit-after-submit, soft-delete with restore); (b) **Checked**: submitted data is validated for input errors and the user can correct them before final submission; (c) **Confirmed**: the user reviews + confirms the submission on a separate step before it commits. This extends AA-baseline 3.3.4 (which applies only to legal/financial/data submissions) to ALL form submissions regardless of consequence severity.

**Code patterns to flag**:
- Form with single submit-and-commit handler (no validation step, no review step, no undo path)
- Multi-field form where errors are surfaced only post-commit (server-side error after data has already persisted)
- Submission that triggers immediate side-effects (email send, payment charge, record creation) without a confirm-step OR an undo mechanism
- Comment/post submission with no edit/delete capability after posting

**Correct pattern**:
```jsx
// Confirmed flow: review step before commit
function CheckoutFlow() {
  const [step, setStep] = useState<"cart"|"shipping"|"payment"|"review"|"confirmed">("cart");
  const [order, setOrder] = useState({});

  if (step === "review") return (
    <ReviewOrder order={order}>
      <button onClick={() => setStep("payment")}>Edit</button>
      <button onClick={async () => { await commitOrder(order); setStep("confirmed"); }}>
        Place order
      </button>
    </ReviewOrder>
  );
  // … other steps
}

// Reversible flow: soft-delete with restore
async function deleteItem(id: string) {
  await db.items.update(id, { deletedAt: new Date(), restoreUntil: addDays(new Date(), 30) });
  toast.info("Item deleted", {
    action: { label: "Undo", onClick: () => db.items.update(id, { deletedAt: null }) },
  });
}
```

**Quick-fix hint**: For submissions with side-effects (payment, email, record creation), add a review/confirm step. For destructive submissions (delete, cancel), implement soft-delete with restore-window OR an undo toast. For data-entry forms, surface validation errors client-side before submit.

**See also**: **A11Y-064** (`accessibility/forms.md`, "Destructive actions require confirmation OR undo") — A11Y-064 enforces the AA-baseline WCAG 3.3.4 case (destructive actions only); COMP-WCAG-AAA-12 extends to ALL form submissions regardless of consequence (WCAG 3.3.6 AAA). A11Y-064's "confirmation OR undo" mechanism choice maps directly onto COMP-WCAG-AAA-12's Confirmed and Reversible options. **A11Y-042** (`accessibility/forms.md`, "Do not require redundant entry of previously-provided information") — adjacent error-prevention rule (WCAG 3.3.7 A new in WCAG 2.2); COMP-WCAG-AAA-12 covers the broader error-prevention-via-confirmation/reversal/checking axis at AAA. **A11Y-035** (`accessibility/color-motion.md`, "Error notifications must not auto-dismiss") — complementary error-handling rule: A11Y-035 ensures errors stay visible long enough to process; COMP-WCAG-AAA-12's "Checked" mechanism is satisfied by the existence of correction opportunity that A11Y-035's persistent error display enables.

---

### COMP-WCAG-AAA-13: Context-sensitive help is available

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 3.3.5 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/help.html — verbatim normative text: "Context-sensitive help is available."

**The rule**: When user input is requested, context-sensitive help must be available to assist completion of the current task. Help may take multiple forms: inline format examples, help-link adjacent to field, tooltip/disclosure with definitions, in-page assistant. Clear labels themselves can constitute context-sensitive help when the label fully describes the expected input. This SC is distinct from WCAG 3.2.6 Consistent Help (A) which requires help-mechanism placement consistency across pages — 3.3.5 AAA requires the help itself to exist, 3.2.6 A requires its placement to be consistent.

**Code patterns to flag**:
- Form fields with non-standard formats (date, phone, postal-code with country-specific patterns) lacking inline format examples or help text
- Fields with unusual constraints (password complexity rules, alphanumeric-only IDs, max-length) shown only at submit-time as error messages, not pre-emptive help
- Complex multi-step tasks (file upload + tagging + categorization) with no inline help links or examples
- Industry-specific terminology (medical, legal, financial) in field labels with no definition/example/disclosure

**Correct pattern**:
```jsx
<div>
  <label htmlFor="dob">Date of birth</label>
  <input id="dob" name="dob" type="date" aria-describedby="dob-help" />
  <small id="dob-help">Format: YYYY-MM-DD. Example: 1990-04-23.</small>
</div>

<div>
  <label htmlFor="ein">Employer Identification Number</label>
  <input id="ein" name="ein" pattern="[0-9]{2}-[0-9]{7}" aria-describedby="ein-help" />
  <details id="ein-help">
    <summary>What's an EIN?</summary>
    A 9-digit IRS-issued number in the format NN-NNNNNNN. Find yours on your tax forms or apply at irs.gov.
  </details>
</div>
```

**Quick-fix hint**: For each form field with non-obvious format / constraints / vocabulary, add inline help via `aria-describedby` pointing to a `<small>` / `<p>` / `<details>` with examples, definitions, or expected formats. Reserve help-link patterns (`<a href="/help/...">`) for genuinely complex multi-page tasks.

**See also**: **A11Y-041** (`accessibility/semantic-structure.md`, "Help mechanism placement must be consistent across pages") — A11Y-041 enforces WCAG 3.2.6 Consistent Help (Level A) requiring the *placement* of help mechanisms to be consistent across pages; COMP-WCAG-AAA-13 is the orthogonal SC (WCAG 3.3.5 AAA) requiring the *existence* of context-sensitive help on every page that requests user input. The two rules are complementary: A11Y-041 governs WHERE help lives, COMP-WCAG-AAA-13 governs that it lives at all.

---

### COMP-WCAG-AAA-14: Section headings organize the content

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 2.4.10 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/section-headings.html — verbatim normative text: "Section headings are used to organize the content."

**The rule**: Long-form text content (articles, documentation, product descriptions, terms-of-service) must be organized into sections each beginning with a heading element. Per the SC's scope note, this covers *sections within writing* — NOT UI component labels (which are addressed by 4.1.2 Name, Role, Value). The rule is distinct from 1.3.1 Info and Relationships (A — heading element must be marked up programmatically) and 2.4.6 Headings and Labels (AA — heading text must describe topic). 2.4.10 AAA adds the requirement that sufficient section headings *exist*: dense prose with no internal headings fails the SC even when the surrounding page has a valid `<h1>`.

**Code patterns to flag**:
- Long-form article (≥ ~1000 words of body prose) with no `<h2>` / `<h3>` internal section headings
- Documentation page rendering markdown that strips headings or normalizes them all to plain `<p>` styled-as-bold
- Terms-of-service / privacy-policy / FAQ pages rendered as a single unbroken `<div>` of `<p>` blocks
- Multi-topic landing pages where each topic section is delineated only by CSS spacing, not by a heading element

**Correct pattern**:
```html
<main>
  <h1>Product documentation</h1>
  <section>
    <h2>Installation</h2>
    <p>…</p>
  </section>
  <section>
    <h2>Configuration</h2>
    <h3>Environment variables</h3>
    <p>…</p>
    <h3>Configuration file</h3>
    <p>…</p>
  </section>
  <section>
    <h2>API reference</h2>
    <p>…</p>
  </section>
</main>
```

**Quick-fix hint**: Break long-form body prose into sections of ≤ ~500 words each, with `<h2>` / `<h3>` headings introducing each section. For markdown-rendered content, preserve heading levels through the renderer pipeline (don't normalize `# Foo` to `<p><strong>Foo</strong></p>`).

**See also**: **A11Y-006** (`accessibility/semantic-structure.md`, "Heading hierarchy must be logical and not skip levels") — A11Y-006 enforces the WCAG 1.3.1 A + 2.4.6 AA heading-structure baseline (correct markup + descriptive text + non-skipping hierarchy); COMP-WCAG-AAA-14 is the orthogonal AAA SC (WCAG 2.4.10) requiring that sufficient headings exist to organize content into sections (distinct from "headings are well-formed when present"). **A11Y-065** (same file, "Each page should have a clear, descriptive `<h1>` (typically one) near the top of main content") — A11Y-065 enforces page-level `<h1>` presence; COMP-WCAG-AAA-14 extends the requirement to *intra-page section* headings beyond the top-level `<h1>`. **A11Y-066** (same file, "Heading levels in source order should not skip (best practice)") — sibling rule on the heading-hierarchy axis; COMP-WCAG-AAA-14 covers the orthogonal coverage axis (heading existence per section).

---

### COMP-WCAG-AAA-15: Warn users of inactivity timeouts that could cause data loss

**Severity**: MINOR (escalate to MAJOR when project declares AAA-conformance target)
**WCAG**: 2.2.6 Level AAA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/timeouts.html — verbatim normative text: "Users are warned of the duration of any user inactivity that could cause data loss, unless the data is preserved for more than 20 hours when the user does not take any actions."

**The rule**: Inactivity-driven session timeouts that could result in user data loss must be disclosed up-front — the user must learn of the timeout duration before the inactivity-trigger fires. The "20 hours" threshold provides an explicit exemption: if user data is preserved across inactivity periods of > 20 hours, no warning is required. This SC focuses on *inactivity-specific* timeouts (distinct from 2.2.1 Timing Adjustable A which addresses general time-limit adjustment, and 2.2.5 Re-authenticating AAA which addresses data-preservation *across* re-auth).

**Code patterns to flag**:
- Session-timeout configuration (e.g., `express-session({ rolling: false, maxAge: N })`) where N < 20 hours and the application stores user-input data that wipes on session expiry, with no upfront duration disclosure to the user
- Form pages with backend session-timeout configured but no `<small>` / footer / preferences-page text disclosing the timeout duration
- Multi-step wizard whose step-state lives in server session and wipes on inactivity-driven expiration, with no pre-engagement disclosure of the timeout window

**Correct pattern**:
```jsx
// Pre-engagement disclosure
<aside aria-label="Session timeout notice">
  <p>Your work will be saved for 20 minutes of inactivity. After that, you'll be returned to the sign-in page and unsaved changes may be lost.</p>
</aside>

{/* OR persist data > 20 hours, eliminating the warning requirement */}
// server.ts
app.use(session({
  store: redisStore,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24h, satisfies the 20h exemption
  rolling: true,
}));
```

**Quick-fix hint**: Either (a) extend session persistence beyond 20 hours (satisfies the SC's exemption automatically), or (b) add an upfront disclosure of the inactivity-timeout duration on every page where user-input data could be lost. For SPA flows, render the disclosure once on entry to any flow that has in-flight data.

**See also**: **A11Y-069** (`accessibility/interactive-elements.md`, "Session timeout warning + extend mechanism BEFORE expiration") — A11Y-069 enforces the AA-baseline WCAG 2.2.1 timing-adjustable requirement (mid-session warn + extend); COMP-WCAG-AAA-15 is the orthogonal AAA SC requiring upfront-disclosure of the timeout duration so users can plan their work (not just react to a mid-session warning). **COMP-WCAG-AAA-05** (this file, "No timing constraints on essential interactions") — sibling AAA rule on the timing axis: AAA-05 eliminates timing constraints entirely for essential interactions; AAA-15 covers the inactivity-disclosure case when a timing constraint nonetheless exists. **COMP-WCAG-AAA-08** (this file, "Re-authenticating must preserve user data") — AAA-08 covers post-expiration data preservation through re-auth; AAA-15 covers pre-expiration disclosure of the inactivity window. Together AAA-05 / AAA-08 / AAA-15 cover the full timing-axis policy stack at AAA.
