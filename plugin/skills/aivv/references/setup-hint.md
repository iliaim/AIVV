# Setup Hint + Walkthrough Markers (Step 6)

Read only when Step 6 may emit first-run setup guidance or walkthrough hints.
State lives in `~/.aivv/config.json`, not marker files.

## Mechanisms

| Mechanism | Suppression field | Emits |
|---|---|---|
| Setup hint | `_setup_hint_shown_at` string/null | Top of Step 6, before diagnostics, Trust Card, findings |
| Walkthrough markers | `_walkthrough_hints_shown` object of marker id -> string/null | Inline at feature-specific first use |

Re-arm with:
- `/aivv --config-set _setup_hint_shown_at=null --user`
- `/aivv --config-set _walkthrough_hints_shown='{}' --user`

Dotted writes such as `_walkthrough_hints_shown.first_findings_rendered=null`
are unsupported; write the whole object with JSON literal.

## Setup Hint

Emit only when all conditions hold:

1. `~/.aivv/config.json` exists and resolved `_setup_hint_shown_at` is `null` or absent.
2. Invocation is normal `/aivv`, not `--setup`, `--config-init`,
   `--config-set`, `--config-show`, `--config-get`, `--maintenance`, or `--help`.
3. Review was not voided by `WORKSPACE_DRIFT_VOIDED_REVIEW`.

Microcopy, as the first user-visible Step 6 line:

```text
Tip: AIVV is using defaults ({reviewers} reviewer{plural-s}, {lens-summary}, {severity_threshold}-and-above severity). Configure with /aivv --setup (4-6 questions) - this hint won't appear again
```

Substitutions:
- `{reviewers}` from resolved `default_reviewers`.
- `{plural-s}` is `s` iff reviewers > 1.
- `{lens-summary}` is `code lens` for a string or `visual+ux lenses` for an array.
- `{severity_threshold}` is resolved enum value.

No trailing period and no leading emoji.

After rendering, read `~/.aivv/config.json`, set `_setup_hint_shown_at` to the
current UTC ISO 8601 timestamp, and write the whole config atomically. If read or
write fails after rendering, warn:

```text
⚠ Could not persist setup-hint-shown timestamp: <error>; hint may re-emit on next invocation
```

If config file existence check fails before rendering, skip silently; Step 1.5
already surfaced the auto-create/write warning.

## Walkthrough Marker: `first_findings_rendered`

Trigger when all conditions hold:

1. `review_mode` is `cold_single_review` or `cold_multi_review`.
2. At least one displayed DEFECT-tier finding remains after severity-threshold
   filtering: CRITICAL, MAJOR, or MINOR. POLISH-only output does not trigger.
3. `_walkthrough_hints_shown.first_findings_rendered` is absent or null.
4. Review was not voided and config file exists.

Emit after the entire Case A/B findings block, including POLISH, and before the
Significance Hint:

```text
Tip: /aivv-fix investigates and applies targeted remediation for these findings. /aivv --reviewers=N --fix requests auto-chain; consequential findings may still show a Decision Checkpoint, and non-interactive runs may route to dry-run only - this hint won't appear again
```

No trailing period.

After rendering, read the user config, initialize `_walkthrough_hints_shown` to
`{}` if absent, set `.first_findings_rendered` to the current UTC ISO timestamp,
and write the entire config object atomically. Same warning-and-continue behavior
as setup hint.

## Suppression Rules

- Voided review: skip all hints and writes.
- `same_agent_review`: setup hint still emits; walkthrough hint is skipped
  because same-agent findings are not independent IV&V signal.
- Config file absent: skip all hints and writes; do not add a second warning.
- Skip commands listed above bypass Step 6.
- Clean review, all findings filtered out, or POLISH-only: setup hint may emit;
  `first_findings_rendered` does not.

## Step 6 Ordering

When both hints fire:

1. Setup hint at very top.
2. Severity-threshold diagnostic if non-default.
3. Trust Card.
4. Case A/B findings including POLISH.
5. `first_findings_rendered` walkthrough hint.
6. Significance Hint.
7. `/aivv-fix` recommendation.

Marker IDs use past-tense names (`*_rendered`, `*_shown`, `*_completed`) because
the write occurs after display. `_walkthrough_hints_shown` allows arbitrary keys;
AIVV itself writes only registered marker IDs.
