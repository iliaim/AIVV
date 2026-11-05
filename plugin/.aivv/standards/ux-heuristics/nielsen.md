# UX Heuristics — Nielsen's 10 Usability Heuristics (HEU-NN1..NN10)

Part of [.aivv/standards/ux-heuristics/](README.md).

### HEU-NN1: Visibility of system status

**Severity**: MAJOR
**Rationale**: Users need feedback that the system received their input and is working on it. Silent UIs leave the user wondering whether the click registered, leading to repeat-clicks, abandonment, or perceived bugs. NN/g's first heuristic — universally validated.
**Source**: https://www.nngroup.com/articles/visibility-system-status/

**The rule**: every async operation that takes longer than ~1 second must surface state — a pending indicator (spinner, skeleton, progress bar), an optimistic UI update, or a status message — before the response arrives.

**Code patterns to flag**:
- `await fetch(...)` / `await mutation(...)` without preceding `setLoading(true)` (or framework equivalent) read by a UI branch
- `<button onClick={handler}>` where `handler` calls `await` but the button has no `disabled={loading}` or pending visual
- `<form onSubmit={async ...}>` without inline submission state
- `useEffect(() => { fetch(...) }, [])` mounted on a route without skeleton or spinner placeholder

**Correct pattern**: pending state set before the await, consumed by a UI branch (`{loading ? <Spinner /> : <Result />}`), cleared in a `finally` block.

**Quick-fix hint**: trace each `await` from the handler to the JSX. If no UI element changes during the awaited window, you have a visibility-of-system-status violation.

**See also**: **UJ-ACT-01** (`user-journey.md`) — extends HEU-NN1 to the user-journey layer: did the user PERCEIVE the change (not just did a loading state technically render). **UJ-ACT-02** — feedback exists but off-screen. **UJ-ACT-03** — pre/post visually indistinguishable.

---

### HEU-NN2: Match between system and the real world

**Severity**: MINOR
**Rationale**: Users carry mental models from physical and conventional digital systems. Surfaces that use developer jargon ("HTTP 500", "null reference", "deserialization failure") instead of user-meaningful language force translation work and increase abandonment.
**Source**: https://www.nngroup.com/articles/match-system-real-world/

**The rule**: copy uses words, phrases, and concepts familiar to the target user. Order content to follow real-world conventions (date pickers show calendars, not Unix timestamps; address fields follow postal-format ordering; file pickers show files, not paths).

**Code patterns to flag**:
- Error strings echoing exception class names (`ValidationError: required`, `AxiosError: 500`)
- Status codes shown to end-users (`Error 422`, `HTTP 500 — try again`) without translation
- Timestamps rendered in ISO 8601 / Unix-epoch in user-facing surfaces
- Programming concepts in labels ("array index", "primary key", "string length")

**Correct pattern**: "Email is required", "We couldn't reach the server — try again", "Saved 2 minutes ago".

**Quick-fix hint**: if the copy would only make sense to someone reading the code, rewrite it for the person reading the screen.

---

### HEU-NN3: User control and freedom

**Severity**: MAJOR
**Rationale**: Users make mistakes and change their minds. Surfaces that lock the user into a flow without escape — modals without close, multi-step wizards without back, destructive actions without undo — produce frustration and trust loss. Undo is the canonical signal of control.
**Source**: https://www.nngroup.com/articles/user-control-and-freedom/

**The rule**: every flow has a clearly marked exit (close, cancel, back) that returns the user to a known prior state without loss of in-progress work. Destructive actions (delete, archive, send) provide either a confirmation step or a time-bounded undo.

**Code patterns to flag**:
- `<Dialog>` / `<Modal>` without an explicit close affordance (X button, Cancel button, Esc key handler)
- Multi-step wizards without a Back button or with a Back button that resets prior steps
- `await deleteItem(id)` immediately following the click handler with no confirmation gate or undo toast
- Form submission that navigates away without a confirmation when fields are dirty

**Correct pattern**: modal closes via Esc + click-outside + X; wizards preserve step state; destructive actions show "Deleted — Undo (8s)" toast.

**Quick-fix hint**: imagine the user clicked by accident. Can they recover? If not, you have a freedom violation.

