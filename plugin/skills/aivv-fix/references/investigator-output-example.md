## Single Finding Schema

```json
{
  "finding_id": "F001",
  "domain": "code",
  "category": "code-bug",
  "original_finding": "MAJOR: Missing input validation in save_task()",
  "related_findings": [],
  "shared_root_cause": false,

  "root_cause_analysis": {
    "surface_symptom": "save_task() accepts user input without validation",
    "problem_specification": {
      "is_what": "save_task() accepts any string as task name without type or length validation",
      "is_where": "scripts/dashboard/blueprints/task_management.py:142",
      "is_when": "On any POST /task request — no conditional; always missing",
      "is_not_what": "Projects endpoint has schema validation via Flask-WTF",
      "is_not_where": "scripts/dashboard/blueprints/projects.py — validates form input",
      "boundary_explanation": "projects.py was written after Flask-WTF was added to the project; task_management.py predates it and was never updated"
    },
    "why_1": "No validation function is called before processing input",
    "why_2": "The function was written without a validation layer",
    "why_3": "No project convention requires input validation at API boundaries",
    "why_4": "No automated check (hook/linter) enforces validation patterns",
    "why_5": "Missing architectural guardrail for input handling at system boundaries",
    "root_cause": "No enforced convention or automated check for input validation at API boundaries",
    "root_cause_category": "missing-guardrail",
    "confidence": "high",
    "verification_method": "code-trace",
    "verification_evidence": "scripts/dashboard/blueprints/task_management.py:142",
    "evidence": [],
    "class_signature": "asserts X without verifying against source",
    "scope_search_seed": "classroom-timer"
  },

  "codebase_scan": {
    "similar_patterns_found": 5,
    "locations": [
      "scripts/dashboard/blueprints/task_management.py:142",
      "scripts/dashboard/blueprints/projects.py:87",
      "scripts/dashboard/blueprints/approvals.py:203",
      "scripts/dashboard/server.py:445",
      "scripts/dashboard/server.py:512"
    ],
    "pattern_description": "Direct use of request.json/request.form without validation in API endpoints",
    "systemic_assessment": "Systemic — found in 5 locations across 4 files"
  },

  "incident_context": {
    "introduced_by": {
      "last_commit_sha": "<commit-sha>",
      "last_commit_message": "feat: add task management endpoints",
      "last_commit_author": "dev@example.com",
      "last_commit_date": "2026-03-15T14:22:00Z",
      "blame_lines_touched": [142],
      "confidence": "programmatic"
    },
    "detection_failure": "No test covers the task_management.py endpoint; Flask-WTF validation pattern was not applied when endpoints were added because the convention was not yet documented",
    "contributing_factors": [
      {
        "factor": "No project-wide convention requiring input validation at API boundaries at time of authoring",
        "factor_type": "process"
      },
      {
        "factor": "Flask-WTF added to project after task_management.py was written; no retrofit pass performed",
        "factor_type": "knowledge"
      }
    ]
  },

  "best_practices": {
    "industry_standard": "OWASP Input Validation Cheat Sheet: validate all input at system boundaries using allowlists",
    "relevant_sources": ["OWASP Top 10 A03:2021 Injection", "Flask-WTF validation patterns"],
    "current_vs_recommended": "Current: raw request.json passed directly to processing. Recommended: validate with schema before processing."
  },

  "confidence_gap": "Unclear whether empty-string and null-object are both expected inputs",
  "confidence_gap_shape": "context-shaped",

  "fix_proposal": {
    "approach": "strategic",
    "description": "Create validate_input() decorator that validates request data against JSON schemas at API boundaries",
    "verbatim_doc_content": null,
    "files_to_modify": [
      "scripts/dashboard/blueprints/task_management.py",
      "scripts/pm_core/validation.py"
    ],
    "estimated_scope": "medium",
    "risks": [
      "Overly strict validation could reject valid inputs",
      "Schema definitions add maintenance overhead"
    ],
    "alternatives_considered": [
      {
        "approach": "Fix only the reported endpoint",
        "rejected_because": "Leaves other endpoints vulnerable — treats symptom not root cause"
      }
    ],
    "approach_id": "A1",
    "alternative_approaches": [
      {
        "approach_id": "A1",
        "description": "Create centralised validate_input() decorator applied at every API boundary",
        "addresses_root_cause": true,
        "trade_offs": {
          "pros": ["Eliminates all 5 sibling locations in one change", "Enforced by pre-commit hook"],
          "cons": ["Adds decorator import to every endpoint module"]
        },
        "estimated_scope": "medium",
        "recommended": true
      },
      {
        "approach_id": "A2",
        "description": "Inline validation per endpoint — add type check before each DB call",
        "addresses_root_cause": false,
        "trade_offs": {
          "pros": ["Zero import overhead"],
          "cons": ["Duplicates validation logic in 5 locations", "Easy to miss future endpoints"]
        },
        "estimated_scope": "small",
        "recommended": false
      }
    ]
  },

  "prevention_plan": {
    "mechanism": "hook",
    "eligibility_basis": "existing-control-failed",
    "eligibility_evidence": "The current pre-commit checks permit direct request.json access at five endpoints.",
    "description": "Pre-commit hook that greps for direct request.json usage without validation wrapper",
    "enforcement_level": "warning",
    "implementation_details": "Add pattern check to pre-edit-check.py"
  },

  "prerequisite_probe": {
    "ran": false,
    "categories_checked": [],
    "findings": []
  },

  "verdict": "fix-required"
}
```
