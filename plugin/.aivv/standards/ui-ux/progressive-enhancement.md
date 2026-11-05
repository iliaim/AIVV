# UI/UX — Progressive Enhancement

Part of [.aivv/standards/ui-ux/](README.md) (UX-027..029).

### UX-027: Forms target a real `action` / server handler, not only JS

**Severity**: MAJOR
**Rationale**: JS-only form submission breaks on script errors, network blips, or users with JS disabled (corporate firewalls, mobile data savers). Progressive enhancement preserves function.
**Source**: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Sending_and_retrieving_form_data

**The rule**: Server-rendered / non-SPA apps ship a working `<form action method>` that POSTs to a real handler; JS enhances it (client validation, inline loading) but doesn't replace it.

**Code patterns to flag**:
- `<form onSubmit={e => { e.preventDefault(); ... }}>` with no `action` attribute in a server-rendered page
- `<button type="button">` inside a form where the intent is "submit"
- Server actions / form endpoints that only accept JSON/XHR, not standard form-encoded POST

**Correct pattern**:
```jsx
<form action="/api/contact" method="post" onSubmit={enhance}>
  …
  <button type="submit">Send message</button>
</form>
```

**Quick-fix hint**: Add `action` + `method`; enhance with JS, don't replace.

---

### UX-028: Error message copy must use forward-looking framing

**Severity**: MAJOR
**Rationale**: Backward-looking framing ("Could not...", "Failed to...") front-loads failure and increases user anxiety. Forward-looking framing ("{Action} didn't go through — try again") leads with context and points toward recovery, reducing abandonment. Modern UX writing guidelines (Shopify Polaris, GOV.UK, Material Design) consistently recommend this pattern.
**Source**: https://polaris.shopify.com/content/error-messages
**See also**: [`forms.md` UX-005](forms.md) (specific/plain-language requirement), [`ux-microcopy.md` UX-021](ux-microcopy.md) (plain-language vs codes/hostile wording).

**The rule**: Error messages displayed to users must use forward-looking framing. The sentence should lead with what the user was doing (context), state what happened briefly, and end with what to do next. Avoid starting with "Could not", "Failed to", "Unable to", or "Cannot". Drop "please" from action instructions (filler — GOV.UK Content Design). Drop "contact support" from toast messages (dead-end for transient errors; acceptable only in inline blocking errors for account/payment issues).

**Code patterns to flag**:
- Error messages starting with `"Could not"`, `"Failed to"`, `"Unable to"`, `"Cannot"`
- `"Please try again"`, `"Please check"` — drop "please" from action prompts
- `"contact support"` in toast notification descriptions (acceptable in inline error components for blocking errors)
- Messages that describe only the failure without any recovery action

**Correct pattern**:
```
// Forward-looking: context → outcome → action
"Your resume didn't save — try again."
"Cover letter generation hit a snag — try again in a few seconds."
"Too many requests — wait a moment, then retry."

// NOT:
"Could not save your resume. Please try again."
"Failed to generate cover letter. Please try again, or contact support."
```

**Quick-fix hint**: Restructure to `"{Context} didn't {verb} — {action}."` Drop "Could not" / "Failed to" / "please" / "contact support" from toast messages.

---

### UX-029: Transient errors should attempt silent auto-retry before surfacing to the user

**Severity**: MAJOR
**Rationale**: Top SaaS products (Linear, Figma, Slack) silently auto-retry transient failures (network errors, 5xx, timeouts) before showing any error to the user. Showing an error on first failure for a transient issue wastes the user's attention on problems that resolve themselves. Users should only see an error when recovery genuinely requires their action.
**Source**: Industry pattern observed in Linear, Figma, Slack, Notion (2024-2026)

**The rule**: API calls that encounter transient failures (5xx status codes, network `TypeError: Failed to fetch`, timeout/`AbortError`) should attempt at least one silent retry with brief exponential backoff before surfacing an error to the user. This applies to both queries (TanStack Query built-in retry) and mutations (wrapper/helper retry). Non-transient errors (4xx validation, auth, payment) must NOT be retried — the same input will produce the same failure.

**Code patterns to flag**:
- `fetch()` or API call with immediate error toast/display on first failure, without any retry logic, for operations that could encounter transient server errors
- TanStack Query config with `retry: false` globally (suppresses built-in query retry for transient errors)
- Mutation `onError` that directly shows a toast without checking if the error is transient and retryable

**Correct pattern**:
```typescript
// Query: let TanStack Query retry transient errors silently
retry: (failureCount, error) => failureCount < 2 && isTransientError(error)

// Mutation: one silent retry before showing error
async function mutateWithRetry(fn, onError) {
  try { await fn(); }
  catch (err) {
    if (isTransientError(err)) {
      try { await fn(); return; } // Silent retry succeeded
      catch (retryErr) { err = retryErr; }
    }
    onError(err); // Show error only after retry exhausted
  }
}
```

**Quick-fix hint**: Wrap transient mutation errors in a single silent retry. Enable TanStack Query's built-in retry for queries. Only surface errors after retries are exhausted.
