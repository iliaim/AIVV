# Microcopy — Empty States

Part of [.aivv/standards/microcopy/](README.md) (MC-022..025).

### MC-022: Empty states explain what the user will see + how to create the first item

**Severity**: MAJOR
**Rationale**: A bare "No data" tells the user nothing. Effective empty states explain (a) what populates this surface normally, (b) the action the user can take to create the first item. NN/g's empty-state research correlates well-designed empty states with ~30% higher first-action conversion.
**Source**: https://www.nngroup.com/articles/empty-state-interface-design/

**The rule**: Every empty list/table/grid has at least: a one-sentence explanation of what would normally appear, and a primary CTA (or instruction if no CTA is appropriate) for creating the first item.

**Code patterns to flag**:
- `{data.length === 0 && <p>No data</p>}` — minimal empty state with no context or CTA
- `<EmptyState message="Nothing here" />` — same pattern, slightly nicer phrasing, still missing the first-action prompt
- Empty states that only render an illustration with no text

**Correct pattern**:
```jsx
{projects.length === 0 && (
  <EmptyState
    title="No projects yet"
    description="Projects organize your work into shareable boards."
    cta={<Button>Create your first project</Button>}
  />
)}
```

**Quick-fix hint**: An empty state should make a first-time user understand the feature in 5 seconds.

---

### MC-023: Empty states for filter/search results explain "what didn't match"

**Severity**: MINOR
**Rationale**: A bare "No results" after a search leaves users unsure whether they typed the query wrong, the data doesn't exist, or the system failed. Naming the query in the empty state confirms the system received and processed the input.
**Source**: https://www.nngroup.com/articles/search-no-results/

**The rule**: Empty states for filtered/searched lists name the active filter or query and offer a clear "clear / reset" affordance.

**Code patterns to flag**:
- `{filtered.length === 0 && <p>No results</p>}` after a non-empty search query
- Empty states that don't offer a "clear filters" action

**Correct pattern**: `{filtered.length === 0 && <p>No results for "{query}". <button onClick={clear}>Clear search</button></p>}`

**Quick-fix hint**: The user should see "I searched for X" reflected in the empty-state copy.

---

### MC-024: Distinguish "you have no X yet" from "this list is empty for now (try later)"

**Severity**: POLISH
**Rationale**: Persistent empty state ("you've never created any projects") and transient empty state ("no notifications today") are different states with different affordances. Confusing them — implying permanence when the state is transient — frustrates users.
**Source**: https://www.shopify.com/polaris/components/empty-state

**The rule**: Persistent empty states focus on "create the first one". Transient empty states focus on "what would normally appear" and optionally a refresh affordance.

**Code patterns to flag**:
- Notification trays that say "No notifications yet" in a tone implying the user has never received any, when really they've cleared today's
- Activity feeds that conflate "no activity in this time range" with "no activity ever"

**Correct pattern**: "All caught up — no new notifications today." vs. "You don't have any projects yet. Create your first one."

**Quick-fix hint**: Will this empty state ever populate without user action? If yes, "for now" framing. If no, "create the first" framing.

---

### MC-025: Don't dead-end the user — empty states have a path forward

**Severity**: MINOR
**Rationale**: An empty state with no actionable affordance (no CTA, no clear-filter, no help link) is a dead end. The user is told "nothing here" and given nothing to do.
**Source**: https://material.io/design/communication/empty-states.html

**The rule**: Empty states offer at least one of: (a) a primary CTA to create the missing content, (b) a clear-filter / reset affordance, (c) a link to documentation or support, (d) a refresh action for transient empty states.

**Code patterns to flag**: Empty states that render only text/illustration with no interactive element.

**Correct pattern**: Pair every empty state with the most-relevant single action.

**Quick-fix hint**: After reading the empty state, the user should know what button to click next.
