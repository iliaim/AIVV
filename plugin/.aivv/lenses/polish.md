---
name: polish
description: Polish review lens — improvement opportunities + better alternatives + aesthetic suggestions; value-add findings, not defects
calibration_lens: polish
applies_to: any artifact under review (code, copy, configuration, layout, documentation) — polish is a finding-class, not a domain
detect_paths: ""
detect_keywords: "polish, refactor, cleanup, readability, naming, simplify, redundant, aesthetic"
detect_high_risk: false
runtime_driver: none
---

## Focus

The `polish` lens flips the review question from *"is this wrong?"* to *"could this be better?"* — value-add suggestions that improve UX, code quality, or maintainability without representing a defect at current real-world inputs.

POLISH is the IMPROVEMENT-track output tier in AIVV's two-track model (see `.aivv/methodology.md` Finding Severities). The `polish` lens **specializes** the reviewer to seek out POLISH-tier opportunities deliberately — many UI/code reviews don't surface improvement suggestions because the reviewer is anchored on defect-finding. When `--lens=polish` is active, the reviewer's mental frame is *"within the project's stated scope, constraints, and likely maintenance horizon, what change would make this surface measurably better at positive net value?"*

### Improvement-articulation gate (load-bearing)

The `polish` lens does NOT lower the bar for emitting findings. It RAISES the bar by enforcing the Improvement-articulation pass at every emission:

> When you emit a polish finding, you MUST articulate:
> - **Present need:** the current input, requirement, or demonstrated maintenance burden that warrants change now (one sentence)
> - **Improvement:** what specifically would change about the artifact (one sentence)
> - **Value:** how the change makes the UX / code / maintainability measurably better after material costs (one sentence)
>
> If you cannot establish ALL THREE, DROP the finding. Speculative pattern-flagging without present need and positive net value is the cosmetic-edge-case-not-manifest-at-current-data anti-pattern. POLISH is reserved for value-add suggestions, not low-confidence defects.

A finding emitted under the `polish` lens without Present need + Improvement + Value lines is malformed — the orchestrator should treat it as a calibration false-positive.

Every polish finding must also pass the canonical **Proportional-remediation gate** in `skills/methodology/references/severity-confidence.md`. Benefit alone is insufficient: the reviewer must establish present need, compare the simplest viable correction, account for added moving pieces/net complexity, and explain why the current shape is insufficient. Invasive improvements route to `defer-with-rationale` and never auto-apply.

Behaviour-preserving betterments with no plausible harm mode stay on the IMPROVEMENT track and never enter the DEFECT impact×likelihood matrix. If a finding depends on a plausible failure, legal/safety applicability, standards breach, behavior change, or unresolved archetype uncertainty, route it through the DEFECT track instead of downgrading it into polish.

### Improvement-track anchors

When optional `value` and `effort` metadata is emitted, use it to prioritize POLISH findings without borrowing a defect tier:

- `value: high` — the improvement materially clarifies a common workflow, removes recurring reviewer/user friction, prevents likely near-term rework, improves repeated maintainability, or meaningfully improves accessibility/UX beyond the defect floor.
- `value: medium` — the improvement improves clarity, consistency, ergonomics, reviewer confidence, or local maintainability on a touched surface, but the benefit is bounded.
- `value: low` — the improvement is localized and nice-to-have while still passing the three-part articulation and proportional-remediation gates.
- `effort: trivial` — copy, naming, class, default-value, or small local structure change with obvious verification.
- `effort: moderate` — contained helper/component/API-shape change or multi-site cleanup with limited coordination and normal validation.
- `effort: invasive` — broader refactor, cross-module coordination, behavior-adjacent validation, or migration work. Still POLISH if no harm mode exists, but not a Quick Win; route to `defer-with-rationale`.

Quick Wins are `value: high` plus `effort: trivial`. Sort them above lower-value or higher-effort polish, but do not promote them to MINOR/MAJOR only to make them visible.

### What the polish lens looks for (improvement axes)

The lens evaluates each artifact along these axes, looking for value-add opportunities:

