# Dark Patterns — Pricing manipulation (DP-PRICE-01..12)

Part of [.aivv/standards/dark-patterns/](README.md).

**i18n composition note (dev.104+):** The DP-PRICE-* manipulation patterns compose with **I18N-FMT-03** (`i18n/formatters.md`, "Currency uses `Intl.NumberFormat({style: 'currency'})`") on the currency-display surface. I18N-FMT-03 enforces the locale-aware + currency-code-explicit formatting baseline (no hardcoded `$` prefix, no assumed-USD display, no symbol-placement-locked-to-US-English); the DP-PRICE-* rules then cover manipulation-axis defects on top of that correctness baseline (drip pricing, fake anchors, hidden fees, etc.). The two layers compose: getting `Intl.NumberFormat` currency formatting correct is the i18n baseline; DP-PRICE-* findings address manipulative patterns regardless of locale-correctness.

### DP-PRICE-01: Drip pricing — surcharges revealed only at checkout

**Severity**: MAJOR
**Rationale**: Adding mandatory fees (service charge, handling, processing) only on the final checkout screen — after the user has invested time entering data — is the canonical drip-pricing dark pattern. FTC has cited this in enforcement actions.
**Source**: deceptive.design "Sneaking" / Drip pricing — https://www.deceptive.design/types

**The rule**: all mandatory price components (taxes, mandatory service fees, "processing" charges) are surfaced at the same level as the headline price, NOT introduced only on the final checkout step.

**Code patterns to flag**:
- `<Price>${baseAmount}</Price>` with mandatory `serviceFee` / `bookingFee` added only in `<Checkout>`
- Cart total showing `${subtotal}` but `${total}` (with hidden fees) only revealed after "Continue to checkout"
- "Final price" computed at the last step rather than on the product detail / cart page

**Correct pattern**: show "${total} (incl. fees)" at every step where price is shown; itemize fees in a tooltip / expandable section.

**Quick-fix hint**: search for `fee`/`surcharge`/`processing` variables added late in checkout flow.

---

### DP-PRICE-02: Hidden mandatory fees

**Severity**: MAJOR
**Rationale**: Fees presented as "optional" but actually required to complete the purchase (e.g., a pre-checked "expedited processing" that cannot be unchecked without abandoning the flow).
**Source**: FTC Online Advertising guidance — https://www.ftc.gov/business-guidance/advertising-marketing/online-advertising-marketing

**The rule**: any fee the user must pay to complete the primary action is mandatory and must be shown as mandatory (not styled as optional).

**Code patterns to flag**:
- `<Checkbox checked disabled>` for a fee marked "Expedited handling"
- Fee toggle that re-checks itself on submit
- Conditional UI where unchecking blocks the submit button

**Correct pattern**: if the fee is required, show it as a mandatory line item; if optional, allow uncheck without blocking purchase.

**Quick-fix hint**: every `disabled` checkbox with a price implication.

---

### DP-PRICE-03: Fake "compare" / strike-through pricing

**Severity**: MAJOR
**Rationale**: Showing `~~$199~~ $99` (50% off!) when the product was never sold at $199 misrepresents the discount and violates FTC truth-in-advertising guidance.
**Source**: FTC truth-in-advertising — https://www.ftc.gov/business-guidance/advertising-marketing

**The rule**: strike-through "was $X" prices must reflect an actual prior selling price within a documented timeframe (typically 30+ days). Fictitious anchor prices are deceptive.

**Code patterns to flag**:
- `<s>${msrp}</s> ${price}` where `msrp` is a hardcoded multiplier (not from price history)
- "Was $X" labels with no `priceHistory` data source
- Permanent "limited-time discount" badges

**Correct pattern**: tie strike-through to actual `priceHistory[lastNonSaleDate].amount`; if no history, no strike-through.

**Quick-fix hint**: any hardcoded "compare at" / `msrp` constant unconnected to actual price-history.

---

