# Preferences Load (Step 1.5)

Step 1.5 runs after flag extraction and before the preamble so defaults are
resolved before dispatch. Step 1.4 may validate explicit CLI shape first, but
final composition must use Step 1.5-resolved values when CLI omitted them.

## Skip And Read-Only Modes

Skip entirely for `--config-init`, `--config-set`, `--setup`, and `--help`.
Run read-only for `--config-show` and `--config-get` so provenance can be
computed without quarantining malformed config.

## Resolution

Use the shared `.aivv/configuration.md` resolution core:
CLI > project config > user config > schema defaults. Validate readable configs
against the golden `.aivv/schemas/config.schema.json` regardless of
`schema_version`; legacy versioned schemas are compatibility fixtures, not the
normal runtime dispatch surface.

First normal `/aivv` invocation may auto-create `~/.aivv/config.json`. If
interactive, ask the HTML report behavior prompt before writing; choices persist
`post_review_html_viewer` and `post_review_html_open_mode`. Without prompt
capability, write minimal `{"schema_version": 6}` and use schema defaults
in-memory. On mkdir/write failure, warn and continue with in-memory defaults.

Resolve policy lookup separately from storage, using `.aivv/target-resolution.md`.
Read user config, then the original project policy config; storage relocation
must not change remediation policy. Preserve malformed/schema-invalid originals,
warn, and fall through; do not move them into quarantine.
Unknown keys are additive-compatible and ignored by the current reader.

Legacy mapping: if `default_lens_replicate` is absent and `default_M` is
present, map `default_M` to `default_lens_replicate`; new writes use
`default_lens_replicate`.

Back-compat defaults: historical configs missing `project_context`,
`severity_cell_map`, `thoroughness`, `direction`, `scope_confirmation_mode`,
`polish_collapsed`, or `fix_apply_policy` resolve from golden schema defaults.
An omitted `default_lenses` value resolves to the golden default `general`;
historical configs that explicitly set `code` or another valid lens retain that
selection.

Historical golden-schema default note: `scope_confirmation_mode`, `polish_collapsed`, or `fix_apply_policy` omissions are bound by schema defaults, not persisted-file materialization.

Merge project over user, then fill missing keys from schema defaults. For
`fix_apply_policy`, omitted category entries fill from the schema object.

## Thoroughness And Direction

Resolve `thoroughness`: CLI `--thoroughness=<tier>` > project > user > default
`balanced`. `balanced` is identity. `fast`, `thorough`, and `exhaustive` apply
the default overlays from `thoroughness-dial.md` only to unpinned lever cells:
`default_reviewers`, `severity_threshold`, `default_lens_replicate`, and
outer-loop keys. Explicit config pins and CLI flags win. Recompute reviewer
assignments if the dial fills reviewer or replicate defaults.

`exhaustive`: default reviewers 2; escalate to 3 for architectural scope or
when final review coverage exceeds the resolved `default_lenses` count, except
under `--full-*` where KxM governs. Project-kind metadata does not define a lens
baseline. Require reviewers to attach `grounded_by` for load-bearing findings.

Resolve `direction`: `--direction`/`--no-direction` > project > user > golden
schema default. Pass as `Direction: on|off` in dispatch metadata.

## Runtime Validation

Validate resolved `default_lenses` against `<plugin_root>/.aivv/lenses/*.md`.
Unknown lens names warn and fall back to `general`; do not halt. Do not append
`general` to an explicit or configured lens list. Fixed full-* wrappers retain
their documented specialist lens lists.

For `scope_confirmation_mode`, `announce` is the default: clear explicit
read-only requests proceed after the final scope and method are announced. An
`ask` value is a stored preference only when its config has manual provenance;
old wizard/default `ask` values resolve in-memory to `announce`. The explicit
`--ask-scope` flag always requests confirmation for this invocation. Ambiguity,
missing authority, and material scope expansion require clarification in either
mode.

Validate `default_target` directory exists. Stale paths warn and fall back to
cwd for this invocation.

Bind each config key into the orchestrator working state when the matching CLI
flag was omitted. Keys without base CLI flags still bind here for downstream
steps. `multi_model_enabled` additionally honors per-run `--multi-model` /
`--no-multi-model`.

## Field-Binding Map

| Config key | Binds to | Used by |
|---|---|---|
| `default_reviewers` | reviewer-count default | Step 1 N-resolution; Step 5 |
| `default_lenses` | explicit/configured lens-list default; omitted/invalid fallback is `general` | Step 1.4; Step 3.5 |
| `severity_threshold` | output threshold | Step 6 |
| `auto_chain_fix` | review-to-fix behavior | Step 6/8 |
| `apply_polish_mode` | legacy POLISH fix behavior | `/aivv-fix`; superseded by explicit `fix_apply_policy.improvement` |
| `fix_apply_policy` | per-category `/aivv-fix` policy map; defects default to `auto`, improvements to `ask`; invasive improvements are never auto-eligible | `/aivv-fix` Step 1.1 and Step 4 |
| `polish_collapsed` | POLISH render mode | Step 6 |
| `post_review_html_viewer` | post-review/fix report generation | Step 7.6 and `/aivv-fix` viewer hook |
| `post_review_html_open_mode` | link vs open behavior | viewer hook |
| `default_lens_replicate` | `--lens-replicate` default; legacy `default_M` read-compatible | full-* modes and wizard-derived plain dispatch |
| `runtime_driver_optin` | runtime evidence default | runtime emit/ingest path |
| `default_target` | `--target` default | target resolution |
| `rule_id_back_fill` | calibration backfill behavior | Step 7 |
| `project_kind` | inferred/preserved setup metadata | setup summary only; does not derive lenses |
| `outer_loop_mode` | reverse-chain continuation mode | `/aivv-fix` outer loop |
| `outer_loop_max_cycles` | loop cap | `/aivv-fix` outer loop |
| `outer_loop_severity_floor` | legacy continuation floor | `/aivv-fix` outer loop |
| `thoroughness` | tier defaults and dispatch metadata | Step 1.5; Step 4 |
| `direction` | direction challenge posture | Step 4 metadata |
| `lens_detection_mode` | report candidates/add relevant lenses/disable optional detection; no lens-only approval prompt | Step 3.6 |
| `severity_model` | `legacy_4pass` or `impact_likelihood` | severity methodology |
| `project_context` | deployment/data/jurisdiction context | severity and legal applicability |
| `severity_cell_map` | partial impact-likelihood table override | severity methodology |
| `scope_confirmation_mode` | announce default; manual-provenance ask confirms scope/method; ambiguity/authority boundary always asks | Step 3.4 |
| `_provenance` | wizard/manual/default source tracking | default_lens_replicate binding gate |
| `_setup_hint_shown_at` | setup-hint suppression timestamp | Step 6 hint |
| `_walkthrough_hints_shown` | walkthrough-hint suppression map | Step 6 and `/aivv-fix` notices |
| `multi_model_enabled` | Case D master switch | Step 5.0.5 |
| `reviewer_provider_priority` | provider ordering and fallback walk | multi-model-dispatch.md |
| `multi_model_fallback_strategy` | ask/subagents/none slot fallback | multi-model-dispatch.md |

## Backward Compatibility

Current reader validates against the golden schema and resolves absent historical
keys from schema defaults. Historical readers seeing newer configs warn/project
and ignore unknown keys. Round-3.5 renamed `default_M` to
`default_lens_replicate`; both are accepted on read, new writes use the modern
name.
