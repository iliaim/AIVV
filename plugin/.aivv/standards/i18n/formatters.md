# Internationalization — locale-aware formatters

Part of [.aivv/standards/i18n/](README.md) (I18N-FMT-NN). This subfile covers locale-aware code patterns for the Intl.* API family: date/time, number, currency, relative-time, list, and display-names formatters. Hardcoded format strings (`MM/DD/YYYY`, `$1,000.00`, `"3 hours ago"`) break for non-US locales; the Intl.* APIs delegate format decisions to CLDR locale data.

### I18N-FMT-01: Dates use `Intl.DateTimeFormat` with explicit locale (never hardcoded `MM/DD/YYYY` or `DD/MM/YYYY`)

**Severity**: MAJOR
**Authority**: ECMAScript Intl.DateTimeFormat API (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat — verbatim MDN regional-variation example: `new Intl.DateTimeFormat("en-US").format(date)` returns `"12/19/2012"`; `new Intl.DateTimeFormat("en-GB").format(date)` returns `"19/12/2012"` — the same calendar date renders in month-day-year vs day-month-year order per locale.

**The rule**: All user-visible dates MUST be formatted via `Intl.DateTimeFormat` (or equivalent locale-aware library like date-fns/format with `locale` option, dayjs with locale plugin, Luxon's localized formatting) with the user's locale explicitly passed. NEVER use: (a) hardcoded format strings like `"MM/DD/YYYY"` / `"DD/MM/YYYY"` / `"YYYY-MM-DD"` (US/EU/ISO conventions all wrong for someone); (b) `date.toLocaleDateString()` with no locale (uses runtime locale — non-deterministic across users + servers); (c) string concatenation like `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}` (forces US order globally); (d) `date.toString()` / `date.toDateString()` (English-only Saturday/Sat format). Use `dateStyle` shorthand (`"full"` / `"long"` / `"medium"` / `"short"`) for common cases; the granular `year`/`month`/`day` options for custom compositions. Always pass an explicit `timeZone` for timestamps representing absolute moments (otherwise the runtime's local timezone applies, which mis-attributes dates near midnight UTC).

**Code patterns to flag**:
- `date.toLocaleDateString()` with no locale argument — defaults to runtime locale (non-deterministic)
- `${month}/${day}/${year}` template literal forcing US format
- Date-format libraries called with English-format-string but no `locale` option (`format(date, "MMM dd, yyyy")` without locale)
- `moment(date).format("MM/DD/YYYY")` — moment.js hardcoded English-format-string (moment is also deprecated; migrate to Luxon/dayjs/date-fns)
- React component rendering `{order.createdAt.toISOString().slice(0, 10)}` (forces YYYY-MM-DD globally)
- Server-side date rendering that emits an English-format string into HTML before the client knows the user's locale

**Correct pattern**:
```typescript
// Native Intl.DateTimeFormat with explicit locale + timeZone
const formatter = new Intl.DateTimeFormat(userLocale, {
  dateStyle: "long",         // "December 19, 2012" (en-US) / "19 December 2012" (en-GB) / "19. Dezember 2012" (de-DE)
  timeZone: "America/New_York",  // explicit IANA tz for unambiguous absolute moments
});
formatter.format(order.createdAt);

// Granular options when dateStyle shorthand doesn't fit
new Intl.DateTimeFormat(userLocale, {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
}).format(order.createdAt);

// Cached per-locale formatter (construction is non-trivial — cache like Intl.Collator)
const formatters = new Map<string, Intl.DateTimeFormat>();
function getDateFormatter(locale: string, opts: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(opts)}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat(locale, opts));
  return formatters.get(key)!;
}
```

**Quick-fix hint**: Replace all hardcoded date-format-string patterns with `Intl.DateTimeFormat` (locale, options) where `locale` comes from the i18n library's current locale. Use `dateStyle` for common cases. Always pass `timeZone` when the date is a UTC timestamp representing an absolute moment. For server-side rendering, either pass the user's locale through to the server OR defer date rendering to the client.

**See also**: **I18N-STR-03** (`i18n/strings.md`, "Runtime `<html lang>` value matches the active user-language locale") — the locale passed to `Intl.DateTimeFormat` should match `<html lang>` to keep date formatting consistent with the rendered language. **I18N-STR-05** (same file, "Never concatenate translated fragments") — when a message embeds a formatted date (`"Order placed on {date}"`), use ICU `{date, date, long}` placeholders inside the single message rather than concatenating the formatted date with surrounding translated text.

---

### I18N-FMT-02: Numbers use `Intl.NumberFormat` with explicit locale (never hardcoded `1,000.00` or `1.000,00`)

**Severity**: MAJOR
**Authority**: ECMAScript Intl.NumberFormat API (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat — verbatim MDN canonical purpose: "The `Intl.NumberFormat` object enables language-sensitive number formatting." Verbatim regional variation: German `de-DE` formats `123456.789` as `123.456,789` (period-thousands + comma-decimal); US English formats `3500` as `3,500` (comma-thousands); Indian English `en-IN` uses lakh/crore separators producing `1,23,456.789`; Arabic `ar-EG` uses Arabic digits `١٢٣٤٥٦٫٧٨٩`.

**The rule**: All user-visible numbers MUST be formatted via `Intl.NumberFormat` with the user's locale explicitly passed. Different locales use fundamentally different grouping and decimal separators: US/UK `1,000.00`; most of EU `1.000,00`; French `1 000,00` (non-breaking space); Indian `1,00,000` (lakh grouping at 2-digit boundaries above thousand); Arabic `١٬٠٠٠٫٠٠` (Arabic-Indic digits + Arabic separators). NEVER use: (a) `String(num)` or `${num}` template-literal which renders as `1000` (no grouping at all) or `1000.5` (period-decimal locked); (b) `num.toLocaleString()` with no locale (runtime-locale-dependent — non-deterministic); (c) manual `.replace()`-based formatting (`num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")` forces US grouping; doesn't handle Indian lakh, doesn't handle Arabic digits); (d) any library that doesn't take a `locale` parameter for number formatting.

**Code patterns to flag**:
- `num.toLocaleString()` with no locale argument
- String template `${count.toFixed(2)}` rendering money without locale-aware grouping/decimal
- Manual thousands-separator regex: `.replace(/\B(?=(\d{3})+(?!\d))/g, ",")` — forces US grouping
- Hardcoded period-decimal: `(num * 100).toFixed(2)` produces `1234.56` regardless of locale
- React/Vue component rendering raw `{stats.count}` to user — uses default toString (no grouping)
- Server-side number rendering that emits US-format strings before the client knows the user's locale

**Correct pattern**:
```typescript
// Native Intl.NumberFormat with explicit locale
const formatter = new Intl.NumberFormat(userLocale, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
formatter.format(1234567.89);  // "1,234,567.89" (en-US) / "1.234.567,89" (de-DE) / "12,34,567.89" (en-IN)

// Compact-display for large numbers (e.g., social counters "1.2M views")
new Intl.NumberFormat(userLocale, {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
}).format(1_234_567);  // "1.2M" (en-US) / "1,2 Mio." (de-DE) / "120万" (ja-JP)

// Cached per-locale formatter
const numberFormatters = new Map<string, Intl.NumberFormat>();
function getNumberFormatter(locale: string, opts: Intl.NumberFormatOptions) {
  const key = `${locale}|${JSON.stringify(opts)}`;
  if (!numberFormatters.has(key)) numberFormatters.set(key, new Intl.NumberFormat(locale, opts));
  return numberFormatters.get(key)!;
}
```

**Quick-fix hint**: Replace all manual number-formatting (template literals, `toLocaleString()` without locale, regex-based thousands-separator) with `Intl.NumberFormat` using the user's locale. Configure `minimumFractionDigits` / `maximumFractionDigits` for precision needs. Use `notation: "compact"` for large-number displays (counters, statistics). Cache formatters per locale + options tuple.

**See also**: **I18N-STR-02** (`i18n/strings.md`, "Pluralization must use CLDR-aware library") — when rendering a number alongside a pluralized noun (`"3 items"` / `"1 item"`), use the `Intl.PluralRules`-aware message with `Intl.NumberFormat`-formatted count; don't concatenate raw `count + " " + (count === 1 ? "item" : "items")`. **I18N-FMT-03** (this file, currency) — currency uses `Intl.NumberFormat` with `style: "currency"`; sibling pattern with currency-specific options.

---

### I18N-FMT-03: Currency uses `Intl.NumberFormat({style: "currency"})` with explicit currency code (never hardcoded `$` prefix or assumed-USD display)

**Severity**: MAJOR
**Authority**: ECMAScript Intl.NumberFormat API — currency style (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat — verbatim normative requirement: "There is no default value; if the `style` is `\"currency\"`, the `currency` property must be provided. It is normalized to uppercase." Verbatim locale-placement variation: German `de-DE` with EUR formats `3500` as `"3.500,00 €"` (symbol AFTER number); US English with USD formats `3500` as `"$3,500.00"` (symbol BEFORE number).

**The rule**: All user-visible currency values MUST be formatted via `Intl.NumberFormat({style: "currency", currency: "<ISO 4217 code>"})` with the user's locale explicitly passed. NEVER use: (a) hardcoded `$` prefix (`$${price.toFixed(2)}` forces USD-display globally, wrong for non-US currencies + wrong symbol-placement for non-English locales); (b) currency-symbol concatenation (`"€" + amount` forces EUR-display + symbol-before-number which is wrong for de-DE which puts € after); (c) `toLocaleString()` with style-currency but no locale (runtime-locale-dependent); (d) `Intl.NumberFormat` with `style: "currency"` but no `currency` option (TypeError per the API spec); (e) ASSUMING the display currency matches the user's locale — currency is a property of the price (`USD`, `EUR`, `JPY`), locale is a property of the user (`en-US`, `de-DE`, `ja-JP`); the two are orthogonal. A Japanese user viewing a USD-priced product should see `"US$50.00"` or `"50,00 US-Dollar"` (depending on `currencyDisplay`), NOT `"¥50"` (locale-naïve display would swap the currency).

**Code patterns to flag**:
- `"$" + price.toFixed(2)` template — forces USD symbol + before-number placement
- `${price.toLocaleString()} ${currencyCode}` — emits raw number + appended code, missing locale-aware symbol-placement
- `Intl.NumberFormat({style: "currency"}).format(amount)` — TypeError, currency option is required
- Price-display component that takes a `price: number` prop with no `currency: string` prop — the currency is implicit (assumed USD) which is wrong for non-USD prices
- E-commerce price-rendering that doesn't distinguish display-currency-rendering from underlying-price-currency (mixing locale + currency in a single state variable)
- `Intl.NumberFormat({style: "currency", currency: "USD"})` with no locale — uses runtime locale; non-deterministic placement

**Correct pattern**:
```typescript
// Price is { amount: number, currency: "USD" | "EUR" | "JPY" | ... }
// User locale is separate (the user's chosen language/region)
function formatPrice(price: { amount: number; currency: string }, userLocale: string): string {
  const formatter = new Intl.NumberFormat(userLocale, {
    style: "currency",
    currency: price.currency,  // ISO 4217 code (USD / EUR / JPY / CNY / ...)
    // currencyDisplay: "symbol" (default) | "code" | "name" | "narrowSymbol"
  });
  return formatter.format(price.amount);
}

// Examples:
formatPrice({ amount: 3500, currency: "USD" }, "en-US");  // "$3,500.00"
formatPrice({ amount: 3500, currency: "USD" }, "de-DE");  // "3.500,00 $" (USD-symbol, German number format)
formatPrice({ amount: 3500, currency: "EUR" }, "de-DE");  // "3.500,00 €"
formatPrice({ amount: 3500, currency: "JPY" }, "ja-JP");  // "￥3,500" (no decimal places — JPY default)

// currencyDisplay variants
new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "code" }).format(3500);
// "USD 3,500.00"
new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "name" }).format(3500);
// "3,500.00 US dollars"
```

**Quick-fix hint**: Replace every hardcoded `$` / `€` / `¥` prefix with `Intl.NumberFormat({style: "currency", currency: <ISO-4217-code>})` using both the user's locale AND the price's currency code. The currency code is a property of the price (data), not a derivation from the user's locale. For multi-currency apps (e.g., e-commerce serving prices in seller's currency), every price object carries its own currency code; the user's locale only affects symbol placement + number formatting around the value.

**See also**: **I18N-FMT-02** (this file, "Numbers use `Intl.NumberFormat`") — currency is a specialization of number formatting (`style: "currency"`); same locale-aware grouping/decimal/digit-system rules apply on top of the currency-specific symbol/code/name display. **DP-PRICE-01..12** (`dark-patterns/pricing.md`) — pricing manipulation patterns (drip pricing, fake anchors, hidden fees) intersect with currency-display correctness; getting `Intl.NumberFormat` currency right is the i18n baseline; DP-PRICE-* covers the manipulation-pattern axis on top.

---

### I18N-FMT-04: Relative time uses `Intl.RelativeTimeFormat` (never hardcoded "3 hours ago" / "in 2 days" English phrasing)

**Severity**: MAJOR
**Authority**: ECMAScript Intl.RelativeTimeFormat API (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat — verbatim MDN canonical purpose: "The `Intl.RelativeTimeFormat` object enables language-sensitive relative time formatting." Verbatim API surface: `relativeTimeFormat.format(value, unit)` where `unit` is one of `year`/`quarter`/`month`/`week`/`day`/`hour`/`minute`/`second`. Verbatim option semantics: `numeric: "auto"` may return locale-specific special words like "yesterday" instead of "1 day ago"; `style: "long"/"short"/"narrow"` controls verbosity.

**The rule**: All user-visible relative-time displays (`"3 hours ago"`, `"in 2 days"`, `"yesterday"`, `"last week"`) MUST be formatted via `Intl.RelativeTimeFormat` with the user's locale explicitly passed. NEVER use: (a) hardcoded English templates (`${diff} ${diff === 1 ? "hour" : "hours"} ago` — locks to English + violates I18N-STR-02 pluralization); (b) date-fns `formatDistanceToNow()` without `locale` option (defaults to English); (c) moment.js `.fromNow()` with `moment.locale("en")` baked in; (d) string-concatenated relative time (`"posted " + diff + " hours ago"` — three drift surfaces: English word "posted", English direction "ago", English pluralization). Negative values produce past tense (`"3 hours ago"`), positive values produce future tense (`"in 3 hours"`); the API handles direction automatically per locale. `numeric: "auto"` opts into idiomatic forms (English "yesterday" / Spanish "pasado mañana" for +2 days) when the locale has them — preferred for natural copy.

**Code patterns to flag**:
- `${hoursAgo} hours ago` template — hardcoded English phrasing
- `relativeDate.toString() + " ago"` — concatenated direction word
- `date-fns/formatDistanceToNow(date)` with no `{ locale: dateFnsLocale }` option
- `moment(date).fromNow()` — moment.js relative-time with locale baked at module-load
- Conditional English phrasing: `if (diff < 60) return diff + "s ago"; else if ...` — English unit abbreviations + word order locked
- Custom helper function `formatTimeAgo(date)` that hardcodes English

**Correct pattern**:
```typescript
const rtf = new Intl.RelativeTimeFormat(userLocale, { numeric: "auto" });

// Negative for past, positive for future
rtf.format(-3, "hour");    // "3 hours ago" (en) / "vor 3 Stunden" (de) / "hace 3 horas" (es)
rtf.format(3, "hour");     // "in 3 hours" (en) / "in 3 Stunden" (de) / "dentro de 3 horas" (es)
rtf.format(-1, "day");     // "yesterday" (en, with numeric:"auto") / "1 day ago" (with numeric:"always")

// Helper that picks the largest meaningful unit
function relativeTimeFrom(date: Date, locale: string, now = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffSec = (date.getTime() - now.getTime()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000], ["month", 2_592_000], ["week", 604_800],
    ["day", 86_400], ["hour", 3_600], ["minute", 60], ["second", 1],
  ];
  for (const [unit, sec] of units) {
    if (Math.abs(diffSec) >= sec || unit === "second") {
      return rtf.format(Math.round(diffSec / sec), unit);
    }
  }
  return rtf.format(0, "second");
}
```

**Quick-fix hint**: Replace hardcoded English relative-time templates with `Intl.RelativeTimeFormat` using the user's locale. Use `numeric: "auto"` for natural idiomatic forms ("yesterday" / "last week" / "next month"). Pass negative values for past, positive for future. Cache the formatter per (locale, options).

**See also**: **I18N-FMT-01** (this file, `Intl.DateTimeFormat`) — sibling Intl-API formatter for ABSOLUTE timestamps; FMT-04 covers RELATIVE displays. Use FMT-04 when the time-since-now is the salient information ("3h ago"); use FMT-01 when the absolute moment matters ("Dec 19, 2012 3:00 PM"). **I18N-STR-02** (`i18n/strings.md`, CLDR pluralization) — `Intl.RelativeTimeFormat` handles per-locale pluralization automatically (no need for separate `Intl.PluralRules` integration); ensures FMT-04 outputs `"3 hours ago"` (en plural) vs `"hace 3 horas"` (es) without manual plural-form selection.

---

### I18N-FMT-05: Joining lists of items uses `Intl.ListFormat` (never hardcoded `", "` + English `"and"` / `"or"`)

**Severity**: MAJOR
**Authority**: ECMAScript Intl.ListFormat API (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat — verbatim MDN canonical purpose: "The `Intl.ListFormat` object enables language-sensitive list formatting." Verbatim MDN locale-variation examples: `new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" }).format(["Motorcycle", "Bus", "Car"])` returns `"Motorcycle, Bus and Car"` (en-GB convention is no Oxford comma); `new Intl.ListFormat("de", { style: "short", type: "disjunction" }).format(["Motorcycle", "Bus", "Car"])` returns `"Motorcycle, Bus oder Car"` (German `oder` as locale-appropriate "or").

**The rule**: All user-visible lists of items joined into prose (`"alice, bob, and charlie"` / `"red, green, or blue"` / `"5 ft 9 in"` as a unit-style list) MUST be formatted via `Intl.ListFormat` with the user's locale. NEVER use: (a) hardcoded `items.join(", ")` for prose lists (no conjunction; no locale-aware final-separator); (b) manual final-separator logic: `items.slice(0, -1).join(", ") + " and " + items[items.length - 1]` — locks "and" English, locks no-Oxford-comma decision, locks Latin-script comma; (c) i18n message with `{names}` placeholder fed a `.join(", ")` string (the joined string itself isn't locale-aware). `Intl.ListFormat` handles: locale-appropriate conjunction word ("and" / "und" / "y" / "そして"); locale-appropriate punctuation (Latin "," vs Chinese "、" vs Arabic "،"); Oxford-comma convention per locale (US English Oxford-yes vs UK English Oxford-no); `type: "conjunction"` ("A, B, and C") vs `"disjunction"` ("A, B, or C") vs `"unit"` (no conjunction, "5 ft 9 in").

**Code patterns to flag**:
- `items.join(", ")` for user-visible prose lists (no conjunction; no locale awareness)
- Manual conjunction stitching: `items.length === 1 ? items[0] : items.slice(0, -1).join(", ") + " and " + items[items.length-1]`
- Conditional final-separator logic with hardcoded English ("and" / "or") + hardcoded Oxford-comma decision
- i18n message `t("posted_by", { names: authors.join(", ") })` — the join itself isn't locale-aware
- Custom `formatList()` helper that hardcodes English conjunction words

**Correct pattern**:
```typescript
// Conjunction list ("A, B, and C")
const conjunctionFormatter = new Intl.ListFormat(userLocale, { style: "long", type: "conjunction" });
conjunctionFormatter.format(["Alice", "Bob", "Charlie"]);
// en-US: "Alice, Bob, and Charlie" (Oxford comma)
// en-GB: "Alice, Bob and Charlie" (no Oxford comma)
// de:    "Alice, Bob und Charlie"
// es:    "Alice, Bob y Charlie"
// ja:    "Alice、Bob、Charlie"

// Disjunction list ("A, B, or C")
new Intl.ListFormat(userLocale, { type: "disjunction" }).format(["red", "green", "blue"]);
// en: "red, green, or blue" / de: "red, green oder blue" / es: "red, green o blue"

// Unit list ("5 ft 9 in" — no conjunction, used with Intl.NumberFormat unit-formatting)
new Intl.ListFormat(userLocale, { type: "unit", style: "narrow" }).format(["5 ft", "9 in"]);
// en: "5 ft, 9 in" (narrow) / "5 ft 9 in" (varies by locale + style)
```

**Quick-fix hint**: Replace every `items.join(", ")` / manual-conjunction-stitching pattern for user-visible prose with `Intl.ListFormat(locale, { style, type })`. Choose `type: "conjunction"` for "and" lists, `"disjunction"` for "or" lists, `"unit"` for measurement-unit composition. Use `style: "long"` for normal prose, `"narrow"` for space-constrained UI.

**See also**: **I18N-STR-05** (`i18n/strings.md`, "Never concatenate translated fragments") — list-joining via `.join()` is a special case of fragment concatenation; FMT-05 covers the locale-aware composition primitive. When the list appears within an ICU MessageFormat string, use `{names}` placeholder fed with the `Intl.ListFormat`-formatted result — keeps the surrounding message single-unit per STR-05 + the list itself locale-aware per FMT-05.

---

### I18N-FMT-06: Language / region / script / currency display-names use `Intl.DisplayNames` (never hardcoded English "German" / "France" / "Latin")

**Severity**: MAJOR
**Authority**: ECMAScript Intl.DisplayNames API (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames — verbatim MDN canonical purpose: "The `Intl.DisplayNames` object enables the consistent translation of language, region and script display names." Verbatim locale-variation example: `new Intl.DisplayNames(["en"], { type: "language" }).of("de")` returns `"German"`; `new Intl.DisplayNames(["de"], { type: "language" }).of("de")` returns `"Deutsch"`; `new Intl.DisplayNames(["fr"], { type: "language" }).of("de")` returns `"Allemand"` — same language code `"de"` rendered into the user's UI locale.

**The rule**: All user-visible display names for languages (`"German"` / `"Deutsch"` / `"Allemand"`), regions/countries (`"United States"` / `"États-Unis"` / `"Vereinigte Staaten"`), scripts (`"Latin"` / `"Latein"`), and currency names (`"US Dollar"` / `"Dólar estadounidense"`) MUST be rendered via `Intl.DisplayNames` with the user's locale + the appropriate `type` option — NEVER hardcoded English names. Hardcoded English language/region names in language-pickers / region-selectors / locale-switchers / share-via-X buttons produce broken UX for non-English users (a German user choosing language in a dropdown sees "German / French / Spanish" English names instead of "Deutsch / Französisch / Spanisch"). The `type` option accepts `"language"` / `"region"` / `"script"` / `"currency"` / `"calendar"` / `"dateTimeField"` — each maps the corresponding code (`"de"` / `"US"` / `"Latn"` / `"USD"` / `"gregory"` / `"day"`) to its display name in the requested locale.

**Code patterns to flag**:
- Language-picker dropdown with hardcoded English language names: `["English", "German", "French", "Spanish", ...]`
- Country-selector with hardcoded English country names: `["United States", "Germany", "France", ...]`
- Region/state picker that translates the city names but leaves country names in English
- Currency-display alongside amount that hardcodes English currency name: `"50 US Dollars"` (should localize to "50 Dollar US" in fr-FR)
- Translation-catalog entries with PER-LOCALE-LANGUAGE-NAMES hardcoded (`languages.de = "German"; languages.fr = "French"`) — duplicates CLDR data that `Intl.DisplayNames` provides natively
- Calendar-system display ("Gregorian") hardcoded English when used in date-picker UI showing alternate calendar systems

**Correct pattern**:
```typescript
// Language picker: render each supported locale's name in the user's UI locale
function LanguagePicker({ supportedLocales, userLocale, currentLocale, onChange }) {
  const langNames = new Intl.DisplayNames([userLocale], { type: "language" });
  return (
    <select value={currentLocale} onChange={(e) => onChange(e.target.value)}>
      {supportedLocales.map((loc) => (
        <option key={loc} value={loc}>{langNames.of(loc)}</option>
      ))}
    </select>
  );
}
// userLocale="en": [English, German, French, Spanish]
// userLocale="de": [Englisch, Deutsch, Französisch, Spanisch]
// userLocale="fr": [Anglais, Allemand, Français, Espagnol]

// Country picker
const regionNames = new Intl.DisplayNames([userLocale], { type: "region" });
regionNames.of("US");  // "United States" (en) / "Vereinigte Staaten" (de) / "États-Unis" (fr)

// Currency name display
const currNames = new Intl.DisplayNames([userLocale], { type: "currency" });
currNames.of("USD");  // "US Dollar" (en) / "US-Dollar" (de) / "dollar des États-Unis" (fr)

// Script display
const scriptNames = new Intl.DisplayNames([userLocale], { type: "script" });
scriptNames.of("Latn");  // "Latin" (en) / "Lateinisch" (de)
```

**Quick-fix hint**: Replace every hardcoded language/region/script/currency-name list with `Intl.DisplayNames(userLocale, { type: <appropriate-type> }).of(<code>)` lookups. For language pickers + region selectors + locale switchers, this is the single canonical replacement for the per-locale-name-table pattern that production codebases often duplicate from CLDR. Cache the DisplayNames instance per (locale, type) tuple.

**See also**: **I18N-FMT-01** (this file, `Intl.DateTimeFormat`) — sibling Intl-API formatter; FMT-06 covers the orthogonal display-name surface (language/region/script/currency/calendar codes → user-locale names). **I18N-STR-03** (`i18n/strings.md`, runtime `<html lang>` correctness) — the locale passed to `Intl.DisplayNames` should match `<html lang>` to keep display names consistent with the rendered language context.

---

### I18N-FMT-07: Text segmentation (grapheme/word/sentence) uses `Intl.Segmenter` (never `String.prototype.split(" ")` or per-character iteration)

**Severity**: MAJOR
**Authority**: ECMAScript Intl.Segmenter API (MDN canonical reference)
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter — verbatim MDN canonical purpose: "The `Intl.Segmenter` object enables locale-sensitive text segmentation, enabling you to get meaningful items (graphemes, words or sentences) from a string." Verbatim MDN failure-mode statement: "If we were to use `String.prototype.split(" ")` to segment a text in words, we would not get the correct result if the locale of the text does not use whitespaces between words (which is the case for Japanese, Chinese, Thai, Lao, Khmer, Myanmar, etc.)."

**The rule**: When code needs to count, iterate, truncate, search, or otherwise split user-facing text by graphemes / words / sentences, it MUST use `Intl.Segmenter` with the user's locale — NEVER `string.split(" ")` for words, `string.length` for character count, `Array.from(string)` for "characters", or naïve per-character iteration via `for (const ch of string)`. The defects this rule prevents: (a) `string.split(" ")` returns `["吾輩は猫である。名前はたぬき。"]` (one element) for Japanese — no whitespace, no segmentation; (b) `string.length` counts UTF-16 code units, not grapheme clusters — `"👨‍👩‍👧‍👦".length` is 11 (family emoji is ZWJ-joined 4 emoji), should be 1; (c) `for (const ch of "👨‍👩‍👧‍👦")` iterates 7 code points (still wrong for grapheme count); (d) word-aware truncation `"Hello world".slice(0, 5) + "..."` works for English but produces `"こんに..."` mid-word for Japanese.

**Code patterns to flag**:
- `string.split(" ")` for word-counting / word-iteration on user-text
- `string.length` returning "character count" displayed to user (Twitter/X-style character counters)
- `Array.from(string).length` claiming to handle emoji (still wrong for ZWJ sequences + variation selectors)
- Truncation logic `string.slice(0, N) + "..."` that risks splitting mid-grapheme (especially with emoji + combining marks) or mid-word (CJK)
- Search/highlight logic that uses regex `.{1}` or `[-￿]` (BMP-only, breaks for emoji)
- Reverse-text features using `string.split("").reverse().join("")` (breaks all combining sequences)

**Correct pattern**:
```typescript
// Grapheme-aware character count
const graphemeSeg = new Intl.Segmenter(userLocale, { granularity: "grapheme" });
function graphemeCount(s: string): number {
  return Array.from(graphemeSeg.segment(s)).length;
}
graphemeCount("👨‍👩‍👧‍👦");  // 1 (family emoji is one grapheme)
graphemeCount("café");        // 4 (even if é is encoded as e + combining-acute)

// Word-aware iteration (works for CJK + space-delimited)
const wordSeg = new Intl.Segmenter(userLocale, { granularity: "word" });
for (const seg of wordSeg.segment(text)) {
  if (seg.isWordLike) console.log(seg.segment);
}

// Word-aware truncation that doesn't break grapheme boundaries
function truncateGraphemes(s: string, maxGraphemes: number, locale: string): string {
  const seg = new Intl.Segmenter(locale, { granularity: "grapheme" });
  const graphemes = Array.from(seg.segment(s));
  if (graphemes.length <= maxGraphemes) return s;
  return graphemes.slice(0, maxGraphemes).map(g => g.segment).join("") + "…";
}
```

**Quick-fix hint**: For any user-text iteration / counting / truncation / splitting, use `Intl.Segmenter` with the user's locale + appropriate granularity (`grapheme` / `word` / `sentence`). Cache the segmenter per (locale, granularity). For server-side or polyfill contexts (Intl.Segmenter is Baseline since 2024-01 — older runtimes need a polyfill), the `Intl.Segmenter` polyfill from FormatJS works.

**See also**: **I18N-STR-08** (`i18n/strings.md`, accent-insensitive search) — search/comparison primitives benefit from segmenter awareness when matching across grapheme boundaries (e.g., emoji-sequence matching). **I18N-FMT-01** (this file, `Intl.DateTimeFormat`) — sibling locale-aware Intl-API; both rely on user's locale for correctness.

---

### I18N-FMT-08: Locale tag handling uses `Intl.Locale` for canonical BCP 47 manipulation (never substring-based parsing)

**Severity**: MAJOR
**Authority**: ECMAScript Intl.Locale API (MDN canonical reference); BCP 47 language-tag standard (RFC 5646)
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale — verbatim MDN canonical purpose: "The `Intl.Locale` object is a standard built-in property of the Intl object that represents a Unicode locale identifier." MDN canonical motivation (paraphrased from non-contiguous source paragraphs): the `Intl.Locale` object was created to allow for easier manipulation of Unicode locales; adding a Locale class adds ease of parsing and manipulating the language, script, and region, as well as extension tags.

**The rule**: Code that parses, normalizes, compares, or manipulates locale tags (`"en-US"`, `"zh-Hant-HK"`, `"pt-BR-u-ca-gregory"`) MUST use `Intl.Locale` rather than substring parsing or hardcoded splits. Substring-based locale parsing breaks for: (a) extension tags (`"en-US-u-ca-buddhist"` — the `-u-ca-buddhist` Unicode extension carries calendar override); (b) script subtag presence-or-absence (`"zh-Hant"` vs `"zh-Hant-HK"` — script may or may not appear between language and region); (c) grandfathered tags (`"i-klingon"`, `"sgn-BE-FR"` — irregular forms); (d) canonical-form normalization (`"en_US"` underscore vs `"en-US"` hyphen; `"en-us"` lowercase region vs canonical `"en-US"`); (e) maximize/minimize equivalence (`"en"` and `"en-Latn-US"` represent the same locale per CLDR but compare unequal as strings). `Intl.Locale` provides `.language`/`.region`/`.script`/`.calendar`/`.numberingSystem`/`.hourCycle` accessors + `.maximize()` / `.minimize()` methods for canonicalization.

**Code patterns to flag**:
- `locale.split("-")[0]` to extract language tag (works for simple `"en-US"` but breaks for `"zh-Hant-HK"`)
- `locale.split("-")[1]` to extract region (assumes region is at index 1 — wrong when script subtag is present)
- `locale.toLowerCase() === "en-us"` for locale comparison (canonicalization should preserve `"en-US"` region uppercase)
- Hardcoded locale-to-language map (`{"en-US": "en", "pt-BR": "pt", ...}` — duplicates CLDR data)
- Regex parsing of BCP 47 tags (`/^([a-z]{2})-([A-Z]{2})$/` — assumes 2-letter-language + 2-letter-region; breaks for `"zh-Hant"`, `"sr-Latn-RS"`, etc.)
- Underscore-vs-hyphen locale tag confusion (`navigator.language` returns hyphen-separated; some libraries return underscore-separated; no canonicalization layer)

**Correct pattern**:
```typescript
// Parse + normalize locale tag
const locale = new Intl.Locale("zh-Hant-HK-u-ca-buddhist");
locale.language;        // "zh"
locale.script;          // "Hant"
locale.region;          // "HK"
locale.calendar;        // "buddhist" (from -u-ca-buddhist extension)
locale.toString();      // "zh-Hant-HK-u-ca-buddhist" (canonical form)

// Maximize: fill in missing subtags via CLDR likely-subtags
new Intl.Locale("en").maximize().toString();   // "en-Latn-US"
new Intl.Locale("zh-HK").maximize().toString(); // "zh-Hant-HK"

// Minimize: remove subtags that match likely-subtag defaults
new Intl.Locale("en-Latn-US").minimize().toString();  // "en"
new Intl.Locale("zh-Hant-HK").minimize().toString();   // "zh-HK"

// Canonical locale comparison
function localesMatch(a: string, b: string): boolean {
  return new Intl.Locale(a).maximize().toString() === new Intl.Locale(b).maximize().toString();
}
localesMatch("en", "en-US");           // true (en maximizes to en-Latn-US; en-US maximizes to en-Latn-US)
localesMatch("zh-Hant", "zh-Hant-TW"); // false (different regions)
```

**Quick-fix hint**: Replace every substring-based locale-tag parse with `new Intl.Locale(tag).<accessor>`. Use `.maximize()` before comparing two locale tags to test semantic equivalence. Validate `.region` / `.script` presence via `?.` optional-chain — some tags don't carry one or both. Note: `Intl.Locale` is Baseline since 2023-01; older runtimes need the FormatJS polyfill.

**See also**: **I18N-STR-03** (`i18n/strings.md`, runtime `<html lang>` correctness) — the `<html lang>` value should be canonicalized via `Intl.Locale` before write to ensure consistent BCP 47 form. **A11Y-072** (`accessibility/document-language.md`, "Prefer BCP 47 region-qualified `lang` values") — A11Y-072 governs the FORMAT preference (region-qualified); FMT-08 provides the canonical PARSER/NORMALIZER for that format.

---

### I18N-FMT-09: Date storage + transport in UTC; display in user's IANA timezone (never `new Date()` arithmetic in local TZ)

**Severity**: MAJOR
**Authority**: ECMAScript Date specification (MDN canonical reference); IANA Time Zone Database
**Source**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date — verbatim MDN canonical: "A JavaScript date is fundamentally specified as the time in milliseconds that has elapsed since the [epoch]... This timestamp is _timezone-agnostic_ and uniquely defines an instant in history." Verbatim coupling issue (MDN `**Note:**` callout): "**Note:** While the time value at the heart of a Date object is UTC, the basic methods to fetch the date and time or its components all work in the local (i.e., host system) time zone and offset."

**The rule**: User-facing date displays MUST pass an explicit IANA timezone (`"America/New_York"`, `"Europe/Berlin"`, `"Asia/Tokyo"`) to `Intl.DateTimeFormat`'s `timeZone` option — NEVER rely on `Date.prototype.get*()` methods (`.getDate()`, `.getDay()`, `.getHours()`) which return values in the runtime's local timezone (server's TZ for SSR; user's device TZ for CSR; both wrong when displaying for a user in a different TZ than the runtime). Date storage and transport (database persistence, API JSON payloads, log entries) MUST be in UTC ISO 8601 form (`"2026-05-14T16:34:21.234Z"`) — NEVER in a TZ-naïve local form (`"2026-05-14 16:34:21"`) which silently re-anchors to whichever TZ parses it. The user's IANA timezone preference (`"America/Los_Angeles"`) is separate from the user's locale (`"en-US"`) — a user with `en-US` locale traveling in Tokyo may want UTC dates rendered in `Asia/Tokyo` or `America/Los_Angeles` (home tz); the choice belongs to the user's explicit preference, not the device timezone.

**Code patterns to flag**:
- `date.getHours()` / `.getDate()` / `.getDay()` for display (local TZ; non-deterministic across users + servers)
- `new Date("2026-05-14 16:34:21")` parsing TZ-naïve string (silently re-anchors to local TZ; SSR vs CSR disagrees)
- Date arithmetic via `date.setDate(date.getDate() + 1)` (correct for absolute-1-day-add but breaks at DST transitions if intent was "tomorrow at this clock-time in the user's TZ")
- Server-side date rendering using `new Date().toLocaleString()` without timezone (renders in server's TZ, not user's)
- Storing dates as `"2026-05-14"` without TZ — ambiguous date for users near UTC boundaries
- Timezone-name strings sourced from `Date.prototype.getTimezoneOffset()` (only gives minute offset, not IANA name; doesn't round-trip)

**Correct pattern**:
```typescript
// STORAGE: always UTC ISO 8601 string
const orderCreatedAt: string = "2026-05-14T16:34:21.234Z";  // canonical UTC

// DISPLAY: pass user's IANA timezone explicitly
const formatter = new Intl.DateTimeFormat(userLocale, {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: userTimezone,  // e.g., "America/New_York"; sourced from user preference, NOT device default
});
formatter.format(new Date(orderCreatedAt));

// Library-equivalents
import { format, formatInTimeZone } from "date-fns-tz";
formatInTimeZone(new Date(orderCreatedAt), userTimezone, "PPpp", { locale: dateFnsLocale });

import { DateTime } from "luxon";
DateTime.fromISO(orderCreatedAt).setZone(userTimezone).setLocale(userLocale).toLocaleString(DateTime.DATETIME_FULL);

// Day arithmetic that respects user's tz + DST
DateTime.fromISO(orderCreatedAt).setZone(userTimezone).plus({ days: 1 }).toISO();
```

**Quick-fix hint**: Audit all date `get*()` calls — every user-display path should route through `Intl.DateTimeFormat(locale, { timeZone })` instead. Storage layer: enforce UTC ISO 8601 strings everywhere; reject TZ-naïve forms at API boundary. User preference: store explicit IANA timezone (`"America/New_York"`) per user; default to `Intl.DateTimeFormat().resolvedOptions().timeZone` (device TZ) only as initial fallback.

**See also**: **I18N-FMT-01** (this file, `Intl.DateTimeFormat`) — FMT-01 enforces locale-aware date FORMATTING; FMT-09 enforces explicit-IANA-timezone usage at the storage + transport + display boundaries. The two rules compose: every Intl.DateTimeFormat invocation in a multi-user app should pass both `locale` AND `timeZone`. **I18N-FMT-04** (this file, `Intl.RelativeTimeFormat`) — relative time displays inherently respect "now" in some TZ; ensure "now" is sourced consistently relative to the user's TZ for accurate relative-time framing.

---

### I18N-FMT-10: Locale detection prefers explicit user preference; falls through to `Accept-Language` server-side / `navigator.languages` client-side (never trust `navigator.language` alone)

**Severity**: MAJOR
**Authority**: RFC 7231 Section 5.3.5 Accept-Language; MDN navigator.languages
**Source**: https://www.rfc-editor.org/rfc/rfc7231#section-5.3.5 (Accept-Language header semantics); https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages (navigator.languages array reflecting user's preference order). Authority-cite without `"..."`-wrapping per dev.91+ Discipline 1 structural-gating scope (paraphrase form exempt).

**The rule**: Locale-detection logic MUST resolve in this precedence order: (1) **explicit user preference** persisted per-account (e.g., user-chosen locale from a settings dropdown, stored server-side per user); (2) **per-session URL locale** (e.g., `/ja/...` path prefix or `?lang=ja` query — explicit-and-recoverable for shared links); (3) server-side: **HTTP `Accept-Language` header** parsed via library (`accept-language-parser` / framework's native) — the header is RFC 7231 quality-weighted (`en-US,en;q=0.9,fr;q=0.5`) and must be parsed correctly; (4) client-side: **`navigator.languages` ARRAY** (NOT `navigator.language` singular) — the array reflects the user's preference order in browser settings; (5) **CLDR fallback to root** via Intl.LocaleMatcher / per-app fallback chain (per I18N-STR-06). NEVER trust: (a) `navigator.language` alone — singular value; ignores user's secondary preferences and Accept-Language quality weights; (b) IP-geolocation as the locale source — geographic region ≠ language preference (an English-speaking American visiting Berlin doesn't suddenly want German UI); (c) device OS language as the only signal — same person may use English-OS for work + Spanish-UI for entertainment.

**Code patterns to flag**:
- Client-side `const locale = navigator.language` as the sole locale source (ignores secondary preferences in `navigator.languages`)
- Server-side locale detection from `request.headers["accept-language"].split(",")[0]` (no quality-weight parsing; assumes first item is preferred regardless of `;q=`)
- IP-geolocation library used as the locale source (`ipapi.co` → country → locale; geographic ≠ linguistic)
- Locale-detection that doesn't persist explicit user preference (every login re-detects from headers; user-chosen locale forgotten)
- No URL-locale support (locale changes only in localStorage; sharing a URL loses the locale context for the recipient)
- `navigator.language || "en"` fallback (silently defaults to English; violates I18N-STR-06's no-English-as-default rule for non-English-locale users)

**Correct pattern**:
```typescript
// Server-side locale resolution chain
function resolveLocale(req: Request, user: User | null, supportedLocales: string[]): string {
  // 1. Explicit per-user preference
  if (user?.preferredLocale && supportedLocales.includes(user.preferredLocale)) {
    return user.preferredLocale;
  }
  // 2. URL locale (e.g., /ja/posts)
  const urlLocale = req.params.locale;
  if (urlLocale && supportedLocales.includes(urlLocale)) {
    return urlLocale;
  }
  // 3. Accept-Language header (quality-weighted parse)
  const acceptLang = req.headers.get("accept-language") ?? "";
  const matcher = new Intl.LocaleMatcher(supportedLocales);  // or use accept-language-parser
  const headerPreferences = parseAcceptLanguage(acceptLang);  // returns [{ locale, quality }]
  for (const pref of headerPreferences.sort((a, b) => b.quality - a.quality)) {
    if (supportedLocales.some(s => new Intl.Locale(s).maximize().toString() === new Intl.Locale(pref.locale).maximize().toString())) {
      return pref.locale;
    }
  }
  // 4. CLDR root fallback per I18N-STR-06
  return supportedLocales.includes("root") ? "root" : supportedLocales[0];
}

// Client-side: use navigator.languages ARRAY (preference order), not navigator.language SINGULAR
function resolveLocaleClient(supportedLocales: string[]): string {
  // navigator.languages: ["en-US", "en", "fr", "de"] — user's ordered preferences
  for (const candidate of navigator.languages ?? [navigator.language]) {
    const match = supportedLocales.find(s =>
      new Intl.Locale(s).maximize().toString() === new Intl.Locale(candidate).maximize().toString()
    );
    if (match) return match;
  }
  return supportedLocales.includes("root") ? "root" : supportedLocales[0];
}
```

**Quick-fix hint**: For client code, replace every `navigator.language` use with `navigator.languages` iteration (preference order). For server code, use a quality-weight-aware Accept-Language parser (built-in framework support in Express, Next.js, Remix, Rails). Always honor explicit per-user preference when present; persist the user's locale choice; expose a locale-switcher in UI. Surface URL-locale support for shareability.

**See also**: **I18N-STR-06** (`i18n/strings.md`, CLDR locale fallback chain) — FMT-10's detection chain terminates in the I18N-STR-06 fallback chain when no supported locale matches user preferences. The two rules compose: FMT-10 detects the user's requested locale, STR-06 handles the case where the requested locale isn't available. **I18N-FMT-08** (this file, `Intl.Locale` canonical handling) — locale-tag canonicalization via `Intl.Locale.maximize()` is the comparison primitive FMT-10 uses to match Accept-Language preferences against supported locales.
