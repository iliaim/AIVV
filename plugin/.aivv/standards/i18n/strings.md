# Internationalization — strings, translation, pluralization

Part of [.aivv/standards/i18n/](README.md) (I18N-STR-NN). This subfile covers locale-aware code patterns for user-facing strings: translation-function discipline, pluralization, gender/grammatical agreement, message-key conventions, and string-formatting safety.

### I18N-STR-01: All user-facing strings must use a translation function (no hardcoded language)

**Severity**: MAJOR
**Authority**: Mozilla Localization, Google i18n, Apple HIG Localization (industry consensus across all three major platform vendors)
**Source**: https://developer.mozilla.org/en-US/docs/Mozilla/Localization — Mozilla Localization guidance + https://developer.apple.com/design/human-interface-guidelines/inclusion#Localization

**The rule**: Every visible-to-user string — button labels, headings, body copy, placeholders, alt text, aria-label, error messages, toast notifications, tooltips, page titles — MUST pass through a translation function (`t("key")`, `gettext("key")`, `i18n.t("key")`, `<FormattedMessage id="key">`, `{$translate}`) rather than appearing as a hardcoded literal in source. Hardcoded strings prevent localization downstream and lock the product to one language. Exceptions: developer-only diagnostics (console errors, debug logs intended for engineers reading code), trademarked product names (never translate "Apple Inc.", "iPhone", brand-specific terminology), and inline `aria-hidden="true"` decorative content where the string carries no semantic value.

**Code patterns to flag**:
- React JSX with literal English string: `<button>Save</button>` (should be `<button>{t("save")}</button>`)
- Vue template with literal: `<button>{{ "Submit" }}</button>` (should be `<button>{{ $t("submit") }}</button>`)
- HTML hardcoded `alt`/`title`/`placeholder` attributes containing English prose: `<input placeholder="Enter your name">`
- Toast/alert function calls with literal: `toast.success("Account created!")`
- Hardcoded `aria-label` values: `<button aria-label="Close dialog">×</button>` (the label is user-facing for screen-readers)
- Error-message thrown to UI: `throw new Error("Email is required")` when the error reaches a user-visible toast (NOT when caught and translated downstream)

**Correct pattern**:
```jsx
// React with react-i18next
<button onClick={onSave}>{t("button.save")}</button>
<input placeholder={t("form.email.placeholder")} aria-label={t("form.email.label")} />
toast.success(t("notification.account_created"));

// Vue with vue-i18n
<button @click="onSave">{{ $t("button.save") }}</button>

// Server-side rendering (Next.js / Remix / Rails)
<button>{translate("save", locale)}</button>
```

**Quick-fix hint**: Extract every user-facing literal into a translation key + message-catalog entry. Use namespaced keys (`button.save`, `form.email.label`) for organization. Aggressive `eslint-plugin-i18n-text` / `eslint-plugin-react-intl` / language-specific lint rules catch most cases automatically; ensure the linter is configured for ALL user-visible string contexts (JSX text, attributes carrying user-visible values, function calls to toast/alert/notification APIs).

**See also**: **A11Y-001** (`accessibility/document-language.md`, "`<html>` element must have a `lang` attribute") — even when strings ARE translated, the document `lang` attribute must match the actual rendered language for assistive tech speech synthesis. I18N-STR-01 ensures strings are translatable; A11Y-001 ensures the chosen translation is correctly announced. **I18N-STR-02** (this file, pluralization) — translation alone isn't enough; pluralization rules vary across languages and must use CLDR-aware libraries.

---

### I18N-STR-02: Pluralization must use CLDR-aware library (NOT `if count === 1` or `count !== 1`)

**Severity**: MAJOR
**Authority**: Unicode CLDR Plural Rules; ICU MessageFormat
**Source**: https://cldr.unicode.org/index/cldr-spec/plural-rules — verbatim CLDR normative requirement: "other (required—general plural form—also used if the language only has a single form)". Verbatim language-variation framing: "Languages vary in how they handle plurals of nouns or unit expressions... Some languages have two forms, like English; some languages have only a single form; and some languages have multiple forms." MDN reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules — verbatim API definition: `Intl.PluralRules.prototype.select()` returns one of "zero", "one", "two", "few", "many", "other" per locale rules.

**The rule**: Pluralization MUST use a CLDR-aware library that selects among the six plural categories (`zero` / `one` / `two` / `few` / `many` / `other`) per the target locale's CLDR plural rules. Hardcoded English-only logic (`count === 1 ? "1 item" : count + " items"`) breaks for: Arabic (6 forms including dual `two` + special forms for 3-10 + 11-99), Russian/Polish/Ukrainian/Czech (3-4 forms including `few` for 2-4-but-not-12-14), Welsh (uses all 6 categories), Japanese/Chinese/Korean (single form only — but `count === 1 ? "1" : "N+"` already over-specifies). The CLDR `other` category is the mandatory fallback for languages with single plural forms; per CLDR normative spec, every plural-marked string must include an `other` form even for languages where it duplicates the singular.

