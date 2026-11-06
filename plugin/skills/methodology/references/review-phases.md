# Review Phases

Read this before executing AIVV review phases; it preserves session-context skepticism, project-context discovery, VERIFY/VALIDATE/SYNTHESIZE ordering, and direction challenge procedure.

Contents:
- Session Context Skepticism
- Project Context Discovery
- Phase 1: ORIENT
- Phase 2: VERIFY
- Phase 3: VALIDATE
- Phase 4: SYNTHESIZE

## Session Context Skepticism (when session context is supplied)

**Session context is written by the same person whose work you are reviewing.** It describes intent and belief, not verified truth. A confident-sounding assertion can cause a reviewer to skip verification of exactly the thing that is wrong.

Four principles apply without exception:

1. **Correctness claims are hypotheses, not facts.** Any time session context says "this is valid", "this is safe", "X and Y are mutually exclusive", or "TypeScript passes" — treat that as a claim to verify independently, not an established fact. The developer cannot be their own source of truth about correctness.

2. **Unusual + reportedly-valid = must investigate.** If a pattern is flagged as unusual or non-standard anywhere in the session context, that is the beginning of investigation, not the end. "Unusual but reportedly valid" is not a finding. "Unusual — verified correct/incorrect by [independent reasoning]" is. Converting an unusual-pattern observation into a style note without verifying correctness is a missed finding.

3. **Static analysis passing is not runtime correctness.** Compilation, type checks, and linters check structure, not runtime semantics. For every non-trivial code path, ask: what environment or runtime condition could reject this even though the type checker accepted it? Runtime misbehavior that static analysis cannot see is a common class of shipped bugs.

4. **Developer confidence should increase scrutiny, not lower it.** When session context expresses high confidence in a claim ("this is definitely safe", "this is a well-known pattern"), treat that confidence as a signal to look more carefully, not less. The bugs most worth catching are the ones the developer was sure about.

## Project Context Discovery

Before reviewing, understand the project's conventions and locked decisions. Your review must honor those constraints.

### Step 1: Discover applicable project guidance

Within the confirmed scope, inspect available project guidance relevant to the subject. Start with explicit maintainer or agent instructions (`AGENTS.md`, `AGENTS.override.md`, or equivalent), then check relevant README or project overview material, style and standards guidance, architecture or decision records, and active plans or specifications. Prefer the closest applicable guidance and load only enough material to establish the relevant constraints.

If no relevant guidance appears in the inspected sources, say that no applicable guidance was found there; do not infer that none exists elsewhere. Apply evidence-based practice appropriate to the artifact type and intended use. Keep all reads within the confirmed scope and relevant dependency evidence.

### Step 2: Identify locked decisions

Most projects with a maintainer guidance will document immutable/locked decisions. These are constraints that MUST NOT be violated. Common patterns:

- Tech stack versions (e.g., "Next.js 14 LOCKED — do not upgrade")
- Architecture choices (e.g., "Supabase for database, Vercel for hosting")
- Business strategy (e.g., "US-first market", "mobile-first")
- Design principles (e.g., "zero technical debt", "privacy-first")

When a decision in scope conflicts with a documented constraint, establish the concrete consequence and apply the shared severity and confidence rules. A conflict alone does not determine severity. If the constraint's applicability or authority is unclear, state that uncertainty and use the appropriate clarification or investigation route.

### Step 3: Find session artifacts

For a session review, relevant session context may come from these sources when they are supplied or included in the confirmed scope:

| Artifact | Common Locations | Content |
|---|---|---|
| Session files | `.claude/sessions/` | Autosaves and manual summaries |
| Session memory | `.claude/memory/current-session.md` | Tasks, decisions, blockers |
| Week/sprint tracker | `CURRENT/WEEK_*_TRACKER.md`, `CURRENT/SPRINT_*.md` | Task checkboxes |
| User decisions | `CURRENT/USER_DECISIONS.md`, `CURRENT/DECISIONS.md` | Approved/rejected decisions |
| Project progress | `.claude/memory/project-progress.md` | Milestones |

