# Step 1 COLLECT — conversation signal scan, fingerprinting, and de-duplication

Detail relocated from `skills/aivv-fix/SKILL.md` Step 1 COLLECT. The inline skeleton keeps the source selector and the source-parsing subsections for `--review-id`, task ID, and literal text; this reference is the canonical home for the conversation Signal 0–4 scan, the severity inference model, the wont-fix registry pre-filter, and the de-duplication rules. The canonical fingerprint formula lives in [`.aivv/runtime-contract.md`](../../../.aivv/runtime-contract.md) `compute_fingerprint(location, description)` and "Canonical Fingerprint Formula".

**No argument (or blank)** — Extract from current session by scanning signal types in priority order. `FixSession.source = "conversation"`.

**Signal 0 — Machine-readable findings sidecar (JSONL)** (highest confidence, deterministic): `aivv:reviewer` emits a trailing fenced ```jsonl block AFTER each prose review (see `.aivv/schemas/finding.json` + `.aivv/schemas/README.md` for the emission contract, shipped in dev.6). When this signal is present, use it instead of LLM-interpreting Signal 1. Mechanics:

1. Scan conversation history for the most recent `/aivv` output. If the reviewer produced a fenced block of the form ` ```jsonl ... ``` ` (single-reviewer case) or multiple such blocks (N≥2 case), extract each block's raw text.
2. Parse each line as JSON; each object validates against the envelope schema (`id`, `severity`, `confidence`, `category`, `summary` required; `file`, `scope_ref`, `line`, `reviewer`, `lens`, `devils_advocate` optional). Location is exactly one of: `file` when it is a non-empty string; `scope_ref` when `scope_ref.kind` and `scope_ref.ref` are non-empty strings; otherwise `null` and the finding requires clarification before execution.
3. **Single-reviewer case (N=1)**: findings list = parsed objects as-is. Preserve the `id` assigned by the reviewer; if collisions occur (unlikely), re-number sequentially.
4. **Multi-reviewer case (N≥2)**: union all sidecars. Dedupe by the rule — two findings merge if `(file, line within ±10)` match, same `scope_ref`, OR `(category, summary Jaccard ≥ 0.7)` — same thresholds as Signal 1's dedup stage. Preserve the `reviewer` field on merge (combine into `reviewers: ["alpha", "beta"]` for the merged finding). If `devils_advocate: true` appears on the same finding from ≥2 reviewers, elevate per methodology's Devil's Advocate Convergence rule.
5. Tag each resulting finding with source label `[ivv]` (same as Signal 1).
6. **Validation failures**: if a sidecar line does not parse as JSON or violates the envelope schema, log a warning and skip that line. Do NOT fall back to Signal 1 for the same reviewer's output — the prose + sidecar are co-emitted; partial parse is the intended fast path. If ALL sidecar lines from ALL reviewers fail to parse, fall through to Signal 1 for the whole batch.
7. **Sidecar absent**: no `jsonl` block found in the reviewer output → fall through to Signal 1.

Benefits when Signal 0 fires: deterministic dedup across N reviewers (no LLM scan of prose), zero-token COLLECT for the `/aivv` output portion, machine-verifiable severity + category mapping.

**Signal 1 — Formal review output (prose fallback)** (high confidence): Scan for `/aivv` output when Signal 0 is absent or unparseable. Parse findings with severity labels (CRITICAL, MAJOR, MINOR). Extract: severity, description, file:line, reviewer, confidence.

**Signal 2 — User-reported problems** (high confidence): Scan user messages for explicit issue reports:
- Bug reports: "X is broken", "X doesn't work", "there's a bug in Y", "this fails when..."
- Errors encountered: stack traces, error messages, unexpected output pasted into chat
- Concerns: "I'm worried about X", "this seems wrong", "we should fix Y"
- Direct requests: "also fix X", "btw X needs attention", "don't forget about Y"

**Signal 3 — Deferred issues** (medium confidence): Scan for issues that were noticed but skipped during the session:
- "I noticed X but stayed focused", "we'll deal with X later", "out of scope but..."
- TODO/FIXME markers mentioned in conversation
- Problems acknowledged but not addressed ("yes that's an issue, let's continue")

**Signal 4 — Agent observations** (medium confidence): Scan for issues an agent identified but did not fix:
- "I also noticed X", "worth noting that Y", "there's also a potential issue with..."
- Code smells or risks mentioned in passing during implementation

**Scan boundary**: Scan from session start (or the most recent `/aivv-fix` invocation, whichever is later). Determine the last-invocation time using `storage-paths.mjs list --context "$storage_context_file" --area state --prefix fix- --archive` and reading returned records through the shared `read` command (external canonical state; legacy paths remain historical until explicit import). `<target>` is the resolved target-project path per [`.aivv/target-resolution.md`](../../../.aivv/target-resolution.md). **Comparator for "most recent"**: `invoked_at` (ISO 8601 timestamp in the JSON body), NOT filesystem mtime — mtime can drift from invocation time (file copy, backup restore, tar extract). For this boundary check, use the context bound before collection; never a
provisional finding-derived target or cwd-local `.aivv/state`. Take the most recent file with `status: "completed"`; use its `invoked_at` as the scan-start boundary. If no such file exists, fall back to session start. Skip issues the user explicitly marked as resolved ("fixed", "done", "ignore that", "that's fine").

**Severity inference for informal signals** (no explicit label present) is gated by `severity_model`:

- Under `severity_model: legacy_4pass`, use the compatibility 4-pass below; first matching rule wins.
- Under `severity_model: impact_likelihood`, blast-radius categories remain impact-floor evidence per Pass 1 below. Tone/keywords are weak priors only: they may suggest a candidate harm mode to investigate, but they MUST NOT assign `severity`, `impact_tier`, or `likelihood` without concrete harm, reachability, exposure, and any active lens anchors when available.

**1. Blast-radius pass (overrides tone)** — applies when the affected surface is in any of these categories:
- **Financial**: payments, billing, settlements, pricing, invoices, transactions, refunds
- **Security**: authentication, authorization, secrets, credentials, tokens, permissions, session handling
- **Data integrity**: user data, migrations, schema changes, irreversible writes, deletes
- **Availability**: outages, data loss, corruption, silent failure of core user flows

The pass behavior is gated on the resolved `severity_model` config key (resolved per the Step 1.5 counterpart above; defaults to `legacy_4pass` for v1–v4 configs and absent-key reads):
- **Under `severity_model: legacy_4pass`** (the shipped default — current behavior, UNCHANGED): regardless of tone keywords, mark the finding **CRITICAL** when the affected surface is in any category above.
- **Under `severity_model: impact_likelihood`**: the same blast-radius surface sets **IMPACT = high — an IMPACT FLOOR (CATASTROPHIC/SEVERE candidate), NOT an automatic CRITICAL**. The final tier still requires the LIKELIHOOD check before CRITICAL is assigned (the impact×likelihood model; severity-model rationale lives in the project's severity-model decision records). This branch is under active rollout; `legacy_4pass` stays the default so shipped behavior is unchanged until a config opts in.

> Example: *"Small thing, but the payment total is off by a cent"* → under `legacy_4pass`, CRITICAL — blast-radius (payment) wins over the tone keyword ("small"). Under `impact_likelihood`, this sets the IMPACT FLOOR to high (CATASTROPHIC/SEVERE candidate); the final CRITICAL tier still depends on the likelihood check.

**2. Tone/keyword compatibility pass** (when no blast-radius category matches):
- **Under `severity_model: legacy_4pass`**:
  - Language like "broken", "crash", "blocker", "urgent", "doesn't work at all", "fatal error" → CRITICAL
  - Language like "wrong", "incorrect", "bug", "fails", "error" → MAJOR
  - Language like "minor", "small", "style", "eventually" → MINOR
  - Language like "improvement opportunity", "value-add", "nicer if", "could be polished", "would be cleaner" (without imperative "fix" framing) → POLISH only when the finding establishes verified `Present need:`, a specific `Improvement:`, and positive-net `Value:` per the methodology gate; otherwise DROP
  - No context clues → legacy fallback MAJOR.
- **Under `severity_model: impact_likelihood`**: tone/keywords are a scrutiny cue only. "Broken", "blocker", or "urgent" means investigate for a concrete harm mode and reachability; "minor", "small", or "style" means check whether the issue is an IMPROVEMENT/POLISH candidate. Do not assign a tier from wording alone. If no harm/reachability/exposure evidence is available, ask for clarification or mark the evidence unknown rather than choosing MAJOR from absence of context.

**Source labeling**: Tag each finding with its signal type so the triage table is clear:
- `[ivv]` — from formal review
- `[user-reported]` — from user message
- `[deferred]` — noticed but skipped
- `[agent-noted]` — flagged by an agent in passing

**wont-fix registry pre-filter**: Resolve the read-side matching view through the
installed helper, which uses the shared locked external read boundary:

```bash
node "$AIVV_ROOT/tools/state-compat-index.mjs" --registry-for-matching \
  --context "$storage_context_file" > "$registry_matching_snapshot"
