---
name: general
description: Default review lens for a scoped artifact of any type
calibration_lens: general
applies_to: any artifact type within the confirmed review scope
runtime_driver: none
---

## Focus

Use the shared general review checklist as the baseline for this review. Select questions and evidence from the confirmed subject's purpose and artifact type; do not assume a file, session, or diff is code-review scope. This lens adds no specialist domain checklist.

## Trigger patterns

No lens-specific trigger list. Apply only the relevant questions selected through the shared checklist's single applicability scan.

## Severity anchors for non-code findings

For non-code findings under this lens, use actual consequences rather than the
software legacy model's keyword or financial-category shortcuts:

- **CRITICAL:** credible catastrophic or severe harm, such as serious safety or
  privacy harm, irreversible loss, or an equivalent consequential failure.
- **MAJOR:** a central goal, decision, or material constraint cannot be met, or a
  load-bearing conclusion is unsupported and must be corrected before intended use.
- **MINOR:** a concrete, bounded gap with limited consequences.

A budget reference, a wrong number, or a contradiction of a stated decision does
not alone establish CRITICAL impact. For example, a bounded draft-budget error
that can be corrected before approval is not automatically catastrophic.
Confidence in the arithmetic is separate from the magnitude of harm. Applicable
project severity policy and legal/safety floors still govern. When the configured
model is `impact_likelihood`, use consequence evidence to establish impact and
likelihood, then apply its configured matrix; these examples do not override that
mapping. Software findings retain their configured model and specialist anchors.

## Standards to consult

- `skills/methodology/references/general-review-checklist.md` — shared baseline and source rationale
- Project-local instructions, standards, contracts, and decision records relevant to the confirmed scope
- Authoritative primary sources when material external claims need current verification

## Graceful degradation

Use the evidence available within scope. State when material evidence, context, or runtime capability is unavailable; preserve unknowns as unknown and continue with the parts that can be reviewed.
