# Laws of UX — Mental Models & Convention (HEU-LUX-*)

Part of [.aivv/standards/ux-heuristics/laws-of-ux/](README.md). 4 rules covering user expectations, prior-system familiarity, and input/output tolerance.

### HEU-LUX-jakob: Jakob's Law

**Severity**: MINOR
**Rationale**: Users spend most of their time on other sites. They prefer your site to work the same way as those others (Nielsen, 2000).
**Source**: https://lawsofux.com/jakobs-law/

**The rule**: when a UI primitive has an established convention (links blue + underlined, X closes a modal, primary CTA bottom-right of a dialog, hamburger = nav menu), match it unless you have a strong reason not to.

**Code patterns to flag**:
- Custom navigation that re-implements `<a href>` without keyboard or middle-click support
- Modal close icon that's not in the top-right corner
- Logo that doesn't link to the home page
- Search field placed somewhere other than the top of the page

**Correct pattern**: use platform/web conventions for primary primitives.

**Quick-fix hint**: if a familiar user habit doesn't work here, justify the deviation.

---

### HEU-LUX-postel: Postel's Law (Robustness Principle)

**Severity**: MINOR
**Rationale**: "Be conservative in what you do, be liberal in what you accept" (Postel, 1980). Inputs from users should accept varied formats; outputs should be precise.
**Source**: https://lawsofux.com/postels-law/

**The rule**: input parsing tolerates whitespace, casing, separators, and common variants. Output rendering uses canonical format.

**Code patterns to flag**:
- Phone-number input rejecting `(415) 555-0100` because regex requires `4155550100`
- Email input rejecting trailing whitespace
- Postcode input case-sensitive (rejecting `sw1a 1aa` — UK postcodes are case-insensitive)
- Date input rejecting `01/02/2026` because it expects `2026-01-02`

**Correct pattern**: normalize on receipt; render canonically; accept any unambiguous form.

**Quick-fix hint**: paste the value with weird formatting (extra spaces, mixed case, common separators). Does it work?

---

### HEU-LUX-mental-model: Mental Model

**Severity**: MINOR
**Rationale**: Users approach a system with a model of how they expect it to work, formed from prior systems and conventions. Surface behavior that matches the user's model is intuitive; behavior that diverges is friction.
**Source**: https://lawsofux.com/mental-model/

**The rule**: behaviors of common primitives (clicking, dragging, scrolling, navigating) match user expectations. Where the surface introduces a novel concept, scaffold the model explicitly.

**Code patterns to flag**:
- Click on a card that does nothing when the card visually appears clickable (border, hover state)
- Drag-and-drop that requires modifier keys without affordance
- Scroll-jacking that overrides native scroll behavior unpredictably

**Correct pattern**: consistent affordance-to-behavior mapping; explicit scaffolding for novel concepts.

**Quick-fix hint**: a user from another product opens this — what do they expect to happen? Match that.

---

### HEU-LUX-paradox-active-user: Paradox of the Active User

**Severity**: POLISH
**Rationale**: Users prefer to start using a system immediately rather than read tutorials, even when reading would speed up learning (Carroll, 1984).
**Source**: https://lawsofux.com/paradox-of-the-active-user/

**The rule**: don't gate first use behind tutorials. Provide just-in-time help; let users explore.

**Code patterns to flag**:
- Onboarding flows that block the primary task screen for >3 steps
- Mandatory video / tutorial walkthroughs before first use
- Tooltip overlays blocking interactive elements until dismissed

**Correct pattern**: optional onboarding, dismissible tooltips, just-in-time help via info-icons.

**Quick-fix hint**: a determined user clicks past the tutorial and starts using your product. Does it work?
