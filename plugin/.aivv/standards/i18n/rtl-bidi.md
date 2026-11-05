# Internationalization — RTL safety + bidi text

Part of [.aivv/standards/i18n/](README.md) (I18N-RTL-NN). This subfile covers RTL (right-to-left) locale safety + bidi (bidirectional) text handling. RTL locales include Arabic, Hebrew, Farsi (Persian), Urdu, Pashto, Yiddish, Sindhi, and Dhivehi — approximately 1+ billion potential users globally. RTL safety failures range from cosmetic (misaligned UI) to functional (icons pointing the wrong direction, text spilling into wrong-direction columns).

### I18N-RTL-01: `<html dir="rtl">` is set when the active locale is RTL (auto-mirror entry-point)

**Severity**: MAJOR (escalate to CRITICAL when project declares RTL-language target)
**Authority**: HTML `dir` global attribute (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir — verbatim MDN inheritance behavior: "If an element has no `dir` attribute, it will inherit the `dir` value set on its parent node, which in turn may inherit it from its parent, and so on." Verbatim semantic emphasis: "As the directionality of the text is semantically related to its content and not to its presentation, it is recommended that web developers use this attribute instead of the related CSS properties when possible."

**The rule**: When the active user locale is RTL (Arabic `ar`, Hebrew `he`, Farsi `fa`, Urdu `ur`, Pashto `ps`, Yiddish `yi`, Sindhi `sd`, Dhivehi `dv`), the root `<html>` element MUST carry `dir="rtl"`. The `dir` attribute is the AUTO-MIRRORING ENTRY-POINT for the entire document — it propagates via inheritance to every descendant element, flips CSS logical properties (per I18N-RTL-02), reverses native form-control alignment, and aligns text per Unicode's bidi algorithm. Hardcoded `<html dir="ltr">` or omitted `dir` (defaults to ltr) breaks every RTL user's layout: text aligns left instead of right, scroll positions originate from the wrong edge, form controls misalign, and bidi-text rendering applies wrong base direction. SPAs must update `document.documentElement.dir` on locale change atomically with `lang` updates (per I18N-STR-03 lang-attribute discipline). The `dir="auto"` value is appropriate only for user-generated content where the base direction is unknown — never for the document root in a multilingual app where the user's locale is known.

**Code patterns to flag**:
- HTML template with static `<html>` (no dir attribute) regardless of user locale
- Static `<html dir="ltr">` shipped in `_document.tsx` / `index.html` with no per-request override for RTL users
- Multilingual SPA where the locale-switcher changes UI text + `lang` but NOT `dir`
- Locale-routing app (`/ar/...`, `/he/...`) that doesn't set `dir="rtl"` for RTL routes
- Component-level `dir="rtl"` set on individual sections instead of the root (works for isolated bidi content per I18N-RTL-03, but should NOT replace root-level `dir` for RTL-locale documents)

**Correct pattern**:
```jsx
// Server-side rendering (Next.js)
// pages/_document.tsx
import { Html } from "next/document";
const RTL_LOCALES = new Set(["ar", "he", "fa", "ur", "ps", "yi", "sd", "dv"]);
function getDir(locale: string): "ltr" | "rtl" {
  const base = new Intl.Locale(locale).language;  // per I18N-FMT-08
  return RTL_LOCALES.has(base) ? "rtl" : "ltr";
}
export default function Document({ locale }) {
  return <Html lang={locale} dir={getDir(locale)}>...</Html>;
}

// Client-side locale change (vanilla)
function setLocale(newLocale: string) {
  document.documentElement.lang = newLocale;  // per I18N-STR-03
  document.documentElement.dir = getDir(newLocale);  // I18N-RTL-01
  i18n.changeLanguage(newLocale);
}
```

**Quick-fix hint**: Bind `<html dir>` to the current locale via a small RTL-locales-set lookup (Arabic + Hebrew + Farsi + Urdu + Pashto + Yiddish + Sindhi + Dhivehi covers >99% of RTL users). Pair with `<html lang>` updates per I18N-STR-03 (set both atomically on locale change in SPAs). For SSR, render the correct `dir` server-side based on the request locale.

**See also**: **I18N-STR-03** (`i18n/strings.md`, "Runtime `<html lang>` value matches the active user-language locale") — sibling document-root attribute discipline; `lang` + `dir` should be set together atomically on locale change. **I18N-RTL-02** (this file, "Logical CSS properties") — `dir="rtl"` is the trigger that makes logical CSS properties auto-mirror; without it, logical properties behave identically to physical ones in LTR mode. **I18N-RTL-03** (this file, "Inline bidi isolation") — root `dir` sets the base direction; bidi isolation handles embedded foreign-direction inline fragments.

---

### I18N-RTL-02: Use CSS logical properties (`margin-inline-start`, `padding-inline-end`, etc.) instead of physical properties

**Severity**: MAJOR (escalate to CRITICAL when project declares RTL-language target)
**Authority**: CSS Logical Properties and Values Level 1 (W3C); MDN canonical reference
**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values — verbatim MDN canonical purpose: "The logical properties defined in this module enable defining properties relative to the content's writing direction, rather than a physical direction. This means content translated into languages with different writing modes will be rendered as intended."

**The rule**: CSS that sets directional properties (margin, padding, border, inset/positioning, text alignment, float, size constraints on inline dimension) MUST use the **logical-property variants** (`margin-inline-start`, `padding-inline-end`, `border-inline-*`, `inset-inline-*`, `inline-size` / `block-size`, `text-align: start` / `end`, `float: inline-start` / `inline-end`) — NEVER the physical-property variants (`margin-left`, `padding-right`, `border-left`, `left`/`right`, `width`/`height`, `text-align: left` / `right`, `float: left` / `right`). Logical properties auto-mirror under `dir="rtl"`: `margin-inline-start` applies to the LEFT side in LTR mode but the RIGHT side in RTL mode — without any `:dir(rtl)` selector duplication. Physical properties stay locked to their named side regardless of direction, producing wrong-side spacing under RTL: a button with `margin-left: 8px` keeps the 8px on the left in RTL mode, where it should be on the right (the "before-the-element-in-reading-order" side).

**Code patterns to flag**:
- `margin-left` / `margin-right` / `padding-left` / `padding-right` / `border-left` / `border-right` — replace with `-inline-start` / `-inline-end` variants
- `text-align: left` / `text-align: right` — replace with `text-align: start` / `text-align: end`
- `float: left` / `float: right` — replace with `float: inline-start` / `float: inline-end`
- `left: 0` / `right: 0` (for positioned elements) — replace with `inset-inline-start: 0` / `inset-inline-end: 0`
- `width: 200px` for elements where the inline dimension matters semantically — prefer `inline-size: 200px` (note: `width` is fine for unambiguously physical sizes like fixed-aspect-ratio images)
- Tailwind utility classes `ml-*` / `mr-*` / `pl-*` / `pr-*` on a project supporting RTL — should be `ms-*` / `me-*` / `ps-*` / `pe-*` (Tailwind logical variants) OR enable `@tailwindcss/logical` plugin
- styled-components / Emotion templates using physical `margin-left: ${theme.spacing.sm}` — same issue

**Correct pattern**:
```css
/* Logical properties auto-mirror under dir="rtl" */
.card {
  margin-inline-start: 1rem;    /* left in LTR; right in RTL */
  padding-inline: 1rem;         /* shorthand for inline-start + inline-end */
  border-inline-start: 2px solid var(--accent);
  text-align: start;            /* left in LTR; right in RTL */
}

.absolute-toolbar {
  position: absolute;
  inset-inline-end: 0;          /* right in LTR; left in RTL */
  inset-block-start: 0;         /* top in both (block-axis doesn't flip for horizontal writing) */
}

/* Tailwind with logical variants */
<div class="ms-4 pe-2 border-s-2 text-start">...</div>
```

**Quick-fix hint**: Replace every physical directional CSS property with its logical equivalent. For codebases with hundreds of physical-property uses, the `postcss-logical` or `@tailwindcss/logical` plugins auto-translate at build time. Audit `text-align: left` / `float: left` / inline-positioning `left` / `right` carefully — those are easy to miss. Logical properties are Baseline since 2023 (full support in all modern browsers).

**See also**: **I18N-RTL-01** (this file, `<html dir="rtl">`) — logical properties auto-mirror ONLY when the document direction is set via `dir="rtl"`; without root-level dir, logical properties behave identically to physical ones in LTR mode. The two rules compose: dir attribute + logical properties together produce auto-mirroring layout. **I18N-RTL-03** (this file, "Inline bidi isolation") — logical properties handle BLOCK-level direction; bidi isolation handles INLINE-level mixed-direction text (e.g., an English brand name embedded in Arabic prose).

---

### I18N-RTL-03: Inline bidi isolation for opposite-direction embedded text — use `<bdi>` or `dir="auto"` (never naïve concatenation)

**Severity**: MAJOR
**Authority**: W3C i18n WG; Unicode Bidirectional Algorithm (UAX #9)
**Source**: https://www.w3.org/International/articles/inline-bidi-markup/ — verbatim W3C isolation guidance: "Not only does the attribute apply the correct base direction to the phrase, but when browsers encounter the `dir` attribute on an element they (directionally) **isolate** the text inside the element from the text surrounding it." Verbatim recommendation for runtime content: "If the phrase is tightly wrapped by an element already, you could just add `dir=\"auto\"` to that element. This directionally isolates the element's text and looks at the first strong character to determine what base direction to apply."

**The rule**: When user-facing text contains EMBEDDED FRAGMENTS in a DIFFERENT base direction than the surrounding text (e.g., an Arabic page mentioning an English brand name; an English page mentioning an Arabic phrase; a user-generated string of unknown direction interpolated into translated copy), the embedded fragment MUST be wrapped in an HTML element with directional isolation — either `<bdi>` (semantically "bidi isolate") OR an element with `dir="auto"` (any element; `dir="auto"` applies first-strong-character base direction + isolation). NEVER naïvely concatenate / interpolate opposite-direction fragments. The Unicode bidi algorithm (UAX #9) without isolation can produce incorrect rendering where adjacent punctuation, numbers, or neutral characters reorder unexpectedly across the boundary: an Arabic message ending in `"."` followed by an English brand name would have the period attach to the English fragment instead of staying with the Arabic prose. `<bdi>` is Baseline Widely available since January 2020 per the MDN `<bdi>` per-feature page; `dir="auto"` Baseline status not independently verified at authoring time (MDN `dir` attribute page does not surface a per-attribute Baseline banner) — verify availability against the target browser-support floor of the consuming project. NEVER use `<bdo>` (bidi override) for this — `<bdo>` forces a direction; `<bdi>` ISOLATES one. Override forces wrong rendering when the embedded text's direction is unknown.

**Code patterns to flag**:
- Direct interpolation of user-generated strings into translated copy: `t("greeting", { name: user.name })` where `name` could be Arabic / Hebrew text and the surrounding message is English (or vice versa) — needs `<bdi>` or `dir="auto"` wrapper at render time
- React JSX rendering user content inline: `<p>Hello, {user.name}!</p>` — wrap `user.name` in `<bdi>` to isolate
- Server-side string concatenation of user-generated bidi text into a wider message without isolation markup
- `<bdo>` used for user-generated content (forces wrong direction when source direction is unknown)
- Comments / posts / search results displaying multi-user content without per-item bidi isolation
- Numeric fields embedded in RTL prose without isolation (numbers are weak/neutral and can reorder)

**Correct pattern**:
```jsx
// React: wrap user-generated content in <bdi> for bidi isolation
<p>Hello, <bdi>{user.name}</bdi>! Welcome to <bdi>{brand.name}</bdi>.</p>

// Equivalent: any element with dir="auto"
<p>Hello, <span dir="auto">{user.name}</span>!</p>

// react-intl ICU message with rich-text formatting (auto-wrapping)
<FormattedMessage
  id="greeting"
  defaultMessage="Hello, {name}!"
  values={{ name: <bdi>{user.name}</bdi> }}  // pass JSX element, not string
/>

// Plain HTML inside translated prose
<p>The brand <bdi dir="auto">YouTube</bdi> means literally "you tube"...</p>

// User-generated comment list: every comment body gets bidi isolation
{comments.map(c => (
  <li key={c.id}>
    <bdi>{c.authorName}</bdi>: <bdi>{c.body}</bdi>
  </li>
))}
```

**Quick-fix hint**: For every user-generated content interpolated into prose, wrap in `<bdi>` (preferred — semantic) or `<span dir="auto">` (equivalent — any element with `dir="auto"`). For react-intl / FormatJS messages with embedded user values, pass JSX elements (not strings) so the bidi isolation wrapper renders correctly. Numeric values embedded in RTL prose also benefit from isolation (numbers are bidi-neutral and can reorder unexpectedly).

**See also**: **I18N-RTL-01** (this file, `<html dir="rtl">`) — root dir sets the BASE direction for the document; bidi isolation handles EMBEDDED fragments whose direction differs from the base. **I18N-STR-05** (`i18n/strings.md`, "Never concatenate translated fragments") — STR-05 forbids string-level concatenation of TRANSLATED fragments; RTL-03 extends to USER-GENERATED bidi fragments which need isolation markup even when wrapped in a single message-format placeholder. **I18N-STR-01** (`i18n/strings.md`, translation-function discipline) — translation function + bidi isolation compose: the translated message body uses placeholders, the placeholder values get `<bdi>` wrapping when interpolated.

---

### I18N-RTL-04: Directional icons mirror under RTL; non-directional icons do NOT mirror

**Severity**: MAJOR (escalate to CRITICAL when project declares RTL-language target)
**Authority**: Material Design Bidirectionality + Apple HIG RTL guidance (industry-consensus design system documentation)
**Source**: https://m2.material.io/design/usability/bidirectionality.html + https://developer.apple.com/design/human-interface-guidelines/right-to-left — Material Design + Apple HIG share consensus on the directional-vs-non-directional icon classification. Cite-by-authority form (Material Design + Apple HIG pages did not WebFetch to extractable verbatim text at authoring time per dev.91+ Discipline 1 structural-gating scope; paraphrase exempt).

**The rule**: Icons that EXPRESS DIRECTION via their visual content (left-pointing arrow, right-pointing chevron, "previous"/"next" navigation, "back" arrow, undo curved-arrow-pointing-back, fast-forward / rewind triangles when used for OS-level forward/back navigation) MUST mirror under RTL — typically via `transform: scaleX(-1)` on the SVG element, or by shipping a per-direction asset. Icons that DO NOT express direction (search magnifier, info "i", warning triangle, brand logos, settings gear, hamburger menu, ellipsis "…", clock face, location pin, heart/star, user avatar, image/photo icon, document icon) MUST NOT mirror — mirroring them produces uncanny / backwards-feeling artwork without any directional benefit. Numbers, digits inside icons, and brand logos NEVER mirror regardless of context (mirrored "3" looks broken; mirrored brand identities violate trademark intent). Media-control icons (play triangle, fast-forward, rewind) are a SPECIAL CASE: play/fast-forward/rewind triangles refer to TIME progression (universally LTR even in RTL UIs because time flows the same direction globally), so they DO NOT mirror; track-skip arrows DO mirror because they refer to LIST navigation within the player UI.

**Code patterns to flag**:
- React/Vue components rendering directional icons (`<ChevronRight />`, `<ArrowLeft />`, `<BackIcon />`, `<UndoIcon />`) without any `transform: scaleX(-1)` or `:dir(rtl) { transform: scaleX(-1) }` style for RTL
- SVG icons in source with hardcoded direction (path data assumes LTR; no per-direction asset)
- Icon library used without RTL configuration (Lucide / Heroicons / Phosphor / Iconify — most modern libraries support RTL but require opt-in)
- `text-align: left` + arrow icon on a button — the alignment + icon must BOTH respond to RTL
- Mirroring NON-directional icons via blanket `:dir(rtl) svg { transform: scaleX(-1) }` (breaks brand logos, search icons, etc.)
- Media-control icons that mirror under RTL (play / fast-forward / rewind should NOT mirror; track-skip can)

**Correct pattern**:
```css
/* Directional icons mirror via :dir(rtl) selector */
.icon-arrow,
.icon-chevron,
.icon-back,
.icon-undo {
  /* default LTR orientation */
}
:dir(rtl) .icon-arrow,
:dir(rtl) .icon-chevron,
:dir(rtl) .icon-back,
:dir(rtl) .icon-undo {
  transform: scaleX(-1);
}

/* Non-directional icons explicitly DO NOT mirror (no rule needed; default behavior) */
/* Brand logos + numbers + media-time-direction (play/ff/rewind) NEVER mirror */
```
```jsx
// React: dedicated component handling mirror decision per icon kind
function DirectionalIcon({ kind, ...props }) {
  const directional = new Set(["arrow", "chevron", "back", "undo"]);
  return (
    <svg {...props} style={directional.has(kind) ? { transform: "var(--rtl-mirror, none)" } : undefined}>
      ...
    </svg>
  );
}
// :root { --rtl-mirror: none; }
// :root[dir="rtl"] { --rtl-mirror: scaleX(-1); }
```

**Quick-fix hint**: Audit every icon used in the UI and tag it as "directional" or "non-directional". Apply `transform: scaleX(-1)` ONLY to the directional set under `:dir(rtl)`. Use the CSS `:dir()` pseudo-class (Baseline since 2024) or fall back to `[dir="rtl"]` attribute selector for older browser support. For icon libraries, check the library's RTL docs (Lucide has `--lucide-rtl-mirror` variants; Heroicons requires manual handling; Material Symbols auto-mirrors directional glyphs).

**See also**: **I18N-RTL-01** (this file, `<html dir="rtl">`) — `:dir(rtl)` selectors fire when the document direction is set via dir attribute; without RTL-01's root-dir, no mirror occurs. **I18N-RTL-02** (this file, logical CSS properties) — logical properties auto-mirror layout; RTL-04 covers the parallel discipline for icon CONTENT mirroring. **VD-ICON-01..08** (`visual-design/iconography.md`) — icon-design rules (consistency, weight, semantic clarity) compose with RTL-04's mirror-decision discipline.

---

### I18N-RTL-05: Use HTML bidi markup (`<bdi>` / `dir`) — never bare Unicode bidi control characters (U+202A..U+202E, U+2066..U+2069)

**Severity**: MAJOR
**Authority**: Unicode Standard Annex #9 Unicode Bidirectional Algorithm (UAX #9); W3C i18n WG guidance
**Source**: https://unicode.org/reports/tr9/ + https://www.w3.org/International/articles/inline-bidi-markup/ — cite-by-authority form for UAX #9 (Unicode-org redirect chain at fetch time; canonical normative authority for the bidi algorithm + control-character definitions). UAX #9 defines: U+202A (LRE — Left-to-Right Embedding), U+202B (RLE — Right-to-Left Embedding), U+202C (PDF — Pop Directional Format), U+202D (LRO — Left-to-Right Override), U+202E (RLO — Right-to-Left Override) — these are LEGACY embedding/override controls. UAX #9 also defines: U+2066 (LRI — Left-to-Right Isolate), U+2067 (RLI — Right-to-Left Isolate), U+2068 (FSI — First Strong Isolate), U+2069 (PDI — Pop Directional Isolate) — these are MODERN isolation controls introduced in Unicode 6.3 (2013) as the recommended replacement for the legacy embeddings.

**The rule**: Code that handles directional text MUST NOT inject bare Unicode bidi control characters (U+202A..U+202E legacy embeddings/overrides; U+2066..U+2069 modern isolates) into strings — use HTML markup instead: `<bdi>` (semantic isolate) or `dir` attribute on any element (per I18N-RTL-03). NEVER strip these characters from user-input — some legitimate Unicode strings contain them for valid reasons (Hebrew/Arabic with embedded Latin text needing explicit override). Code patterns that programmatically wrap user-input in `‪...‬` or similar are an ANTI-PATTERN: (a) they double-up with HTML markup if the rendering surface also applies `<bdi>`; (b) they survive when the text is copy-pasted out of the UI into other contexts where the controls fire unintended reordering; (c) they fire the deprecated UAX #9 embedding behavior (not the modern isolation behavior the user expected). The U+202E "right-to-left override" specifically is a known PHISHING VECTOR: an attacker prepends U+202E to filenames or URLs to disguise the order ("exe.gpj.png" displayed reads as "exe.gnp.jpg" — the visual order reverses while the actual character order remains malicious-suffix-last); always sanitize untrusted user-input by REJECTING U+202E (and likely the broader U+202A..U+202E + U+2066..U+2069 set) when storing usernames / filenames / URLs / display names in security-sensitive contexts.

**Code patterns to flag**:
- String wrapping like `"‫" + text + "‬"` (manually injecting RLE+PDF — legacy embedding)
- `text.replace(/[‪-‮]/g, "")` or `text.replace(/[⁦-⁩]/g, "")` blanket-stripping (corrupts legitimate bidi input)
- User-display surface that renders untrusted strings without filtering U+202E + Right-to-Left-Override (phishing vector for filename / URL display)
- Logging / audit-trail code that captures text containing bidi controls without escaping (the controls fire when logs are viewed)
- API request/response handlers that don't normalize bidi controls (XSS-adjacent: bidi controls in JSON payloads can disguise content)

**Correct pattern**:
```jsx
// For isolation: use HTML markup, not control chars
<p>Read more about <bdi>{userBrand}</bdi> on our blog.</p>

// For security-sensitive display surfaces, FILTER U+202E specifically (preserve legitimate bidi)
function safeDisplay(text: string): string {
  // U+202E (RLO) is the canonical phishing vector for filenames / URLs
  // Reject it OR replace with visible marker
  if (text.includes("‮")) {
    return text.replace(/‮/g, "\u{FFFD}"); // replacement char marker
  }
  return text;
}

// Logging: escape ALL bidi controls so they don't fire when logs are viewed
function escapeBidiForLog(text: string): string {
  return text.replace(/[‪-‮⁦-⁩]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
```

**Quick-fix hint**: Replace any string-level bidi-control injection with HTML markup (`<bdi>` per I18N-RTL-03). For security-sensitive surfaces displaying untrusted text (filenames, URLs, usernames, message previews), filter or escape U+202E specifically (canonical phishing vector). For logs / audit trails, escape ALL bidi controls so they don't fire when viewed in terminals or log viewers.

**See also**: **I18N-RTL-03** (this file, inline bidi isolation) — `<bdi>` / `dir="auto"` is the canonical HTML-markup replacement for legacy U+202A..U+202E embeddings and modern U+2066..U+2069 isolation controls. The two rules compose: RTL-03 covers the legitimate-use-case markup; RTL-05 covers the bare-control-character anti-pattern + security-sensitive filter for U+202E phishing.

---

### I18N-RTL-06: Form-control alignment respects `dir` attribute — native controls auto-handle; custom controls need explicit logical alignment

**Severity**: MAJOR
**Authority**: HTML Living Standard (form-control directionality); CSS Logical Properties (for custom controls)
**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input — verbatim MDN documentation on `dirname` attribute: "Valid for `hidden`, `text`, `search`, `url`, `tel`, and `email` input types, the `dirname` attribute enables the submission of the directionality of the element. When included, the form control will submit with two name/value pairs: the first being the `name` and `value`, and the second being the value of the `dirname` attribute as the name, with a value of `ltr` or `rtl` as set by the browser."

**The rule**: Form controls (`<input>`, `<textarea>`, `<select>`) MUST respect the document's `dir` attribute for: (a) text alignment within the control (RTL text aligns right; caret + cursor blink at the right side; placeholder text aligns right); (b) cursor blink position (right side for empty RTL fields); (c) submit-time directionality reporting via the `dirname` attribute (lets the server know the user's input direction). Native HTML form controls handle (a) and (b) AUTOMATICALLY when an ancestor (typically `<html>` per RTL-01) has `dir="rtl"`. Custom-styled form controls (replacing `<select>` with a div-based dropdown; replacing `<input>` with a contenteditable; using a custom date-picker / number-stepper / autocomplete) MUST EXPLICITLY apply logical-property alignment (`text-align: start` per I18N-RTL-02), use the `dir` attribute correctly on the control container, and propagate the user's typing direction. For server-side direction tracking, use `dirname="<field>-dir"` on text-input fields to capture the user's typing direction at form-submit time — useful for storing user comments where the user may type in RTL even when the UI is LTR.

**Code patterns to flag**:
- Custom dropdown (`<div className="dropdown">`) styled with `text-align: left` regardless of direction
- Custom autocomplete / typeahead with hardcoded `padding-left: 8px` for the search icon (should be `padding-inline-start` per RTL-02)
- Date-picker UI rendering a calendar grid with hardcoded `direction: ltr` (should respect document dir; some pickers do flip)
- Number-stepper buttons (▲ ▼ ±) at hardcoded `right: 0` (should be `inset-inline-end: 0`)
- `<input>` field with `text-align: left` baked into stylesheet (should be `text-align: start`)
- Comment / message form storing user-input without `dirname` directionality (server has no way to know user typed in RTL)

**Correct pattern**:
```jsx
// Native form controls — auto-handle direction via document dir
<input type="text" name="comment" dirname="comment-dir" />
// Form submits: comment=hello&comment-dir=ltr OR comment=שלום&comment-dir=rtl

// Custom-styled dropdown using logical properties + dir-aware
<div className="dropdown" role="combobox" aria-expanded={open}>
  <input
    className="dropdown-input"  // styled with text-align: start, padding-inline-start
    type="text"
  />
  <span className="dropdown-arrow" />  {/* styled with inset-inline-end: 8px */}
</div>
```
```css
.dropdown-input {
  text-align: start;             /* auto-mirrors per dir */
  padding-inline-start: 12px;    /* per I18N-RTL-02 */
  padding-inline-end: 32px;       /* leaves room for arrow */
}
.dropdown-arrow {
  position: absolute;
  inset-inline-end: 8px;          /* auto-mirrors */
  inset-block-start: 50%;
}
```

**Quick-fix hint**: Audit every custom-styled form control for hardcoded `left` / `right` / `text-align: left` / `padding-left` — replace with logical-property equivalents per RTL-02. For text-input fields collecting user-generated content (comments, posts, messages), add `dirname="<field>-dir"` so the server captures the input direction. Native form controls usually need no changes beyond ensuring an ancestor has `dir="rtl"` per RTL-01.

**See also**: **I18N-RTL-01** (this file, `<html dir="rtl">`) — native form controls inherit direction from ancestor dir attribute; without RTL-01's root-dir, controls fall back to LTR. **I18N-RTL-02** (this file, CSS logical properties) — custom-styled form controls need logical properties to auto-mirror; physical-property styling locks the alignment regardless of document direction. **A11Y-009** (`accessibility/forms.md`, "Every form control must have a programmatic label") — composes with RTL-06: form-control accessible name + logical-property alignment together produce a usable RTL form.

---

### I18N-RTL-07: Dir-attribute propagation crosses SPAs / iframes / shadow-DOM boundaries on locale change

**Severity**: MAJOR (escalate to CRITICAL when project declares RTL-language target)
**Authority**: HTML Living Standard (dir attribute inheritance); React / Vue context-provider conventions; Web Components shadow-DOM inheritance semantics
**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir + HTML Living Standard §3.2.6.1 (the `dir` attribute) — dir attribute inherits down the DOM tree per RTL-01, BUT does NOT automatically propagate across: (a) iframe boundaries (each iframe is a separate document with its own `<html dir>`); (b) shadow-DOM hosts in some inheritance modes (closed-mode shadow trees don't inherit by default); (c) framework-managed virtual DOM contexts where the framework keeps its own direction-state (React Context, Vue provide/inject, Angular DI).

**The rule**: On locale change, the root `<html dir>` update (per I18N-RTL-01) MUST be propagated to all framework-managed DOM trees + iframe-embedded content + shadow-DOM-encapsulated components. SPAs typically need: (a) React Context / Vue `provide` / Svelte stores that broadcast `direction` so deeply-nested components can opt into direction-aware rendering without prop-drilling; (b) iframe-content origin coordination — postMessage the new direction to embedded iframes (analytics widgets, video players, embedded forms) so they update their internal dir; (c) shadow-DOM host re-styling — when a custom element's content lives in shadow-DOM, the host element's `:host([dir="rtl"])` selector (or equivalent) must respond to direction changes. Critical failure mode: locale changes update root `<html dir>` but framework state (or iframe content, or shadow-DOM component) stays at the previous direction — UI ships mixed-direction artifacts (some sections RTL, others LTR) for the duration of the session.

**Code patterns to flag**:
- Locale-switcher updates `document.documentElement.dir` but doesn't fire a framework-level context update (React components downstream of a `LocaleContext` don't re-render)
- React/Vue components reading `document.documentElement.dir` at render-time without subscribing to changes (works for initial render; breaks on dynamic locale change)
- Embedded iframes (Stripe Elements, YouTube/Vimeo players, Google Maps, analytics widgets) without `dir` query-string or postMessage coordination after parent locale change
- Custom elements / Web Components using shadow-DOM without `:host([dir="rtl"])` styling hook OR without manual direction propagation to shadow tree
- Server-rendered initial direction OK but client-side locale-change post-hydration doesn't flow through any framework state

**Correct pattern**:
```typescript
// React: DirectionProvider context + use effect to bind to document.documentElement.dir
import { createContext, useContext, useEffect, useState } from "react";
const DirectionContext = createContext<"ltr" | "rtl">("ltr");
export function DirectionProvider({ children }) {
  const [dir, setDir] = useState<"ltr" | "rtl">(
    (document.documentElement.dir as "ltr" | "rtl") || "ltr"
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDir((document.documentElement.dir as "ltr" | "rtl") || "ltr");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"] });
    return () => observer.disconnect();
  }, []);
  return <DirectionContext.Provider value={dir}>{children}</DirectionContext.Provider>;
}
export const useDirection = () => useContext(DirectionContext);

// iframe coordination: postMessage on locale change
function setLocale(newLocale: string) {
  document.documentElement.lang = newLocale;
  document.documentElement.dir = getDir(newLocale);
  // Notify embedded iframes
  document.querySelectorAll("iframe[data-locale-aware]").forEach((iframe) => {
    (iframe as HTMLIFrameElement).contentWindow?.postMessage(
      { type: "locale-change", locale: newLocale, dir: getDir(newLocale) },
      "*"
    );
  });
}

// Shadow-DOM component: :host([dir="rtl"]) selector + manual sync on parent dir change
class MyWidget extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host([dir="rtl"]) .item { text-align: end; }
    </style>...`;
    // Inherit dir from ancestor
    const observer = new MutationObserver(() => this.syncDir());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"] });
    this.syncDir();
  }
  syncDir() {
    this.setAttribute("dir", document.documentElement.dir || "ltr");
  }
}
```

**Quick-fix hint**: Provide a DirectionProvider context at the app root that broadcasts the current `document.documentElement.dir` via MutationObserver. Coordinate with embedded iframes via postMessage on locale change. For custom elements / Web Components in shadow-DOM, add `:host([dir="rtl"])` styling hooks AND manual `dir` propagation from document root via MutationObserver.

**See also**: **I18N-RTL-01** (this file, `<html dir="rtl">`) — RTL-01 establishes the document-root direction; RTL-07 ensures that root direction propagates correctly across all DOM-boundary surfaces. **I18N-STR-03** (`i18n/strings.md`, runtime `<html lang>` correctness) — `lang` propagation has the same SPAs/iframes/shadow-DOM concerns; SPAs that get RTL-07's dir propagation right typically need the same MutationObserver pattern for lang.

---

### I18N-RTL-08: Prefer HTML `dir` attribute over CSS `direction` property for typical RTL toggling

**Severity**: MAJOR
**Authority**: W3C CSS Logical Properties + W3C i18n WG guidance (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/direction — verbatim MDN normative warning: "Where possible, authors are encouraged to avoid using the `direction` CSS property and use the HTML `dir` global attribute instead." Verbatim doc-level recommendation: "Note that text direction is usually defined within a document (e.g., with HTML's `dir` attribute) rather than through direct use of the `direction` property."

**The rule**: The CSS `direction` property MUST NOT be used as a substitute for the HTML `dir` attribute for typical RTL toggling. CSS `direction` is appropriate ONLY for: (a) vertical-writing-mode languages (Japanese, Mongolian) where direction is a presentation concern separate from base text direction; (b) block-level element overrides where the embedded content's direction is genuinely a presentation decision (very rare); (c) `direction: rtl` paired with `unicode-bidi: embed` / `override` for legitimate inline-level direction control (edge case). The HTML `dir` attribute is preferred because (1) it is semantic (direction is content metadata, not presentation styling); (2) it propagates through DOM inheritance correctly; (3) it triggers the auto-mirroring logical CSS properties (per RTL-02); (4) it composes with `:dir(rtl)` selector + shadow-DOM `:host([dir="rtl"])` inheritance (per RTL-07); (5) it survives CSS stripping (e.g., reader mode, RSS readers, accessibility tools that disable styling) so the direction signal persists in plain semantic HTML.

**Code patterns to flag**:
- Global stylesheet rule `body { direction: rtl; }` or `html { direction: rtl; }` for RTL locales (should be `<html dir="rtl">`)
- Per-component CSS `.container.rtl { direction: rtl; }` toggled via JS class (should be `dir` attribute toggled instead)
- Theme system that swaps stylesheets to toggle direction (should toggle dir attribute alone — same CSS works for both directions when using logical properties per RTL-02)
- `direction: rtl !important` overrides (typically a hack to "force RTL" because the dir attribute mechanism wasn't set up)
- Mixed CSS-direction-based + HTML-dir-attribute-based RTL handling in the same codebase (creates conflicts; pick one — HTML dir)

**Correct pattern**:
```html
<!-- HTML dir attribute on root (per RTL-01) -->
<html lang="ar" dir="rtl">
  <body>
    <!-- All descendants inherit direction; no CSS direction property needed -->
  </body>
