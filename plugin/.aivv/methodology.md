# AIVV Methodology

This document is the shipped methodology/invariants reference for how AIVV works. It is distributed with the plugin and may be consulted by runtime skills as a repo-local supplementary source.

Operational reviewer procedure and project-context discovery live in `skills/methodology/SKILL.md`; Codex installs package that source as the `aivv-methodology` skill. Portable and Codex reviewer prompts must not assume that this repo-relative `.aivv/methodology.md` path is always readable, or that this file alone contains the complete installed reviewer role-support procedure.

## Forward-Looking Plan Review

`/aivv --plan <file>` is a Tier-1 static review path for proposed work. The plan/spec/proposal file is the primary artifact; the review evaluates plan soundness, assumptions, sequencing, scope, evidence, risk controls, and simpler alternatives before implementation.

In this mode, implementation VERIFY is explicitly skipped. Reviewers may verify cited existing files, dependencies, constraints, acceptance criteria, and evidence the plan relies on, but they must not raise a finding merely because the planned implementation does not exist yet. Phase 3 VALIDATE and the Devil's Advocate Challenge still run in full.

## The Core Claim

Traditional IV&V (Independent Verification and Validation) achieves reviewer independence through *organizational separation* — a different engineering team reviews the implementer's work. The independence is structural: reviewers and implementers have separate backgrounds, tools, incentives, and contexts.

Agent-driven review cannot replicate this structurally. Two instances of the same LLM with the same prompt have correlated reasoning paths. Convergence between them overstates confidence if treated as fully independent.

AIVV substitutes a mix of mechanisms that approximate, but do not reproduce, organizational independence. Be honest about what each mechanism actually delivers:

- **Cold spawning**: prevents the reviewer from *inheriting* the implementer's conclusions. This is anchoring-prevention, not independence-production.
- **Context isolation**: each reviewer sees only what the orchestrator explicitly passes. Again: prevents contamination, does not create epistemic diversity.
- **LLM non-determinism**: sampling variance produces different surface reasoning from the same prompt — but same posterior distribution. Variance within one model's belief, not diversity across models.
- **Adversarial prompting**: a framing intervention. Biases the reviewer toward finding problems. Useful, but not independence.
- **Lens separation**: different reviewers can apply different specialist focuses. The catalog ships at `plugin/.aivv/lenses/` (currently 9: general, code, sec, visual, ux, polish, compliance, i18n, user-journey). `general` is the default baseline for artifact reviews; an explicit lens selection adds only the selected specialist focus to the shared methodology. Distinct specialist lenses are designed to encourage different readings of the same artifact, but this does not establish measured review effectiveness or independent human-level assurance.

**What this gets you**: findings that are stronger than no review, sometimes stronger than a single attentive review. Convergence between two cold-spawned reviewers with the same prompt is meaningful but *correlated* — it reflects the LLM's posterior, not two independent posteriors.

**What this does not get you**: the independence guarantees of a different human engineering team reviewing your work. AIVV findings should be treated as advisory, not as an independent audit in any regulatory sense.

## Convergence Classification

When two or more agents review the same artifact, their findings are classified:

| Pattern | Interpretation | Confidence |
|---|---|---|
| Both flag the same issue at the same severity | Likely real | HIGH |
| Both flag the same area, different severity | Real issue; severity debatable | HIGH existence, MEDIUM severity |
| One reviewer flags, other does not | Possibly real, possibly false positive | MEDIUM |
| Both independently surface the same Devil's Advocate finding | Two agents applied the same adversarial template and converged on the same concern | HIGH (with caveat) |
| Both approve, no findings | Clean session | HIGH (but not infallible) |
| Split verdict | Disagreement worth exploring | MEDIUM |

**Devil's Advocate Convergence** is a higher-confidence signal than single-reviewer findings, but it is not infallible. Two agents applying the same four-question Devil's Advocate frame (pre-mortem, assumption inventory, inversion test, simpler path test) may converge because the template surfaces the same answer — a "template effect" — not because the design has a real vulnerability. Treat convergence as a promoted-priority signal, not a proven one. When available, an adversarial second investigator with different framing (not the same template) is stronger evidence than template-based convergence.

