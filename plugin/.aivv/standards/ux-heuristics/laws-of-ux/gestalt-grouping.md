# Laws of UX — Gestalt & Visual Grouping (HEU-LUX-*)

Part of [.aivv/standards/ux-heuristics/laws-of-ux/](README.md). 6 rules covering Gestalt visual-perception principles — proximity, similarity, common region, uniform connectedness, prägnanz, and isolation.

### HEU-LUX-prox: Law of Proximity

**Severity**: MINOR
**Rationale**: Objects near each other are perceived as related (Gestalt principle). Spatial grouping communicates relationship without explicit borders or labels.
**Source**: https://lawsofux.com/law-of-proximity/

**The rule**: related controls, fields, and information are spatially grouped; unrelated content has visible separation.

**Code patterns to flag**:
- Forms where related fields (street + city + ZIP) have the same spacing as unrelated sections
- Card grids where related and unrelated cards have identical gaps
- Toolbar buttons grouped by visual position but not by function

**Correct pattern**: tighter spacing within groups, looser between groups; spacing scale used consistently.

**Quick-fix hint**: the spacing should tell you what goes with what without reading the labels.

---

### HEU-LUX-similarity: Law of Similarity

**Severity**: MINOR
**Rationale**: Visually similar objects are perceived as belonging together (Gestalt). Color, shape, size, texture can signal grouping.
**Source**: https://lawsofux.com/law-of-similarity/

**The rule**: similar visual treatment for similar functions (all destructive actions red; all primary CTAs same shape/color); don't apply identical treatment to functionally different items.

**Code patterns to flag**:
- Two buttons with identical styling that perform different categories of action (one navigates, one mutates)
- Similar icon shapes representing different concepts in the same surface
- Same color used for both informational and warning state

**Correct pattern**: visual treatment correlates with function category.

**Quick-fix hint**: at a glance, do similar visuals indicate similar function? If not, fix the styling or fix the grouping.

---

### HEU-LUX-common-region: Law of Common Region

**Severity**: MINOR
**Rationale**: Elements within a clearly defined boundary are perceived as a group (Gestalt, Palmer 1992).
**Source**: https://lawsofux.com/law-of-common-region/

**The rule**: borders, background tints, and cards group elements. Use shared region to clarify relationships when proximity isn't enough.

**Code patterns to flag**:
- Cards or panels containing visually-related elements without shared container
- Form sections without visual grouping (no fieldset, no panel, no border)
- Settings groups where toggles drift apart visually

**Correct pattern**: cards / panels / fieldsets group related primitives.

**Quick-fix hint**: a region tells the user "these things go together."

---

### HEU-LUX-uniform-connectedness: Law of Uniform Connectedness

**Severity**: POLISH
**Rationale**: Visually connected elements (lines, shared backgrounds, matched borders) are seen as more related than just-similar elements.
**Source**: https://lawsofux.com/law-of-uniform-connectedness/

**The rule**: where relationships matter, use connecting visual elements (process arrows, table rows, list bullets, breadcrumb separators).

**Code patterns to flag**:
- Multi-step flows without visual connection between steps (steps look isolated)
- Related metrics rendered in separate cards without shared visual language

**Correct pattern**: explicit connectors for sequence; shared visual language for related groups.

**Quick-fix hint**: when sequence or relationship matters, draw it.

---

### HEU-LUX-pragnanz: Law of Prägnanz

**Severity**: POLISH
**Rationale**: People perceive ambiguous or complex images in their simplest form (Gestalt).
**Source**: https://lawsofux.com/law-of-pragnanz/

**The rule**: prefer simple, clean shapes and layouts. Visual complexity is interpreted as functional complexity.

**Code patterns to flag**:
- Layouts with overlapping panels, irregular shapes, complex grids
- Decorative borders / shadows / textures that add visual noise without function
- Logos / icons with high-frequency detail at small render sizes

**Correct pattern**: clean rectilinear layouts; minimal decoration; legible at all sizes.

**Quick-fix hint**: squint at the surface. The structure should still be legible.

---

### HEU-LUX-von-restorff: Von Restorff Effect (Isolation Effect)

**Severity**: POLISH
**Rationale**: An item that visually differs from its surroundings is more likely to be noticed and remembered (von Restorff, 1933).
**Source**: https://lawsofux.com/von-restorff-effect/

**The rule**: differentiate the primary action visually from secondary actions. Color, size, weight, position can all signal hierarchy. Don't differentiate everything — that's just noise.

**Code patterns to flag**:
- Multiple primary-styled buttons on the same surface
- Important actions styled identically to noise
- Status indicators (success / warning / error) using identical visual weight

**Correct pattern**: one visually distinct primary; secondary muted; tertiary text-only.

**Quick-fix hint**: if everything is highlighted, nothing is highlighted.
