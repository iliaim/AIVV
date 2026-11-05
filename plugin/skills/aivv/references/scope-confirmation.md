# Scope Confirmation Gate - Step 3.4

Canonical procedure for proposing and confirming the exact review before any
reviewer dispatch. Every actual `/aivv` review uses this gate, including explicit
file, idea, plan, and clear single-topic session reviews, and `/aivv --dry-run`.
Help, setup, config-only, eval, and maintenance routes are not reviews and do not
enter Step 3.4.

## 1. Ordering And Required Proposal

Gather the user-provided request, artifact/session context, and whatever
supporting material is available. Then present the review proposal and obtain
confirmation before lens detection, reviewer dispatch, calibration, review-log
writing, or `/aivv-fix` handoff. Do not perform the review while confirmation is
pending.

Every proposal must make these items clear:

- **Goal and subject:** what will be reviewed and why, including the relevant
  question or review strategy for an idea, plan, or requested challenge.
- **Materials and boundaries:** which supplied conversation, files, diffs,
  plans, or other available material will be considered, and any material
  explicitly excluded. Do not imply a project-wide sweep unless the user asked
  for one.
- **Review method:** the resolved reviewer count and depth, requested/default
  lens or lenses, and replicate count or thoroughness tier when applicable.
- **Decision:** a clear way to confirm, change, or enter a custom scope.

Show scope and method together so the user can judge the actual proposed
review. Keep a clear proposal short. For example:

```text
Proposed review
Goal: assess whether the cache change preserves correct invalidation.
Subject: this session's cache work.
Materials: the cache-related session context and the available changed files; other project areas are excluded.
Questions: invalidation correctness, failure cases, and simpler alternatives.
Method: 1 reviewer; general lens; balanced depth.
[Confirm this review] / [Change scope] / [Enter a custom scope]
```

Use the resolved values for the current invocation; the sample values are only
illustrative. `--dry-run` still performs a review and therefore uses the same
gate. User-supplied `--lens`, configured lenses, full-* wrappers, reviewer
counts, and thoroughness affect the method shown but do not waive confirmation.

## 2. Classify The Proposal And Ask

Use the existing `classification_reason` values in the audit block:

- `explicit-file` for a file positional or `--plan <file>`;
- `explicit-idea` for an idea positional;
- `single-topic-session` for one coherent session topic;
- `multi-topic-session` for multiple session topics;
- `multiple-subjects` when the request or available evidence supports distinct
  plausible subjects;
- `empty-context` when the subject or enough context is missing.

`was_trivial` may describe whether the proposed subject is clear, but even a
clear proposal always requires confirmation. There is no trivial-scope bypass.

For a clear proposal, use one short confirmation prompt with choices such as
`[Confirm this review]`, `[Change scope]`, and custom text input. For an
ambiguous proposal, offer a few concrete alternatives grounded in supplied
conversation or observed material, plus custom text input. Use the host's
built-in free-text/“Other” control when available; do not require a separate
custom option if the host already supplies that control. Preserve all material
alternatives when the user narrows the proposal and show what will be left out.

Never invent candidate topics, changed-file counts, commit counts, or supporting
evidence. If there is no Git repository or the diff is empty, that is valid
context: inspect available session history and non-code materials, state what is
and is not available, and propose a review from that material. Git availability
is not a prerequisite for review.

When no usable subject is present, ask the user what they want reviewed. Do not
offer fabricated candidate subjects. After the user supplies a subject, present
the complete scope-and-method proposal and ask for confirmation.

Selecting an exact displayed option that represents a complete review proposal
or `[Confirm this review]` confirms that proposal and records any excluded
material. `[Change scope]`, custom-text entry, cancel, or hold options request
revision or stop the review; they do not approve dispatch. An unambiguous
textual affirmation such as “yes,”
“confirm,” or “proceed with that review” also confirms the exact proposal just
shown. Do not treat a preselected option, missing answer, silence, or canceled
prompt as a submitted confirmation. A custom scope or new interpretation is
not yet confirmation: echo the interpreted goal, subject, materials,
boundaries, relevant question/strategy, and method, then ask the user to confirm
that complete proposal before proceeding. If a custom scope narrows the
proposal, explicitly retain the dropped material in `dropped_scope` and make
the exclusion visible to the user and reviewers.

## 3. Reconfirm A Changed Method