**Not all projects will have these sources.** Use only relevant, available session artifacts within the confirmed scope. Do not inspect private or external context outside that scope.
### Step 4: Standards lookup

For standards lookup details, read [standards-lookup.md](standards-lookup.md). Open the relevant standards subfile directly rather than loading every catalog at once.

## Review Process

### Phase 1: ORIENT

Before reviewing anything, understand the scope:

1. **Read `What to Review` and the confirmed scope first.** Identify the primary subject and intended use. For a session review, read Session Activity as primary context; for a directly named artifact, review that artifact as primary and use session context only to understand its intent and status.
2. **Assess review scope** — is this a small correction, a multi-part artifact or feature, a research session, or a major structural decision? This determines review depth (see Proportional Rigor below).
3. **Apply Project Context Discovery** (Steps 1–4 above) — read maintainer guidance, identify locked decisions, find session artifacts.
4. **Identify the review type**:
   - **Session review:** Evaluate decisions, approach, scope fit, and completion.
   - **Artifact review:** Evaluate the named file or artifact against its purpose and relevant criteria; artifact type does not imply code review.
   - **Idea challenge:** Evaluate reasoning, evidence, alternatives, and risks.
   - **Forward-looking plan review** (`--plan <file>`): Evaluate a plan/spec/proposal before implementation. The plan is the primary artifact; implementation VERIFY is skipped except for checking cited existing files, dependencies, constraints, and evidence.
5. **Keep the primary subject clear.** Session Activity is primary only for a session review. Code Changes, session notes, and other context are supporting evidence when the named artifact itself is primary.

### Phase 2: VERIFY ("Built right?")

Systematically verify the primary subject against its intended purpose, evidence, relevant requirements, and the confirmed scope. Assess code correctness and session coherence when those surfaces are in scope.

**Forward-looking plan-mode adjustment:** when the dispatch metadata or prompt says `Forward-looking plan review`, do NOT run implementation VERIFY as if completed code exists. Instead, verify only the plan's cited existing evidence: referenced files/paths, stated dependencies, constraints, assumptions, acceptance criteria, migration order, and risk controls. Missing implementation is expected and is not a finding unless the plan itself claims the work is already complete. Continue to check plan coherence against the confirmed scope and run Phase 3 VALIDATE in full.

#### Intent-before-defect Gate

Before emitting a defect finding, state the intended end state you are judging against. Use the explicit user goal, ADR/plan rationale, product copy, tests, public API contract, or established project convention. If no intent source is available, infer cautiously and mark confidence.

For each intent-dependent observation, answer:

- **Intent source:** what artifact establishes the intended behavior or design decision?
- **Evidence:** what code, test, runtime artifact, source citation, or project rule contradicts it?
- **Acceptability condition:** what concrete condition would make the current behavior acceptable?
- **Uncertainty route:** if the source of intent is missing or ambiguous, use `clarification-needed`, `document`, `investigate-first`, or a runtime/visual verification recommendation instead of a high-confidence `fix-now` finding.

Do not turn "I expected a different design" into a defect unless the expectation is anchored in a real intent source or a user-impacting invariant.

#### Plan/spec Claim Ledger

In forward-looking plan/spec/proposal review, build a compact ledger for every load-bearing claim before SYNTHESIZE:

| Claim class | Required check |
|---|---|
| Cited existing file/path | Confirm the path exists or mark it stale/missing. |
| API/schema/CLI snippet | Confirm it matches live signatures, docs, or tests, or mark it pseudocode. |
| Evidence/assertion claim | Trace it to the named command, fixture, test, issue, review log, or source citation. |
| Scope enumeration | Check that the plan clearly names intended files, the deterministic scope check, and excluded matches with reasons. Any clear equivalent format is sufficient. |
| Fix blast radius | Confirm the plan names downstream contracts, migrations, and rollback/verification surfaces. |

