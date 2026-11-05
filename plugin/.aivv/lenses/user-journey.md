---
name: user-journey
description: User-journey review lens — zero-knowledge-user cognitive walkthrough, AC-framing scrutiny, discoverability, perceptible-state-change-on-activation, time-to-first-success
calibration_lens: user-journey
applies_to: UI code + the acceptance criteria / spec / task file that frames it; rendered user-facing surfaces; activation-feedback paths; entry-point flows for any feature labeled "user can <verb>"
detect_paths: "**/*.tsx, **/*.jsx, **/*.vue, **/*.svelte, **/*.html, **/*onboarding*, **/*wizard*, **/*flow*, **/*journey*"
detect_keywords: "user journey, user can, user sees, user clicks, discoverability, first-run, time to success, acceptance criteria"
detect_high_risk: false
runtime_driver: optional (cognitive walkthrough is static; B3 runtime evidence artifacts may upgrade the state-change-on-activation check to empirical screenshot-diff observation — see Graceful degradation)
---

## Focus

The `user-journey` lens audits the **spec-against-user-need** layer — whether a **zero-knowledge user can succeed at the task the feature exists to enable** — not whether the implementation matches the acceptance criteria. Code-matches-ACs review is the `code` lens. AC-frame-matches-user-need (and evidence-selection-matches-user-perceptibility) review is THIS lens.

**Load-bearing distinction from `ux`:** the `ux` lens audits the surface a user encounters assuming the user is already on it (microcopy, state completeness, heuristic conformance). The `user-journey` lens audits the *journey* — *will a user who doesn't know this feature exists discover it, activate it, perceive that activation succeeded, and complete the underlying task without external instruction?* Both lenses intentionally overlap at the discoverability boundary; consensus synthesis at `/aivv` Step 6 deduplicates by fingerprint.

This lens supports two modes:

- **Post-implementation mode** (canonical): cognitive walkthrough of the rendered surface answering all four questions below.
- **Pre-implementation mode** (lightweight spec review): runs against a task file with ACs but no diff yet; only Question 1 (AC-framing audit) fires.

## Severity anchors

When `severity_model: impact_likelihood` is active, use these anchors for user-journey findings. In legacy mode, treat them as reviewer reasoning guidance, not an override of the configured shared severity model. Journey severity follows whether a zero-knowledge user can discover, activate, perceive, and complete the intended task.

### IMPACT: journey failure if encountered

- **CATASTROPHIC** — the intended user cannot complete a critical task, cannot recover from a misleading activation, or is likely to make an irreversible harmful choice because the journey hides the real consequence.
- **SEVERE** — a new or core feature is undiscoverable, activation appears to do nothing, or time-to-first-success requires external instruction for a primary persona.
- **MODERATE** — the user can complete the task but must infer missing cues, follow an undocumented secondary path, or recover from unclear feedback.
- **NEGLIGIBLE** — minor journey wording or sequencing issue where entry, activation feedback, and completion remain clear to the target persona.

### LIKELIHOOD: frequency and persistence

- **CERTAIN** — every first-time user or every primary-flow user encounters the journey gap before success.
- **PROBABLE** — common personas encounter it in normal onboarding, activation, or completion paths.
- **POSSIBLE** — it appears for a secondary persona, optional feature path, unusual starting point, or less common task variant.
- **UNLIKELY** — internal/admin-only path, hidden experiment, already-deprecated entry point, or speculative journey with no evidence that target users reach it.

Persistence is a likelihood/exposure modifier: a repeated failure on every attempt scores higher than a one-time first-run ambiguity. For incremental changes to already-discoverable, already-functional features, keep discoverability and time-to-first-success likelihood low unless the diff changes the entry point or completion path.

## Trigger patterns

The gate fires when BOTH conditions hold:

1. The review target carries any of: `tags:` includes `frontend` / `ui` / `ux` / `component` / `page`; OR the diff includes ≥1 file matching `*.jsx` / `*.tsx` / `*.vue` / `*.svelte` / `*.html` / `*.css` / `*.scss`; OR the task's user-story names a user-perceptible action (e.g., "user can <verb>", "user sees", "user clicks").
2. The `user-journey` lens is in the dispatched lens-list (auto-satisfied under `--lens=user-journey`, `--full-ui-ux`, `--full-with-journey`; not satisfied under bare `--lens=code`, `--lens=sec`, or `--lens=ux` alone).

When both conditions hold, BEFORE forming the verdict, answer the four operationalized questions:

### Question 1: AC-framing audit (BOTH failure modes)

*Of the N acceptance criteria, how many describe a code/state invariant ("X is set to Y", "function Z is called") versus a user-observable outcome ("the user sees / can do / knows that …")? For each AC describing a user-observable outcome: does the evidence the reviewer would cite to verify the AC describe a user-observable artifact (rendered DOM, screenshot, video, user-action trace) or a code-side artifact (function call, state mutation, line-of-source)?*

Two failure modes, both emit as MAJOR findings against the task file (not the implementation), routed to spec author for revision before verdict:
- **AC text describes implementation invariant** — cite `UJ-AC-01a`.
- **AC text describes user-observable outcome but reviewer's cited evidence is code-side** — cite `UJ-AC-01b`.
Under `severity_model: impact_likelihood`, treat MAJOR as the legacy/default label guidance for common AC-framing failures and assign final severity through the IMPACT and LIKELIHOOD anchors above.

### Question 2: Discoverability

*Without reading the task file, the spec, or source code, what visible cue on the page tells a first-time user that this feature exists? Quote the exact DOM text, image, or interaction the user sees.*

