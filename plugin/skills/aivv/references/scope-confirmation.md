# Scope Resolution - Step 3.4

Canonical procedure for resolving and announcing the exact review before any
reviewer dispatch. Every actual `/aivv` review uses this procedure, including
explicit file, idea, plan, and session reviews, and `/aivv --dry-run`.
Help, setup, config-only, eval, and maintenance routes are not reviews and do not
enter Step 3.4.

## 1. Ordering And Required Proposal

Gather the user-provided request, artifact/session context, and whatever
supporting material is available. Resolve the final scope and method, then
announce them before reviewer dispatch. A clear, explicit request for a
read-only review authorizes that review; do not ask the user to approve the same
scope and method again unless ask mode was explicitly selected. Ask when the
subject or boundaries are genuinely ambiguous, required authority is missing,
proceeding would materially expand
the requested scope, or the user explicitly selected ask mode (`--ask-scope` or
`scope_confirmation_mode: "ask"` with manual config provenance). Never broaden
scope silently.

Every proposal must make these items clear:

- **Goal and subject:** what will be reviewed and why, including the relevant
  question or review strategy for an idea, plan, or requested challenge.
- **Materials and boundaries:** which supplied conversation, files, diffs,
  plans, or other available material will be considered, and any material
  explicitly excluded. Do not imply a project-wide sweep unless the user asked
  for one.
- **Review method:** the resolved reviewer count and depth, requested/default
  lens or lenses, and replicate count or thoroughness tier when applicable.
- **Decision:** tell the user how to redirect or narrow the review if needed.

Show scope and method together in user-visible chat before dispatch, including
after an ambiguity question has been answered. A saved audit block, reviewer
prompt, or confirmation choice alone is not that announcement. State the
resolved scope, rather than only saying “confirmed” or “proceeding.”

Use a short heading and separate labeled lines or bullets, with real line
breaks. Prefer **Goal**, **Materials**, **Includes**, **Excludes**, and **Method**;
combine or omit inapplicable lines rather than filling an empty template. Keep
the review's main questions with Includes. Use plain English and the actual
reviewer count, lens, depth and requested model/reasoning settings. For example:

**Review scope**

- **Goal:** Check whether the workshop plan supports residents without a computer.
- **Materials:** `workshop-plan.md` and relevant access requirements from this chat.
- **Includes:** How those residents can attend both sessions; gaps and simpler alternatives.
- **Excludes:** Registration, internet-only barriers, staffing, and implementation.
- **Method:** 1 reviewer; general review; balanced depth; GPT-6 Luna at extra-high (`xhigh`).

For a clear request, follow this with a brief statement that the review is
starting; do not turn the announcement into another permission question or a
timed approval wait. The user can still redirect or narrow the review.

When a question is necessary, put the structured context and meaningful
alternatives in chat, then use a concise native question with matching options
and the host's custom-input control. Keep enough subject and boundary context
in the question to identify the choice. Do not assume native popups render
Markdown, tables, or preserved line breaks; the formatted chat proposal must
stand on its own. After the answer, show the resolved scope and method in the
same readable format before dispatch. Ask again only if a material ambiguity
or authority gap remains, or explicit ask mode requires confirmation.

Use the resolved values for the current invocation; the sample values are only
illustrative. `--dry-run` still performs a review and therefore uses the same
procedure. User-supplied `--lens`, configured lenses, full-* wrappers, reviewer
counts, and thoroughness affect the method shown and must be announced.

## 2. Classify The Scope And Resolve Ambiguity

Use the existing `classification_reason` values in the audit block:

- `explicit-file` for a file positional or `--plan <file>`;
- `explicit-idea` for an idea positional;
- `single-topic-session` for one coherent session topic;
- `multi-topic-session` for multiple session topics;
- `multiple-subjects` when the request or available evidence supports distinct
  plausible subjects;
- `empty-context` when the subject or enough context is missing.

`was_trivial` may describe whether the proposed subject is clear. By default, a
clear proposal from an explicit read-only review request proceeds after
announcement; there is no confirmation prompt merely because the proposal can
be restated. Honor an explicit ask-mode preference.

For a clear proposal, announce the resolved scope and method and proceed unless
the user explicitly selected ask mode; then ask once with the complete resolved
scope and method. For an ambiguous proposal, ask one concise question and offer concrete alternatives
grounded in supplied
conversation or observed material, plus custom text input. Use the host's
built-in free-text/“Other” control when available; do not require a separate
custom option if the host already supplies that control. Preserve all material
alternatives when the user narrows the proposal and show what will be left out.