**See also**: **UJ-TFS-02** (`user-journey.md`) — multi-step undocumented sequence with no breadcrumb. HEU-NN3 covers back-navigation and undo; UJ-TFS-02 flags when a multi-step feature provides no next-step prompting or progress indicator, leaving a zero-knowledge user stuck.

---

### HEU-NN4: Consistency and standards

**Severity**: MINOR
**Rationale**: Users transfer learning across surfaces. When a primitive behaves one way on screen A and another way on screen B, every encounter incurs a re-learning tax. Cross-product consistency (Jakob's Law — see HEU-LUX-jakob, lives in `laws-of-ux/mental-models.md` per dev.69 nested retrofit) is even more powerful: matching established platform conventions reduces the user's expected-vs-actual gap.
**Source**: https://www.nngroup.com/articles/consistency-and-standards/

**The rule**: identical primitives behave identically across the product. Where the product can match a platform/web convention (links are blue and underlined, primary CTA is bottom-right of a dialog, X closes), it should.

**Code patterns to flag**:
- Two `<Button variant="primary">` instances with different click-feedback patterns in the same flow
- A custom navigation control that re-implements `<a href>` semantics without keyboard support
- One screen using "Save" / another using "Submit" / another using "Confirm" for the same conceptual action
- Modal close icon swapped between X and ← on different dialogs in the same surface

**Correct pattern**: shared primitive components, single source of truth for vocabulary, design-system tokens.

**Quick-fix hint**: if a primitive differs across two screens for no reason a user would understand, unify it.

---

### HEU-NN5: Error prevention

**Severity**: MAJOR
**Rationale**: Recovering from an error is more expensive than preventing it. Inputs that cannot be invalid (constrained widgets, sensible defaults, clear pre-conditions) eliminate whole classes of error states. Confirmation dialogs are a last-resort prevention; better to make the error impossible.
**Source**: https://www.nngroup.com/articles/slips/

**The rule**: design inputs and flows so the easy path is the correct path. Use constrained inputs (date pickers vs. free text, dropdowns vs. typed enums) where a valid set is finite. Apply guard-rails before commit (disabled-until-valid, format-on-blur, server-side echo).

**Code patterns to flag**:
- Free-text `<input>` for a finite-set field (country, state, currency, status enum)
- Form `<button type="submit">` not `disabled` while required fields are empty
- Dangerous mutations (account deletion, irreversible payment) without typed-confirm gate
- Input fields without `pattern` / `min` / `max` / `step` constraints when the domain has them

**Correct pattern**: typed dropdown for enums; submit button gated on validity; "Type ACME to confirm" for high-stakes deletes.

**Quick-fix hint**: ask, *"what is the smallest set of valid inputs?"* — then constrain the widget to that set.

---

### HEU-NN6: Recognition rather than recall

**Severity**: MINOR
**Rationale**: Working memory is limited (Miller's Law, ~7 items). Surfaces that require users to remember information from a previous step (memorize a code, retain a context, re-derive a state) impose cognitive load. Showing the information in-context (recognition) is far cheaper than asking the user to retrieve it (recall).
**Source**: https://www.nngroup.com/articles/recognition-and-recall/

**The rule**: relevant information is visible or easily retrievable at the moment of decision. Don't make the user remember things across screens.

**Code patterns to flag**:
- Multi-step flows where prior step values aren't summarized on the next step
- Search results without breadcrumbs / context of "what you searched for"
- Forms that clear on validation error, forcing re-entry
- Selectors / dropdowns showing only IDs ("user-7142") without resolved labels

**Correct pattern**: persistent breadcrumbs; review-step summary; sticky filters; resolved labels for foreign keys.

**Quick-fix hint**: at any decision moment, can the user see the context that decision depends on without scrolling, navigating, or remembering?

**See also**: **UJ-DISC-01** (`user-journey.md`) — no visible entry point (MAJOR). **UJ-DISC-02** — unmarked keyboard shortcut only. **UJ-DISC-03** — hover-only reveal. **UJ-DISC-04** — keyword recall without in-context hint. The UJ-DISC-* family operationalizes HEU-NN6 at the feature-discovery layer rather than at the in-surface information layer.

---

### HEU-NN7: Flexibility and efficiency of use

**Severity**: POLISH
**Rationale**: Different users have different proficiencies. Surfaces that provide accelerators for power users (keyboard shortcuts, bulk operations, saved presets) without burdening novices respect both audiences.
**Source**: https://www.nngroup.com/articles/flexibility-efficiency/

**The rule**: provide shortcuts for repeated tasks where the cost of authoring them is low. Keyboard handlers, bulk-action affordances, search filters, and saved-state defaults are common accelerators.

**Code patterns to flag**:
- Long-list interfaces (>20 items) without keyboard shortcut affordance, bulk-select, or filter
- Repeated form completion (e.g., line-item entry) without "duplicate previous row" or saved presets
- Search without recent-searches or saved-searches affordance in a search-heavy surface

**Correct pattern**: keyboard map (`?` / Cmd+K), bulk select with shift-click, saved filters, recent searches.

**Quick-fix hint**: trace the path of a user who'd run this flow 100 times — what would they ask for?

**See also**: **UJ-DISC-02** (`user-journey.md`) — unmarked keyboard shortcut that supplements an existing affordance (the shortcut is an accelerator, not the sole entry point). HEU-NN7 covers keyboard shortcuts as accelerators for expert users; UJ-DISC-02 flags when the accelerator shortcut is not visible/discoverable (no tooltip, no legend) so first-time users miss it. When the shortcut IS the sole entry point, escalate to UJ-DISC-01.

---

### HEU-NN8: Aesthetic and minimalist design

**Severity**: POLISH
**Rationale**: Each additional element on a surface dilutes the salience of every other element (signal-to-noise ratio). Decorative or rarely-needed information competes with primary actions for the user's attention.
**Source**: https://www.nngroup.com/articles/aesthetic-minimalist-design/

**The rule**: surfaces include only the elements needed at this decision point. Secondary information lives behind progressive disclosure (tooltip, expandable section, secondary screen).

**Code patterns to flag**:
- Dashboards rendering >7 distinct widgets at the top of the viewport (Miller's Law violation)
- Marketing copy on transactional screens (e.g., promotional banners on checkout)
- Decorative imagery in form-completion flows

**Correct pattern**: foreground = primary task, background = supporting context, progressive disclosure for advanced.

**Quick-fix hint**: remove an element. Did the user lose anything important? If no, it shouldn't have been there.

---

### HEU-NN9: Help users recognize, diagnose, and recover from errors

**Severity**: MAJOR
**Rationale**: Errors are inevitable. The cost of an error is largely the recovery cost, which depends on whether the user understands what happened, why, and what to do next. NN/g's error-message guidelines specify human-readable language, plain-English explanation, and a clear next action.
**Source**: https://www.nngroup.com/articles/error-message-guidelines/

**The rule**: error messages identify the problem in plain language, explain (briefly) the cause when relevant, and propose a constructive next action. Generic "Something went wrong" is an anti-pattern.

**Code patterns to flag**:
- `catch (e) { setError("Error") }` with a static one-word error
- Error toasts that show stack traces or HTTP error names
- Form validation errors without per-field positioning ("Please fix errors above")
- 404 / 500 pages without a "Go to home" / "Try again" / "Contact support" affordance

**Correct pattern**: "We couldn't save your changes — check your connection and try again" + retry button.

**Quick-fix hint**: read each error message aloud and ask: *what do I do now?* If the answer is unclear, rewrite.

---

### HEU-NN10: Help and documentation

**Severity**: MINOR
**Rationale**: Even well-designed systems need explanation for complex flows, edge cases, or domain-specific terms. Help should be findable, task-focused, and concrete.
**Source**: https://www.nngroup.com/articles/help-and-documentation/

**The rule**: in-context help (tooltips, info-icons, expandable sections) for non-obvious fields and complex flows; searchable docs for deeper guidance; never surface arbitrary documentation that the user has to wade through to find a single answer.

**Code patterns to flag**:
- Form fields with domain-specific terms (e.g., "Tax ID", "EIN", "VAT") without an info-icon or example
- Settings screens with technical toggles ("Enable HSTS", "ACME challenge mode") without inline explanation
- Dashboards with metric labels using internal jargon without definition

**Correct pattern**: `<label>VAT number <InfoIcon tip="Your value-added tax registration ID, e.g. GB123456789" /></label>`.

**Quick-fix hint**: a new user lands on this surface — can they complete the task without leaving the page? What would they need to know?
