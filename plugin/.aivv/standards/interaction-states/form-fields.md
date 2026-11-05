# Interaction States — Form Fields & Inputs

Part of [.aivv/standards/interaction-states/](README.md) (IS-006..012).

### IS-006: Form fields must support all standard states

**Severity**: MINOR
**Rationale**: A `<input>` without explicit handling for `disabled`, `readonly`, `required`, validation, and submission states leads to missing-state defects discovered post-launch.
**Source**: https://design-system.service.gov.uk/components/text-input/

**The rule**: form-field components handle the full state inventory: `empty | typing | valid | invalid | disabled | readonly | submitting | submitted`. Each state has an explicit visual treatment.

**Code patterns to flag**:
- Custom `<Field>` components with no `disabled` prop pass-through to underlying `<input>`
- `<input>` styling that doesn't change on `:disabled` (looks active when it isn't)
- Forms where submit-in-flight state isn't reflected on inputs (user can edit during submit)

**Correct pattern**: comprehensive state styling; submit-in-flight disables editable fields.

**Quick-fix hint**: enumerate the states your field can be in. Does the rendering distinguish each?

---

### IS-007: Validation errors must display inline at the field

**Severity**: MAJOR
**Rationale**: Errors aggregated at form-bottom or top force users to scan-and-locate, especially painful on long forms. Inline-at-field is the established convention for error recovery (HEU-NN9).
**Source**: https://www.nngroup.com/articles/errors-forms-design-guidelines/ + WCAG SC 3.3.1

**The rule**: validation errors render adjacent to the offending field with `aria-describedby` linkage. Optionally also summarized at top with anchor links to fields.

**Code patterns to flag**:
- `<Form>` with errors rendered only as a top-of-form list, no inline indicators
- Toast-only error display for form validation (no per-field association)
- Error messages that reference fields by index ("error in field 3") instead of by label

**Correct pattern**: inline error below field + `aria-describedby` linking input to error; optional summary at top with anchor links.

**Quick-fix hint**: a user with 12 fields and one error — how quickly can they locate the offending field?

---

### IS-008: Validation must run after first interaction, not on render

**Severity**: MAJOR
**Rationale**: Showing required-field errors on initial render — before the user has had any chance to interact — is hostile error-prevention violation (HEU-NN5). Users perceive the system as accusatory before they've made any mistake.
**Source**: https://www.nngroup.com/articles/inline-validation-web-forms/

**The rule**: validation triggers on blur (after user has finished a field) or on submit (after user has expressed completion intent). Real-time validation acceptable for username availability and password strength only.

**Code patterns to flag**:
- `<Field error={!value}>` where `error` is true on initial render
- Form components passing `errors` from props on mount before any interaction
- `useEffect(() => validate(formState), [formState])` running on mount

**Correct pattern**: `touched` flag per field, errors only shown when `touched && invalid`; or errors-on-submit pattern.

**Quick-fix hint**: load the form. Are there any error indicators visible before you've interacted with any field?

---

### IS-009: Forms must guard against double-submit

**Severity**: MAJOR
**Rationale**: A form whose submit button is not disabled during async submit allows the user to multi-click, producing duplicate writes — a data-integrity defect.
**Source**: https://web.dev/forms/ + general async-submit pattern

**The rule**: on form submit, the submit button is disabled until the submit completes (success or error). Submit handler is idempotent or guarded against re-entry.

**Code patterns to flag**:
- `<form onSubmit={async () => { await save() }}>` with no submitting-state pattern
- Submit button without `disabled={submitting}`
- Forms with `<button type="submit">` and `<form onSubmit>` neither checking re-entry

**Correct pattern**: disable submit during in-flight; or use submission-id idempotency on the server.

**Quick-fix hint**: rage-click the submit button. Does the server receive multiple writes?

---

### IS-010: Long-running forms must surface progress

**Severity**: MINOR
**Rationale**: Submit operations exceeding ~3 seconds with no progress indication trigger Doherty-threshold violation (HEU-LUX-doherty, lives in `ux-heuristics/laws-of-ux/timing-perception.md` per dev.69 nested retrofit) and user re-click.
**Source**: https://lawsofux.com/doherty-threshold/

**The rule**: submit operations expected to take >3s show progress (spinner, progress bar, "Uploading 3 of 5 files…").

**Code patterns to flag**:
- File-upload submit with no progress percentage
- Multi-stage submit (e.g., create + send notification + log) without staged feedback
- Forms doing >1s of client-side work before submit without "Preparing…" state

**Correct pattern**: progress UI scaled to operation duration; staged updates for multi-stage.

**Quick-fix hint**: under realistic latency, how long does the user wait? Add progress at the right granularity.

---

### IS-011: Password fields must support show/hide toggle

**Severity**: MINOR
**Rationale**: Hidden password fields prevent users from verifying their input — a common cause of failed login. Show/hide toggle (eye icon) is established convention.
**Source**: https://www.nngroup.com/articles/stop-password-masking/

**The rule**: password fields offer a show/hide toggle. The toggle is keyboard-operable and announced to screen readers.

**Code patterns to flag**:
- `<input type="password">` with no associated show/hide control
- Show/hide implemented as click-only (no keyboard handler) or with no aria-label

**Correct pattern**: `<button aria-pressed={showing} onClick={toggle} aria-label="Show password">👁</button>` adjacent to input.

**Quick-fix hint**: a user with a complex password — can they verify it before submitting?

---

### IS-012: Autofocus must be used sparingly

**Severity**: MINOR
**Rationale**: Autofocus moves focus without user request, breaking screen-reader linear-read context and surprising keyboard users. Only acceptable on dedicated single-purpose surfaces (login page, search page).
**Source**: https://design-system.service.gov.uk/get-started/labels-legends-headings/

**The rule**: autofocus only on surfaces whose sole purpose is a single primary input (login form, search dialog, modal with single field). Multi-field forms should not autofocus.

**Code patterns to flag**:
- `<input autoFocus>` on the first field of a multi-field form
- Modal dialogs autofocusing fields when the modal has multiple primary actions
- Pages autofocusing inputs that aren't the page's sole purpose

**Correct pattern**: autofocus only on single-input surfaces; otherwise, leave focus to the user.

**Quick-fix hint**: a screen-reader user lands on this page. Does autofocus help or disrupt?
