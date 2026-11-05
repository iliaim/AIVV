# Dark Patterns — Social-proof manipulation (DP-SOCIAL-01..08)

Part of [.aivv/standards/dark-patterns/](README.md).

### DP-SOCIAL-01: Fake or undisclosed sponsored reviews

**Severity**: MAJOR
**Rationale**: Product reviews that are paid placements or written by sponsored creators without `#sponsored` / `#ad` disclosure violate FTC endorsement guidelines.
**Source**: FTC Endorsements & Influencers — https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews

**The rule**: sponsored / incentivized reviews are clearly labeled (visible badge, not just metadata). Defer-to DP-LEGAL-10 for the FTC compliance variant.

**Code patterns to flag**:
- Review card without `<Badge>` rendering for `review.sponsored === true`
- `sponsored` field present in data but not surfaced in UI

**Correct pattern**: prominent "Sponsored" / "Paid" badge adjacent to the review header.

**Quick-fix hint**: review-card component — verify sponsored-state rendering.

---

### DP-SOCIAL-02: Cherry-picked review filtering

**Severity**: MAJOR
**Rationale**: Defaulting review-list sort to "Most positive" or filtering 1-star reviews from default view manipulates perception.
**Source**: FTC Endorsements — https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews

**The rule**: default review-sort is "Most recent" or "Most helpful (cross-rating)"; low-star reviews are not silently filtered.

**Code patterns to flag**:
- `<ReviewList defaultSort="highest-rated">` as the only displayed option
- Filtering logic that excludes `review.rating <= 2` by default

**Correct pattern**: default sort = recent / helpful; users can filter; no rating-class is hidden from default.

**Quick-fix hint**: review-list initialState / defaults — verify no rating bias.

---

### DP-SOCIAL-03: Fabricated user counts / testimonials

**Severity**: MAJOR
**Rationale**: "Join 100,000+ happy customers!" without verifiable backing or testimonials attributed to people who don't exist violates FTC truth-in-advertising.
**Source**: FTC Endorsements — https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews

**The rule**: user-count claims tie to actual figures; testimonials attribute to real users with consent.

**Code patterns to flag**:
- Hardcoded "100,000+ customers" without analytics-backing
- Testimonial component with fixture / placeholder names rendered to production

**Correct pattern**: dynamic user-count tied to real metrics; testimonials linked to consenting real users.

**Quick-fix hint**: user-count badges + testimonial components — trace data sources.

---

### DP-SOCIAL-04: "Verified buyer" without verification

**Severity**: MAJOR
**Rationale**: "Verified buyer" badges on reviews without actually verifying purchase history misleads users about review credibility.
**Source**: FTC Endorsements — https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews

**The rule**: "Verified buyer" / "Verified purchase" badges require real purchase verification at render time.

**Code patterns to flag**:
- Verified-badge rendered whenever `review.author.account_age > 0` (not purchase-verified)
- Verification flag set in seed-data on all reviews

**Correct pattern**: badge rendered only when `review.purchase_id` exists and is verified.

**Quick-fix hint**: verified-badge logic — verify it ties to actual orders.

---

### DP-SOCIAL-05: Manipulated review-summary statistics

**Severity**: MAJOR
**Rationale**: "4.8 stars (10,000 reviews)" prominently displayed while the actual displayed reviews show a much different rating distribution.
**Source**: NN/g social proof — https://www.nngroup.com/articles/social-proof-ux/

**The rule**: summary statistics tie to the full review dataset; histogram (5/4/3/2/1 star breakdown) is shown.

**Code patterns to flag**:
- `<RatingSummary>${product.avgRating}</RatingSummary>` without histogram
- Summary computed on a filtered subset of reviews

**Correct pattern**: summary on all reviews; histogram visible.

**Quick-fix hint**: rating-summary component — verify histogram + full-dataset computation.

---

### DP-SOCIAL-06: Stale activity feeds

**Severity**: MINOR
**Rationale**: "Recently purchased by..." feeds that don't reflect actual recent activity (e.g., showing the same 5 purchases for weeks) deceive users.
**Source**: deceptive.design "Social Proof" — https://www.deceptive.design/types

**The rule**: activity feeds reflect real, time-bounded data; stale displays are removed or labeled.

**Code patterns to flag**:
- Hardcoded activity-feed entries
- Feed with no max-age filter on backing data

**Correct pattern**: feed entries with TTL; stale items dropped or marked.

**Quick-fix hint**: activity-feed component — verify data freshness.

---

### DP-SOCIAL-07: "X friends like this" without friend-list access

**Severity**: MAJOR
**Rationale**: Showing "5 of your friends like this!" without actually having access to (or computing from) the user's friend graph is fabricated personalization.
**Source**: NN/g social proof — https://www.nngroup.com/articles/social-proof-ux/

**The rule**: friend-proof messaging requires actual friend-graph data with user consent.

**Code patterns to flag**:
- `<FriendsLikeThis count={5}>` with hardcoded count
- Component renders friend names from non-friend datasource

**Correct pattern**: friend-graph queries gated on user consent; numbers reflect real connections.

**Quick-fix hint**: friend-proof components — verify backing graph data.

---

### DP-SOCIAL-08: Asymmetric review-response visibility

**Severity**: MINOR
**Rationale**: Showing the merchant's response to positive reviews prominently but burying their (rare or absent) responses to negative reviews.
**Source**: NN/g social proof — https://www.nngroup.com/articles/social-proof-ux/

**The rule**: merchant-response visibility is symmetric across review ratings.

**Code patterns to flag**:
- Review-response component conditionally hidden for low-rating reviews
- Response-prompt UI shown only for positive reviews

**Correct pattern**: merchant-response surfaces identically across all reviews; absent ones equally absent.

**Quick-fix hint**: review-response component — verify symmetric rendering.