- **Clarity** — could the same intent be expressed more obviously? (Naming, microcopy, comment-as-rescue, code-structure-as-narrative)
- **Consistency** — does this match the established pattern in the surrounding codebase / design system? (Tone of voice, spacing scale, component variants, error-handling idiom)
- **Near-term resilience** — is a declared, evidenced near-term change already likely to cause rework, and would a small change today have positive net value? (Extraction at the SECOND duplication-of-three rule from project guidance, NOT speculative abstraction)
- **Accessibility uplift** — beyond WCAG-AA-required (which is `visual` lens scope), are there optional improvements? (Reduced-motion alternatives, screen-reader-only context, semantic-element preference over div+aria)
- **Aesthetic refinement** — typographic rhythm, alignment grids, color-relationship tuning, motion-curve naturalness (when reviewable from code — Tailwind classes, CSS values, animation `cubic-bezier` curves)
- **Microcopy upgrade** — generic verb ("OK") → specific verb ("Save changes"), passive voice → active, "Are you sure?" → confirmation that names the consequence
- **Interaction-state polish** — smooth state transitions, optimistic updates where appropriate, skeleton/SWR-stale indicators that improve perceived performance
- **API ergonomics** — argument order, default-value selection, error-result discriminability, observability hooks

### What the polish lens does NOT look for

- **Speculative defects** — "this could break if user enters 10MB into a text field" without evidence it manifests at current inputs → DROP
- **Style-guide preferences without consensus** — `let` vs `const` debates, tab vs space, single vs double quote (these are linter scope, not human-review scope)
- **Personal aesthetic preferences disguised as "polish"** — "I would have used a different font" when the project's design system specifies otherwise
- **Refactoring-as-polish** — restructuring beyond the change-set's scope is out-of-bounds (Three-Tier methodology + Scope Discipline)
- **Test-coverage cheerleading** — "could add more tests here" is not POLISH unless a current untested behavior or verified defect establishes present need

### Source-class interaction

Source class is discriminator evidence, not a standalone final severity pass:

- Applicable or undeclared L1-source content (legal/safety/WCAG-required) usually establishes a DEFECT or policy floor and must not be hidden as ordinary polish merely because a value statement can be written. Declared-inapplicable legal-risk findings may render as a context note / POLISH or lower-priority DISPOSITION while remaining forced-shown.
- L4-source content (aesthetic/style-guidance: Refactoring UI, Material tonality, Tailwind defaults) usually supports IMPROVEMENT only after the three-part gate proves present need and positive net value.
- L2/L3 content (cognitive heuristics, platform conventions, engineering convention) depends on the concrete harm mode. If there is no harm mode, keep it on the IMPROVEMENT track and prioritize with `value`/`effort`.

The lens-name controls the reviewer's *search frame*, not the *severity output*. A legal/safety/accessibility defect found during a polish pass remains a defect; a no-harm betterment remains POLISH even when it is high value.

## Trigger patterns (improvement opportunities — articulate or drop)

These patterns commonly produce POLISH findings when the change set exercises them. Each requires the full three-part articulation and proportional-remediation gates to actually emit:

- **Microcopy upgrades**: generic button labels (OK/Submit/Cancel/Yes/No), placeholder-as-label, empty-state without next-action prompt, error message without recovery prose
- **Inconsistent variant usage**: `<Button variant="primary">` count > 1 in a form/screen (Hick's law) — articulate which one is the actual primary
- **Loading-state polish**: spinner used where skeleton would communicate structure better; debounce missing on search input; SWR-stale state not surfaced visually
- **Default-state polish**: form pre-population from URL params, last-used values, sensible sort orders — articulate the value of the default
- **Empty-state polish**: bare "No data" → "No projects yet — create your first one" with a CTA
- **Navigation polish**: breadcrumb trail missing in nested flows, back button unclear about destination
- **Animation polish**: `transition: all 0.3s ease` (generic) → tuned curve + duration appropriate to the gesture; missing `prefers-reduced-motion` honoring
- **Spacing/typographic polish**: arbitrary `[123px]` Tailwind values where the design system has a token; non-baseline-grid-aligned vertical rhythm
- **API ergonomics**: positional args > 3, boolean flags that should be enums, errors thrown rather than returned as Result/Either when the codebase uses Result/Either elsewhere
- **Code-structure polish**: extracted helper that would clarify a 30-line inline block; duplicated literal across ≥3 sites (the SECOND-of-three rule promotes to extract in some codebases — articulate that the codebase already shows the pattern)

## Standards to consult

- All standards files apply — the `polish` lens does not have a dedicated rule catalog. It draws from:
  - [.aivv/standards/visual-design.md](../standards/visual-design.md) — **VD-* (NEW dev.54; subdir-retrofitted dev.67 — TOC stub + 6 subfiles in `visual-design/`)** — typography, spacing, color, iconography, motion, layout. L4 source-class; rules predominantly support IMPROVEMENT/POLISH when the three-part gate is met. Primary catalog for aesthetic-improvement findings.
  - [.aivv/standards/microcopy.md](../standards/microcopy.md) — UX-writing rules (NEW dev.43; subdir-retrofitted dev.64 — TOC stub + 9 subfiles in `microcopy/`)
  - [.aivv/standards/ui-ux.md](../standards/ui-ux.md) — UX-001..046 (UX-030..036 added dev.81 = T22 phase 1 checkout & payment; UX-037..041 added dev.82 = T22 phase 2 data tables & pagination; UX-042..046 added dev.83 = T22 phase 3 search inputs / filter grouping / status messages; often surface as POLISH when not at MAJOR severity)
  - [.aivv/standards/ux-heuristics.md](../standards/ux-heuristics.md) — HEU-* heuristics (subdir-retrofitted dev.65 — TOC stub + 4 by-source subfiles in `ux-heuristics/`; dev.69 nested sub-split — `laws-of-ux.md` itself becomes a TOC stub + 6 by-domain sub-subfiles in `ux-heuristics/laws-of-ux/`); L2 cognitive-psychology — some entries surface as POLISH (`HEU-LUX-aesthetic-usability`, `HEU-COG-novelty`, others articulating "could be more delightful")
  - [.aivv/standards/visual-verification-triggers.md](../standards/visual-verification-triggers.md) — VVT-* triggers; polish-lens fires on the *suggestion* angle of VVT findings
  - [.aivv/standards/accessibility.md](../standards/accessibility.md) — A11Y-* rules, but ONLY non-WCAG-required uplift (see Source-class interaction)
  - [.aivv/standards/dark-patterns.md](../standards/dark-patterns.md) — DP-* rules (NEW dev.56; subdir-retrofitted dev.68 — TOC stub + 9 by-domain subfiles in `dark-patterns/`), but ONLY non-LEGAL-class entries surface under the `polish` lens by default; DP-LEGAL-* are L1-source forced-show findings whose hard legal floor is context-gated
- [.aivv/methodology.md](../methodology.md) — Severity model + Improvement-articulation pass (load-bearing)
- [.aivv/prompts/reviewer-role.md](../prompts/reviewer-role.md) — Phase 2 VERIFY heuristic-walkthrough framework (lens-active behavior)

## Output convention

POLISH findings render expanded by default in the orchestrator output (`/aivv` Step 6). Users can set `polish_collapsed: true` in `.aivv/config.json` to collapse them to a summary, and `--show-polish` expands them for a single invocation. The visible default exists because POLISH findings are actionable value-add suggestions and should not be hidden behind an extra step.

The `/aivv-fix --apply-all-polish` flag batch-accepts polish findings during remediation. The L1-source refusal guard prevents accidental batch-apply on applicable or undeclared-context legal/safety findings; declared-inapplicable legal context does not refuse by bare citation alone.

## Graceful degradation

The `polish` lens runs against the same artifacts the reviewer is already looking at — there is no domain restriction. It can produce zero findings when the reviewer cannot articulate any improvement (which is the correct outcome — drop, don't emit speculatively).

**No-content case**: pure formatting-only diffs (whitespace, file moves) produce zero polish findings. Polish targets the substance, not the diff mechanics.

**Cross-lens overlap**: the `polish` lens often fires alongside `ux` or `visual` — the same surface produces a MAJOR finding under `ux` (e.g., "missing label") AND a POLISH finding under `polish` (e.g., "label could be more specific"). This is intentional: the orchestrator's consensus synthesis (when N reviewers run with mixed lenses) deduplicates only on rule-ID + summary equivalence, not on lens-overlap. Polish suggestions are additive value.

**When --reviewers=N runs all-polish**: emitting only polish findings is acceptable and not a degraded review — it is a *focused* review. The user invoked `--lens=polish` deliberately. Do not pad with non-polish findings.
