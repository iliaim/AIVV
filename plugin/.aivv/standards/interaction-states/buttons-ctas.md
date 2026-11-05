# Interaction States — Buttons & CTAs

Part of [.aivv/standards/interaction-states/](README.md) (IS-001..005).

### IS-001: Async-action button must render a loading state

**Severity**: MAJOR
**Rationale**: A button that triggers an async operation but doesn't visually change during the operation produces user repeat-clicks (multi-submit), perceived bugs, and visibility-of-system-status violations (HEU-NN1).
**Source**: https://www.nngroup.com/articles/visibility-system-status/ + Apple HIG buttons + Material Design progress indicators

**The rule**: every `onClick` handler that calls `await` (or returns a Promise) must surface that pending state visibly — spinner inline, button text swap, `aria-busy="true"`, or a sibling progress indicator.

**Code patterns to flag**:
- `<button onClick={async () => { await save(); }}>` with no `disabled={loading}` or pending visual
- Form submission that fires async without disabling submit
- Buttons with an `isLoading` / `pending` prop wired but no UI consuming it

**Correct pattern**: `<button disabled={loading} aria-busy={loading}>{loading ? <Spinner /> : "Save"}</button>` (or framework equivalent).

**Quick-fix hint**: from each async handler, trace forward: does any UI element render differently while the await is pending?

**See also**: **UJ-ACT-01** (`user-journey.md`) — extends IS-001 from the implementation layer (does the loading state technically render?) to the user-journey layer (did the user PERCEIVE that the action took effect?). IS-001 fires on missing loading state; UJ-ACT-01 fires on invisible activation feedback regardless of whether a loading state was used.

---

### IS-002: Async-action button must clear loading state in `finally`

**Severity**: MAJOR
**Rationale**: A button that clears `loading=false` only in the success branch leaves the user permanently locked out of the action when an error occurs, masquerading as a hung UI.
**Source**: https://react.dev/reference/react/useState + general async-handler best practice

**The rule**: every `setLoading(true)` must be paired with `setLoading(false)` in a `finally` block (or equivalent) — not in `try` alone.

**Code patterns to flag**:
- `try { await ...; setLoading(false); } catch (e) { setError(e); }` (no finally — error path leaves loading=true)
- Promise chains with `.then(() => setLoading(false))` and no `.catch().finally()`
- `useEffect(() => { fetch().then(...).then(() => setLoading(false)) }, [])` without error path

**Correct pattern**: `try { await ...; } catch (e) { setError(e); } finally { setLoading(false); }`.

**Quick-fix hint**: any pending state must clear regardless of outcome — success, failure, or aborted.

---

### IS-003: Disabled buttons must communicate why

**Severity**: MINOR
**Rationale**: A button that's disabled with no explanation forces the user to guess the precondition. Disabled-state alone violates recognition-over-recall (HEU-NN6).
**Source**: https://www.nngroup.com/articles/disabled-buttons-usability/

**The rule**: when a button is disabled, surface why — inline help text, tooltip on hover/focus, or pre-condition checklist nearby.

**Code patterns to flag**:
- `<button disabled={!isValid}>Save</button>` with no inline text explaining what's invalid
- Submit buttons disabled when form has empty required fields with no per-field error
- Action buttons disabled by permissions check with no "you need X to do this" message

**Correct pattern**: `<Tooltip when={disabled} content={reason}><button disabled>...</button></Tooltip>` or inline disabled-reason prose.

**Quick-fix hint**: a disabled button without explanation is a riddle. Solve it for the user.

---

### IS-004: Destructive button must require explicit confirmation

**Severity**: MAJOR
**Rationale**: Destructive operations (delete, remove, archive, drop) executed on a single click are user-control and freedom violations (HEU-NN3); they generate one of the most-reported support categories.
**Source**: https://www.nngroup.com/articles/confirmation-dialog/

**The rule**: any operation labeled `Delete` / `Remove` / `Drop` / `Erase` / `Wipe` / `Discard` (or causing irreversible state change) requires either: (a) typed-confirm gate, (b) two-step click with explicit second confirm, or (c) post-action time-bounded undo toast. Single-click execution is forbidden.

**Code patterns to flag**:
- `<button onClick={() => deleteItem(id)}>Delete</button>` with no confirm or undo
- Bulk-delete affordances without summary confirmation ("Delete 47 items?")
- Account-deletion buttons with no typed-confirm or password re-prompt

**Correct pattern**: typed-confirm for high-stakes; undo toast for routine destructive; password re-prompt for account-level.

**Quick-fix hint**: for every destructive verb, ask: how does the user reverse this if it was a misclick?

---

### IS-005: Focus state must be visible on all interactive controls

**Severity**: MAJOR
**Rationale**: Removing or suppressing the focus ring breaks keyboard navigation entirely for keyboard / screen-reader users — violating WCAG SC 2.4.7 (L1 legal/safety floor).
**Source**: https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html

**The rule**: never use `outline: none` or `:focus { outline: 0 }` without providing an equivalent `:focus-visible` ring. Custom focus styles must be visible against any background the control renders against.

**Code patterns to flag**:
- `outline: none` or `outline: 0` in any rule for `:focus` without a sibling `:focus-visible` with a visible ring
- `:focus { box-shadow: none }` overriding a default focus shadow
- `tabindex="-1"` on interactive controls (removes from keyboard nav entirely)

**Correct pattern**: `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }`.

**Quick-fix hint**: tab through your UI without a mouse. Does every interactive element show a focus indicator?

**See also**: **VVT-063** (`visual-verification-triggers/state-interaction.md`) — runtime-verification trigger when code adds or modifies `:focus-visible` rules; this rule defines the interaction-state-inventory policy for focus visibility, VVT-063 flags when code changes warrant runtime check. **VVT-066** (`visual-verification-triggers/css-styling.md`) — runtime-verification trigger when code adds `appearance: none` on form controls; stripping UA chrome removes the native focus ring and the custom replacement must satisfy this rule's all-controls policy.
