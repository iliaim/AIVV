# `/aivv --setup` Wizard

Reference for the Step 1.2 setup branch. The wizard writes
`~/.aivv/config.json` by default, or `<target>/.aivv/config.json` with
`--setup --project`. It writes a golden-schema preferences file with
`schema_version: 6`, `_provenance: "wizard"`, and a populated
`_setup_hint_shown_at`.

## Entry Rules

`--setup` is standalone and mutually exclusive with config-management commands
and review-mode flags as defined in `argument-parsing.md`. `--target=<dir>` is
valid only with `--setup --project`; it resolves the project write path and does
not make setup a review.

Skip normal review steps 1.4 / 1.5 / 1.9 / 2 / 3 / 4 / 6 / 7 / 7.5 / 8. Step 5
is unreachable because Step 1.2 stops normal processing before dispatch.

If the host lacks interactive input, halt with the canonical non-interactive
setup error from `argument-parsing.md`. Prompt failures after earlier answers
cancel with no partial write.

## Scope

- Default: user-level `~/.aivv/config.json`.
- `--setup --project`: project-level `<target>/.aivv/config.json`.
- `--setup --project --user`: parse-time error.

## Project-Kind Detection

During setup, cheaply inspect manifests under `<target>` to infer project-kind
metadata. Preserve an existing `project_kind`; when it is unset, use the first
confident filesystem match, or `null` if there is no clear signal:

| Signal | project_kind |
|---|---|
| React/Vue/Svelte/Angular/Next markers or TSX/JSX in `src/` | `ui` |
| Python web app, Go module, Rails app, Rust binary | `backend` |
| Rust/Python/JS library markers | `library` |
| Multiple stacks | `mixed` |
| No signal | `null` |

Do not infer `project_kind` from `default_lenses`: they are independent settings.
Project kind is metadata only and never installs or replaces review lenses.
Preserve an existing valid `default_lenses` selection. If no lens selection is
configured, use the golden default `general`, regardless of project kind. Let
K be the number of lenses in that retained selection, or K=1 for fresh setup.

Project kind is not an interactive question because it does not change a review
choice. Preserve an existing value; otherwise record the cheap inference or
`null` in setup metadata.

## Questions

Q1 Thoroughness:

```text
How thorough should AIVV be by default? (default: balanced) (currently: <current>)
1. Fast - Quick sanity check. 1 reviewer, hide MINOR findings, never auto-chain into /aivv-fix
2. Balanced - Surface all findings, ask before /aivv-fix [Recommended]
3. Thorough - Multi-reviewer rigor. Kx2 reviewers, expand POLISH, auto-chain into /aivv-fix
```

Q2 After finding issues:

```text
1. Ask each time before fixing
2. Automatically apply fixes
3. Never apply fixes automatically
```

Q3 HTML report:

```text
1. HTML report link after each review/fix [Recommended]
2. Auto-open the HTML report in a browser
3. Inline output only
```

Q4 Outer loop, only if Q2 = automatically apply fixes:

```text
1. No - single pass
2. Yes - loop with recommended defaults (cap at 3 cycles, halt while MAJOR+ findings remain)
```

Q5 Smart lens detection:

```text
1. Ask when extra lenses look relevant (recommended) - lens_detection_mode: ask
2. Auto-apply smart selection (no prompt) - lens_detection_mode: smart
3. Off - explicit/default lenses only - lens_detection_mode: off
```

## Preset Bundle

K is the number of retained default lenses (one `general` lens on a fresh
setup). Q1 writes:

| Key | fast | balanced | thorough |
|---|---|---|---|
| `default_reviewers` | K | K | K x 2 |
| `default_lens_replicate` | 1 | 1 | 2 |
| `thoroughness` | fast | balanced | thorough |
| `severity_threshold` | MAJOR | MINOR | MINOR |
| `auto_chain_fix` | never | ask | always |
| `apply_polish_mode` | never | ask | ask |
| `polish_collapsed` | true | false | false |
| `post_review_html_viewer` | true | true | true |
| `post_review_html_open_mode` | link | link | link |
| `outer_loop_mode` | off | off | `until_clean` only if Q4 yes |
| `outer_loop_max_cycles` | 2 | 3 | 3 |

Resolved reviewers: K=1 -> fast/balanced 1, thorough 2; K=2 -> fast/balanced
2, thorough 4.

The wizard asks 4-5 preference questions; project kind is inferred/preserved as
metadata without prompting. The wizard does not ask for `scope_confirmation_mode`; write the golden-schema
default `ask`. It also does not ask for `fix_apply_policy`; omitted policy
resolves from schema defaults and `/aivv-fix` gates automatic application by
confidence, challenge, consequence, L1/manual-review, and write-intent checks.

## Write Metadata

Write:

- `schema_version: 6`
- `_provenance: "wizard"`
- `_setup_hint_shown_at: <UTC ISO timestamp>`
- resolved preset values, including inferred/preserved `project_kind`,
  preserved-or-defaulted `default_lenses`, `post_review_html_viewer`,
  `post_review_html_open_mode`, and `lens_detection_mode`
- `scope_confirmation_mode` at golden default (`ask`)

For `default_lenses`, the pre-write summary shows the preserved existing
selection or `general` when unset. Project-kind inference never changes it.

## Pre-Write Summary

After all questions and before writing, show resolved keys and ask:
`Press Enter to confirm and save, or Ctrl-C to cancel.`

Cold install shows the full key block. Re-run against an existing config shows a
diff only, plus `(Other keys unchanged from current config.)`. Q1 default on
re-run is the closest preset by Hamming distance over the preset bundle; ties
choose balanced.

## Post-Write Banner

After a successful write, print the path and resolved defaults:
`project_kind`, `default_reviewers`, `default_lenses`,
`default_lens_replicate`, `thoroughness`, `severity_threshold`,
`auto_chain_fix`, `apply_polish_mode`, `polish_collapsed`,
`post_review_html_viewer`, `post_review_html_open_mode`, `outer_loop_mode`,
`outer_loop_max_cycles`, and `outer_loop_severity_floor`. Then show:

```text
Override any single key with: /aivv --config-set <key>=<value>
Show resolved config with provenance: /aivv --config-show
Re-run wizard: /aivv --setup
```

## Historical Preservation

Existing v1-v5/current configs are pre-populated and preserved as input. Values
still present in the golden schema carry forward; new keys fill from golden
defaults. No `.bak` file is required. Legacy `default_M` is read and rewritten
as `default_lens_replicate`.

## Cancellation And Errors

Ctrl-C or prompt cancellation: print `Setup cancelled; no changes.` and leave
existing config untouched.

Disk or mkdir failure: print OS error and halt; no partial write.

Mid-flow prompt failure: print `Setup cancelled mid-flow (interactive prompt
unavailable at Q<N>); no changes.` and leave existing config untouched.

Implementation notes: use the host question tool, absolute or `~` paths, UTC
timestamps, JSON with 2-space indentation, and one trailing newline.

## Git-hygiene reminder (calibration corpus, per-invocation sharding contract)

The wizard does NOT write `.gitignore`/`.gitattributes` (config is its only disk write).
After confirmation, explain that generated review/fix state and calibration are
personal external data, automatic HTML reports use the user cache, and existing
project history stays untouched. Show the resolved external paths. Existing
tracked state/calibration can be browsed or explicitly imported with a preview;
new runs do not update team-tracked runtime files. No ignore-rule edits are needed.
