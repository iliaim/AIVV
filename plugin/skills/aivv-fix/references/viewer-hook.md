# Viewer Hook

Read from `skills/aivv-fix/SKILL.md` when review/fix viewer behavior is enabled.

## Contents

- Post-fix HTML viewer hook
- Viewer command
- Open-report affordance
- Non-blocking failure behavior

**Step 7.8: Optional post-fix HTML viewer hook**

If the fix session source is `review_id`, resolved `post_review_html_viewer` is true, the invocation is not `--dry-run`, and Step 7 has completed the fix log plus review-log backfill, render a joined review/fix HTML report:

```bash
AIVV_CODEX_HOME="${CODEX_HOME:-${HOME:-}/.codex}"
AIVV_RUNTIME_ROOT_HELPER="${AIVV_RUNTIME_ROOT_HELPER:-}"
for AIVV_RUNTIME_ROOT_CANDIDATE in \
  "${AIVV_ROOT:-}/.aivv/runtime-root.mjs" \
  "${CLAUDE_PLUGIN_ROOT:-}/.aivv/runtime-root.mjs" \
  "${PLUGIN_ROOT:-}/.aivv/runtime-root.mjs" \
  "${SKILL_BASE_DIR:-}/.aivv/runtime-root.mjs" \
  "${SKILL_BASE_DIR:-}/../../.aivv/runtime-root.mjs" \
  "$AIVV_CODEX_HOME/aivv-runtime/.aivv/runtime-root.mjs"; do
  if [ -z "$AIVV_RUNTIME_ROOT_HELPER" ] && [ -f "$AIVV_RUNTIME_ROOT_CANDIDATE" ]; then
    AIVV_RUNTIME_ROOT_HELPER="$AIVV_RUNTIME_ROOT_CANDIDATE"
  fi
done
if [ -z "$AIVV_RUNTIME_ROOT_HELPER" ]; then
  echo "AIVV runtime-root resolver not found; set AIVV_ROOT, PLUGIN_ROOT, CODEX_HOME, or SKILL_BASE_DIR" >&2
  exit 1
fi
AIVV_ROOT="$(node "$AIVV_RUNTIME_ROOT_HELPER" --print "${SKILL_BASE_DIR:-}")"
storage_context="$(cat "$storage_context_file")"
state_dir="$(printf '%s' "$storage_context" | jq -r .state_dir)"
reports_dir="$(printf '%s' "$storage_context" | jq -r .reports_dir)"
node "$AIVV_ROOT/tools/storage-paths.mjs" ensure-cache --context "$storage_context_file" >/dev/null
bash "$AIVV_ROOT/skills/aivv-view/scripts/view.sh" \
  --state-dir "$state_dir" \
  --storage-context "$storage_context_file" \
  --review-id "$source_review_id" \
  --html \
  -o "$reports_dir/review-$source_review_id.html"
```

If no originating review ID exists (for example, an ad-hoc `/aivv-fix` invocation from conversation text), skip the viewer with a one-line warning instead of guessing. The hook is non-blocking. Viewer failure prints a warning and does not change the fix-session status. The viewer does not create lifecycle incidents; the fix owner decides separately whether one is warranted. If the viewer script is unavailable on a host, emit a capability warning and continue.

On successful generation, always show a clear user-facing affordance:

```text
HTML report ready: [Open report](<absolute-report-path>)
```

If resolved `post_review_html_open_mode == "link"` (recommended default), stop after showing the link/path. If resolved `post_review_html_open_mode == "open"`, also best-effort open the generated report using the active platform adapter’s report-opening route when it provides one. If that route is unavailable or cannot open the target, rerun the viewer command with `--open` to use the viewer’s OS opener. Open failures are non-fatal; keep the `Open report` link visible.