If a plan's evidence cannot be checked inside the review context, say exactly which claim is unchecked and route the item as plan-risk or `investigate-first`; do not present unchecked plan prose as verified fact.

#### Authored-rationale Challenge Evidence Bar

When the artifact under review explicitly says a behavior is intentional (`intentionally`, `by design`, `excluded`, `do not change`, ADR rationale, `eslint-disable`, `TODO accepted`, or similar), a reviewer may still challenge it, but the challenge has a higher evidence bar:

- Cite the rationale surface and the contradicting evidence.
- Prefer code trace, failing/absent test, runtime artifact, source citation, or project rule over taste or preference.
- If the rationale is merely unproven rather than contradicted, cap confidence at `low` and route as clarification/documentation, not a fix-driving defect.

#### Code Correctness (when code changes exist)

- Does the code do what it claims to do?
- Edge cases: null, empty, overflow, boundary conditions, off-by-one
- Error handling: are failures handled gracefully? No silent swallowing?
- Resource management: memory leaks, unclosed handles, missing cleanup
- Concurrency: race conditions, shared mutable state
- **Code simplicity** (when diff includes logic code, not pure UI/markup/config): consult [`.aivv/lenses/code.md`](../../../.aivv/lenses/code.md) for discovery pointer + [`.aivv/standards/code-quality.md`](../../../.aivv/standards/code-quality.md) for full CQ-* rule details (16 rules: simplification process, complexity, redundancy & abstraction). For cross-file / architecture-altitude simplification (god-files, module boundaries, cross-file knowledge duplication, dependency direction, file-tree fit), also consult [`.aivv/standards/architecture.md`](../../../.aivv/standards/architecture.md) for the AS-* catalog (8 rules) — the structural complement to CQ-*.

#### Completeness Sub-Pass (code constructs only)

When code is in the confirmed scope, for each encountered construct class verify its relevant companion. Missing companion → **MAJOR** finding when the companion's absence is reachable at current inputs; for not-manifest cases (e.g., a feature availability guard in a codebase that targets only evergreen browsers, or a test file expectation where the project has no enforced coverage gate), route through the Improvement-articulation pass (verified present need + specific improvement + positive net value required) rather than auto-elevating to MAJOR. This is a systematic code check, not a requirement for non-code reviews.

| Construct | Required companion to verify |
|-----------|------------------------------|
| `async` function/method touching network, clipboard, storage, or IndexedDB | `try/catch` with a user-facing error path (not silent swallow) |
| `useEffect` / `onMounted` / equivalent lifecycle hook registering a timer, event listener, WebSocket, or subscription | Cleanup teardown (`return () => { ... }` / explicit remove/close/unsubscribe call) |
| New file added under `lib/`, `utils/`, or `helpers/` directory where the project has a test coverage gate | Corresponding test file at the expected path |
| `await`-ed Web API call (`navigator.clipboard`, `navigator.vibrate`, `IntersectionObserver`, `ResizeObserver`, `requestFullscreen`, etc.) | Feature availability guard (`'x' in navigator` / `typeof X !== 'undefined'`) |
| New interactive element added (button, input, select, textarea, or custom control) | Accessible label (`aria-label`, `<label for>`, or `aria-labelledby`) |

#### Runtime Correctness (when code changes exist)

For runtime correctness procedure and visual verification triggers, read [runtime-visual-verification.md](runtime-visual-verification.md). Static analysis is not runtime correctness.

#### Scope and coherence (always)

- **Purpose and scope fit**: Does the artifact or session work align with the stated goal and confirmed scope?
- **Internal consistency**: Do related sections, decisions, and supporting artifacts agree? For a session review, do outcomes reflect decisions and constraints?
- **Completeness and status**: Are material gaps, limitations, and unfinished work clear relative to the artifact's intended next use?
- **Decision quality**: Where decisions are in scope, are they supported by relevant evidence and fair consideration of alternatives?
- **Risk acknowledgment**: Are material risks and uncertainties represented accurately?

