# Runtime-visual standards — axe-core, computed contrast, screenshot diff

Part of [.aivv/standards/](README.md). RTV-* rule namespace. Opt-in via `/aivv --runtime` or explicit runtime-evidence emit/ingest flags. B3 runtime-visual review extends the `visual` lens with rendered-output verification that static review structurally cannot perform by using generated Playwright probe scaffolds plus user-run JSON ingest by default. Host browser-driver adapters may provide read-only enrichment when explicitly supported.

**Hard scope boundary per runtime-visual opt-in path §Three-Tier scope extension:** default runtime-visual is scaffold generation plus artifact ingestion. Form submission, button clicks through app workflows, state mutations, migrations, dependency installs, and silent baseline blessing are OUT-of-scope. The `--runtime` flag does NOT enable behavioral testing.

**Driver:** B3 default path resolves `AIVV_ROOT` through the shared runtime-root contract, then uses `"$AIVV_ROOT/tools/runtime-evidence.mjs"` to emit `<target>/.aivv/runtime-probes/manifest.json` plus Playwright spec scaffolds and to ingest user-run Playwright JSON. Playwright MCP (`mcp__playwright__browser_*`) or DevTools MCP may be used only as explicit host adapters. When no adapter or runtime results are available, static-review baseline still functions; RTV-* findings remain evidence-limited until artifacts are supplied.

**Severity discipline:** RTV-AXE-* default MAJOR (axe-core rules cover WCAG-conformance defects rendered review can detect). RTV-CONTRAST-* default MAJOR when violating WCAG AA (1.4.3); MINOR when violating only AAA (1.4.6). RTV-DIFF-* default MINOR (baseline-vs-current screenshot diff is regression detection, not conformance).

---

## RTV-AXE-* — axe-core driven runtime checks

### RTV-AXE-01: Run axe-core against rendered DOM with `tags: ['wcag2a', 'wcag2aa']` baseline

**Severity**: MAJOR
**Authority**: Deque Systems axe-core; WCAG 2.1 AA conformance
**Source**: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md — axe-core official API documentation; `axe.run(context, options)` with `tags` option filtering ruleset

**The rule**: Runtime-visual sessions MUST configure axe-core's `run()` invocation with `{ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }` at minimum. Optional escalation to `wcag2aaa` when project declares AAA conformance (when a project declares AAA conformance). Running axe-core with default tag set (`['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']`) is acceptable; running without tag filter (axe-core's `experimental` rules included) is NOT — experimental rules produce false positives that pollute the finding stream.

**Code patterns to flag**:
- `axe.run()` invocation without explicit `runOnly` configuration
- Custom rule additions without project-declared rationale + Source: cite
- `axe.run(context, { rules: { ... } })` disabling specific rules without inline justification

**See also**: A11Y-001..074 (static A11Y baseline — runtime-visual extends, does not replace); COMP-WCAG-AAA-01..15 (AAA scope when project-declared).

---

### RTV-AXE-02: Axe-core violations of `serious` or `critical` impact map to MAJOR or CRITICAL severity

**Severity**: MAJOR
**Authority**: Deque axe-core impact levels
**Source**: https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md — axe-core's per-rule impact field documents Deque's classification (minor / moderate / serious / critical)

**The rule**: Map axe-core impact levels to AIVV finding severities deterministically: `critical` → CRITICAL, `serious` → MAJOR, `moderate` → MINOR, `minor` → POLISH. Reviewer prose MUST cite axe-core's `impact` field in the `grounded_by` field (e.g., `{runtime: 'axe-core', rule_id: 'color-contrast', impact: 'serious'}`) so the severity assignment is auditable. Custom impact-overrides require inline justification cite.

**Code patterns to flag**:
- Findings from axe-core surfaced without `impact` field grounding
- Severity classification inconsistent with axe-core's published impact

**See also**: AIVV `.aivv/schemas/finding.json` severity enum; AIVV reviewer methodology Phase 3 severity-mapping rules.

