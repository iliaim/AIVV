# Laws of UX — Engagement & Attention (HEU-LUX-*)

Part of [.aivv/standards/ux-heuristics/laws-of-ux/](README.md). 4 rules covering motivation, flow state, perceived polish, and selective attention.

### HEU-LUX-goal-gradient: Goal-Gradient Effect

**Severity**: POLISH
**Rationale**: Motivation increases as users approach a goal. Visualizing progress (progress bars, step counters) accelerates completion.
**Source**: https://lawsofux.com/goal-gradient-effect/

**The rule**: multi-step flows show progress; show a "head start" where authentic (e.g., "1 of 5 complete" instead of "0 of 5") to leverage early-momentum.

**Code patterns to flag**:
- Multi-step wizards without progress indicator
- Onboarding flows without completion percentage
- Long forms without "page X of Y"

**Correct pattern**: progress bar / step counter / completion percentage on flows ≥ 3 steps.

**Quick-fix hint**: if completion takes ≥ 3 actions, show the user where they are.

---

### HEU-LUX-flow: Flow

**Severity**: POLISH
**Rationale**: Flow is the optimal state of immersion where challenge matches skill. Interfaces support flow by minimizing interruptions, providing clear goals, and giving immediate feedback (Csikszentmihalyi, 1990).
**Source**: https://lawsofux.com/flow/

**The rule**: avoid breaking the user's flow with avoidable interruptions — surprise modals, unsolicited tutorials, irrelevant notifications during focused work.

**Code patterns to flag**:
- Time-based promotional modals during user editing flows
- Onboarding tooltips firing on every page load when already dismissed
- Notification badges flashing during deep-work surfaces (editor, code)

**Correct pattern**: defer non-critical interruptions; respect "do not disturb"; surface notifications quietly.

**Quick-fix hint**: the user is mid-task — does this interruption justify breaking concentration?

---

### HEU-LUX-aesthetic-usability: Aesthetic-Usability Effect

**Severity**: POLISH
**Rationale**: Users perceive aesthetically pleasing designs as easier to use, even when objective usability is equivalent (Kurosu & Kashimura, 1995). Visual polish increases tolerance for minor friction.
**Source**: https://lawsofux.com/aesthetic-usability-effect/

**The rule**: visual polish — typography rhythm, color harmony, alignment, whitespace — measurably improves perceived usability. Don't deprioritize aesthetic refinement as "not real engineering."

**Code patterns to flag**: this is a POLISH-tier observation, not a defect; surfaces that violate basic design-system tokens (off-grid spacing, off-palette color, mismatched type scale) accumulate aesthetic-usability deficit.

**Correct pattern**: design tokens enforced; spacing on a consistent scale (4 / 8 px); typographic hierarchy clear.

**Quick-fix hint**: if the surface looks unfinished, users will perceive it as harder to use even if it functions correctly.

---

### HEU-LUX-selective-attention: Selective Attention (Banner Blindness)

**Severity**: POLISH
**Rationale**: Users learn to ignore visually-prominent elements that historically don't serve their goals — banners, ads, generic pop-ups. Designs that mimic ad patterns (top banners, modal overlays, sidebar promotions) get filtered out.
**Source**: https://lawsofux.com/selective-attention/ + NN/g banner-blindness research

**The rule**: critical information shouldn't live in spaces users have learned to ignore. Place essentials inline, not in marketing-style affordances.

**Code patterns to flag**:
- Critical user-facing notifications rendered as top banners that look like marketing
- Important controls in sidebar locations historically used for ads
- Verification CTAs in patterns that match cookie-consent dismissibles

**Correct pattern**: inline critical content; reserve banners for genuinely peripheral information.

**Quick-fix hint**: if it looks like an ad, users will treat it like an ad.
