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
      "concerns": [
        {
          "kind": "unverified-execution-claim",
          "summary": "Verification script reads manifest key '/page' but Next.js route groups produce '/(app)/page'",
          "evidence": "scripts/verify-manifest.mjs:14",
          "alternative": "Use Object.keys(manifest.pages).filter(k => k.includes('page')) to find the actual key"
        }
      ],
      "execution_evidence_needed": ["node scripts/verify-manifest.mjs 2>&1"]
    }
  ]
}
```

### Verdict enum

| Value | Meaning | Loop action |
|-------|---------|-------------|
| `APPROVE` | No blocking concerns | Proceed to Step 5 EXECUTE |
| `REVISE` | Concerns present; fix direction is correct, needs adjustment | Loop to Step 3 INVESTIGATE (challenge_iterations++) |
| `REJECT` | Fix direction is wrong; alternative supplied | Loop to Step 3 with alternative as primary input (challenge_iterations++) |

Batch-level `verdict` = worst across all `per_finding` verdicts (REJECT > REVISE > APPROVE).

### Concern kinds

| Kind | Description |
|------|-------------|
| `addresses-symptom-not-cause` | Fix adds a guard/fallback around a "should never happen" path |
| `regression-risk` | Fix changes a contract used by traced downstream callers |
| `hidden-side-effect` | Fix triggers a known hidden-side-effect pattern (aria-label, stacking context, framework key shape, etc.) |
| `recurring-class-miss` | `class_signature` scan found siblings NOT in `files_to_modify` |
| `unverified-execution-claim` | New verification code reads keys/paths that may not match the actual artifact |
| `better-alternative-exists` | When `alternative_approaches[]` is populated, a genuinely viable listed or omitted alternative would produce a better outcome for this project's context. Minimum-sufficient-remediation failures without a real alternative use `other`. |
| `other` | Concern doesn't fit the above categories |
