---
name: ux
description: UX review lens — heuristics (Nielsen, Schneiderman, Laws of UX), microcopy, interaction-state completeness
calibration_lens: ux
applies_to: JSX/TSX, Vue, Svelte, HTML, copy strings, i18n catalogs, form/dialog/empty-state markup, navigation structure, error/loading components
detect_paths: "**/*.tsx, **/*.jsx, **/*.vue, **/*.svelte, **/*.html, **/forms/**, **/*form*, **/*wizard*, **/*onboarding*, **/*checkout*, **/*dialog*"
detect_keywords: "ux, usability, form, flow, onboarding, error message, microcopy, interaction, validation feedback"
detect_high_risk: false
runtime_driver: optional (heuristic walkthrough is static; runtime confirmation of state-machine timing optionally upgradable when B3 runtime evidence or a host adapter is present — see Graceful degradation)
---

## Focus

Apply these review concerns **in addition to** the universal Phase 2 VERIFY rules. The `ux` lens evaluates the *experience* dimension of UI code — does the surface follow operationalized heuristics, is the microcopy correct, are the interaction states complete?

When `--lens=ux` is active, Phase 2 VERIFY is structured as a **heuristic walkthrough** (see `.aivv/prompts/reviewer-role.md` Phase 2 VERIFY for the walkthrough framework). The reviewer steps through the change set asking heuristic questions, not just diff-line questions.

### Heuristic baseline (operationalized)

The lens treats the following heuristic catalogs as the L2 cognitive-psychology layer of the source-precedence model (see `.aivv/methodology.md` and `.aivv/standards/README.md`). When a code change exercises a primitive these heuristics cover, the reviewer asks the operationalized question — not a vague "does this feel usable?"

- **Nielsen's 10 usability heuristics** (`HEU-NN1..NN10`): visibility of system status, real-world match, user control, consistency, error prevention, recognition over recall, flexibility, minimal aesthetic, error recovery, help/docs.
- **Schneiderman's 8 golden rules** (`HEU-SCH1..SCH8`): consistency, universal usability, informative feedback, dialog closure, error handling, easy reversal, internal locus of control, short-term memory load.
- **Laws of UX** (`HEU-LUX-<slug>`): Doherty Threshold (≤400ms perceived response), Fitts's Law (target size + distance), Hick's Law (choice count → decision time), Miller's Law (7±2 chunking), Postel's Law (input tolerance), Jakob's Law (convention familiarity), and others — see [.aivv/standards/ux-heuristics.md](../standards/ux-heuristics.md) for the full catalog.

The specific `HEU-*` rule IDs (`HEU-NN1`, `HEU-LUX-doherty`, etc.) are defined in [.aivv/standards/ux-heuristics.md](../standards/ux-heuristics.md) (shipped dev.46). Reviewers cite these rule IDs directly in findings; the Forward-reference rule under "Standards to consult" below remains for IS-* / HEU-* rules added in future cycles before they're catalogued.

The operationalization principle: each heuristic is paired with a code-reviewable question. *"Visibility of system status"* becomes *"does every async operation that takes > 1 second display a loading indicator before the response arrives?"* — a question answerable from JSX + handler code.

### Microcopy & UX writing (see `.aivv/standards/microcopy.md`)

- Labels are nouns describing what the field captures, not instructions ("Email" not "Enter your email")
- Buttons start with verbs describing the action ("Save changes", "Delete account") not generic verbs ("OK", "Submit") unless context is unambiguous
- Error messages: what went wrong + what to do next, in user terms (not stack traces, not error codes alone, not "Invalid input")
- Empty states explain what the user will see when content arrives + how to create the first item — never a bare "No data."
- Confirmation prose for destructive actions names the object and the consequence ("Delete project Acme — this cannot be undone" not "Are you sure?")
- Sentence case on UI labels by default (Material/web convention); Title Case reserved for product names + headings where consistency demands
- Number formatting respects locale (1,234.56 vs. 1.234,56) — flag hardcoded `.toLocaleString('en-US')` or `Intl.NumberFormat('en-US')` in non-locale-pinned contexts

### Interaction-state completeness (see `.aivv/standards/interaction-states.md`)

Every interactive primitive has a finite set of states it must handle. See [.aivv/standards/interaction-states.md](../standards/interaction-states.md) for the canonical per-primitive state inventory (button / form-field / async-list / dialog / navigation / toast). Diffs that introduce a new primitive without covering the full state inventory should produce a finding — *"This `<Button loading={...} />` doesn't render a `loading` indicator; the disabled state covers click suppression but not user feedback."*

Specifics:
- Async ops > 1s without loading state — visibility-of-system-status violation
- Async ops > 10s without optimistic update / progress indication — Doherty-threshold violation
- Forms without inline validation feedback — error-prevention violation
- Lists without empty state — recognition-over-recall violation
- Destructive actions without confirmation + undo — error-recovery violation
- Skeleton/spinner/SWR-stale indicator missing on data-fetching components

### Navigation and AI-pattern misuse

