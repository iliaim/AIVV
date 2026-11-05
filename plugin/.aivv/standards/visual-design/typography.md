# Visual Design — Typography (VD-TYPE-01..12)

Part of [.aivv/standards/visual-design/](README.md).

### VD-TYPE-01: Modular type scale

**Severity**: POLISH
**Rationale**: Arbitrary one-off font sizes (`14.5px`, `17px`, `21px` ad hoc) produce visual noise and inconsistent rhythm. A modular scale (8 to 12 steps, usually 1.125 → 1.333 ratio) is the conventional baseline.
**Source**: Refactoring UI Ch.5 typography — https://www.refactoringui.com/

**The rule**: font sizes come from a defined scale (design tokens, Tailwind `text-*`, CSS custom properties, theme constants). Inline arbitrary sizes that bypass the scale are flagged.

**Code patterns to flag**:
- `style={{ fontSize: '17px' }}` inline literal
- Tailwind arbitrary values: `text-[17px]` when a scale step exists
- One-off CSS: `font-size: 14.5px;` without rationale
- Multiple competing scales in the same surface (Tailwind `text-sm` + design-token `--font-md` mixed)

**Correct pattern**: `className="text-base"` or `style={{ fontSize: 'var(--text-md)' }}` — single scale source consumed everywhere.

**Quick-fix hint**: search for `text-\[` or hardcoded `font-size:` literals. Replace with scale tokens.

---

### VD-TYPE-02: Body text minimum 16px

**Severity**: MINOR
**Rationale**: Body text below 16px on web (sub-13px on mobile native) causes Safari iOS zoom on input focus, hurts low-vision readers, and looks "cramped." Refactoring UI: smaller-than-16px is reserved for *secondary* metadata, not primary content.
**Source**: web.dev font-size — https://web.dev/learn/css/typography

**The rule**: primary body / paragraph / form-input text is ≥ 16px (or `1rem` with `:root` font-size at default). Smaller scales reserved for meta (timestamps, attribution, label-secondary).

**Code patterns to flag**:
- `<p className="text-xs">` (12px in Tailwind default) used for primary copy
- `<input style={{ fontSize: '14px' }}>` (triggers iOS zoom)
- Body CSS reset: `body { font-size: 14px; }`

**Correct pattern**: body / inputs at `text-base` (16px); `text-sm` (14px) for secondary meta only.

**Quick-fix hint**: scan for `text-xs` / `text-sm` on `<p>`, `<input>`, `<textarea>`, paragraph-wrappers — many are mis-classified.

---

### VD-TYPE-03: Line-height for body vs headings

**Severity**: POLISH
**Rationale**: Body copy needs generous line-height (1.4–1.7) for scanning long-form reading; headings tighten to 1.1–1.25 because they're short and visual rhythm dominates. Uniform `line-height: 1.5` everywhere produces airy headings and cramped paragraphs.
**Source**: Material Design 3 typography — https://m3.material.io/styles/typography/overview

**The rule**: distinct line-height tokens for body (loose) and headings (tight). Single global `line-height` value applied to both is a smell.

**Code patterns to flag**:
- `* { line-height: 1.5; }` universal reset
- Heading components with body line-height (`<h1 className="leading-relaxed">`)
- Inline copy mixing body and headings with no line-height differentiation

**Correct pattern**: heading: `leading-tight` / `leading-none`; body: `leading-relaxed` / `leading-7`; design-token `--leading-heading` vs `--leading-body`.

**Quick-fix hint**: grep `line-height` and `leading-`; if a single value dominates, the rule fires.

---

### VD-TYPE-04: Font-weight pairing

**Severity**: POLISH
**Rationale**: Body text + heading benefit from 2–3 weight stops apart, not adjacent. Weight 400 body + weight 500 heading looks weak; weight 400 body + weight 700 heading reads as the intended hierarchy.
**Source**: Refactoring UI Ch.5 typography — https://www.refactoringui.com/

**The rule**: heading and body weights differ by ≥ 200 units, OR the heading uses a distinct family with a designed weight relationship.

**Code patterns to flag**:
- Body `font-weight: 400` + heading `font-weight: 500` (too close)
- Heading uses italic-instead-of-bold for distinction (italic alone reads as emphasis, not hierarchy)

**Correct pattern**: body 400 + heading 600/700, or body 300 + heading 500 (light/medium pairing).

