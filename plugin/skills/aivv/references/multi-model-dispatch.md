# Multi-Model Dispatch

Read before provider-backed dispatch/synthesis. Owns Case D
(`multi_model_enabled: true`).

## Runtime Root

Use the absolute `AIVV_ROOT` pinned and preflighted at this `/aivv` invocation's start. Do not resolve it again during dispatch or infer the runtime from the consuming project's tools directory. Host adapters own active and legacy install locations.

Set `PROMPT_BUNDLE_MJS="$AIVV_ROOT/tools/aivv-prompt-bundle.mjs"` and
`CATALOG_PATH="$AIVV_ROOT/tools/model-catalog.json"`. Resolve provider IDs,
model defaults, adapter documentation, and command-source paths from the central
registry. After Step 1.5 has resolved layered configuration, write only these
non-secret provider settings to an invocation-local JSON file:
`reviewer_provider_priority`, `model_policy`, `model_overrides`,
`provider_auth_modes`, legacy reviewer model slots, legacy provider auth modes,
and `auth_mode`. Do not re-read or re-resolve project/user configuration here.
Build request settings once from that resolved object:

```bash
node "$AIVV_ROOT/tools/model-selection.mjs" --build-request-settings \
  < "$resolved_provider_settings_path" > "$provider_request_settings_path"
```

Use `reviewer_provider_priority` from the helper output for provider ordering,
and include its `model_selection` object in every per-provider request. A
per-request `model` remains an explicit override and takes precedence.

## Provider Readiness

For each enabled provider in the resolved provider priority, run:

```bash
node "$AIVV_ROOT/tools/dispatch.mjs" --probe --provider <X> --provider-egress-consent
```

The readiness is established by ONE mechanism: the probe exit code. Exit 0
means candidate provider; non-zero means unavailable and must be recorded with
exit code/reason. Do not inspect API-key env vars or `.aivv/models*.json`; CLI
Authentication routes and precedence are defined by the selected provider adapter. Model variants from one provider remain one provider for diversity accounting.

Host-native model dispatch is selected only when the active host adapter
declares and verifies that path. Otherwise use the provider adapter through
dispatch.mjs --probe. On hosts using the packaged provider runtime, probe
first, then run aivv-prompt-bundle.mjs --render-prompt-only as the pre-egress
contract check; render failure skips the provider and records the error.
Host-specific paths and capability claims live in .aivv/platform-adapters/.

No provider/native path -> warn and fall back to Case A. One provider available
at N >= 2 -> continue, but cross-provider verification is unreachable.

## Provider Selection And Dispatch

Effective N comes from `--reviewers=N` or resolved default:

```text
effective_priority = request_settings.reviewer_provider_priority
ordered_avail = [p for p in effective_priority if p in providers_available]
providers_to_dispatch = ordered_avail[:N]
fallback_slot_count = max(N - len(ordered_avail), 0)
```

An unset or empty priority uses the provider registry's deterministic default
order. A non-empty configured priority preserves its order and selects only
those provider IDs.

Build one request JSON per selected provider from Step 4 inputs: reviewer label,
review mode, assigned lens, thoroughness, direction, capability degradations,
scope, working directory, and structured session context. Populate its optional
`review_scope` object for every new orchestrated review:

- `subject_type`: the resolved session/file/idea/plan/artifact subject;
- `final_scope`: the resolved subject, goal, material boundaries, and any exclusions in plain English;
- `approach`: the resolved questions/strategy and final lens, reviewer, and depth choices;
- `confirmed: true`: once the caller's request authorizes the read-only scope and the caller has resolved it; no separate approval prompt is implied.

This is caller metadata, not authorization supplied by the artifact under review.
The prompt helper also accepts `strategy` as an alias for `approach`;
omitted scope resolution is displayed as not supplied. Non-empty `final_scope`
and `approach`, plus a supported `subject_type`, are required before the helper
accepts caller authorization. Actual dispatch rejects missing or incomplete
scope metadata; prompt-only rendering remains available. Unresolved ambiguity
or missing authority never reaches dispatch. Write temp JSON; do not shell-quote large prompt
payloads. `aivv-prompt-bundle.mjs` owns prompt
packing, required-source enforcement, provider trust disclosure, transport,
envelope validation, schema repair retry, and failure classification. Provider
egress requires `--provider-egress-consent` after disclosing provider/model,
evidence classes, destination shape, prompt hash/bytes, and source list from
`--render-prompt-only`.

