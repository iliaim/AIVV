---
name: aivv
description: "Use for general AIVV advisory review of session work, documents, research, plans, designs, decisions, or code; optionally choose reviewers or lenses, target a project, or hand findings to /aivv-fix."
argument-hint: "[<file>|<idea>|N] [--reviewers=N] [--lens=<list>] [--plan <file>] [--fix] [--dry-run] [--target=<dir>] [--help]"
---

# AIVV Orchestration

Compact router for `/aivv`. Answer flag/mode questions from **Contract Snapshot**
alone; open references only for an actual review or parser internals.

## Contract Snapshot

**Core principle:** advisory IV&V of the confirmed subject. A named document,
idea, plan, or other artifact is primary; session activity is primary for session
reviews. Other material supplies relevant evidence and context.

`review_mode` values:
- `cold_single_review`: one isolated reviewer.
- `cold_multi_review`: N isolated reviewers plus synthesis.
- `cold_multi_model`: provider-diverse Case D dispatch.
- `same_agent_review`: fallback only; no independent epistemic signal.
- `evidence_only_review`: review from supplied evidence only.

`same_agent_review` is never the default and must be surfaced to the user, not
only stored in metadata.

`--reviewers=N` and `--target=<dir>` semantics:
- `--reviewers=N` controls reviewer count and influences `review_mode`.
- `--target=<dir>` controls `state_target`, the project instance whose external
  store receives review/fix logs and calibration, and the base for relative
  file / plan positionals. The store is outside the consuming project.
- For `--plan <file>`, relative paths resolve against `--target=<dir>` when
  present, otherwise cwd.
- `--target=<dir>` does not reconfigure a reviewer's working directory or turn
  a session review into a project-wide sweep; review scope comes from the
  positional argument or explicit in-session instruction.
- Without `--target=`, state writes use the current target project. The flag
  affects state writes and relative path resolution only.

`--dry-run` semantics:
- `/aivv --dry-run` still runs the review normally and still writes review logs/calibration.
- `/aivv --fix --dry-run` runs the review, then chains into `/aivv-fix`; the
  fix path stops after investigate + plan with no remediation/session/calibration/verifier writes.

**Viewer decision safety net:** Viewer reports stay read-only. Route decision payloads to `/aivv-fix --resume <review-id>` or `/aivv-fix --resolve <review-id>`.

Plan mode:
- `--plan <file>` sets `plan_mode = true` and `review_subject_kind = "plan"`.
- Prompt must surface `Implementation not verified in --plan mode`.
- Review log includes `plan_review`.

Config/shape anchors:
- Config keys come from the golden schema at `.aivv/schemas/config.schema.json`.
- Defaults start at `--reviewers=1 --lens=general`. Explicit and configured lens
  choices remain unchanged; `general` is the fallback for an unset or unknown
  configured lens.
- `review-shape-resolution.md` owns the adaptive-confidence floor.

## Usage

```text
/aivv                         # current session, 1 reviewer
/aivv 4                       # current session, 4 reviewers
/aivv src/module.ts 3         # file review, 3 reviewers
/aivv "Should we use Redis?"  # idea/approach challenge
/aivv --plan docs/plan.md     # forward-looking plan review
/aivv --reviewers=2 --fix     # review, then durable /aivv-fix handoff
/aivv --fix --dry-run         # review normally, then plan fixes only
/aivv --target=/path/project  # state + relative-path target
/aivv --full                  # seven specialist lenses, N=14
/aivv --maintenance           # quarantine, index rebuild, 90-day archive; no review
```

Other routed flags include `--lens=...`, `--lens-replicate=M`, `--full-ui-ux`,
`--thoroughness`: `fast` | `balanced` | `thorough` | `exhaustive`, `--direction`,
`--no-direction`, `--auto-lens`, `--no-auto-lens`, `--auto-scope`,
`--ask-scope`, `--predecessor-review-id`, `--setup`, `--help`, `--eval`,
runtime-evidence flags, and multi-model provider overrides.

## Route Loading

- For actual reviews, first read the reference-resolution contract relative to
  this loaded `SKILL.md`: `.aivv/runtime-root.md` when present (standalone
  install), otherwise `../../.aivv/runtime-root.md` (native plugin package).
  Bind procedure paths there before opening the workflow; the consuming
  project's working directory is not the skill root.
- Before any actual review reads state, extracts context, asks a scope question,
  or dispatches a reviewer, run the selected runtime's
  `node <path>/.aivv/runtime-root.mjs --preflight aivv [skill-directory]` once
  (`.aivv/` is at the plugin root, two levels above this skill's directory; a
  standalone skill copy carries its own `.aivv/`). Export its result
  as `AIVV_ROOT` and use that same root for every helper and procedure in this
  invocation. If it reports `AIVV_INSTALLATION_INCOMPLETE`, surface that single
  diagnostic and stop; do not fall back to another installation or retry the
  missing reference.
- Real reviews: read [orchestration-workflow.md](references/orchestration-workflow.md) first; it owns execution and routes to the other references.
- Argument/config/setup/eval/maintenance: [argument-parsing.md](references/argument-parsing.md), [help-text.md](references/help-text.md), [preferences.md](references/preferences.md), [thoroughness-dial.md](references/thoroughness-dial.md), [setup-wizard.md](references/setup-wizard.md), [eval-harness.md](references/eval-harness.md), [state-maintenance.md](../../.aivv/state-maintenance.md).
- Review shape/scope: [review-shape-resolution.md](references/review-shape-resolution.md), [lens-composition.md](references/lens-composition.md), [scope-confirmation.md](references/scope-confirmation.md).
- Dispatch/prompt: [reviewer-prompt-template.md](references/reviewer-prompt-template.md), [review-dispatch-lifecycle.md](references/review-dispatch-lifecycle.md), [multi-model-dispatch.md](references/multi-model-dispatch.md).
- Output/persistence: [result-rendering-policy.md](references/result-rendering-policy.md), [setup-hint.md](references/setup-hint.md), [consensus-output-templates.md](references/consensus-output-templates.md), [self-calibration.md](references/self-calibration.md), [review-log-schema.md](references/review-log-schema.md), [viewer-hook.md](references/viewer-hook.md), [auto-chain-handoff.md](references/auto-chain-handoff.md).

<!-- CLAUDE-CODE-SPECIFIC --> Host notes: Claude Code uses its exposed progress tool (see the Claude Code adapter), `Read`/`Grep`/`Glob`, `Agent`, and
`Skill`.
<!-- Codex-SPECIFIC --> Codex uses `update_plan` when exposed, shell/`rg`,
reviewer TOML, and same-agent continuation into `/aivv-fix --review-id=<id>`.

<!-- HERMES-AGENT-SPECIFIC --> In Hermes Agent, first load the host adapter with
`read_file` using the substituted absolute path
`${HERMES_SKILL_DIR}/../../.aivv/platform-adapters/hermes-agent.md`. Do not use
`skill_view` for this sibling path; it rejects parent traversal. If the template
token remains literal, stop with `AIVV_INSTALLATION_INCOMPLETE`.
