# Argument Parsing

Read only for non-default flags, config/setup/maintenance/eval routes, plan mode,
runtime flags, full-* wrappers, or ambiguous positionals. Core defaults live in
`../SKILL.md`.

## Config And Early Exit

- `--config-init`: write default config to `<target>/.aivv/config.json`, or
  `~/.aivv/config.json` with `--user`; refuse overwrite unless `--force`.
  Generated configs may omit `fix_apply_policy`; omitted policy resolves from the golden schema default.
- `--config-set <key>=<value>`: write one key to project config, or user config
  with `--user`. Do not materialize every schema default into the file; omitted keys still resolve from the golden schema default at runtime. Validate against
  `.aivv/schemas/config.schema.json`; `schema_version` is metadata, not a
  feature-version switch. Unknown key:
  `config-unknown-key: <key>; valid keys (golden schema): <key-list>` plus
  did-you-mean when close. Invalid value:
  `config-invalid-value: <key> <schema-violation-prose>; got '<received-value>'.`
  For enums list values; booleans append `Valid values: true, false.`; bounded
  integers append the range. `fix_apply_policy` uses the schema category set.
  Warn, do not block, for unknown `default_lenses` or nonexistent
  `default_target`.
- `--config-show` / `--config-get <key>`: resolve CLI > project > user > schema
  defaults, print value/provenance, run Step 1.5 read-only, skip dispatch/log/fix.
- `--config-init`, `--config-set`, `--config-show`, `--config-get` conflict with
  `--setup`. Review-shape flags on config-only commands warn then no-op.
- `--user`: config scope modifier; warn and ignore without config operation.
- `--force`: `--config-init` modifier only; warn and ignore elsewhere.
- `--help`: print the categorized help template at [help-text.md](help-text.md) verbatim, then exit. Do NOT paraphrase or model-compose flag descriptions. Every new flag added to this file MUST also be appended to help-text.md in the matching category in the same commit (`--show-polish` keeps its exact line `--show-polish - Force-expand POLISH for this invocation.` there).

## Review Shape

- `--predecessor-review-id=<id|none>`: explicit predecessor link; `none`
  suppresses auto-detection.
- `--lens-replicate=M`: integer 1-9; requires `--lens=` when M > 1; Step 1.4
  requires `N == K*M`.
- Full wrappers conflict with `--lens=`, `--reviewers=`, bare integer, and other
  full wrappers; `--lens-replicate=M` is allowed. M precedence: CLI
  `--lens-replicate` > config `default_lens_replicate` / legacy `default_M` >
  wrapper default > schema default.
- `--full-visual`: lenses `visual,polish`, wrapper M=3, default N=6.
- `--full-ui-ux`: lenses `visual,ux,polish,compliance,i18n,user-journey`,
  wrapper M=2, default N=12.
- `--full-a11y`: lenses `visual,compliance`, wrapper M=2, default N=4.
- `--full`: all seven specialist lenses (excluding the general default lens), wrapper M=2, default N=14.
- `--full-with-journey`: all eight specialist lenses including `user-journey` (excluding the general default lens), wrapper M=2,
  default N=16; warn that this exceeds the dev.70 tested ceiling of N=14, then
  continue unless host dispatch cannot support it.
- `--thoroughness=<tier>`: accepts exactly `fast, balanced, thorough, exhaustive`.
  Reject others with `config-invalid-value: thoroughness must be one of fast, balanced, thorough, exhaustive; got '<received-value>'.` The dial supplies defaults only; explicit `--reviewers`, `--lens-replicate`, or pinned config values win.
- `--direction` / `--no-direction`: mutually exclusive posture override. Error:
  `config-invalid-value: pass either --direction or --no-direction, not both.`

## Plan, Runtime, Eval, Maintenance

- `--plan <file>` / `--plan=<file>`: forward-looking plan/spec review. Resolve
  relative paths against `--target=<dir>` when present, otherwise cwd. Missing,
  directory, or unreadable values halt with `--plan requires a readable file path; got '<value>'`.
  Set `plan_mode = true`, `review_subject_kind = "plan"`,
  `implementation_verified = false`, and
  `verify_skip_reason = "forward-looking plan review; no implementation exists or was verified"`.
  Step 4 must include exactly: `Forward-looking plan review: implementation VERIFY is skipped; evaluate plan soundness, assumptions, sequencing, scope, evidence, and simpler alternatives.`
  Conflicts with positionals, `--setup`, `--config-*`, `--maintenance`, `--eval`,
  and `--help`; may combine with shape flags and `--fix`/`--dry-run`.
