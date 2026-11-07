# Viewer Hook

Read from `skills/aivv/SKILL.md` when optional post-review HTML viewer behavior is enabled.

## Contents

- Viewer trigger conditions
- Report generation
- User-facing affordance
- Open-mode behavior

### Step 7.6: Optional HTML viewer hook

If resolved config has `post_review_html_viewer: true` AND no fix chain will run (`--fix` was not set and resolved `auto_chain_fix` did not set `fix_chain_requested = true`), render a static HTML report after Step 7.5 has written durable review state:

```bash
# AIVV_ROOT was resolved and preflighted once at invocation start. Keep this
# post-review hook on that same installation; do not resolve again here.
if [ -z "${AIVV_ROOT:-}" ]; then
  echo "AIVV invocation lost its preflighted runtime root; viewer hook stopped" >&2
  exit 3
fi
storage_context="$(cat "$storage_context_file")"
state_dir="$(printf '%s' "$storage_context" | jq -r .state_dir)"
reports_dir="$(printf '%s' "$storage_context" | jq -r .reports_dir)"
node "$AIVV_ROOT/tools/storage-paths.mjs" ensure-cache --context "$storage_context_file" >/dev/null
bash "$AIVV_ROOT/skills/aivv-view/scripts/view.sh" \
  --state-dir "$state_dir" \
  --storage-context "$storage_context_file" \
  --review-id "$review_id" \
  --html \
  -o "$reports_dir/review-$review_id.html"
```

Operational rules:
- This hook runs only after `review-<invocation_id>.json` exists.
- If a fix chain will run, skip this hook here; `/aivv-fix` Step 7 owns the post-fix viewer so the user sees the resolved state after remediation.
- Viewer generation is best-effort. If the command exits non-zero, print `AIVV HTML viewer skipped: viewer command exited non-zero; report was not generated` and continue. Surface the viewer's warning and continue; do NOT mark the review failed. The viewer itself never creates a lifecycle incident; the review owner decides separately whether an incident is warranted.
- If the viewer script is unavailable on a host, emit a one-line capability warning and continue. The preference is a convenience surface, not a correctness gate.
- On successful generation, always show a clear user-facing affordance:
  ```text
  HTML report ready: [Open report](<absolute-report-path>)
  ```
  Use the host's clickable local-file-link convention when available; otherwise print the absolute path and the manual `aivv view` command.
- If resolved `post_review_html_open_mode == "link"` (recommended default), stop after showing the `Open report` affordance. Do not steal browser focus.
- If resolved `post_review_html_open_mode == "open"`, also best-effort open the generated report using the active platform adapter’s report-opening route when it provides one. If that route is unavailable or cannot open the target, rerun the viewer command with `--open` to use the viewer’s OS opener. Open failures are non-fatal; keep the `Open report` link visible.

---
