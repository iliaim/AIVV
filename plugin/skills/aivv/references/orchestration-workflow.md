# AIVV Orchestration Workflow

Open only for actual `/aivv` review execution. Contract lookups stay in
`../SKILL.md`.

<!-- pre-fix evidence: plugin/skills/aivv-fix/SKILL.md:110-122. -->
## Progress

When the host provides progress UI, register the following phases and mark each
`in_progress` when it begins and `completed` when it ends. If Codex does not
expose `update_plan`, provide concise, meaningful user-facing updates at phase
changes and continue all thirteen steps. Progress tracking is informational:
its absence MUST NOT skip, weaken, or relabel review, dispatch, fix, safety, or
verification steps and is not a `capability_degradations` entry.

<!-- Codex-SPECIFIC --> When Codex does not expose `update_plan`, use the
user-facing phase-update fallback above; do not treat missing progress UI as a
capability degradation.

1. Parse arguments
2. Setup/eval/maintenance early branch
3. Extract structured session context
4. Gather change context
5. Scope resolution
6. Lens composition/detection
7. Construct reviewer prompt
8. Dispatch reviewers
9. Present results
10. Self-calibration
11. Review log
12. Optional viewer hook
13. Optional `/aivv-fix` handoff

## Step 1: Parse Arguments

Use `argument-parsing.md` for non-default flags, ambiguous positionals, config,
runtime, eval, maintenance, setup, or help paths.

Always extract `--reviewers=N`, `--lens=...`, `--target=<dir>`, `--fix`,
`--dry-run`, `--plan`, `--setup`, `--help`, `--eval`, runtime-evidence flags,
per-run lens/scope/thoroughness/direction/multi-model overrides, and first bare
integer shorthand.

For review defaults, `--target=<dir>` scope, `--dry-run` semantics, and plan-mode parser state and the not-verified surfacing rule, see [../SKILL.md](../SKILL.md) Contract Snapshot — the canonical source; do not restate here.

Parser guardrails: `--thoroughness=fast|balanced|thorough|exhaustive`; extract `--direction`/`--no-direction` before config binding.

Early exits: `--help`, config-only, `--setup`, `--eval`, `--maintenance`.

## Step 1.2: Setup

If `--setup`, run `setup-wizard.md` and return. No dispatch, log, calibration,
or auto-chain.

## Step 1.4: Lens Composition

After parsing N/K/M, derive provisional `reviewer_lens_assignments`. Recompute
after preferences and smart-lens detection.

Use `review-shape-resolution.md`; use `lens-composition.md` for K>=2, M>=2, or
`--maintenance`.

Invariants: K=1/M=1 all reviewers use one lens; K=N/M=1 is 1:1; M>=2 requires
`N == K*M`; maintenance/eval are early exits.

## Step 1.5: Preferences

Use `preferences.md`. Resolve `CLI > project config > user config > schema
defaults`. Recompute lens assignments when preferences fill reviewer/lens/M.
`--config-show` and `--config-get` read preferences; config-init/set, setup,
and help skip.

## Step 1.9: Preamble

Bind the target/storage context from `.aivv/target-resolution.md`, then run
`.aivv/state-maintenance.md` for route-sensitive schema checks and authorized
external-only stale-session reaping. Legacy history is read-only; no automatic
migration or global temp cleanup. Newer selected/required state schema hard-errors;
unrelated newer historical state warns.

**First-run notices (one-time; lens + scope).** After Step 1.5 has resolved or
created the user config, read `~/.aivv/config.json`'s
`_walkthrough_hints_shown` map once (initialize it to `{}` when absent) and
snapshot BOTH markers from it (`lens_seen = lens_detection_v1 present and
non-null`, `scope_seen = scope_confirmation_v1 present and non-null`) before
emitting either — reading both before writing either is load-bearing, else a
fresh install collapses into case (b). Branch:
- (a) `!lens_seen && !scope_seen` (fresh install): emit ONE combined lens+scope notice, then write both markers.
- (b) `lens_seen && !scope_seen` (common upgrade): emit only the shorter scope-only notice, then write `scope_confirmation_v1`.
- (c) `!lens_seen && scope_seen` (unusual): emit only the standalone lens notice, then write `lens_detection_v1`.
- (d) both seen: emit nothing.

After any notice, preserve the complete config and marker map, stamp the
applicable marker or markers with the current UTC ISO 8601 timestamp, and
atomically write the complete user config. If that write fails, warn and
continue; the notice may reappear on the next invocation.
If the user config is unavailable or unreadable after Step 1.5's warning, skip
both notices and continue without a second warning.

These fire before Step 3.4 scope resolution and announcement; those pre-review
configuration/hint writes may already be complete if a genuine ambiguity or
authority question later holds the review.

## Step 1.95: Eval

If `eval = true`, run `eval-harness.md` and return. Do not continue into normal
review steps.

## Step 2: Session Context

Reviewer subagents do not see conversation history. Extract before git diff. **Per-category scan attestation (required):** for each of the 7 categories your internal reasoning MUST include a line `[N. Category]: scanned: <count> messages; scope: full-session|artifact-relevant; content: <one-sentence summary> OR none surfaced` — a category with no attestation line was not scanned; return to it. Concrete message-counts are required over checkbox-style confirmation (these lines anchor reasoning; they need not appear in reviewer-facing output).

- Goals & objectives
- Decisions, with unverified correctness claims marked
- Files touched, or unavailable marker
- Approaches tried
- Problems encountered
- Trade-offs
- Current state

