# Evidence Vocabulary

AIVV currently has four evidence vocabularies. They are related but not identical,
because they are consumed at different stages.

| Vocabulary | Producer | Consumer | Purpose |
|---|---|---|---|
| `finding.evidence[].kind` | `/aivv` modern review-log writer | review-log pre-write validation, viewer, fix handoff | Concrete evidence that makes a finding reproducible. |
| `finding.grounded_by[].source_type` | reviewer finding envelope | reviewer/fixer grounding checks, calibration readers | Citation/source category backing the finding claim. |
| `review_log.assurance_plan.required_evidence[].kind` | `/aivv` review-log writer | review-log pre-write validation | Evidence required before a review can be treated as decision-ready. |
| `fix_log.objective_evidence[].kind` | `/aivv-fix` | final disposition validation | Objective evidence supporting fix disposition. |

## Terms

### `finding.evidence[].kind`

- `internal-repo`
- `websearch`
- `webfetch`
- `runtime`
- `command`
- `state-log`
- `thread`
- `unverified`
- `unverifiable`

### `finding.grounded_by[].source_type`

- `websearch`
- `webfetch`
- `context7`
- `runtime`
- `unverified`
- `unverifiable`
- `internal-repo`

### `review_log.assurance_plan.required_evidence[].kind`

- `command-output`
- `schema-validation`
- `grep`
- `runtime-evidence`
- `source-citation`
- `verifier-result`
- `test-output`

### `fix_log.objective_evidence[].kind`

- `test-output`
- `command-output`
- `schema-validation`
- `grep`
- `runtime-evidence`
- `source-citation`
- `verifier-result`

Use `grounded_by` for citation/source provenance and `evidence` for reproducibility. When both apply, emit both rather than overloading one field.

`rule_id` identifies the standards rule a finding cites. Review, fix, and viewer consumers must preserve it exactly when it is present. Consumers may omit `rule_id` only when the source finding had no standards rule.
