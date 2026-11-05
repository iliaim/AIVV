# AIVV Schemas

Machine-parseable contracts for AIVV artifacts. Schemas are versioned via the plugin version; a schema change is a plugin-version change.

## Shipped schemas

| Schema | Purpose | Emitted by | Consumed by |
|---|---|---|---|
| [`finding.json`](finding.json) | Envelope for a single IV&V finding | `aivv:reviewer` (JSONL sidecar after prose review) | `/aivv-fix` Step 1 COLLECT, wont-fix registry fingerprinting, multi-reviewer consensus dedup |
| [`review-log.json`](review-log.json) | Session record for a completed `/aivv` run (reviewers, lens, finding refs, status) | `/aivv` orchestrator | `/aivv-fix` Step 1 COLLECT, session index queries |
| [`fix-log.json`](fix-log.json) | Session record for a completed `/aivv-fix` run (findings addressed, dispositions, wont-fix entries) | `/aivv-fix` orchestrator | Session index queries, audit trail |
| [`index.json`](index.json) | Manifest of all AIVV session logs under `.aivv/state/` | `/aivv` + `/aivv-fix` orchestrators | Session lookup, cross-session dedup |
| [`calibration.json`](calibration.json) | Envelope for a single calibration record (one JSONL line in a `.aivv/calibration/<lens>/<invocation-id>.jsonl` shard, or a legacy `<lens>.jsonl`) | `/aivv` Step 7 + `/aivv-fix` Step 7 | `/aivv-calibrate` (dev.31+), read-side analytics |
| [`config.schema.json`](config.schema.json) | Golden additive user-preferences schema; current authoring target for config defaults and valid keys | `/aivv --config-init`, `/aivv --config-set`, `/aivv --setup`, first-run auto-create | `/aivv` Step 1.5 preference resolution |
| [`incident.json`](incident.json) | Incident lifecycle record for observed AIVV failures | `tools/incident-state.mjs` (Slice 1A writer) | `aivv-view`, lifecycle helper validation |
| [`problem.json`](problem.json) | Problem-cluster lifecycle record for recurring/systemic AIVV failure classes | Problem/local lifecycle helpers | aivv-view, local issue mirrors, future `/aivv-fix` lifecycle routing |
| [`local-issue.json`](local-issue.json) | Local GitHub-style issue mirror for lifecycle follow-up actions | Problem/local lifecycle helpers | aivv-view, future GitHub sync |
| [`lifecycle-evidence.json`](lifecycle-evidence.json) | Shared evidence object for lifecycle records | Incident/problem/local issue writers | Closure gates, RCA evidence refs, viewer lifecycle projection |
| [`lifecycle-link.json`](lifecycle-link.json) | Shared relationship link object for lifecycle records | Incident/problem/local issue writers | Viewer lifecycle projection, future issue sync |
| [`closure-gate.json`](closure-gate.json) | Shared closure gate object for lifecycle records | Incident/problem/local issue writers | Closure validation and viewer lifecycle projection |
| [`state-compat-index.json`](state-compat-index.json) | Derived-index-only compatibility artifact for deterministic historical review/fix-log backfill proposals; original logs remain read-only | `tools/state-compat-index.mjs` | Future maintenance/viewer readers that need explicit historical compatibility data |
| [`remediation-request.json`](remediation-request.json) | Immutable, user-selected local Action Inbox remediation request | `tools/aivv-action-inbox.mjs serve` | `/aivv-fix --action-request=<uuid>` claim-and-revalidate route |
| [`remediation-claim.json`](remediation-claim.json) | Exclusive claim for one Action Inbox remediation request | `tools/aivv-action-inbox.mjs claim` | `/aivv-fix --action-request=<uuid>` audit trail |

[`.aivv/calibration/README.md`](../calibration/README.md) remains the prose-source-of-truth for human readers (when-to-record guidance, jq one-liners, interpretation notes); `calibration.json` is the machine-readable contract — `oneOf` discriminator over `kind` enforces kind-specific required fields with suffix-tolerant convergence-kind matching per dev.31 policy.

## Relationship to the full investigator schema

`finding.json` is the **envelope** — minimum fields for an orchestrator to triage, dedup, and hand off a finding. It omits the deep root-cause analysis, codebase scan, fix proposal, and prevention-mechanism fields.

The **full finding schema** (used by `aivv:investigator` for root-cause reports) lives at [`../../skills/aivv-fix/references/json-schema.md`](../../skills/aivv-fix/references/json-schema.md). A full finding is a superset — it MUST include all envelope fields plus the investigator-specific extensions.

Envelope-only ships first because:
- It covers the two highest-value machine-reads: `/aivv-fix` Step 1 COLLECT and multi-reviewer consensus dedup.
- It doesn't force the reviewer into template-filling mode — prose reasoning stays primary.
- It's forward-compatible with the full investigator schema.

## Emission contract (reviewer)

`aivv:reviewer` emits findings as a trailing fenced block AFTER the prose review:

````markdown
(prose review here — the primary output)

## Findings (machine-readable)

```jsonl
{"id":"F001","severity":"MAJOR","confidence":"HIGH","category":"code-bug","file":"src/api.py","line":42,"summary":"SQL concatenation in query builder","reviewer":"alpha","lens":"code"}
{"id":"F002","severity":"MINOR","confidence":"MEDIUM","category":"documentation-gap","summary":"Missing docstring on public save_task() function","reviewer":"alpha","lens":"code"}
```
````

One JSON object per line. Each MUST validate against [`finding.json`](finding.json). The fenced block is optional for sessions with no findings — emit a `(no findings)` comment line in the JSONL block or omit the block entirely.

## Validation

```bash
# Validate a single finding file (ajv-cli required)
cat finding.json | ajv validate -s .aivv/schemas/finding.json -d -

# Validate every line in a JSONL sidecar
while IFS= read -r line; do
  echo "$line" | ajv validate -s .aivv/schemas/finding.json -d -
done < findings.jsonl
```

`ajv-cli` is not a hard dependency — `validate.sh` does not validate sidecar content against the schema (no runtime sidecars exist yet to validate). Once `/aivv-fix` Step 1 parses sidecars, it can validate on read.

## Config Schema

`config.schema.json` is the golden additive config schema. It is the current source of truth for defaults, valid key names, and user-facing config writes. Legacy `config.v2.schema.json` through `config.v6.schema.json` remain shipped compatibility artifacts for historical readers and historical fixtures; new additive config keys are added to the golden schema without creating a new `config.v<N>.schema.json` file.

`schema_version` remains accepted as compatibility/minimum-reader metadata. The current writer stamps `schema_version: 6`; additive key additions do not bump that value. Bump it only for a genuine breaking config-format change.

## Version Domains

`schema_version` is local to the artifact family. Config files use the golden config domain and currently stamp `6`; runtime review/fix/outer-loop state logs use the state-log domain and currently stamp `2`; lifecycle records use their own schema domain. Do not compare these numbers across families and do not stamp review/fix logs with the config schema version.

The per-invocation state preamble is route-sensitive: unrelated historical state files with a newer state schema warn and remain in place, while selected state such as `--review-id=<id>` still fails closed if it is newer or corrupt. Historical audit logs are not rewritten, deleted, or quarantined automatically.
