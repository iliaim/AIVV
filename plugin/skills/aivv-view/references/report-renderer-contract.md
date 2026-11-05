# Report Renderer Contract

This contract defines the stable boundary for AIVV report renderers. It exists so the single-review HTML report and future multi-cycle findings browser share data flow, safety rules, and size expectations without copying ad hoc logic.

## Contract Shape

### Inputs

Renderers consume one of these data shapes:

- **Canonical envelope:** JSON emitted by `scripts/view-loader.sh`.
- **Humanized envelope:** canonical envelope after `scripts/humanize.sh` adds display labels.
- **Cycle summary array:** JSON array emitted by `scripts/view.sh --list` or by a browser-specific aggregation script.

Renderers may call the loader and humanizer internally, but they must treat the resulting envelope as the data contract. They must not re-interpret raw review-log variants independently.

### Outputs

Renderers produce one offline-readable HTML file.

The HTML output must:

- inline CSS and JavaScript;
- avoid network dependencies;
- remain useful when opened from `file://`;
- be safe to share as a static artifact;
- preserve enough visible text for browser search, page search, and print output.

### Read-Only Boundary

Static report renderers are read-only surfaces. The foreground Action Inbox service (`/aivv-view --inbox`) is deliberately outside this renderer contract: it serves the already-rendered report on `127.0.0.1` and may append one schema-validated immutable request shard after explicit user confirmation. It cannot invoke remediation, accept a command, mutate a review/decision/calibration record, or send data beyond loopback.

Allowed:

- read external state/archive and preserved legacy review/fix logs; external joins use a private snapshot copied under the shared storage lock and exclude incomplete imports;
- read the wont-fix registry;
- display resolution and warning state;
- write an automatic report to the private external cache, or an explicitly requested report artifact outside durable AIVV record
  paths (for example `--html -o report.html` or browser output);
- copy inert text selected by the user.

Forbidden:

- write `.aivv/state`;
- write `.aivv/calibration`;
- edit decisions files;
- run `/aivv-fix` or any remediation command;
- silently send data over the network.

If the same review-log filename exists in both state locations, renderers use
the active-state copy and emit one deterministic warning. Archive discovery and
diagnostics must not create incidents, lifecycle records, decisions, or any
other durable state; a renderer failure is reported to the invoking surface.

Clipboard-assisted decision capture remains outside this contract until a separate architectural decision settles the read/write boundary.

The Action Inbox boundary is settled separately by opt-in action-inbox contract: it is an opt-in, local request/claim handoff to `/aivv-fix`, not renderer write-back. Static `--html` and multi-cycle browser output must never acquire its endpoint, token, or write capability.

### Compatibility

Renderers must ignore unknown envelope fields for display while preserving them in any JSON pass-through they emit.

If a field is missing:

- render the available adjacent fields;
- omit the unavailable chip/section;
- do not crash;
- do not invent inferred status that is not supported by the envelope.

### Size Policy

Use a normalized budget, not a fixed absolute cap.

The budget shape is:

- static shell allowance for document structure, embedded CSS, and embedded JavaScript;
- per-finding allowance for repeated cards/rows;
- per-cycle allowance for browser index rows.

Tests should exercise representative large corpus records. A genuinely large report may be larger than a small report; the invariant is bounded marginal growth.

## Renderer Types

### Single-Review Report

The existing `--html` report renders one review envelope plus joined fix/wont-fix data. It is optimized for reading and sharing a single review or post-fix cycle.

### Multi-Cycle Findings Browser

The browser renders a static index across many review cycles. It answers cross-cycle questions:

- which reviews still have open findings;
- which findings have no fix session, unjoinable fix evidence, addressed-but-unverified fixes, verified resolutions, deferrals, wont-fix decisions, or legacy inline fixed claims;
- which warning kinds recur;
- how severity volume changes over time.

The browser is an index and triage surface, not a state editor.

## Browser Evidence States

The browser counts resolution by evidence state, not by a single ambiguous `unknown` bucket.

| State | Meaning |
|---|---|
| `open` | Review/fix evidence is joinable and no fix log claims this finding was addressed. |
| `no_fix_session` | No fix log references the review. |
| `fix_unjoinable` | The review claims fix evidence, but the viewer cannot join it to a fix log. |
| `addressed_unverified` | A fix log claims the finding was addressed, but verifier evidence is absent. |
| `verified_resolved` | Fix/verifier evidence confirms resolution. |
| `deferred` | Fix evidence records deferral. |
| `wont_fix` | Wont-fix registry or fix evidence records an accepted non-fix disposition. |
| `legacy_fixed_claim` | Historical inline `fix_status` claims a fix without durable fix-log evidence. |

`Needs attention` includes open findings, no-fix-session findings, unjoinable fix evidence, deferrals, and legacy fixed claims.

## Implementation Rules

- Keep template files readable on disk; compact embedded assets at render time if needed.
- Prefer shell plus jq, matching the existing viewer runtime posture.
- Add tests before production behavior changes.
- Route user-facing labels through `humanize` or a browser-specific display helper derived from canonical envelope fields.
- Keep `--open` behavior optional and non-fatal, matching the single-report flow.