```

The result is a cloned registry-shaped matching view with `matching_fingerprints`
on each eligible retained entry: its stored fingerprint plus any eligible derived legacy alias.
Only unmarked pre-dev.25 SHA-256 entries with valid legacy path/description
inputs receive a normalized current SHA-1 alias. Original registry/source bytes
remain unchanged. Never write the matching view back, use an alias as approval,
or normalize/rewrite a project original. Surface helper warnings for malformed
legacy entries; pending/import/read errors do not mean an empty registry.

For each finding, use its persisted `finding.fingerprint` when present; otherwise
compute the current fingerprint via [`.aivv/runtime-contract.md`](../../../.aivv/runtime-contract.md)
`compute_fingerprint(location, description)`. A match means that fingerprint
equals the stored fingerprint or an eligible value in `matching_fingerprints`.
Skip only when the matched entry still has `user_approved: true`; all existing
suppression eligibility and target/schema checks remain required. Accumulate
skips for Step 7 as `Skipped (wont-fix registry: <decided_at>)`. An empty/absent
external registry stays empty; legacy registries remain historical until explicit
import and never refill current state automatically.

<!-- CLAUDE-CODE-SPECIFIC -->
On Claude Code: invoke the runtime-contract heredoc-stdin pattern via `Bash` tool.
On Codex: invoke via `shell_command`; use its PowerShell single-quoted here-string
form when appropriate. Compute once per finding and compare against the read-side
matching view; do not alter the existing fingerprint or approval contract.

**De-duplication** — merge findings that refer to the same underlying issue. Apply in order:

**1. Structural match (primary, auto-merge)** — same file-backed location (`file` or legacy `file_path`) AND `line_number` within ±10 lines, OR same scoped location (`scope_ref.kind` and `scope_ref.ref` both match exactly) → treat as duplicates. Merge into a single finding; preserve both descriptions under the chosen ID as `source_A_description` and `source_B_description`.

**2. Description match (secondary, weaker — candidate only)** — normalized description Jaccard ≥ 0.7 (lowercase, strip punctuation, split on whitespace, compute |A∩B| / |A∪B|) → candidate duplicates. Read both descriptions; merge only if they clearly describe the same underlying issue. If uncertain, keep separate.

**3. Contradiction handling** — if two signals refer to the same location but disagree on severity OR disposition (e.g., `/aivv` says CRITICAL but a user message says *"that's actually fine"*), do **NOT** silently merge. Keep both as separate findings with linked IDs (e.g., `F001a` from `[ivv]`, `F001b` from `[user-reported]`), and surface the contradiction explicitly in Step 2c's triage table as a `[CONTRADICTION]` row for user resolution before Step 3.

**4. Severity on merge** — use the higher-confidence source's severity. Precedence: `[ivv] > [user-reported] > [deferred] > [agent-noted]`.

**Thresholds are tunable**: the ±10 line window and 0.7 Jaccard threshold are defaults. Projects with noisy signals may lower them; projects with terse issue descriptions may raise them. Thresholds are internal defaults — do not expose them as user-facing arguments unless a project explicitly requests it.

## Step 4 wont-fix accept path (registry write)

<!-- CONCURRENCY-ACCEPTED-BY: runtime-contract.md "Cross-invocation shared files" -->
> **Concurrent-write note:** this registry is a single shared JSON written whole (read → append → write). Two parallel `/aivv-fix` sessions on the same target can drop one accepted entry (last-writer-wins). This is an accepted, telemetry-gated risk — the worst case is the user re-confirms a wont-fix on the next scan (recoverable, not data-corrupting). See runtime-contract.md "Cross-invocation shared files" for the contract and rationale.

This is the Step 4 `wont-fix` verdict handler — the write counterpart to the pre-filter above. Present the investigator's reasoning to the user; the user decides whether to accept or override.

- **If accepted**: compute the fingerprint via [`.aivv/runtime-contract.md`](../../../.aivv/runtime-contract.md) `compute_fingerprint(location, description)`, using the same location and description that were presented to the user for the wont-fix decision. Capture the SHA-1 hex output as the registry `fingerprint`.

    Then append to `<state_dir>/wont-fix-registry.json` (target resolved per [`.aivv/target-resolution.md`](../../../.aivv/target-resolution.md); create the file if absent; initialize/publish through the shared storage mutation helper):
    ```json
    {
      "entries": [
        {
          "fingerprint": "a7f3...",
          "file_path": "src/audio/doli.py",
          "description": "doli drum samples have slight DC offset",
          "decided_at": "2026-04-21T10:00:00Z",
          "reason": "Tolerable artifact from source recordings; fixing would require re-recording",
          "user_approved": true
        },
        {
          "fingerprint": "b8e4...",
          "location": {
            "type": "scope",
            "kind": "process",
            "ref": "aivv-step-5-output"
          },
          "description": "AIVV Step 5 output is intentionally process-scoped",
          "decided_at": "2026-04-21T10:00:00Z",
          "reason": "Accepted process-level exception; no file path applies",
          "user_approved": true
        }
      ]
    }
    ```
    File-backed entries may continue to carry `file_path` for legacy readers. New scoped entries must carry `location` and must not invent `file_path`; use `location.type = "scope"` with the original `scope_ref.kind` and `scope_ref.ref` values.
    Stage the complete updated registry and publish it:

    ```bash
    node "$AIVV_ROOT/tools/storage-paths.mjs" write --context "$storage_context_file" \
      --area state --relative wont-fix-registry.json --source "$candidate"
    ```

    Writes are append-style (preserve prior entries). Do NOT deduplicate on write — if the user accepts wont-fix twice for the same finding, both entries are kept for audit history.
- **If overridden**: user decision is ephemeral (this session only); do NOT write to registry. Finding proceeds to Step 5.
