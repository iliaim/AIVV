---
name: aivv-view
description: "Use to inspect AIVV review and fix history, render or export reports, browse findings across reviews, or create an opt-in local remediation handoff with --inbox."
---

# AIVV View

The viewer reads AIVV history, normalizes legacy review logs into a canonical envelope, and presents summaries, reports, or a multi-review findings browser.

## Usage

```bash
/aivv-view                                     # interactive default — write/open findings browser; JSON when piped
/aivv-view <review-id>                         # specific review (positional, prefix-matched)
/aivv-view <review-id> --tui                   # force interactive fzf TUI
/aivv-view <review-id> --html                  # static HTML report to stdout
/aivv-view <review-id> --html -o report.html   # write HTML report to file
/aivv-view <review-id> --html -o report.html --open  # write report and open it
/aivv-view <review-id> --inbox                 # serve an opt-in local Action Inbox report
/aivv-view --browser                           # static multi-cycle findings browser
/aivv-view --browser -o browser.html --open    # write browser and open it
/aivv-view --list                              # enriched cycle list
/aivv-view <id> --json                         # canonical envelope JSON
/aivv-view <id> --summary                      # plain-text summary
/aivv-view --help
/aivv-view --version
```

Partial-prefix matching follows the invocation-ID format, for example a timestamp prefix can select a matching review ID. Ambiguous prefixes return exit code 70 with the candidate list.

## Storage and history

The shared installed `tools/storage-paths.mjs` resolver selects Git toplevel from
invocation cwd (canonical cwd outside Git), without creating a store for reads.
Normal viewer reads union external state/archive with known legacy directories
between cwd and that target. `--state-dir <known-directory>` and `--review-file`
remain explicit read-only history access; missing nested history is not discovered
by recursively crawling source trees. Legacy sources and their companion records
remain unchanged and historical. Active external decisions never inherit a frozen
legacy registry. Pending import copies are hidden until their manifest completes.

Automatic browser reports use the private external cache. Explicit `-o` exports
and linked `reviews/` output retain their selected destinations. Legacy pending
Inbox requests cannot execute: explicitly import the review if necessary, then
requeue selected findings through the current receiver's normal validation.

## TUI hotkeys

| Key | Action |
|-----|--------|
| `Enter` | Open finding's file:line in `$EDITOR` |
| `p` | Toggle POLISH findings (hidden by default) |
| `g` | Cycle group-by: severity → rule → file → lens |
| `r` | Open rule body in `$PAGER` |
| `w` | Show wont-fix recurrence detail |
| `/` | Search/filter (fzf built-in) |
| `?` | Help overlay |
| `q` / `ESC` | Quit |

Graceful degradation: if `fzf` is not installed, `--tui` falls back to `--summary` with an install hint.

## HTML reports

`--html` renders a self-contained single-file HTML report — no network dependencies, works offline, shareable by copying one file. It compacts and inlines CSS/JS from `templates/` at render time.

- **Sticky header** with severity chip filters (`aria-pressed` state) plus search, decisions-only placeholder, and hide addressed / verified toggle.
- **Severity-grouped sections** — CRITICAL → MAJOR → MINOR → POLISH, each with collapsible `<details>` cards.
- **Decision handoff** — static reports read optional `decisions-<review-id>.json` from the resolved external state store (or the selected read-only historical store), render per-finding decision controls, and copy a JSON payload for `/aivv-fix --resume <review-id>` or `/aivv-fix --resolve <review-id>`. The separate opt-in `--inbox` service turns selected `Fix` decisions into one typed, local request for `/aivv-fix --action-request=<uuid>`; it never executes remediation from the browser.
- **XSS-safe** — all finding data rendered through jq's `@html` filter.
- **Accessibility:** skip-to-content link, ARIA landmarks, `aria-pressed` on severity filters, focus-visible rings, `aria-live` visible-count updates, and `prefers-reduced-motion` honored on transitions.
- **Size:** bounded by a normalized corpus budget (static shell + per-finding allowance). The renderer compacts embedded CSS/JS at output time and avoids duplicated card-body prose while preserving issue metadata and full visible-summary search.

```bash
/aivv-view --html -o review.html --open
```

`--open` is only valid with `--html -o report.html` or `--browser -o browser.html`; stdout HTML cannot be opened because there is no generated file path. The script-level opener uses the host OS default browser (`open`, `xdg-open`, or PowerShell) and respects `AIVV_QUIET=1`, `AIVV_HEADLESS=1`, `CI=true`, and display-less Linux environments by writing the report without launching a browser. In automatic `/aivv` and `/aivv-fix` flows, the active platform adapter owns any native auto-open behavior when `post_review_html_open_mode=open`; this script remains portable and host-neutral. Bare interactive `/aivv-view` is browser-first and writes the browser under the external target-instance report cache; piped bare invocations still emit JSON for scripts.

