# Review ID Resolution

Read from `skills/aivv-fix/SKILL.md` when resolving `--review-id` before source parsing.

## Contents

- Review log path resolution
- Failure-mode ordering
- Durable finding object construction
- Stale path handling

### Step 1.05: `--review-id` resolution and failure-mode handling

If `--review-id=<id>` was set in flag extraction, resolve the review log BEFORE Step 1's source parsing. The review log is the source of findings (overrides conversation Signal 0-4 scanning); its `target_project` informs the target resolver.

**Resolution algorithm (orchestrator-mediated; no Python required):**

Bind `<target>` and external `<state_dir>` via `.aivv/target-resolution.md`. Let `<rev_id>` be the requested id. Use the shared storage `list --area state --prefix review- --archive` and `read` commands with the cached context to resolve `review-<rev_id>.json`; returned archive-relative paths remain authoritative and incomplete imports are excluded. Retain the selected relative path as `FixSession.source_review_relative_path` (for example `archive/review-<id>.json`) and set `<rev_log_path>` from that exact selection. If listing returns both `review-<rev_id>.json` and `archive/review-<rev_id>.json`, select the active-root `review-<rev_id>.json` and emit one deterministic duplicate warning. Otherwise select the actual returned archive-relative path. Set `source_review_relative_path` from that selection, not from the ID or listing order. Never reconstruct a root filename downstream. Historical legacy lookup is bounded to the target/cwd ancestors or an explicit source; if found only there, report import-needed before mutable continuation, preserving the source. Missing-ID diagnostics name searched paths and the explicit source/import route.

Apply each failure-mode check in order. The first matching check halts the invocation with the documented exit code (or returns the documented info path).

| Order | Check | Action on match |
|---|---|---|
| 1 | `<rev_log_path>` does not exist | Surface `REVIEW_NOT_FOUND: no review-<rev_id>.json at <state_dir>/`. Exit code 2. |
| 2 | File exists but JSON parse fails | Surface `REVIEW_CORRUPT: <rev_log_path> failed to parse: <error>`. Exit code 3. |
| 3 | Parsed log's `schema_version` > current supported max (currently 2; see schema gate note at Step 1.0) | Surface `REVIEW_SCHEMA_NEWER: review-<rev_id>.json has schema_version <N>; this AIVV version supports review-log schema up to <M>. Upgrade AIVV or run without selecting this review. Do not edit/delete audit history in place; preserve it as historical input; do not edit it to bypass validation.` Exit code 6. |
| 4 | `target_project` field present and `os.path.abspath(target_project) != os.path.abspath(<target>)` | Surface `REVIEW_TARGET_MISMATCH: review was written from <X> but current cwd/target is <Y>; pass --target=<X> or rerun from that directory`. Exit code 4. |
| 5 | `findings` array is empty | Surface `REVIEW_NO_FINDINGS: review-<rev_id>.json has zero findings; nothing to fix`. Exit code 0 (clean exit, not error). |
| 6 | `review_mode == "evidence_only_review"` | Surface info `EVIDENCE_ONLY_HANDOFF: skipping file-clustering Step 1 signal scan; review was evidence-only`. Continue (exit code TBD by remaining flow). |
| 7 | `review_mode == "same_agent_review"` | Surface warning `WARNING: review-<rev_id>.json was produced by same_agent_review (non-independent self-review). Treat findings as a self-checklist; run /aivv --reviewers=2 for a second opinion before applying fixes.` Then prompt `Continue with these findings anyway? [y/N]`. Continue only on explicit user confirmation. |

When all checks pass (or only the info/warning ones fired), the orchestrator constructs an in-context object with these fields for downstream Steps 2-7:

```text
{
  "source":         "review_id",
  "review_id":      "<rev_id>",
  "source_review_relative_path": "<selected relative path, including archive/>",
  "review_mode":    "<from log>",
  "target_project": "<from log>",
  "lens":           "<from log, default 'code'>",
  "findings":       <findings array from log>
}
```

Each finding collected from the review log receives a durable `location` before Step 2:

```text
location = finding.file when file is a non-empty string;
location = finding.scope_ref when scope_ref.kind and scope_ref.ref are non-empty strings;
otherwise location = null and the finding requires clarification before execution.
```

Exactly one location form is valid. Do not synthesize a `file` or `file_path` for scoped findings.

<!-- CLAUDE-CODE-SPECIFIC -->
On both hosts use the shipped storage `read` command for active records; native reads are only for explicit historical input. For the `os.path.abspath` comparison in check 4, use the host's path-canonicalization primitive (Claude Code: agent reasons about paths; Codex: agent reasons about paths). No Python interpreter is invoked.

**Failure mode summary** (each mode emits a stable error code prefix and a non-zero exit code):

| Mode | Trigger | Error prefix | Exit code |
|---|---|---|---|
| (a) cwd mismatch | `target_project` in review log != current target | `REVIEW_TARGET_MISMATCH` | 4 |
| (b) codebase drift | file-backed `file` field does not exist at fix-application time | `REVIEW_STALE_PATHS` | per-finding skip; summary at end |
| (c) evidence-only handoff | `review_mode == "evidence_only_review"` | `EVIDENCE_ONLY_HANDOFF` (info, proceeds) | 0 |
| (d) same-agent review | `review_mode == "same_agent_review"` | warning + user confirmation prompt | 0 (after confirm) |
| (e) review log missing | file does not exist | `REVIEW_NOT_FOUND` | 2 |
| (f) review log corrupt | JSON parse fails | `REVIEW_CORRUPT` | 3 |
| (g) review log newer schema | `schema_version` > supported | `REVIEW_SCHEMA_NEWER` | 6 |
| (h) review log empty findings | `findings` array empty | `REVIEW_NO_FINDINGS` (info, clean exit) | 0 |

For (b) codebase drift: when Step 5 EXECUTE attempts to operate on a file-backed location and the `file` field does not exist, surface `REVIEW_STALE_PATHS: finding refers to <path> which no longer exists; codebase has drifted since review-id <id>` and skip that finding. Apply this check only when `file` is present. Scoped findings are not stale merely because no file exists; route them to process/session/artifact/project investigation through their `scope_ref`. Aggregate skips into a summary at end of Step 7.

For (d) same-agent review: print the warning then prompt `Continue with these findings anyway? [y/N]`. Exit code 0 only after explicit user confirmation.

Historical newer review logs that are NOT the selected `--review-id` are preamble warnings, not blockers. The review-id route is the point where a specific review log becomes required and must fail closed if its schema is genuinely newer or corrupt.

When `--review-id` succeeds, set `FixSession.source = "review_id"` and skip Signal 0-4 scanning (conversation findings are not consulted; the durable review IS the source of truth).
