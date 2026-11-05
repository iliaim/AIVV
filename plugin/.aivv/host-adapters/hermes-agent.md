# Hermes Agent Host Adapter

**Status:** Experimental first-slice host adapter evidence note
**Task gate:** Task 0 complete for API/install-shape verification; implementation may proceed to taxonomy/metadata substrate but not to real review/fix orchestration.

## Purpose

Hermes Agent is a prospective AIVV host: a runtime that can load a plugin, expose slash commands, register bundled skills, and eventually coordinate cold subagents through Hermes tools. This file records the Task 0 evidence required before any Hermes plugin or installer code is written.

This is not a claim that live `/aivv`, `/aivv-fix`, `/aivv-view`, or `/aivv-calibrate` work in Hermes. Current Hermes support remains diagnostic by default (`/aivv-doctor` plus `/aivv-probe`) with a separate controlled test-profile CLI gate for a read-only `/aivv` fake-reviewer smoke.

## Evidence sources

Evidence was gathered from the local Hermes source checkout and installed CLI on this machine:

- Hermes source: `~/.hermes/hermes-agent`
- Plugin manager: `~/.hermes/hermes-agent/hermes_cli/plugins.py`
- User plugin docs: `~/.hermes/hermes-agent/website/docs/user-guide/features/plugins.md`
- Build plugin guide: `~/.hermes/hermes-agent/website/docs/guides/build-a-hermes-plugin.md`
- Installed CLI: `hermes plugins --help`, `hermes plugins list`, `hermes profile show default`, `hermes plugins enable --help`, `hermes plugins install --help`

## Verified plugin shape

### Manifest filename and location

Hermes discovers general plugins from directories containing either:

- `plugin.yaml`, preferred by docs and examples;
- `plugin.yml`, also accepted by `PluginManager._scan_directory_level`.

Supported discovery sources observed in docs/source:

- bundled: `<hermes repo>/plugins/<name>/`;
- user: `${HERMES_HOME}/plugins/<name>/`, defaulting to `~/.hermes/plugins/<name>/`;
- project: `./.hermes/plugins/<name>/`, disabled unless `HERMES_ENABLE_PROJECT_PLUGINS` is set;
- package entry points: `hermes_agent.plugins`.

For AIVV first slice, use the user-profile plugin layout:

```text
source:    packages/hermes/aivv_hermes_plugin/
installed: ${HERMES_HOME}/plugins/aivv/
manifest:  ${HERMES_HOME}/plugins/aivv/plugin.yaml
entrypoint:${HERMES_HOME}/plugins/aivv/__init__.py
```

### Python entrypoint

A general plugin exposes:

```python
def register(ctx):
    ...
```

The build guide and plugin docs both use `__init__.py` with `register(ctx)`. Hermes loads the plugin module and calls this function through the plugin manager.

### Slash command registration

`PluginContext.register_command` exists with signature:

```python
ctx.register_command(name, handler, description="", args_hint="")
```

Source docstring states the command handler signature is:

```python
fn(raw_args: str) -> str | None
```

Async handlers are also accepted; dispatch sites resolve awaitables with a bounded helper (`resolve_plugin_command_result`) where needed.

Command names are normalized by lowercasing, trimming a leading slash, and replacing spaces with hyphens. Built-in command conflicts are rejected.

Note: one current guide snippet still shows an older-looking `handle(ctx, raw_args)` / `help=` style. The source-backed contract and the plugin feature reference define the supported slash-command shape as `handler(raw_args: str)` with `description=` and optional `args_hint=`. AIVV must follow the source-backed contract.

### Command return semantics

Plugin slash commands are dispatched by CLI, gateway, and TUI code paths by calling the registered handler with raw string arguments and rendering the returned value as command output. `None` is treated as empty/no output by some surfaces.

For `/aivv-doctor`, return a plain text report by default and parseable JSON when `--json` is supplied. Do not rely on side-effect-only command behavior.

### Message injection

`ctx.inject_message(content, role="user") -> bool` exists.