- Multi-step flows: progress indication, ability to navigate back without losing state — internal-locus-of-control violation
- Primary CTA per screen ≤ 1 — Hick's-Law operationalized (adding decisions costs time)
- AI suggestion patterns (autocomplete, AI rewrites, "summarize this") — user can dismiss, undo, or override; the AI never silently mutates user input

## Severity anchors

When `severity_model: impact_likelihood` is active, use these anchors for UX findings. In legacy mode, treat them as reviewer reasoning guidance, not an override of the configured shared severity model. UX severity is not based on whether the prose sounds annoying; it follows task impact and how often the user encounters the friction.

### IMPACT: experience harm if encountered

- **CATASTROPHIC** — the primary task cannot be completed, a destructive or irreversible action is easy to trigger accidentally, or users are trapped without a recoverable path.
- **SEVERE** — a core form, dialog, navigation path, or state transition is substantially confusing or error-prone; completion requires non-obvious workarounds.
- **MODERATE** — the interface adds avoidable friction, ambiguity, memory load, or recovery cost, but the task remains completable.
- **NEGLIGIBLE** — copy/style convention drift, low-risk preference mismatch, or isolated heuristic concern with no plausible task harm.

### LIKELIHOOD: frequency and persistence

- **CERTAIN** — every user sees it on initial render, every primary-flow attempt, or every activation of a required control.
- **PROBABLE** — common users encounter it in normal form/dialog/list states, common variants, or repeated workflow steps.
- **POSSIBLE** — it appears only on an error path, optional branch, less common role, unusual input size, or secondary workflow.
- **UNLIKELY** — test/story-only state, hidden branch, speculative interaction, or issue only reachable through unusual setup not present in the reviewed project.

Persistence is a likelihood/exposure modifier: friction that recurs every interaction ranks higher than a one-time onboarding stumble with the same local impact. Do not upgrade a finding solely because it cites a well-known heuristic; the observable user consequence still controls impact.

## Trigger patterns (flag these explicitly)

These patterns produce a finding under the `ux` lens unless the surrounding context establishes a justified exception:

