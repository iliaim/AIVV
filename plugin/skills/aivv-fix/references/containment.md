# Step 2.5 CONTAIN — immediate blast-radius reduction

Detail relocated from `skills/aivv-fix/SKILL.md` Step 2.5 CONTAIN. The inline skeleton keeps the applies-only trigger, the skip condition, and a one-line pointer. This reference is the canonical home for the containment examples, disruptive-action handling, and the right-now/when-triggered protocol.

Before spawning investigators, ask: "Is there a reversible containment action available right now?"

Containment is NOT the fix. It is a temporary measure to limit ongoing damage while the root cause is investigated.

**Examples (ordered from least to most disruptive — always prefer the least disruptive option):**
- Add an emergency guard that rejects malformed input until proper validation is implemented
- Disable a feature flag that gates the vulnerable feature
- Increase rate limits on an endpoint that is being exploited
- Revert a recent deploy to a known-good state
- Temporarily revoke a credential that may be compromised

**Important for disruptive actions (deploy revert, credential revocation):**
When recommending a containment action that itself causes service disruption, present the disruption cost alongside the recommendation — e.g., "Revoking this credential will cause [downstream service] to lose [capability] until the root-cause fix is applied." Default to the least-disruptive reversible action when multiple options exist.

**Protocol:**
1. For each CRITICAL finding, ask: "Does this affect users/data RIGHT NOW or only when triggered?"
   - If "right now" (e.g., data is actively leaking, financial transactions are wrong): surface immediately with "CONTAINMENT AVAILABLE?" prompt to user. Pause investigation until user decides on containment.
   - If "when triggered" (e.g., bug exists but hasn't been exploited): proceed to Step 3 without containment, but note the available options in the triage output.

   **When the same batch contains BOTH "right now" AND "when triggered" CRITICAL findings:**
   Surface all "right now" findings together in a single containment prompt; "when triggered" findings in the same batch proceed to Step 3 in parallel without waiting for the containment decision.

2. If the user chooses to apply a containment action:
   - Apply it immediately (it is a fix to the symptom, not the root cause).
   - Log it in `session_changes.changes_summary` with `type: "code-edit"` and `change: "CONTAINMENT: <description>. Temporary. Root cause fix follows."`.
   - Note: the Step 4.4.5 RED-GREEN TEST GATE does NOT apply to containment actions (they are intentionally symptom-level). The test gate applies to the root-cause fix that follows.

3. Proceed to Step 3 INVESTIGATE for all batches (containment does not replace investigation).
