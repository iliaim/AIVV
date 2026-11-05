## Field Definitions

### Category (required — mirrors envelope schema)

The `category` field identifies the finding's kind for Step 5 dispatch. Its enum matches the envelope schema (`.aivv/schemas/finding.json`) and the Step 2a classification in the /aivv-fix SKILL.md — all three surfaces share one vocabulary.

| Value | Meaning | Step 5 dispatch target |
|-------|---------|------------------------|
| `code-bug` | Source-level defect, missing validation, logic error | Branch A (code-edit) |
| `design-flaw` | Architectural or abstraction issue | Branch C (ADR-worthy) or Branch A (localized) |
| `process-violation` | Checkbox-without-evidence, un-gated commit, rule violation | Branch D (corrective or rule update) |
| `documentation-gap` | Missing or stale prose in shipped docs | Branch B (targeted prose edit) |
| `clarification-needed` | Ambiguous — needs user input before a fix is possible | Branch E (HALT + return to user) |
| `improvement` | Behaviour-preserving betterment — clarity, complexity reduction, redundancy removal, ergonomics (NOT a defect) | Branch F (scoped simplification) |

**Propagation contract:**
- For Signal 0 findings (machine-readable envelope sidecar), the orchestrator pre-populates `category` from the envelope schema. The investigator MUST NOT widen or contradict it — only refine if the envelope's value was indeterminate.
- For Signal 1-4 findings (prose / user-reported / deferred / agent-noted), the investigator sets `category` from the root-cause analysis. The orchestrator then carries it onto the approved-finding record per Step 4's field-propagation rule, and Step 5 dispatches on it.
- **Missing-or-unknown** `category` on an approved-finding record falls back to Branch A (`code-bug`) with a warning appended to the top-level `session_changes.warnings: []` array (NOT into `changes_summary[].root_cause` — that field is reserved for the finding's actual root cause and must not be overloaded with dispatch warnings; a later analytics pass over `root_cause` would be corrupted). Warning format: `{"code": "category-fallback", "finding_id": "F###", "original_category": null, "fallback_to": "code-bug", "ts": "<RFC 3339>"}`. Undefined-on-read is never acceptable for a dispatch key — if the fallback fires, that is a real data-quality bug and should be surfaced in Step 7 DOCUMENT via the warnings array.

This field is distinct from `root_cause_analysis.root_cause_category` (which classifies WHY the finding happened, not WHAT kind of finding it is). Both enum-valued; different purposes.

### Domain (optional, default `code`)

The `domain` field identifies which review lens this finding belongs to. It is **optional** — when omitted, the orchestrator treats the finding as `"code"` by default. This preserves backward compatibility with pre-Tier-2 findings (which predate the field) and with any external tooling that emits findings without a domain tag.

| Value | Meaning |
|-------|---------|
| `code` (default) | Source-code correctness, bugs, design flaws — the `/aivv`, `/aivv-fix` pipeline (single or multi-reviewer via `--reviewers=N`) |
| `sec` | Security findings (`/aivv --lens=sec`, shipped dev.22+) |
| `visual` | Visual/UI/a11y review findings (`/aivv --lens=visual`, shipped dev.22+; static review baseline plus optional B3 runtime evidence emit/ingest) |
| `ux` | UX heuristic-walkthrough + microcopy + interaction-state findings (`/aivv --lens=ux`, shipped dev.43+) |
| `polish` | Improvement-articulation / value-add suggestions (`/aivv --lens=polish`, shipped dev.43+); subject to the Improvement-articulation gate per `.aivv/methodology.md` |
| `perf` | Performance findings (planned future lens — Tier 2/3) |
| `a11y` | Pure-a11y findings, distinct from `visual` lens's UI-a11y coverage (planned future lens — Tier 2/3) |

Mirrors `.aivv/schemas/finding.json` envelope `lens` enum. The forward-look entries (`perf`, `a11y`) are accepted today so findings written by adventurous early-adopter setups remain compatible when those lenses graduate to shipped status; the orchestrator does not currently dispatch reviewers with those lens names.

**Field-name note:** the investigator-schema names this field `domain` for historical reasons; the envelope schema (`.aivv/schemas/finding.json`) names the same concept `lens`. The two should be treated as synonyms during the migration window. New emitters SHOULD prefer the envelope-schema name `lens`; readers MUST handle both.

### Root Cause Categories
| Category | Description |
|----------|-------------|
| `code-error` | Bug in logic, off-by-one, wrong algorithm |
| `design-flaw` | Architectural issue, wrong abstraction |
| `missing-guardrail` | No automated check prevents this |
| `process-gap` | Missing process step or documentation |
| `knowledge-gap` | Developer didn't know the convention |

### `root_cause_analysis.cause_structure` (optional — backward-compatible)

Classifies the causal *shape* of the finding — distilled from Fault Tree Analysis's AND/OR gate kernel (the one part of FTA not already covered by 5-Whys + Fishbone + Kepner-Tregoe; the fault-tree apparatus and probabilistic roll-up are out of scope — AIVV analyzes static artifacts, not running systems, so no failure-rate data exists to compute). Optional; absent means single-cause (the common case) was assumed.

| Value | Meaning | Investigator action |
|-------|---------|---------------------|
| `single` | One root cause; the linear why-chain is complete | Default; emit or omit |
| `or-sufficient` | Multiple **independently-sufficient** causes — any one alone triggers the finding (e.g., three unguarded call sites) | Enumerate each independently-sufficient branch as a `contributing_factor` so the fix addresses all, not just the first |
| `and-conjunctive` | Several conditions must **co-occur** for the finding to manifest (e.g., caching enabled AND a request race) | State the minimal set of co-required conditions; this is the minimal-reproduction condition set |

Purpose: counter the 5-Whys failure mode of latching onto the first plausible chain and stopping. A finding with `or-sufficient` structure whose fix addresses only one branch leaves siblings live.

### `root_cause_analysis.insertion_phase` (optional — backward-compatible)

The software-lifecycle phase in which the defect was **introduced** — distilled from IEEE Std 1044 (Classification for Software Anomalies), which defines a lifecycle phase-of-insertion attribute for anomalies. Optional; statically inferable from the change history and the nature of the defect. Use `unknown` when the phase cannot be determined.

Two near-neighbours, deliberately kept distinct:
- vs `incident_context.introduced_by` — `introduced_by` identifies *which commit* (the when/who); `insertion_phase` classifies *which phase of work* (the what-phase). Complementary defect-origin attributes. (Like `introduced_by`, `insertion_phase` is investigator-emitted; it is **not** part of the reduced lifecycle-record `incident_context` shape in `.aivv/schemas/incident.json` / `problem.json`, which carries only `detection_failure` + `contributing_factors`.)
- vs `root_cause_analysis.root_cause_category` — `root_cause_category` is the abstract *why-class* (`code-error`, `design-flaw`, …); `insertion_phase` is the *phase of work* in which the defect entered. They often co-vary (`design-flaw` ⇄ `design`) but are not synonyms — e.g., a `code-error` introduced during `configuration` work — so set each independently rather than deriving one from the other.

AIVV does NOT adopt IEEE 1044's severity/priority/disposition scheme — the bespoke `impact × likelihood` model (`.aivv/methodology.md`) is retained; only this one genuinely-missing attribute is borrowed.

| Value | Meaning |
|-------|---------|
| `requirements` | Defect traces to a missing/wrong requirement or spec |
| `design` | Wrong abstraction, architecture, or interface decision |
| `implementation` | Coding error — the defect entered when the code was written |
| `configuration` | Env var, build config, deployment setting, feature flag |
| `documentation` | Stale/missing/wrong prose in a shipped doc |
| `unknown` | Phase cannot be determined from available evidence |

### `root_cause_analysis.problem_specification` (conditionally required)

Kepner-Tregoe IS/IS NOT analysis. Required when `investigation_mode: standard | instrumentation-first`; optional for `skip-permitted`.

**Enforcement note:** This conditionality is prose-only in v0.1 — `finding.json` (the reviewer envelope schema) carries no if/then enforcement for `problem_specification`. Orchestrators must validate this requirement at Step 3 dispatch-time, not at schema-validation time.

The IS/IS NOT boundary defines what makes this finding specific — which files, conditions, and contexts SHOW the problem vs which do NOT. `boundary_explanation` is the pivot: a proposed root cause must explain both the IS conditions AND why the IS NOT conditions don't show the problem.

| Field | Description |
|---|---|
| `is_what` | What IS observed (the deviation from expected) |
| `is_where` | Which files/paths/components show the problem |
| `is_when` | Under what conditions/inputs/ordering |
| `is_not_what` | Similar things that do NOT show the problem |
| `is_not_where` | Files/paths where expected behavior holds |
| `boundary_explanation` | Why here but not there? (pivot to root cause) |

**Note on `investigation_mode` context:** `investigation_mode` is set by the orchestrator during Step 2a triage and passed to the investigator as dispatch context — it is not an investigator-emitted output field. It determines which `root_cause_analysis` fields are conditionally required (see Step 2a "Investigation Mode" classification in `SKILL.md`).

### Confidence Levels
| Level | Meaning |
|-------|---------|
| `high` | Root cause is clear, directly observable in code/docs |
| `medium` | Root cause is probable based on evidence, some assumptions |
| `low` | Root cause is speculative, insufficient evidence |

### Verification Methods (required for `documentation-gap` findings)

| Value | When | What verified means |
|---|---|---|
| `code-trace` | Causal chain traced through source | Cited `file:line` for each why-chain link in `verification_evidence` |
| `runtime-observation` | Visual/behavioral/DOM root cause | Under read-only investigator constraint, use `unable-to-verify` unless user supplied DevTools evidence |
| `test-execution` | Root cause confirmed by repro test | Test name or output snippet ≤120 chars |
| `grep-pattern-match` | Pattern-class finding | Regex + match count summary ≤120 chars |
| `external-doc-lookup` | Code violates spec/API/RFC | Cited URL (verbatim quote lives in `root_cause_analysis.evidence[]`, not here) |
| `unable-to-verify` | Cannot empirically confirm | MUST → `confidence: low` + `confidence_gap` populated |

`verification_evidence` (string, ≤120 chars): structural reference to where the evidence exists — a `file:line`, URL, or short phrase. NOT the full evidence text (that goes in `evidence[]`). Empty string is treated as `unable-to-verify`.

Required for `documentation-gap` findings where `root_cause` makes an empirical claim. Optional for other categories. Absent field on a `documentation-gap` finding predating this design: verifier fails closed — see the documentation-gap verification protocol in `skills/aivv-fix/references/verifier-prompt-template.md` step 2.

`evidence` (array of strings, optional on `root_cause_analysis`): verbatim quotes from external sources cited in the `why_N` chain. For `external-doc-lookup` findings, populate each entry with the character-exact verbatim quote from the cited source (per dev.91+ Discipline 1). The Step 6 verifier greps each entry against the WebFetched source URL; all entries must match. For other `verification_method` values, this array is typically empty or absent.

`verbatim_doc_content` (string or null, on `fix_proposal`): for `documentation-gap` mechanical fills — the literal text to write into the doc. Branch B pastes this verbatim when populated. Omit when the content requires investigation to determine. Distinct from `description` (which is a prose description of the fix approach for human reading).

### `class_signature` (optional, in `root_cause_analysis`)

A grep-pattern (regex or literal substring, ≤120 chars) describing the generalizable class this finding belongs to. Populated by the investigator in Phase 3 SCAN. Consumed by:
- Step 4.5 CHALLENGE (challenger runs recurring-class scan against this pattern)
- Step 6 VERIFY (auto-emits `recurring_class_missed` calibration when regression matches this pattern)
- Step 5 (Step 4.5 trigger: `class_signature_present(finding)` demotes `fix_confidence`)

Emit when the finding is an instance of a class that may have siblings elsewhere. Omit or `null` when the finding is a one-off.

### `scope_search_seed` (optional, in `root_cause_analysis`)

A grep-pattern (≤120 chars) the orchestrator runs at Step 5 to discover sibling files that may need updating (multi-SSoT discovery). Different from `class_signature`: targets _scope breadth_ (which other files need the same change), not _class breadth_ (which other locations have the same bug pattern).

Populated by the investigator. Consumed by Step 5 scope_search_seed execution: orchestrator runs `grep -rl '<seed>' <target>` and surfaces unaddressed matches as sub-findings `F001-sib1`, `F001-sib2` etc. before executing the main fix.

### `root_cause_analysis.class_assessment` (optional - class-breadth remediation; the self-contained branch of the mandatory class verdict, executed at the Step 5 pre-loop)

The self-contained branch of the mandatory class verdict. When the investigator judges a `code-bug`/`design-flaw` finding has no sibling class, it emits `class_assessment` instead of `class_signature`:

```json
"class_assessment": {
  "self_contained": true,
  "justification": "single-use helper; the bug is in a one-off branch with no analogous call sites",
  "searched_pattern_negative": "parseDeadline\\("
}
```

- `self_contained` (boolean, required-when-present): asserts the finding has no class siblings.
- `justification` (string, required-when-present): why the bug does not generalize.
- `searched_pattern_negative` (string, required-when-present): the grep-pattern the investigator claims returns zero other matches. This is not trust-checked by prose alone: the Step 5 pre-loop executes the pattern using the same scan machinery as `class_signature`. Zero matches means self-contained verified; one or more matches means the claim is falsified and the matched locations are auto-routed into the variant scan/triage instead of accepting the opt-out. Residual boundary: execution cannot confirm the pattern semantically characterizes the bug, so a deliberately irrelevant pattern can still return zero and pass; that is the same investigator-trust boundary as the original classification.

All three sub-fields are required when `class_assessment` is present. There is no machine JSON Schema for investigator output; this doc is the contract. Completeness is enforced by the `validate.sh` class-verdict stage and the Step 5 pre-loop fail-closed gate, not by ajv.

Intended as the alternative to `class_signature`: a finding normally emits one branch or the other, and the gate scoped to `category in {code-bug, design-flaw}` requires at least one. If a finding defensively emits both, `class_signature` wins: the orchestrator runs the variant scan and ignores the self-contained assessment. This is the safe-by-default resolution because the two signals contradict each other, and skipping the scan would silently miss class breadth. Exempt categories may still opt in by emitting `class_signature`.

### `root_cause_analysis.class_sibling_triage[]` (optional - class-breadth remediation; populated by the Step 5 pre-loop class-sibling triage pass)

Per-candidate triage verdicts produced by the batched class-sibling triage pass when a `class_signature` variant scan finds matches:

```json
"class_sibling_triage": [
  { "file": "src/timer/pause.ts", "verdict": "confirmed", "reason": "same off-by-one in the analogous guard" },
  { "file": "src/timer/legacy.ts", "verdict": "false-positive", "reason": "matched the pattern but the guard is correct here" },
  { "file": "src/timer/edge.ts", "verdict": "ambiguous", "reason": "guard differs; needs a full per-site investigation to confirm" },
  { "file": "src/timer/edge2.ts", "verdict": "ambiguous-deferred", "reason": "escalation-budget-exhausted" }
]
```

- `file` (string): the candidate sibling site.
- `verdict` (enum): `confirmed` (same root cause, becomes a `-cls<N>` sub-finding) | `false-positive` (grep matched but not the bug, dropped) | `ambiguous` (escalated to a full per-site investigator dispatch, capped at `ambiguous_escalation_cap`) | `ambiguous-deferred` (escalation budget spent; preserved for a later cycle).
- `reason` (string): one-line justification.

### Sub-finding suffix taxonomy + fix_confidence demotion

Sub-findings derived from a parent finding carry a suffix naming which breadth signal produced them:

| Suffix | Source field | Breadth axis | Acted at |
|---|---|---|---|
| `<parent>-sib<N>` | `scope_search_seed` | scope breadth (which other files need the same change) | Step 5 pre-loop (existing) |
| `<parent>-cls<N>` | `class_signature` | class breadth (which other locations have the same bug pattern) | Step 5 pre-loop variant scan |

A finding may legitimately carry both a `scope_search_seed` and a `class_signature` because they target different axes. Two canonical surfaces govern the resulting `fix_confidence` demotion. Do not restate the mechanics here; they are nuanced and live in those files: (1) the ladder in [apply-policy-and-gates.md](apply-policy-and-gates.md) demotes on field presence (`class_signature_present` / `scope_search_seed_present` are independent one-tier predicates, each fires at most once, floored at `low`); (2) the Step 5 pre-loop in [fix-log-contract.md](fix-log-contract.md) demotes further when a seed/scan actually emits one or more sibling sub-findings (floored at `low`). Presence and emission are different triggers; both signals are recorded distinctly.

### `root_cause_analysis.architectural_remediation_check` (conditional)

Required when the orchestrator passes `architectural_remediation_assessment.required: true`, or when the investigator discovers a duplicated design-decision contract across sibling surfaces.

The field separates immediate root cause from class root cause and supplies a local-vs-architectural option pair. Missing or malformed data fails closed before Step 5.

Required shape:

```json
{
  "triggered": true,
  "required_by": ["orchestrator:duplicated-contract-evidence"],
  "triggers": [
    {
      "code": "duplicated-contract-evidence",
      "evidence": "Visible and hidden timer wrappers must preserve the same bounds manually.",
      "confidence": "high"
    }
  ],
  "immediate_root_cause": "The visible timer paints before fit measurement is ready.",
  "class_root_cause": "Timer surfaces duplicate a frame/measurement contract instead of sharing it.",
  "sibling_surface_scan": [
    {
      "surface": "Pomodoro route",
      "location": "src/routes/Pomodoro.tsx",
      "same_contract": true,
      "manual_sync_invariant": true,
      "evidence": "Visible and measured wrappers separately encode matching frame constraints.",
      "confidence": "high"
    }
  ],
  "local_option": {
    "option_id": "local-wrapper-fix",
    "label": "Apply local fix now and record class-risk deferral",
    "description": "Center local wrappers and hide visible timer until fit is ready.",
    "removes_immediate_root_cause": true,
    "removes_class_root_cause": false,
    "affected_surfaces": ["Pomodoro route"],
    "deferred_surfaces": ["Main Timer"],
    "blast_radius": "small",
    "decision_route": "tactical_apply_now",
    "verification_evidence": ["first-paint fit readiness test"],
    "residual_risk": "Duplicated frame contract remains until follow-up migration."
  },
  "architectural_option": {
    "option_id": "architectural-shared-frame",
    "label": "Introduce shared frame contract",
    "description": "Move the frame/measurement contract into shared components.",
    "removes_immediate_root_cause": true,
    "removes_class_root_cause": true,
    "affected_surfaces": ["Pomodoro route", "Timer frame contract"],
    "deferred_surfaces": [],
    "blast_radius": "medium",
    "decision_route": "architectural_apply_now",
    "verification_evidence": ["shared frame render test"],
    "residual_risk": "None for the frame contract."
  },
  "recommended_option": "architectural-shared-frame",
  "recommendation_rationale": "The shared frame removes the duplicated contract.",
  "why_not_symptom_patch": "A wrapper-only patch leaves the same manual sync invariant in place.",
  "alternative_approaches": [
    {
      "option_id": "local-wrapper-fix",
      "label": "Apply local fix now and record class-risk deferral",
      "description": "Apply the local wrapper fix and defer class-risk migration.",
      "removes_immediate_root_cause": true,
      "removes_class_root_cause": false,
      "affected_surfaces": ["Pomodoro route"],
      "deferred_surfaces": ["Main Timer"],
      "blast_radius": "small",
      "decision_route": "tactical_apply_now",
      "verification_evidence": ["first-paint fit readiness test"],
      "residual_risk": "Duplicated frame contract remains until follow-up migration."
    },
    {
      "option_id": "architectural-shared-frame",
      "label": "Introduce shared frame contract",
      "description": "Introduce the shared frame contract and migrate Pomodoro first.",
      "removes_immediate_root_cause": true,
      "removes_class_root_cause": true,
      "affected_surfaces": ["Pomodoro route", "Timer frame contract"],
      "deferred_surfaces": [],
      "blast_radius": "medium",
      "decision_route": "architectural_apply_now",
      "verification_evidence": ["shared frame render test"],
      "residual_risk": "None for the frame contract."
    }
  ]
}
```

Enums:

- `confidence`: `high | medium | low`
- `blast_radius`: `small | medium | large`
- `decision_route`: `ordinary_route | tactical_apply_now | architectural_apply_now | architectural_separate_effort | decision_queue`
- `recommended_option`: must match `local_option.option_id` or `architectural_option.option_id`

`fix_proposal.alternative_approaches[]` must contain or losslessly map both options when this check is required or triggered. For architecture-required findings, each mapped alternative must preserve `option_id`/`approach_id`, `description` or `label`, `removes_immediate_root_cause`, `removes_class_root_cause`, `affected_surfaces`, `deferred_surfaces`, `blast_radius`, `decision_route`, `verification_evidence`, and `residual_risk`. Normal trivial findings may still omit `alternative_approaches[]`.

### `fix_proposal.alternative_approaches[]` (optional / recommended, in `fix_proposal`)

A live menu of genuinely viable fix approaches for one finding, each with trade-off analysis. Populate only when at least two viable approaches exist; omit for a single-obvious-approach finding. Never add a knowingly inferior or irrelevant option merely to create a comparison. Consumed by the Step 4.5 challenger's Axis 9 (normal alternative-approach adequacy) — when absent or empty, Axis 9 still performs its minimum-sufficient-remediation check but skips alternative-to-alternative comparison and does not invent alternatives. Architecture-required findings still run Axis 8 from `architectural_remediation_check`.

Normal alternative entry shape: `approach_id` (string, short form `A1`/`A2`, unique within the array), `description` (string), `addresses_root_cause` (boolean), `trade_offs` (object with `pros[]` and `cons[]` string arrays), `estimated_scope` (`small` | `medium` | `large`), and `recommended` (boolean).

Architecture option entry shape: when mapping `architectural_remediation_check.local_option` and `architectural_option`, entries may use `option_id` or `approach_id` and must preserve the architectural option metadata listed above: root-cause booleans, affected/deferred surfaces, blast radius, decision route, verification evidence, and residual risk. These architecture-shaped entries are the active decision surface for Axis 8 and are not required to carry the normal `trade_offs` or `recommended` fields when the recommendation is already expressed by `architectural_remediation_check.recommended_option`.

Invariants: IDs (`approach_id` or `option_id`) MUST be unique within the array. For normal alternative entries, exactly ONE entry MUST have `recommended: true` when the array is non-empty. For architecture-shaped entries, `architectural_remediation_check.recommended_option` identifies the recommended option. Distinct from `alternatives_considered[]`, which records already-rejected options with rejection reasoning (historical record); `alternative_approaches[]` is the active decision surface and INCLUDES the selected or recommended approach. An approach MUST appear in either `alternative_approaches[]` (viable) or `alternatives_considered[]` (already rejected) — not both.

### `fix_proposal.approach_id` (optional, in `fix_proposal`)

References the selected entry in `alternative_approaches[]`. When present, MUST equal the `approach_id` of exactly one array entry — and that entry MUST be the one with `recommended: true` (the two constraints enforce each other). Short form `A1`, `A2`, etc. (not zero-padded); scoped to one finding; distinct from `F001`-style finding IDs. Omit when `alternative_approaches[]` is absent.

### `incident_context` (conditionally required — top-level on finding)

SRE-postmortem-style context. **Required for CRITICAL findings; recommended for MAJOR; optional otherwise.**

| Field | Source | Description |
|---|---|---|
| `introduced_by` | Orchestrator Phase 1.5 probe — **DO NOT fill this yourself** | Pre-populated by orchestrator git log/blame before investigator dispatch. If absent from your context, omit the field entirely. |
| `detection_failure` | Investigator-filled | WHY did existing tests/checks/process not catch this? Drives `prevention_plan.mechanism` selection. |
| `contributing_factors[]` | Investigator-filled | Parallel contributing causes (not just the primary 5-Why chain). |

`introduced_by.confidence` enum: `"programmatic"` (git ran successfully) | `"unavailable-untracked"` (file not in git) | `"unavailable-shallow-clone"` (shallow clone lacks the blamed commit) | `"unavailable-binary"` (file is binary; blame not meaningful) | `"unavailable-line-out-of-range"` (blame line number exceeds current file length) | `"unavailable-deleted"` (file deleted or renamed; path not present at HEAD) | `"unavailable-no-git"` (working tree is not a git repository) | `"unavailable-other"` (any other git probe failure). Use the most specific applicable value; `"unavailable-no-git"` takes precedence over `"unavailable-untracked"` when both apply.

`contributing_factors[].factor_type` enum: `"code" | "process" | "knowledge" | "environment" | "tooling" | "data"` — matches the Fishbone category sweep in the Debugging Technique section of the investigator prompt.

**Prose-only enum (v0.1):** This enum is not machine-enforced — `finding.json` carries no schema constraint on `factor_type` values. Investigators may use any string; the listed values are the recommended vocabulary.

**Per-factor evidence and confidence (v0.1 deferral):** Each contributing factor intentionally omits individual `evidence` and `confidence` sub-fields. This is a YAGNI deferral — the factor array serves as a structured prompt for investigator reasoning; per-factor grounding fields are out of scope for v0.1 and may be added in a later schema version.

**Key discipline:** `detection_failure` informs the `prevention_plan` decision; it does not automatically justify new machinery. A new mechanism is allowed only when the evidence establishes confirmed recurrence, a systemic failure class, high-impact safety/security exposure, or failure of an existing control that the mechanism directly repairs. Otherwise select `none-new` with a bounded rationale.

The minimum defect-reproducing regression test required by Step 4.6 is recorded as verification evidence, not as `prevention_plan.mechanism: test`, and is exempt from the new-prevention eligibility gate. A broader test harness, generalized coverage rule, or additional prevention test remains subject to the gate.

### `verification_method.command_args` (optional, in `root_cause_analysis`)

When `verification_method` is emitted in nested-object form (rather than as a bare enum string per the "Verification Methods" table above), it may carry an optional `command_args` sub-property — an array of advisory argv strings consumed by Step 5.7 ORCHESTRATOR EXECUTION when the change `type` is `build-script`, `ci-gate`, or `verification-method`.

```json
"verification_method": {
  "type": "object",
  "additionalProperties": true,
  "properties": {
    "command_args": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Optional advisory argv strings for Step 5.7 execution. When non-empty, becomes argv[1:] verbatim. When absent/empty, default to argv[1] = <target_project>. Per Change 7 step 2.5. Nested-object form (NOT dotted-key) per dev.123 IV&V N1 cycle-2 corrective."
    }
  }
}
```

Backward-compat: emitters MAY continue to emit `verification_method` as a bare enum string (current shape per the table at line ~174). The orchestrator handles both shapes — bare string → no `command_args`; nested object → reads `command_args` if present. The nested-object form is the forward-going shape for Step 5.7 advisory-argv consumption.

### Low-Confidence Fields (required when `confidence: low`)

When `confidence: low`, the investigator MUST populate both `confidence_gap` and `confidence_gap_shape`:

| Field | Type | Meaning |
|-------|------|---------|
| `confidence_gap` | string | Short description of what additional information would raise confidence |
| `confidence_gap_shape` | `"code-shaped"` \| `"context-shaped"` | Whether the gap is addressable by more codebase scanning (`code-shaped`) or requires user knowledge/intent/out-of-code context (`context-shaped`) |

The orchestrator routes based on `confidence_gap_shape`:
- `code-shaped` → auto-spawn a second investigator with scoped framing derived from `confidence_gap`
- `context-shaped` → phrase the gap as a concrete question to the user; do not spawn a second investigator

### Fix Approaches
| Approach | Meaning |
|----------|---------|
| `strategic` | Addresses root cause, may involve architectural changes |
| `tactical` | Addresses symptom, used when strategic fix is too risky |

### `write_intents` (required for write-capable fixes)

Canonical producer semantics live in [write-intents-and-prewrite-validation.md](write-intents-and-prewrite-validation.md). The schema-shaped excerpt below exists only as an investigator prompt aid; when this summary conflicts with the canonical producer-write contract, the canonical file wins and this summary must be updated in the same change.

`write_intents[]` is required on `fix_proposal` for every Branch A/B/C-localized/D fix that can write to disk. It materializes the exact proposed bytes before Step 4.5 challenger dispatch, Step 5.4 deterministic validation, or any host write primitive. `fix_proposal.description` remains a human-readable approach summary and is never a substitute for exact proposed write content.

Required fields: `id`, `finding_id`, `branch`, `target_file`, `operation`, `kind`, `content_sha`, `source_step`, and `pre_write_assertions`. Branch A generated-patch intents also require exact ordered `proposed_edits[]` entries (`old_string`, `new_string`, `content_sha`). Detector results live under `detector_result` with `verdict`, `content_shapes`, `detection_confidence`, required/missing assertions, risky spans, and optional host-user `bypass_approval`.

Branch-specific rules:
- Branch A emits `kind: "generated_patch"` and exact ordered `proposed_edits[]` entries with `old_string` and `new_string`. If a patch hunk cannot be decomposed to exact old/new text, the orchestrator halts as `no-pre-write-inspectable-intent`.
- Branch B emits `kind: "verbatim_doc_content"` from `fix_proposal.verbatim_doc_content`; it must not fall back to `fix_proposal.description`.
- Branch C localized fallthrough emits Branch A-compatible `generated_patch` intents and inherits the same detector, Step 4.5 inert snapshot, and Step 5.4 validation contract.
- Branch D emits `kind: "process_rule_content"` for process/rule/doc updates.

Hash, stale-intent, and bypass invariants are delegated to [write-intents-and-prewrite-validation.md](write-intents-and-prewrite-validation.md): hashes always cover exact raw bytes/full edit framing, stale hashes halt as `stale-write-intent-content-mismatch`, regenerated intents invalidate prior bypasses, and valid risky-shape bypasses must be host-user approved with matching `content_sha`.

### `pre_write_assertions` (optional, sibling on `fix_proposal`; required inside `write_intents[]`)

Required when `verbatim_doc_content` contains a fenced ```` ```json ```` or ```` ```jsonschema ```` block, an `L<N>`-form line citation, or any deterministic structural assertion. Step 5.4 PRE-WRITE-VALIDATE runs these assertions before applying the fix. Investigators that omit `pre_write_assertions` on schema-bearing or citation-bearing fixes get the fix re-investigated (Branch E).

Kinds: `jq-parses`, `schema-coherence`, `line-cite-valid`, and `shell-syntax-valid`. Their per-kind args and halt behavior live in [write-intents-and-prewrite-validation.md](write-intents-and-prewrite-validation.md). The legacy `count-matches-enumeration` kind remains intentionally dropped; eliminate count-claims-paired-with-enumerations at authoring time per maintainer guidance dev.119+.

Sibling on `fix_proposal` (NOT inside `root_cause_analysis`).

### Verdicts
| Verdict | Meaning | Next Action |
|---------|---------|-------------|
| `fix-required` | Real issue needing code changes | Apply fix proposal |
| `already-correct` | False positive — code is correct | Record calibration |
| `clarification-needed` | Resolved by explanation, not code | Document explanation |
| `wont-fix` | Real but impractical to fix | User decides |

### Prevention Mechanisms
`prevention_plan` is always required as a decision. For a new artifact, fields are `mechanism`, `eligibility_basis`, `eligibility_evidence`, `description`, `enforcement_level`, and `implementation_details`. `eligibility_basis` is exactly one of `confirmed-recurrence`, `systemic-failure-class`, `high-impact-safety-security`, or `existing-control-failed`; `eligibility_evidence` is a concrete source, observation, or repository anchor establishing that basis. For `none-new`, fields are `mechanism`, `rationale`, and an evidence-bounded `description`; omit eligibility and artifact implementation details.

| Mechanism | Enforcement Levels / rationale |
|-----------|-------------------------------|
| `hook` | blocking, warning |
| `validator` | blocking, warning |
| `test` | blocking |
| `pattern-doc` | advisory |
| `schema` | blocking |
| `rule` | advisory |
| `none-new` | exactly one rationale: `isolated-one-off`, `existing-control-sufficient`, `fix-eliminates-class`, or `prevention-cost-exceeds-risk` |

New prevention machinery is justified only by confirmed recurrence, a systemic failure class, high-impact safety/security exposure, or evidence that an existing control failed. Generic defense-in-depth, hypothetical future reuse, and “every issue needs a guardrail” are insufficient.
