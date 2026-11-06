# AIVV Runtime Contract

**Status:** Provisional draft for cross-host support.
**Stability:** Provisional — fields, operation names, and capability flag enum values may change until v0.2 graduation. Downstream consumers (third-party plugin authors, future host adapters) should expect breaking changes during v0.1.x.
**Contract version:** 0.3.0 (external target-instance runtime storage; legacy originals remain read-only).
**Source of truth:** `.aivv/runtime-contract.md` (this file). Maintainer-only implementation notes are not part of this contract; shipped skills must not depend on unpublished documentation.

## Implementation pattern (dev.25+)

Review and fix use host-native inspection and source editing plus the shipped
Node storage resolver/mutation helper. Resolve its installed location through
`.aivv/runtime-root.md`; a consuming project's `tools/` is never executable
runtime authority. Node is required for canonical storage resolution and writes.

- **File reads:** active records use shared storage `list`/`read` commands with cached context and completed import visibility; native reads inspect source files and explicit historical inputs.
- **State/calibration writes:** build candidates in private invocation scratch, validate them, then publish through the shared storage mutation helper under the target operation lock. No direct host writes to active state.
- **Source edits:** host write primitives retain existing write-intent and verification gates.
- **Shell/Git:** host shell primitives retain existing workspace snapshots and fingerprint semantics.
- **Hashing:** `git hash-object --stdin --no-filters` computes existing SHA-1 finding fingerprints; storage identity is a distinct SHA-256 namespace.
- **Schema validation:** shipped schemas and pre-write validators remain authoritative; storage import is not schema or remediation authorization.

State formats remain compatible. Legacy host-specific session histories are read-only; import is explicit and copies/verifies originals rather than renaming them or writing migration markers. See state-maintenance.md.

This file is shipped with AIVV and is referenced by shared methodology and host-adapter guidance. It MUST be present in every shipped AIVV package — declared in the plugin manifest and verified by the clean-package validator.

---

## Capability Flags

Every platform adapter declares these capability flags. The canonical capability
status vocabulary is `available`, `conditional`, `partial`, `degraded`,
`unsupported`, and `unverified`. Every adapter, persisted metadata schema, and
consumer of a capability status MUST use exactly this vocabulary:

| Status | Meaning |
|---|---|
| `available` | The capability is present and satisfies the stated contract. |
| `conditional` | The capability is usable only after a documented preflight or under explicit host conditions. |
| `partial` | The core capability is present, but a stated guarantee or coverage boundary is missing; consumers must apply the documented guard. |
| `degraded` | The capability is currently usable only through a weaker, user-visible fallback. |
| `unsupported` | The host cannot provide the capability. |
| `unverified` | The host may provide the capability, but the adapter has not established it with the required evidence. |