**Quick-fix hint**: list all `font-weight` / `font-*` Tailwind classes; check adjacent text contexts.

---

### VD-TYPE-05: Font-family stack robustness

**Severity**: MINOR
**Rationale**: `font-family: "Brand Sans";` without fallbacks fails the moment the web font fails to load — text falls back to serif (browser default), producing a layout shift and bad first impression. Comprehensive stacks (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, etc.) provide near-native rendering during font-load.
**Source**: web.dev font-best-practices — https://web.dev/articles/font-best-practices

**The rule**: every `font-family` declaration has a system-font fallback stack ending in `sans-serif` or `serif` keyword.

**Code patterns to flag**:
- `font-family: 'Inter';` (no fallback)
- `font-family: 'Inter', sans-serif;` (no system-fonts intermediate — works but misses native render during load)
- Tailwind default `font-sans` when overridden by a custom font without re-establishing fallbacks

**Correct pattern**: `font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;` or design-token `--font-sans` configured at theme root.

**Quick-fix hint**: search `font-family:` and Tailwind `font-` config overrides; verify keyword fallback exists.

---

### VD-TYPE-06: Web-font loading strategy

**Severity**: MINOR
**Rationale**: Default web-font behavior is FOIT (invisible text during 3s timeout) — looks broken. `font-display: swap` shows fallback immediately and swaps when font arrives (FOUT — visible). `font-display: optional` is best for fonts that aren't load-critical.
**Source**: web.dev font-display — https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display

**The rule**: every `@font-face` declaration has `font-display: swap` (or `optional`). Missing `font-display` is the default-FOIT smell.

**Code patterns to flag**:
- `@font-face { font-family: ...; src: ...; }` without `font-display`
- Next.js `next/font` configured without `display` option
- Google Fonts `<link>` without `&display=swap` query param
- `font-display: block` (3s invisible — almost always wrong on web)

**Correct pattern**: `@font-face { font-family: 'Inter'; src: ...; font-display: swap; }` or `next/font` with `display: 'swap'`.

**Quick-fix hint**: grep `@font-face` and `next/font`; verify `font-display` set.

**See also**: **VVT-053** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger for `font-display` descriptor changes; the runtime-trigger complement to this aesthetic-baseline rule (this rule defines the *policy* — what `font-display` value to author; VVT-053 flags when code changes warrant runtime verification of the resulting block/swap/failure-period behavior).

---

### VD-TYPE-07: Variable-font axes vs static-weight files

**Severity**: POLISH
**Rationale**: Loading 4 static weight files (300/400/500/700) costs ~400 KB. A single variable-font file at ~150 KB exposes all weights via `font-weight: <number>` 1–999. Variable fonts also enable smooth weight transitions for hover/state animation.
**Source**: web.dev variable-fonts — https://web.dev/articles/variable-fonts

**The rule**: if 3+ static font weights are loaded for the same family, prefer the variable-font alternative.

**Code patterns to flag**:
- `@font-face` for Inter-300, Inter-400, Inter-500, Inter-600, Inter-700 (5 files)
- Next.js `next/font/google` requesting multiple `weight: ['300', '400', '500']` from a family that ships a variable font

**Correct pattern**: single `Inter[wght].woff2` variable font + `font-variation-settings: 'wght' 400;` or `font-weight: 400;`.

**Quick-fix hint**: count `@font-face` blocks per family; > 2 of the same family is a candidate for variable-font consolidation.

---

### VD-TYPE-08: Optical line length 45-75ch

**Severity**: POLISH
**Rationale**: Long-form text becomes hard to scan past ~75 characters per line — the eye loses its place on the carriage return. Below ~45ch, the text breaks awkwardly and feels choppy. The `ch` unit (width of `0`) ties this to the rendered font.
**Source**: web.dev line-length — https://web.dev/learn/css/typography

**The rule**: text containers with long-form prose (`<p>`, `<article>`, `<main>`) cap width at ~65ch (range 45–75ch).

**Code patterns to flag**:
- `<article>` or `<main>` without `max-width`
- Long-form copy stretching to viewport width on desktop (`max-w-full`, `w-screen` on `<p>`)
- Fixed pixel widths that don't scale with font (`max-width: 800px;` on body copy)