Observed behavior from source:

- returns `True` after queueing in CLI mode;
- uses the active CLI reference and queues into either `_pending_input` or `_interrupt_queue`;
- returns `False` and logs a warning when no CLI reference exists, explicitly including gateway mode.

Task 0 conclusion:

- `instruction_injected` is available only when a live CLI reference exists and must be reported as a probed capability, not assumed.
- gateway-safe first slice should support `instruction_render_only` instead of relying on injection.

### Tool dispatch from plugin commands

`ctx.dispatch_tool(tool_name, args, **kwargs) -> str` exists.

Observed behavior from source:

- dispatches through `tools.registry.registry.dispatch`;
- auto-wires `parent_agent` only when a CLI reference with `agent` exists;
- gateway mode has no `_cli_ref`, so parent-agent context is not auto-wired there;
- source comments say gateway tools degrade gracefully, but AIVV reviewer dispatch must not treat that as proof of cold-subagent review integrity.

Task 0 conclusion:

- direct plugin dispatch is `available` as an API surface;
- for AIVV reviewer/fix workflows it remains `unverified` and gated by future runtime probes;
- `/aivv-doctor` must not call `delegate_task` by default.

### Read-only `/aivv` command-enablement Task 0 refresh

Refreshed 2026-06-09 00:31:41 BST for the controlled test-profile CLI command-enablement plan.

Evidence:

- AIVV command registration currently lives in `packages/hermes/aivv_hermes_plugin/__init__.py::register(ctx)` and closes over the Hermes plugin context in raw-argument handlers.
- Hermes `PluginContext.register_command(name, handler, description="", args_hint="")` remains the source-backed slash command API; handlers receive `raw_args: str` and may be async.
- Hermes `PluginContext.dispatch_tool(tool_name, args, **kwargs)` exists and dispatches through `tools.registry.registry.dispatch`; `parent_agent` is only auto-wired when a CLI reference with an agent exists.
- Gateway mode lacks the same `_cli_ref` auto-wiring path, so CLI command-readiness and gateway command-readiness must remain separate claims.
- AIVV tests already use fake contexts that can capture registration and hard-fail if diagnostics call `ctx.llm`, `dispatch_tool`, or `inject_message`. Future read-only `/aivv` tests should use an explicit fake reviewer dispatcher seam before any live reviewer dispatch is considered.
- Verification: `python3 -m unittest packages.hermes.tests.test_plugin_skeleton -v` ran 17 tests and passed.

Task 0 conclusion for command enablement:

- GO for Task 1 TDD to add a disabled-by-default `/aivv` registration gate in AIVV's plugin entrypoint for controlled test-profile/install smoke only.
- NO-GO for live profile rollout, paid/provider-backed reviewer dispatch, gateway readiness claims, `/aivv-fix`, `/aivv-view`, or `/aivv-calibrate`.

### Skill registration

`ctx.register_skill(name, path, description="")` exists.

Observed behavior from source:

- `name` must not contain `:`;
- `name` must match Hermes' skill-name pattern `[a-zA-Z0-9_-]+`;
- path must exist;
- registered skill is namespaced as `<plugin_name>:<name>`;
- plugin skills are explicit-load only and do not appear in the flat prompt skill index.

For AIVV first slice, plugin-bundled skills can be registered later as explicit `aivv:<skill>` names. `/aivv-doctor` should report skill registration state but must not require skill auto-loading.

## Verified installed CLI shape

### Plugin commands

Installed CLI supports:

```bash
hermes plugins install <identifier> [--force] [--enable|--no-enable]
hermes plugins update <name>
hermes plugins remove|rm|uninstall <name>
hermes plugins list|ls
hermes plugins enable <name>
hermes plugins disable <name>
```

`hermes plugins enable --help` confirms:

```text
usage: hermes plugins enable [-h] name
```

`hermes plugins list` prints installed/discovered plugins and explicitly says plugins are opt-in by default.

### Profile path

`hermes profile show default` reports:

```text
Profile: default
Path:    ~/.hermes
```