#### Implementation completeness (when code is in scope)

- Does the implementation cover all stated requirements/goals?
- Are there scenarios the code doesn't handle?
- Does it follow the codebase's established patterns and conventions?
- Are tests present and do they test meaningful behavior (not just happy path)?

#### Security (when applicable)

- Input validation at system boundaries
- Injection vectors (SQL, XSS, command injection)
- Secrets or credentials in code
- Authentication/authorization gaps

#### UI/UX/Accessibility (when diff touches UI surfaces)

For trigger conditions and the visual verification advisory, read [runtime-visual-verification.md](runtime-visual-verification.md). For catalog lookup, read [standards-lookup.md](standards-lookup.md).

#### Factual-claim grounding (when findings rest on external-system claims)

For factual-claim grounding triggers, source ordering, degradation labels, and output markers, read [source-grounding.md](source-grounding.md).

#### Improvement-articulation pass (POLISH severity routing)

For the POLISH articulation gate, proportional-remediation gate, and severity/confidence model, read [severity-confidence.md](severity-confidence.md). Improvement suggestions must clear both gates; benefit alone does not justify added machinery.

### Phase 3: VALIDATE ("Right thing?")

Higher-level assessment. These findings are inherently more speculative — label them clearly.

#### Approach Validation
- Is this solving the right problem? Could there be a simpler approach?
- Does the design fit the scale of the problem? (over-engineered or under-engineered?)
- Does it align with the project's stated goals or design principles?
- Are the assumptions about usage/behavior reasonable?
- Will this be maintainable? Will it be painful to modify later?
- Are there genuinely viable alternatives worth considering? Do not manufacture alternatives when one localized correction is clearly sufficient; when alternatives are equally sound, preserve the author's choice.

#### Session-Specific Validation (for session reviews)
- Was the scope of work appropriate for the stated goals?
- Were trade-offs explicitly acknowledged rather than silently accepted?
- Does the session leave a clear path for follow-up work?
- If approaches were rejected, was the evaluation fair and thorough?
- For research/planning sessions: Is the analysis complete enough to support its stated next decision or action?

#### Devil's Advocate Challenge (Mandatory — all review scopes)

Before synthesizing, work through these four challenge questions. **Depth scales with change scope**: a small change gets a one-sentence answer per question; a large or architectural change warrants full exploration of scenarios, alternatives, and edge cases. If a challenge holds up cleanly, say so explicitly — a clean challenge outcome is positive signal. If it reveals a gap, that's a finding.

1. **Pre-mortem** — "If this artifact were used as intended today and caused a material failure in the next two weeks, what is the most likely cause? Is that scenario explicitly addressed?" For software changes, consider a production incident; for other subjects, use the relevant consequence.

2. **Assumption inventory** — "What does this artifact or decision assume about evidence, inputs, context, dependencies, or user behavior that is NOT established? What happens if a material assumption is wrong?"

3. **Inversion test** — "What is the riskiest decision or claim in scope? What is the plausible consequence if it is wrong or becomes unsuitable? Is that downside acknowledged and acceptable?"

4. **Simpler path test** — "Could the same outcome be reached with materially less complexity or effort, or by keeping the current state? If so, is the proposed change justified by a specific present need?" Where code structure is in scope, compare the concrete moving pieces that would be removed or added. Do not assert a simpler alternative unless you can sketch its shape and trade-off. See `.aivv/standards/code-quality.md` CQ-025 only when that code-quality rule applies.

Any improvement surfaced by this test must also pass [severity-confidence.md](severity-confidence.md)'s Proportional-remediation gate. The reviewer must compare the minimum sufficient correction with the proposed recommendation, account for added moving pieces, and show positive net value before emitting it.

For **large, high-consequence, or structurally complex reviews**, go further in proportion to the decision: examine the most plausible failure scenarios or alternatives, rather than stopping at the first one. Do not turn this into exhaustive scoring across unrelated categories.

#### Direction Challenge (fit-to-goal + negative-space) — apply only when `Direction: on`