| Flag | Meaning | Required for |
|---|---|---|
| `can_spawn_cold_agents` | Host can start reviewer/investigator instances without conversation history. | Cold review and independent investigation. |
| `can_isolate_reviewer_context` | Host can ensure reviewers receive only the explicit evidence packet. | AIVV reviewer independence. |
| `can_hide_peer_outputs_until_synthesis` | Host can prevent reviewers from seeing peer outputs before all reviews finish. | Consensus classification. |
| `can_parallelize_agents` | Host can run multiple reviewers before synthesis. | Speed only; isolation, not scheduling, carries the independence claim. |
| `can_read_conversation_history` | Host exposes enough conversation context for session-centric review. | Full session review. |
| `can_read_tool_history` | Host exposes files read/edited/searched during the session. | Accurate Files Touched extraction. |
| `can_enforce_readonly` | Host can technically restrict reviewer/investigator writes. | Strong read-only claim. |
| `can_write_project_state` | Compatibility capability name: host can create/update resolved external state/calibration through the shared helper; no consuming-project state writes. | Review logs, fix logs, calibration. |
| `can_invoke_peer_skill` | Host can invoke peer skill in either direction — `/aivv` → `/aivv-fix` forward chain at Step 8 AND `/aivv-fix` → `/aivv` reverse chain at Step 6.5 (Stage 4 dev.113). When `unavailable`, forward chain halts at Step 8; reverse chain halts at Step 6.5 with `capability_degradations: ["outer_loop_reverse_chain_unavailable"]` and a manual-resume banner. | Bidirectional cross-skill auto-chain. |
| `can_resolve_skill_assets` | Host has a reliable way to locate bundled AIVV files. | Lenses, schemas, scripts, prompt references. |
| `can_emit_runtime_probe_scaffolds` (B3+) | Host can write reviewable Playwright probe specs and a manifest under `<target>/.aivv/runtime-probes/`. | Default `--runtime`/`--emit-runtime-probes` path. AIVV prepares artifacts; the target project or user runs them. |
| `can_ingest_runtime_results` (B3+) | Host can read user-run Playwright JSON reporter output and update the matching review log. | `--ingest-runtime-results <path>` and `tools/runtime-evidence.mjs ingest`; validates review id, finding fingerprint, probe id, assertion polarity, retries/flakes, and timestamps before write. |
| `can_invoke_playwright_mcp` (host-adapter optional) | Host exposes Playwright MCP browser-driver tools (`mcp__playwright__browser_*`) for read-only runtime inspection. | Optional adapter only. Unsupported is not a failure; default B3 runtime evidence remains scaffold emit + user-run JSON ingest. |
| `can_persist_screenshot_artifacts` (host-adapter optional) | Host supports writing PNG screenshot files to `<target>/.aivv/visual-baselines/`. | Optional screenshot-baseline support for host adapters. Silent baseline overwrite remains forbidden. |
| `can_receive_remediation_request` (Action Inbox optional) | Host can claim a queued, local typed remediation request and continue through `/aivv-fix`'s normal gates. It does not mean the host can be woken or can execute browser-supplied commands. | Opt-in `/aivv-view --inbox` handoff. |

If a capability is unavailable, the runtime must either stop or record a degradation. It must not silently emulate independence with a same-agent pass.

---

## Review Modes

| Mode | Requirements | Confidence label |
|---|---|---|
| `cold_single_review` | `can_spawn_cold_agents` + `can_isolate_reviewer_context` | Single cold reviewer advisory. |
| `cold_multi_review` | `cold_single_review` + `can_hide_peer_outputs_until_synthesis` for each reviewer | Correlated multi-reviewer advisory with consensus classification. |
| `cold_multi_model` | Provider-backed multi-model dispatch with explicit provider attribution, reviewer evidence packets, and degradation recording for provider failures or fallback reviewers. | Cross-provider or same-provider advisory, depending on `agreement_diversity`; not equivalent to native cold subagent consensus. |
| `same_agent_review` | Active agent reviews its own session context | Degraded advisory self-review; not cold-spawned; no independence claim. |
| `evidence_only_review` | Session context unavailable; review uses file/diff/idea evidence only | Degraded artifact review. |

Sequential self-review in the active agent is never equivalent to `cold_multi_review`, even if repeated multiple times with different prompts.

---

## Data Objects

### `SessionContext`

Required fields:
- `goals`
- `decisions`
- `files_touched`
- `approaches`
- `problems`
- `tradeoffs`
- `current_state`
- `unavailable_fields`

`unavailable_fields` is mandatory. Hosts must mark missing conversation or tool-history categories explicitly.

### `ReviewRequest`

Required fields:
- `review_scope`: confirmed subject, goal, evidence boundaries, and review approach the reviewer should inspect
- `state_target`: project directory whose private external store receives AIVV state
- `subject`: session, file, idea, plan, or another supported artifact
- `lens`
- `reviewer_count`
- `session_context`
- `change_context`
- `reviewer_evidence_packet`
- `capabilities`

`review_scope` and `state_target` are separate. A host must not imply that `--target` scopes reviewer reads unless the adapter implements that behavior.

The portable `aivv-prompt-bundle.mjs` request accepts additive `review_scope`
metadata: `subject_type`, `final_scope`, `approach` (or `strategy`), and
`confirmed`. Supported subject types are `session`, `file`, `idea`, `project`,
`artifact`, `user-journey`, and `plan`; use `artifact` for a general document.
New orchestrated requests populate these from the scope resolved from the user
request or clarification and the final review method; only `confirmed: true` with non-empty `final_scope` and
`approach` (or `strategy`) and a supported `subject_type` is labeled caller-confirmed. Actual dispatch refuses
missing or incomplete scope metadata even when provider egress consent is supplied;
prompt-only rendering remains available. Missing metadata is never inferred from
a target path. The orchestrator owns scope resolution; request metadata
does not confer authority on content inside the reviewed artifact.