**Code patterns to flag**:
- `${count} ${count === 1 ? "item" : "items"}` (English-only hardcoded conditional)
- `count !== 1 ? "items" : "item"` (same defect, inverted)
- Translation-function call with the LITERAL `count` interpolated into a non-pluralized key: `t("cart.items.count", { count })` where the translation file's value is `"You have {count} items"` (the "items" string itself isn't pluralized — translators have to write `"items"` not `"item"|"items"`)
- Manual switch statement on `count` without CLDR consultation: `switch(count) { case 0: ...; case 1: ...; default: ...; }`
- React `{count > 1 ? plural : singular}` pattern

**Correct pattern**:
```jsx
// Intl.PluralRules native API
const pluralRules = new Intl.PluralRules(locale);
const form = pluralRules.select(count); // "zero" | "one" | "two" | "few" | "many" | "other"
return messages[`cart.items.${form}`].replace("{count}", count);

// ICU MessageFormat via react-intl
<FormattedMessage
  id="cart.items"
  defaultMessage="{count, plural, =0 {No items} one {# item} few {# items} other {# items}}"
  values={{ count }}
/>

// i18next plural keys
// cart.items_zero: "No items"
// cart.items_one: "1 item"
// cart.items_few: "{{count}} items" (Polish/Russian)
// cart.items_many: "{{count}} items" (Polish/Russian)
// cart.items_other: "{{count}} items"
t("cart.items", { count });
```

**Quick-fix hint**: Replace English-only conditional pluralization with `Intl.PluralRules` (native browser API) or ICU MessageFormat (via react-intl / format-message / i18next-icu). For each pluralized string, the message catalog should carry per-locale plural-form variants (at minimum: `one` + `other`; richer locales also need `zero`/`two`/`few`/`many`). When in doubt, consult the Unicode CLDR Charts (`https://www.unicode.org/cldr/charts/`) for the target locale's plural rule classifications.

**See also**: **I18N-STR-01** (this file, translation-function discipline) — pluralization is one of the canonical patterns where translation alone is insufficient; CLDR-aware plural-form selection is required. **I18N-STR-03** (this file, lang attribute matching) — pluralization rules depend on the locale; the runtime `<html lang>` value should match the locale passed to `Intl.PluralRules` so screen-readers and the visible content agree.

---

### I18N-STR-03: Runtime `<html lang>` value matches the active user-language locale (composes with A11Y-001)

**Severity**: MAJOR
**Authority**: WCAG 3.1.1 Language of Page Level A; BCP 47 language tag standard (RFC 5646)
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html — verbatim normative SC text: "The default human language of each web page can be programmatically determined."

**The rule**: When a multilingual application renders translated content for the user's chosen locale, the `<html lang="...">` attribute MUST update to reflect that locale (e.g., `<html lang="ja">` when serving Japanese content, `<html lang="ar">` when serving Arabic content). Static `<html lang="en">` hardcoded in templates breaks the SC for non-English users and degrades assistive-technology speech synthesis (screen readers default to the wrong pronunciation rules), spell-checkers (apply wrong language rules), and automated translation services (mis-detect source language). For SPAs, the `lang` attribute must update on locale change without page reload — otherwise assistive-tech announcement of the now-translated content uses the prior locale's phonetics. A11Y-001 enforces the `lang` attribute's PRESENCE (WCAG baseline); I18N-STR-03 extends to runtime CORRECTNESS (the attribute's VALUE matches the rendered language).

**Code patterns to flag**:
- HTML template with static `<html lang="en">` regardless of user locale (server-side: should be `<html lang="{{ locale }}">`; SPA: should be set imperatively on locale change)
- Multilingual SPA where the locale-switcher changes UI text but does NOT update `document.documentElement.lang`
- Locale-detection code that picks the language for content rendering but doesn't update the `lang` attribute (drift between rendered content and declared language)
- Templating engine that interpolates the locale into translations but leaves `lang` hardcoded
- Next.js / Remix / Astro app with i18n routing (`/en/...`, `/ja/...`) but a shared `_document.tsx` with hardcoded `<Html lang="en">`

**Correct pattern**:
```jsx
// Server-side rendering (Next.js)
// pages/_document.tsx
import { Html } from "next/document";
export default function Document() {
  return <Html lang={getLocaleFromRequest()}>...</Html>;
}

// Client-side locale change (vanilla)
function setLocale(newLocale: string) {
  document.documentElement.lang = newLocale; // e.g., "ja", "ar", "fr-CA"
  i18n.changeLanguage(newLocale);
  // Optionally also set dir for RTL languages (composes with I18N-RTL-*)
  document.documentElement.dir = ["ar", "he", "fa", "ur"].includes(newLocale) ? "rtl" : "ltr";
}

// React with react-i18next + react-helmet
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
function App() {
  const { i18n } = useTranslation();
  return <Helmet htmlAttributes={{ lang: i18n.language, dir: getDir(i18n.language) }}>...</Helmet>;
}
```

