# skills/aivv-view/scripts/humanize.jq
#
# Centralized translation module: maps technical field values to human-friendly labels.
# Single source of truth for every label translation across the viewer's renderers
# (Phase 0 summary, Phase 1 TUI, Phase 2 HTML) and for any external AIVV consumer.
#
# Usage:
#   jq -L /path/to/scripts 'include "humanize"; humanize' < canonical-envelope.json
#
# Idempotent: running humanize on already-humanized input safely re-writes the *_label
# fields without accumulating duplicates or losing information.

def lens_label:
  if . == null then null
  elif type == "array" then ([.[] | lens_label] | unique | join(", "))
  else {"code":"General review", "visual":"Visual design", "ux":"User experience",
        "sec":"Security", "polish":"Refinement suggestions"}[.] // .
  end;

def mode_label($n):
  if . == null then null
  else {"cold_multi_review":  "\($n) reviewers, run independently",
        "cold_single_review": "Single reviewer",
        "same_agent_review":  "Self-review (single agent)",
        "evidence_only_review":"Evidence-gathering pass"}[.] // .
  end;

def severity_desc:
  # Normalise to uppercase before table lookup so "major"/"MAJOR" both resolve.
  if . == null then ""
  else (ascii_upcase |
    {"CRITICAL":"(must address before shipping)",
     "MAJOR":   "(real defects, address soon)",
     "MINOR":   "(small issues, low urgency)",
     "POLISH":  "(a way to make this better — not a defect)"}[.] // "")
  end;

def enum_title_label:
  if . == null then null
  else
    (tostring | gsub("_"; " ") | ascii_downcase | split(" ")
      | map(if length == 0 then . else (.[0:1] | ascii_upcase) + .[1:] end)
      | join(" "))
  end;

def improvement_value_label:
  if . == null then null
  elif (tostring | ascii_downcase) | IN("high","medium","low") then enum_title_label
  else null end;

def agreement_label($severity):
  # POLISH variant: "suggested" not "spotted"
  (($severity // "") | ascii_upcase == "POLISH") as $is_polish |
  if . == null then null
  elif . == "cross_reviewer_convergent"  then (if $is_polish then "Both reviewers suggested this" else "Both reviewers spotted this" end)
  elif (. | IN("alpha_unique","solo-alpha","unique-to-alpha","unique-alpha","solo_alpha")) then (if $is_polish then "Reviewer A suggested this" else "Reviewer A spotted this" end)
  elif (. | IN("beta_unique","solo-beta","unique-to-beta","unique-beta","solo_beta"))     then (if $is_polish then "Reviewer B suggested this" else "Reviewer B spotted this" end)
  elif . == "unanimous"                  then "All reviewers agreed"
  elif . == "devils_advocate_convergent" then "Confirmed by adversarial check"
  else . end;  # free-form passthrough

def multi_model_agreement_label($count; $diversity):
  if ($count // null) == null or $count < 2 then null
  elif $diversity == "cross-provider" then "✓ \($count) cross-provider reviewers agreed"
  elif $diversity == "same-provider" then "✓ \($count) reviewers agreed (same provider)"
  else "✓ \($count) reviewers agreed" end;

def files_modified_label:
  if . == null or (type != "array") or length == 0 then null
  elif length == 1 then "1 file modified"
  else "\(length) files modified" end;

def devils_advocate_signals_label:
  if . == null or (type != "array") or length == 0 then null
  else
    ([.[] | .kind] | join(", ")) as $kinds |
    (. | length) as $n |
    "\($n) devils-advocate signal\(if $n == 1 then "" else "s" end): \($kinds)"
  end;

def provider_trust_label:
  if . == null then null
  else
    (.redactions // [] | length) as $redaction_count |
    (.blocked_paths // [] | length) as $blocked_count |
    (.warnings // [] | map(.code // .kind // "warning") | unique | join(", ")) as $warnings |
    (.prompt_sha256 // "unknown" | .[0:12]) as $prompt_hash |
    (.policy_sha256 // "unknown" | .[0:12]) as $policy_hash |
    "\(.provider // "provider") · \(.auth_mode // "auth") · \(.destination_shape // "destination") · prompt \($prompt_hash) · policy \($policy_hash) · blocked \($blocked_count) · redacted \($redaction_count)\(if $warnings == "" then "" else " · warnings: \($warnings)" end)"
  end;

def f_id_display_label:
  if . == null then null
  elif (.review_ref // null) == null then .primary
  else "\(.primary) (review ref: \(.review_ref))" end;

def line_anchors_label:
  if . == null or (type != "array") or length == 0 then null
  else "L" + ([.[] | tostring] | join(",L")) end;

def warning_sentence($count; $details):
  {"fingerprint_missing":            "\($count) finding\(if $count == 1 then "" else "s" end) lack persisted fingerprints; recurrence and wont-fix matching are unavailable for those findings",
   "fix_log_unjoinable":             "This review claims a fix session, but no linked fix log was found; addressed/open counts are evidence-limited",
   "addressed_unjoinable_id_shape":  "Finding IDs and fix-log addressed-list use incompatible formats — addressed status may be inaccurate (check id forms in both files)",
   "finding_quality_legacy_weak":    "\($count) finding\(if $count == 1 then "" else "s" end) use legacy weak handoff shape; evidence and fix guidance may require original review context",
   "finding_quality_modern_incomplete": "\($count) historical modern finding\(if $count == 1 then "" else "s" end) predate the proportional-remediation handoff field",
   "field_shape_coerced":            "\($count) field shape\(if $count == 1 then "" else "s" end) coerced for legacy compatibility — \($details); validate producer output if this review is new",
   "lifecycle_record_malformed":     "\($count) lifecycle record\(if $count == 1 then "" else "s" end) could not be loaded; linked lifecycle panels may be incomplete"
  }[.kind] // .detail;

def is_anomalous_warning:
  .kind | IN("fingerprint_missing","fix_log_unjoinable","addressed_unjoinable_id_shape","finding_quality_legacy_weak","finding_quality_modern_incomplete","field_shape_coerced","loader_error","humanize_error","render_error","calibration_skipped_deferred","lifecycle_record_malformed");

def all_loader_warnings:
  (.loader_warnings // []) + (.lifecycle.loader_warnings // []);

def warning_display_group($completed_at):
  # dev.182 shipped producer-side review-log validation. Before this cutoff,
  # weak fingerprints/handoff fields are historical compatibility; after it,
  # they indicate a current producer defect.
  "2026-06-02T18:42:22.000Z" as $modern_profile_cutoff |
  # proportional_remediation became a new-write requirement later. Its warning
  # therefore needs its own cutoff so valid intervening records stay historical.
  "2026-07-27T13:45:26.000Z" as $proportional_remediation_cutoff |
  if .kind == "calibration_skipped_deferred" then "deferred_design"
  elif .kind | IN("fix_log_unjoinable","addressed_unjoinable_id_shape") then "join_gap"
  elif .kind | IN("loader_error","humanize_error","render_error","lifecycle_record_malformed") then "render_gap"
  elif .kind == "finding_quality_modern_incomplete" then
    if (($completed_at // "") >= $proportional_remediation_cutoff) then "producer_defect" else "compatibility" end
  elif .kind | IN("fingerprint_missing","finding_quality_legacy_weak") then
    if (($completed_at // "") >= $modern_profile_cutoff) then "producer_defect" else "compatibility" end
  else "compatibility" end;

def evidence_state($wont_fix; $fix_status):
  if . == null then
    if ($wont_fix // null) != null then "wont_fix"
    elif (($fix_status // "") | ascii_downcase | startswith("fixed")) then "legacy_fixed_claim"
    elif (($fix_status // "") | ascii_downcase | startswith("deferred")) then "deferred"
    else "no_fix_session" end
  elif ((.final_disposition.disposition // null) | IN("closed","closed_with_residual_risk")) then "verified_resolved"
  elif ((.final_disposition.disposition // null) | IN("accepted_risk","false_positive")) then "wont_fix"
  elif (.final_disposition.disposition // null) == "deferred" then "deferred"
  elif (.final_disposition.disposition // null) == "needs_evidence" then "addressed_unverified"
  elif ((.final_disposition.disposition // null) | IN("needs_rework","reopened")) then "open"
  elif (.fix_outcome // null) | IN("resolved","verifier-pass-with-residual-warning") then "verified_resolved"
  elif (.status // null) == "verified" then "verified_resolved"
  elif (.status // null) == "wont-fix" then "wont_fix"
  elif (.status // null) == "unlinked" and ($wont_fix // null) != null then "wont_fix"
  elif (.status // null) == "unlinked" then "fix_unjoinable"
  elif (.addressed // false) == true then "addressed_unverified"
  elif (.status // null) == "fixed" then "addressed_unverified"
  elif ((.cycle_status // .status // null) == "deferred") then "deferred"
  else "open" end;

def status_label_from_state:
  {"open":"Open",
   "no_fix_session":"No fix session yet",
   "fix_unjoinable":"Fix evidence unjoinable",
   "addressed_unverified":"Addressed, not verified",
   "verified_resolved":"Verified resolved",
   "deferred":"Deferred",
   "wont_fix":"Won't fix",
   "render_error":"Render error",
   "legacy_fixed_claim":"Legacy fixed claim, no fix-log evidence"}[.] // "Open";

def title_case_hyphen_label:
  if . == null then null
  else split("-") | map(. as $word | ($word[0:1] | ascii_upcase) + $word[1:]) | join(" ") end;

def lifecycle_rca_status_label:
  if . == null then null
  else "RCA " + (title_case_hyphen_label | ascii_downcase) end;

def lifecycle_problem_status_label:
  {
    "candidate":"Candidate",
    "investigating":"Investigating",
    "prevention-active":"Prevention Active",
    "monitoring":"Monitoring",
    "closed":"Closed"
  }[.] // .;

def lifecycle_issue_status_label:
  {
    "drafted":"Drafted",
    "rca-pending":"RCA pending",
    "rca-reviewed":"RCA reviewed",
    "fix-planned":"Fix planned",
    "fix-implemented":"Fix implemented",
    "prevention-verified":"Prevention verified",
    "closed":"Closed"
  }[.] // .;

def lifecycle_sync_status_label:
  {
    "local-only":"Local only",
    "pending-user-confirmation":"Pending user confirmation",
    "synced":"Synced",
    "conflict":"Conflict",
    "sync-failed":"Sync failed"
  }[.] // .;

def sentence_case_hyphen_label:
  if . == null then null
  else (gsub("-"; " ") as $words | ($words[0:1] | ascii_upcase) + $words[1:]) end;

def runtime_evidence_label:
  if . == null then null
  else
    {
      "confirmed": "Runtime confirmed",
      "refuted": "Runtime refuted",
      "skipped": "Runtime skipped",
      "error": "Runtime error"
    }[.outcome] // ("Runtime " + (.outcome // "unknown"))
  end;

def decision_label:
  if . == null then null
  else
    {
      "fix": "Fix",
      "defer": "Defer",
      "wont_fix": "Won't fix",
      "needs_info": "Needs info"
    }[.decision] // (.decision | enum_title_label)
  end;

def fix_plan_status_label:
  if . == null then null
  else
    {
      "proposed": "Proposed",
      "approved": "Approved",
      "applied": "Applied",
      "superseded": "Superseded",
      "abandoned": "Abandoned"
    }[.] // enum_title_label
  end;

def verification_status_label:
  if . == null then null
  else
    {
      "verified_resolved": "verified resolved",
      "verified_unresolved": "verified unresolved",
      "needs_rework": "needs rework",
      "skipped": "skipped",
      "error": "error"
    }[.] // ((tostring | gsub("_"; " ")) | ascii_downcase)
  end;

def humanize:
  (.review_meta.reviewers // 2) as $reviewers |
  .review_meta += {
    lens_label:        (.review_meta.lens // null | lens_label),
    review_mode_label: (.review_meta.review_mode // null | mode_label($reviewers))
  }
  | .provider_trust = (
      if (.provider_trust // null) == null then null
      else .provider_trust + { provider_trust_label: (.provider_trust | provider_trust_label) }
      end
    )
  | .reviewer_roster = [
      .reviewer_roster[]? | . + {lens_label: (.lens // null | lens_label)}
    ]
  | .findings = [ .findings[]? | . as $f |
      . + {
        severity_desc:    ($f.severity // null | severity_desc),
        impact_tier_label:($f.impact_tier // null | enum_title_label),
        likelihood_label: ($f.likelihood // null | enum_title_label),
        value_label:      ($f.value // null | improvement_value_label),
        effort_label:     ($f.effort // null | enum_title_label),
        agreement_label:  (($f.agreement // $f.reviewer_attribution // null) | agreement_label($f.severity // "")),
        evidence_state:   ($f.resolution // null | evidence_state($f.wont_fix // null; $f.fix_status // null)),
        status_label:     (($f.resolution // null | evidence_state($f.wont_fix // null; $f.fix_status // null)) | status_label_from_state),
        wont_fix_label:   (if ($f.wont_fix.recurring_in_current_review // false)
                           then "↩ Recurring · previously dismissed"
                           else null end),
        multi_model_agreement_label:   multi_model_agreement_label($f.agreement_count; $f.agreement_diversity),
        files_modified_label:          ($f.files_modified | files_modified_label),
        devils_advocate_signals_label: ($f.devils_advocate_signals | devils_advocate_signals_label),
        f_id_display_label:            ($f.f_id_display | f_id_display_label),
        line_anchors_label:            ($f.line_anchors | line_anchors_label),
        runtime_evidence_label:        ($f.runtime_evidence | runtime_evidence_label),
        decision_label:                ($f.decision | decision_label),
        fix_plan_status_label:         ($f.fix_plan.status // null | fix_plan_status_label),
        verification_cycle_status_label: ($f.verification_cycle.status // null | verification_status_label)
      }
    ]
  | if (.lifecycle // null) == null then .
    else
      .lifecycle = (.lifecycle + {
        incidents: [
          .lifecycle.incidents[]? | . + {
            status_label: (.status | title_case_hyphen_label),
            severity_label: (.severity | title_case_hyphen_label),
            rca_status_label: (.rca_status | lifecycle_rca_status_label),
            closure_profile_label: (.closure_profile | sentence_case_hyphen_label)
          }
        ],
        problems: [
          .lifecycle.problems[]? | . + {
            status_label: (.status | lifecycle_problem_status_label),
            rca_status_label: (.rca_status | lifecycle_rca_status_label)
          }
        ],
        issues: [
          .lifecycle.issues[]? | . + {
            status_label: (.status | lifecycle_issue_status_label),
            sync_status_label: (.sync_status | lifecycle_sync_status_label)
          }
        ]
      })
    end
  | .loader_warnings_anomalous = (
      [all_loader_warnings[]? | select(is_anomalous_warning)]
      | group_by(.kind)
      | map(
          length as $count |
          ([.[] | .detail // empty] | join("; ")) as $details |
          (.[0]) + {
            sentence: (.[0] | warning_sentence($count; $details)),
            count: $count
          }
        )
    )
  | .loader_warning_groups = (
      (.review_meta.completed_at // .review_meta.invoked_at // null) as $completed_at |
      [all_loader_warnings[]? | select(is_anomalous_warning) | . + {display_group: (. | warning_display_group($completed_at))}]
      | group_by(.display_group)
      | map({
          group: .[0].display_group,
          count: length,
          kinds: ([.[].kind] | unique)
        })
    );