### DP-PRICE-04: Anchor-pricing manipulation in tiered plans

**Severity**: MINOR
**Rationale**: Adding an artificially expensive "Enterprise" tier (with no real customers) solely to make the "Pro" tier look like a bargain — the decoy-effect dark pattern.
**Source**: deceptive.design "Misdirection" — https://www.deceptive.design/types

**The rule**: pricing-page tiers reflect actual purchasable plans, not decoys engineered to anchor perception of mid-tier value.

**Code patterns to flag**:
- Top tier marked "Contact sales" with no live pricing path
- Hardcoded "Most popular!" badge on the middle tier with no analytics-driven evidence
- Top tier feature list copied from mid-tier with one trivial addition

**Correct pattern**: each tier has a real conversion path; "popular" badges driven by actual usage data.

**Quick-fix hint**: pricing-page component — verify each tier is purchasable; "popular" badge is data-driven.

---

### DP-PRICE-05: Per-unit price obfuscation

**Severity**: MAJOR
**Rationale**: Listing "20 items for $24.99" without per-unit comparison prevents like-for-like comparison vs competitors and violates UK/EU unit-pricing directives.
**Source**: FTC Online Advertising — https://www.ftc.gov/business-guidance/advertising-marketing/online-advertising-marketing

**The rule**: product listings with quantity / volume show a per-unit equivalent (per kg, per litre, per item) at the same visual prominence as the bundle price.

**Code patterns to flag**:
- `<Price>${bundlePrice}</Price>` without `<UnitPrice>` for multi-pack / weight-based products
- Quantity discount tables without per-unit columns

**Correct pattern**: `<Price>${bundlePrice} (${unitPrice}/${unit})</Price>`.

**Quick-fix hint**: any bundle / pack / weight-based product card without per-unit display.

---

### DP-PRICE-06: Currency / unit switching mid-flow

**Severity**: MAJOR
**Rationale**: Switching display currency or units between product page and checkout (e.g., USD on product page → EUR at checkout without conversion rate disclosure) confuses users about final price.
**Source**: deceptive.design "Sneaking" — https://www.deceptive.design/types

**The rule**: currency / units stay consistent across the full purchase flow OR conversion is explicit with rate disclosed.

**Code patterns to flag**:
- Locale.currency derived differently in `<ProductPage>` vs `<Checkout>`
- Currency selector that resets to default on next page load

**Correct pattern**: single source of truth for currency; conversion at one explicit step with rate visible.

**Quick-fix hint**: trace currency state through product → cart → checkout components.

---

### DP-PRICE-07: Tax-inclusive vs tax-exclusive inconsistency

**Severity**: MAJOR
**Rationale**: Showing tax-exclusive prices in some flows and tax-inclusive in others (or hiding tax until the final screen in markets where inclusive display is standard / required, e.g., EU/UK).
**Source**: EU Consumer Rights Directive — referenced in DSA Article 25 enforcement context, https://eur-lex.europa.eu/eli/reg/2022/2065/oj

**The rule**: tax-inclusive display in jurisdictions that require it (EU/UK consumer markets); tax-exclusive only where legally permitted and clearly labeled.

**Code patterns to flag**:
- Region-detection that doesn't switch tax-display mode
- Tax line introduced only at the payment step in EU contexts
- Hardcoded "+ tax" suffix in jurisdictions requiring tax-inclusive display

**Correct pattern**: tax-display mode driven by user's detected/selected market; consistent across the flow.

**Quick-fix hint**: tax-display logic in cart vs product vs checkout — should derive from one config.

---

### DP-PRICE-08: Trial-to-paid price obscured

**Severity**: MAJOR
**Rationale**: "Start 30-day free trial" without prominently disclosing the post-trial recurring price is a classic pricing dark pattern. FTC negative-option rule applies.
**Source**: FTC Negative Option Rule — https://www.ftc.gov/legal-library/browse/rules/negative-option-rule

