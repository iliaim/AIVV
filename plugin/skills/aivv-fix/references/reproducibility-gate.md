# Reproducibility Gate

Read in Step 3, before the fast path or investigator dispatch, when a finding is sourced from `[user-reported]`, `[deferred]`, or `[agent-noted]`, or has `lens: sec`. Signal 0/1 findings outside the security lens skip this file.

## Contents

- [Reproducibility gate](#reproducibility-gate-signal-2-4-only--fires-before-investigator-dispatch) (Signal 2–4)
- [Sec-lens reproducibility extension](#sec-lens-reproducibility-extension-fires-for-any-lens-sec-finding--all-signal-tiers) (any `lens: sec` finding)

## Reproducibility gate (Signal 2-4 only — fires before investigator dispatch)

For findings sourced from `[user-reported]`, `[deferred]`, or `[agent-noted]`:

1. **Attempt to reproduce the issue** using the steps/evidence available in the finding description.
   - For code-bugs: look at the code path mentioned. Can you see the condition that triggers it? If yes → `reproduction_status: code-confirmed`; proceed.
   - For runtime issues: is there a reproduction script or test case available? Run it. If yes and it fails as described → `reproduction_status: runtime-confirmed`; proceed.
   - If neither → `reproduction_status: unconfirmed`.

2. **If `unconfirmed`:**
   - Set `confidence_gap_shape: context-shaped` on the finding's triage record.
   - Ask the user: "I cannot reproduce [F###]: [description]. Can you provide: (a) the exact input that triggers it, (b) the expected vs actual output, (c) the environment/conditions?"
   - Proceed only after user provides reproduction evidence OR user explicitly says "proceed anyway."
   - If user says "proceed anyway": spawn investigator with `source_signal: [agent-noted]` tier-scrutiny and `confidence` likely to come back `low` + `confidence_gap_shape: context-shaped`.

3. **For `[deferred]` findings:** verify the issue is STILL PRESENT. Quick code check (grep/read) before spawning. If no longer present → `verdict: already-correct`; skip investigation.

**Skip when:** finding is Signal 0 (`[ivv]`) or Signal 1 (formal review output).

## Sec-lens reproducibility extension (fires for any `lens: sec` finding — all signal tiers)

Security findings get one extra step in the reproducibility gate: state the **reachable execution path** statically. Unlike the base gate above, this fires regardless of signal tier (a sec finding is usually Signal 1, which the base gate skips) — it is gated only on the finding's `lens`/`domain` being `sec`. No runtime PoC is required or attempted — `/aivv` analyzes static artifacts, not running systems.

> **Disambiguation (one word, two jobs):** this *static-reachability* determination answers **"can user input reach the vulnerable code at all"** — a reproduce-gate question that decides whether to investigate. It is distinct from the W5 LIKELIHOOD `reachability` axis in `.aivv/lenses/sec.md` (the `### LIKELIHOOD: reachability and exposure` determinant), which answers **"will the harm manifest"** and feeds *severity*. Do not conflate `unreachable-static` (no code path → wont-fix) with a W5 `UNLIKELY` likelihood (a path exists but rarely fires → severity discount).

This **extends** the base `reproduction_status` values (`code-confirmed | runtime-confirmed | unconfirmed`) — it does not replace them:

1. **Trace the path (static):** "User-controlled input at `[entry point]` flows to `[vulnerable code]` via `[code path]`." Read the code; no runtime PoC.

2. **Classify the outcome:**
   - **Path traceable** → `reproduction_status: code-confirmed`; proceed to investigation (same value the base code-bug case uses).
   - **Path traceable but exploitability uncertain** (timing attack, second-order injection, SSRF, info disclosure via error differential) → `reproduction_status: code-confirmed-uncertain-exploitability`. Record the traced path in the finding's `static_reachability.execution_path` and the static-only basis in `static_reachability.exploitability_note`, and **proceed to the fix** — inability to confirm runtime exploitability does NOT block it. Let the uncertainty inform the W5 LIKELIHOOD axis (discount toward `POSSIBLE`/`UNLIKELY`) rather than acting as a separate severity input, so the two systems don't double-count it.
   - **Genuinely unreachable from any entry point under static analysis** → `reproduction_status: unreachable-static`. This is a structural "there is no execution path" determination, NOT an "I can't confirm it" case. Set `verdict: wont-fix` with the traced no-path reasoning and route through the **existing wont-fix sign-off flow** (`SKILL.md` Step 4 wont-fix: present reasoning → user accepts (registry write, `user_approved: true`) or overrides). Mandatory user sign-off before deferring — never auto-defer a security finding.

**Why `lens: sec` only:** accessibility (`A11Y-*`) and legal-compliance (`COMP-LEGAL-*`) findings are definitionally not security-exploitability findings under AIVV's lens taxonomy and must never be gated on a reachability trace; the trigger is the security lens exclusively. Investigators MAY persist the trace as a structured `static_reachability` object — see [investigator-enrichment-fields.md](investigator-enrichment-fields.md) `### static_reachability`.