This matches the multi-reviewer caveat on independence: convergence reflects *partial* independence — correlated reasoning paths (same model, same prompt, same preloaded methodology) can produce agreement that overstates confidence.

## Reviewer Anti-Patterns

These recurring failure modes are useful review guidance. Treat them as prompts for verification, not as evidence that a defect exists in a particular project. When a fix spans related files or a multi-section plan, use an independent verifier that reads the full change and checks shared invariants.

### speculative-pattern-projection

**Definition:** A reviewer extrapolates a defect from one observed instance to other code paths, files, or systems without empirically verifying the projection.

**Prevention rule:** Before generalizing a finding, audit another concrete instance of the projected location with a deterministic check. If the audit does not confirm the projection, scope the finding to the observed site only and report that the broader audit was clean.

### flagged-already-correct-or-self-documenting

**Definition:** A reviewer flags a defect that direct verification shows is already correct, remediated, or self-documenting.

**Prevention rule:** When a finding asserts that an artifact is missing, broken, empty, or hypothetical, probe the current file or behavior before flagging it. If the probe contradicts the premise, drop the finding. Do not rely only on prompt-rendered context or filename pattern matching.

### cosmetic-edge-case-not-manifest-at-current-data

**Definition:** A reviewer flags a layout, animation, or visual edge case that does not manifest with current inputs but might appear under an unobserved boundary condition.

**Prevention rule:** Identify the input shape at which the defect manifests and verify that current inputs reach that boundary. If they do not, drop the finding unless a declared near-term requirement establishes present need and positive net value for a POLISH suggestion. Do not turn an unrealized cosmetic boundary into MINOR; MINOR remains a real, reachable defect.

Under `severity_model: impact_likelihood`, wording and hypothetical future inputs do not assign severity. Establish a reachable current defect and user impact. A worthwhile enhancement with verified present need may be POLISH; unsupported speculation should be dropped.

### mechanism-misattribution-fix-still-correct

**Definition:** A proposed fix is supported by inspection, but its explanation attributes the behavior to the wrong mechanism.

**Prevention rule:** Name the specific mechanism and confirm it against authoritative sources before recording the rationale. If the fix is correct but the explanation is uncertain, label the mechanism unverified instead of presenting a confident causal claim.

### cross-task-coherence-drift-from-per-finding-fixes

**Definition:** Fixes that are correct in isolation introduce defects at related call sites, consumer sections, fixtures, or shared interfaces. Per-finding checks pass while cross-file invariants break.

**Prevention rule:** Verify multi-section plans, specifications, schemas, and contracts as a whole. Per-finding grep cannot establish that related sections and call sites remain consistent. Use an independent verifier for this class of change.

### Trade-offs accepted (not anti-patterns)

When a project deliberately accepts a documented trade-off, preserve that decision in its review context. Do not re-report the same behavior as a defect unless new evidence changes the trade-off.

Evidence for project-specific review outcomes belongs in that project's calibration corpus. This methodology describes general patterns without reproducing private project artifacts.

→ Calibration record schema: [.aivv/calibration/README.md](calibration/README.md)

## Finding Severities

- **CRITICAL**: catastrophic or severe harm that is reachable under real-world conditions. Examples: credible data loss/corruption, auth/authz bypass, financial loss, exploitable security break, sustained availability loss, or equivalent irreversible harm.
- **MAJOR**: serious defect with meaningful user, data, security, compliance, operational, or maintainability impact, but below the catastrophic/severe top tier after likelihood and exposure are considered.
- **MINOR**: real defect with limited, recoverable, or narrow impact. The issue is observable or contract-relevant, but its harm is localized, low-frequency, or otherwise bounded.
- **POLISH**: improvement opportunity / better alternative / way to make things more polished. NOT a defect tier — value-add suggestion. Reviewer must articulate why this would improve the UX/code; if reviewer cannot articulate the improvement, drop the finding rather than emit POLISH.

Severity is intrinsic impact after likelihood/exposure reasoning. Merge action is
DISPOSITION, computed separately and carried by `recommended_next_step`
(`fix-now`, `investigate-first`, `document`, `defer-with-rationale`,
`accept-risk`).

