# UX Heuristics — Cognitive Biases (HEU-COG-*)

Part of [.aivv/standards/ux-heuristics/](README.md).

The rules in this file apply cognitive-psychology principles that are **not** entries on lawsofux.com's published index. They are sourced from primary HCI/psychology literature (Loewenstein, Wason, Johnson & Goldstein, Norman, NN/g empirical research). The prefix is separated from `HEU-LUX-` so that LUX rules remain unambiguously anchored to the Yablonski catalog. Severity floors and L1-source-class precedence rules apply identically to both subgroups.

### HEU-COG-curiosity-gap: Curiosity Gap

**Severity**: POLISH
**Rationale**: Information gaps create motivation to bridge them (Loewenstein, 1994). Used ethically, this drives engagement; abused, it becomes clickbait or dark-pattern manipulation.
**Source**: Loewenstein, G. (1994). "The psychology of curiosity: A review and reinterpretation." *Psychological Bulletin* 116(1):75–98. doi:10.1037/0033-2909.116.1.75

**The rule**: tease relevant information ethically (preview-then-detail patterns) — never withhold information the user needs to make a decision.

**Code patterns to flag**:
- Pricing pages requiring sign-up to see prices
- Notification badges with no preview ("3 new — open to find out")
- Links labeled with curiosity bait ("You won't believe what we did") in product UI

**Correct pattern**: progressive disclosure with honest previews; user always sees enough to decide.

**Quick-fix hint**: never withhold decision-relevant information just to drive engagement.

---

### HEU-COG-confirmation-bias: Confirmation Bias

**Severity**: POLISH
**Rationale**: Users seek information that confirms existing beliefs; UI can either feed this bias (filter bubbles) or counter it (alternative perspectives).
**Source**: Wason, P.C. (1960). "On the failure to eliminate hypotheses in a conceptual task." *Quarterly Journal of Experimental Psychology* 12(3):129–140. doi:10.1080/17470216008416717 (foundational empirical demonstration)

**The rule**: where the surface presents conclusions, also present counter-evidence or alternatives. Don't optimize ranking signals to amplify only one viewpoint.

**Code patterns to flag**:
- Recommendation systems with no "see other options" affordance
- Status dashboards that hide failures to avoid triggering action
- Search rankings without a way to see lower-ranked alternatives

**Correct pattern**: include "view all" / "see alternatives" / "show details" affordances.

**Quick-fix hint**: the surface should help users reason, not just confirm.

---

### HEU-COG-default-effect: Default Effect

**Severity**: MAJOR
**Rationale**: Defaults are accepted at high rates regardless of whether they serve the user (Johnson & Goldstein, 2003). Choosing defaults is a high-leverage design decision; defaults that benefit the company at the user's expense are dark patterns.
**Source**: Johnson, E.J. & Goldstein, D. (2003). "Do Defaults Save Lives?" *Science* 302(5649):1338–1339. doi:10.1126/science.1091721. Plus FTC enforcement on dark-pattern defaults: https://www.ftc.gov/news-events/topics/protecting-consumer-privacy/dark-patterns

**The rule**: defaults serve the user's most-likely intent. When in conflict between user benefit and product benefit, default toward the user. Pre-checked subscribe checkboxes for marketing email are a regulatory risk (GDPR, CAN-SPAM).

**Code patterns to flag**:
- Pre-checked subscribe / marketing-consent checkboxes
- Default opt-in for sharing data with third parties
- Default-selected most-expensive plan in a pricing tier
- Default to renew-automatically without consent

**Correct pattern**: opt-in for sharing data; default to least-cost plan; explicit renew choice.

**Quick-fix hint**: a user accepts every default unchanged. What did they just agree to? Is that fair?

---

### HEU-COG-feedback-loop: Feedback Loop

**Severity**: MINOR
**Rationale**: Users learn by acting and observing the consequence; tight feedback loops accelerate learning and confidence.
**Source**: Norman, D.A. (1988/2013). *The Design of Everyday Things*, ch. 1 — "feedback" as one of the seven fundamental principles of interaction design. ISBN 978-0465050659

**The rule**: every action surfaces a consequence quickly enough for the user to associate cause with effect. Latency degrades the loop.

**Code patterns to flag**:
- Mutations whose effect appears only after a manual refresh
- Settings changes that take effect on next login
- Validation errors that surface only on form submit (no inline feedback)

**Correct pattern**: optimistic UI; inline validation; immediate state reflection.

**Quick-fix hint**: from action to observable consequence — under 1 second is great, over 3 seconds breaks the loop.

---

### HEU-COG-novelty: Novelty Effect

**Severity**: POLISH
**Rationale**: Users are drawn to novel elements but novelty wears off. Designs that rely on novelty for primary navigation lose effectiveness over time.
**Source**: Clark, R.E. (1983). "Reconsidering Research on Learning from Media." *Review of Educational Research* 53(4):445–459 (foundational empirical demonstration of the novelty effect in learning/usability contexts). doi:10.3102/00346543053004445. Restated in HCI by Nielsen, J. "First Rule of Usability? Don't Listen to Users" (NN/g, 2001) and the broader long-term-engagement literature.

**The rule**: don't use novelty (animation, color, motion) for primary navigation or critical signals. Reserve it for genuinely-occasional events.

**Code patterns to flag**:
- Primary-action buttons with constant attention-getting animation
- Notification badges that pulse continuously
- Tutorial overlays that re-appear on every login

**Correct pattern**: subtle steady-state visuals; novelty reserved for genuinely-new states.

**Quick-fix hint**: if everything moves, motion no longer signals.
