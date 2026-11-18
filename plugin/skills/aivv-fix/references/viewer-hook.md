# Viewer Hook

Read from `skills/aivv-fix/SKILL.md` when review/fix viewer behavior is enabled.

The viewer command, open-report affordance, open modes and non-blocking failure
rules are owned by the `/aivv` hook:
[`skills/aivv/references/viewer-hook.md`](../../aivv/references/viewer-hook.md).
This file holds only the post-fix differences.

**Step 7.8: Optional post-fix HTML viewer hook**

If the fix session source is `review_id`, resolved `post_review_html_viewer` is true, the invocation is not `--dry-run`, and Step 7 has completed the fix log plus review-log backfill, render a joined review/fix HTML report.

Run the `/aivv` hook's viewer command with these substitutions:

- `--review-id "$source_review_id"` instead of `$review_id`.
- Output path `"$reports_dir/review-$source_review_id.html"`.
- Reuse the `AIVV_ROOT` preflighted at this `/aivv-fix` invocation's start; do not resolve it again.

Post-fix differences from the `/aivv` rules:

- If no originating review ID exists (for example, an ad-hoc `/aivv-fix` invocation from conversation text), skip the viewer with a one-line warning instead of guessing.
- Viewer failure prints a warning and does not change the fix-session status. The fix owner, not the viewer, decides whether a lifecycle incident is warranted.
- The `/aivv` rule that skips its hook when a fix chain will run does not apply here; this is the hook that chain defers to.