---

### RTV-AXE-03: `color-contrast` rule violations must cite computed ratio + WCAG SC

**Severity**: MAJOR
**Authority**: WCAG 2.1 Success Criterion 1.4.3; axe-core `color-contrast` rule
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html — WCAG 1.4.3 normative thresholds (4.5:1 normal, 3:1 large); https://dequeuniversity.com/rules/axe/4.9/color-contrast — axe-core rule documentation

**The rule**: When axe-core reports a `color-contrast` violation, the finding MUST include: (a) the computed contrast ratio (e.g., `3.2:1`), (b) the WCAG threshold being violated (`4.5:1` for normal text or `3:1` for large text), (c) the foreground + background CSS color values measured. axe-core provides this in the violation's `nodes[].any[].data` field; surface it in the finding's `evidence` block. Do NOT cite "color-contrast violation" without the specific ratio + threshold pair.

**Code patterns to flag**:
- Surfacing axe-core color-contrast violations without computed-ratio + WCAG-threshold pair
- Citing WCAG SC without verifying the specific ratio violation (e.g., normal-text vs large-text threshold)

**See also**: COMP-WCAG-AAA-01 (Contrast Enhanced 7:1); RTV-CONTRAST-01..03 (manual computed-contrast checks for cases axe-core misses).

---

### RTV-AXE-04: `focus-order-semantics` and `tabindex` violations require keyboard-navigation reproduction

**Severity**: MAJOR
**Authority**: WCAG 2.1 SC 2.4.3 (Focus Order); axe-core `focus-order-semantics` + `tabindex` rules
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html — WCAG 2.4.3

**The rule**: axe-core's `focus-order-semantics` and `tabindex` rules surface tab-order anomalies at the DOM level (static structure), but the FULL focus-order defect requires runtime keyboard-navigation reproduction. When runtime evidence is supplied, verify `Tab` traversal against the rendered page and confirm `document.activeElement` traversal order matches the visual reading order. A host adapter may use Playwright MCP keypress tooling for this, but the default B3 path is a generated probe scaffold plus user-run results. The static + runtime cross-check catches defects each surface alone would miss.

**Code patterns to flag**:
- Static `tabindex > 0` (axe-core flags; finding stands on static alone)
- Static-clean tabindex BUT runtime keyboard-traversal reveals visually-unexpected focus jumps (custom widgets with `aria-activedescendant` virtual focus + a stale `tabindex="0"`)

**See also**: A11Y-018 (Do not use positive tabindex values); A11Y-017 (Custom controls built from `<div>`/`<span>` must wire keyboard support).

---

### RTV-AXE-05: ARIA-applied-vs-declared mismatch (runtime axe-core catches what static cannot)

**Severity**: MAJOR
**Authority**: WAI-ARIA 1.2 specification; axe-core `aria-*` rule family
**Source**: https://www.w3.org/TR/wai-aria-1.2/ — ARIA 1.2 normative spec

