# Internationalization (i18n) — standards catalog index

Part of [.aivv/standards/](../README.md). The i18n catalog covers locale-aware code patterns grouped by topical sub-domain. Each subfile carries one `I18N-*` sub-prefix.

## Subdomains

| Subfile | Prefix | Focus |
|---|---|---|
| [`strings.md`](strings.md) | `I18N-STR-*` | Hardcoded English strings, translation-function discipline, pluralization, gender/grammatical agreement, message-key conventions |
| [`formatters.md`](formatters.md) | `I18N-FMT-*` | Date/time/number/currency/relative-time formatters — locale-naïve `toLocaleString()` calls, hardcoded `MM/DD/YYYY`, `$`-prefix currency, locale-naïve Intl API construction |
| [`rtl-bidi.md`](rtl-bidi.md) | `I18N-RTL-*` | RTL safety, bidi text handling, directional CSS (margin-inline vs margin-left), `dir="rtl"` propagation, mixed-direction text rendering, BiDi-isolating Unicode controls |

## Severity discipline

- **`I18N-STR-*`** rules default to **MAJOR** severity. Rationale: hardcoded strings + locale-broken pluralization are user-facing translation defects that break the product entirely for non-English users.
- **`I18N-FMT-*`** rules default to **MAJOR** severity. Rationale: locale-naïve formatters produce incorrect date/currency/number rendering for non-US-English locales — substantively wrong for affected users.
- **`I18N-RTL-*`** rules default to **MINOR** severity (escalate to MAJOR when project declares RTL-language target). Rationale: RTL safety is critical for Arabic/Hebrew/Farsi/Urdu users but not user-visible at all for LTR-only deployments. Project context determines severity weight.

## Lens routing

Findings in this catalog route to the `i18n` lens. The `--full-ui-ux`, `--full`, and `--full-with-journey` flags include it.

## Source authority

Every i18n rule cites a canonical normative source. Primary sources:

- **CLDR** (Unicode Common Locale Data Repository) — `https://cldr.unicode.org/` — canonical for locale data, plural rules, formatter symbols.
- **ICU MessageFormat** — `https://unicode-org.github.io/icu/userguide/format_parse/messages/` — canonical for message-formatting syntax (pluralization, gender, ordinal, choice formatting).
- **WCAG 3.1.1 / 3.1.2 Language of Page / Language of Parts** — `https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html` + `language-of-parts.html` — canonical for HTML `lang` attribute discipline.
- **MDN Intl API** — `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl` — canonical for JavaScript `Intl.NumberFormat` / `Intl.DateTimeFormat` / `Intl.PluralRules` / `Intl.RelativeTimeFormat` / `Intl.ListFormat` / `Intl.DisplayNames` / `Intl.Locale`.
- **Mozilla i18n best practices** — `https://developer.mozilla.org/en-US/docs/Mozilla/Localization` — Mozilla-curated i18n guidance.
- **Google i18n design** — `https://www.unicode.org/cldr/charts/` (Unicode CLDR charts) — canonical for per-language plural/formatter classifications.
- **Apple HIG Localization** — `https://developer.apple.com/design/human-interface-guidelines/inclusion#Localization` — Apple-curated localization guidance for iOS/macOS contexts.

## Scope-relationship to `accessibility/`

The A11Y catalog already covers:
- A11Y-001 `<html>` element must have a `lang` attribute (WCAG 3.1.1 baseline)
- A11Y-002 Document must have a non-empty, descriptive `<title>`
- A11Y-003 Language change within content needs `lang` attribute (WCAG 3.1.2 baseline)
- A11Y-072 Prefer BCP 47 region-qualified `lang` values for screen-reader pronunciation

I18N catalog extends these baselines with locale-aware code-pattern discipline (translation-function presence, CLDR-pluralization usage, formatter locale-awareness, RTL-safe CSS). The two catalogs cross-reference each other.
