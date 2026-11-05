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

Before Q1, inspect manifests under `<target>` to infer project kind. First
confident match wins:

| Signal | project_kind |
|---|---|
| React/Vue/Svelte/Angular/Next markers or TSX/JSX in `src/` | `ui` |
| Python web app, Go module, Rails app, Rust binary | `backend` |
| Rust/Python/JS library markers | `library` |
| Multiple stacks | `mixed` |
| No signal | `null` |

Existing config can also inverse-map `default_lenses`: `["visual","ux"]` ->
`ui`, `["code","sec"]` -> `library`, `["visual"]` -> `ui`, plain `code` ->
`null`. Existing user config wins over filesystem inference when they disagree.

Project kind maps to `default_lenses`:

| project_kind | default_lenses | K |
|---|---|---|
| `ui` | `["visual","ux"]` | 2 |
| `backend` | `"code"` | 1 |
| `mixed` | `"code"` | 1 |
| `library` | `["code","sec"]` | 2 |
| `null` | `"code"` | 1 |

Show Q1 only when detection/inverse-map has no useful result; otherwise record
the detected kind in the pre-flight summary.

## Questions

Q1 Project kind (only when not detected):

```text
What kind of code does this project mostly have?
1. UI / frontend work
2. Backend / API work
3. Mixed (full-stack)
4. Library / SDK (security-sensitive code paths)
5. Skip - leave on default
```

Q2 Thoroughness:

```text
How thorough should AIVV be by default? (default: balanced) (currently: <current>)
1. Fast - Quick sanity check. 1 reviewer, hide MINOR findings, never auto-chain into /aivv-fix
2. Balanced - Surface all findings, ask before /aivv-fix [Recommended]
3. Thorough - Multi-reviewer rigor. Kx2 reviewers, expand POLISH, auto-chain into /aivv-fix
```

Q3 After finding issues:

```text
1. Ask each time before fixing
2. Automatically apply fixes
3. Never apply fixes automatically
```

Q4 HTML report:

```text
1. HTML report link after each review/fix [Recommended]
2. Auto-open the HTML report in a browser
3. Inline output only
```

Q5 Outer loop, only if Q3 = automatically apply fixes:

```text
1. No - single pass
2. Yes - loop with recommended defaults (cap at 3 cycles, halt while MAJOR+ findings remain)
```

Q6 Smart lens detection:

```text
1. Ask when extra lenses look relevant (recommended) - lens_detection_mode: ask
2. Auto-apply smart selection (no prompt) - lens_detection_mode: smart
3. Off - explicit/default lenses only - lens_detection_mode: off
```

## Preset Bundle

K is the number of default lenses. Q2 writes:

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
| `outer_loop_mode` | off | off | `until_clean` only if Q5 yes |
| `outer_loop_max_cycles` | 2 | 3 | 3 |

Resolved reviewers: K=1 -> fast/balanced 1, thorough 2; K=2 -> fast/balanced
2, thorough 4.

The wizard does not ask for `scope_confirmation_mode`; write the golden-schema
default `ask`. It also does not ask for `fix_apply_policy`; omitted policy
resolves from schema defaults and `/aivv-fix` gates automatic application by
confidence, challenge, consequence, L1/manual-review, and write-intent checks.

## Write Metadata

Write:

- `schema_version: 6`
- `_provenance: "wizard"`
- `_setup_hint_shown_at: <UTC ISO timestamp>`
- resolved Q1-Q6 keys, including `project_kind`, `default_lenses`,
  `post_review_html_viewer`, `post_review_html_open_mode`, and
  `lens_detection_mode`
- `scope_confirmation_mode` at golden default (`ask`)

## Pre-Write Summary

After all questions and before writing, show resolved keys and ask:
`Press Enter to confirm and save, or Ctrl-C to cancel.`

Cold install shows the full key block. Re-run against an existing config shows a
diff only, plus `(Other keys unchanged from current config.)`. Q2 default on
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