**Quick-fix hint**: Bind `<html lang>` to the current locale via your i18n library's runtime locale. Use BCP 47 region-qualified tags when known (`en-US`, `pt-BR`, `zh-Hant`) per A11Y-072. For SPAs, hook the locale-change event to update `document.documentElement.lang` (and optionally `dir`) atomically with the i18n library's locale switch.

**See also**: **A11Y-001** (`accessibility/document-language.md`, "`<html>` element must have a `lang` attribute") — A11Y-001 is the WCAG 3.1.1 baseline (lang attribute must be PRESENT); I18N-STR-03 extends to runtime CORRECTNESS (the VALUE must match the rendered language). The two rules compose: a multilingual SPA passing A11Y-001 (lang attribute always present) may still fail I18N-STR-03 (lang attribute always says "en" regardless of rendered content). **A11Y-072** (same A11Y file, "Prefer BCP 47 region-qualified `lang` values") — informs the format of the value I18N-STR-03 enforces. **I18N-STR-02** (this file, CLDR-pluralization) — the locale passed to `Intl.PluralRules` should match `<html lang>` to keep pluralization in sync with the rendered language.

---

### I18N-STR-04: Gender / grammatical agreement uses ICU `select` (not English-only conditionals)

**Severity**: MAJOR
**Authority**: ICU MessageFormat (Unicode-org canonical specification)
**Source**: https://unicode-org.github.io/icu/userguide/format_parse/messages/ — verbatim ICU normative requirement on `select`: "Use a `\"select\"` argument to select sub-messages via a fixed set of keywords."

**The rule**: When a user-facing message varies by grammatical gender, social-honorific category, or any other fixed-set-of-keywords categorical variable, the i18n message MUST use ICU MessageFormat `{varname, select, ...}` (or framework equivalents — `<FormattedMessage>` `select` syntax in react-intl; i18next's pluralization-style key suffixing; Vue I18N's named placeholders) rather than English-only conditional logic. Hardcoded `${user.gender === "male" ? "he" : "she"}` patterns break for languages with: (a) gender-neutral pronouns (Finnish "hän"; spoken English "they"); (b) multiple grammatical genders (German der/die/das; many languages have masculine/feminine/neuter on nouns and adjectives); (c) honorific levels (Japanese plain vs polite vs honorific forms); (d) inclusive-language norms varying across locales (Spanish "amigos/amigas/amigues"). ICU `select` defers the categorical-mapping to per-locale translation files where translators can use their language's correct forms.

**Code patterns to flag**:
- `${user.gender === "male" ? "he" : "she"}` — English-only conditional on a categorical variable
- `friendCount === 1 ? "her" : "them"` — English pronoun selection (also intersects pluralization per I18N-STR-02)
- `gender === "M" ? "Mr." : "Ms."` — title selection hardcoded to English honorifics
- React: `<span>{gender === "f" ? "elle" : "il"}</span>` (any English-or-target-only hardcoded categorical)
- Hardcoded category-fork in any user-facing string surface where the variant is a categorical variable (not just gender — also "online/offline", "verified/unverified", "premium/free" when those drive grammatical agreement in translated copy)