**The rule**: trial CTAs disclose the post-trial price (amount + cadence) at the same visual prominence as the trial offer. Defer-to DP-LEGAL-04 for the compliance variant.

**Code patterns to flag**:
- `<Button>Start free trial</Button>` without nearby "${monthlyPrice}/month after trial" copy
- Trial-price prominent; post-trial price in fine print only

**Correct pattern**: `<Button>Start trial ($X/month after 30 days)</Button>` OR adjacent disclosure at equal visual weight.

**Quick-fix hint**: trial CTA components — verify post-trial price visible.

---

### DP-PRICE-09: Renewal price hike without notice

**Severity**: MAJOR
**Rationale**: First-year promotional price ($5/mo) that auto-renews at the standard rate ($25/mo) without clear pre-renewal disclosure.
**Source**: FTC Negative Option Rule — https://www.ftc.gov/legal-library/browse/rules/negative-option-rule

**The rule**: any auto-renewal at a price different from the original purchase must disclose the renewal price + cadence at point of sale.

**Code patterns to flag**:
- `promoPrice` and `renewalPrice` as separate fields; renewal field not surfaced in checkout copy
- Subscription confirmation email omits renewal-price disclosure

**Correct pattern**: "Renews at ${renewalPrice}/month on ${renewalDate}" surfaced in checkout AND confirmation.

**Quick-fix hint**: subscription confirmation flow — verify renewal-price disclosure.

---

### DP-PRICE-10: Free / freemium with credit-card-required

**Severity**: MAJOR
**Rationale**: "Free trial" or "Free plan" that requires credit-card entry shifts the user toward forgetting to cancel before charge — a pricing-manipulation pattern even when legally compliant.
**Source**: NN/g deceptive patterns — https://www.nngroup.com/articles/deceptive-patterns/

**The rule**: "Free" tiers should not require credit card unless the post-free flow involves actual charging — and the future-charge should be prominent.

**Code patterns to flag**:
- `<TrialSignup>` with mandatory `<CreditCardForm>` and no post-trial charge documented
- "Free plan" requiring payment-method on file

**Correct pattern**: free → no card; trial-to-paid → card with prominent renewal disclosure.

**Quick-fix hint**: signup flow — verify "Free" tiers don't gate on card-entry.

---

### DP-PRICE-11: Bait-and-switch pricing across devices

**Severity**: MAJOR
**Rationale**: Displaying different prices for the same SKU based on detected device, browser, or user agent — without disclosure — disadvantages users on premium devices (the canonical "iPhone-tax" dark pattern).
**Source**: FTC Online Advertising — https://www.ftc.gov/business-guidance/advertising-marketing/online-advertising-marketing

**The rule**: same-SKU price varies only on factors disclosed to the user (geo-region, currency, loyalty status) — never on device/browser as a hidden signal.

**Code patterns to flag**:
- Price-derivation logic that reads `User-Agent` / `navigator.platform`
- A/B test buckets keyed on device class without disclosure

**Correct pattern**: pricing keyed on disclosed factors only; experiments transparently labeled.

**Quick-fix hint**: pricing-API request — verify request body doesn't include device-fingerprint signals.

---

### DP-PRICE-12: Coupon-code field as friction lever

**Severity**: MINOR
**Rationale**: Empty "Have a coupon code?" field at checkout sends some users away to search for codes, increasing abandonment. Either remove or collapse-by-default.
**Source**: Baymard checkout-UX research — https://www.baymard.com/blog

**The rule**: coupon-code fields are collapsed by default (link/disclosure) rather than empty input boxes that signal "you might be missing a discount."

**Code patterns to flag**:
- `<input placeholder="Coupon code" />` always visible
- Empty coupon input as a checkout step

**Correct pattern**: `<Link onClick={expand}>Have a coupon code?</Link>` collapsing to a field only when clicked.

**Quick-fix hint**: checkout coupon component — verify collapsed-by-default.
