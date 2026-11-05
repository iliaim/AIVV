# Laws of UX — Decision & Choice Architecture (HEU-LUX-*)

Part of [.aivv/standards/ux-heuristics/laws-of-ux/](README.md). 4 rules covering decision-time, choice-count, and complexity-allocation between user and system.

### HEU-LUX-hicks: Hick's Law

**Severity**: MAJOR
**Rationale**: Decision time grows logarithmically with the number of choices. Surfaces with too many options at one decision moment overwhelm the user and dilute conversion.
**Source**: https://lawsofux.com/hicks-law/

**The rule**: limit the number of competing primary actions at a single decision moment. Use progressive disclosure or grouping when more options are needed.

**Code patterns to flag**:
- Dialogs with > 1 `variant="primary"` button competing for attention
- Forms with all fields required and visible at once when staged disclosure would work
- Navigation menus with > 7 top-level items
- Settings screens with > 10 ungrouped toggles

**Correct pattern**: 1 primary CTA per screen/dialog; progressive disclosure for advanced; group settings by domain.

**Quick-fix hint**: count the things the user could click. If more than 5–7 compete for primary attention, you've overshot.

---

### HEU-LUX-occams-razor: Occam's Razor

**Severity**: POLISH
**Rationale**: Among competing designs, the simplest that satisfies requirements wins. Each added element must justify its presence.
**Source**: https://lawsofux.com/occams-razor/

**The rule**: prefer fewer elements over more. Combine concepts where they share a purpose; remove rather than add.

**Code patterns to flag**:
- Dashboards with redundant metric tiles (same data shown multiple ways)
- Forms with overlapping fields (full name + first/last name both required)
- Settings with 10 toggles where 3 + smart defaults would do

**Correct pattern**: each element earns its place; remove first, then redesign.

**Quick-fix hint**: delete one element from this surface. Did anyone lose anything? If no, it shouldn't have been there.

---

### HEU-LUX-pareto: Pareto Principle (80/20)

**Severity**: POLISH
**Rationale**: Roughly 80% of effects come from 20% of causes. In UX, 80% of usage comes from 20% of features.
**Source**: https://lawsofux.com/pareto-principle/

**The rule**: prioritize the surfaces and flows that drive most of the user's value; deprioritize the long tail.

**Code patterns to flag**:
- Equal real-estate given to high-value and rare-use features in primary navigation
- Onboarding that surfaces seldom-used capabilities before primary use cases
- Settings screens grouping rare and common toggles in the same list

**Correct pattern**: primary nav for 20% of features driving 80% of usage; settings sorted by frequency.

**Quick-fix hint**: instrument feature usage. Front-of-house should reflect real frequency.

---

### HEU-LUX-tesler: Tesler's Law (Law of Conservation of Complexity)

**Severity**: MINOR
**Rationale**: Every system has an irreducible level of complexity. The choice is whether the user or the system absorbs it. Hiding complexity in the system (smart defaults, inferred state) is usually better than exposing it to every user.
**Source**: https://lawsofux.com/teslers-law/

**The rule**: features that present configuration to the user should justify why the user — rather than the system — needs to make this decision.

**Code patterns to flag**:
- Settings screens with technical toggles that 95% of users will never adjust (and don't have sensible defaults)
- Forms requiring users to choose between technical implementations ("Use REST or GraphQL?")
- Onboarding flows where a deferrable decision is forced on first use

**Correct pattern**: smart defaults; advanced options behind progressive disclosure; "I'll decide later" affordances.

**Quick-fix hint**: every visible config option needs a real user reason. If the answer is "we couldn't decide", you absorbed too little complexity.