If the only entry point is an unmarked keyboard shortcut, hover-revealed control, or hidden menu — cite the appropriate `UJ-DISC-*` rule. Severity at minimum MAJOR (UJ-DISC-01) or MINOR (UJ-DISC-02..04) for new features.
Under `severity_model: impact_likelihood`, treat those labels as legacy/default label guidance and still assign final severity through the IMPACT and LIKELIHOOD anchors above.

### Question 3: Perceptible state-change-on-activation

*Take a screenshot (or, if static, describe the rendered surface) before and after the primary activation action. Describe in one sentence what visibly changes.*

If a user could not tell the action took effect by looking at the screen — cite the appropriate `UJ-ACT-*` rule. Severity MAJOR by default.
Under `severity_model: impact_likelihood`, treat MAJOR as the legacy/default anchor for common primary-flow activation gaps; lower or raise only when the shared table and the anchors above justify it.

### Question 4: Time-to-first-success (zero-knowledge walkthrough)

*Describe in plain prose the sequence of perceptions and actions a user with no prior knowledge of this feature would follow to use it successfully.*

If the walkthrough requires the user to read source, read documentation, or have been told about a shortcut — cite `UJ-TFS-01`. If it requires a multi-step undocumented sequence with no breadcrumb — cite `UJ-TFS-02`. Severity MAJOR (TFS-01) / MINOR (TFS-02).
Under `severity_model: impact_likelihood`, treat those labels as legacy/default anchors and map the final severity from journey impact plus how many target users reach the path.

**Walkthrough protocol — Cognitive Walkthrough (Polson-Lewis) + Heuristic Evaluation (Nielsen-Molich) layered:**
The reviewer reads Session Activity FIRST per the universal Information Hierarchy contract (`.aivv/prompts/reviewer-role.md:41,104`). The cognitive-walkthrough simulation is then performed as a **per-lens reasoning layer** that brackets session context only for the duration of Question 4's simulation step. The reviewer never declares session activity "adversarial"; the reviewer applies a structured perspective-shift, then returns to the universal hierarchy for synthesis and verdict.

**Time-threshold disambiguation** when emitting UJ-ACT-* findings:
- Use **Doherty 1982** (IBM Systems Journal, 400ms productivity inflection) when evaluating "did the user perceive the activation succeeded within productivity-flow time?"
- Use **Nielsen 1993** (*Usability Engineering*, 0.1s instantaneous-perception threshold) when evaluating "could the user attribute the visible change to their action?"

**Scope boundary** (this lens does NOT cover):
- Algorithm-reversibility / threat-model gaps — `sec` lens
- Race conditions, wrong-default-value bugs, performance regressions
- Security-axis findings — `sec` lens
- WCAG conformance per se — `visual` and `compliance` lenses
- Agent-only / admin-only features with no end-user persona: return zero findings — "User-journey lens: no end-user persona for this feature class; no findings applicable."
- Incremental modifications to already-discoverable, already-functional features (style tweaks, copy edits, internal refactors that do not add new entry points) — skip Questions 2 and 4; apply Questions 1 and 3.

**Review cue:** A flow may appear correct in code while remaining undiscoverable or unclear to a first-time user. Verify the visible entry point, activation feedback, and completion path from the user's perspective.

## Standards to consult

- [.aivv/standards/user-journey.md](../standards/user-journey.md) — UJ-AC-01a/01b, UJ-DISC-01..04, UJ-ACT-01..03, UJ-TFS-01..02
- [.aivv/standards/ux-heuristics/nielsen.md](../standards/ux-heuristics/nielsen.md) — HEU-NN1 (UJ-ACT-*), HEU-NN6 (UJ-DISC-*)
- [.aivv/standards/interaction-states/](../standards/interaction-states/) — IS-* per-primitive state inventories (complement UJ-ACT-* for state-change evidence)

## Graceful degradation

The `user-journey` lens operates statically — cognitive walkthrough of source code and static artifacts. No browser, no MCP, no runtime required.

**When runtime evidence is supplied:** Question 3 (perceptible state-change-on-activation) may upgrade to empirical screenshot-diff observation using generated probe scaffolds, user-run Playwright results, or an explicitly supported host runtime adapter. Runtime upgrade is **optional**. The lens functions fully without it.

**No-UI-in-change-set case:** if the review target contains no UI code and no task file with ACs, return zero findings: "User-journey lens: no UI surface or AC set in review target; no findings applicable."

**Pre-implementation mode:** if the review target is a task file without an associated diff, run only Question 1 (AC-framing audit). In legacy mode, return MAJOR findings for each AC that fails UJ-AC-01a or UJ-AC-01b framing; under `severity_model: impact_likelihood`, treat MAJOR as legacy/default label guidance and assign final severity through the IMPACT and LIKELIHOOD anchors above.

## Phase 0 transition note

Before this lens shipped (dev.115–dev.120), the `ux` lens carried a Phase 0 "Pre-verdict disconfirmation gate" subsection inside its Trigger patterns that emitted findings under UX-* rule IDs with UJ-* candidate names in-prose. On this Wave 3 ship (dev.121), that subsection migrated here and the UJ-* candidate names promote to full rule IDs. Calibration records emitted under the Phase 0 gate stored in the legacy `.aivv/calibration/ux.jsonl` (read via union) remain valid under the `ux` lens calibration schema; new UJ-* findings post-dev.121 route to the `user-journey` lens (`.aivv/calibration/user-journey/<invocation-id>.jsonl` shards per per-invocation sharding contract).
