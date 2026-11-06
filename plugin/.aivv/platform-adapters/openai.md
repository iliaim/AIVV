# OpenAI Platform Adapter

> Provider adapter: this document describes provider/backend behavior (model dispatch via `dispatch.mjs` subprocess), not host execution capabilities. Host capabilities are owned by the active host adapter (`claude-code.md` / `codex.md`).
**Status:** Cycle 2 — implementation in `tools/dispatch.mjs` (not yet shipped)
**Probe command:** resolve `AIVV_ROOT` through the shared [runtime-root contract](../runtime-root.md), then run `node "$AIVV_ROOT/tools/dispatch.mjs" --probe --provider openai --provider-egress-consent`

## Auth strategy (`--auth-mode auto`, the default)

**Resolution order (auto mode):**

| Priority | Method | Setup | Notes |
|---|---|---|---|
| 1 | **codex CLI subprocess** | `codex auth` (OAuth) | No API key needed. Uses existing authenticated session. |
| 2 | **`OPENAI_API_KEY` env var** | `export OPENAI_API_KEY=sk-...` | Traditional API key path. |

**No auth found:** exits with code 3 and prints guidance listing the options above.

Force API key only: `--auth-mode api_key`

For shared authentication settings, see [Configuration keys](../configuration.md#configuration-keys) and the [golden configuration schema](../schemas/config.schema.json) (config.schema.json:519-530).

## Capability matrix

| Capability | Status | Notes |
|---|---|---|
| `can_spawn_cold_agents` | Available via dispatch.mjs subprocess | Provider subprocesses are not host cold agents; host dispatch isolation is owned by the active host adapter. |
| `can_structured_output` | Available — API: `json_schema strict`; CLI: instructed-JSON + retry | CLI path: ~97% with 2-iteration retry |
| `can_parallel_dispatch` | Available — run N dispatch.mjs subprocesses | |
| `can_enforce_readonly` | Enforced — dispatch.mjs is a pure HTTP/subprocess client | Provider path has no host tools; host read-only enforcement remains a host-adapter capability. |

## CLI subprocess invocation

```bash
# Non-interactive (quiet) invocation
codex -q "$prompt"
```

JSON output is obtained via **instructed-JSON** (same pattern as Gemini CLI path — see "Structured output — CLI path" below).

**Note on `--output-schema`:** This flag is silently dropped when MCP servers are active ([codex #15451](https://github.com/openai/codex/issues/15451)). The CLI subprocess invocation from `dispatch.mjs` does NOT involve MCP transport, so this concern does not apply here. The instructed-JSON path is used regardless, as it works consistently across CLI versions.

## API endpoint (API key path)

`https://api.openai.com/v1/chat/completions`

**Auth header:** `Authorization: Bearer $OPENAI_API_KEY`

## Structured output — API path

Use `response_format: {type: "json_schema", json_schema: {name: "findings", strict: true, schema: {...}}}`:

```json
{
  "model": "<model-id>",
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "findings_response",
      "strict": true,
      "schema": { "...findings schema..." }
    }
  },
  "messages": [{ "role": "user", "content": "..." }]
}
```

**Response extraction:** `choices[0].message.content` — always valid JSON when `response_format.type === "json_schema"`.

## Structured output — CLI path

Append a JSON-mode instruction to the prompt before invoking the CLI (identical pattern to Gemini CLI path):

```
\n\nRESPONSE FORMAT: Respond with ONLY a valid JSON object. No markdown code fences, no explanation before or after. Use exactly this structure: {"findings": [...]}. If no issues found, return {"findings": []}.
```

Parse + extract + retry logic is identical to the Gemini CLI path (see `gemini.md`).

## API-key fallback

When the `codex` CLI is unavailable or fails, `dispatch.mjs` falls back to `OPENAI_API_KEY`; it does not read `~/.codex/config.json`. (dispatch.mjs:1759-1774)

## Error handling (API path)

| HTTP status | Action |
|---|---|
| 429 | Retry with exponential backoff (check `Retry-After` header if present) |
| 401 | Fail-fast, exit code 2 |
| 503 | Retry |
