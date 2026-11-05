# Accessibility — Document structure & language

Part of [.aivv/standards/accessibility/](README.md) (A11Y-001..003, A11Y-072).

### A11Y-001: `<html>` element must have a `lang` attribute

**Severity**: MAJOR
**WCAG**: 3.1.1 Level A
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html

**The rule**: Every document must declare its primary language on the root `<html>` element so assistive tech pronounces content correctly.

**Code patterns to flag**:
- `<html>` with no `lang` attribute
- `<html lang="">` (empty value)
- Unknown / invalid language subtag

**Correct pattern**:
```html
<html lang="en">
<html lang="en-US">
<html lang="pt-BR">
```

**Quick-fix hint**: Add `lang="<bcp47-code>"` to the root `<html>` element matching the document's primary language.

**See also**: **I18N-STR-01** (`i18n/strings.md`, "All user-facing strings must use a translation function") — A11Y-001 ensures the `lang` attribute is PRESENT (WCAG baseline); I18N-STR-01 ensures the rendered strings are actually translatable (i.e., that the `lang` value will correspond to genuinely-rendered content rather than always-English hardcoded literals). The two rules compose: lang-attribute presence + translation-function discipline together support multilingual rendering. **I18N-STR-03** (same file, "Runtime `<html lang>` value matches the active user-language locale") — A11Y-001 ensures the attribute is present; I18N-STR-03 extends to runtime CORRECTNESS (the attribute's VALUE must match the actually-rendered language, especially on locale change in SPAs). **RTV-AXE-10** (`runtime-visual.md`, axe-core `html-has-lang` runtime verification) — A11Y-001 catches missing-`lang` in source; RTV-AXE-10 catches SPA locale-switching defects where `<html lang>` is stale after JavaScript locale change (the runtime path complements the static check).

---

### A11Y-002: Document must have a non-empty, descriptive `<title>`

**Severity**: MAJOR
**WCAG**: 2.4.2 Level A
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/page-titled.html

**The rule**: Every page must contain a `<title>` element in `<head>` that describes the page's topic or purpose.

**Code patterns to flag**:
- Missing `<title>` in `<head>`
- `<title></title>` (empty)
- Generic / templated title like `<title>Untitled</title>` or `<title>Document</title>`
- Same title reused across distinct routes in a SPA (e.g., no `document.title` update on route change)

**Correct pattern**:
```html
<head>
  <title>Checkout — Acme Store</title>
</head>
```

**Quick-fix hint**: Set a route-specific, descriptive title; in SPAs update `document.title` on navigation or use the framework's head manager.

---

### A11Y-003: Language change within content needs `lang` attribute

**Severity**: MINOR
**WCAG**: 3.1.2 Level AA
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/language-of-parts.html

**The rule**: Content whose language differs from the page's declared `lang` must be wrapped in an element carrying its own `lang` attribute.

**Code patterns to flag**:
- Inline foreign phrases without wrapping element + `lang`
- Mixed-language quotations inside a page declared in a single language

**Correct pattern**:
```html
<p>The motto was <span lang="fr">liberté, égalité, fraternité</span>.</p>
```

**Quick-fix hint**: Wrap the foreign fragment in a `<span>` (or block element) with the appropriate `lang` value.

**See also**: **VVT-072** (`visual-verification-triggers/css-styling.md`, "CSS `text-spacing-trim` property") — runtime-verification trigger when code applies language-scoped typography via `:lang(ja)` / `:lang(zh)` / `:lang(ko)` selectors. The CSS `:lang()` pseudo-class matches only when the corresponding HTML `lang` markup is present per this rule's WCAG 3.1.2 policy; pair when typography rules are language-scoped to verify the supporting HTML `lang` attributes are present at the fragment level (otherwise the scoped styling silently fails to apply).

---

### A11Y-072: Prefer BCP 47 region-qualified `lang` values for screen-reader pronunciation

**Severity**: MINOR
**WCAG**: WCAG 3.1.1 (covered by A11Y-001) requires `lang`; BCP 47 region-qualification is best-practice for screen-reader pronunciation quality, not a specific SC mandate.
**Source**: https://www.rfc-editor.org/info/bcp47, https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html

**The rule**: When the content's locale is known, prefer the region-qualified form (`lang="en-US"`, `lang="pt-BR"`, `lang="zh-Hans-CN"`) over the language-only form (`lang="en"`, `lang="pt"`, `lang="zh"`). Some screen readers pronounce vocabulary differently across regions (American vs British English; Brazilian vs European Portuguese); the region subtag helps voice synthesis pick the right phoneme set.

**Code patterns to flag**:
- `<html lang="en">` on a US-locale site where `lang="en-US"` is more accurate
- `<html lang="pt">` on a Brazilian-Portuguese site where `lang="pt-BR"` is more accurate
- `<html lang="zh">` ambiguous between Simplified/Traditional and Mainland/Taiwan — should be `lang="zh-Hans-CN"` / `zh-Hant-TW`
- i18n libraries that emit only the 2-letter language tag without the region subtag

**Correct pattern**:
```html
<!-- US-locale English site -->
<html lang="en-US">

<!-- Brazilian Portuguese -->
<html lang="pt-BR">

<!-- Simplified Chinese, Mainland -->
<html lang="zh-Hans-CN">
```

**Quick-fix hint**: Use BCP 47 region-qualified codes when the locale is known; language-only is acceptable when content genuinely spans regions (e.g., a generic English documentation site).

**See also**: **I18N-STR-03** (`i18n/strings.md`, "Runtime `<html lang>` value matches the active user-language locale") — A11Y-072 governs the FORMAT of the lang value (region-qualified per BCP 47); I18N-STR-03 governs the VALUE itself matches the rendered locale at runtime. The two rules compose: a multilingual SPA passing A11Y-072's format check (always uses region-qualified codes) may still fail I18N-STR-03's runtime correctness check (always emits `en-US` regardless of rendered content). **I18N-FMT-08** (`i18n/formatters.md`, "Locale tag handling uses `Intl.Locale` for canonical BCP 47 manipulation") — A11Y-072 governs the FORMAT preference (region-qualified per BCP 47); I18N-FMT-08 provides the canonical PARSER / NORMALIZER for that format via `Intl.Locale` (`.language`/`.region`/`.script` accessors + `.maximize()` / `.minimize()` for canonicalization).