Therefore default-profile dogfood install should resolve to:

```text
~/.hermes/plugins/aivv
```

Named profile support should resolve to:

```text
~/.hermes/profiles/<name>/plugins/aivv
```

unless `--hermes-home <path>` explicitly overrides.

## Diagnostic command contract

Functional diagnostic commands:

```text
/aivv-doctor
/aivv-probe
```

`/aivv-doctor` reports plugin readiness, asset resolution, metadata validity, and safety defaults. `/aivv-probe` reports plugin-visible Hermes capability interfaces without executing those interfaces by default.

Absent or hard-disabled future workflow commands:

```text
/aivv
/aivv-fix
/aivv-view
/aivv-calibrate
```

If placeholders are ever required by Hermes discovery, they must return:

```text
NOT_IMPLEMENTED_EXPERIMENTAL
```

and must not:

- write project files;
- call providers or models;
- make network calls;
- dispatch reviewers;
- call `delegate_task`;
- imply that real Hermes review/fix support is ready.

## Doctor output contract

Default text output must include these labels:

```text
AIVV Hermes Doctor: PASS|WARN|FAIL
Plugin loaded: yes|no
Plugin name: aivv
Hermes home: <path|unknown>
Hermes mode: cli|gateway|unknown
Functional commands: aivv-doctor
Future commands: aivv,aivv-fix,aivv-view,aivv-calibrate intentionally absent|disabled
Asset manifest: ok|missing|invalid
Adapter metadata: ok|missing|invalid
Plugin skills: ok|degraded|unsupported
Tool availability: ok|degraded|unknown
Direct dispatch from plugin: available|unavailable|requires-agent-routed|unknown
Agent routing mode: instruction_injected|instruction_render_only|unavailable|unknown
State write probe: skipped|ok|failed
Review enabled: no
```

`/aivv-doctor --json` must emit equivalent parseable JSON.

## Capability probe output contract

Default `/aivv-probe` text output must include these labels:

```text
AIVV Hermes Capability Probe: PASS|WARN|FAIL
Mode: diagnostic-only capability detection
Functional commands: aivv-doctor,aivv-probe
Future commands: aivv,aivv-fix,aivv-view,aivv-calibrate intentionally absent
Review enabled: no
Host LLM facade: interface_present_not_called|interface_absent|unknown
Direct dispatch from plugin: interface_present_not_called|interface_absent|unknown
Inject message: interface_present_not_called|interface_absent|unknown
Delegate task probe: not_available_to_plugin_context
Independent review: not_proven
State write probe: skipped|written|failed
```

`/aivv-probe --json` must emit equivalent parseable JSON. `/aivv-probe --probe-state-write[=PATH]` writes a non-overwriting JSON probe artifact. `/aivv-probe --review-capability-proof[=PATH]` writes a non-overwriting local Phase 2 proof artifact below `.aivv/state/hermes-capability-probes/`; this slice builds/hash-checks a local evidence packet but still reports `independent_review: not_proven`, `review_enabled: false`, and `decision: NOT_READY`. Both write modes are explicit only and still must not call provider/model APIs, network, tool dispatch, message injection, or `delegate_task`.

## Safety requirements for doctor and probe

By default, `/aivv-doctor` and `/aivv-probe` must not:

- make provider/model calls;
- make network calls;
- call `delegate_task`;
- write project files;
- read or print secrets;
- dump environment variables;
- dump full Hermes config.

Any future write probe must be explicit and must write only below a declared AIVV state path such as `.aivv/state/hermes-doctor/` or `.aivv/state/hermes-capability-probes/`.

## Installer safety contract

`scripts/install-hermes.sh` must support:

- `--dry-run`;
- `--profile <name>`;
- `--hermes-home <path>`;
- `--force`;
- `--enable`;
- rollback/uninstall guidance.

Path resolution precedence:

1. `--hermes-home <path>`;
2. `--profile <name>` -> `~/.hermes/profiles/<name>`;
3. `$HERMES_HOME`;
4. `~/.hermes` for default profile only.