</html>
```
```css
/* CSS uses :dir() selector for direction-aware styling (composed on top of logical-properties baseline per RTL-02) */
.callout {
  border-inline-start: 3px solid var(--accent);  /* auto-mirrors per dir attribute */
}

/* :dir(rtl) selector for direction-specific overrides */
:dir(rtl) .icon-arrow {
  transform: scaleX(-1);  /* per RTL-04 icon mirroring */
}

/* CSS direction property is reserved for legitimate edge cases — typically NOT for RTL toggling */
.vertical-writing-text {
  writing-mode: vertical-rl;  /* CSS writing-mode for vertical text — different concern */
  /* direction: ltr; — only if you genuinely need to override base direction within vertical mode */
}
```

**Quick-fix hint**: Audit stylesheets for `direction: rtl` / `direction: ltr` declarations. Replace with HTML `dir` attribute at the appropriate element level (typically root `<html>` per RTL-01; per-section dir attribute for mixed-direction layouts per RTL-10). Use `:dir(rtl)` CSS selector for direction-specific styling on top of the dir attribute baseline.

**See also**: **I18N-RTL-01** (this file, `<html dir="rtl">`) — RTL-08 is the corollary of RTL-01: prefer the HTML attribute mechanism over the CSS property mechanism. **I18N-RTL-02** (this file, CSS logical properties) — RTL-02 + RTL-08 compose: HTML dir attribute as the direction signal + CSS logical properties as the auto-mirroring styling layer. **I18N-RTL-07** (this file, dir propagation) — HTML `dir` attribute propagates through DOM inheritance + can be observed via MutationObserver; CSS `direction` property doesn't compose with these propagation patterns naturally.

---

### I18N-RTL-09: RTL-aware animations + transforms — slide-in originates from logical-inline-start (`translateX` mirrors under RTL)

**Severity**: MAJOR (escalate to CRITICAL when animations are load-bearing for UX flow)
**Authority**: CSS Transforms specification (W3C) + CSS Logical Properties; MDN canonical references
**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/transform — `translateX(-100px)` is PHYSICAL (always moves 100px to the left regardless of direction); RTL-aware animations require either (a) `:dir(rtl)` selector overriding the translateX sign, OR (b) CSS custom properties with directional values, OR (c) the modern `translate` property + logical-equivalent patterns. Cite-by-authority for the broader transform-and-direction interaction (MDN CSS-transitions page returned thin at fetch time per dev.91+ Discipline 1 structural-gating scope; paraphrase exempt).

**The rule**: CSS animations and transitions that translate elements horizontally (slide-in panels, drawer openings, carousel transitions, toast notifications sliding in from a side, modal dialogs that animate from off-screen) MUST mirror their motion direction under RTL — a panel that slides in "from the left" in LTR should slide in "from the right" in RTL. Hardcoded `translateX(-100%)` for an off-screen-start position always anchors to the physical left side regardless of direction, producing the wrong perceived "from-edge" under RTL. The fix is direction-aware translation: either `:dir(rtl) .slide { transform: translateX(100%); }` flipping the sign explicitly, OR a CSS custom property `--inline-start-offset: -100%; :dir(rtl) { --inline-start-offset: 100%; }` consumed in the keyframe, OR the modern `translate` property which doesn't natively logical-mirror but can be paired with `:dir()`. Same logic applies to `scrollLeft` / `scrollTo({ left: X })` API calls — the API takes physical pixels; `scrollLeft: 0` means "scroll to left edge" which is "scroll to start" in LTR but "scroll to end" in RTL.

**Code patterns to flag**:
- `@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }` (always physically left-side; wrong under RTL)
- `element.style.transform = "translateX(-200px)"` programmatic transforms with physical direction (should mirror under RTL)
- `scrollLeft: 0` / `scrollTo({ left: 0 })` to scroll to "start" (in RTL, `scrollLeft: 0` is at the RIGHT visual edge for horizontal-scroll containers — `inline-start` in logical terms is `right` in RTL)
- React-spring / Framer Motion / GSAP animations with hardcoded `x: -100` / `x: 100` values
- Carousel transitions assuming "next slide enters from the right" (in RTL, "next" should enter from the LEFT visually because the reading order is right-to-left)
- Drawer/sidebar that hardcodes `left: 0` / `transform: translateX(-100%)` for off-screen position

**Correct pattern**:
```css
/* CSS custom-property approach */
.slide-in {
  --slide-from: -100%;
  transform: translateX(var(--slide-from));
  transition: transform 250ms ease;
}
.slide-in.open {
  transform: translateX(0);
}
:dir(rtl) .slide-in {
  --slide-from: 100%;  /* slide from right side under RTL */
}

