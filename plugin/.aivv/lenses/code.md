---
name: code
description: Default code-review lens — correctness, architecture, readability, maintainability, session-decision coherence
calibration_lens: code
applies_to: source code, config, schemas, tests, documentation
runtime_driver: none
---

## Focus

The `code` lens is the default; its content is loaded into the reviewer prompt so the CQ-* and AS-* standards-routing below is available in every ordinary code review. The universal methodology (`.aivv/methodology.md` Phase 2 VERIFY) remains the baseline; this lens adds concrete code-quality and architecture lookup routing on top.

This file exists for:
- **Discoverability** — listing `.aivv/lenses/` enumerates all shipped lenses including the default.
- **Symmetry** — every lens selectable via `--lens=X` has a corresponding file.
- **Prompt routing** — default reviews receive the same lens-specific focus section as non-default lenses, rather than depending on stale implicit behavior.

**Code simplicity & maintainability signals**: when the diff includes logic code (not pure UI/markup/config), consult [.aivv/standards/code-quality.md](../standards/code-quality.md) for the CQ-* signal catalog — 16 rules covering simplification process discipline (CQ-001..005), complexity signals (CQ-010..015), and redundancy & abstraction (CQ-020..025). Under `severity_model: impact_likelihood`, classify DEFECT-track issues through the shared IMPACT and LIKELIHOOD anchors below; POLISH-default improvement rules require verified present need, a specific improvement, and positive net value. CQ-025 (relocated-not-removed) carries a deterministic net-lines anchor (`git diff --numstat`); the file-size attention-trigger lives at AS-001 (architecture altitude).

**Architecture & structure signals (dev.147+)**: when the diff's *structural shape* is in view — new files, moved files, cross-module imports, a growing god-file, a directory gaining its Nth sibling — also consult [.aivv/standards/architecture.md](../standards/architecture.md) for the AS-* catalog (8 rules): module shape (AS-001..002), cross-file knowledge duplication (AS-003), dependency & layout (AS-004..006), document/collection structure (AS-007..008). AS-* is the cross-file / architecture-altitude complement to CQ-* (within-file): AS-003 complements CQ-021 (DRY across files vs within a file), AS-001 complements CQ-013 (whole-file cohesion vs within-function size). AS-* findings carry `category: improvement`; structural (multi-file) restructures are surfaced advisory, never auto-applied (`/aivv-fix` Branch F).

## Severity anchors

When `severity_model: impact_likelihood` is active, use these anchors for code findings after the two-track discriminator: DEFECT-track findings get IMPACT and LIKELIHOOD before mapping to the shared severity table; IMPROVEMENT-track findings route through the three-part articulation/proportionality gate and optional value/effort metadata. In legacy mode, treat these anchors as reviewer reasoning guidance, not an override of the configured shared severity model. Do not upgrade severity merely because a finding cites a named smell or best-practice rule; observable harm and reachable execution path control the rating.

### IMPACT: code harm if triggered

- **CATASTROPHIC** — likely irreversible data loss/corruption, cross-tenant or broad confidential-data exposure, production outage, unbounded financial loss, or a broken update/migration path that can brick live systems.
- **SEVERE** — wrong permissions or data returned for a meaningful user/admin path, persistent incorrect state, important workflow failure, high-blast-radius crash, or a test-contract weakening that can hide behavior regression in production code.
- **MODERATE** — localized incorrect behavior, bounded crash/error state, partial feature failure, maintainability issue with an already-materialized defect path, or a regression caught late but still before broad user exposure.
- **NEGLIGIBLE** — dead branch, test-only issue, naming/style/convention drift, speculative maintainability concern, or improvement opportunity without current behavior harm.

### LIKELIHOOD: reachability and escapability

- **CERTAIN** — normal execution, common request/job, startup path, migration, or required workflow reaches the issue; no unusual data, role, timing, or configuration needed.
- **PROBABLE** — reachable in common variants, normal error handling, common data shapes, supported configurations, or a regularly used role; tests or type checks do not reliably catch it before release.
- **POSSIBLE** — reachable only through less common roles, optional integrations, uncommon data shapes, rare timing/order, migration/import flows, or multi-step preconditions.
- **UNLIKELY** — dead or disabled code, test/story-only path, unreachable branch, unsupported configuration, or a failure reliably blocked by compiler/type checks, deterministic validation, CI, or an existing test that must fail before ship.

Escapability is part of likelihood: a defect that is certain to be caught by the type system, deterministic schema validation, or a required test before release is lower likelihood than the same defect silently escaping to runtime. Conversely, user-visible runtime paths, persistent state writes, background jobs, migrations, and async/concurrency paths with weak test coverage raise likelihood because the issue can escape review and affect real executions.

### Worked examples

- A missing null guard in dead code behind a disabled feature flag: IMPACT may be MODERATE if it would crash when enabled, but LIKELIHOOD is UNLIKELY while the path is disabled and uncalled.
- A schema/parser mismatch caught by mandatory validation in CI: IMPACT follows the broken contract, but LIKELIHOOD is usually UNLIKELY or POSSIBLE because escapability is low.
- A production migration that can silently corrupt records on a common deployment path: IMPACT is CATASTROPHIC or SEVERE and LIKELIHOOD is PROBABLE or CERTAIN depending on rollout reach, so it usually maps high even if the diff is small.

## Trigger patterns

All Phase 2 VERIFY rules apply as written. No lens-specific triggers.

## Standards to consult

- `.aivv/methodology.md` — universal review phases + Three-Tier scope + Scope Discipline
- `.aivv/standards/code-quality.md` (CQ-*, within-file simplification) + `.aivv/standards/architecture.md` (AS-*, cross-file/structure) — code-simplification + architecture-altitude signals for logic-code diffs
- `.aivv/standards/ui-ux.md`, `.aivv/standards/accessibility.md`, `.aivv/standards/visual-verification-triggers.md` — consulted when the change touches UI code even under the `code` lens (the lens focus is *code review*, but UI code is still code)

## Graceful degradation

N/A — the code lens requires no runtime driver or external infra. Always available.
