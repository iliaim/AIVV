# Low-Risk Fast Path

Read from `skills/aivv-fix/SKILL.md` before skipping cold investigator dispatch for a mechanically obvious finding.

## Purpose

The fast path reduces unnecessary orchestration cost for low-risk fixes while preserving the AIVV invariants: root cause before writes, inspectable write intents, and deterministic verification.

## Eligibility Gate

A finding may use the fast path only when ALL conditions are true:

- Single finding or batch with one shared self-contained root cause.
- `category == "code-bug"` or `category == "documentation-gap"` with fully known verbatim content.
- Severity is MINOR or POLISH, OR `recommended_next_step == "defer-with-rationale"` / `"document"` / absent legacy equivalent below MAJOR.
- One file and one localized location are involved.
- The root cause is directly visible from the cited file/line or the supplied review evidence.
- The proposed fix is mechanical and unambiguous.
- `class_signature`, `scope_search_seed`, `predecessor_finding_match`, and architectural-remediation seeds are absent.
- No L1-source/legal/manual-review trigger is present.
- No shared-interface path matches `shared_interface_patterns`.
- No runtime-only reproduction is required.
- A concrete verification command or deterministic grep/read check exists before writes.

Any uncertainty fails closed to the normal Step 3 investigator path.

## Fast-Path Record

When the gate passes, record an inline investigation object equivalent to a high-confidence investigator result:

```json
{
  "investigation_route": "fast_path_inline",
  "root_cause": "exact cause, not symptom",
  "evidence": "file:line or cited supplied evidence",
  "fix": "mechanical change to apply",
  "why_no_cold_investigator": "all fast-path eligibility gates passed",
  "verification_plan": "command or deterministic check"
}
```

Append `capability_degradations: []` unless a host capability actually degraded. Do not label the route as same-agent fallback; this is an explicit low-risk route, not a failed cold dispatch.

## Execution

Fast-path findings still run:

1. Step 4 field propagation and apply-policy classification.
2. Step 4.4 write-intent materialization.
3. Step 4.4.5 red-green gate when applicable.
4. Step 4.5 CHALLENGE when its normal triggers fire.
5. Step 5 execution branches.
6. Step 5.5+ mechanical verification checks.
7. Step 6 VERIFY, exactly as for any other finding. Whether the verifier is a cold dispatch or a same-agent pass is decided only by the conditions in [verifier-dispatch.md](verifier-dispatch.md); the fast path adds no exemption.

The fast path only skips cold root-cause investigation. It never skips write safety, user decision gates, or verification.
