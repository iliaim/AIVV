# Microcopy — Confirmations & Destructive Actions

Part of [.aivv/standards/microcopy/](README.md) (MC-026..029).

### MC-026: Destructive-confirmation prose names the object and the consequence

**Severity**: CRITICAL
**Rationale**: Confirmation dialogs are the user's last guard before irreversible action. Generic "Are you sure?" prose is a leading cause of accidental data loss in productivity apps. CRITICAL severity here is set by the orchestrator's 4-pass severity inference Pass 1 (Blast-radius — data-integrity / data-loss override tone and L4-source default), NOT by the cited L4 sources alone — Apple HIG and Material Design both document the object+consequence naming requirement, but the CRITICAL floor comes from the data-loss blast-radius category, not from those sources' authority class.
**Source**: https://developer.apple.com/design/human-interface-guidelines/alerts

**The rule**: Destructive confirmations include (a) the specific object affected (named, not "this"), (b) the consequence (irreversible? affects others?), (c) a button labeled with the destructive verb + object (per MC-007).

**Code patterns to flag**:
- `<Dialog>Are you sure?</Dialog>` (no object, no consequence)
- `confirm("Delete?")` (browser-native confirm with no specifics)
- Confirmation prose that uses pronouns ("Delete this?") instead of names

**Correct pattern**: "Delete project Acme? This will permanently remove all 47 tasks and 12 comments. This cannot be undone." with `<Button>Delete project</Button>` + `<Button variant="ghost">Cancel</Button>`.

**Quick-fix hint**: Read the confirmation aloud without the surrounding context. Does it identify what gets deleted and why it matters?

---

### MC-027: Confirm destructive actions; don't gate non-destructive actions

**Severity**: MAJOR
**Rationale**: Over-confirmation ("Are you sure you want to save?") trains users to dismiss confirmations reflexively, which then defeats the protection on actually-destructive actions. Confirmations are protection budget — spend them on irreversibility.
**Source**: https://www.nngroup.com/articles/confirmation-dialog/

**The rule**: Reserve confirmations for: irreversible deletes, account-affecting changes (cancel subscription, change email/password), bulk operations affecting > N items, financial transactions. Do NOT confirm: save, send, regular form submission, navigation.

**Code patterns to flag**:
- Confirmation modals on `Save` / `Submit` actions
- "Are you sure?" gates on read-only actions or single-item edits

**Correct pattern**: Save without confirmation; offer undo for the recent action instead.

**Quick-fix hint**: If the action is reversible within ~10 seconds via an undo affordance, drop the confirmation.

---

### MC-028: Offer undo for reversible destructive actions when possible

**Severity**: MAJOR
**Rationale**: Per Schneiderman's golden rule SCH6 (easy reversal of actions) and Nielsen's heuristic NN9 (help users recover from errors), undo is preferable to confirm for actions that can be reversed within a soft-delete or transactional window. Gmail's "undo send" is the canonical example.
**Source**: https://www.nngroup.com/articles/undo/

**The rule**: When the system can soft-delete and reverse, offer post-action undo (toast with `Undo` button, persistent for ~5-10s) instead of pre-action confirmation. Use confirm-then-act only when reversal is impossible.

**Code patterns to flag**:
- Confirm dialogs on actions where the underlying system supports soft-delete and reversal
- Hard-delete + confirmation when soft-delete would suffice

**Correct pattern**: Toast: "Project Acme archived. Undo (5)" with a 5-second window before commit.

**Quick-fix hint**: Can the action be undone within 10 seconds? Use undo. Can't? Use confirm.

---

### MC-029: Confirmation buttons re-state the destructive action

**Severity**: MAJOR
**Rationale**: A confirmation modal whose primary button reads "Yes" / "Confirm" / "OK" loses the protection effect — users skim past the modal title and click whatever's on the right. Re-stating the verb on the button forces a second look.
**Source**: https://www.nngroup.com/articles/ok-cancel-or-cancel-ok/

**The rule**: The destructive button in a confirmation dialog uses the same verb-and-object form as the trigger button (per MC-007). The cancel button (per MC-008) closes the dialog without action.

**Code patterns to flag**:
- Confirmation modals with `<Button>Yes</Button>` / `<Button>Confirm</Button>` as the primary action
- Mismatched verbs between the trigger and the confirmation (trigger says "Delete project", confirmation says "Continue")

**Correct pattern**: Trigger says "Delete project" → confirmation modal's primary button also says "Delete project". Same verb, same object.

**Quick-fix hint**: If the confirmation button could be on any modal in your app, it's too generic.
