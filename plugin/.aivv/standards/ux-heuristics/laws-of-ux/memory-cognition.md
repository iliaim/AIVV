# Laws of UX — Memory & Cognition (HEU-LUX-*)

Part of [.aivv/standards/ux-heuristics/laws-of-ux/](README.md). 7 rules covering working-memory limits, cognitive load, recall asymmetry, and incompletion-bias.

### HEU-LUX-millers: Miller's Law

**Severity**: MINOR
**Rationale**: Working memory holds approximately 7 ± 2 items (Miller, 1956). Lists, menus, and grouped controls beyond this limit incur cognitive load and increase error rate.
**Source**: https://lawsofux.com/millers-law/

**The rule**: chunk information into groups of 5–9 items. Long lists need pagination, search, or hierarchical grouping.

**Code patterns to flag**:
- Dropdown menus with > 9 ungrouped options
- Form sections with > 7 fields not grouped into subsections
- Phone-number / credit-card inputs as a single 16-character field (no chunking)

**Correct pattern**: typeahead search for long enums; grouped form sections; chunked input format (4-4-4-4 for credit cards).

**Quick-fix hint**: count items. > 9 ungrouped → group, paginate, or chunk.

**See also**: **UJ-DISC-04** (`user-journey.md`) — keyword recall without in-context hint. Miller's Law directly grounds UJ-DISC-04: command palettes and search bars that require keyword recall compete with the user's ~7±2 working memory capacity; in-context hints (suggestions, placeholder text) reduce that load.

---

### HEU-LUX-working-memory: Working Memory

**Severity**: MINOR
**Rationale**: Working memory is limited (Baddeley, ~4 chunks under interference); UI should minimize the load.
**Source**: https://lawsofux.com/working-memory/

**The rule**: present information at the moment of need; don't require users to remember context across screens.

**Code patterns to flag**:
- Multi-screen flows where decision context lives only on a prior screen
- Dialogs that hide the underlying data the user is acting on
- Search results that drop the search query from view

**Correct pattern**: persistent context (sticky breadcrumb / panel); inline reference; modal renders backing data.

**Quick-fix hint**: same as recognition-over-recall — don't ask the user to memorize.

---

### HEU-LUX-chunking: Chunking

**Severity**: MINOR
**Rationale**: Grouping related information into chunks reduces cognitive load by leveraging working memory more efficiently (Miller, Cowan).
**Source**: https://lawsofux.com/chunking/

**The rule**: long sequences of digits/characters/items are chunked into meaningful groups (phone numbers, credit cards, IDs).

**Code patterns to flag**:
- 16-digit credit card input as a single field (no auto-formatting to 4-4-4-4)
- License plates / verification codes shown as unbroken strings
- Long IDs (UUIDs, transaction codes) shown without chunking when the user might need to read them aloud

**Correct pattern**: format-on-render and format-on-type for chunked sequences.

**Quick-fix hint**: if the user has to read it aloud or copy by hand, chunk it.

---

### HEU-LUX-cognitive-load: Cognitive Load

**Severity**: MINOR
**Rationale**: Cognitive load is the amount of mental effort needed to use an interface. Excess load reduces task success and increases abandonment.
**Source**: https://lawsofux.com/cognitive-load/

**The rule**: minimize extraneous load (visual noise, unnecessary decisions); structure germane load (decision support, learning); accept intrinsic load (the inherent complexity of the task).

**Code patterns to flag**:
- Dashboards rendering all metrics, charts, filters at once (no progressive disclosure)
- Forms with conditionally-shown fields all visible regardless of state
- Decision flows that mix several unrelated concerns on one screen

**Correct pattern**: progressive disclosure; conditional rendering of dependent fields; one purpose per screen.

**Quick-fix hint**: count the active decisions on this screen. > 3? Split.

---

### HEU-LUX-peak-end: Peak-End Rule

**Severity**: POLISH
**Rationale**: Users judge experiences largely by the most-intense moment (peak) and the final moment (end), not the average (Kahneman, 1993).
**Source**: https://lawsofux.com/peak-end-rule/

**The rule**: design endings carefully — success states, error recovery, completion screens. They disproportionately shape memory of the experience.

**Code patterns to flag**:
- Success flows ending with bare "OK" — no celebration, no next-action affordance
- Error recovery endings that don't reassure ("you're back on track")
- Onboarding that ends abruptly without "you're ready"

**Correct pattern**: thoughtful success states (illustration, summary, next action); error endings affirm recovery.

**Quick-fix hint**: how does the flow end? That's what the user will remember.

---

### HEU-LUX-serial-position: Serial Position Effect

**Severity**: POLISH
**Rationale**: Items at the start (primacy) and end (recency) of a list are remembered better than middle items (Murdock, 1962).
**Source**: https://lawsofux.com/serial-position-effect/

**The rule**: place the most important items at the beginning or end of lists/menus; deprioritize middle slots.

**Code patterns to flag**:
- Primary navigation with the most-used item buried in the middle
- Settings screens with critical controls in the middle of long lists
- Form sections where required fields are interleaved with optional middle fields

**Correct pattern**: primary actions first or last; required-first then optional in forms.

**Quick-fix hint**: in a 7-item list, items 3–5 are the weakest slots. Use them for low-priority items.

---

### HEU-LUX-zeigarnik: Zeigarnik Effect

**Severity**: POLISH
**Rationale**: Incomplete tasks are remembered better than completed ones (Zeigarnik, 1927). This bias can be leveraged for engagement (progress trackers, draft saves) or, used poorly, becomes anxiety-inducing.
**Source**: https://lawsofux.com/zeigarnik-effect/

**The rule**: surface in-progress work explicitly (drafts, saved-for-later); offer clear closure to avoid Zeigarnik anxiety.

**Code patterns to flag**:
- Forms that save draft state implicitly without surfacing it ("you have a draft" missing)
- Wizards that allow exit without "you can resume from here" affordance
- Long-running operations without visible status (user remembers they "left something running")

**Correct pattern**: explicit drafts list; resumable flow markers; status visible for in-flight work.

**Quick-fix hint**: if the user leaves mid-flow, will they know how to come back?
