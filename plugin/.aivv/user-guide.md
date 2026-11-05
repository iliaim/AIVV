# AIVV User Guide

This guide is the short path for everyday AIVV use. Common workflows are first, with the full flag catalog left to advanced references.

## Common Workflows

| Goal | Run | Notes |
|---|---|---|
| Review current session work | `/aivv` | Default: one general reviewer. |
| Review with more confidence | `/aivv --reviewers=2` | Uses two reviewers when cold reviewer dispatch is available. |
| Review a file | `/aivv path/to/file` | Relative paths resolve from the current target project. |
| Challenge an idea | `/aivv "Should we use Redis here?"` | Treats the quoted text as the review subject. |
| Review a plan before building | `/aivv --plan docs/plan.md` | Forward-looking review; implementation verification is skipped. |
| Review and then fix | `/aivv --reviewers=2 --fix` | Chains into `/aivv-fix` after the review log is written. |
| Preview fixes without applying | `/aivv --reviewers=2 --fix --dry-run` | Investigates and plans only; no remediation writes. |
| Fix findings from a review | `/aivv-fix --review-id=<review-id>` | Uses the durable review log instead of rescanning chat. |
| Inspect review output | `/aivv-view` | Read-only viewer over local AIVV state. |

## Choosing Review Shape

Start with `/aivv`. Add shape only when the work needs it:

- Use `--reviewers=2` for ambiguous, high-risk, or decision-heavy work.
- Use `--lens=sec` for security-focused review.
- Use `--lens=visual` for static UI/visual review.
- Use `--full-a11y` for accessibility conformance review.
- Use `--full` only when broad coverage is worth the cost and time.

The full flag catalog remains available through `/aivv --help` and `skills/aivv/references/argument-parsing.md`.

## Target And State

AIVV writes review logs, fix logs, and calibration under the resolved target project's `.aivv/` directory. In normal use, run AIVV from the project you are reviewing.

Use `--target=/path/to/project` when the current working directory is not the project whose state should receive the logs.

## Safe Fix Path

Prefer review-log handoff for fixes:

```text
/aivv --reviewers=2 --fix --dry-run
/aivv-fix --review-id=<review-id>
```

`--dry-run` is the safe preview path. It still runs collection, triage, investigation, and fix planning, but it does not apply changes.

`--dangerously-auto-apply` is a per-run bypass for advanced users. It is intentionally not a default and cannot be set persistently.

## Advanced References

- Configuration: `.aivv/configuration.md`
- Methodology and scope boundary: `.aivv/methodology.md`
- Runtime and host contracts: `.aivv/runtime-contract.md`
- Full `/aivv` flag rules: `skills/aivv/references/argument-parsing.md`
- Full `/aivv-fix` flag rules: `skills/aivv-fix/references/fix-flags.md`

## Glossary

Concise definitions for AIVV's core vocabulary. Full contracts live in the shipped references linked from each entry.

- **IV&V** — Independent Verification and Validation: reviewing work with people/agents not involved in producing it. AIVV substitutes structural independence (a separate engineering team) with cold spawning, context isolation, adversarial prompting, and lens separation. What each mechanism actually delivers is honestly bounded in `.aivv/methodology.md` "The Core Claim".
- **Lens** — a methodological viewpoint applied by a reviewer (`code`, `sec`, `visual`, `ux`, `polish`, `compliance`, `i18n`, `user-journey`). Selected via `--lens=<name>`. Lens catalogs live at `.aivv/lenses/`.
- **Reviewer** — an isolated agent that reads the review target and emits findings. "Cold" means spawned without inherited conversation history; "isolated" means it sees only what the orchestrator explicitly passes.
- **Finding** — one discrete issue emitted by a reviewer, carrying severity, location, and grounded evidence.
- **`review_mode` values** — how reviewers were dispatched:
  - `cold_single_review` — one isolated reviewer (default).
  - `cold_multi_review` — N isolated reviewers plus consensus synthesis (`--reviewers=N`).
  - `cold_multi_model` — provider-diverse dispatch across model vendors.
  - `same_agent_review` — fallback with no independent epistemic signal; always surfaced to the user, never silent.
  - `evidence_only_review` — review from supplied evidence artifacts only.
- **Severity tiers (defect track)** — **CRITICAL** (catastrophic/severe harm reachable under real-world conditions), **MAJOR** (serious impact after likelihood and exposure), **MINOR** (real defect, limited or bounded impact).
- **POLISH** — orthogonal to the defect tiers. A value-add improvement suggestion where the reviewer can articulate both the specific improvement AND the specific value. If either cannot be articulated, the finding is dropped instead of downgraded to MINOR.
- **Trust Card** — a compact block rendered before findings that summarizes `review_mode`, reviewers, lenses, capability degradations, applied filters, and evidence posture — so you can calibrate how much to trust the run. See `skills/aivv/references/result-rendering-policy.md`.
- **Thoroughness (dial)** — effort tier controlling review depth: `fast` | `balanced` (default) | `thorough` | `exhaustive`. Configured via the `thoroughness` config key or `--thoroughness=` flag. Full mechanics: `skills/aivv/references/thoroughness-dial.md`.
- **wont-fix registry** — a persisted fingerprint list (`wont-fix-registry.json` in the resolved external state directory) of findings the user explicitly accepted as not-to-fix; prevents re-surfacing on later runs.
- **Calibration** — the append-only JSONL corpus (`<lens>/*.jsonl` per-invocation shards in the resolved external calibration directory) recording per-invocation reviewer outcomes for FP/TP analytics. Persisted per-target-project. Format: `.aivv/calibration/README.md`.

## Runtime storage and older history

Normal review/fix state and calibration are personal, persistent application data
outside the project. Resolve paths with the shipped `tools/storage-paths.mjs` through
`runtime-root.md`; do not recreate platform paths in callers. Automatically rendered
reports use cache, disposable scratch uses private unique temp directories.

Legacy project records remain read-only history. Browsing requires no import; old
suppressions and resumable workflows require explicit `state-import.mjs preview`
then `import` for the selected source and target. Conflicts offer keep-current or
replace while preserving the current version as history. Repeated import does not
silently restore forgotten decisions. Known nested history has an explicit file/store
route; there is no recursive source-tree scan. Pending legacy Inbox requests must be
requeued, and current target/revision/workspace checks still apply.

Separate worktrees and clones do not share active state. A recreated checkout cannot
automatically inherit old decisions; unsupported filesystem identity needs explicit
attachment. Old clients remain historical writers, not synchronized peers. Generated
records no longer update tracked team corpora. Authored project config and explicit
report/probe exports retain their destinations. No normal invocation edits ignore
rules or deletes/moves legacy files.
