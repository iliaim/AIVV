# Multi-Model Dispatch

Read before provider-backed dispatch/synthesis. Owns Case D
(`multi_model_enabled: true`).

## Runtime Root

Resolve `AIVV_ROOT` through the bundled `.aivv/runtime-root.md` runtime-root contract:
- Active plugin package: resolve to that package root, even when a legacy
  `${CODEX_HOME}/aivv-runtime` also exists.
- Legacy Codex skill install: resolve its sibling `${CODEX_HOME}/aivv-runtime`;
  support copies under `${CODEX_HOME}/skills` are not runtime roots. The
  resolver supports custom Codex roots and does not assume a default home.

Set `PROMPT_BUNDLE_MJS="$AIVV_ROOT/tools/aivv-prompt-bundle.mjs"` and
`CATALOG_PATH="$AIVV_ROOT/tools/model-catalog.json"`. Load role fallbacks for
`reviewer.primary`, `reviewer.fast`, and `reviewer.secondary`.

## Provider Readiness

For each non-native provider in `reviewer_provider_priority`, run:

```bash
node "$AIVV_ROOT/tools/dispatch.mjs" --probe --provider <X> --provider-egress-consent
```

The readiness is established by ONE mechanism: the probe exit code. Exit 0
means candidate provider; non-zero means unavailable and must be recorded with
exit code/reason. Do not inspect API-key env vars or `.aivv/models*.json`; CLI
OAuth is the default auth source. There is NO "model-diversity-within-Anthropic" degradation; Anthropic model variants are one provider and never satisfy cross-provider review.

Claude Code native Anthropic path: available through native Agent path
(`provider: "anthropic-native"`, `dispatch_path: "agent-tool"`). Gemini/OpenAI
still use `dispatch.mjs --probe`. On Codex/other hosts with Node >= 20, still
probe, then run `aivv-prompt-bundle.mjs --render-prompt-only` as pre-egress
contract check; render failure skips the provider and records the error. Only a
host without Node >= 20 is probe-less.

No provider/native path -> warn and fall back to Case A. One provider available
at N >= 2 -> continue, but cross-provider verification is unreachable.

## Provider Selection And Dispatch

Effective N comes from `--reviewers=N` or resolved default:

```text
ordered_avail = [p for p in reviewer_provider_priority if p in providers_available]
providers_to_dispatch = ordered_avail[:N]
fallback_slot_count = max(N - len(ordered_avail), 0)
```

Priority omission is config opt-out. Empty priority warns and falls back to
alphabetical available providers.

Build one request JSON per selected provider from Step 4 inputs: reviewer label,
review mode, assigned lens, thoroughness, direction, capability degradations,
scope, working directory, and structured session context. Write temp JSON; do
not shell-quote large prompt payloads. `aivv-prompt-bundle.mjs` owns prompt
packing, required-source enforcement, provider trust disclosure, transport,
envelope validation, schema repair retry, and failure classification. Provider
egress requires `--provider-egress-consent` after disclosing provider/model,
evidence classes, destination shape, prompt hash/bytes, and source list from
`--render-prompt-only`.

Dispatch selected providers in parallel where possible. Claude Code uses native
Agent for Anthropic and prompt-bundle jobs for Gemini/OpenAI; Codex/other hosts
use prompt-bundle jobs for all selected providers. Sequential fallback is
allowed only when the host shell cannot background jobs.

## Parse Outputs And Fallback

Successful provider result shape:

```json
{"label":"alpha","provider":"openai","model":"...","model_source":"provider-reported|request|model-catalog","findings":[],"finding_count":0,"dispatch_path":"provider"}
```

Agent-tool source: parse native response; empty findings is a successful clean
review. NDJSON source: parse each line; finding lines have no `_meta`; final
line must have `_meta:true` and `status:"complete"`, otherwise provider failed.

Maintain `slot_attempts[]` with `{label, assigned_lens, requested_provider,
requested_model, status, status_reason, replacement_provider?,
replacement_model?}`.

Fallback order:
1. Priority-chain fallback: for failed/unfilled slots, walk
   `reviewer_provider_priority` to next not-yet-failed available provider;
   preserve original slot label and emit one provider-chain status line.
2. If unresolved slots remain, apply `multi_model_fallback_strategy`. `ask`
   (default) prompts the user with 4 options: (1) **Skip this provider now** —
   proceed with N−failed reviewers, record `capability_degradations`; (2)
   **Replicate with default provider** — one extra `reviewer_provider_priority[0]`
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