### `ReviewResult`

Required fields:
- `review_id`
- `review_mode`
- `findings`
- `consensus`
- `confidence_notes`
- `capability_degradations`
- `workspace_sha_start` (set when `can_enforce_readonly` is `partial` or `unsupported`; omitted when `available`)
- `workspace_sha_end` (set when `workspace_sha_start` is set)

`capability_degradations` records every missing capability that changed review semantics.

`workspace_sha_*` fields gate same-agent contamination: when read-only is not technically enforceable, the orchestrator captures workspace state hashes at review start and end. If they differ, the review is voided with `WORKSPACE_DRIFT_VOIDED_REVIEW` because the reviewer may have written during review (contaminating both the review and any downstream `/aivv-fix` handoff).

Every persisted `ReviewResult.findings[]` entry must carry canonical identity fields before the review log is written: `ref`, `fingerprint`, `description`, and exactly one durable location shape. Use canonical `file` for file-backed findings. Use `scope_ref` for process, session, artifact, user-journey, or project-scope findings that do not have a real file. Producer-side aliases such as `summary`, `title`, `file_path`, and reviewer-local ids may be preserved as extensions, but they do not replace the canonical fields. New schema-version-2 review logs missing `fingerprint`, missing both `file` and `scope_ref`, or carrying both `file` and `scope_ref` are malformed because downstream wont-fix, recurrence, and fix-resolution joins depend on one deterministic location identifier.

### Modern Finding Profile And Scoped Findings

New AIVV writes MAY emit `quality_profile: "modern"` on finding envelopes and review-log findings. Modern findings MUST include `evidence`, `impact`, `severity_rationale`, `recommended_next_step`, and `verification_path`.

Non-file findings use `scope_ref` instead of fake file paths:

```json
{"kind": "process", "ref": "aivv-step-5-output"}
```

Consumers MUST treat `file` and `scope_ref` as sibling location forms. File-backed findings may perform filesystem existence checks. Scoped findings are not stale merely because no file exists; they route to process/session/artifact/project investigation. Wont-fix fingerprints and fix-log handoff use the persisted `fingerprint` when present, otherwise compute from the canonical location key described here.

Legacy readers MUST continue to accept older file-backed findings that omit `quality_profile` and the modern quality fields. Modern fingerprinting uses `scope_ref.kind`, `scope_ref.ref`, and the lowercased finding description when `file` is absent. Legacy file-backed fingerprinting remains unchanged.

### `FixRequest`

Required fields:
- `source_review_id`
- `findings`
- `state_target`
- `dry_run`
- `capabilities`

`source_review_id` should be preferred over conversation-only handoff for `/aivv --fix`.

When an Action Inbox request is used, `action_request_id` is an optional provenance field. It is accepted only after the claim operation verifies the request's canonical state path, target, Git revision, and workspace-state snapshot; selected finding IDs narrow the normal review-id collection, and request notes remain untrusted user context rather than executable instructions.

### `FixSession`

Required fields:
- `fix_id`
- `state_target`
- `batches`
- `investigations`
- `session_changes`
- `verification_cycles`
- `source` (one of `conversation`, `review_id`, `literal`, `task_file` — names the finding origin)

Existing fix-log schema remains canonical until a schema migration is explicitly planned.

When `FixSession.source == "review_id"`, persisted fix logs must set `source_review_id` to the consumed review id. Compatibility readers may also accept legacy `review_id`, `review_id_consumed`, or `source_argument`, but new writers use `source_review_id` as the canonical join key.

---

## Adapter Operations