Severity inference (when not explicitly stated) follows a four-pass rule under
`severity_model: legacy_4pass`, and the two-track discriminator + impact×likelihood
model under `severity_model: impact_likelihood`.

### Two-track discriminator (under `severity_model: impact_likelihood`)

Before assigning a defect severity cell, classify the finding's track:

- **IMPROVEMENT track** when the proposed change is behaviour-preserving, existing
  tests pass unmodified, there is no plausible failure/harm mode, and no declared
  standard, contract, legal/safety rule, accessibility requirement, or security
  expectation is breached. Emit `category: improvement`; route through the
  Improvement-articulation pass; render as POLISH unless a later value/effort
  prominence rule applies.
- **DEFECT track** when the finding has a plausible failure or harm mode, is
  security-adjacent, changes observable behavior, breaks a declared contract or
  standard, violates an applicable L1/L2 source, or lacks enough evidence to prove
  it is only a behaviour-preserving betterment. DEFECT findings use the
  impact×likelihood cell-map below.

Tie-break: genuine archetype uncertainty routes to DEFECT. Misclassifying a nit as
a low-likelihood defect is cheaper than hiding a real defect as non-blocking polish.
The foreseeable-harm bound still applies: do not invent speculative pattern
projections. Name the concrete harm mode, trigger condition, or breached standard.

Test-less targets: "existing tests pass unmodified" is not satisfied by a missing
test suite. If a target has no relevant tests, use "no tests establish behavioral
preservation" as the evidence state; the finding may still be an IMPROVEMENT only
when behavior preservation is established through code/contract reasoning and no
plausible harm mode remains.

The L1/L4 source-class logic becomes evidence for the discriminator rather than a
standalone final severity pass: applicable L1 legal/safety/accessibility/security
sources usually establish a DEFECT or policy floor; L4 aesthetic/style guidance
usually supports IMPROVEMENT only after the articulation gate proves current value.

General-lens non-code findings use the impact anchors in
[lenses/general.md](lenses/general.md), rather than software compatibility
shortcuts. This prevents a bounded draft-budget error or a decision mismatch
from becoming CRITICAL solely because it mentions finances or a constraint.
Applicable legal/safety and explicit project-policy floors remain in force, and a
configured `impact_likelihood` matrix remains authoritative for final severity.

For software behavior findings, severity inference under the legacy model still
follows the four-pass rule:

1. **Blast-radius pass** (overrides tone) — behavior is gated on the resolved `severity_model` config key (preferences.md Step 1.5; defaults to `legacy_4pass` for v1–v4 configs and absent-key reads):
   - **Under `severity_model: legacy_4pass`** (the shipped default — current behavior, UNCHANGED): financial/security/data/availability concerns → CRITICAL regardless of wording.
   - **Under `severity_model: impact_likelihood`**: the same financial/security/data/availability blast-radius surface sets **IMPACT = high — an IMPACT FLOOR (CATASTROPHIC/SEVERE candidate), NOT an automatic CRITICAL**. The final tier still requires the LIKELIHOOD check before any CRITICAL is assigned (the impact×likelihood model — see the 4×4 impact-by-likelihood cell-map that lands with the likelihood field; the severity-model rationale lives in the project's severity-model decision records). This branch is under active rollout; `legacy_4pass` remains the default so the shipped severity behavior does not change until a config opts in.
2. **Tone/keyword compatibility pass (`legacy_4pass` only)**: "broken"/"crash"/"blocker" → CRITICAL; "wrong"/"bug" → MAJOR; "minor"/"small" → MINOR. Under `impact_likelihood`, tone/keywords are weak priors only: they may suggest a harm mode to investigate, but MUST NOT assign `severity`, `impact_tier`, or `likelihood` without concrete harm, reachability/exposure evidence, and any active lens anchors when available. No-context findings are assessed through the discriminator and impact×likelihood model; if evidence is insufficient, ask for clarification or mark the evidence unknown rather than choosing MAJOR from absence of context.
3. **Source-class compatibility pass**: rules from the L4 source class (aesthetic/style guidance — Refactoring UI, Material Design tonality, Tailwind defaults, etc., as opposed to L1 legal/safety, L2 cognitive/HCI laws, L3 platform conventions) default to POLISH under `legacy_4pass` unless overridden by an applicable L1 source. Under `impact_likelihood`, source class is evidence for the discriminator and policy/disposition floors; source names or keywords alone do not assign severity. The four-layer source-precedence model (L1 > L2 > L3 > L4) governs cross-source contradictions: when sources disagree, the higher-numbered layer always defers to the lower-numbered layer.
4. **Improvement-articulation pass**: if a finding does NOT clearly impact users at the current real-world inputs, the reviewer MUST articulate (a) the verified present need, (b) the specific improvement, and (c) positive net value after added complexity and maintenance cost. If all three are established → POLISH with reasoning embedded. If any is missing → DROP the finding (per existing prevention rule for `cosmetic-edge-case-not-manifest-at-current-data` subsection above). Hypothetical future use alone is insufficient.

POLISH renders expanded by default in `/aivv` output (per `skills/aivv/SKILL.md` Step 6 templates + rendering rules; explicit `polish_collapsed: true` still collapses it). Calibration records POLISH findings with `severity: "POLISH"` (per `.aivv/schemas/finding.json` enum + `.aivv/calibration/README.md` severity row). Per-rule tracking via the optional `rule_id` field (shipped dev.41 T3) applies to all severity tiers; POLISH-vs-MINOR separation in the per-rule FP/TP aggregator is achieved by layering a `severity` filter (one-line jq addition).

### Impact × likelihood cell-map (defect track, under `severity_model: impact_likelihood`)

When the resolved `severity_model` config key is `impact_likelihood` (still NOT the shipped default — `legacy_4pass` remains the default, so the four-pass rule above governs unless a config opts in), a defect's tier is looked up from its `impact_tier` × `likelihood` pair (the two optional fields on `.aivv/schemas/finding.json`) using this conservative cell-map:

| IMPACT \ LIKELIHOOD | CERTAIN | PROBABLE | POSSIBLE | UNLIKELY |
|---|---|---|---|---|
| **CATASTROPHIC** | CRITICAL | CRITICAL | MAJOR | MAJOR |
| **SEVERE** | CRITICAL | MAJOR | MAJOR | MINOR |
| **MODERATE** | MAJOR | MINOR | MINOR | MINOR |
| **NEGLIGIBLE** | MINOR | MINOR | MINOR | DROP |

Reading the table:

- **This is the DEFECT-track lookup only.** It applies under `severity_model: impact_likelihood`. The default `legacy_4pass` continues to use the four-pass rule above — adding this table does not change shipped behavior (non-breaking; the model is under active rollout).
- **POLISH is absent from this table by design.** POLISH is the IMPROVEMENT track — a no-harm betterment with verified present need and positive net value (for example, current clarity or ergonomics) that never enters the defect matrix. A finding is either a defect (lands in a cell above) or an improvement (POLISH), never both.
- **Catastrophic floor.** CATASTROPHIC never drops below MAJOR — the lowest CATASTROPHIC cell is CATASTROPHIC × UNLIKELY = MAJOR (the floor). This is the mechanism that prevents catastrophic-but-rare defects from being trivialized into MINOR/DROP, i.e. it stops "significant things getting undermined."
- **NEGLIGIBLE × UNLIKELY = DROP.** A cosmetic, no-functional-harm issue on a rarely-hit path is noise — not worth surfacing. This is the only DROP cell.
- **Confidence does NOT enter the table.** `confidence` (is-it-real) is orthogonal to the tier. It is displayed alongside the finding and governs display/routing only: a LOW-confidence finding gets a "verify" banner and is routed to the CHALLENGE step, but its confidence never moves the cell. Likelihood (will-it-manifest) is the axis in the table; confidence is not.
- **Disposition (merge-action) is computed separately.** The action gates read DISPOSITION from `recommended_next_step`, derived from severity + reachability/exposure + policy floors. Use `fix-now` / `investigate-first` for action-driving findings, `document` / `defer-with-rationale` for non-immediate work, and `accept-risk` for accepted trade-offs. The severity tier from this table is an input to disposition, not the gate itself.
- **The table above is the shipped default; `severity_cell_map` may override it.** The cell-map is authoritative unless project config supplies a `severity_cell_map` override for one or more cells. Omitted cells continue to use the shipped default above. Teams may tighten individual cells — e.g. the entire CATASTROPHIC row to CRITICAL across all likelihoods — as a team policy choice.

**Worked example — CATASTROPHIC × UNLIKELY → MAJOR (the catastrophic floor, working as intended).** Consider a data-loss bug reachable only on an admin-only maintenance path that is exercised roughly once a quarter. Impact is CATASTROPHIC (data loss), but likelihood is UNLIKELY (rare path, narrow trigger). With the shipped default cell-map, this yields **MAJOR**, not CRITICAL. This is the likelihood axis doing exactly its job — a defect that genuinely almost never fires is genuinely lower-priority than one that fires on every request — while the catastrophic floor still prevents trivialization by refusing to let any CATASTROPHIC cell fall below MAJOR. MAJOR here is the correct, intended outcome: it is NOT an under-rating bug. A team that wants every catastrophic-impact defect to floor at CRITICAL regardless of likelihood can express that by tightening the CATASTROPHIC row through `severity_cell_map` — a stricter team policy, not the shipped default.

### Project Context deployment layer

When project config declares `project_context.deployment`, use it as the EXPOSURE
input to the likelihood axis for every lens:

- `personal`: exposure starts low. A reachable defect in a personal-only tool
  should usually land at `UNLIKELY` or `POSSIBLE` unless the common path triggers
  it every run or the local data/harm is still severe.
- `internal`: exposure starts medium. Consider the number of internal users,
  operational criticality, and whether the path is routine or admin-only.
- `public`: exposure can be high. Public, unauthenticated, customer-facing, or
  internet-reachable paths may be `PROBABLE` or `CERTAIN` when the trigger is on
  an ordinary path.

Undeclared deployment is not a reason to inflate to CRITICAL and not a reason to
drop the finding. State the exposure assumption explicitly, prefer `POSSIBLE`
when evidence is incomplete, and recommend declaring project context when it
would materially change the result.

### Project Context legal-applicability layer

When project config declares `project_context.data_classes`,
`project_context.jurisdictions`, or `project_context.compliance_targets`, use
those values to decide whether hard-statute legal rules are applicable,
inapplicable, or undeclared-context findings:

- `data_classes` influences impact and legal applicability. PII, children,
  payments, health, financial, credentials, or confidential data can raise the
  impact ceiling when the reviewed change touches that data class.
- `jurisdictions` identifies market, user, customer, or deployment regions.
  For example, GDPR-specific COMP-LEGAL findings need EU context plus relevant
  personal-data handling before a legal floor is treated as applicable.
- `compliance_targets` records declared contractual or organizational targets.
  A declared target (for example `gdpr`, `ccpa`, `coppa`, `ada`,
  `section-508`, `eaa`, `wcag-aa`) can turn an otherwise advisory standard into
  a required DISPOSITION floor.

Undeclared context is not a drop rule and not an automatic CRITICAL rule. Surface
the finding with the applicability assumption and recommend declaring context
when it would change severity or DISPOSITION. If declared context makes the cited
authority inapplicable, render the L1 citation for transparency but route the
finding as a context note / POLISH or lower-priority DISPOSITION rather than
borrowing the applicable-statute floor.

### Reviewer-prompt language for the Improvement-articulation pass

Reviewer agents receive this improvement-articulation rule through the operational methodology source (`skills/methodology/SKILL.md`, installed as `aivv:methodology` on Claude Code and `aivv-methodology` on Codex). This shipped methodology reference records the same rule for distribution and auditability. Apply the block below verbatim during Phase 2 VERIFY whenever considering a finding that does not clearly impact users at current real-world inputs:

> When you flag a finding that does NOT clearly impact users at the current real-world inputs (text lengths, viewport sizes, data shapes actually present in the codebase), apply the Improvement-articulation pass before emitting:
>
>   1. Identify the VERIFIED PRESENT NEED — what current input, requirement, or demonstrated maintenance burden warrants a change now?
>   2. Identify the SPECIFIC IMPROVEMENT — what would change for the user/code/maintainer if applied?
>   3. Identify the POSITIVE NET VALUE — how would the change make the UX/code measurably better after accounting for added complexity, testing, coupling, and maintenance cost?
>   4. If you can establish ALL THREE in one or two sentences each, emit the finding at POLISH severity with:
>        Present need: <one-sentence statement of (1)>
>        Improvement: <one-sentence statement of (2)>
>        Value: <one-sentence statement of (3), including material costs>
>   5. If you CANNOT establish any one of (1), (2), or (3) — DROP the finding entirely. Do not emit at MINOR or POLISH. Speculative pattern-flagging without present need and positive net value is what the cosmetic-edge-case-not-manifest-at-current-data anti-pattern prevents (see Reviewer Anti-Patterns section in .aivv/methodology.md, N=2 corpus).
>
> POLISH is reserved for value-add suggestions, not low-confidence defects. A finding you would only justify with "well, it could break in some edge case" is a finding to DROP, not downgrade.

## Finding Lifecycle

1. **Review** (`/aivv`, optionally with `--reviewers=N` for multi-reviewer consensus) produces findings.
2. **Triage** (inside `/aivv-fix`) classifies, clusters, and batches findings.
3. **Investigate** spawns `investigator` agents per batch to find root causes.
4. **Plan** aggregates investigator results with verdicts (fix-required, already-correct, clarification-needed, wont-fix, acknowledged-deferred-at-cap).
5. **Execute** applies fixes + prevention mechanisms.
6. **Verify** spawns a scoped reviewer to re-verify fixes.
7. **Document** captures lessons learned and updates calibration.

Rework gate: one `/aivv-fix` invocation has a shared budget of three semantic
rework retries across challenge, re-authoring, and verification. At exhaustion,
stop rework, preserve the authorized scope, and report unresolved findings with
the evidence and retry history; do not ask to reopen the same work. The count is
not proof that the architecture itself is defective.

**`acknowledged-deferred-at-cap`** (AIVV-self only): a finding that remains after the shared fix-rework budget is exhausted and satisfies the documented auto-disposition rule (`recommended_next_step ∈ {document, defer-with-rationale, accept-risk}` with legacy fallback to severity ∈ {MINOR, POLISH}, `grounded_by` exclusively cites the appropriate validation stages, and the target-project marker identifies AIVV-self). It is auto-classified without a user prompt and written to `<lens>.jsonl` as `kind: "auto_deferred_at_cap"`. This per-cycle disposition does not populate the wont-fix registry; the final report must still label the finding unresolved. It may resurface in a later user-initiated cycle. External-project `/aivv-fix` invocations are unaffected.

## Key Invariants

- **Investigator agents have NO conversation history.** This is a feature, not an omission. Cold investigators avoid anchoring bias and enable parallel spawning. Do not inject cross-batch context into investigator prompts.

  *Documented exception — adversarial second-opinion gate.* The `/aivv-fix` Pre-Execution Gate 1 (CRITICAL + high-confidence findings) deliberately passes the first investigator's root-cause hypothesis to a second investigator **framed as adversarial challenger**. This is a structured *adversarial review* pattern — the challenger needs the hypothesis as input in order to challenge it. The cold-spawn invariant applies to primary-investigation dispatch; adversarial gates that explicitly challenge a stated hypothesis are a documented exception to the no-cross-context rule. See the corresponding Gate 1 block in the `/aivv-fix` skill.

  *Honest limitation — read-only enforcement is host-specific.* AIVV's methodology requires reviewers and investigators to behave as read-only unless they are in an explicit fix/execution phase. Whether that is enforced by construction, by sandbox, by permission prompts, or only by policy prose depends on the active platform adapter. See `.aivv/runtime-contract.md` and the active `platform-adapters/<host>.md` file for enforcement status.

- **Verifier is ADVISORY mode.** It evaluates only the changes listed in the session log; it does not block execution.
- **Session state is persisted** in the private external target-instance store resolved by [target-resolution.md](target-resolution.md). It survives session compaction and includes invocation IDs to reduce concurrent-invocation collisions. Legacy project `.aivv/state/` and `.claude/sessions/` remain read-only history; explicit import preserves originals before eligible continuation. Host-specific permission behavior belongs in the active platform adapter.
- **wont-fix decisions are persisted** across sessions via a fingerprint-keyed registry. Prevents re-investigation of user-accepted issues.
- **Self-contained.** AIVV does not depend on any other host plugin to function. Methodology content, lens content, triage heuristics, runtime probe scaffolding, and runtime-result ingestion all ship inside AIVV. Browser-driver MCPs are optional host adapters; the default B3 runtime-evidence path is user-run artifacts with graceful degradation when adapters are absent.
- **Shared core with host adapters.** Review methodology, schemas, lenses, and state contracts are shared. Host mechanics live in `platform-adapters/`, with clearly labeled host notes retained in a few operational skills where needed. Claude Code and Codex have operational adapters; Codex's native package and profile installer are verified, while end-to-end cold reviewer and investigator dispatch remains experimental. Hermes has an experimental local skills-only discovery adapter; review and remediation capabilities remain unverified. Other hosts can add adapters without forking the shared review method.

## Scope Boundary: Three-Tier Model

AIVV operates under a strict three-tier scope model. Reading artifacts is in scope; producing runtime behavior is not.

### Tier 1 — Read (in scope, always)

AIVV reads source-repository content as the primary review input:
- Source code (all languages)
- Configuration files (JSON, YAML, TOML, env)
- Documentation and specs
- Schema definitions (JSON Schema, GraphQL, Protobuf)
- CI/CD manifests, Dockerfiles, Terraform modules
- Rendered UI in an isolated browser (read-only; `/aivv --lens=visual` only)

### Tier 2 — Observe (in scope, when artifacts are present)

AIVV may observe **static artifacts produced by runtime tools the user already ran** — treating them as review input, not as triggered execution:
- Test output logs (pytest reports, Jest output, CI test artifacts)
- Profiler reports (pprof, flamegraphs, Node --prof output)
- Stack traces pasted into the session
- Build output files (bundle analyzer reports, compile warnings)
- Static-analysis artifacts (SAST reports, lint output, type-check reports)
- Observability snapshots the user provides (Grafana exports, error-log excerpts)

If the artifact exists in the workspace or the user pastes it into the session, AIVV reads it. If the artifact doesn't exist, AIVV does NOT produce it.

### Tier 3 — Execute (explicitly out of scope, always)

AIVV does **not** produce runtime behavior:
- Does not run tests (pytest, npm test, go test, etc.)
- Does not hit production or staging endpoints
- Does not perform migrations or schema changes
- Does not submit forms, click buttons, or trigger side effects in browser-automation skills (read-only by default; explicit `--interactive` flag required for any exception)
- Does not install dependencies, modify lockfiles, or run package-manager commands
- Does not send messages, emails, or notifications
- Does not make network calls that produce side effects (POST/PUT/DELETE, form submission, external state mutation, paid-API invocation, authenticated-endpoint access, rate-limit-gated scraping). Read-only information-gathering against the open public web — WebSearch, WebFetch to unauthenticated public URLs, and MCP library-doc tools like Context7 used for factual-claim grounding (see `skills/methodology/SKILL.md` Phase 2 "Factual-claim grounding") — is Tier 1 Read activity: it consumes pre-existing public information on a one-shot basis, does not mutate external state, and does not cross authentication or billing boundaries. Browser-automation MCPs like Playwright remain Tier 1 only in read-only mode with the explicit `--interactive` flag required for any side-effecting exception.

When a review area requires behavior execution (load testing, real E2E flow verification, database profiling, infra monitoring), AIVV is the wrong tool. Use dedicated tools — Playwright Test, k6, Locust, query planners, observability stacks. AIVV reviews the *output* of those tools (Tier 2) without running them (Tier 3).

**The boundary answers most "is X in scope for AIVV?" questions**: X is in scope if X is already an artifact in the user's workspace or session. X is out of scope if AIVV would have to *cause* X to exist.

## Scope Discipline: Evidence-Gated Domain Additions

AIVV's natural growth pressure is toward more domains — visual, UX, performance, security, accessibility, supply-chain, observability, config, release, API contract, data migration, feature flags, documentation accuracy, dead code, test coverage, license compliance, SEO, i18n. Each is genuinely interesting.

**The rule**: adding a new review domain to AIVV requires *evidence* that current skills miss findings in that domain consistently. Interesting domains aren't enough; there must be a concrete pattern of findings the existing skills produce (or fail to produce) that would be better served by the new domain.

Before proposing a new domain, answer:

1. **What specific findings does the existing catalog miss?** Name the finding patterns, not the domain label.
2. **What current-skill reviews could have surfaced this, and why didn't they?** This distinguishes "new domain needed" from "existing skill needs sharpening."
3. **What project will dogfood this domain in the first month after it ships?** No dogfood project → defer the domain.
4. **Is the domain's methodology self-contained inside AIVV, or does it depend on external skills?** AIVV's self-contained principle (installing AIVV alone must be sufficient for every skill to run — no required dependencies on other plugins) is non-negotiable. Optional augmentation with capability-check + graceful degradation is acceptable; hard external-plugin preloads are not.

This converts "should X be a review domain?" from a taxonomy question into an evidence-gated decision. Domains with no evidence of gap, no dogfood target, or no self-contained methodology don't graduate from backlog to plan.

This rule applies to the plugin's own development — "AIVV should review UX patterns" is a proposal, not a commitment. It needs evidence.

## Dogfood model

AIVV uses a **dual-target dogfood model**, with the formal target chosen by lens family:

| Lens family | Formal dogfood target | Calibration log |
|---|---|---|
| `general` (default), `code`, and `sec` | **AIVV-self** | Its resolved external `<calibration_dir>/<lens>/*.jsonl` shards; legacy shared/shard history read via union |
| UI families: `visual`, `ux`, `polish` (and forward-look `compliance`, `i18n`, `runtime-visual`) | A representative UI-bearing project selected for controlled review | Its own resolved external `<calibration_dir>/<lens>/*.jsonl` shards; legacy shared/shard history read via union |

**Rationale for the split:** AIVV-self is a CLI plugin distributed as static markdown skills + JSON schemas + agent role prose; it has minimal user-facing UI surface. Running UI-family lenses against AIVV-self produces graceful zero-findings (per the lens files' "Graceful degradation" sections) — useful for confirming the lens doesn't fabricate findings on non-UI code, but not a real dogfood signal for UI-pattern coverage. A representative UI-bearing project provides the controlled population that UI-family lenses need to calibrate against.

**Every self-referential `/aivv` run on AIVV is a dogfood event for its assigned lens.** This includes the general default and the explicit `code` and `sec` lenses. A run on the selected UI-bearing project is a UI-family dogfood event. Runs feed lens-specific calibration corpora; this catalog/default change does not claim measured quality gains.

Calibration corpora from other projects are *field evidence*, not the dogfood baseline. Field evidence informs pattern-mining and reveals reviewer failure modes outside AIVV's own surface area; it does not substitute for dogfood-baseline calibration on a known-controlled population.

This separation is load-bearing for read-side analytics: calibration tooling reads the target-project's corpus only — cross-project aggregation would conflate the two signal types and reintroduce the site-selection-bias failure mode the dogfood/field-evidence split exists to prevent. See [`.aivv/calibration/README.md`](calibration/README.md) for what the calibration log captures.

## Schemas

- **`.aivv/schemas/finding.json`** — **shipped** (envelope only). Minimum fields an orchestrator needs to triage, deduplicate, and hand off a finding. Emitted by `aivv:reviewer` as a JSONL sidecar block after the prose review; consumed by `/aivv-fix` Step 1 COLLECT and by multi-reviewer consensus dedup. See [`.aivv/schemas/README.md`](schemas/README.md) for the emission contract. `grounded_by` is a typed optional array property in the schema and is preferred for new emissions; legacy free-form text remains accepted during the migration window described in the field's `description`.
- **Full investigator schema** — lives at `skills/aivv-fix/references/json-schema.md`. Superset of the envelope; includes root-cause analysis, codebase scan, fix proposal, and prevention mechanism fields.
- **Calibration record format** — the append-only JSONL contract is documented inline at [`.aivv/calibration/README.md`](calibration/README.md).
- **Session log schema** — the `/aivv-fix` session log format is documented inline in [`skills/aivv-fix/SKILL.md`](../skills/aivv-fix/SKILL.md) Step 5.

## Version history

See the release notes for public release information.