Installer must print resolved source, destination, dry-run status, overwrite status, and enable attempt before writing.

Installer must refuse:

- destination `/`;
- destination `$HOME`;
- destination repo root;
- symlink/path escape;
- overwrite without `--force`;
- force-replace of a directory without an AIVV ownership marker.

`--enable` is rejected until a later approved command-enablement slice. Dry-run and install paths must not execute `hermes plugins enable aivv`.

## Capability status after Task 0

- manifest/user plugin layout: `available`
- slash command registration: `available`
- slash command raw-args handler: `available`
- async command handler support: `available`
- plugin skill registration: `available`
- direct tool dispatch API: `available` as an API, `unverified` for AIVV review integrity
- CLI instruction injection: `conditional`
- gateway instruction injection: `unsupported` by `ctx.inject_message`; use `instruction_render_only`
- real AIVV review/fix orchestration: `unsupported` in first slice
- reviewer evidence packet integrity: `unverified`, future probe required

## Implementation go/no-go

Task 0 go decision:

- GO for Task 1 taxonomy/runtime-contract implementation.
- GO for dogfood plugin substrate that exposes only diagnostic commands (`/aivv-doctor` and `/aivv-probe`).
- NO-GO for real `/aivv`, `/aivv-fix`, `/aivv-view`, or `/aivv-calibrate` orchestration.
- NO-GO for direct `delegate_task` reviewer dispatch until future probes prove cold-subagent isolation and evidence-packet integrity.

## Task 2 Metadata Alignment

Machine-readable capability and operation claims for this host live in `.aivv/adapters/hermes.json` and must validate against `.aivv/schemas/adapter-metadata.json`. This prose section mirrors the first-slice JSON choices so future implementation agents do not infer broader support from the Task 0 API evidence above.

### Capability matrix

- `can_spawn_cold_agents`: `conditional` — Hermes has `delegate_task`, but AIVV review dispatch remains disabled until later probes prove safe reviewer isolation on the active surface.
- `can_isolate_reviewer_context`: `conditional` — pending proof that cold children receive only the intended evidence packet.
- `can_hide_peer_outputs_until_synthesis`: `conditional` — pending proof that parallel reviewers cannot see peer outputs before synthesis.
- `can_parallelize_agents`: `conditional` — likely available through batch delegation, but not review-enabled without isolation and peer-output probes.
- `can_read_conversation_history`: `partial` — plugin command handlers do not receive complete session history directly.
- `can_read_tool_history`: `partial` — no complete plugin-level tool-history contract is pinned.
- `can_enforce_readonly`: `partial` — first-slice posture is policy plus drift detection, not sandbox enforcement.
- `can_write_project_state`: `conditional` — allowed only after the target state path is validated by `/aivv-doctor` and the active surface exposes safe file tools.
- `can_resolve_skill_assets`: `conditional` — expected through plugin-packaged assets, but must be proven after install on the active Hermes profile/surface.
- `can_invoke_peer_skill`: `conditional` — Hermes plugin skills are namespaced explicit assets, not automatic behavior.
- `can_emit_runtime_probe_scaffolds`: `unverified` — not implemented or probed in this first metadata slice.
- `can_ingest_runtime_results`: `unverified` — likely possible through file reads, but not verified for Hermes AIVV flows.

### Operation mapping

- `read_session_context`: `partial_agent_context`
- `gather_change_context`: `hermes_tools`
- `resolve_asset`: `plugin_asset_resolver_conditional`
- `check_capability`: `aivv_doctor_probe`
- `build_reviewer_evidence_packet`: `agent_constructed_future_slice`
- `spawn_reviewers`: `delegate_task_conditional_future_probe`
- `spawn_investigator`: `delegate_task_conditional_future_probe`
- `close_consumed_subagents`: `unverified`
- `write_state`: `conditional_file_tools`
- `apply_fix`: `not_first_slice`
- `handoff_to_fix`: `not_first_slice`
- `capture_workspace_state`: `git_snapshot_or_degraded`
- `compute_fingerprint`: `git_hash_or_degraded`
- `schema_gate`: `schema_validators`
- `track_progress`: `host_progress_tool_conditional`

