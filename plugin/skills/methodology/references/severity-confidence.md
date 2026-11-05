# Severity And Confidence

Read this before assigning severity or confidence, suppressing noise, or emitting POLISH findings; severity, confidence, and improvement value are separate decisions.

Contents:
- Improvement-articulation pass
- Proportional-remediation gate
- Severity and confidence classification
- Noise suppression rule

#### Improvement-articulation pass (POLISH severity routing)

Apply this pass to any finding that does NOT clearly impact users at the current real-world inputs (text lengths, viewport sizes, data shapes actually present in the codebase). The block below is the verbatim reviewer instruction:

> When you flag a finding that does NOT clearly impact users at the current real-world inputs (text lengths, viewport sizes, data shapes actually present in the codebase), apply the Improvement-articulation pass before emitting:
>
>   1. Identify the VERIFIED PRESENT NEED — what current input, requirement, or demonstrated maintenance burden warrants a change now?
>   2. Identify the SPECIFIC IMPROVEMENT — what would change for the user/code/maintainer if applied?
>   3. Identify the POSITIVE NET VALUE — how would the change make the UX/code measurably better after accounting for added complexity, testing, coupling, and maintenance cost?
>   4. If you can establish ALL THREE in one or two sentences each, emit the finding at POLISH severity with:
>        Present need: <one-sentence statement of (1)>
>        Improvement: <one-sentence statement of (2)>
>        Value: <one-sentence statement of (3), including material costs>
>   5. If you CANNOT establish any one of (1), (2), or (3) — DROP the finding entirely. Do not emit at MINOR or POLISH. Speculative pattern-flagging without present need and positive net value is what the cosmetic-edge-case-not-manifest-at-current-data anti-pattern prevents (see Reviewer Anti-Patterns section in .aivv/methodology.md, N=2 corpus).
>
> POLISH is reserved for value-add suggestions, not low-confidence defects. A finding you would only justify with "well, it could break in some edge case" is a finding to DROP, not downgrade.

#### Proportional-remediation gate (all recommended changes)

**No complexity without verified present need and positive net value.** Do not recommend a new abstraction, layer, dependency, configuration surface, generalized behavior, enforcement artifact, or broader scope for hypothetical future use. Such a recommendation is valid only when evidence establishes a current problem or requirement and the expected benefit exceeds the added comprehension, testing, coupling, migration, and maintenance cost.

Before emitting any recommended change, whether defect remediation or improvement, state:

- **Present problem:** the current, evidenced limitation or friction; future-only possibility is insufficient.
- **Simplest viable correction:** the minimum change that resolves that problem.
- **Added moving pieces / net complexity:** what branches, files, indirection, dependencies, configuration states, or enforcement artifacts the recommendation adds or removes.
- **Why the current shape is insufficient:** why leaving it alone, or applying the simpler local correction, does not adequately resolve the evidenced problem.

For an improvement, if those statements do not demonstrate positive net value, drop the suggestion. For a verified defect, recommend the minimum sufficient correction unless additional machinery is necessary to restore the violated requirement. Do not invent alternatives merely to populate a review: when one localized correction is clearly sufficient, say so. When multiple approaches are equally sound after their trade-offs are considered, present them neutrally and preserve the author's choice rather than manufacturing a preferred architecture.

Set `effort: invasive` improvements to `recommended_next_step: defer-with-rationale`; they are advisory and never auto-apply. A smaller recommendation may use a stronger route only when its present value and project policy justify that route.

## Severity & Confidence Classification

Every non-trivial finding MUST be classified on two axes:

### Severity (what's the impact?)

| Level | Meaning | Action |
|-------|---------|--------|
| **critical** | Causes data loss, security breach, crash, breaks core functionality, OR implementation contradicts an explicit session decision | Must fix |
| **major** | Significant functional, performance, or architectural issue, OR key session goal left unaddressed | Should fix |
| **minor** | Concrete, reachable, bounded defect or contract breach with limited impact. A no-harm code smell, suboptimal pattern, or maintainability preference belongs on the POLISH track and must pass its gates. | Fix at convenience |
| **polish** (dev.41+) | Improvement opportunity / value-add suggestion — NOT a defect (orthogonal to critical/major/minor). Reviewer must pass both the Improvement-articulation and Proportional-remediation gates above; otherwise DROP the finding. | Advisory; invasive improvements defer with rationale, while smaller improvements follow explicit project/user opt-in policy |
| **info** | Observation, question, praise, or knowledge sharing | No action needed |

### Confidence (how sure are you?)

| Level | Meaning | Presentation |
|-------|---------|-------------|
| **high** | Almost certainly correct based on code as written | State directly: "This will cause X" |
| **medium** | Likely correct but depends on context you may not fully have | Frame as likely: "This appears to cause X" |
| **low** | Speculative — worth considering but uncertain | Frame as question: "Could this affect X?" |

### Noise Suppression Rule

**If a finding is both low-confidence AND minor-severity, omit it entirely.** It is noise. This single rule dramatically improves signal ratio.

The noise-suppression rule applies to **defect-tier findings** (critical/major/minor) only. **POLISH findings have their own articulation and proportional-remediation gates** — emit POLISH only when the reviewer establishes `Present need:`, `Improvement:`, and positive-net `Value:`; otherwise DROP the finding. Confidence-based suppression does not apply to POLISH because POLISH is by-design value-add (no "low-confidence-defect" framing).

### Intent and Rationale Confidence Caps

Intent-dependent findings must cite the intent source. If the intended end state is inferred rather than explicit, cap confidence at `medium` unless code/tests/runtime evidence independently proves the current behavior violates a user-impacting invariant. If the intent source is absent or ambiguous, route as `clarification-needed`, `document`, or `investigate-first` instead of `fix-now`.

Findings that refute explicit authored rationale (`intentionally`, `by design`, `excluded`, `do not change`, ADR/plan rationale, or a deliberate suppression comment) need concrete contradictory evidence. Without that evidence, cap confidence at `low`; if severity would also be `minor`, suppress it under the noise rule. If the concern is still useful, express it as POLISH only when the Improvement-articulation pass succeeds.

Target: >80% of your findings should be major/critical severity OR high/medium confidence. If you're producing mostly minor+low findings, you're generating noise.
