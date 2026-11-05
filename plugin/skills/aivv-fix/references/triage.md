# Step 2 TRIAGE — classification, smart batching, and the triage summary

Canonical home for the `/aivv-fix` Step 2 classification (severity / disposition / category / investigation-mode), the smart-batching heuristics, and the triage-summary surface. The SKILL body carries only the Step 2 skeleton + trigger. Do not improvise the classification dimensions, the batch-independence rule, or the triage-table columns. Cross-step routing from this triage output is centralized in [execution-decisioning.md](execution-decisioning.md).

#### 2a. Classify each finding

For each finding, determine:
- **Severity**: CRITICAL > MAJOR > MINOR (from source, or inferred)
- **Disposition**: read `recommended_next_step` when present; otherwise derive a legacy fallback from severity (`CRITICAL`/`MAJOR` → `fix-now`, `MINOR` → `defer-with-rationale`, `POLISH` → `document`). DISPOSITION is the action gate; severity is the intrinsic impact signal.
- **Type**: `code-bug` | `design-flaw` | `process-violation` | `documentation-gap` | `clarification-needed` | `improvement`. *(Internal attribute name: `category`, matching the envelope schema [`.aivv/schemas/finding.json`](../../../.aivv/schemas/finding.json). The user-facing triage column stays "Type" for readability; the field name on every machine-readable record — envelope, approved-finding, session-log entries — is `category`. Step 5 dispatches on this field. `improvement` (dev.146+) marks a behaviour-preserving betterment — clarity, complexity reduction, redundancy removal, ergonomics — rather than a defect; it dispatches to Branch F.)*
- **Investigation Mode**: `skip-permitted | standard | instrumentation-first | containment-first`
  Classification heuristic:
  - `skip-permitted`: single-file, single-location, fix is mechanically obvious (typo, null check, missing guard) → investigator skip is permitted at the Step 3 gate.
  - `standard`: multi-file but well-understood architecture, clear contributing subsystems → standard investigator dispatch.
  - `instrumentation-first`: spans >2 subsystems, involves async/timing, environment-dependent, or symptom is far from likely source, OR previous investigations of similar patterns returned low-confidence → investigation should be preceded by diagnostic instrumentation (see Diagnostic Instrumentation technique in investigator prompt). Investigator behavior IS conditioned on this value via Changes 3c and 3d; orchestrator Step 2.5/Step 3 dispatch control-flow is unchanged by this value.
  - `containment-first`: CRITICAL + data-integrity/financial/security/availability impact, actively ongoing → containment (Step 2.5) is recommended before investigation. Advisory for orchestrator triage — Step 2.5's own severity trigger (≥1 CRITICAL finding) covers most such cases; `containment-first` makes the recommendation explicit. No new Step 2.5/Step 3 dispatch control-flow is wired by this value.
<!-- DEFERRED-RETIRE-WHEN: containment-first is wired to Step 2.5 trigger or cleaned up in a future cycle -->

  Migration from retired `complexity` field: `simple` → `skip-permitted`, `moderate` → `standard`, `complex` → `instrumentation-first`. The `containment-first` value is new. CRITICAL findings with active data-integrity, security, or availability impact that were previously `complex` should be re-classified to `containment-first` rather than the default `instrumentation-first` mapping.

  **Dispatch semantics note:** `investigation_mode` values do NOT modify the orchestrator's Step 2.5 containment trigger or Step 3 dispatch logic — those remain governed by severity and finding structure. However, `investigation_mode: instrumentation-first` DOES condition investigator behavior via Changes 3c (adds it as a Diagnostic Instrumentation trigger) and 3d (gates `problem_specification` completion on it). This distinction — orchestrator dispatch unchanged, investigator behavior conditioned — is the precise scope of Cycle C's wiring.

  **Triage-table visibility:** `investigation_mode` is NOT surfaced as a triage-table column. It is an internal orchestrator classification — consumed at the Step 3 decision gate and passed as investigator dispatch context, not shown to the user in Step 2c output. If future design requires table surfacing, that is a separate future change.

#### 2b. Smart batching — context-aware clustering

Before spawning investigators, cluster findings into batches using these heuristics (in order):

1. **Same file/function** — Findings in the same file or function always go together
2. **Same subsystem/module** — Findings in related files (same directory, same import graph) batch together
3. **Same category** — Findings of the same type (e.g., multiple "missing error handling") likely share a root cause — batch them
4. **Causal dependency** — If fixing finding A would likely affect finding B (shared data flow, same API surface), batch them
5. **Shared context** — If understanding one finding requires reading code that another finding also references, batch them

**Batch independence rule**: Two batches should have **no shared files or functions**. If batches overlap, merge them.

**Mandatory batching**: If >5 total findings, batching is required before spawning.

#### 2c. Present triage summary

Show the user a summary table before proceeding:

```
## Findings Triage

| ID | Severity | Source | Type | Description | Batch |
|----|----------|--------|------|-------------|-------|
| F001 | CRITICAL | [ivv] | code-bug | SQL injection in api/routes.py:45 | Batch 1 |
| F002 | MAJOR | [user-reported] | code-bug | "save_task crashes on empty input" | Batch 1 |
| F003 | MAJOR | [deferred] | design-flaw | No error handling pattern in utils/ | Batch 2 |
| F004 | MINOR | [agent-noted] | documentation-gap | Missing docstring on public API | Batch 3 |

**Batching rationale:**
- Batch 1: F001 + F002 — same file, likely shared root cause (input handling)
- Batch 2: F003 — independent subsystem
- Batch 3: F004 — independent, low severity

Estimated investigator cost: 3 Opus agents x ~25 turns each
```

Auto-proceed immediately unless any batch contains findings where the proposed fix has significant trade-offs (e.g., fixing one issue would overcomplicate another area, require architectural changes, or degrade performance). In those cases, pause and ask the user how to proceed. For straightforward fixes, do not wait for acknowledgement.

> **Note**: These batch assignments are **provisional** — Step 4 reconciles batches after investigators return their declared `files_to_modify` fields. If two batches turn out to both modify the same file, Step 4 will merge them and re-present an updated triage table with a `[RECONCILED]` marker. This is expected, not a contradiction of the Step 2c auto-proceed.