### Execution posture

- `first_supported_mode`: `agent_routed_command`
- `direct_plugin_delegate_task`: `probe_required`
- `review_enabled`: `false` by default; `true` only inside explicit controlled test-profile review artifacts (fake-reviewer smoke or injected no-provider CLI dispatch proof)
- `review_capability_proof_mode`: `diagnostic_local_not_ready`
- `proof_artifacts_are_review_artifacts`: `false`
- `proof_artifact_decision_current_slice`: `NOT_READY`
- `readonly_review_artifact_contract`: `available_local_only`
- `dry_run_review_packet_builder`: `available_local_only`
- `readonly_aivv_command_enabled`: `controlled_test_profile_cli_only`
- `controlled_fake_reviewer_smoke`: `available_test_profile_cli_only`
- `real_dispatch_proof`: `available_test_profile_cli_injected_no_provider_only`
- `evidence_packet_hashing_proves_isolation`: `false`
- `cli_gateway_proof_status`: `separate`
- `live_reviewer_dispatch`: `unverified`
- first-slice registered command: `/aivv-doctor`
- capability-probe slice registered commands: `/aivv-doctor`, `/aivv-probe`
- controlled test-profile CLI registered commands: `/aivv-doctor`, `/aivv-probe`, `/aivv`
- default/live blocked commands: `/aivv`, `/aivv-fix`, `/aivv-view`, `/aivv-calibrate`
- current-slice blocked real workflow commands: `/aivv-fix`, `/aivv-view`, `/aivv-calibrate`

`review_enabled: false` remains the invariant for default diagnostics, proof artifacts, and live-profile Hermes adapter slices. The current `review_enabled: true` artifacts are limited to controlled test-profile CLI evidence: fake-reviewer installed-copy smoke (`live_reviewer_dispatch=not_performed`) and injected no-provider CLI dispatch proof (`live_reviewer_dispatch=proof_injected_no_provider`). Both are marked `DEGRADED` and are not evidence of live reviewer dispatch readiness. Real provider-backed review/fix dispatch stays disabled until future capability probes prove reviewer isolation, peer-output hiding, workspace drift behavior, and safe dispatch topology, and a later command-enablement plan passes.

Phase 4 controlled CLI contracts may register `/aivv` only behind the explicit environment-plus-marker test-profile gate. The normal dry-run path builds local read-only packets without dispatch. The fake-reviewer smoke uses fake reviewers only; the real-dispatch proof path uses injected no-provider reviewers only. Both write confined review artifacts, do not call provider/model APIs, do not call `delegate_task`, and do not make gateway readiness claims.

## First-slice implementation status

The diagnostic-only plugin package lives at `packages/hermes/aivv_hermes_plugin/` and local dogfood installation is handled by `scripts/install-hermes.sh`.

Implemented diagnostic and controlled test-profile behavior:

