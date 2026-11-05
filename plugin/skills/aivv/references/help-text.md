# --help Output Template

Canonical categorized help text printed by `/aivv --help`. This file is the single verbatim source for the primary learnability surface — the orchestrator prints its contents verbatim on `--help` and exits before any review/state work. Do NOT paraphrase, reword, or model-compose per-flag descriptions at render time.

**Maintenance rule.** Every new flag added to [argument-parsing.md](argument-parsing.md) MUST be appended here in the matching category in the same commit. The pre-dev.283 version of this template was deleted in the router compaction (only `--show-polish` survived, because it alone carried a validate.sh pin) — restoring it is F010; keeping it in sync is the standing rule.

## Verbatim Template

```text
AIVV — Agentic Independent Validation & Verification

Common workflows:
  See .aivv/user-guide.md for the everyday review / fix / view paths.
  Representative: /aivv | /aivv --reviewers=2 --fix [--dry-run] | /aivv-view

Review-shape flags:
  --reviewers=N                     Dispatch N cold reviewer subagents (1-9)
  --lens=<X>[,<Y>...]               Lens(es): general, code, sec, visual, ux, polish, compliance, i18n, user-journey
  --lens-replicate=M                Reviewers per lens (K×M composition; requires --lens= when M>1)
  --thoroughness=<tier>             Effort dial: fast | balanced | thorough | exhaustive (default: balanced)
  --direction | --no-direction      Force-enable / disable the direction-challenge posture this run
  --target=<dir>                    Scope state writes and relative path resolution to <dir>
  --fix                             Request auto-chain into /aivv-fix after the review
  --dry-run                         With --fix: chained fix path is plan-only. Alone: still runs the review + writes logs
  --show-polish                     Force-expand POLISH for this invocation.
  --plan <file>                     Forward-looking plan/spec review; no implementation verified
  --predecessor-review-id=<id|none> Explicit predecessor review link ('none' suppresses auto-detection)

Full-* wrapper flags (set lens list + reviewer count atomically; conflict with --lens=, --reviewers=, and each other):
  --full-visual                     visual,polish
  --full-a11y                       visual,compliance
  --full-ui-ux                      visual,ux,polish,compliance,i18n,user-journey
  --full                            all seven specialist lenses (excludes general)
  --full-with-journey               all eight specialist lenses incl. user-journey (excludes general; warns above tested ceiling)

Runtime-evidence flags:
  --runtime                         Runtime-evidence mode (external probe emit/ingest)
  --emit-runtime-probes             Generate the runtime-probes manifest + Playwright spec scaffolds
  --ingest-runtime-results <path>   Ingest user-run Playwright JSON reporter output

Auto lens / scope:
  --auto-lens | --no-auto-lens      Force / disable smart lens detection this run
  --auto-scope | --ask-scope        --auto-scope is deprecated; both require confirmation
  Every review confirms its subject, materials, and method before dispatch, including --dry-run

Multi-model flags (per-run overrides; do not persist):
  --multi-model | --no-multi-model  Force cross-provider (Case D) / native review this run

Configuration:
  --setup [--project]               Run the interactive setup wizard (user scope; --project for project scope)
  --config-init [--user] [--force]  Write a default config file (refuses overwrite without --force)
  --config-show                     Print resolved config with provenance (CLI > project > user > schema)
  --config-set <key>=<value>        Set a single config key
  --config-get <key>                Get the effective value for one key

Maintenance / eval:
  --maintenance                     Quarantine sweep + index rebuild; no review dispatch
  --eval [--lens=<X>]               Maintainer-side eval corpus run; exits before review dispatch

Modifiers:
  --user                            Scope config writes to user level (~/.aivv/)
  --project                         With --setup: scope the wizard write to project level
  --force                           With --config-init: overwrite existing config

Outer-loop plumbing (internal — set by /aivv-fix Step 6.5; not typically user-set):
  --outer-cycle=<N>                 Positive integer ≥1; N≥2 resumes an outer-loop state file
  --root-review-id=<id>             Outer-cycle-1 invocation id; required when --outer-cycle=N≥2

For full documentation: see .aivv/user-guide.md, .aivv/configuration.md, and .aivv/methodology.md.
```

## Conflict behavior

`--help` ignores all other flags (`/aivv --help --reviewers=2` prints help and exits). Do not error on combinations.
