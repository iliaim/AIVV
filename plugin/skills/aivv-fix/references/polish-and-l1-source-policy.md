# POLISH And L1 Source Policy

Read from `skills/aivv-fix/SKILL.md` when POLISH handling or L1-source policy affects scope.

## Contents

- POLISH application behavior
- L1-source detection logic
- Batch-apply refusal guard
- Severity-threshold forced-show semantics

#### POLISH-application behavior (consults preferences `apply_polish_mode`, dev.39 T14)

For canonical guidance on **what POLISH means** vs MINOR vs DROP (the 3 terminal routes for L4-source-class boundary-cosmetic findings under the dev.41 4-pass severity inference), see `.aivv/methodology.md` under `cosmetic-edge-case-not-manifest-at-current-data`. Under `impact_likelihood`, unsupported cosmetic speculation is dropped because it does not establish verified present need and positive net value; a reachable real defect may route to MINOR, while POLISH requires the full three-part gate.

For each POLISH finding in the review log (encountered during Step 4 PLAN / Step 5 EXECUTE batching), first check whether `--apply-all-polish` is set. That flag is a per-run CLI override equivalent to invocation-local `fix_apply_policy.improvement=auto`; it wins over project/user policy and legacy `apply_polish_mode`, while still preserving the L1-source refusal guard, invasive-improvement deferral, and other safety gates. If the flag is absent, resolve `fix_apply_policy.improvement` through CLI > project > user > schema default. If explicit modern improvement policy is absent but legacy `apply_polish_mode` is explicit, map the legacy key first. Use the resolved value for improvement/POLISH application (`auto` = eligible only when `fix_confidence == high` and challenge/consequence gates clear; `ask` = batched decision queue; `skip` = skip unless safety floors require escalation). Invasive improvements always route to the decision queue with `defer-with-rationale` as the default, regardless of this resolved value. Legacy `apply_polish_mode` mappings:

- **`apply_polish_mode: always`** — maps to `fix_apply_policy.improvement=auto`; non-invasive findings are eligible only when modern confidence, L1-source, blast-radius, shared-interface, CHALLENGE, and write-intent gates clear.
- **`apply_polish_mode: ask`** — maps to `fix_apply_policy.improvement=ask`; route improvement/POLISH findings through the W10 batched decision queue, not a per-POLISH prompt loop.
- **`apply_polish_mode: never`** — maps to `fix_apply_policy.improvement=skip`; skip POLISH findings unless safety floors require escalation. POLISH findings remain in the review log for later manual review.

The CLI flag `--apply-all-polish` overrides the config value (per CLI > project > user > defaults precedence). `--apply-all-polish` is equivalent to `fix_apply_policy.improvement=auto` for the duration of one invocation; the persisted config is unchanged. It does not auto-apply invasive improvements, which require an explicit per-finding apply decision after the net-value case is shown.

The L1-source refusal guard fires regardless of `apply_polish_mode` value when the cited authority is applicable or applicability is undeclared — even when `apply_polish_mode: always` maps to `auto`, an applicable/undeclared-context L1-source POLISH finding still refuses batch-apply per the guard's safety contract. If declared `project_context` makes the cited legal authority inapplicable, keep forced-show rendering but do not refuse batch-apply solely because the finding carries the citation.

#### L1-source detection logic (load-bearing for `--apply-all-polish` refusal guard and `severity_threshold` forced-override)

This subsection is the **canonical home** for the L1-source detection regex. If updating the regex, also update the documentation copy at `skills/aivv/SKILL.md` Step 6 "Severity-threshold filter" subsection — it inlines the regex as a copy-with-sync-note for orchestrator hot-path use. Author-side specs and plans may also reference the regex; re-run a workspace-wide grep for the WCAG/FTC/DSA pattern to find any drift before shipping.

A finding qualifies as **L1-source** if either condition holds:

1. **Rule-ID prefix match:** `findings[i].rule_id` starts with `COMP-LEGAL-` OR `A11Y-` OR `DP-LEGAL-` (the WCAG-derived A11Y-* rule-ID space, including `A11Y-2.4.11` and similar; the COMP-LEGAL-* and DP-LEGAL-* legal-risk rule-ID spaces). The `rule_id` field is optional on the envelope (`.aivv/schemas/finding.json`); pre-dev.41 findings without `rule_id` skip this match condition and fall through to the regex match below.
2. **Source-citation regex match:** scan all textual content on the finding object — primarily `findings[i].summary` (required envelope field per `.aivv/schemas/finding.json`), and any `findings[i].grounded_by[*].source_ref` / `grounded_by[*].excerpt` strings (the dev.31+ typed-citation surface where authoritative-source URLs and quotes live). Match the regex: `WCAG\s*[0-9]|\bFTC\b|\bGDPR\b|EU[\s-]?DSA\b|\bDSA\s+Article|\bADA\b|Section\s*508|ARIA[\s-]+APG` (case-insensitive). A match in any of these fields qualifies the finding as L1-source.

   Word boundaries (`\b`) on the bare-acronym alternatives `FTC`/`GDPR`/`DSA`/`ADA` prevent false-positive matches on substrings like `ECDSA`, `metadata`, `ADAPTABLE`, or `ADAGIO`. The `EU[\s-]?DSA` alternative permits zero separators (matches compressed `EUDSA` observed in citations); the `ARIA[\s-]+APG` alternative requires at least one separator (compressed `ARIAAPG` is implausible in real citations) — the asymmetry is intentional. **dev.57: added `\bGDPR\b` alternation** (was absent in dev.56's regex; surfaced when dark-patterns.md introduced 4 DP-LEGAL-* rules with GDPR-only Source: lines that failed to match — see dev.56 IV&V F5 / dev.57 corrective). **dev.57: also added `DP-LEGAL-` to the prefix-match condition** so DP-LEGAL findings get forced-show via rule_id even when the citation regex doesn't fire (defense-in-depth — two independent triggers for the same forced-show class).

   *(Regex flavor: PCRE / Python `re` / JavaScript / `grep -P` — `\s`, `\b`, and `[0-9]` semantics are equivalent across these flavors. POSIX BRE has no `\s`/`\b` and is not supported; the orchestrator agent applies the match in-context, so flavor pinning is informational rather than a runtime gate.)*

Implementation:
- The orchestrator scans each finding's text content with the pinned regex above before applying any batch flag.
- For `--apply-all-polish`: if ≥1 POLISH finding qualifies as L1-source and the cited authority is applicable or applicability is undeclared, refuse batch-apply with a per-finding line: `<rule_id>: L1-source finding (<matched-citation>) is applicable or undeclared-context; manual review required.` If declared `project_context` makes a legal statute inapplicable, do not refuse batch-apply by bare citation alone.
- For `severity_threshold` filter (Step 6 output rendering): L1-source findings ARE FORCED-SHOWN regardless of threshold setting (CRITICAL+L1, MAJOR+L1, MINOR+L1, POLISH+L1 all rendered). See `skills/aivv/SKILL.md` Step 6 "Severity-threshold filter" subsection for the consumer of this rule (shipped dev.39 T15).

Free-text keyword matching (e.g., "legal" alone) is too imprecise and not used; the regex above is authoritative.