- plugin manifest and `register(ctx)` expose `/aivv-doctor` and `/aivv-probe` by default;
- `/aivv` registers only under the explicit test-profile CLI gate (`AIVV_HERMES_ENABLE_READONLY_COMMAND=1` plus the non-symlink marker file in `HERMES_HOME`);
- bundled `aivv-doctor` plugin skill is registered only when Hermes plugin-skill registration is available;
- doctor output verifies parseable `.aivv/adapters/hermes.json` and `.aivv/assets.manifest.json`, required assets, plugin/command status, Hermes home/mode, and safe capability states;
- probe output reports plugin-visible Hermes interfaces (`llm`, command registration, skill registration, `dispatch_tool`, `inject_message`) without calling provider/model APIs, dispatching tools, injecting messages, using `delegate_task`, or making network calls;
- default doctor/probe execution is read-only and records `network_calls`, `provider_model_calls`, `delegate_task_calls`, secret/auth reads, and project mutation as not performed;
- explicit `--write-report` on `/aivv-doctor` is confined to `.aivv/state/hermes-doctor/` and refuses to overwrite existing files;
- explicit `--probe-state-write` on `/aivv-probe` is confined to `.aivv/state/hermes-capability-probes/` and refuses to overwrite existing files;
- controlled `/aivv --fake-reviewer-run` is available only when both test-profile gates are set; it uses injected fake reviewers, writes only under `.aivv/state/hermes-readonly-reviews/`, validates the artifact schema, reports `review_enabled: true` for that fake smoke artifact only, and records `gateway_readiness=unverified`;
- controlled `/aivv --real-dispatch-proof` is available only when the read-only command gate, non-symlink marker, and `AIVV_HERMES_ENABLE_REAL_DISPATCH_PROOF=1` are set; it uses injected no-provider reviewers only, persists reviewer packets/outputs and a schema-valid `DEGRADED` artifact under `.aivv/state/hermes-readonly-reviews/`, records `real_dispatch_proof=true`, reviewer output refs, and `live_reviewer_dispatch=proof_injected_no_provider`, and does not call providers, network, `delegate_task`, or gateway paths;
- real workflow commands remain absent: `/aivv-fix`, `/aivv-view`, `/aivv-calibrate`;
- independent review remains `not_proven`; this slice does not claim real review/fix execution readiness;
- the installer is profile-aware, supports dry-run/force, rejects live/default `--enable` until a later approved live/default command-enablement gate, writes an AIVV ownership marker, and refuses unowned overwrites, invalid ownership markers, and risky destination roots.

Current local smoke evidence from a temporary `HERMES_HOME` install:

```text
bash scripts/install-hermes.sh --hermes-home "$TMP_HOME" --force
PYTHONPATH="$TMP_HOME/plugins" HERMES_HOME="$TMP_HOME" python3 - <<'PY'
# import aivv, call register(ctx), invoke aivv-doctor --json and aivv-probe --json
PY
installed_probe_smoke=PASS
commands=aivv-doctor,aivv-probe
doctor_overall=PASS
probe_overall=PASS
independent_review=not_proven
```

This smoke verifies local install/import behavior and command registration shape without mutating the real Hermes profile.

Earlier live default-profile evidence (2026-06-07 22:23:58 BST) covered the prior `/aivv-doctor`-only diagnostic slice. It is retained as historical evidence only; the current `/aivv-probe` capability slice is validated by the temporary `HERMES_HOME` smoke above and must be installed/enabled in a live profile separately if live gateway UX is required.

Validation for the capability-probe slice:

```text
python3 -m unittest discover -s packages/hermes/tests -v
Ran 21 tests
OK

bash tools/validate.sh
validate.sh passed (with warnings)
```

Gateway slash-command UX is not claimed as ready for real review/fix/view/calibration workflows; those commands remain absent until a later capability artifact proves safe independent review.

## Phase 2 Task 0 live Hermes API/delegation evidence

**Captured:** 2026-06-08 13:16:11 BST
**Scope:** read-only source/docs inspection of the local Hermes checkout; no live plugin install, no provider/model call, no network call, no `delegate_task` execution.

Evidence sources inspected:

- `~/.hermes/hermes-agent/hermes_cli/plugins.py`
- `~/.hermes/hermes-agent/run_agent.py`
- `~/.hermes/hermes-agent/tools/delegate_tool.py`
- `~/.hermes/hermes-agent/gateway/run.py`
- `~/.hermes/hermes-agent/website/docs/user-guide/features/delegation.md`

Findings:

- `PluginContext.register_command(name, handler, description="", args_hint="")` registers slash commands whose handlers receive only `raw_args: str`; plugin slash-command handlers do not receive a full current agent/session object directly.
- `PluginContext.inject_message(content, role="user")` depends on `_cli_ref`; source returns `False` and logs `not available in gateway mode` when `_cli_ref` is absent.
- `PluginContext.dispatch_tool(tool_name, args, **kwargs)` exists and can route through `tools.registry.registry.dispatch`, but it only auto-wires `parent_agent` when `_cli_ref.agent` exists. Source comments say gateway lacks `_cli_ref`; therefore gateway direct plugin tool dispatch cannot be treated as equivalent to CLI agent-routed dispatch.
- Gateway plugin command dispatch calls the plugin handler directly with `event.get_command_args().strip()` and returns the handler's result. The observed gateway path does not pass a parent agent/session object into plugin handlers.
- `AIAgent._dispatch_delegate_task(...)` calls the delegate implementation with `parent_agent=self`; this is the reliable agent-routed path for delegation because it supplies parent context explicitly.
- The registry entry for `delegate_task` passes `parent_agent=kw.get("parent_agent")`; a plugin `ctx.dispatch_tool("delegate_task", ...)` call without auto-wired `parent_agent` therefore remains unproven for AIVV reviewer dispatch.
- Hermes delegation docs state subagents start with a fresh conversation and only the parent-supplied `goal` and `context`; code also constructs a child `AIAgent` with `skip_context_files=True` and `skip_memory=True`, `enabled_toolsets=child_toolsets`, and a fresh per-child iteration budget. This supports the design direction, but it is not by itself a complete runtime proof that AIVV reviewer packets are isolated on every surface.
- Toolset restriction is available as a child-agent configuration (`enabled_toolsets=child_toolsets`), but read-only enforcement remains partial: toolsets can omit write-capable tools only when the caller selects read-only toolsets, and this must be paired with workspace drift detection. It is not a hard sandbox guarantee.
- Batch delegation is documented as parallel and only child summaries return to the parent. This supports peer-output hiding as a likely property, but Phase 2 must still prove sibling reviewers cannot observe peer outputs before synthesis for the specific AIVV dispatch path.

Task 0 decision:

- **GO** for local evidence-packet hashing, schema validation, non-overwriting proof artifacts, simulated/stubbed contract tests, and diagnostic `/aivv-probe --review-capability-proof` work.
- **NO-GO** for live reviewer-dispatch probes in plugin command code without a separate explicit approval, because executing them would invoke live subagents/providers and may spend API money.
- **NO-GO** for marking gateway independent-review support READY from CLI/source evidence.
- **NO-GO** for setting `review_enabled: true` or registering real `/aivv*` commands in Phase 2.

Status impact:

- `direct_plugin_delegate_task`: remains `probe_required` / unverified for review workflows.
- `agent_routed_delegate_task`: remains the preferred future path for real review workflows, but still requires a bounded live proof before command enablement.
- `can_isolate_reviewer_context`: remains `conditional` until a proof artifact validates exact AIVV evidence-packet delivery.
- `can_hide_peer_outputs_until_synthesis`: remains `conditional` until a proof artifact validates batch reviewer behavior for the target surface.
- `can_enforce_readonly`: remains `partial` because current evidence supports toolset restriction plus drift detection, not a hard read-only sandbox.
- `review_enabled`: remains `false`.

## Phase 2 Tasks 1-4 local evidence-packet/proof-artifact helpers

**Status:** implemented as local, stdlib-only proof helpers; no real reviewer dispatch and no `/aivv*` command enablement.

Added local contracts:

- `packages/hermes/aivv_hermes_plugin/review_capability.py` builds canonical reviewer evidence packets and computes `sha256:<hex>` hashes from deterministic JSON serialization.
- Evidence packets include claim, target, context sources, workspace snapshot, reviewer metadata, surface label, explicit excluded-context declarations, and side-effect safety fields.
- Secret-like keys (`token`, `api_key`, `password`, `authorization`) are rejected before hashing.
- Supported surfaces remain limited to `cli`, `gateway`, and `unknown`; a CLI packet/proof is not a gateway proof.
- Proof artifacts record workspace-before/after, surface-bound reviewer packet refs, reviewer packet hashes, workspace-drift status, isolation result, peer-output result, read-boundary result, state-write result, decision, degradations, evidence refs, and hard `review_enabled: false`.
- Proof artifact validation rejects schema-invalid hashes, unsupported fields, mismatched surface refs, inconsistent hash/ref lists, and inconsistent workspace-drift fields.
- Proof artifact writes use exclusive-create semantics and refuse overwrites.
- `.aivv/schemas/hermes-review-capability-proof.json` captures the Phase 2 proof artifact shape and is now included in the plugin asset manifest/install copy.