- `--runtime`, `--emit-runtime-probes`, `--ingest-runtime-results <path>` bind
  runtime-evidence behavior only. They do not authorize browser driving unless
  the runtime adapter supports it.
- `--eval`: maintainer eval path; exits before review dispatch/log/fix chain.
- `--maintenance`: state-maintenance path; exits before review dispatch.

## Setup

`--setup` is a standalone interactive wizard; the parser intentionally does not enumerate Q1-Q5 and [setup-wizard.md](setup-wizard.md) owns that flow. It
stops normal processing before Steps 1.4/1.5/1.9/2/3/4/6/7/7.5/8.

Reject `--setup` with `--config-*`, full-* flags, `--lens=`, `--reviewers=`,
bare integer, positional file/idea, runtime/eval/maintenance flags, `--fix`,
`--dry-run`, and `--show-polish`. Error:
`"--setup is a standalone wizard mode; cannot combine with <other-flag>. Run --setup alone, or use --config-set/--config-init for non-interactive defaults."`

Allowed modifiers: `--user`, `--project`, `--force`; `--target=<dir>` is only
valid with `--setup --project`. Non-interactive error:
`"--setup requires interactive TTY. Use --config-init + --config-set for non-interactive defaults."`
Prompt failure: `"Setup cancelled mid-flow (interactive prompt unavailable at Q<N>); no changes."`
`--setup --project` writes `<target>/.aivv/config.json`, conflicts with `--user`,
and `--project` outside setup warns and is ignored.

## Scope, Lens, And Multi-Model Overrides

- `--auto-lens` / `--no-auto-lens`: per-run only, mutually exclusive; force
  `lens_detection_mode` to `smart` or `off`; strip before positional parsing.
- `--auto-scope` / `--ask-scope`: accepted per-run aliases, mutually exclusive;
  strip before positionals. `--auto-scope` announces scope/method for clear
  explicit read-only requests; `--ask-scope` explicitly requests confirmation.
  Ambiguous subjects, missing authority, or material scope expansion always
  require clarification. Without either flag, the resolved config default
  applies; explicit file/idea positionals need no second approval by default.

## 2aa. `--multi-model` / `--no-multi-model`

Per-run overrides for `multi_model_enabled`; do not persist. Precedence: flag >
project `multi_model_enabled` > user `multi_model_enabled` > schema default
(`false`). Mutually exclusive error:
`"--multi-model and --no-multi-model are mutually exclusive per-run overrides; pass exactly one."`
`--multi-model` does not change reviewer count; provider selection remains capped
by effective N and ordered by `reviewer_provider_priority`. Persist with
`--config-set multi_model_enabled=true`.

## `--outer-cycle=<N>` / `--root-review-id=<id>`

Both flags (dev.113); set by `/aivv-fix` Step 6.5 for the outer-loop reverse-chain (`/aivv --fix --outer-cycle=<new_count> --root-review-id=<root_id>`). Normally not user-set.
- `--outer-cycle=<N>`: positive integer ≥1. N≥2 → pass the root id and cycle number to the outer-loop primitive, which alone reads `<state_dir>/outer-loop-<root_review_id>.json` and supplies the restored outer-loop context to later steps. N=1 or absent → fresh start. Argument parsing and later callers MUST NOT independently read the persisted outer-loop file. Passed through Step 8 to `/aivv-fix` unchanged. Mutually exclusive with the one-shot flags that skip Step 8 (`--setup`, `--config-*`, `--maintenance`, `--eval`, `--help`): on conflict the one-shot flag wins and these are silently discarded (no error).
- `--root-review-id=<id>`: the outer-cycle-1 invocation_id, unchanged across cycles; anchors the state-file path. Required when `--outer-cycle=N≥2`; absent → `root_review_id = current invocation_id`.
- SKIP-when: never skips Steps — additive Step-1 context + Step-8 propagation only. Full outer-loop semantics (canary probe, state file, no-progress algorithm, 5-banner matrix): [`.aivv/outer-loop.md`](../../../.aivv/outer-loop.md).

## Positional Rules

After stripping flags, first existing path positional means artifact review;
quoted/non-path text means idea review; no positional means session review.
Directory positional is not a project sweep; project/subtree sweep must be
stated as the session review goal.
