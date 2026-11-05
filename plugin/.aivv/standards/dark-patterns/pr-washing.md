# Dark Patterns — Dark-PR / washing (DP-PR-01..08)

Part of [.aivv/standards/dark-patterns/](README.md).

### DP-PR-01: Greenwashing in product copy

**Severity**: MAJOR
**Rationale**: Sustainability / carbon-neutral / eco-friendly claims without verifiable backing. FTC Green Guides apply.
**Source**: FTC Green Guides — https://www.ftc.gov/business-guidance/advertising-marketing/environmental-marketing

**The rule**: environmental claims tied to specific, verifiable measurements or third-party certifications. Defer-to DP-LEGAL-11 for the FTC compliance variant.

**Code patterns to flag**:
- Product badge "Eco-friendly" / "Carbon neutral" / "Sustainable" without certification reference
- Marketing copy "100% green" without offset disclosure

**Correct pattern**: claims tied to certifications (LEED, Energy Star, B Corp, etc.) with verifiable references.

**Quick-fix hint**: sustainability badges / copy — verify backing certification.

---

### DP-PR-02: AI-washing in feature copy

**Severity**: MAJOR
**Rationale**: Marketing features as "AI-powered" / "ML-driven" / "Smart" when the underlying implementation is heuristic / rules-based / lookup-table — misrepresents capability.
**Source**: FTC Health Claims / Online Advertising — https://www.ftc.gov/business-guidance/advertising-marketing/health-claims

**The rule**: AI / ML claims accurately describe the underlying technology; "smart"-prefix features document what makes them smart.

**Code patterns to flag**:
- Feature labeled "AI" backed by `if/else` heuristics
- "Powered by AI" badge on rule-engine outputs

**Correct pattern**: technology claims match implementation; "AI" reserved for ML-backed features.

**Quick-fix hint**: AI / ML / Smart-prefix feature copy — trace implementation.

---

### DP-PR-03: Diversity / inclusion claims without practice

**Severity**: MINOR
**Rationale**: "Inclusive" / "Diverse team" claims in product copy / about pages without backing data — pinkwashing / rainbowwashing variants.
**Source**: FTC truth-in-advertising — https://www.ftc.gov/business-guidance/advertising-marketing

**The rule**: diversity claims tied to measurable / verifiable data; not just decorative copy.

**Code patterns to flag**:
- About-page boilerplate "We celebrate diversity" without team-diversity data
- Pride-month rainbow logo without sustained inclusion commitment

**Correct pattern**: diversity claims backed by transparent reporting.

**Quick-fix hint**: about / mission pages — review diversity claim specificity.

---

### DP-PR-04: Fake "we listen to feedback" UX

**Severity**: MINOR
**Rationale**: Feedback widgets / "let us know what you think" surfaces that send to a black-hole inbox without any visible response or acknowledgment process.
**Source**: NN/g — https://www.nngroup.com/articles/

**The rule**: feedback channels include realistic SLAs / response acknowledgments; "we value your input" copy ties to actual process.

**Code patterns to flag**:
- Feedback form posting to `/dev/null` (closed Slack channel, unmonitored inbox)
- "We read every message" copy with no triage system

**Correct pattern**: feedback flow with documented response SLA + auto-acknowledgment.

**Quick-fix hint**: feedback form — trace backend destination.

---

### DP-PR-05: Charity / donation washing

**Severity**: MAJOR
**Rationale**: "We donate X% to charity" claims without breakdown; donations gated behind opaque conditions; round-up donations rounded into company profits.
**Source**: FTC truth-in-advertising — https://www.ftc.gov/business-guidance/advertising-marketing

**The rule**: charity claims tied to verifiable donation receipts; rounding logic is transparent; recipient charities are named.

**Code patterns to flag**:
- Checkout "Round up for charity" without recipient charity name visible
- "X% goes to good causes" without itemized breakdown

**Correct pattern**: named recipient, percentage breakdown, annual transparency report linked.

**Quick-fix hint**: charity / donation features — verify transparency.

---

### DP-PR-06: Misleading user-count / scale claims

**Severity**: MAJOR
**Rationale**: "Trusted by 1,000+ companies" with cherry-picked examples or "Used in 195 countries" backed by `localStorage` analytics from one-off visitors.
**Source**: FTC Endorsements — https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews

**The rule**: scale claims tied to active-user / active-customer thresholds clearly defined; not aggregate-visitor metrics.

**Code patterns to flag**:
- "Trusted by N companies" derived from registered-domain count rather than active-customer count
- Country count from analytics IP-geolocation including bots

**Correct pattern**: scale-claim metric defined clearly (e.g., "1,000+ paying customers"); methodology in a linked page.

**Quick-fix hint**: scale-claim copy — trace metric source + definition.

---

### DP-PR-07: Survey-bias reporting

**Severity**: MINOR
**Rationale**: "85% of users prefer our product!" based on a survey of opt-in users who already prefer the product — selection bias.
**Source**: FTC truth-in-advertising — https://www.ftc.gov/business-guidance/advertising-marketing

**The rule**: survey statistics tied to methodology disclosure (sample size, sampling method, response rate).

**Code patterns to flag**:
- "N% satisfaction" badge without methodology link
- Survey results from opt-in NPS without representative weighting

**Correct pattern**: stats tied to representative methodology; disclosed at the same level as the claim.

**Quick-fix hint**: marketing-stat badges — verify methodology link.

---

### DP-PR-08: Press / award badges with no link to source

**Severity**: MINOR
**Rationale**: "Featured in Forbes / TechCrunch / NYT" logos that don't link to actual coverage; "Best of 2024" badges with no awarding-body link.
**Source**: NN/g — https://www.nngroup.com/articles/

**The rule**: press / award badges link to the original publication or awarding-body source.

**Code patterns to flag**:
- Logo strip "As seen in" without `<a href>` per logo
- Award badge with no awarding-body link

**Correct pattern**: every badge is a link to the source.

**Quick-fix hint**: logo / award strips — verify each image is linked.
