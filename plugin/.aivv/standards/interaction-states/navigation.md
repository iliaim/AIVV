# Interaction States — Navigation & Routing

Part of [.aivv/standards/interaction-states/](README.md) (IS-024..026).

### IS-024: Navigation must indicate current location

**Severity**: MINOR
**Rationale**: Users who can't tell where they are within a navigation hierarchy lose orientation — recognition-over-recall (HEU-NN6) and visibility-of-system-status (HEU-NN1) violations.
**Source**: https://www.nngroup.com/articles/navigation-current-location/ + WCAG SC 2.4.8 Location

**The rule**: current navigation item is visually distinct (active state) AND signaled to assistive tech via `aria-current="page"`. Breadcrumbs render the active path on hierarchical surfaces.

**Code patterns to flag**:
- Nav `<a>` items styled identically regardless of current route
- `<NavLink>` without `aria-current` configuration
- Multi-level nav without breadcrumbs on deep pages

**Correct pattern**: active class + `aria-current="page"` on current item; breadcrumbs ≥ 2 levels deep.

**Quick-fix hint**: at any page, can you tell where you are without looking at the URL?

---

### IS-025: Back-nav must preserve form / filter state

**Severity**: MAJOR
**Rationale**: Users who navigate away from a partially-completed form and return expect their work intact. SPA back-nav that resets form state produces data loss.
**Source**: https://www.nngroup.com/articles/lost-data/ + general SPA UX best practice

**The rule**: form state and filter state survive back-navigation. URL-driven where possible (`?filter=active`); session-storage backed for in-progress forms; warning prompt on dirty-form navigation.

**Code patterns to flag**:
- Forms backed only by component state with no persistence
- Filters in component state (lost on route change)
- Navigation away from dirty forms with no `beforeunload` / framework-equivalent confirm

**Correct pattern**: filters in URL; draft state in session-storage; route-change confirm on dirty forms.

**Quick-fix hint**: fill out half the form, navigate away, come back. Is the work intact?

---

### IS-026: External links must be marked

**Severity**: MINOR
**Rationale**: Links that leave the application without indication surprise users — violating user-control (HEU-NN3) and Jakob's-Law convention (HEU-LUX-jakob, lives in `ux-heuristics/laws-of-ux/mental-models.md` per dev.69 nested retrofit).
**Source**: https://www.nngroup.com/articles/external-links-new-windows/

**The rule**: external links visually marked (icon, "External" label) and announced to assistive tech (`aria-label="External link"` or visually-hidden text). If opening in a new tab, communicate that.

**Code patterns to flag**:
- `<a href="https://other-domain.com">` with no external indicator
- `target="_blank"` without `rel="noopener noreferrer"`
- `target="_blank"` without indication ("opens in new tab")

**Correct pattern**: `<a href={url} target="_blank" rel="noopener noreferrer" aria-label="External — opens in new tab">External link <ExternalIcon aria-hidden /></a>`.

**Quick-fix hint**: would the user be surprised when this link launches a new tab or leaves the app?