| Operation | Purpose | Implementation (dev.25+) |
|---|---|---|
| `read_session_context()` | Produces `SessionContext`; marks unavailable fields explicitly. | Agent reasoning over conversation context. |
| `gather_change_context(request)` | Reads git diff, file content, or quoted idea evidence. | Host's read + shell primitives. |
| `resolve_asset(path)` | Locates `.aivv` docs, lenses, schemas, scripts, and prompt references. | Host's read primitive against shipped paths. |
| check_capability(flag) | Reports one canonical capability status before dispatch. Capability checks include host-specific discovery and preflight; a deferred tool not yet exposed is not evidence of unsupported. | Adapter-internal lookup plus the active host adapter's dispatch discovery before fallback. |
| `build_reviewer_evidence_packet(request)` | Produces the exact prompt/evidence packet sent to reviewers. | Agent constructs in context. |
| `spawn_reviewers(request)` | Runs the shared reviewer role with the isolation declared by the active host adapter. | Use the host adapter's verified agent-dispatch surface. |
| `spawn_investigator(batch)` | Runs investigator role prompt or records same-agent degradation. | Same as `spawn_reviewers`. |
| `close_consumed_subagents(handles)` | Closes AIVV-owned subagent handles after their outputs are consumed, and performs best-effort pre-spawn cleanup of visible completed AIVV-owned handles from interrupted prior invocations when the host exposes lifecycle primitives. Cleanup failures are warnings; they do not discard already-consumed output or invalidate review/fix state. If the next immediate step requires targeted interactive follow-up with the same subagent, the orchestrator leaves `output_consumed: false` until that follow-up is complete and records the reason in user-visible output or state warnings. | Host lifecycle primitive when available; no-op with warning when unavailable. Concrete host tool mappings live in platform adapter docs, not in this host-neutral contract. |
| `write_state(object)` | Writes state. **Orchestrator-only** for `review-*.json` and `fix-*.json`; reviewer/investigator subagents return findings via consolidated response and do NOT write state directly. | Agent stages validated JSON in private scratch, then publishes through the shared storage mutation helper under the target operation lock. No Python helper or direct host write to active state. |
| `apply_fix(plan)` | Applies fixes through the host's edit mechanism. | Use the host adapter's declared source-edit operation. |
| `handoff_to_fix(review_result)` | Invokes or continues the fix workflow, preferably via `review_id`. | Cross-skill invocation via host's peer-skill mechanism + durable `--review-id=<id>` argument. |
| `claim_remediation_request(request_id, target)` | Atomically claims a queued local Action Inbox request only when its canonical state directory, target repository, current Git revision, and workspace-state snapshot still match. Claiming does not apply a fix or bypass triage, investigation, write-intent, or verification gates. | Resolve `AIVV_ROOT` through the shared runtime-root contract, then run `node "$AIVV_ROOT/tools/aivv-action-inbox.mjs" claim --request-id <uuid> --state-dir <state_dir> --storage-context <storage_context_file> --target <target>`; never use a target-relative `tools/` path. Then invoke `/aivv-fix --action-request=<uuid> --target=<target>`. |
| `capture_workspace_state()` | Returns a stable comparable string of workspace state. Used by SHA-snapshot guard when `can_enforce_readonly` is `partial`/`unsupported`. (Operation renamed from `snapshot_workspace_sha`; field names retained for backward-compat per OQ4.) | Shell capture of `( cd '<target>' && git status --porcelain=v1 -z; echo ''; git diff --no-color --no-ext-diff HEAD )`. String comparison detects drift. |
| `compute_fingerprint(location, description)` | Produces a deterministic identifier for wont-fix dedup, recurrence joins, and review/fix handoff. | For file-backed findings, hash `<normalized_file>:<lowercased_description>`. For scoped findings, hash `<scope_ref.kind>:<scope_ref.ref>:<lowercased_description>`. Use shell heredoc-stdin form into `git hash-object --stdin --no-filters` to avoid shell escaping bugs. SHA-1 hex. Legacy SHA-256 fingerprints remain historical until explicit import; never rewrite the project original. |
| `schema_gate(route)` | Halts only when state required by the current route exceeds the supported max; warns and continues for unrelated historical state. | Agent reads state file headers, parses `schema_version`, emits `STATE_SCHEMA_NEWER_HISTORICAL` for unselected newer state, and halts with route-specific errors such as `REVIEW_SCHEMA_NEWER` only when the selected artifact must be read. |

---

## Canonical Fingerprint Formula

The canonical input string is:

```text
<location_identifier>:<lowercased_description>
```

`<location_identifier>` is one of:

- File-backed finding: `<normalized_file>`.
- Scoped finding: `<scope_ref.kind>:<scope_ref.ref>`.

Normalization rules:

1. For file-backed findings, take the `file` field value, convert backslashes to `/`, strip a leading `./`, and make absolute paths project-relative against the resolved target project.
2. For scoped findings, trim surrounding whitespace from `scope_ref.kind` and `scope_ref.ref`, then join them with one `:` and no extra prefix.
3. Lowercase the finding `description` value using Unicode-aware lowercase. Preserve punctuation and ordinary whitespace. If a legacy input contains embedded newlines, replace them with single spaces before hashing.

Unix-like shells:

```bash
git hash-object --stdin --no-filters <<EOF_AIVV_FP
<location_identifier>:<lowercased_description>
EOF_AIVV_FP
```

PowerShell shells:

```powershell
@'
<location_identifier>:<lowercased_description>
'@ | git hash-object --stdin --no-filters
```

Use a PowerShell single-quoted here-string so `$`, `$()`, backticks, quotes, and backslashes remain literal. Do not inline the description into any expandable or shell-parsed string such as `printf "%s" ...` or a PowerShell double-quoted string; finding text may contain shell-significant bytes. The orchestrator constructs the normalized input string in context, passes it through stdin, and records the resulting SHA-1 hex.

## State Concurrency

AIVV uses a **single-writer orchestration model** for shared mutable state:

- Per-invocation files (review-*.json, fix-*.json): the orchestrator skill writes them; reviewer/investigator agents return findings through the active host adapter's consolidated response and never write these files directly. Parallel dispatch follows the concurrency limits declared by the active host adapter. Concurrent-writer collisions cannot occur because each invocation's file has a unique ID.

- **Cross-invocation shared files** (`wont-fix-registry.json`, `index.json`): the orchestrator publishes candidates through the shared mutation helper. The target operation lock coordinates imports and writes; separately collected shared-file updates may still be based on stale reads. **Last-writer-wins semantics** are accepted for these files because (a) entries are user-confirmed and additive (a lost write means the user re-confirms wont-fix on next encounter — annoying, not data-corrupting), (b) the wont-fix registry's purpose is to skip-on-recurrence, so a missed entry surfaces immediately on the next finding scan, (c) the index is derived (`/aivv --maintenance` rebuilds it from per-invocation files). Read/modify/write CAS or append-only event log are NOT implemented; a future revision may add them if telemetry shows registry-loss is impactful in practice.

- **Outer-loop files** (`outer-loop-<root_review_id>.json`): the outer-loop
  primitive is the sole read-modify-write owner. Scope resolution and other
  callers supply inputs to that owner; they do not read, create, update, or
  clean up outer-loop files. This prevents independent `/aivv` steps from
  overwriting fields that the reverse-chain needs.

- **Action Inbox files** (`action-inbox/<request-id>.json` and `action-inbox/claims/<request-id>.json`): immutable per-request and per-claim shards under the selected target-instance's external canonical `<state_dir>`. A short-lived atomic submission directory lock serializes overlap lookup and request creation across separate Inbox processes; a dead lock-owner PID is reclaimed, while malformed/live locks fail closed. The receiving `/aivv-fix` route creates its claim with exclusive-create semantics after validating target repository, exact current revision, workspace-state snapshot (`git status --porcelain=v1 -z` plus `git diff HEAD` SHA-256), and expiry. A request is never a command channel and no mutable queue index exists. A second request overlapping any queued finding in the same review revision is rejected, preventing competing remediation batches.

**Storage mutation contract:** all state/calibration changes, including registry,
outer-loop, lifecycle, quarantine, archival, and cleanup, must coordinate with
explicit import through the shared target operation lock. A staged candidate
must pass its existing pre-write/schema gates before publication. Read-only
routes do not initialize stores and exclude incomplete imports. No legacy
original is mutated. See `target-resolution.md` for the executable helper contract.

**Honest limitation:** the cross-invocation last-writer-wins model is weaker than the lock/CAS guarantee that pre-dev.25 documentation aspired to. Adopters running `/aivv-fix` from multiple parallel sessions on the same target project should expect occasional registry-entry loss (recoverable: user re-confirms the wont-fix). Single-session users are unaffected.