Current command-level decision semantics:

- `/aivv-probe --review-capability-proof[=PATH]` writes a local `NOT_READY` artifact only.
- This slice deliberately sets live isolation and peer-output evidence to `unverified`; it does not dispatch reviewers and therefore cannot prove `READY` or `DEGRADED` command-level review capability.
- The helper module contains validation safeguards for future non-`NOT_READY` artifacts so later phases cannot overclaim readiness from malformed or drifted evidence.
- Regardless of helper validation behavior, real Hermes review enablement remains blocked until a later accepted surface-specific probe artifact and command-enablement plan pass.

Validation evidence:

```text
python3 -m unittest discover -s packages/hermes/tests -v
Ran 33 tests
OK

bash tools/validate.sh
validate.sh passed (with warnings)

installed_task12_smoke=PASS
commands=aivv-doctor,aivv-probe
doctor_overall=PASS
probe_overall=PASS
schema_installed=TRUE
```

## Future evidence packet contract

Hermes must not claim cold independent review until each reviewer receives a canonical evidence packet whose integrity can be audited. The future packet contract must include at least:

- `schema_version` and `packet_version`;
- active `host`, `surface`, `dispatch_path`, and AIVV command/request metadata;
- reviewer slot metadata: `reviewer_id`, `lens`, provider/model attribution when applicable, tool-access policy, and context-source labels;
- target/workspace metadata and workspace drift guard inputs;
- exact user-supplied request, change evidence, session-context fields, unavailable-field markers, and adapter capability degradations;
- peer-output exclusion proof: reviewers must not receive other reviewer outputs before synthesis;
- canonical serialization for hashing: deterministic JSON with sorted keys and UTF-8 bytes;
- canonical hash algorithm: `sha256:<hex>` over that serialization;
- degraded fallback behavior when supplied-context-only dispatch cannot be proven: stop or record an explicit degradation, never silently call it independent review.

## Future Hermes capability probe artifact

Future Hermes probes must write explicit artifacts under:

```text
.aivv/state/hermes-capability-probes/<timestamp>.json
```

Required fields:

```json
{
  "host": "hermes-agent",
  "surface": "cli_or_gateway",
  "probe_version": "string",
  "children_received_only_supplied_context": "pass_fail_unverified",
  "peer_outputs_hidden_until_synthesis": "pass_fail_unverified",
  "toolset_constrained": "pass_fail_unverified",
  "workspace_drift_guard_detected_mutation": "pass_fail_unverified",
  "direct_plugin_delegate_task_available": "pass_fail_unverified",
  "agent_routed_delegate_task_available": "pass_fail_unverified",
  "evidence_packet_hash": "sha256:<hex>|unavailable_when_no_review_packet",
  "decision": "READY_or_DEGRADED_or_NOT_READY",
  "capability_degradations": [],
  "evidence_refs": []
}
```

Until an accepted probe artifact reports `READY`, Hermes real commands remain absent. If a later implementation must expose placeholders, they must hard-stop with `NOT_IMPLEMENTED_EXPERIMENTAL`, avoid provider/model/network/delegation/project-mutation side effects, and point users to `/aivv-doctor`.

## Runtime evidence semantics

Hermes must not silently drop runtime-evidence fields from future review or fix logs. Runtime probe scaffold emission (`can_emit_runtime_probe_scaffolds`) and runtime-evidence ingest (`can_ingest_runtime_results`) remain `unverified` or degraded until implemented and probed on the active Hermes surface. Any future runtime-evidence support must preserve probe ids, assertion polarity, retry/flake metadata, timestamps, and ingestion provenance rather than collapsing them into prose notes.