The dispatch metadata's `Direction:` field gates this block. When `Direction: off`, SKIP this
subsection entirely (pre-feature review behavior). When `Direction: on`, add two
reasoning dimensions to the Devil's Advocate work above. Direction now defaults on after
the R19 maintainer-review gate passed; `--no-direction` or `direction: false` pins the
pre-feature behavior. **Depth scales** with the
`Thoroughness:` tier AND the assessed review scope: a concise check at `fast` or
small scope; a full alternatives analysis with reads and searches inside the confirmed subject and
relevant dependency evidence at `exhaustive` or architectural scope. Do not expand to whole-repo
exploration unless the repository is part of the confirmed review scope.

1. **Fit-to-goal.** Does this artifact or change advance the confirmed goal? State the goal you are
   assessing against (see Intent capture below). Is there a viable alternative that better meets the
   same goal under the stated constraints, and what trade-off would it make?
2. **Negative-space.** What is NOT present that the goal and artifact type imply? Consider material
   evidence or assumption gaps, relevant boundary and failure cases, dependencies, missing
   verification, unfinished scope, and undeclared non-goals. Check code-specific cases such as
   error paths, null/empty inputs, and test classes only when code is in scope. Name a gap only when
   it undermines the stated goal or intended use.

**The grounding gate (make-or-break).** Emit a direction finding ONLY IF it (1) cites concrete
evidence, (2) sketches a concrete alternative, (3) names the trade-off, and (4) is advisory.
Failing (2)+(3) → SUPPRESS as bikeshedding. On a clean change with nothing groundable, reason
through the two dimensions but emit NO finding (silence-of-findings on clean diffs is preserved).

**Severity + auto-fix.** Direction findings are **capped at MAJOR** ("won't meet the stated goal"
→ up to MAJOR; "a better alternative exists" → POLISH) and are **NEVER CRITICAL**. They are
**never auto-applied** by `/aivv-fix` (matches the AS-* "separate effort" precedent). Invasive
improvements route to `defer-with-rationale`.

#### Intent capture (infer-and-state)

1. Use an explicit goal if stated in the invocation prompt.
2. Otherwise INFER the goal from artifacts (README, ADRs, docs, commit/PR messages, the diff) —
   in-scope Tier-1 reads — and attach a confidence marker.
3. **Render the assumed-goal line UNCONDITIONALLY whenever the goal was *inferred* AND any
   direction reasoning ran** — regardless of whether a finding fired and regardless of
   POLISH-collapse: `Direction assessed against inferred goal: '<goal>' — not stated, correct me
   if wrong.` This restores falsifiability for the highest-stakes case (a wrong inferred goal that
   *suppresses* findings). For a **low-confidence** inferred goal, this same line's "correct me if
   wrong" framing IS the challenge — no separate confirmation step. On a **user-stated** goal that
   produced no findings, render NOTHING (the assumed-goal line is for inferred goals only).

(Author rationale, NOT reviewer-facing prose — keep in the plan/D6 only: the inline framing
deliberately does NOT route through the generic low-confidence→CHALLENGE step, which is reachable
only under `severity_model: impact_likelihood`, not the shipped `legacy_4pass` default — see D6/A3.
Reviewers have no visibility into the resolved `severity_model`, so this rationale stays out of the
methodology prose.)
4. **Undocumented intent** surfaces as a one-line INFO note at ALL tiers (the "state your goal"
   nudge is tier-independent); only the negative-space consequence-analysis DEPTH scales to
   finding-status at `thorough`+.

### Phase 4: SYNTHESIZE

Combine your findings into a coherent review. Apply the severity/confidence model and suppress noise.

**Always emit an Approach assessment:** lead Validation Observations with a one-line verdict on whether this is the right artifact or approach for its intended use and the simplest viable path without compromising quality, scope, or correctness. Include it even when the approach holds up cleanly. The assessment is a summary, not a finding; any concrete improvement it implies must still pass the improvement-articulation gate.
