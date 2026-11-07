# Gemini Platform Adapter

> Provider adapter: this document describes provider/backend behavior (model dispatch via `dispatch.mjs` subprocess), not host execution capabilities. Host capabilities are owned by the active host adapter (`claude-code.md` / `codex.md`).
**Status:** Shipped — implemented in `tools/dispatch.mjs`; legacy Gemini CLI live run confirmed 2026-05-21; Antigravity CLI print-mode smoke test confirmed 2026-06-04
**Probe command:** use the `AIVV_ROOT` pinned and preflighted at the current AIVV invocation's start, then run `node "$AIVV_ROOT/tools/dispatch.mjs" --probe --provider gemini --provider-egress-consent`

## Auth strategy (`--auth-mode auto`, the default)

`dispatch.mjs` is a standalone Node script — it is NOT inside an MCP transport context. API keys are therefore NOT required by default when a supported Google CLI is installed and authenticated. Google announced that Gemini CLI stops serving consumer/free Google AI Pro/Ultra/individual requests on June 18, 2026 ([Google Developers Blog](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)); AIVV therefore prefers Antigravity CLI (`agy`) before the legacy `gemini` binary.

**Resolution order (auto mode):**

| Priority | Method | Setup | Notes |
|---|---|---|---|
| 1 | **Antigravity CLI subprocess** | Install/authenticate `agy` | Forward-compatible Google CLI path. Uses existing authenticated session. |
| 2 | **legacy gemini CLI subprocess** | `gemini auth login` (Google OAuth) | Kept as compatibility fallback while the legacy CLI serves the user's account/license. Its OAuth token-refresh issue ([gemini-cli #23776](https://github.com/google-gemini/gemini-cli/issues/23776)) applies only inside an active MCP server context and does not affect dispatch.mjs subprocess invocation. |
| 3 | **`GEMINI_API_KEY` env var** | `export GEMINI_API_KEY=...` (get at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) | Stable API-key path with direct model control. |

**No auth found:** exits with code 3 and prints guidance listing both options.

Force API key only: `--auth-mode api_key`

For shared authentication settings, see [Configuration keys](../configuration.md#configuration-keys) and the [golden configuration schema](../schemas/config.schema.json) (config.schema.json:519-530). In `cli` mode, AIVV tries supported Google CLI subprocesses in order (`agy`, then legacy `gemini`); it does not force one binary (dispatch.mjs:1484-1495).

## Capability matrix

| Capability | Status | Notes |
|---|---|---|
| `can_spawn_cold_agents` | Available via dispatch.mjs subprocess | Provider subprocesses are not host cold agents; host dispatch isolation is owned by the active host adapter. |
| `can_structured_output` | Available — API: `responseSchema`; CLI: instructed-JSON + retry | CLI path: ~97% with 2-iteration retry |
| `can_parallel_dispatch` | Available — run N dispatch.mjs subprocesses | Practical max 3 (provider quota) |
| `can_enforce_readonly` | Enforced — dispatch.mjs is a pure HTTP/subprocess client | Provider path has no host tools; host read-only enforcement remains a host-adapter capability. |

## CLI subprocess invocation

```bash
# Non-interactive invocation (auto-detected from PATH)
printf '%s' "$packed_prompt" | agy --print "$json_suffix" --model "$model" --print-timeout "${timeout_secs}s"
# legacy fallback:
printf '%s' "$packed_prompt" | gemini -p "$json_suffix" -o text
```

The packed AIVV review prompt is sent on stdin; the JSON-only response instruction is passed as the CLI print/prompt argument. JSON output is obtained via **instructed-JSON** (see "Structured output — CLI path" below). This avoids any dependency on structured-output flags that may behave differently across Google CLI versions.

## API endpoint (API key path)

`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`

**Auth path:** API key via `?key=$GEMINI_API_KEY` query parameter.

## Structured output — API path

Use `generation_config.responseSchema` + `responseMimeType: "application/json"`:

```json
{
  "generation_config": {
    "responseMimeType": "application/json",
    "responseSchema": { "...findings schema..." }
  },
  "contents": [{ "parts": [{ "text": "..." }] }]
}
```

**Note:** property order in `responseSchema` should match the prompt's property order for most-reliable output. Verify against current Gemini API docs at implementation time.

**Response extraction:** `candidates[0].content.parts[0].text` — with `responseMimeType: application/json`, this is always valid JSON.

## Structured output — CLI path

Append a JSON-mode instruction to the end of the prompt before invoking the CLI:

```
\n\nRESPONSE FORMAT: Respond with ONLY a valid JSON object. No markdown code fences, no explanation before or after. Use exactly this structure: {"findings": [...]}. If no issues found, return {"findings": []}.
```

**Parse + extract:**
1. Strip any ` ```json...``` ` fences: `/```json\n?([\s\S]*?)\n?```/`
2. Find first `{` to last `}` in output
3. `JSON.parse()` the extracted region
4. Validate against `findings-multimodel.schema.json`
5. On failure: retry once with stronger JSON instruction prepended
6. On second failure: emit `{status: "structural-parse-failed", ...}` and exit 9

## Error handling (API paths)

| HTTP status | Action |
|---|---|
| 429 | Retry with exponential backoff |
| 401/403 | Fail-fast, exit code 2 |
| 503 | Retry |
| 400 (schema error) | Log schema validation failure, emit structural-parse-failed |
