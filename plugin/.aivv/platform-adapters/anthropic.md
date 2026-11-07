# Anthropic Platform Adapter

> Provider adapter: this document describes provider/backend behavior (model dispatch via `dispatch.mjs` subprocess), not host execution capabilities. Host capabilities are owned by the active host adapter (`claude-code.md` / `codex.md`).
**Status:** Cycle 1 — implemented in `tools/dispatch.mjs`
**Probe command:** use the `AIVV_ROOT` pinned and preflighted at the current AIVV invocation's start, then run `node "$AIVV_ROOT/tools/dispatch.mjs" --probe --provider anthropic --provider-egress-consent`

## Auth strategy (`--auth-mode auto`, the default)

`dispatch.mjs` is a standalone Node subprocess. In `auto` mode, it tries the `claude` CLI first — which reuses the existing Claude Code OAuth session. No API key is required if `claude` is in PATH and you are already logged in.

**Resolution order (auto mode):**

| Priority | Method | Setup | Notes |
|---|---|---|---|
| 1 | **`claude` CLI subprocess** | Already logged in via Claude Code | Uses `claude --print --tools "" --no-session-persistence --system-prompt <schema-instruction>`. **NOT used inside Claude Code sessions** (CLAUDECODE=1) — use the Agent tool path instead (see Multi-model provider dispatch in `claude-code.md`). |
| 2 | **`ANTHROPIC_API_KEY` env var** | `export ANTHROPIC_API_KEY=sk-ant-...` (get at [console.anthropic.com](https://console.anthropic.com/)) | REST API with `tool_use` forcing. |

**No auth found:** exits with code 3 and prints guidance.

Force API key only: `--auth-mode api_key`

For shared authentication settings, see [Configuration keys](../configuration.md#configuration-keys) and the [golden configuration schema](../schemas/config.schema.json) (config.schema.json:519-530).

## Capability matrix

| Capability | Status | Notes |
|---|---|---|
| `can_spawn_cold_agents` | Available via dispatch.mjs subprocess | Provider subprocesses are not host cold agents; host dispatch isolation is owned by the active host adapter. |
| `can_structured_output` | Available — CLI: `--system-prompt` schema instruction + extraction; API: `tool_use` forcing | `--json-schema` is NOT used: empirically found to suppress stdout when combined with `--print --output-format text` |
| `can_parallel_dispatch` | Available — run N dispatch.mjs subprocesses | Practical max 3 |
| `can_enforce_readonly` | Enforced — `--tools ""` in CLI path; pure HTTP client in API path | Provider path has no host tools; host read-only enforcement remains a host-adapter capability. |

## CLI subprocess invocation

> **Claude Code note:** The CLI subprocess path is NOT used when running inside a Claude Code session (`CLAUDECODE=1`). Use the `Agent` tool with `subagent_type: aivv:reviewer` instead — see `claude-code.md` "Multi-model provider dispatch" section. The CLI path below applies to Codex and other non-Claude-Code hosts.

```bash
# dispatch.mjs invokes (internal — user does not call this directly):
printf '%s' "$prompt" | claude \
  --print \
  --output-format text \
  --system-prompt 'You are an independent AI code reviewer. Return findings ONLY as a JSON object matching this structure: {"findings":[{"id":"F001","severity":"CRITICAL|MAJOR|MINOR|POLISH","confidence":"HIGH|MEDIUM|LOW","category":"code-bug|design-flaw|process-violation|documentation-gap|clarification-needed|improvement","summary":"..."}]}. No markdown, no explanation outside the JSON object. Empty findings array if no issues.' \
  --tools "" \
  --no-session-persistence \
  --model <model-id>
```

- `--tools ""` — disables all tool use (pure text generation; dispatch.mjs stays a readonly subprocess)
- `--no-session-persistence` — clean ephemeral context, no session storage overhead
- `--system-prompt` — injects the reviewer role + JSON output contract; overrides the host project's maintainer guidance context so project-specific instructions do not interfere with the cold reviewer role. **`--json-schema` is intentionally NOT used:** empirical testing found that `--json-schema` combined with `--print --output-format text` suppresses stdout (empty output). Structured output is instructed via `--system-prompt` instead.
- `--output-format text` — raw text output; dispatch.mjs extracts JSON and validates it
- `cwd` is set to `$HOME` (not the project directory) — speculative probe to prevent maintainer guidance auto-discovery in the spawned subprocess. Applies only on Codex/other non-CC hosts (dead code on Claude Code, where the CLAUDECODE guard fires in callAnthropic() before callAnthropicCLI is called). The hypothesis (maintainer guidance override causes wrong schema) is unverified on Codex.

**Schema adherence:** the `--system-prompt` path uses instruction-based schema adherence (best-effort), NOT structural enforcement. The model is instructed to return the correct JSON schema but is not structurally bound to it. Consequence: on rare occasions the model may return a differently-keyed JSON object (e.g. `{"review":{...}}`); dispatch.mjs detects this via schema-mismatch validation and falls back to the API key path (`ANTHROPIC_API_KEY`) if available. This is in contrast to the API path (`tool_use` forcing) which provides structural enforcement.

**Output parsing:** strip any ` ```json...``` ` fences, locate first `{` to last `}`, parse JSON, validate that `findings` array is present. If JSON parses but has wrong schema (e.g. `{"review":{...}}`), emit a descriptive error listing actual top-level keys.

## API endpoint (API key path)

`https://api.anthropic.com/v1/messages`

**Auth header:** `x-api-key: $ANTHROPIC_API_KEY`

## Structured output — API path

Uses `tool_use` forcing:

```json
{
  "model": "<model-id>",
  "tools": [{"name": "submit_findings", "input_schema": {...}}],
  "tool_choice": {"type": "any"},
  "messages": [{"role": "user", "content": "..."}]
}
```

**Response extraction:** `content[].find(b => b.type === 'tool_use').input` — the tool input IS the schema-bound JSON.

## Error handling (API path)

| HTTP status | Action |
|---|---|
| 429 | Retry with exponential backoff (3× max, base=500ms cap=60s, ±50% jitter) |
| 401/403 | Fail-fast, exit code 2 |
| ≥500 | Retry |