**Correct pattern**: `<article className="max-w-prose">` (Tailwind, ~65ch) or `<article style={{ maxWidth: '65ch' }}>`.

**Quick-fix hint**: any `<article>`, `<main>`, `<p>` wrapper without `max-w-*` or `max-width` in long-form contexts.

---

### VD-TYPE-09: text-wrap balance / pretty

**Severity**: POLISH
**Rationale**: Default line-breaking produces orphans (last line is one word). `text-wrap: balance` (CSS Text Level 4) balances line lengths for headings; `text-wrap: pretty` optimizes paragraphs to avoid single-word last lines. Modern browsers ship this.
**Source**: web.dev css-text-wrap-balance — https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap

**The rule**: headings 2+ lines use `text-wrap: balance`; long-form paragraphs use `text-wrap: pretty`. Use feature detection / progressive enhancement for older browsers.

**Code patterns to flag**:
- Headings wrapped to multiple lines with no `text-wrap` declaration (orphan-prone)
- Card titles in grids producing single-word last lines

**Correct pattern**: `h1, h2, h3 { text-wrap: balance; } p { text-wrap: pretty; }`.

**Quick-fix hint**: heading styles without `text-wrap`. Add a global rule at the typography reset layer.

---

### VD-TYPE-10: Numeric and tabular figures

**Severity**: POLISH
**Rationale**: Default proportional figures cause data columns (prices, counts, totals) to jitter as digits change. Tabular figures (`font-variant-numeric: tabular-nums`) lock digit widths so columns align.
**Source**: MDN font-variant-numeric — https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric

**The rule**: data tables, price columns, countdown timers, leaderboards use `font-variant-numeric: tabular-nums` to prevent reflow on digit change.

**Code patterns to flag**:
- `<td>$1,234</td>` columns without `tabular-nums`
- Animated counters / live-updating numeric displays without tabular figures
- Timer / clock components default-proportional

**Correct pattern**: `td { font-variant-numeric: tabular-nums; }` or per-element `style={{ fontVariantNumeric: 'tabular-nums' }}`.

**Quick-fix hint**: `<table>` styling, price/counter components — verify tabular-nums applied.

---

### VD-TYPE-11: Heading hierarchy weight + size

**Severity**: POLISH
**Rationale**: Heading levels (`h1`–`h6`) must visually communicate hierarchy via size *and* weight. If `h2` and `h3` are the same size, hierarchy collapses. If weight steps reverse (h2 lighter than h3), the visual reads as inverted.
**Source**: Refactoring UI Ch.5 typography — https://www.refactoringui.com/

**The rule**: each heading level is visually distinct from adjacent levels via size, weight, or color — not relying on default browser styles.

**Code patterns to flag**:
- Single global `h1, h2, h3, h4 { font-size: ... }` shared declaration
- Heading components with identical size and weight, distinguished only by margin
- Inverted weight (`h2` weight 600, `h3` weight 700)

**Correct pattern**: explicit per-level type tokens (`--text-h1`, `--text-h2`, etc.) with monotonic decreasing size + decreasing-or-equal weight.

**Quick-fix hint**: scan heading-component code; verify each level has distinct size token.

---

### VD-TYPE-12: Hyphenation control

**Severity**: POLISH
**Rationale**: Default browser hyphenation is too aggressive for English (breaks "the" off line ends), and absent for narrow languages (German compound words overflow). Manual control via `hyphens: manual | auto | none` aligns hyphenation with content type.
**Source**: MDN hyphens — https://developer.mozilla.org/en-US/docs/Web/CSS/hyphens

**The rule**: long-form text in justified or narrow-column layouts opts into `hyphens: auto`; UI labels and headings stay `hyphens: none` (never hyphenate a button label).

**Code patterns to flag**:
- `text-align: justify` without `hyphens: auto` (river-gaps in narrow columns)
- Button text / labels with `hyphens: auto` (can hyphenate "Sub-mit")
- No `lang` attribute on `<html>` (hyphens require lang for dictionary lookup — defer-to A11Y-001 in `accessibility/document-language.md` per dev.61 retrofit for compliance variant)

**Correct pattern**: body / article: `hyphens: auto;` + `lang="en"` on root; UI labels: `hyphens: none;`.

**Quick-fix hint**: any `text-align: justify` or narrow-column body needs `hyphens` + `lang`.