The initial proposal uses explicit and configured review shape before
scope-filtered lens detection. After confirmation, apply detection and any
scope-dependent reviewer-depth rules. If the final detected lenses, reviewer
count, replication, or coverage differs from the method the user confirmed,
show the final scope and the changed method together and obtain confirmation
before dispatch. If the user rejects that final proposal, keep the review
pending and offer a revised scope/method for confirmation; never proceed under
the earlier confirmation after changing the proposal. The existing
lens-consent prompt may serve this purpose only when it shows the complete
final scope and method; do not ask a lens-only question that hides a scope or
depth change.

Detection can select lenses for the confirmed subject but can never expand the
confirmed material boundaries. Recompute relevance and coverage after a user
narrowing. Preserve explicit/configured base choices and the fixed-shape rules
in `review-shape-resolution.md`; do not inject the default lens into those lists.
Any permitted detection additions still require the changed-method confirmation
above. If the final method is unchanged, do not ask a redundant second question.

## 4. Pending, Cancelled, Or Unavailable Confirmation

If the initial scope proposal is not confirmed, is canceled, receives no answer,
or the host cannot obtain an interactive response, hold the review before lens
detection. If the post-detection final scope/method proposal is not confirmed,
hold after detection but before reviewer dispatch. In either case, do not fall
back to announce-and-proceed or non-interactive best-guess behavior, and stop
before reviewer dispatch, calibration, review-log writing, and fix handoff.
Tell the user which complete proposal is waiting for confirmation.

This hold does not imply that no writes occurred: target binding, configuration
initialization, setup/walkthrough hints, or authorized preamble maintenance may
already have completed before Step 3.4. Do not claim those earlier writes were
rolled back or absent.

`--fix` does not change this gate. A held review must not enter `/aivv-fix`.

## 5. Legacy Announce Controls

`scope_confirmation_mode: "announce"` and `--auto-scope` remain readable for
backward-compatible parsing, but both are deprecated. Warn that the setting or
flag is deprecated and normalize it to `ask` for this invocation. They do not
skip or weaken confirmation, and there is no “don't ask again” choice. The
ordinary `--ask-scope` flag also means the required confirmation behavior; it is
not needed to make confirmation happen.

No new flags or config keys are introduced. Persisted `announce` values may
remain in existing files until the user changes them; resolution must still
warn and require confirmation on every actual review.

## 6. Scope And Lens Ordering

This gate runs after available context is gathered and before lens detection.
It outputs `final_scope`; when the user narrows a proposal, it also outputs
`dropped_scope`. Reviewer prompts and final reporting must carry both so
reviewers cannot silently broaden the subject.

After confirmation:

1. Match lens `detect_paths` and `high_risk_paths` only against paths within
   `final_scope`.
2. Recompute session lens ceilings when the confirmed session subset changes.
3. Preserve applicable high-risk floors for material still in scope.
4. Resolve the final method and reconfirm it under Section 3 if its coverage or
   depth changed from the proposal.

Do not combine pre-confirmation scope selection with detection-dependent lens
consent. The final review method is confirmed only after any detection-based
changes are visible.

## 7. Outer-Loop Reviews

Each outer-loop `/aivv` pass is a new actual review and requires a new scope and
method confirmation. A prior pass's `final_scope` may be shown as a proposed
starting point, but it is never approval for the next pass. Re-evaluate it
against the current session and available material; do not reuse confirmation
based on scope overlap or suppress the prompt because the paths look similar.
The outer-loop owner may pass the prior value as proposal context, but this gate
does not read outer-loop state itself.

## 8. Audit Block

For a review that actually runs, write the existing additive `scope_confirmation`
fields in `review-<id>.json`:

```text
scope_confirmation: {
  "mode",                    // "ask" after resolving legacy announce values
  "was_trivial",
  "classification_reason",   // one of the six values in Section 2
  "proposed_scope",
  "options_offered",
  "user_choice",             // confirmed option or accepted custom interpretation
  "final_scope",
  "dropped_scope",            // only when the user narrowed scope
  "suppression_reason"       // null for a confirmed review; no suppressed review runs
}
```

Use only these existing fields; do not add approval state, scope fingerprints,
or confirmation machinery to the log. Do not write this block, calibration,
or a review log unless the initial scope and any changed final method have been
confirmed and the review actually runs. The normal preamble may already have
written configuration, hints, or maintenance state as described in Section 4.
