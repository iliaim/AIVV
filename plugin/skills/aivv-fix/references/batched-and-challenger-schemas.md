## Batched Output (Multiple Findings with Shared Root Cause)

When an investigator analyzes a batch of related findings:

```json
[
  {
    "finding_id": "F001",
    "domain": "code",
    "related_findings": ["F002"],
    "shared_root_cause": true,
    "root_cause_analysis": {
      "...": "shared root cause analysis"
    },
    "fix_proposal": {
      "description": "Single fix addresses both F001 and F002"
    }
  },
  {
    "finding_id": "F002",
    "domain": "code",
    "related_findings": ["F001"],
    "shared_root_cause": true,
    "root_cause_analysis": {
      "...": "references F001's root cause"
    },
    "fix_proposal": {
      "description": "Covered by F001's fix proposal"
    }
  }
]
```

## Fix-Challenger Output Schema

The Step 4.5 CHALLENGE subagent returns this structure (see `references/fix-challenger-prompt-template.md` for the full prompt that generates it).

```json
{
  "batch_id": "B1",
  "verdict": "APPROVE",
  "per_finding": [
    {
      "finding_id": "F001",
      "verdict": "APPROVE",
      "concerns": [],
      "non_blocking_observations": ["The proposed script's behavior is not established by the supplied evidence."],
      "execution_evidence_needed": ["node scripts/verify-manifest.mjs 2>&1"]
    }
  ]
}
```

### Verdict enum

| Value | Meaning | Loop action |
|-------|---------|-------------|
| `APPROVE` | No blocking concerns | Proceed to Step 5 EXECUTE |
| `REVISE` | Evidence-backed, actionable in-scope defect; correction keeps the goal and boundaries | Re-enter Step 3 only if the invocation-wide rework budget has room |
| `REJECT` | Evidence shows the fix direction is wrong; concrete in-scope alternative supplied | Re-enter Step 3 only if the invocation-wide rework budget has room |

Batch-level `verdict` = worst across all `per_finding` verdicts (REJECT > REVISE > APPROVE).

`concerns` contains only blocking, evidence-backed defects. Uncertainty or
hypothetical risk belongs in `non_blocking_observations` and does not trigger
rework by itself. An out-of-scope alternative must be labeled and cannot become
the primary fix direction.

### Concern kinds

| Kind | Description |
|------|-------------|
| `addresses-symptom-not-cause` | Fix adds a guard/fallback around a "should never happen" path |
| `regression-risk` | Fix changes a contract used by traced downstream callers |
| `hidden-side-effect` | Fix triggers a known hidden-side-effect pattern (aria-label, stacking context, framework key shape, etc.) |
| `recurring-class-miss` | `class_signature` scan found siblings NOT in `files_to_modify` |
| `unverified-execution-claim` | New verification code reads keys/paths that may not match the actual artifact |
| `better-alternative-exists` | When `alternative_approaches[]` is populated, a genuinely viable listed or omitted alternative would produce a better outcome for this project's context. Minimum-sufficient-remediation failures without a real alternative use `other`. |
| `scope-expansion` | Proposed alternative changes the user's goal or crosses an explicit exclusion; it cannot be adopted in this invocation |
| `other` | Concern doesn't fit the above categories |
