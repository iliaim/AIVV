# Scope Confirmation Gate - Step 3.4

MUST-READ when `/aivv` reaches Step 3.4. The gate establishes `final_scope`
before lens composition and prompt construction.

## 1. Triviality Classifier

Announce without prompting when scope is deterministic:

- Explicit file-path positional.
- Explicit quoted idea positional; truncate long idea to <=80 chars + `...`.
- Single coherent session topic with cohesive diff.

Classify as non-trivial when any trigger holds:

1. `multi_topic == true` from Step 2.
2. Uncommitted diff plus a separate specific session artifact/topic with no
   positional override.
3. Empty or insufficient context from Step 2 banner.

"Diff spans unrelated areas / very large" is not a v1 trigger. When uncertain,
prefer non-trivial and ask.

## 2. Modes (`scope_confirmation_mode`)

| Mode | Behavior |
|---|---|
| `ask` (default) | Trivial -> announce. Non-trivial -> prompt. |
| `announce` | Always announce resolved best-guess scope; never prompt. |

There is no `off` mode; announcements are the baseline transparency guarantee.

Precedence:

1. Explicit positional file/idea: always trivial announcement.
2. `--auto-scope` / `--ask-scope`: force announce / ask for this run.
3. `scope_confirmation_mode` preference.
4. Session-review classifier.

`--fix` is orthogonal except for non-interactive suppression below.

## 3. Ask-mode Consent UX

For non-trivial scope in `ask`, use one prompt. Lead with AIVV's conclusion and
offer at most four concrete choices:

```text
I'll review this session's work on auth + the locale refactor (8 files, 3 commits). Confirm, or adjust?
[both topics - recommended] / [just the auth changes] / [just the locale refactor] / [edit - type a scope] / [don't ask again - announce mode]
```

Cap singleton narrow options at N <= 3 topics; beyond that, use `[edit - a custom subset]`.

Empty-context cases:
- 0 candidates: `"I don't see anything to review yet - pass a file path, an idea, or --maintenance."` with `[edit]` only.
- >=2 candidates, no clear winner: `"I see a few possibilities - which should I review?"` plus concrete options.

`[edit]` typed scope:
1. Validate against the resolved-scope universe.
2. Empty/no-match: re-prompt once with path/topic guidance.
3. Multiple-match: normalize to matched set and announce.
4. Second failure hard-fails immediately; never silently review garbage scope.

### `[don't ask again - announce mode]`

This choice requires a second-turn confirmation. On confirm, persist exactly
`scope_confirmation_mode: "announce"` to user scope (`~/.aivv/config.json`), not
project scope. If a config file exists, upgrade the write shape to
`schema_version: 6`, preserve known values, set the mode, and write atomically.
On failure, emit `scope-confirmation-persist-failed`, continue this invocation in
transient announce mode, and leave persisted preference unchanged. Record
`user_choice: "dont-ask-again-announce"` in the review log's
`scope_confirmation` block.

Reversal paths: `/aivv --config-set scope_confirmation_mode=ask --user`,
`/aivv --setup`, or per-run `--ask-scope`.

## 4. Announcements And Narrowing

Examples:

- File: `Reviewing `src/foo.ts``
- Idea: `Challenging the idea: <80-char idea>`
- Session: `Reviewing this session's work on <topic> - 8 files changed, 3 commits since last review`

When the user narrows scope, exclusion must be visible:

```text
Reviewing this session's work on locale - 4 files, 1 commit.
⚠ Not reviewed: the auth changes (4 files, 2 commits) - narrowed from your selection.
```

Inject `final_scope` and any `dropped_scope` into the Step 4 prompt scope/header
so the reviewer and final output reflect the narrowed scope. High-risk lens
floors still apply to remaining in-scope paths.

## 5. Lens Recompute

Step 3.4 runs after path gathering and before lens composition. After any scope
adjustment:

1. Re-match `detect_paths`/`high_risk_paths` against `paths ∩ final_scope.paths`.
2. Re-apply lens relevance if the session subset changed.
3. Preserve the high-risk floor for in-scope security/compliance paths.

Do not batch scope and lens questions: the lens question depends on the confirmed
scope, so it would be stale if asked in the same prompt.

## 6. Non-interactive / Autonomous Contexts

Use `fallback_prompt_skipped_non_interactive` and `capability_degradations`.

| Condition | Behavior |
|---|---|
| Trivial | Announce and proceed. |
| Non-trivial + `ask` + non-interactive | Cannot prompt: announce best guess, proceed, set `suppression_reason: "non-interactive"`, and emit suppression notice at gate and run-summary footer. |
| `announce` mode | Announce and proceed. |
| `--fix` + non-trivial + non-interactive + `ask` | Suppress fix-chain. Set `scope_fix_chain_suppressed = true`; announce best guess, run review, write log, and emit: `"scope ambiguous and unconsented; fix-chain suppressed - re-run with an explicit scope or --auto-scope to proceed"` at gate and summary. |

Scope suppression escapes: `announce` mode, `--auto-scope`, or interactive
confirmation. Step 8 consequence gates still apply.

## 7. Per-session Outer-loop Suppression

After `final_scope` is established, return it to the outer-loop owner as
`scope_confirmation.final_scope`. This gate is input-only for outer-loop state:
it MUST NOT read, create, update, or delete
`<state_dir>/outer-loop-<root_review_id>.json`. The owner defined by
`.aivv/outer-loop.md` records the value during its normal state write. On cycle
1, use the current `invocation_id` as the root id when passing this input.

On cycle N>=2, consume `prior_scope_confirmation_final_scope` supplied by the
outer-loop owner before Step 3.4 and announce:

```text
continuing with confirmed scope: X (re-run with --ask-scope to revisit)
```

Invalidate and re-trigger the gate if:

```text
|cycle-N diff.paths ∩ final_scope.paths| / max(|cycle-N diff.paths|, 1) < 0.5
```

## 8. Audit Block

Write additive `scope_confirmation` data in `review-<id>.json`:

```text
scope_confirmation: {
  "mode",                    // "ask" | "announce"
  "was_trivial",
  "classification_reason",   // "explicit-file" | "explicit-idea" | "single-topic-session" | "multi-topic-session" | "multiple-subjects" | "empty-context"
  "proposed_scope",
  "options_offered",
  "user_choice",
  "final_scope",
  "dropped_scope",
  "suppression_reason"       // null | "trivial" | "announce" | "non-interactive"
}
```

See `review-log-schema.md` for outer log shape. This block is additive.
