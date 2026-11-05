# UI/UX — State Handling

Part of [.aivv/standards/ui-ux/](README.md) (UX-008..011).

### UX-008: Async views must render a distinct loading state

**Severity**: MAJOR
**Rationale**: A blank screen while data loads looks broken; users reload or leave.
**Source**: https://www.nngroup.com/articles/progress-indicators/

**The rule**: Any data-fetching component branches on `isLoading` and renders a skeleton, spinner, or progress bar — never the same UI as "empty results".

**Code patterns to flag**:
- `return data ? <List /> : null` with no loading branch
- A component that renders `data.map(...)` without a guard for `data === undefined`
- Loading state re-using the empty-state component (ambiguous to user)

**Correct pattern**:
```jsx
if (isLoading) return <Skeleton rows={5} />;
if (error) return <ErrorState onRetry={refetch} />;
if (!data.length) return <EmptyState ctaHref="/new" />;
return <List items={data} />;
```

**Quick-fix hint**: Use explicit `isLoading` / `error` / `isEmpty` branches; distinct UI per state.

---

### UX-009: Skeletons for full-page loads under 10s; spinners for 2-10s actions; progress bars for >10s

**Severity**: MINOR
**Rationale**: The wrong indicator misleads users about progress and perceived duration.
**Source**: https://www.nngroup.com/articles/skeleton-screens/

**The rule**: Skeletons preview layout on initial loads; spinners signal activity on short ops; progress bars show measurable progress on long ops.

**Code patterns to flag**:
- A spinner used for a determinate multi-second file upload (should be progress bar)
- A skeleton used for a non-layout operation (e.g., "deleting…")
- A spinner shown for >10s with no percentage/progress info

**Correct pattern**: Match the indicator to the operation type and known duration.

**Quick-fix hint**: If you have a byte count or step index, use a `<progress>` element.

---

### UX-010: Empty states must include a recovery / next-step CTA

**Severity**: MAJOR
**Rationale**: An empty list with no guidance strands first-time users; they leave instead of creating their first item.
**Source**: https://www.nngroup.com/videos/empty-states-in-application-design-guidelines/

**The rule**: "No results / empty" UI includes a headline, short description, and an actionable CTA (create, clear filter, invite teammates).

**Code patterns to flag**:
- `{items.length === 0 && <p>No items</p>}`
- Empty state with only an illustration and no button/link
- "No results for your search" with no "Clear filters" or "Try a different query" action

**Correct pattern**:
```jsx
<EmptyState
  title="No projects yet"
  description="Create your first project to get started."
  action={<Button onClick={openCreate}>New project</Button>}
/>
```

**Quick-fix hint**: Every empty state ships with a primary action.

---

### UX-011: Error states must offer a recovery path

**Severity**: MAJOR
**Rationale**: An error with no retry/back/contact action leaves the user stuck; they refresh blindly or bail.
**Source**: https://www.nngroup.com/articles/error-message-guidelines/

**The rule**: Error UI exposes at least one actionable affordance: retry, back, reload, contact support, or navigation home.

**Code patterns to flag**:
- `if (error) return <p>Something went wrong</p>;`
- Error boundaries that render only a message
- A toast-only error for a failed critical action with no inline retry

**Correct pattern**:
```jsx
<ErrorState
  title="Couldn't load projects"
  onRetry={refetch}
  supportHref="/help" />
```

**Quick-fix hint**: Expose `onRetry` or a visible link to unblock the user.