/* :dir() selector approach (verbose but explicit) */
@keyframes slideInFromStart {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}
:dir(rtl) {
  /* override the keyframe behavior under RTL */
  @keyframes slideInFromStart {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }
}

/* Programmatic transforms with direction-awareness */
function slideTo(element: HTMLElement, position: "start" | "end") {
  const rtl = getComputedStyle(element).direction === "rtl";
  const sign = position === "start" ? (rtl ? 1 : -1) : (rtl ? -1 : 1);
  element.style.transform = `translateX(${sign * 100}%)`;
}

/* scrollLeft direction-awareness */
function scrollToInlineStart(container: HTMLElement) {
  const rtl = getComputedStyle(container).direction === "rtl";
  container.scrollLeft = rtl ? container.scrollWidth - container.clientWidth : 0;
}
```

**Quick-fix hint**: Audit all `translateX` / `scrollLeft` / horizontal-motion animations for direction-awareness. Use CSS custom properties to parameterize the direction-dependent offset, then override under `:dir(rtl)`. For programmatic JavaScript transforms, check `getComputedStyle(element).direction` and flip the sign accordingly. Carousels and drawers especially need RTL-aware animation as their "next-slide-enters-from-X" semantics are reading-order-dependent.

**See also**: **I18N-RTL-02** (this file, CSS logical properties) — RTL-02 covers static layout properties; RTL-09 covers dynamic motion/transition properties which logical-properties don't yet natively cover for `transform`. The two rules compose: layout via logical properties (auto-mirror) + animation via direction-aware transforms (manual mirror). **I18N-RTL-04** (this file, mirrored icons) — directional ICONS mirror via `transform: scaleX(-1)`; directional ANIMATIONS mirror via direction-aware `translateX` sign-flipping. Both use the `:dir(rtl)` selector pattern.

---

### I18N-RTL-10: Mixed-direction layouts — global nav LTR + RTL content (or vice versa) via per-region `dir` attribute + bidi isolation

**Severity**: MINOR (escalate to MAJOR when the mixed-direction surface is a primary UX flow rather than a metadata footer)
**Authority**: W3C i18n WG guidance on mixed-direction content
**Source**: https://www.w3.org/International/articles/inline-bidi-markup/ + https://www.w3.org/International/articles/inline-bidi-markup/uba-basics — W3C i18n WG guidance: "In HTML the base direction is either set explicitly by the nearest parent element that uses the `dir` attribute, or, in the absence of any such attribute, is inherited from the default direction of the document, which is left-to-right." W3C uba-basics mixed-direction handling (paraphrased — see source for canonical wording): additional markup, metadata, or special approaches are needed to establish the correct base direction for a range of text, and in certain instances it is necessary to isolate adjacent ranges of text in order to produce the desired ordering.

**The rule**: When a page mixes opposite-direction regions (common cases: an admin dashboard's nav/sidebar is LTR English while content body is RTL Arabic; a documentation site's chrome stays LTR while embedded code samples + technical-prose body switches per locale; a multi-tenant SaaS app's owner-chrome is the operator's language while customer-content is per-tenant locale), per-region `dir` attribute MUST be set on the section root — NOT relying solely on the document root direction. Each mixed-direction region acts as a bidi-isolation boundary: setting `dir="ltr"` on a `<nav>` inside a `dir="rtl"` document keeps the nav rendering left-to-right with text aligned left, while the surrounding body inherits the document root's RTL direction. This composes with `<bdi>` for inline bidi isolation (per RTL-03): root document direction + per-region dir overrides + inline bidi isolation together cover the full mixed-direction surface.

**Code patterns to flag**:
- Admin dashboard with English nav + Arabic content body where the nav inherits `dir="rtl"` and renders right-aligned (looks wrong; should explicitly carry `dir="ltr"` on the nav)
- Documentation site with code samples that inherit RTL when document is RTL (code samples must stay LTR — code is a different "language" with explicit LTR semantics)
- Embedded iframe content (Stripe Elements, YouTube embeds) that should have a fixed direction regardless of host page direction (handle via per-iframe dir, NOT by trying to mirror everything via document root)
- Multi-tenant app where the host operator's chrome should stay one direction while tenant content varies (must use per-tenant-region dir attribute)
- CSS `direction: ltr` on a section inside an RTL document (works but is the wrong mechanism per RTL-08; should be HTML dir attribute)

**Correct pattern**:
```html
<!-- Document root: RTL for Arabic locale -->
<html lang="ar" dir="rtl">
<body>
  <!-- Global nav: explicitly LTR (operator's UI is LTR English) -->
  <nav dir="ltr" aria-label="Admin">
    <a href="/dashboard">Dashboard</a>
    <a href="/settings">Settings</a>
  </nav>

  <!-- Main content: inherits document-root RTL -->
  <main>
    <h1>مرحبا بك في لوحة التحكم</h1>
    <p>هذا هو المحتوى الرئيسي.</p>

    <!-- Code samples explicitly LTR (code is a different "language") -->
    <pre dir="ltr"><code class="language-typescript">
const greet = (name) =&gt; `Hello, ${name}!`;
    </code></pre>

    <!-- User-generated content with unknown direction: bidi isolation per RTL-03 -->
    <blockquote><bdi>{user.comment}</bdi></blockquote>
  </main>

  <!-- Footer: operator metadata in LTR English -->
  <footer dir="ltr">© 2026 Acme Corp</footer>
</body>
</html>
```

**Quick-fix hint**: For mixed-direction layouts, identify which sections carry which directionality + set explicit `dir` on each section root. Code samples, brand names, version numbers, and operator-chrome (admin tools, billing UI) typically stay in operator-language direction even when content body switches. The principle: dir attribute is per-content-region, not document-wide.

**See also**: **I18N-RTL-01** (this file, `<html dir="rtl">`) — RTL-01 establishes the document-root direction; RTL-10 extends to per-region overrides for mixed-direction layouts. **I18N-RTL-03** (this file, inline bidi isolation) — RTL-10 covers BLOCK-level mixed direction (sections); RTL-03 covers INLINE-level mixed direction (embedded fragments). Together they cover the full mixed-direction surface: section-level dir + inline `<bdi>` isolation.
