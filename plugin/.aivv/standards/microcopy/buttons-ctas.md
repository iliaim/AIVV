# Microcopy — Buttons & CTAs

Part of [.aivv/standards/microcopy/](README.md) (MC-006..010).

### MC-006: Buttons start with verbs that describe the specific action

**Severity**: MAJOR
**Rationale**: "OK" / "Submit" / "Yes" / "Cancel" don't tell the user what will happen. Specific verbs ("Save changes", "Delete account", "Send invitation") confirm intent and prevent miss-clicks. NN/g found that specific button labels reduce dialog-abandonment by ~25% in usability tests.
**Source**: https://www.nngroup.com/articles/ok-cancel-or-cancel-ok/

**The rule**: Primary action buttons start with a verb that names the action AND, when ambiguity is possible, the object of the action. "Save" alone is acceptable when the object is unambiguous in context; "Save changes" / "Save draft" / "Save and exit" are better when the surface allows multiple save modes.

**Code patterns to flag**:
- `<button>OK</button>`, `<button>Submit</button>`, `<button>Yes</button>`, `<button>No</button>` as the only label on a primary action
- `<button>Continue</button>` when there are 2+ "continue" branches in the flow (which one?)
- Icon-only buttons (`<button><Icon /></button>`) without `aria-label`

**Correct pattern**: `<button>Save changes</button>` / `<button>Send invitation</button>` / `<button aria-label="Delete project">…</button>`

**Quick-fix hint**: Replace generic verbs with the verb the user would say if asked "what does this button do?"

**See also**: **I18N-STR-10** (`i18n/strings.md`, "Message keys use stable namespaced identifiers") — MC-006 governs the English source-text verb choice for action buttons; I18N-STR-10 governs the key-naming convention (`button.save` rather than `button.save_changes_v2`). The two rules compose: MC-006 picks the verb wording, I18N-STR-10 ensures the key identifier survives wording iterations.

---

### MC-007: Destructive action buttons name the consequence, not just the verb

**Severity**: MAJOR
**Rationale**: "Delete" alone doesn't tell the user what will be deleted. When the deletion is irreversible, the button label is the user's last guard against accidental loss. Apple HIG and Material Design both require the deletion target be named.
**Source**: https://developer.apple.com/design/human-interface-guidelines/writing#Buttons

**The rule**: Buttons that delete, archive, cancel-with-loss, or otherwise destroy data name the specific object affected: "Delete project", "Cancel subscription", "Archive 12 messages", not bare "Delete" / "Cancel" / "Archive".

**Code patterns to flag**:
- `<button>Delete</button>` in a destructive-confirmation modal (the modal title may name the object, but the button itself is what users click; many users skim past the title)
- `<button>Cancel</button>` used as the destructive action (also conflicts with the conventional "cancel = abort this dialog, no harm done" meaning of `Cancel`)
- Confirmation buttons that say "Yes" / "Confirm" without restating the action

**Correct pattern**: `<button>Delete project</button>` / `<button>Cancel subscription and lose access</button>` / `<button>Archive 12 messages</button>`

**Quick-fix hint**: If a user clicks this by accident, the button label should make them notice in the half-second before the action completes.

---

### MC-008: Reserve "Cancel" for "abandon this dialog without changes"

**Severity**: MAJOR
**Rationale**: "Cancel" has a stable conventional meaning across operating systems and the web: dismiss the current dialog, do not commit any pending change, no destructive side-effect. Using "Cancel" as the verb for a destructive action (canceling a subscription, canceling an order) collides with the convention and produces double-take confusion.
**Source**: https://www.nngroup.com/articles/ok-cancel-or-cancel-ok/

**The rule**: The button labeled "Cancel" closes the dialog. If the destructive action is "cancel a subscription", label that button "Cancel subscription" or "End subscription" — the qualifier disambiguates from the dismiss-dialog convention.

**Code patterns to flag**:
- A modal with `<button>Cancel</button>` (dismiss) + `<button>Cancel</button>` (the destructive action) on the same screen
- Standalone "Cancel" buttons that perform a destructive operation without confirmation

**Correct pattern**: Pair "Cancel" (dismiss) with the action's specific verb ("Save", "Delete project", "End subscription").

**Quick-fix hint**: If the button does anything other than close-without-changes, do not label it "Cancel".

---

### MC-009: One primary CTA per screen / dialog / form

**Severity**: MINOR
**Rationale**: Visually competing primary CTAs ("Save AND Cancel both styled `variant="primary"`") destroy the visual signal that primary buttons are supposed to carry. Hick's Law operationalized: one obvious primary action reduces decision time.
**Source**: https://www.nngroup.com/articles/cta-buttons/

**The rule**: Within a single rendered screen, dialog, or form, exactly one button is `variant="primary"`. Secondary actions are `variant="secondary"` / `variant="ghost"` / `variant="link"`.

**Code patterns to flag**:
- Two or more `<Button variant="primary">` rendered in the same modal or form subtree
- Side-by-side "Save" and "Cancel" both styled as filled/colored primary buttons

**Correct pattern**: `<Button variant="primary">Save changes</Button>` + `<Button variant="ghost">Cancel</Button>`

**Quick-fix hint**: Ask "if the user could only click one of these, which would it be?" — that's the primary. Everything else is secondary.

---

### MC-010: Button labels in sentence case (not Title Case, not ALL CAPS)

**Severity**: POLISH
**Rationale**: Sentence case ("Save changes") matches the predominant casing convention used in major web design systems (Polaris, Atlassian, Material 3, GOV.UK). ALL CAPS for full words reduces legibility for users skimming UI and reads as shouting in conversational contexts; established UX-writing guidance reserves ALL CAPS for short single-word labels at most.
**Source**: https://polaris.shopify.com/content/grammar-and-mechanics

**The rule**: Button labels use sentence case by default. Title Case is acceptable only when the project's design system or brand guideline mandates it. ALL CAPS is acceptable as a *visual treatment* (CSS `text-transform: uppercase`) for short single-word labels in some design systems, but the source string itself should be sentence case so screen readers don't spell it.

**Code patterns to flag**:
- `<button>Save Changes</button>` / `<button>SAVE CHANGES</button>` (with no design-system mandate)
- ALL CAPS in the source string rather than via CSS

**Correct pattern**: `<button>Save changes</button>` (with optional `text-transform: uppercase` in CSS if visual style demands).

**Quick-fix hint**: Default to sentence case unless the design system explicitly says otherwise.
