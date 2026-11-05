# Microcopy — Loading & Progress

Part of [.aivv/standards/microcopy/](README.md) (MC-030..032).

### MC-030: Async ops over ~1 second show a loading indicator

**Severity**: MAJOR
**Rationale**: NN/g and the Doherty Threshold (Laws of UX) converge on a ~400ms perceived-instant ceiling and a ~1 second threshold beyond which users assume the system has frozen. Below 1s, a flash of loading state is more disruptive than the wait. Above 1s, no indicator = perceived freeze.
**Source**: https://www.nngroup.com/articles/response-times-3-important-limits/

**The rule**: Operations expected to exceed ~1 second show a loading state (spinner, skeleton, progress bar) within ~100ms of the trigger. Operations expected to complete under ~400ms should NOT flash a loading indicator (debounce by ~250ms before showing).

**Code patterns to flag**:
- `await fetch(...)` chains with no `setLoading(true)` and no UI consumption of pending state
- Loading state immediately rendered without delay, causing flash on fast responses

**Correct pattern**: Track `isLoading`. Show indicator after 250ms delay. Hide on response.

**Quick-fix hint**: If the user clicks and the screen sits unchanged for a full second, you've broken visibility-of-system-status (HEU-NN1).

---

### MC-031: Loading prose names what's happening, not just "Loading…"

**Severity**: MINOR
**Rationale**: "Loading…" is generic. "Saving changes…" / "Sending invitations…" / "Generating report…" tells the user what they're waiting for and confirms the action they took.
**Source**: https://material.io/design/communication/empty-states.html#illustrations

**The rule**: Loading prose for non-trivial operations names the operation. Spinner-only / "Loading…" is acceptable for screen-level transitions where the operation is implicit.

**Code patterns to flag**:
- "Loading…" used as the only loading prose on a destructive operation ("Loading…" while account-deletion runs)
- Mismatched loading prose (button says "Save" → loading prose says "Submitting" — stay consistent with the trigger verb)

**Correct pattern**: Trigger says "Save changes" → loading prose says "Saving changes…" / "Saving…" depending on space.

**Quick-fix hint**: If multiple operations use the same "Loading…", users can't tell which is in flight when something goes wrong.

---

### MC-032: Long-running ops show progress, not just "in progress"

**Severity**: MINOR
**Rationale**: Operations expected to exceed ~10 seconds should show progress (percent, X of Y items, estimated time remaining) when computable. Indeterminate spinners on long ops increase abandonment. Material Design and NN/g both recommend determinate progress when known.
**Source**: https://material.io/components/progress-indicators

**The rule**: Operations > 10 seconds with computable progress show a determinate indicator (progress bar with %, "Processing 47 of 200…", or estimated remaining time). When progress is genuinely unknowable, indeterminate spinner with descriptive prose is acceptable.

**Code patterns to flag**:
- Bulk operations (uploading many files, processing many items) with only an indeterminate spinner
- Long-running async ops with no sub-step communication

**Correct pattern**: `<ProgressBar value={done} max={total} label={`Uploaded ${done} of ${total}`} />`

**Quick-fix hint**: If you can count progress, show the count.