- `<button>OK</button>` / `<button>Submit</button>` / `<button>Cancel</button>` — generic verb without object/consequence (cite MC-006, HEU-NN6 — recognition-over-recall: the user must remember which action they're confirming when the verb doesn't name the object)
- `<input placeholder="Email">` without an associated label — placeholder-as-label is an established UX defect (cite UX-001, MC-013)
- Async fetch / mutation handler without a `loading` / `pending` UI branch — visibility of system status
- `setLoading(true)` / `setSubmitting(true)` set without any UI consumer reading it — dead-state-management bug
- List/table components rendered without an empty-state branch (`{data.length === 0 ? ... : ...}` missing) (cite MC-022)
- Destructive button (`Delete`, `Remove`, `Drop`) without a confirmation step in the same component or a parent that gates it (cite MC-007, MC-026)
- Hardcoded English-only strings in components likely to ship to multi-locale targets (out-of-`i18n`-lens scope; `ux` lens flags as MINOR microcopy concern with i18n note)
- Primary buttons stacked > 1 per visible screen / modal / form (Hick's-Law — `variant="primary"` count > 1 in the rendered subtree) (cite MC-009)
- Toasts / notifications without a dismiss control or auto-dismiss timer — user-control violation (cite MC-033, MC-034)
- Modal / dialog opens without focus trap + return-focus-on-close — also a `visual` lens trigger; `ux` flags the *flow* impact (user loses orientation)
- Form fields with required validation that activates on first render before user interaction (premature error display) — error-prevention violation (cite MC-021)
- Optimistic UI updates without an error-rollback path
- AI-suggestion pattern (autocomplete dropdown, AI rewrite preview) with no explicit accept/reject control — silent mutation risk

### Boundary with the `user-journey` lens

The `ux` lens audits *the surface a user encounters*, assuming the user is already on it. The `user-journey` lens (shipped dev.121) audits *the journey* — discovery, activation, perceptible feedback, completion. When a finding is about whether a zero-knowledge user can *discover* an entry point, *perceive* that activation succeeded, or *complete* the underlying task (not just "use the surface heuristically well"), prefer `user-journey` — emit the finding under that lens, not `ux`. Conversely, microcopy quality, interaction-state completeness, and heuristic conformance on a surface the user is already on remain in `ux`. Two reviewers running `--lens=ux,user-journey` will produce intentionally complementary findings; consensus synthesis deduplicates only at the fingerprint layer.

**Phase 0 transition note (dev.121):** before dev.121, this lens carried a Phase 0 "Pre-verdict disconfirmation gate" subsection inside Trigger patterns that emitted findings under UX-* rule IDs with UJ-* candidate names in-prose and `grounded_by.source_type = "unverifiable"`. That subsection has migrated to `.aivv/lenses/user-journey.md`; the UJ-* candidate names promote to full backed rule IDs. Calibration records emitted under the Phase 0 gate remain in the legacy `.aivv/calibration/ux.jsonl` (read via union) under the `ux` lens; new UJ-* findings post-dev.121 route to the `user-journey` lens (`.aivv/calibration/user-journey/<invocation-id>.jsonl` shards per per-invocation sharding contract).

## Standards to consult

- [.aivv/standards/ui-ux.md](../standards/ui-ux.md) — UX-001..046 existing form/nav/error/loading/checkout/tables/pagination/search/filter/status patterns (the static-code subset of `ux` lens scope; UX-030..036 added dev.81 = T22 phase 1 = checkout & payment, 7 rules; UX-037..041 added dev.82 = T22 phase 2 = data tables & pagination, 5 rules; UX-042..046 added dev.83 = T22 phase 3 = search inputs, filter grouping & status messages, 5 rules)
- [.aivv/standards/microcopy.md](../standards/microcopy.md) — MC-001..038 (NEW dev.43; subdir-retrofitted dev.64 — top-level is TOC stub, rules across 9 subfiles in `microcopy/`) — UX-writing rule catalog with authoritative-source citations
- [.aivv/standards/ux-heuristics.md](../standards/ux-heuristics.md) — HEU-NN1..NN10 (Nielsen) + HEU-SCH1..SCH8 (Schneiderman) + HEU-LUX-<slug> (Laws of UX, lawsofux.com-anchored) + HEU-COG-<slug> (cognitive biases, primary HCI/psychology literature) rule catalog (NEW dev.46, COG- subgroup added dev.47; subdir-retrofitted dev.65 — TOC stub + 4 by-source subfiles in `ux-heuristics/`; dev.69 nested sub-split — `laws-of-ux.md` itself becomes a TOC stub pointing to 6 by-domain sub-subfiles in `ux-heuristics/laws-of-ux/` to close the Wave A >500-line outlier) with authoritative-source citations
- [.aivv/standards/interaction-states.md](../standards/interaction-states.md) — IS-001..030 per-primitive state inventories (NEW dev.46; subdir-retrofitted dev.66 — TOC stub + 6 by-primitive subfiles in `interaction-states/`) with authoritative-source citations
- [.aivv/standards/dark-patterns.md](../standards/dark-patterns.md) — DP-* manipulative-UX detection (NEW dev.56; subdir-retrofitted dev.68 — TOC stub + 9 by-domain subfiles in `dark-patterns/`; DP-LEGAL-* in `legal.md`): pricing / subscription / consent / urgency / scarcity / social-proof / gamification / accessibility-trap / dark-PR; the **DP-LEGAL-*** subset carries L1 source-class (FTC / EU DSA / GDPR citations), forced-shows regardless of `severity_threshold`, and uses the context-gated hard legal floor
- [.aivv/methodology.md](../methodology.md) — universal review phases (still apply; this lens is additive)

**Forward-reference rule for unshipped standards files (general convention):** when a finding rests on operationalized heuristic prose from THIS lens file but the cited rule_id is not yet defined in any shipped standards file (e.g., a future `compliance.md` `COMP-*` rule referenced before that file ships), the reviewer MUST NOT cite a fabricated rule ID. Emit the finding with the descriptive heuristic name IN-LINE in the prose, and set `grounded_by[*].source_type = "unverifiable"` with a `source_ref` value of `"<heuristic-name>:standards-file-pending"`. When the backing standards file ships in a future cycle, the operator's calibration aggregator can promote these unverifiable groundings to verified ones via the new rule-IDs at that time. This prevents calibration-corpus pollution with non-resolving rule-ID strings while preserving the lens's ability to ship before its full standards backing. Note: as of dev.46, `HEU-*` and `IS-*` rules are shipped — the Forward-reference rule no longer applies to these prefixes.

## Graceful degradation

The `ux` lens ships in v0.1 as **static heuristic walkthrough** — JSX/HTML/copy-string inspection against the standards files above + the operationalized-heuristic catalog. This requires no browser, no MCP, no runtime.

**When runtime evidence is supplied** (B3 generated probes + user-run Playwright JSON, or an explicitly supported host adapter), the lens may upgrade to runtime confirmation for state-machine timing (e.g., empirical Doherty-threshold check against rendered async ops). Runtime upgrade is **optional** and **not required for the lens to function**.

**No-UI-in-change-set case**: if the review target contains no UI code, no copy strings, and no interaction surface, the `ux` lens returns zero findings with: "UX lens: no UX surface in review target; no findings applicable." Do not force-apply heuristics to non-UI code.

**Author-only / private-doc-only change**: same as above — pure markdown/internal-doc changes do not exercise the UX surface even when they touch user-facing words. The lens fires on rendered UI copy, not on contributor-facing prose.

**Cross-lens overlap**: many `ux`-lens triggers also fire under `visual` (a11y, focus management, color-only signaling) or `sec` (CSRF on forms, autocomplete on sensitive fields). The `ux` lens emits the *experience* angle (what the user perceives, decides, recovers from); peer lenses cover the *correctness* and *safety* angles. When N reviewers run with different lenses against the same diff, expect intentional overlap — consensus synthesis (`/aivv` Step 6) deduplicates by rule-ID where applicable.