**Correct pattern**:
```jsx
// react-intl with ICU select
<FormattedMessage
  id="post.shared_by_user"
  defaultMessage="{gender, select, male {He shared this post} female {She shared this post} other {They shared this post}}"
  values={{ gender: post.author.gender }}
/>

// Composing select with plural (ICU nesting: select outside, plural inside)
<FormattedMessage
  id="user.invited_friends"
  defaultMessage={`{gender, select,
    male {He invited {count, plural, one {# friend} other {# friends}}}
    female {She invited {count, plural, one {# friend} other {# friends}}}
    other {They invited {count, plural, one {# friend} other {# friends}}}
  }`}
  values={{ gender, count }}
/>

// i18next equivalent
// post.shared_by_user_male: "He shared this post"
// post.shared_by_user_female: "She shared this post"
// post.shared_by_user_other: "They shared this post"
t("post.shared_by_user", { context: gender });
```

**Quick-fix hint**: For any user-facing string that branches on a categorical variable, route the branching through ICU `select` (react-intl / FormatJS / format-message) OR i18next's `context` key-suffixing. The key insight: the categorical-to-text mapping is TRANSLATION DATA, not application logic — it lives in the message catalog where translators control it, not in the codebase where it's locked to one language's forms. Per the ICU spec, `select` keywords must include `other` as the mandatory fallback (matching the CLDR plural `other` requirement).

**See also**: **I18N-STR-02** (this file, CLDR pluralization) — `select` and `plural` are sibling ICU MessageFormat constructs; both defer per-locale variant selection to the message catalog. When a message branches on BOTH a categorical variable AND a count, ICU nests `select` outside and `plural` inside per the spec's nesting guidance. **I18N-STR-05** (this file, no-concatenation discipline) — `select` is the canonical pattern for composing a single message that varies categorically; the alternative (concatenating per-category fragments) violates I18N-STR-05.

---

### I18N-STR-05: Never concatenate translated fragments — use a single message with placeholders

**Severity**: MAJOR
**Authority**: ICU MessageFormat (Unicode-org canonical specification)
**Source**: https://unicode-org.github.io/icu/userguide/format_parse/messages/ — verbatim ICU normative requirement on message-composition: "If the user-visible string were concatenated directly from fragments and formatted elements, then translators would not be able to rearrange the pieces, and they would have a hard time translating each of the string fragments." Verbatim companion requirement: messages must be "written and translated as a single unit, typically a string with placeholder syntax for the variable elements".

**The rule**: User-facing strings MUST be composed as a single message with placeholders for variable elements — NEVER by concatenating multiple translated fragments. The reason is that word order varies across languages: English "You have 3 new messages from Bob" maps to Japanese "ボブさんから3件の新着メッセージがあります" (subject-object-verb with the postpositional `から` particle in a completely different position) and to German "Sie haben 3 neue Nachrichten von Bob" (verb-second word order). Concatenation locks the word-order to whichever language wrote the source code; translators cannot rearrange fragments because the application's string-assembly code wires them in a fixed order. Single-message-with-placeholders pattern lets translators write each language's natural form: `t("messages.new_from_user", { count, name })` resolves to per-locale message templates carrying that locale's natural word order with `{count}` + `{name}` placeholders positioned wherever the language requires.

**Code patterns to flag**:
- String concatenation of translated parts: `t("greeting") + " " + user.name + "!"` (the comma + exclamation + name-position are all locked to English convention)
- Template-literal concatenation: `` `${t("you_have")} ${count} ${t("new_messages")}` `` — same problem, three translated fragments locked in English order
- React JSX composition: `<Trans>You have</Trans> {count} <Trans>new messages</Trans>` — three translation units glued together with English-order assumption
- Conditional fragment-stitching: `t("greeting") + (isFriend ? t("buddy") : t("user")) + "!"`
- Helper function that returns a partial sentence to be concatenated downstream: `getGreeting() + " " + getNamePart() + "!"`

**Correct pattern**:
```jsx
// react-intl single-message with placeholders
<FormattedMessage
  id="dashboard.greeting"
  defaultMessage="Hello, {name}! You have {count, plural, one {# new message} other {# new messages}} from {sender}."
  values={{ name: user.name, count: newMessageCount, sender: latestSenderName }}
/>

// Vue I18N
$t("dashboard.greeting", { name: user.name, count: newMessageCount, sender: latestSenderName })

// i18next
t("dashboard.greeting", { name, count, sender })
// en: "Hello, {{name}}! You have {{count}} new messages from {{sender}}."
// ja: "{{name}}さん、こんにちは！ {{sender}}さんから{{count}}件の新着メッセージがあります。"
// de: "Hallo, {{name}}! Sie haben {{count}} neue Nachrichten von {{sender}}."
```

**Quick-fix hint**: For ANY user-visible string with variable parts, author it as a single message-catalog entry containing placeholders (`{name}`, `{count}`, `{date}`, `<link>...</link>` for JSX-embedded markup via react-intl's `<FormattedMessage>` rich-text syntax) — NEVER stitch translated fragments together with string concatenation. If the message contains formatted elements (numbers, dates, links, bold/italic emphasis), use the i18n library's rich-text formatting syntax to keep the entire message as one unit.

**See also**: **I18N-STR-04** (this file, ICU select for categorical agreement) — `select` is one canonical compose-into-single-message pattern; I18N-STR-05 generalizes to ALL variable elements (counts, names, dates, formatted numbers, embedded markup). **I18N-STR-02** (this file, CLDR pluralization) — pluralization patterns are a subset of single-message-with-placeholders; concatenating a singular and plural fragment violates I18N-STR-05 and breaks pluralization for non-English locales simultaneously.

---

### I18N-STR-06: Locale fallback chain follows CLDR parent-locale inheritance — never English-as-default for non-English locales

**Severity**: MAJOR
**Authority**: Unicode CLDR Locale Inheritance specification; ICU LocaleMatcher API
**Source**: https://cldr.unicode.org/ + https://unicode-org.github.io/icu/userguide/locale/ — CLDR's locale inheritance model (parent-locale chains terminating at `root`) is the canonical authority; ICU LocaleMatcher provides the canonical implementation. Direct WebFetch of the locale-inheritance subpage returned 404 at fetch time; citation by authority (CLDR + ICU spec) per dev.91+ Discipline 1 structural-gating scope (paraphrase form exempt).

**The rule**: When the user's requested locale has no translation file available, the fallback chain MUST follow CLDR's parent-locale inheritance (e.g., `en-CA` → `en` → `root`; `pt-BR` → `pt` → `root`; `zh-Hant-HK` → `zh-Hant` → `zh` → `root`) — NEVER blindly fall back to English (`en`) for non-English locale roots. English-as-default for missing translations actively misleads users: a user who chose Spanish (`es`) and is shown English fallback text wrongly assumes the application doesn't support Spanish at all OR that the specific feature is intentionally English-only. The CLDR-correct behavior: fall back to the parent locale (`es-MX` → `es`), then `root` (the locale-neutral catalog), then surface the missing-translation as a localization defect rather than silently degrading to a wrong language. Some frameworks (i18next, FormatJS) honor CLDR fallback chains automatically when configured; others require explicit chain configuration.

**Code patterns to flag**:
- i18next initialization with `fallbackLng: "en"` for a multilingual app serving non-English users (should be `fallbackLng: false` for explicit-missing-key signal OR per-locale chains via `fallbackLng: { "es-MX": ["es"], "pt-BR": ["pt"], default: ["root"] }`)
- react-intl `<IntlProvider locale={userLocale} defaultLocale="en">` where `defaultLocale="en"` is the implicit fallback for ALL non-English locales
- Server-side rendering that responds with English content when the requested locale's catalog is missing, with no error or warning logged
- Translation-loading code that catches "catalog not found" and silently returns English text without telemetry
- Locale-detection code that maps `accept-language: es-MX,es;q=0.9,en;q=0.5` to `en` (English) instead of `es-MX` or `es`

**Correct pattern**:
```typescript
// i18next with CLDR-aware fallback chains
import i18next from "i18next";
i18next.init({
  fallbackLng: {
    "es-MX": ["es", "root"],
    "es-AR": ["es", "root"],
    "pt-BR": ["pt", "root"],
    "zh-Hant-HK": ["zh-Hant", "zh", "root"],
    default: ["root"], // explicit root, NOT "en"
  },
  // Telemetry for missing keys (surface as localization defect, don't silently fall through)
  missingKeyHandler: (lngs, ns, key) => {
    telemetry.warn("i18n.missing_key", { lngs, ns, key });
  },
  // Strict fallback signaling: return key (e.g., "button.save") instead of returning English text
  // when no fallback locale has the key — makes the missing-translation defect user-visible
  returnEmptyString: false,
  returnNull: false,
});

// Explicit ICU LocaleMatcher resolution
import { Locale } from "@formatjs/intl-locale";
function resolveLocale(requestedLocale: string, supportedLocales: string[]) {
  const matcher = new Intl.LocaleMatcher(supportedLocales, { localeMatcher: "best fit" });
  return matcher.match([requestedLocale]); // CLDR-aware best-match
}
```

**Quick-fix hint**: Audit your i18n library's fallback configuration. For multilingual apps serving non-English primary users, configure CLDR-aware parent-locale chains per supported locale OR set `fallbackLng: false` (strict-missing-key signaling). Pair with a missing-key telemetry handler to surface localization defects rather than silently falling back to English. The implicit `defaultLocale="en"` pattern is acceptable ONLY for English-first apps that explicitly limit international scope.

**See also**: **I18N-STR-03** (this file, runtime lang-attribute correctness) — locale fallback affects what content gets rendered; the `<html lang>` attribute must reflect the ACTUALLY-rendered language, not the requested-but-fallen-back locale. If user requests `es-MX` and the app falls back to `es`, the `<html lang>` should say `es`, not `es-MX` (composes with I18N-STR-03's runtime-correctness rule). **I18N-STR-01** (this file, translation-function discipline) — translation-function discipline alone is insufficient; the fallback chain determines what users actually see when a key is missing from their locale.

---

### I18N-STR-07: Locale-aware sorting uses `Intl.Collator` (not `Array.sort()` default lexicographic order)

**Severity**: MAJOR
**Authority**: ECMAScript Intl.Collator API (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator — verbatim MDN example demonstrating locale-aware collation: "in German, ä has a as the base letter" — `new Intl.Collator("de", { sensitivity: "base" }).compare("ä", "a")` returns `0`. Default JavaScript `Array.sort()` lexicographic comparison ignores locale-specific collation rules.

**The rule**: Any user-visible sort (alphabetical names list, sorted dropdown options, country/language picker, search-result ranking by name, autocomplete suggestion ordering) MUST use `Intl.Collator` with the user's locale — NEVER the default `Array.sort()` lexicographic comparison. Default `Array.sort()` compares Unicode code points: `["ä", "z"].sort()` returns `["z", "ä"]` because `ä` (U+00E4) has a higher code point than `z` (U+007A). This is wrong for German (`ä` sorts with `a`, before `z`), Swedish (`ä` sorts AFTER `z`), and many other locales. Even for English-only audiences, the default lexicographic comparison breaks: case-sensitivity puts capitals before lowercase (`"Banana" < "apple"`); accented letters sort to the end (`"naïve" > "zebra"`); numerics use lexicographic order (`"item10" < "item2"`).

**Code patterns to flag**:
- `array.sort()` with no comparator on an array of user-visible strings (locale-naïve lexicographic order)
- `array.sort((a, b) => a.localeCompare(b))` without explicit locale (defaults to system locale; non-deterministic across users)
- `array.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))` (manual case-folding is wrong for Turkish dotted-I — `İ`/`I`/`ı`/`i` form two separate case pairs; use `Intl.Collator` with `sensitivity: "base"` or `"accent"` instead)
- React/Vue components rendering sorted lists where the sort runs at render-time without locale awareness
- Server-side sorting in a SQL query using `ORDER BY column` (database-default collation) returned to a client expecting locale-aware order

**Correct pattern**:
```typescript
// Default sort with explicit locale
const collator = new Intl.Collator(userLocale);
items.sort((a, b) => collator.compare(a.name, b.name));

// Numeric-aware (treats "item10" > "item2")
const collator = new Intl.Collator(userLocale, { numeric: true });
files.sort((a, b) => collator.compare(a.name, b.name));

// Reusable collator stored at module scope (Intl.Collator construction is expensive — cache per locale)
const collators = new Map<string, Intl.Collator>();
function getCollator(locale: string, options?: Intl.CollatorOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  if (!collators.has(key)) collators.set(key, new Intl.Collator(locale, options));
  return collators.get(key)!;
}
```

**Quick-fix hint**: For any user-visible sort, construct an `Intl.Collator` with the user's locale + appropriate options (`numeric: true` for filenames/versions; `sensitivity` per accent-handling needs) and use its `.compare()` method as the `Array.sort()` callback. Cache the collator per (locale, options) tuple — construction is non-trivial. For server-side sorting, either send the locale to the database (PostgreSQL `COLLATE "de_DE"` clauses) OR re-sort client-side with `Intl.Collator`.

**See also**: **I18N-STR-03** (this file, runtime lang-attribute correctness) — the locale passed to `Intl.Collator` should match `<html lang>` to keep sort order consistent with the rendered content's language. **I18N-STR-08** (this file, accent-insensitive search) — `Intl.Collator` with `sensitivity: "base"` is the canonical primitive for both locale-aware sorting AND accent-insensitive search; the two rules cover sibling use-cases of the same API.

---

### I18N-STR-08: Accent-insensitive search/comparison uses `Intl.Collator` with `sensitivity: "base"`

**Severity**: MAJOR
**Authority**: ECMAScript Intl.Collator API (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator — `Intl.Collator` `sensitivity` option (per MDN constructor option-table summary; paraphrased — see ECMA-402 §10.1.1 + MDN reference for canonical wording): `"base"` ignores accent and case differences, `"accent"` distinguishes accents but ignores case, `"case"` distinguishes case but ignores accents, `"variant"` distinguishes all differences.

**The rule**: When implementing user-facing search, filter, or "does X match Y" comparison logic where the user-typed input should match data containing accented variants (e.g., user types "Munich" and expects to find "München"; types "cafe" and expects to find "café"), use `Intl.Collator` with `sensitivity: "base"` (ignores accents + case) OR `sensitivity: "accent"` (case-only) — NEVER `String.prototype.includes()` / `===` / regex on normalized-by-toLowerCase strings, which all preserve accent diacritics. Manual `String.normalize("NFD").replace(/[̀-ͯ]/g, "")` (the "decompose + strip combining marks" pattern) approximates accent-folding but breaks for: precomposed characters that don't decompose to ASCII (Polish `ł`, Turkish `İ`, German `ß`), non-Latin scripts (Arabic, Hebrew, Cyrillic where "case" is not the right concept), and ligatures (`ﬃ` vs `ffi`). `Intl.Collator` handles all these cases per CLDR collation data.

**Code patterns to flag**:
- `data.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))` — locale-naïve case-folding + no accent-folding
- `data.filter(d => d.name.normalize("NFD").replace(/[̀-ͯ]/g, "").includes(stripped))` — manual accent-fold pattern (broken for non-Latin scripts + ligatures + precomposed-without-decomposition)
- Regex search with `i` flag treating it as accent-insensitive (`/munich/i` does NOT match "München")
- `Array.find` / `Array.some` with `===` on user-input vs data with potential accent variants
- Search-input handler that pre-strips accents from query but doesn't apply the same transformation to data (asymmetric folding produces inconsistent results)

**Correct pattern**:
```typescript
// Accent-insensitive search using Intl.Collator
const searchCollator = new Intl.Collator(userLocale, {
  usage: "search",      // optimized for search vs sort
  sensitivity: "base",  // ignore accents AND case
});

function matchesQuery(item: { name: string }, query: string): boolean {
  // Slide query across item.name and use collator.compare for each window
  const n = item.name.length;
  const q = query.length;
  for (let i = 0; i <= n - q; i++) {
    const substring = item.name.substring(i, i + q);
    if (searchCollator.compare(substring, query) === 0) return true;
  }
  return false;
}

// Higher-level: Intl.Collator "resolvedOptions" check for capability detection
const opts = new Intl.Collator(userLocale, { sensitivity: "base" }).resolvedOptions();
console.log(opts.sensitivity); // "base"
```

**Quick-fix hint**: For any user-facing search where accent / case insensitivity is desired, construct an `Intl.Collator` with `{ usage: "search", sensitivity: "base" }` and use `.compare() === 0` as the equality predicate. Note: substring matching with collator requires sliding-window comparison (the API doesn't expose a substring-search primitive directly). For high-volume search, consider pre-computing an accent-folded index using CLDR-aware collation library (e.g., `collation` npm package) or server-side accent-insensitive collation (PostgreSQL `ILIKE`/citext extensions; ElasticSearch `asciifolding` token filter).

**See also**: **I18N-STR-07** (this file, locale-aware sorting) — sibling `Intl.Collator` use-case for SORTING (uses default `sensitivity: "variant"` or `"accent"`); I18N-STR-08 covers SEARCH (uses `sensitivity: "base"`). Both depend on `Intl.Collator` and locale-aware construction. **I18N-STR-03** (this file, runtime lang-attribute) — the locale passed to `Intl.Collator` should match `<html lang>` for consistency between rendered content and search behavior.

---

### I18N-STR-09: Missing-translation handling must signal the defect — never silently render empty / fallback-to-English-only

**Severity**: MAJOR
**Authority**: i18next missing-key handling conventions; FormatJS missing-translation telemetry patterns
**Source**: https://www.i18next.com/principles/fallback — verbatim i18next default behavior: "If a key does not return a value the key acts as fallback" — the untranslated key itself is displayed; missing keys can be captured for translator review via `saveMissing` paired with `fallbackLng: 'dev'`. The library does NOT silently render empty strings or default to English without configuration.

**The rule**: When a translation key is missing from the user's locale catalog (and the I18N-STR-06 CLDR fallback chain is exhausted), the application MUST signal the defect visibly — by rendering the key itself (`"button.save"` displayed as literal text), a clearly-marked placeholder (`"[MISSING: button.save]"`), the key from the parent fallback locale, OR a development-only diagnostic — NEVER silently render an empty string, `null`/`undefined`, OR silently fall back to a UI-default locale (typically English). Silent empty rendering produces blank buttons / blank toasts / blank headings that users cannot interact with or understand; silent English fallback misleads users about feature availability in their language (per I18N-STR-06). Pair missing-key handling with telemetry (`missingKeyHandler` in i18next, `onError` in react-intl) so localization defects are surfaced to the translation pipeline as defects, not invisible degradations.

**Code patterns to flag**:
- i18next configuration with `returnEmptyString: true` (silent empty-string rendering for missing keys)
- i18next configuration with `returnNull: true` (silent null rendering — likely produces "undefined" or component crash downstream)
- react-intl `<IntlProvider>` with no `onError` handler (missing keys silently fall through to `defaultMessage` if present, OR to the key itself; no telemetry path)
- Custom translation function that catches the missing-key exception and returns `""` or the default English text without logging
- Custom translation function that returns `key` literally but doesn't fire any telemetry — visible to dev but no signal to translation pipeline
- Server-side render that responds with empty placeholder elements `<button></button>` when translation lookup misses (the empty button reaches production)

**Correct pattern**:
```typescript
// i18next: explicit missing-key handler + key-as-fallback rendering
import i18next from "i18next";
i18next.init({
  fallbackLng: { /* per-locale chains per I18N-STR-06 */ },
  returnEmptyString: false,
  returnNull: false,
  missingKeyHandler: (lngs, ns, key, fallbackValue) => {
    telemetry.warn("i18n.missing_key", { locales: lngs, namespace: ns, key });
    // Optionally: in dev, render a visible "[MISSING: <key>]" marker
    if (import.meta.env.DEV) console.warn(`[i18n] missing key in ${lngs.join(",")}: ${ns}:${key}`);
  },
  parseMissingKeyHandler: (key, defaultValue) => `[MISSING: ${key}]`, // dev-only visible marker
  saveMissing: import.meta.env.DEV, // capture for translator pipeline in dev
});

// react-intl: onError handler
<IntlProvider
  locale={userLocale}
  messages={messages}
  onError={(error) => {
    if (error.code === "MISSING_TRANSLATION") {
      telemetry.warn("i18n.missing_translation", { id: error.descriptor.id, locale: userLocale });
    } else {
      throw error; // re-throw non-missing-key errors
    }
  }}
>
```

**Quick-fix hint**: Configure your i18n library to (a) NOT return empty strings or null on missing keys, (b) emit telemetry for every missing key, (c) render either the key literal or a `[MISSING: key]` marker in development. In production, falling back to the key OR a parent-locale's translation is acceptable; silent empty rendering is not.

**See also**: **I18N-STR-06** (this file, CLDR locale fallback chain) — missing-key handling fires AFTER the I18N-STR-06 fallback chain is exhausted; both rules compose. STR-06 governs which locales are consulted; STR-09 governs what happens when the key is absent from all of them. **I18N-STR-01** (this file, translation-function discipline) — translation-function discipline produces the key-based lookup; STR-09 ensures the lookup's failure mode is observable rather than silent.

---

### I18N-STR-10: Message keys use stable namespaced identifiers — never embed presentation data or feature-prefix branding

**Severity**: MINOR
**Authority**: industry consensus across i18next / react-intl / Vue I18N / FormatJS canonical documentation
**Source**: i18next namespacing docs (https://www.i18next.com/principles/namespaces) + react-intl message-id conventions (https://formatjs.github.io/docs/getting-started/message-distribution#extraction)

**The rule**: Message keys MUST be stable namespaced identifiers describing the *semantic role* of the message (`button.save`, `dialog.delete_confirm.title`, `error.network.timeout`, `form.email.placeholder`) — NEVER embed: (a) presentation data (`button.blue_save`, `header.large_text`); (b) feature-flag or A/B-test branding (`button.save_v2`, `signup_flow_experiment_treatment_b`); (c) component-internal naming (`MyComponent.button_at_line_42`); (d) the actual English text as the key (`"Save changes"` as the key — collides on punctuation/casing changes; makes translation catalog brittle to copy-edits). Keys must survive UI redesigns (visual style changes shouldn't require renaming the key) AND A/B test rollouts (winning variant should adopt the canonical key, not the test-suffix key) AND component refactors (key shouldn't depend on which component owns the message). Convention: `<feature>.<surface>.<element>.<state?>` or similar role-based hierarchy.

**Code patterns to flag**:
- Keys carrying presentation styling: `t("button.blue_save")`, `t("header.large_text")`, `t("text.bold_warning")`
- Keys carrying A/B variant suffixes: `t("signup.button_v2")`, `t("hero.cta_experiment_b")`
- Keys carrying component-internal names: `t("CheckoutPage.SubmitButton.label")` (component name in key locks the key to that component name; refactor breaks the key)
- English source text used as the key: `<Trans>Save changes</Trans>` (Trans without an `id` prop) OR `t("Save changes")` — copy-editing the English to "Apply changes" creates a new key and orphans the old translation file
- Per-page key duplication: `t("page.checkout.save")` + `t("page.profile.save")` + `t("page.settings.save")` (3 keys for the same "Save" action — translators write the same translation 3 times, increasing cost + risking divergence)

**Correct pattern**:
```typescript
// Namespaced semantic keys
t("button.save")               // generic Save — reused across the app
t("form.email.label")          // form field semantic role
t("form.email.placeholder")    // form field semantic role + element
t("dialog.delete_account.title")    // dialog identifier + element
t("dialog.delete_account.confirm")  // button within the dialog
t("error.network.timeout")     // error category + cause
t("nav.home")                  // navigation item

// React + react-intl with stable IDs
<FormattedMessage id="button.save" defaultMessage="Save" />
<FormattedMessage id="dialog.delete_account.title" defaultMessage="Delete account?" />

// i18next namespace organization
// translations/en/common.json: { "button.save": "Save", "button.cancel": "Cancel" }
// translations/en/checkout.json: { "title": "Checkout", "step.shipping": "Shipping" }
t("button.save", { ns: "common" })
t("step.shipping", { ns: "checkout" })
```

**Quick-fix hint**: When introducing a new translation key, choose its name by asking "what semantic role does this message serve?" (button action, form field, dialog title, error category). Avoid coupling the key to (a) visual presentation, (b) experiment status, (c) implementing-component name, (d) source-text wording. Share keys across UI surfaces that render the same message (`button.save` for all Save buttons app-wide) UNLESS the message text genuinely differs by context.

**See also**: **I18N-STR-01** (this file, translation-function discipline) — STR-01 ensures strings ARE translatable; STR-10 ensures the keys ARE stable maintainable identifiers. **I18N-STR-05** (this file, no-concatenation discipline) — STR-05 ensures messages are single units; STR-10 ensures those single-unit keys are well-named. **MC-006** (`microcopy/buttons-ctas.md`, "Buttons start with verbs that describe the specific action") — when authoring the English source text for `button.save` / `button.delete` / `button.publish`, MC-006 governs the verb choice; I18N-STR-10 governs the key naming convention.