Never invent candidate topics, changed-file counts, commit counts, or supporting
evidence. If there is no Git repository or the diff is empty, that is valid
context: inspect available session history and non-code materials, state what is
and is not available, and propose a review from that material. Git availability
is not a prerequisite for review.

When no usable subject is present, ask what the user wants reviewed. Do not
offer fabricated candidate subjects. Once the subject is clear, announce the
complete scope and method and proceed under the original explicit request,
unless ask mode requires the one complete scope/method confirmation.

If the user redirects or narrows scope, apply that instruction and announce the
result. If the revised request is still ambiguous, ask only about the unresolved
choice. Record excluded material in `dropped_scope` and make the exclusion
visible to reviewers.

## 3. Finalize The Method

Resolve detection-dependent lenses, reviewer count, replication, and coverage
before the scope-and-method announcement. If they remain within the user's
requested scope and authority, include the resolved method in the announcement
and proceed unless the user explicitly selected ask mode. Ask when the resulting
method would materially expand the requested scope or requires authority the
user has not granted. Never issue a lens-only question that hides a material
scope or authority change.

Detection can select lenses for the requested subject but can never expand the
requested material boundaries. Recompute relevance and coverage after a user
narrowing. Preserve explicit/configured base choices and the fixed-shape rules
in `review-shape-resolution.md`; do not inject the default lens into those lists.
Announce all permitted detection additions in the final method. Do not ask a
redundant approval question for routine method resolution unless the user
explicitly selected ask mode.

## 4. Ambiguous, Cancelled, Or Unauthorized Requests

Hold when a genuine scope/authority question remains unanswered, the user
cancels, or the user explicitly selected ask mode but the host cannot obtain a
response. Otherwise, do not hold a clear, explicitly requested read-only review
because the host lacks an interactive confirmation control; announce the
resolved scope and method and proceed. Never guess at an ambiguous subject or
use a missing answer to authorize material scope expansion.

This hold does not imply that no writes occurred: target binding, configuration
initialization, setup/walkthrough hints, or authorized preamble maintenance may
already have completed before Step 3.4. Do not claim those earlier writes were
rolled back or absent.

`--fix` does not change this gate. A held review must not enter `/aivv-fix`.

## 5. Legacy Announce Controls

`scope_confirmation_mode: "announce"` and `--auto-scope` express the normal
announce-and-proceed behavior. Honor `scope_confirmation_mode: "ask"` only
with manual config provenance, or honor per-run `--ask-scope`, as the user's
request to confirm the resolved scope/method. Treat old wizard/default `ask`
values as `announce`; do not infer a human choice from a persisted schema
default. Pre-key configs also resolve to the golden `announce` default.

No new flags or config keys are introduced. Persisted values remain readable;
scope resolution follows this procedure regardless of the saved mode.
Explicit lens-selection preferences follow `review-shape-resolution.md`; they
do not introduce a second scope-confirmation gate.

## 6. Scope And Lens Ordering

This procedure runs after available context is gathered and before dispatch.
It outputs `final_scope`; when the user narrows a proposal, it also outputs
`dropped_scope`. Reviewer prompts and final reporting must carry both so
reviewers cannot silently broaden the subject.

After scope resolution:

1. Match lens `detect_paths` and `high_risk_paths` only against paths within
   `final_scope`.
2. Recompute session lens ceilings when the requested session subset changes.
3. Preserve applicable high-risk floors for material still in scope.
4. Resolve the final method before announcing it; ask for explicit ask mode,
   material scope expansion, or missing authority.

Do not ask the user to ratify routine detection-dependent method resolution.
Keep the announcement truthful about final lens coverage and depth.

## 7. Outer-Loop Reviews

Each outer-loop `/aivv` pass is a new actual review and requires a fresh scope
and method announcement. A prior pass's `final_scope` may be a starting point,
but re-evaluate it against the current session and available material.
The outer-loop owner may pass the prior value as proposal context, but this gate
does not read outer-loop state itself.

## 8. Audit Block

For a review that actually runs, write the existing additive `scope_confirmation`
fields in `review-<id>.json`:

```text
scope_confirmation: {
  "mode",                    // resolved announce or ask policy
  "was_trivial",
  "classification_reason",   // one of the six values in Section 2
  "proposed_scope",
  "options_offered",
  "user_choice",             // "explicit-request-announced" or ambiguity resolution
  "final_scope",
  "dropped_scope",            // only when the user narrowed scope
  "suppression_reason"       // null when the review runs
}
```

Use only these existing fields; do not add approval state, scope fingerprints,
or confirmation machinery to the log. Do not write this block, calibration,
or a review log unless the resolved scope and method have been announced and
the review actually runs. The normal preamble may already have
written configuration, hints, or maintenance state as described in Section 4.