**The rule**: Static review can verify ARIA attribute presence/syntax in source (A11Y-045..060 cover the baseline subset); runtime can verify the COMPUTED ARIA tree matches the declared attributes after JavaScript framework rendering, dynamic state changes, and ARIA-applied-vs-declared divergence (e.g., a React component declares `aria-expanded` in JSX but the runtime state doesn't update on click — static sees the attribute, runtime sees the stale value). axe-core's runtime tree-walk catches this class.

**Code patterns to flag**:
- ARIA states (`aria-expanded`, `aria-pressed`, `aria-checked`) declared but not bound to component state
- ARIA labels (`aria-label`, `aria-labelledby`) with stale or undefined target references at runtime
- Custom widget components claiming APG conformance but failing axe-core's APG rule subset at runtime

**See also**: A11Y-045..060 (static ARIA baseline); COMP-APG-01..15 (full APG widget conformance, runtime verification adds defense-in-depth).

---

### RTV-AXE-06: `region`, `landmark-one-main`, and structural-landmark rules require rendered-DOM verification

**Severity**: MAJOR
**Authority**: WCAG 2.1 SC 1.3.1 (Info and Relationships); axe-core `region` + `landmark-one-main` rules
**Source**: https://dequeuniversity.com/rules/axe/4.9/region

**The rule**: Landmarks (`<main>`, `<nav>`, `<aside>`, `<header>`, `<footer>`) at the source level (A11Y-004 use landmark elements for page regions) may be correctly declared but lose their semantic role at runtime if framework rendering wraps them in non-landmark containers, applies ARIA-hidden, or generates duplicates. axe-core's `region` + `landmark-one-main` rules walk the rendered tree to verify post-render landmark structure.

**Code patterns to flag**:
- Multiple `<main>` elements rendered (one per route in SPA mis-config)
- Landmark elements with `role="presentation"` or `aria-hidden="true"` accidentally applied
- Content outside any landmark region after framework hydration

**See also**: A11Y-004 (Use landmark elements for page regions); A11Y-005 (Provide a skip link to bypass repeated navigation).

---

### RTV-AXE-07: Form-label association rules require rendered-form runtime walk

**Severity**: MAJOR
**Authority**: WCAG 2.1 SC 3.3.2 (Labels or Instructions), 1.3.1 (Info and Relationships); axe-core `label` + `form-field-multiple-labels` rules
**Source**: https://dequeuniversity.com/rules/axe/4.9/label

**The rule**: Static review verifies `<label for="X">` source patterns (A11Y-009 + UX-001..005). Runtime axe-core verifies the rendered DOM's actual label-control association: `<label>` referencing nonexistent `id`, dynamically-generated `id` collisions, framework-injected wrapper breaking the `for` reference, multiple labels associating with the same control. The runtime check catches framework-hydration defects static review structurally cannot detect.

**Code patterns to flag**:
- Dynamic `id` generation that produces collisions (`React.useId()` collisions across SSR/CSR boundaries)
- `<label>` with `htmlFor` pointing at id resolved at runtime to nonexistent target
- Form controls with multiple associated labels (one explicit `<label for>`, one implicit `<label>` wrap)

**See also**: A11Y-009 (form-control programmatic labels); UX-001..005 (form UX baseline).

---

### RTV-AXE-08: `image-alt` runtime check catches dynamic `alt` defects

**Severity**: MAJOR
**Authority**: WCAG 2.1 SC 1.1.1 (Non-text Content); axe-core `image-alt` rule
**Source**: https://dequeuniversity.com/rules/axe/4.9/image-alt

**The rule**: Static review catches missing `alt` attribute in JSX source (A11Y-020 `<img>` must have alt + A11Y-021 inline SVG accessible naming). Runtime axe-core catches dynamically-rendered images where `alt` is computed from data and produces empty-string (`alt=""`) for non-decorative images, or stale `alt` mismatched to the rendered `src`. Common in image carousels, CMS-driven content, lazy-loaded galleries.

**Code patterns to flag**:
- `<img alt={data.altText}>` where `data.altText` can be `undefined` or empty for non-decorative images
- Image components that fall back to filename-as-alt without user-meaningful description
- `alt=""` (decorative) on images that have meaningful content

**See also**: A11Y-020 (Every `<img>` must have an `alt` attribute); A11Y-021 (Inline SVG needs accessible naming or hiding).

---

### RTV-AXE-09: `link-name` runtime check catches empty-link defects at render-time

**Severity**: MAJOR
**Authority**: WCAG 2.1 SC 2.4.4 (Link Purpose), 4.1.2 (Name, Role, Value); axe-core `link-name` rule
**Source**: https://dequeuniversity.com/rules/axe/4.9/link-name

**The rule**: Static review can verify `<a>` with text content; runtime catches `<a href="...">` rendered with empty/whitespace-only text (icon-only links without `aria-label`, framework-conditional rendering producing empty link content, image-link with missing `alt`). axe-core's `link-name` rule walks the rendered DOM and reports links with no accessible name.

**Code patterns to flag**:
- Icon-only `<a>` without `aria-label` (e.g., `<a href="..."><svg>...</svg></a>`)
- Conditional rendering: `<a href="...">{label && label}</a>` where label can be falsy
- Image-link: `<a href="..."><img src="..."></a>` where `<img>` lacks `alt`

**See also**: A11Y-015 (Use the correct element — link vs button); A11Y-027 (Accessible name must include visible label text); A11Y-021 (Inline SVG accessible naming for icon-only links).

---

### RTV-AXE-10: `html-has-lang` runtime verification catches SPA lang-switching defects

**Severity**: MAJOR
**Authority**: WCAG 2.1 SC 3.1.1 (Language of Page); axe-core `html-has-lang` rule
**Source**: https://dequeuniversity.com/rules/axe/4.9/html-has-lang

**The rule**: Static review verifies `<html lang>` in source (A11Y-001 + I18N-STR-03). Runtime catches SPA locale-switching defects where `<html lang>` is set at initial render but stale after JavaScript locale switch (i18next-driven locale change updates body content but forgets to update `document.documentElement.lang`). Per I18N-STR-03's "runtime correctness" requirement.

**Code patterns to flag**:
- Locale-switcher JS that updates `document.body` content but not `document.documentElement.lang`
- React/Vue i18n integration without `useEffect`/`watch` on locale change syncing `<html lang>`

**See also**: A11Y-001 (html lang presence); I18N-STR-03 (runtime lang-attribute correctness).

---

## RTV-CONTRAST-* — computed-style contrast measurement

### RTV-CONTRAST-01: Verify computed contrast for text on dynamic-color backgrounds

**Severity**: MAJOR (WCAG AA threshold violation) / MINOR (AAA-only)
**Authority**: WCAG 2.1 SC 1.4.3 (Contrast Minimum) + 1.4.6 (Contrast Enhanced)
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html

**The rule**: For text elements where the background color is determined dynamically (CSS variable + theme switching, gradient backgrounds where text overlaps multiple colors, image-overlaid text), runtime-visual MUST compute the actual rendered contrast via `getComputedStyle()` against the actually-rendered foreground/background pixels (not the source CSS declaration). axe-core's `color-contrast` rule covers most cases; this rule covers what axe-core's heuristics miss (e.g., text over `linear-gradient` backgrounds where axe-core samples only declared color).

**Code patterns to flag**:
- Text on `background-image: linear-gradient(...)` — axe-core often skips with `color-contrast-enhanced` undetermined
- Text on semi-transparent overlays — alpha blending changes effective contrast
- Theme-switched text where the dark/light theme bases were not both contrast-tested

**See also**: RTV-AXE-03 (axe-core color-contrast baseline); COMP-WCAG-AAA-01 (AAA 7:1 contrast enhancement); accessibility/README.md §"WCAG 1.4.3 Contrast (Minimum)" — no static A11Y rule exists for color-contrast per the runtime-deferred scope-boundary at accessibility/README.md L40; runtime path is the canonical mechanism.

---

### RTV-CONTRAST-02: Focus-indicator contrast against adjacent colors

**Severity**: MAJOR
**Authority**: WCAG 2.1 SC 1.4.11 (Non-text Contrast) + WCAG 2.2 SC 2.4.13 (Focus Appearance)
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html + https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html

**The rule**: Focus indicators (the `:focus` / `:focus-visible` outline ring) MUST achieve 3:1 contrast against ALL adjacent colors — both the focused element's background AND the outside-element background. axe-core's static analysis covers single-color cases; runtime measurement is required for: element-on-button-on-card composites (3-layer color stack), gradient borders, focus rings that visually-cross color boundaries.

**Code patterns to flag**:
- Custom focus styles with `outline-color` set against only one background context
- `outline: none` replaced by box-shadow without contrast verification against adjacent layers
- Theme-switched focus styles where each theme's outline was tested in isolation, not against in-context backgrounds

**See also**: A11Y-037 (Focused element must be fully visible — Enhanced); A11Y-038 (Focus indicator must meet thickness and contrast minimums).

---

### RTV-CONTRAST-03: UI component contrast for icon-only buttons + form controls

**Severity**: MAJOR
**Authority**: WCAG 2.1 SC 1.4.11 (Non-text Contrast 3:1 for UI components)
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html

**The rule**: Icon-only buttons, form-control borders, toggle switches, and checkbox/radio indicators MUST achieve 3:1 contrast against their adjacent background. Runtime measurement extracts the actual rendered SVG fill colors / border colors against the actual component background. Static review cannot verify because SVG fill may inherit from theme variables resolved at runtime.

**Code patterns to flag**:
- SVG icons with `fill="currentColor"` where parent color resolves to insufficient contrast
- Form-control borders with `border-color` from CSS variable that resolves below 3:1 in dark theme
- Toggle switches where the "off" state indicator falls below 3:1 against off-background

**See also**: VD-COLOR-04 (color-only signal anti-pattern). Note: no static A11Y rule exists for non-text contrast per accessibility/README.md L40 runtime-deferred scope boundary.

---

### RTV-CONTRAST-04: AAA-enhanced 7:1 contrast verification

**Severity**: MINOR (default) / MAJOR (when AAA conformance declared)
**Authority**: WCAG 2.1 SC 1.4.6 (Contrast Enhanced)
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html

**The rule**: When project declares AAA conformance target (per COMP-WCAG-AAA-01 scope), runtime contrast measurement MUST verify 7:1 for normal text + 4.5:1 for large text. Static review's static-color CSS check cannot verify rendered output; runtime measurement of computed pixel colors is the only reliable verification path.

**Code patterns to flag**:
- AAA-conformance-declared project with text-color heuristics targeting only AA threshold
- Theme switcher with light/dark variants where one variant fails AAA threshold

**See also**: COMP-WCAG-AAA-01 (Contrast Enhanced spec); RTV-CONTRAST-01 (AA computed contrast).

---

### RTV-CONTRAST-05: State-color contrast (hover, active, disabled)

**Severity**: MINOR
**Authority**: WCAG 2.1 SC 1.4.11 (UI components include state changes per Understanding doc)
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html

**The rule**: Component state visualizations (`:hover`, `:active`, `:focus`, `:disabled`) MUST each independently meet contrast requirements. Common defect: `:disabled` state styled with low-contrast gray that fails 3:1 against background, masking the perceptual indication of disabled state from low-vision users. Runtime measurement should walk each state class through generated probes, user-run Playwright results, or an explicitly supported host adapter.

**Code patterns to flag**:
- Disabled buttons styled `opacity: 0.5` or `color: #ccc` without contrast verification
- Hover-state color changes that produce LOWER contrast (counter-intuitive but common pattern)

**See also**: IS-* interaction-state inventory. Note: state-color contrast is runtime-deferred per accessibility/README.md L40; no static A11Y rule covers this surface.

---

### RTV-CONTRAST-06: Placeholder text contrast (the canonical low-contrast antipattern)

**Severity**: MAJOR
**Authority**: WCAG 2.1 SC 1.4.3 (Contrast Minimum applies to placeholder text per W3C clarification 2024)
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html

**The rule**: HTML `<input placeholder>` text rendered by browsers defaults to a low-contrast UA stylesheet color (commonly ~3:1 in Chrome's `gray` default). Custom CSS often inherits this or sets `::placeholder { color: #ccc }` style which falls below 4.5:1. Runtime measurement of computed `::placeholder` color against input background is the reliable check.

**Code patterns to flag**:
- `::placeholder { color: ... }` rules without contrast verification
- Placeholder-as-label patterns (already flagged by UX-002) compound the contrast defect when the placeholder IS the only label

**See also**: UX-002 (placeholder-as-label antipattern). Note: placeholder contrast is runtime-deferred per accessibility/README.md L40; no static A11Y rule covers this surface.

---

### RTV-CONTRAST-07: Disabled form-control + button contrast

**Severity**: MINOR (state semantics partially exempt under WCAG 1.4.3 §incidental) / MAJOR (when the disabled state is the only visual cue for unavailability)
**Authority**: WCAG 2.1 SC 1.4.3 incidental exception; SC 3.3.2 (Labels or Instructions)
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html — §incidental

**The rule**: Disabled form controls are partially exempt from 1.4.3 under the "incidental" exception, but when the disabled state is the user's only indication that an action is unavailable (no text explanation, no inline error message), the contrast must remain perceivable. Runtime measurement + cross-check with surrounding inline text presence.

**Code patterns to flag**:
- Disabled submit button styled `opacity: 0.4` without inline explanation of why disabled
- Disabled checkboxes that fade below 1.4:1 — perceptually indistinguishable from missing element

**See also**: UX-004 (form-error messaging); IS-* interaction-states.

---

## RTV-DIFF-* — screenshot diff / baseline-vs-current regression

### RTV-DIFF-01: Baseline screenshot capture at canonical viewport (1280×800)

**Severity**: MINOR
**Authority**: Playwright `page.screenshot()` API + AIVV runtime-visual implementation choice
**Source**: https://playwright.dev/docs/api/class-page#page-screenshot — Playwright API reference

**The rule**: When runtime evidence includes baseline screenshots, the canonical viewport is `1280×800` (desktop laptop reference; matches Playwright's default + common dev-server preview size). Baseline files are stored at `<target>/.aivv/visual-baselines/<route-slug>-<viewport>.png` when the project chooses screenshot-baseline persistence. Pixel-diff threshold: <1% diff = no finding; ≥1% diff = MINOR; ≥5% diff = MAJOR (substantial UI regression).

**Code patterns to flag**:
- Viewport-specific layout issues that pass at 1280×800 but fail at common mobile widths (375×667 iPhone SE, 414×896 iPhone 12)
- Responsive breakpoint defects requiring multi-viewport screenshot batch

**See also**: VVT-001..050 (visual-verification triggers — when static review emits ⚠ Visual verification required); RTV-DIFF-02 (multi-viewport batch).

---

### RTV-DIFF-02: Multi-viewport baseline batch (desktop + tablet + mobile)

**Severity**: MINOR
**Authority**: Playwright multi-context API; mobile-first responsive design discipline
**Source**: https://playwright.dev/docs/api/class-page#page-set-viewport-size

**The rule**: For pages with responsive design (any matching `@media` query in source CSS), runtime screenshot evidence should cover THREE canonical viewports: `1280×800` (desktop), `768×1024` (tablet portrait), `375×667` (mobile). Cross-viewport diff verifies responsive layout works correctly at each breakpoint. Critical for catching: horizontal-scroll defects, broken hamburger menus, mobile-only layout collapses.

**Code patterns to flag**:
- Pages with `@media` queries but baseline captured at only one viewport
- Mobile-first CSS without mobile-viewport baseline screenshot

**See also**: VVT-003 (breakpoint or media-query changes); RTV-DIFF-01 (canonical desktop baseline).

---

### RTV-DIFF-03: Animation-frozen screenshots via `prefers-reduced-motion`

**Severity**: MINOR
**Authority**: Playwright `emulateMedia({ reducedMotion: 'reduce' })` API; W3C `prefers-reduced-motion` media query
**Source**: https://playwright.dev/docs/api/class-page#page-emulate-media + https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion

**The rule**: Screenshots of pages with CSS animations / transitions MUST emulate `prefers-reduced-motion: reduce` before capture. Otherwise screenshot pixel-diff registers false-positive failures from animation timing differences between runs. Playwright's `page.emulateMedia({ reducedMotion: 'reduce' })` is the canonical API.

**Code patterns to flag**:
- Screenshot capture without animation freezing → false-positive diffs from animation timing
- CSS `transition` or `animation` properties that ignore `@media (prefers-reduced-motion: reduce)` rule (separately fires A11Y-033 / A11Y-070)

**See also**: A11Y-033 (prefers-reduced-motion respect); A11Y-070 (animation duration cap); VVT-008 (animation/transition changes).

---

### RTV-DIFF-04: Font-loading wait via `page.waitForLoadState('networkidle')`

**Severity**: MINOR
**Authority**: Playwright `waitForLoadState` API
**Source**: https://playwright.dev/docs/api/class-page#page-wait-for-load-state

**The rule**: Before screenshot capture, the runtime driver MUST `await page.waitForLoadState('networkidle')` to ensure custom web fonts have loaded. Otherwise screenshots register false-positive diffs from FOIT/FOUT (Flash of Invisible/Unstyled Text) timing. Combined with `prefers-reduced-motion` freeze (RTV-DIFF-03), this eliminates the two most common screenshot-flakiness sources.

**Code patterns to flag**:
- Screenshots taken before font-display CSS rule completes
- `page.goto(URL)` + immediate `page.screenshot()` without waitForLoadState

**See also**: VD-TYPE-06 (FOIT timeout); RTV-DIFF-03 (animation freeze).

---

### RTV-DIFF-05: Pixel-diff threshold + tolerance per visual-element type

**Severity**: MINOR (default; <1% diff = no finding)
**Authority**: AIVV runtime-visual implementation choice
**Source**: Per the runtime-visual opt-in path §implementation — AIVV-chosen aggregate-percent thresholds. Other visual-regression tools (Percy, Chromatic) use related-but-distinct threshold conventions (per-pixel YIQ-distance vs aggregate-percent); CI integrators MUST calibrate thresholds against the documented convention of each tool rather than assuming numeric equivalence with AIVV's aggregate-percent.

**The rule**: Pixel-diff result classification: 0-1% aggregate-pixel-diff = no finding (anti-aliasing + sub-pixel rendering noise); 1-5% aggregate-pixel-diff = MINOR (likely intentional UI change OR low-impact regression); ≥5% aggregate-pixel-diff = MAJOR (substantial regression requiring baseline review); ≥20% aggregate-pixel-diff = CRITICAL (page broken or wrong content). Per-region tolerance higher for text (5% baseline; fonts antialias differently across OS/font-version) than for static images (1% baseline). Per-pixel YIQ-distance vs aggregate-percent differ semantically — AIVV's thresholds are aggregate-percent; tools like Chromatic use per-pixel YIQ-distance instead; consult the cited tool docs when configuring CI integration.

**Code patterns to flag**:
- Tightening threshold below 1% without OS/font-version baseline-blessing process (produces flaky cross-CI false positives)
- Loosening threshold above 5% silently (masks regressions)

**See also**: RTV-DIFF-01 (canonical viewport); RTV-DIFF-06 (baseline-blessing flow).

---

### RTV-DIFF-06: Baseline-blessing requires explicit user confirmation

**Severity**: MAJOR
**Authority**: AIVV runtime-visual implementation choice; mutation-safety hard requirement per runtime-visual opt-in path §Three-Tier scope extension
**Source**: Per the runtime-visual opt-in path §implementation — baseline-blessing requires explicit user confirmation (interactive prompt OR `--bless-baseline=<route>` flag with target). Silent baseline overwrite is never allowed.

**The rule**: When UI legitimately changes and the user wants to update a screenshot baseline, the runtime evidence workflow MUST require explicit user confirmation. Silent baseline overwrite is NEVER allowed — it would defeat regression detection by accepting any drift as new truth. Baseline files are gitignored or committed per project preference (declared in `.aivv/config.json` or default to gitignored for binary-blob avoidance).

**Code patterns to flag**:
- Automated CI flows that auto-bless on any diff (this defeats the purpose)
- Baseline overwrite without git-history retention

**See also**: runtime-visual opt-in path §implementation; UX-035 (destructive-action confirmation pattern).

---

### RTV-DIFF-07: Theme-switched baseline pairs (light + dark)

**Severity**: MINOR
**Authority**: CSS `color-scheme` + `prefers-color-scheme`; Playwright `emulateMedia` API
**Source**: https://playwright.dev/docs/api/class-page#page-emulate-media — `colorScheme` option

**The rule**: For sites with light/dark theme support (any matching `prefers-color-scheme` media query or `color-scheme` CSS property), runtime screenshot evidence should capture baseline pairs: `<route>-<viewport>-light.png` + `<route>-<viewport>-dark.png`. Each theme is independently diffed. Common defect: dark-mode regression where one theme's baseline was updated but the other's was forgotten.

**Code patterns to flag**:
- Sites with dark-theme support but baseline captured at only one theme
- Theme-conditional styles that produce visually-identical output (suggests broken theme switching)

**See also**: VVT-058 (light-dark() function); VVT-061 (prefers-contrast); A11Y-070 (theme switching + reduced-motion interactions).

---

### RTV-DIFF-08: Cross-browser baseline (Chromium + Firefox + WebKit)

**Severity**: MINOR (default; many cross-browser diffs are acceptable rendering variations) / MAJOR (when diff is functional layout-break)
**Authority**: Playwright multi-browser launch API
**Source**: https://playwright.dev/docs/browsers

**The rule**: For projects with explicit cross-browser support (declared in package.json `browserslist` or `.aivv/config.json` `runtime_browsers` array), runtime screenshot evidence should capture a baseline per browser engine. Pixel-diff threshold for cross-browser comparison is LOOSENED to 5% (different rendering engines anti-alias differently). The browser-pair diff catches engine-specific layout breaks (Safari `position: sticky` bugs, Firefox flex-gap rendering differences).

**Code patterns to flag**:
- Projects with `browserslist` declaring multiple engines but baseline captured in only Chromium
- Engine-specific CSS hacks (`@supports (-webkit-touch-callout: none)`, `@-moz-document`) without per-engine baseline verification

**See also**: RTV-DIFF-01 (canonical viewport); browserslist convention.

---

## Cross-catalog See-also (back-references received)

This catalog receives cross-catalog back-cites from related rules:

- **A11Y-001** (html lang presence) → receives back-cite for RTV-AXE-10 SPA lang-switching runtime verification
- **Visual-verification triggers** → reciprocal back-cites in the catalog index, at catalog scope to avoid duplicate references on every individual rule.
- **COMP-WCAG-AAA-01** (Contrast Enhanced 7:1) → receives back-cite for RTV-CONTRAST-04 AAA runtime verification
- Note: no static A11Y rule exists for color-contrast / non-text-contrast per accessibility/README.md L40 runtime-deferred scope boundary — the runtime path (RTV-CONTRAST-*) is the canonical mechanism; there is no back-cite to inject in static A11Y for these.

Reciprocal back-citations should be updated together whenever a standard is added or revised, so source guidance and cross-references remain consistent.

## Driver-status note

Per `.aivv/lenses/visual.md` (B3 update): `runtime_driver: optional (externalized probe scaffolds + user-run Playwright JSON ingest)`. When runtime artifacts are unavailable, RTV-* findings are evidence-limited; the visual lens's static-review baseline continues with A11Y-*, UX-*, VVT-*, VD-*, DP-* rule coverage unaffected. Graceful degradation: absence of runtime artifacts does not fabricate RTV-* findings.