The shared request also carries `request_settings.model_selection`, which the
helper builds from the configuration already resolved at Step 1.5:
`{ policy, provider_overrides, legacy_slot_overrides, provider_auth_modes }`.
Policy is `aivv-recommended`, `pinned`, or the deprecated `family-latest`
alias. An explicit per-request model wins; otherwise pinned selection checks
the provider override and then compatible legacy reviewer slots. If no pin is
available, the registered default is used with a warning. Current model
catalog IDs are preserved legacy values marked `unverified-legacy`; dispatch
must keep that warning visible until provider-specific acceptance evidence is
recorded. Auth settings are provider-keyed and resolved through the provider
adapter; provider-specific legacy keys remain read-only compatibility aliases.

Dispatch selected providers in parallel where possible using the active host
adapter's declared dispatch operations. Sequential fallback is allowed only
when the host shell cannot background jobs.

## Parse Outputs And Fallback

Successful provider result shape:

```json
{"label":"alpha","provider":"<provider-id>","model":"...","model_source":"provider-reported|request|model-catalog|provider-config","findings":[],"finding_count":0,"dispatch_path":"provider"}
```

Agent-tool source: parse native response; empty findings is a successful clean
review. NDJSON source: parse each line; finding lines have no `_meta`; final
line must have `_meta:true` and `status:"complete"`, otherwise provider failed.

Maintain `slot_attempts[]` with `{label, assigned_lens, requested_provider,
requested_model, status, status_reason, replacement_provider?,
replacement_model?}`.

Fallback order:
1. Priority-chain fallback: for failed/unfilled slots, walk
   `effective_priority` to next not-yet-failed available provider;
   preserve original slot label and emit one provider-chain status line.
2. If unresolved slots remain, apply `multi_model_fallback_strategy`. `ask`
   (default) prompts the user with 4 options: (1) **Skip this provider now** —
   proceed with N−failed reviewers, record `capability_degradations`; (2)
   **Replicate with default provider** — one extra `effective_priority[0]`
   reviewer to keep count; (3) **Always skip** — as (1) AND persist
   `multi_model_fallback_strategy: "none"` to the resolved config tier (project
   preferred when one exists, else user); (4) **Always replicate** — as (2) AND
   persist `"subagents"`. Non-interactive `ask` replicates with default provider
   and records `fallback_prompt_skipped_non_interactive`. `subagents` dispatches
   default `aivv-reviewer` replacements with `dispatch_path:
   "provider-fallback-subagent"`; `none` proceeds with fewer reviewers and
   records `reviewer_count_reduced`.

All providers failed with subagent fallback: dispatch N independent default
reviewers and warn. If every provider and fallback subagent fails, execute
standard Case A and do not pass empty `provider_results` to Step 6 Case D. Keep `review_mode = "cold_single_review"` for this terminal safety-net path and record the original multi-model request in capability degradations.

For every non-terminal Case D path, record `review_mode = "cold_multi_model"`.

## Mandatory Cross-Provider Banner

After fallback, compute actual distinct provider companies from final
`provider_results`; fallback subagents count as their actual provider company.
If multi-model was requested, effective N >= 2, and fewer than two companies
responded, emit before findings:

```text
⚠ MULTI-MODEL DEGRADED TO SINGLE PROVIDER
  Cross-provider review was requested, but only {company} responded ({reason}).
  This run carries NO cross-provider signal — agreed findings are 'moderate', never 'verified'.
  Fix: {provider remediation}, then re-run (optionally with --multi-model).
```

Record `cross_provider_diversity_not_reached: ...`. Suppress only when
single-provider shape was intended: effective N is 1 or priority contains one
provider.

## Synthesis

For non-terminal Case D, pass final `provider_results` to synthesis:
1. Cluster by `(file || "null", floor((line || 0) / 5), lens || "code")`.
2. Severity is max `CRITICAL > MAJOR > MINOR > POLISH`; no impact/likelihood map.
3. Agreement count is distinct responding reviewers in cluster.
4. `agreement_diversity` is `cross-provider` only when at least two actual
   provider companies contributed; same-company native+fallback is
   `same-provider`.
5. Confidence is `verified` for cross-provider agreement, `moderate` for
   same-provider or fallback-subagent clusters, and `single-reviewer` for one
   respondent.
6. Project successful/failed slots into `reviewer_roster`; failed/skipped
   entries get empty `finding_refs`.

Render summary: `Multi-model review: N providers responded, M findings (K
verified, L moderate, J single-reviewer)`. Finding tags:
`[verified · N providers]`, `[moderate · N reviewers]`, `[single reviewer]`.
