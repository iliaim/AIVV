### Prerequisite Probe (optional — added for Phase 1.5; backward-compatible)

Investigators emit this field when Phase 1.5 PREREQUISITE PROBE is run (default-on for fixes touching environmental dependencies; skipped for pure-logic fixes). Backward-compatible — outputs that omit the field remain valid; the orchestrator treats absence as "Phase 1.5 skipped".

```json
"prerequisite_probe": {
  "ran": boolean,                       // false when skipped because the fix is a pure-logic change
  "categories_checked": [               // any subset of the five Phase 1.5 categories
    "env-vars" | "deployed-files" | "services" | "dependency-versions" | "feature-flags"
  ],
  "findings": [
    {
      "category": string,               // one of the category enum values above
      "command": string,                // the verification command run (e.g., "vercel env ls")
      "result": string                  // brief observed outcome (e.g., "CHROME_EXTENSION_ID not set on Vercel")
    }
  ]
}
```

When Phase 1.5 surfaces a missing precondition, the Phase 5 fix proposal must reflect it (provision step, fallback, or downgraded verdict per the Phase 1.5 spec in `.aivv/prompts/investigator-role.md`).

**Consumer status (v0.1):** the field is emitted-and-recorded but **not yet consumed downstream**. `/aivv-fix` Step 4 PLAN does not extract it; Step 5 EXECUTE has no branch for "provision precondition before code change"; the verifier in Step 6 does not check that preconditions were met. This makes Phase 1.5 informational-only at v0.1 — the investigator's prose analysis surfaces missing preconditions to the user via the Step 4 results display, but no automated provisioning or execution branch fires. Wiring Phase 1.5 into Step 4/5 consumer logic is queued for a future cycle once dogfood evidence shapes the right ergonomics.

## Source Finding Identity

When a source finding includes `rule_id`, fix-session records must preserve that standards identity exactly. A fix can resolve, reject, or defer the finding, but it must not silently rewrite `rule_id` to a different standards rule; if the original citation is wrong, record that as a finding-quality issue rather than changing the source finding's identity.

### static_reachability (optional — `lens: sec` findings only; backward-compatible)

Investigators MAY emit this field for `lens: sec` findings to document the static-reachability determination from the **Sec-lens reproducibility extension** (see [investigation-dispatch.md](investigation-dispatch.md)). Optional and backward-compatible — findings that omit it remain valid; absence means the trace was not recorded as structured data (the prose `reproduction_status` in the gate is the source of truth either way). Named `static_reachability` (not `reachability_analysis`) to stay distinct from the W5 LIKELIHOOD `reachability` axis in `.aivv/lenses/sec.md` — this field is a reproduce-gate path trace, not a severity input.

```json
"static_reachability": {
  "reachable": boolean,                 // is the vulnerable code reachable from an entry point under static analysis?
  "execution_path": string,             // traced path: "input at [entry] -> [vulnerable code] via [path]"
  "reproduction_status":                // sec-lens extension of the gate's reproduction_status (superset of the base 3 values)
    "code-confirmed" | "code-confirmed-uncertain-exploitability" | "unreachable-static",
  "exploitability_note": string         // for code-confirmed-uncertain-exploitability: what runtime evidence would upgrade confidence
}
```

**Consumer status (v0.1):** emitted-and-recorded but **not yet consumed by automated routing**. The prose Sec-lens reproducibility extension in `investigation-dispatch.md` drives the actual gate decision (proceed / proceed-static-only / wont-fix-with-sign-off); this structured field is for record-keeping and future tooling. The `unreachable-static` route reuses the existing wont-fix sign-off flow (`SKILL.md` Step 4), not a new mechanism. (Design note: the spec's separately-named `reachability_note` finding field was consolidated into `execution_path` here per the dev.235 re-validate gate — one field, not two, per Operating Principle 1.)

### unsafe_control_action (optional — interaction/coordination findings only; backward-compatible)

Investigators MAY emit this field on `root_cause_analysis` when the finding is an **interaction failure** — shared state, concurrency, async ordering, lifecycle/teardown, cache or state invalidation, or a cross-component contract — to record the **Unsafe Control Action lens** determination (STPA, distilled; see the "Debugging Technique" section of the investigator prompt). Optional and backward-compatible: findings that omit it remain valid; absence means the finding was not framed as a control failure (most single-unit defects are not). Distilled from STAMP/STPA (Leveson, MIT) — AIVV adopts only the four unsafe-control-action guide-words and the stale-process-model question, derived **statically** from call graph and data flow; no runtime control-loop observation is required or attempted (AIVV analyzes static artifacts, not running systems).

```json
"unsafe_control_action": {
  "control_relationship": string,       // which component issues the action, which is controlled, and the constraint that should hold between them
  "uca_type":                           // the unsafe-control-action pattern that fits (the four canonical STPA guide-words)
    "not-provided" |                    // a required control action is never issued (missing cleanup/guard, un-cancelled subscription)
    "provided-causes-hazard" |          // an action is issued but causes the hazard (wrong call, wrong target)
    "wrong-timing-or-order" |           // issued too early / too late / out of order (race, TOCTOU, missing await)
    "wrong-duration",                   // applied too long / stopped too soon (leaked handle, lock released before invariant restored, early return before commit)
  "stale_process_model": boolean        // did the controller act on a stale/wrong model of the controlled component's state? (stale cache, stale prop, stale enum)
}
```

**Consumer status (v0.1):** emitted-and-recorded but **not yet consumed by automated routing** — it enriches the root-cause record for interaction bugs (the class 5-Whys/Fishbone frame poorly) and is surfaced to the user via the Step 4 results display; no Step 4/5 branch dispatches on it yet. Wiring is queued for a future cycle once dogfood evidence shapes the ergonomics, mirroring the `prerequisite_probe` / `static_reachability` staging pattern.