## Findings browser

`--browser` renders a static multi-cycle HTML index over review logs in
the external `state/` and `state/archive/`, plus bounded read-only legacy directories. The active-state copy wins, with a
warning, if the same review filename exists in both locations. It is read-only:
it summarizes open, no-fix-session, fix-unjoinable, addressed-unverified,
verified-resolved, deferred, wont-fix, legacy-fixed-claim, severity, and
warning counts across cycles without writing state, calibration, decisions, or
lifecycle incidents.

```bash
/aivv-view --browser -o browser.html --open
```

The browser consumes the same loader and humanize pipeline as `--html`, then renders a searchable static table. When written with `-o`, it also writes a sibling `reviews/` directory of linked single-review reports so users can move from a cycle row to the detailed report and back.

## Decisions Clipboard Handoff

Static HTML reports support a read-only decision capture surface. Users can select `fix`, `defer`, `wont_fix`, or `needs_info` on actionable finding cards, then copy a Draft-07-compatible payload shaped like `.aivv/schemas/decisions.json`.

The payload is intended for one of these follow-up paths:

```bash
/aivv-fix --resume <review-id>   # consume an existing decisions-<review-id>.json if present
/aivv-fix --resolve <review-id>  # require decisions before applying selected outcomes
```

The viewer may read `decisions-<review-id>.json` in the selected state store to preselect existing decisions, but it never writes state. Clipboard handoff keeps the user or `/aivv-fix` as the writer.

## Opt-in Action Inbox

`/aivv-view <review-id> --inbox` starts a short-lived `127.0.0.1` report server and prints its URL. It requires the review's canonical external target-instance state directory, so every request is claimable by the documented receiver. In that local report, users select any number of findings and choose **Review and remediate selected**. The final confirmation enters a visible pending state, then creates exactly one immutable request shard under the external `state/action-inbox/`; the report exposes a copyable exact handoff to an eligible agent. The request contains only the selected review findings and bounded notes. It cannot run a shell command, target another project, or wake an agent.

The next eligible agent explicitly consumes the request with `/aivv-fix --action-request=<uuid> --target=<project>`. That route claims it once, rejects expiry/target/revision/workspace-snapshot drift, re-reads the review, and then follows ordinary triage, investigation, write-intent, and verification gates. A second request overlapping a queued finding from the same review revision is rejected across Inbox processes so two agents cannot remediate it concurrently. Static `--html` reports stay offline and clipboard-only.

## Historical Compatibility Index

Historical review/fix logs may lack deterministic fingerprints or canonical join keys. Compatibility is derived-index-only: resolve `AIVV_ROOT` through the bundled `.aivv/runtime-root.md` runtime-root contract, then run `node "$AIVV_ROOT/tools/state-compat-index.mjs"` to scan the canonical external state store or an explicitly selected historical store, emit a schema-validated `.aivv/schemas/state-compat-index.json` artifact, and leave original logs unchanged.

The helper proposes only deterministic values from existing fields and records ambiguous or non-backfillable gaps as `unsafe`. It rejects mutation flags such as `--apply` and `--in-place`; in-place historical migration requires a separate future plan and explicit authorization.

## Reference

- [Canonical envelope schema](references/canonical-envelope-schema.json) — JSON Schema for `--json` output.
- [Decisions schema](../../.aivv/schemas/decisions.json) — JSON Schema for copied or saved decisions handoff files.
- [Action Inbox request schema](../../.aivv/schemas/remediation-request.json) — typed, immutable selected-findings request.
- [Action Inbox fix route](../aivv-fix/references/action-inbox.md) — receiver claim, revalidation, and ordinary-gate contract.
- [Derived state compatibility index schema](../../.aivv/schemas/state-compat-index.json) — JSON Schema for deterministic historical backfill proposals.
- [Projection table](references/projection-table.md) — per-shape enumeration of the 15 historical variants + alias priority rules.
- [Loader warnings taxonomy](references/loader-warnings.md) — 9 warning kinds partitioned into `expected` (operational) and `anomalous` (drift signal).
- [Humanize module](references/humanize.md) — centralized translation pipeline that adds `*_label` fields to the canonical envelope.
- [Report renderer contract](references/report-renderer-contract.md) — stable input/output, read-only, compatibility, and size-policy boundary for HTML renderers.

## Runtime

Hard deps: `bash`, `git`. Required: `jq`; the viewer hard-fails at invocation with install hint when absent (no degraded mode exists — the loader requires jq). `node` is required for shared path resolution and incomplete-import visibility checks, including static reports.

## Boundaries

Viewing and static reports do not change review, fix, calibration, or decision records. Reports may be written to the selected output or private cache. The opt-in `--inbox` route creates a local, immutable remediation request; only `/aivv-fix` can consume it, and the viewer never runs a fix. Historical logs remain unchanged.
