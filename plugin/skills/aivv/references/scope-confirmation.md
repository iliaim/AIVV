# Scope Resolution

Resolve the review subject and material boundaries before lens detection or reviewer dispatch. The user's request authorizes a review of the subject it clearly names; do not ask for a second approval of an already clear request.

Help, setup, config-only, eval, and maintenance routes are not reviews and do not use this procedure.

## Resolve the scope

1. Use the request and available in-scope context to identify the goal, primary subject, material to inspect, and requested question or strategy. Do not imply a project-wide sweep unless requested.
2. If the subject and boundaries are clear and `--ask-scope` is absent, briefly state the resolved scope and method, then continue. This applies to explicit files, plans, ideas, clear session topics, and `--dry-run`.
3. Ask one concise question only when unresolved ambiguity could materially change the subject, included materials, exclusions, or review method. Offer a few evidence-backed options and allow custom text. If no usable subject is present, ask what the user wants reviewed.
4. Use the user's answer as the resolved scope. If material ambiguity remains, ask only about it and hold dispatch until it is resolved. When `--ask-scope` is explicit, present the resolved proposal once and wait for approval; otherwise do not echo it back for confirmation.

Never invent candidate subjects, changed-file counts, commit counts, or supporting evidence. Git availability is not required for a review; use available session history or non-code material and state material limitations.

## Keep scope and method bounded

Lens detection may select relevant review criteria only within the resolved subject and material boundaries. It must not expand the review to paths or topics outside the user's request.

Preserve explicit reviewer, lens, replication, and thoroughness choices. Lens detection owns consent for non-obvious ceiling additions in `lens_detection_mode: ask`. Separately ask before reviewer cost or provider egress materially exceeds the request. Do not use these choices to reopen an already clear scope. Follow `review-shape-resolution.md` for assignment and floor rules.

Legacy `scope_confirmation_mode: "announce"` and `--auto-scope` remain readable, warn, and normalize to `ask`; neither bypasses clarification for material ambiguity or approval for an unauthorized method change. `--ask-scope` explicitly requests approval of the resolved proposal for this run.

## Pending or unavailable answers

If a necessary clarification or explicitly requested approval is canceled, unanswered, or unavailable from the host, hold before reviewer dispatch, calibration, review-log writing, and `/aivv-fix` handoff. Do not guess across a material boundary. Target binding, configuration initialization, setup hints, or authorized preamble maintenance may already have run; do not claim those writes were rolled back or absent.

## Record the resolved scope

For a review that runs, write the existing `scope_confirmation` fields in `review-<id>.json`:

```text
scope_confirmation: {
  "mode",                    // resolved mode; legacy announce normalizes to ask
  "was_trivial",
  "classification_reason",   // explicit-file, explicit-idea, single-topic-session,
                              // multi-topic-session, multiple-subjects, or empty-context
  "proposed_scope",
  "options_offered",          // [] when no clarification was needed
  "user_choice",              // "request-scope" or the user's actual answer
  "final_scope",
  "dropped_scope",            // only when the user narrowed scope
  "suppression_reason"        // null for a review that ran
}
```

Do not add confirmation machinery or new review-log fields. Omit the block on early exits, voided reviews, or a hold before scope is resolved.

## Outer-loop reviews

Each outer-loop pass re-evaluates the current subject and material against the initiating request. Reuse that authorization while the subject and boundaries remain within it; ask again only if a material expansion or new ambiguity requires a user decision. Do not treat old paths as in scope automatically.
