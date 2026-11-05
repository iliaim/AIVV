# Interaction States — Async Lists & Data Fetching

Part of [.aivv/standards/interaction-states/](README.md) (IS-013..018).

### IS-013: Async list must handle initial / loading / empty / populated / error

**Severity**: MAJOR
**Rationale**: Lists that render `data.map(...)` without distinguishing the four meaningful states produce confusing UX: empty arrays look like "no data" when they should look like "loading", and errors look like emptiness.
**Source**: https://www.nngroup.com/articles/empty-states/ + general data-fetching pattern

**The rule**: every async list explicitly branches on state: `loading` shows skeleton/spinner; `empty` shows empty-state with next-action; `populated` shows the list; `error` shows error with retry.

**Code patterns to flag**:
- `{data.map(item => <Row item={item} />)}` with no preceding loading/empty/error branches
- `if (data.length === 0) return null` (silent emptiness)
- Components that show emptiness as a generic "No data" with no next action

**Correct pattern**: explicit state branches: `if (loading) return <Skeleton />; if (error) return <Error onRetry={...} />; if (data.length === 0) return <EmptyState onAction={...} />; return <List ... />`.

**Quick-fix hint**: at every async-list render, can you point to the four state branches?

---

### IS-014: Empty states must guide the user toward content creation

**Severity**: MINOR
**Rationale**: Bare "No data" leaves the user without a path forward. Empty states are an opportunity to teach the system and guide first-use (Mailchimp, Shopify, Linear all model this well).
**Source**: https://www.nngroup.com/articles/empty-states/

**The rule**: empty-state UI explains (a) what the user will see when content arrives, (b) how to create the first item or trigger arrival, (c) optionally why this state happens.

**Code patterns to flag**:
- `<EmptyState>No items.</EmptyState>` (bare text, no affordance)
- "0 results" without "try a broader search"
- Empty inboxes without "you'll see new messages here" + filter affordance

**Correct pattern**: illustration + explanation + primary action (e.g., "No projects yet — create your first project").

**Quick-fix hint**: a brand-new user lands on this. What's their next action?

---

### IS-015: Loading states should match the shape of the loaded content

**Severity**: POLISH
**Rationale**: Skeleton loaders that approximate the final layout reduce perceived layout shift and content jump; generic spinners cause perceived jank when content snaps into place. CLS contribution affects Core Web Vitals.
**Source**: https://web.dev/articles/cls/ + Material Design skeleton patterns

**The rule**: for predictable layouts (lists, cards, tables), use skeleton loaders sized like the final content. For indeterminate operations (background sync), spinners are acceptable.

**Code patterns to flag**:
- Pages using a single centered spinner that snaps to a complex layout
- Skeleton elements with placeholder dimensions wildly different from real content
- List components with one centered spinner instead of N skeleton rows

**Correct pattern**: row-shaped skeleton loaders matching expected list-item dimensions; sized image placeholders.

**Quick-fix hint**: load the page on slow 3G. Does the layout snap or settle gracefully?

---

### IS-016: Stale data should be marked while refreshing

**Severity**: MINOR
**Rationale**: SWR (stale-while-revalidate) UIs that don't indicate "this data is being refreshed" leave users uncertain whether they're looking at current state. Common pattern in TanStack Query, SWR library, etc.
**Source**: https://swr.vercel.app/docs/getting-started + TanStack Query patterns

**The rule**: when re-fetching while data is already shown, surface a quiet refreshing indicator (subtle progress bar at top, dimmed-then-restored content, "Updating…" toast).

**Code patterns to flag**:
- `useQuery` / `useSWR` with `isFetching` and `isLoading` distinguished, but neither used in UI
- Background refetch on focus / interval with no UI signal
- Optimistic mutations whose pending status isn't visible

**Correct pattern**: `{isFetching && <RefreshingBar />}` at top of list; subtle dimming of stale rows.

**Quick-fix hint**: change tabs and come back. Does the UI signal that it's syncing?

---

### IS-017: Error states must offer recovery, not dead-end

**Severity**: MAJOR
**Rationale**: Error UIs without a retry path leave the user stuck — they must navigate away and back. Retry affordance is universal recovery convention (HEU-NN9).
**Source**: https://www.nngroup.com/articles/error-message-guidelines/

**The rule**: error states surface (a) what failed in plain language, (b) a retry button or alternate path forward, (c) optional support escalation.

**Code patterns to flag**:
- `<Error>` components that show only a message, no retry button
- 500/network errors that re-direct without "Try again" affordance
- Toast errors that auto-dismiss with no surfaced retry

**Correct pattern**: "Couldn't load — Retry" with retry handler; persistent error UI for severe failures.

**Quick-fix hint**: simulate a network failure. Can the user recover without refreshing the page?

---

### IS-018: Pagination must preserve scroll position on back-nav

**Severity**: MINOR
**Rationale**: Users who navigate from list page N to a detail and back expect to land on page N at the scroll position they left — common UX expectation broken by SPAs that reset state.
**Source**: GOV.UK Design System pagination + general SPA back-nav best practice

**The rule**: pagination state is preserved in URL (querystring); list-scroll position restored on back-navigation.

**Code patterns to flag**:
- Paginated lists where page number is component state only (lost on navigation)
- List components that scroll to top on every render
- Detail-back-list flows that lose filter state

**Correct pattern**: page in URL (`?page=3`); scroll restoration via history API or framework support.

**Quick-fix hint**: open page 3, click an item, hit back. Are you on page 3, scroll restored?