For session reviews, scan full conversation. For file/idea/plan routes, scan
artifact-relevant history. If fewer than three categories have substance, prepend
limited-context warning. Record `multi_topic: true|false`. Compute the
`lens_ceiling` only after the requested scope is resolved, against the resolved
session subset.

For codemod/bulk-rename/formatter sessions, prepend to the reviewer prompt: `⚠️ This session involved mechanical/automated changes. Diff volume does NOT reflect decision count.` so bulk output is not over-weighted as review surface.

**`trigger_excerpt` redaction (load-bearing; order matters): redact FIRST, cap to 80 chars SECOND.** Redact secret/PII shapes — ≥16-char hex/base64 runs, `sk-`/`pk-`/`AKIA`/`ghp_` prefixes, `password=`/`token=`/`key=` values, email addresses → replace the span with `[redacted]`; THEN truncate to 80 chars, dropping any `[redacted]` token the cut would split. Cap-then-redact could leak a partial secret straddling char 80; redact-then-cap cannot. If the only triggering text is sensitive, store `trigger_excerpt: "[redacted]"` (never the raw secret).

## Step 3: Change Context

Plan mode:
- Read plan/spec/proposal as primary evidence.
- Include under `## Plan Under Review (PRIMARY - forward-looking)`.
- Skip implementation diff VERIFY and set `implementation_verified = false`.
- Include cheap supporting context only.
- Prompt must include: `Forward-looking plan review: implementation VERIFY is skipped; evaluate plan soundness, assumptions, sequencing, scope, evidence, and simpler alternatives.`

No argument: when Git is available, gather `git status`, staged/unstaged diffs
excluding lock/build/dist, and recent session commits since last review or last
6 hours. Cap displayed commits at 50 and diff near 300 lines. If Git is
unavailable or there is no diff, continue with available conversation and
non-code materials; Git is not a review prerequisite.

File path: read specified files and include artifact-relevant session context.
Quoted text: treat as idea/approach to challenge.

## Step 3.4: Scope Resolution And Announcement

Use `review-shape-resolution.md` and `scope-confirmation.md` to establish
`final_scope` and its provenance. A clear explicit request to perform a
read-only review authorizes that review unless `--ask-scope` or a manual-
provenance `scope_confirmation_mode: "ask"` was explicitly selected; otherwise
do not ask the user to reconfirm its scope. After resolving the final lens/depth method in Step 3.5/3.6, announce the
goal, subject, material boundaries, relevant questions/strategy, and method
together before dispatch. Ask only to resolve genuine ambiguity, missing
authority, or a material scope expansion. `--ask-scope` and a manual-provenance
`scope_confirmation_mode: "ask"` request confirmation of a clear scope. Old
wizard/default `ask` values resolve to announce unless the flag is supplied.
Earlier preamble writes may already have happened if such a question holds the
review.

## Step 3.5/3.6: Lens Detection And Method Resolution

After `final_scope` is resolved, use `review-shape-resolution.md` to apply
deterministic floors, recompute `reviewer_lens_assignments`, and resolve
`lens_detection_mode`. Then announce the complete final scope and method before
Step 4. Do not ask the user to approve routine lens/depth resolution within the
requested scope unless the user explicitly selected an ask preference. Ask if the
resolved method would materially broaden scope or needs authority the user did
not grant; do not issue a lens-only question that hides such a change.
`--auto-lens` means smart; `--no-auto-lens` means off.
If a genuine scope or authority question is pending or the user cancels, hold
before reviewer prompt construction, dispatch, calibration, review-log writing,
or fix handoff.

## Step 4: Reviewer Prompt

Use `reviewer-prompt-template.md`. Native prompts may use compact pointers;
provider-backed prompts must be self-contained.

Keep `Session Activity` before code, include metadata, capability degradations,
lens coverage, and final/dropped scope.

## Step 5: Dispatch

Read `review-dispatch-lifecycle.md` before native dispatch, cleanup, or
same-agent fallback. Confirm `review_mode` and capture pre-dispatch workspace
state.

For Case D, read `multi-model-dispatch.md`; provider prompts use
`tools/aivv-prompt-bundle.mjs`.

## Step 6: Present Results

Read `result-rendering-policy.md`. Load `setup-hint.md` or
`consensus-output-templates.md` only when that policy points to them. For Case D
synthesis, reopen the synthesis section of `multi-model-dispatch.md`.

## Step 7: Self-Calibration

Read `self-calibration.md` before writes. Append JSONL to this invocation's
per-invocation shard `<calibration_dir>/<lens>/<invocation-id>.jsonl`
(per-invocation sharding contract); never hardcode lens; uppercase severity; write `review_meta`; skip
`WORKSPACE_DRIFT_VOIDED_REVIEW`.

## Step 7.5: Review Log

Read `review-log-schema.md`. Write `review-<invocation_id>.json` for every
actual review that resolved and announced scope/method and ran, including clean
reviews. Do not write it for a review held on a genuine scope or authority
question. Persist lens detection, scope-resolution audit, plan_review, severity calibration, predecessor linkage, and
impact-likelihood extension fields.

## Step 7.5.5: Cleanup

Read `review-dispatch-lifecycle.md` before cleanup.

## Step 7.6: Viewer Hook

Read `viewer-hook.md` only when viewer behavior is enabled.

## Step 8: Auto-Chain

Read `auto-chain-handoff.md` only when `/aivv --fix` or config auto-chain is
requested. Chain via durable `--review-id`, propagate `--target=` and
`--dry-run`, and run stale-cache canary behavior before relying on fresh install
state.
