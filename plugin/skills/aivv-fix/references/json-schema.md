# Investigator And Fix-Phase JSON Schemas

This is the routing index for structured JSON emitted or consumed by `/aivv-fix`.
Keep this file small; schema details live in focused references so investigator,
challenger, and orchestrator paths load only the contract they need.

## Read Order

- [investigator-output-example.md](investigator-output-example.md) — full single-finding JSON example used by investigator dispatch.
- [investigator-enrichment-fields.md](investigator-enrichment-fields.md) — optional backward-compatible enrichment fields such as `prerequisite_probe`, `static_reachability`, and `unsafe_control_action`.
- [investigator-field-definitions.md](investigator-field-definitions.md) — canonical field definitions for `category`, `domain`, root-cause fields, `write_intents`, verdicts, and prevention mechanisms.
- [batched-and-challenger-schemas.md](batched-and-challenger-schemas.md) — batched investigator output and Step 4.5 fix-challenger output schema.
- [schema-migration-notes.md](schema-migration-notes.md) — chronological schema migration notes.

## Contract Anchors

- `category` is the Step 5 dispatch key; see [investigator-field-definitions.md](investigator-field-definitions.md) `### Category`.
- `write_intents[]` is the inspectable pre-write surface; see [investigator-field-definitions.md](investigator-field-definitions.md) `### write_intents`.
- `class_signature`, `class_assessment`, and `class_sibling_triage[]` are class-breadth fields; see [investigator-field-definitions.md](investigator-field-definitions.md) `### class_signature`.
- `static_reachability` is record-only in v0.1; routing remains governed by [investigation-dispatch.md](investigation-dispatch.md).
- Fix-challenger concern kinds live in [batched-and-challenger-schemas.md](batched-and-challenger-schemas.md).

When adding fields, prefer a backward-compatible optional field in the most specific
reference above. Update validation if the field is a dispatch key, safety gate, or
cross-surface enum.
