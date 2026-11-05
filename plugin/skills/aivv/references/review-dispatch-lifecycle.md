# Review Dispatch Lifecycle

Read before native reviewer dispatch, lifecycle cleanup, or same-agent fallback.

## Preflight

Before prompts, confirm Step 4 `review_mode`. If preflight/dispatch changes the
path, update Review Dispatch Metadata first.

1. Check `can_spawn_cold_agents` via `.aivv/runtime-contract.md` and platform adapter.
2. <!-- Codex-SPECIFIC --> In Codex, hidden subagent tools are not proof of
   unavailability. First confirm reviewer TOML at
   `<codex-home>/agents/aivv-reviewer.toml` or
   `<target>/.codex/agents/aivv-reviewer.toml`. If dispatch tools are not
   loaded, use `tool_search` query
   `multi-agent subagent dispatch codex agents spawn_agent wait_agent close_agent`.
   `spawn_agent` + `wait_agent` means cold dispatch is available; missing
   `close_agent` degrades cleanup only.
3. <!-- Codex-SPECIFIC --> Explicit `/aivv` or `$aivv` invocation authorizes
   AIVV-owned read-only reviewer subagents. If policy still blocks delegation
   after TOML/tool discovery succeeds, ask once. If impossible or declined, halt
   with `codex-subagent-delegation-blocked`; do not silently write
   `same_agent_review`, and do not write a same-agent review log.
4. If AIVV is outside Codex and only calls `codex exec` as provider subprocess,
   skip native Codex preflight and use Case D provider dispatch.
5. Enter same-agent fallback only after concrete preflight/dispatch failure:
   `agents.max_depth=0`, budget exhausted, invalid TOML, missing
   `aivv-reviewer`, or other non-policy failure.
6. Before spawning, close only visible completed AIVV-owned reviewer handles
   from interrupted prior runs when host exposes close primitive. Never close
   unrelated agents; cleanup failures are warnings.

Mode rules:
- `multi_model_enabled: true` preserves `review_mode = "cold_multi_model"` and
  skips native Cases A/B/C for Case D. If all providers/fallbacks fail and the
  terminal safety net executes standard Case A, final mode is
  `cold_single_review` with degradation history.
- `multi_model_enabled: false` + available cold agents: `--reviewers=1` ->
  `cold_single_review`; `--reviewers=N>=2` -> `cold_multi_review` only when
  agent isolation and hidden peer outputs are available.
- Failed native cold dispatch -> one `same_agent_review` fallback, not N
  sequential self-reviews. Surface degradation before findings.

Degradation banner:

```text
⚠ AIVV degradation: subagent dispatch unavailable on this host
  (reason: <agents.max_depth=0 | subagent budget exhausted | TOML config invalid | other>).
  Running same_agent_review - the active agent is reviewing its own work,
  which provides no independent epistemic signal.
  Treat findings as a self-checklist, not AIVV review.
```

`partial` and `unsupported` are canonical capability statuses defined in
`.aivv/runtime-contract.md`. If read-only enforcement has either status, capture
before dispatch:

```bash
( cd '<target>' && git status --porcelain=v1 -z; echo ''; git diff --no-color --no-ext-diff HEAD ) 2>&1
```

Record stdout as `workspace_sha_start`; capture again at Step 6.0. If changed,
void with `WORKSPACE_DRIFT_VOIDED_REVIEW`. This catches tracked-file changes and
untracked additions/deletions; existing untracked-file content changes remain a
v0.1 limitation.

## Multi-Model Branch

Read resolved `multi_model_enabled` from Step 1.5 after CLI/project/user/default
binding. Per-run `--multi-model` / `--no-multi-model` override configs. If true,
skip Cases A/B/C and read `multi-model-dispatch.md`; provider availability is
only `node "$AIVV_ROOT/tools/dispatch.mjs" --probe ...`, after resolving
`AIVV_ROOT` through the shared runtime-root contract. Do not infer from env vars/model
files or Anthropic-internal variants. If false, branch on N.

## Case A: N = 1

Dispatch one cold `aivv:reviewer` with Step 4 prompt. Track immediately:

```json
{"reviewer_label":"solo","role":"aivv:reviewer","dispatch_path":"native","output_consumed":false}
```

Set `output_consumed:true` only after synthesis/presentation and durable Step
7.5 log write. Add optional `reviewer_roster`; native model provenance is exact
if known, otherwise `model:"inherited"` and
`model_source:"host-inherited-unreported"`.

<!-- CLAUDE-CODE-SPECIFIC --> Claude Code dispatch uses one `Agent` call with
`subagent_type: aivv:reviewer`.

<!-- Codex-SPECIFIC --> Codex dispatch uses reviewer TOML; if tools are hidden,
run preflight above.

## Case B: N >= 2

Dispatch all N native reviewers in parallel; sequential dispatch invalidates the
independence claim. Required: `can_parallelize_agents` and
`can_hide_peer_outputs_until_synthesis`; otherwise use `same_agent_review`.

Prompt rules: use `reviewer_lens_assignments`; homogeneous `K==1` prompts differ
only by metadata label; multi-lens `K==N` prompt `i` uses its assigned lens and
only metadata/lens-focus differs; evidence sections are byte-identical except
the lens-focus segment.

Track every handle immediately with label (`alpha`, `beta`, ...), role, dispatch
path, and `output_consumed:false`. Build optional `reviewer_roster` before Step
7.5; leave `finding_refs` empty rather than inventing attribution.

## Case C: Same-Agent Fallback

Run exactly one same-agent pass against the Step 4 prompt. It is a self-checklist
only and must repeat the degradation banner in Step 6 output.

## Critical Rules And Cleanup

- Reviewers do not own scope, evidence packet construction, degradation
  classification, or final synthesis.
- Native prompts do not duplicate full methodology; provider Case D gets the
  portable prompt pack from `dispatch.mjs`.
- Reviewer subagents are read-only by contract; workspace snapshot guards catch
  weak host enforcement.
- Immediate targeted follow-up is the only valid reason to keep a completed
  reviewer handle at `output_consumed:false`; surface reason and log a warning.
- Same-model homogeneous consensus is partial independence, not proof; multi-lens
  adds methodological diversity but convergence is still not infallible.
- After durable Step 7.5 log write, close all AIVV-owned native reviewer handles
  whose outputs are consumed. Cleanup failures are non-fatal warnings. Do not
  auto-chain into `/aivv-fix` while consumed handles remain open unless cleanup
  failed and was surfaced.
