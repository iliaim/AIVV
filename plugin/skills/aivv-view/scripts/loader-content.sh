#!/usr/bin/env bash
# skills/aivv-view/scripts/view-loader.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
require_jq
AIVV_ROOT="$(aivv_view_runtime_root "$SCRIPT_DIR")"
INCIDENT_STATE_HELPER="$AIVV_ROOT/tools/incident-state.mjs"

INPUT_FILE=""
FIX_DIR=""
WONT_FIX=""
while [ $# -gt 0 ]; do
  case "$1" in
    --file) INPUT_FILE="$2"; shift 2 ;;
    --fix-dir) FIX_DIR="$2"; shift 2 ;;
    --wont-fix) WONT_FIX="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$INPUT_FILE" ]; then
  echo "Usage: view-loader.sh --file <review-log.json> [--fix-dir <dir>] [--wont-fix <path>]" >&2
  exit 2
fi

aivv_view_visible "$INPUT_FILE" || { echo "view-loader: review import is incomplete" >&2; exit 65; }

INPUT_DIR="$(cd "$(dirname "$INPUT_FILE")" && pwd)"
REVIEW_ID_FOR_DECISIONS="$(jq -r '(.id // .review_id // "")' "$INPUT_FILE" 2>/dev/null || true)"

# Pre-build a fix-by-review-id lookup if --fix-dir given.
# Each fix-log references its review via source_review_id, review_id_consumed,
# canonical source=="review_id" + review_id, or legacy source_argument text.
# We merge both into a single index keyed by the review_id value.
# Single jq -s pass over root and archived fix logs (avoids N-process per-file
# loop — B2 fix). Root wins if the same review is represented in both locations.
FIX_INDEX_JSON='{}'
FIX_DIR_GIVEN=false
if [ -n "$FIX_DIR" ] && [ -d "$FIX_DIR" ]; then
  FIX_DIR_GIVEN=true
  # Collect archive then root files into an array (nullglob-safe: loop handles
  # no-match via -f check). The last timestamped fix within a location remains
  # current, while an active fix always overrides an archived copy.
  fix_files=()
  for f in "$FIX_DIR"/archive/fix-*.json; do
    if [ -f "$f" ] && aivv_view_visible "$f"; then fix_files+=("$f"); fi
  done
  for f in "$FIX_DIR"/fix-*.json; do
    if [ -f "$f" ] && aivv_view_visible "$f"; then fix_files+=("$f"); fi
  done
  if [ "${#fix_files[@]}" -gt 0 ]; then
    FIX_INDEX_JSON=$(jq -s -c '
      def source_review_key:
        .source_review_id
        // .review_id_consumed
        // (if .source == "review_id" then .review_id else null end)
        // (if ((.source_argument // "") | test("--review-id=")) then
              (.source_argument | capture("--review-id=(?<id>[^[:space:]]+)").id)
            else null end);
      map(select(source_review_key != null))
      | map({
          source_review_id: source_review_key,
          invocation_id: (.invocation_id // .id),
          status: .status,
          findings_addressed: ((.findings_addressed // []) | map(select(. != null))),
          fix_plans: (.fix_plans // []),
          changes_summary: (.changes_summary // []),
          # Historical counts are not per-finding verification evidence.
          verification_cycles: (
            .verification_cycles |
            if type == "array" then map(select(type == "object")) else [] end
          ),
          final_dispositions: (.final_dispositions // [])
        })
      | reduce .[] as $fix ({}; .[$fix.source_review_id] = $fix)
    ' "${fix_files[@]}" 2>/dev/null || echo '{}')
  fi
fi

DECISIONS_JSON='{"decisions":[],"loader_warnings":[]}'
DECISIONS_DIR=""
if [ -n "$FIX_DIR" ] && [ -d "$FIX_DIR" ]; then
  DECISIONS_DIR="$FIX_DIR"
elif [ -d "$INPUT_DIR" ]; then
  DECISIONS_DIR="$INPUT_DIR"
fi
if [ -n "$DECISIONS_DIR" ] && [ -n "$REVIEW_ID_FOR_DECISIONS" ]; then
  decisions_file="$DECISIONS_DIR/decisions-$REVIEW_ID_FOR_DECISIONS.json"
  if [ -f "$decisions_file" ] && aivv_view_visible "$decisions_file"; then
    if DECISIONS_JSON=$(jq -c --arg file "$decisions_file" --arg review_id "$REVIEW_ID_FOR_DECISIONS" '
      def valid_decision:
        (type == "object")
        and ((.finding_id // null) | type == "string")
        and (.decision | IN("fix", "defer", "wont_fix", "needs_info"))
        and ((keys - ["finding_id", "finding_fingerprint", "decision", "notes", "decided_by", "decided_at"]) | length == 0);
      def normalize_decision:
        {
          finding_id,
          finding_fingerprint: (.finding_fingerprint // null),
          decision,
          notes: (.notes // null),
          decided_by: (.decided_by // null),
          decided_at: (.decided_at // null)
        };
      if (.schema_version == 1
          and .review_id == $review_id
          and (.decisions | type) == "array"
          and (.decisions | all(valid_decision))) then
        {decisions:(.decisions | map(normalize_decision)), loader_warnings:[]}
      else
        {decisions:[], loader_warnings:[{file:$file, kind:"decisions_record_malformed", detail:"decisions file failed v1 shape checks"}]}
      end
    ' "$decisions_file" 2>/dev/null); then
      :
    else
      DECISIONS_JSON=$(jq -n -c --arg file "$decisions_file" \
        '{decisions:[], loader_warnings:[{file:$file, kind:"decisions_record_malformed", detail:"decisions file failed JSON parsing"}]}')
    fi
  fi
fi

WF_REGISTRY_JSON='[]'
if [ -n "$WONT_FIX" ] && [ -f "$WONT_FIX" ] && aivv_view_visible "$WONT_FIX"; then
  WF_REGISTRY_JSON=$(jq -c '.' "$WONT_FIX")
fi

LIFECYCLE_JSON='{"incidents":[],"problems":[],"issues":[],"loader_warnings":[]}'
LIFECYCLE_STATE_DIR=""
if [ -n "$FIX_DIR" ] && { [ -d "$FIX_DIR/incidents" ] || [ -d "$FIX_DIR/problems" ] || [ -d "$FIX_DIR/issues" ]; }; then
  LIFECYCLE_STATE_DIR="$FIX_DIR"
elif [ -d "$INPUT_DIR/incidents" ] || [ -d "$INPUT_DIR/problems" ] || [ -d "$INPUT_DIR/issues" ]; then
  LIFECYCLE_STATE_DIR="$INPUT_DIR"
fi

if [ -n "$LIFECYCLE_STATE_DIR" ]; then
  lifecycle_tmp="$(mktemp -d "${TMPDIR:-/tmp}/aivv-view-lifecycle.XXXXXX")"
  lifecycle_incident_jsonl="$lifecycle_tmp/incidents.jsonl"
  lifecycle_problem_jsonl="$lifecycle_tmp/problems.jsonl"
  lifecycle_issue_jsonl="$lifecycle_tmp/issues.jsonl"
  lifecycle_warnings_jsonl="$lifecycle_tmp/warnings.jsonl"
  : >"$lifecycle_incident_jsonl"
  : >"$lifecycle_problem_jsonl"
  : >"$lifecycle_issue_jsonl"
  : >"$lifecycle_warnings_jsonl"

  load_lifecycle_records() {
    local record_kind="$1"
    local record_dir="$2"
    local record_glob="$3"
    local output_jsonl="$4"
    local label

    [ -d "$record_dir" ] || return 0
    case "$record_kind" in
      incident) label="Incident" ;;
      problem) label="Problem" ;;
      issue) label="Local issue" ;;
      *) echo "view-loader: unsupported lifecycle kind '$record_kind'" >&2; exit 2 ;;
    esac

    for record in "$record_dir"/$record_glob; do
      [ -f "$record" ] || continue
      aivv_view_visible "$record" || continue
      if ! jq -e . "$record" >/dev/null 2>&1; then
        jq -n -c --arg file "$record" --arg label "$label" \
          '{file:$file, kind:"lifecycle_record_malformed", detail:($label + " record failed JSON parsing.")}' \
          >>"$lifecycle_warnings_jsonl"
        continue
      fi
      if ! {
        if [ "$record_kind" = "problem" ]; then
          node "$INCIDENT_STATE_HELPER" validate --file "$record" --state-dir "$LIFECYCLE_STATE_DIR" --kind problem >/dev/null 2>&1
        elif [ "$record_kind" = "issue" ]; then
          node "$INCIDENT_STATE_HELPER" validate --file "$record" --state-dir "$LIFECYCLE_STATE_DIR" --kind local-issue >/dev/null 2>&1
        else
          node "$INCIDENT_STATE_HELPER" validate --file "$record" --state-dir "$LIFECYCLE_STATE_DIR" >/dev/null 2>&1
        fi
      }; then
        jq -n -c --arg file "$record" --arg label "$label" \
          '{file:$file, kind:"lifecycle_record_malformed", detail:($label + " record failed lifecycle validation.")}' \
          >>"$lifecycle_warnings_jsonl"
        continue
      fi
      jq -c --arg file "$record" '{file:$file, record:.}' "$record" >>"$output_jsonl"
    done
  }

  load_lifecycle_records incident "$LIFECYCLE_STATE_DIR/incidents" 'incident-*.json' "$lifecycle_incident_jsonl"
  load_lifecycle_records problem "$LIFECYCLE_STATE_DIR/problems" 'problem-*.json' "$lifecycle_problem_jsonl"
  load_lifecycle_records issue "$LIFECYCLE_STATE_DIR/issues" 'issue-*.json' "$lifecycle_issue_jsonl"

  LIFECYCLE_JSON=$(jq -n -c \
    --slurpfile incidents "$lifecycle_incident_jsonl" \
    --slurpfile problems "$lifecycle_problem_jsonl" \
    --slurpfile issues "$lifecycle_issue_jsonl" \
    --slurpfile warnings "$lifecycle_warnings_jsonl" \
    '{incidents: $incidents, problems: $problems, issues: $issues, loader_warnings: $warnings}')
  rm -rf "$lifecycle_tmp"
fi

jq --arg INPUT_FILE_PATH "$INPUT_FILE" \
   --argjson fix_index "$FIX_INDEX_JSON" \
   --argjson fix_dir_given "$FIX_DIR_GIVEN" \
   --argjson decisions_state "$DECISIONS_JSON" \
   --argjson wf_registry "$WF_REGISTRY_JSON" \
   --argjson lifecycle_state "$LIFECYCLE_JSON" \
   '
# Normalize an F-id string for comparison:
#   "F1-some-slug" → "F1"    (strip slug suffix)
#   "F001"         → "F1"    (strip leading zeros → canonical numeric form)
#   "F7"           → "F7"    (already canonical)
#   anything else  → as-is
def fnorm:
  if . == null then null
  elif test("^F-?[A-Z]?[0-9]+([-_].*)?$") then
    (capture("^F-?[A-Z]?(?<num>[0-9]+)(?:[-_].*)?$").num) |
    ("F" + (tonumber | tostring))
  else . end;

# Check if a finding id (fid) is in an addressed list using slug-aware + zero-pad matching.
# Null-safe: null fid never matches; null entries in addressed are filtered (B3 fix).
def is_addressed(fid; addressed_list):
  if (fid // null) == null then false
  else
    (fid | fnorm) as $fnorm_fid |
    (addressed_list | map(select(. != null) | fnorm)) as $fnorm_list |
    ($fnorm_list | index($fnorm_fid) != null)
  end;

def decision_key:
  .finding_id // .finding_ref // .ref // .id // null;

def array_or_empty:
  if . == null then []
  elif type == "array" then .
  else [.] end;

# Object-shaped peer of array_or_empty, for the audit blocks the --html panels sub-index.
# A wrong type used to pass straight through `// null` (which guards null, not type) and
# die in the renderer as `jq: Cannot index string with string "..."` — , which
# made every one of the 13 review_scope-carrying logs in a real corpus unopenable.
# Coercing to null here lets the existing `// null` section gates in the renderer short-circuit,
# so no renderer change is needed and the healthy path is untouched.
def object_or_null:
  if . == null then null
  elif type == "object" then .
  else null end;

# Records the coercion so a skipped block is visible rather than silently dropped.
# Detail format matches the finding-level field_shape_coerced emitters above.
def shape_warning($name; $expected; $review_id; $input_file):
  if . == null then empty
  elif type == $expected then empty
  else { file: $input_file, kind: "field_shape_coerced",
         detail: ($name + " coerced from " + type
                  + (if $expected == "object" then " to null: " else " to empty array: " end)
                  + ($review_id // "unknown" | tostring)) }
  end;

def project_finding($root; $fix_log_match; $decision_match):
  {
    id: (.ref // .id // null),
    f_id_display: (
      ((.ref // .id // null)) as $raw |
      if $raw == null then null
      else
        ($raw | fnorm) as $canon |
        {
          primary: $canon,
          review_ref: (if $raw == $canon then null else $raw end)
        }
      end
    ),
    severity: (.severity // "MINOR"),
    impact_tier: (.impact_tier // null),
    likelihood: (.likelihood // null),
    confidence: (.confidence // null),
    category: (.category // null),
    summary: (.description // .summary // .title // ""),
    title: (.title // null),
    file: (.file // .file_path // (.files // [])[0] // null),
    scope_ref: (.scope_ref // null),
    location_label: (
      if (.file // .file_path // (.files // [])[0] // null) != null then
        (.file // .file_path // (.files // [])[0])
      elif (.scope_ref // null) != null then
        "\(.scope_ref.kind):\(.scope_ref.ref)"
      else null end
    ),
    line: (.line // null),
    line_anchors: (
      if (.line_anchor // null) == null then null
      else
        [.line_anchor | split(",") | .[] |
         gsub("^\\s+|\\s+$"; "") |
         ltrimstr("L") |
         if test("^[0-9]+$") then tonumber else empty end]
      end
    ),
    reviewer: (.reviewer // null),
    lens: (.lens // $root.lens // null),
    rule_id: (.rule_id // null),
    devils_advocate: (.devils_advocate // false),
    grounded_by: (.grounded_by | array_or_empty),
    quality_profile: (.quality_profile // null),
    evidence: (.evidence | array_or_empty),
    runtime_evidence: (.runtime_evidence // null),
    impact: (.impact // null),
    severity_rationale: (.severity_rationale // null),
    recommended_next_step: (.recommended_next_step // null),
    verification_path: (.verification_path // null),
    proportional_remediation: (.proportional_remediation // null),
    agreement: (.agreement // null),
    agreement_count: (.agreement_count // null),
    agreement_diversity: (.agreement_diversity // null),
    reviewer_attribution: (
      if (.reviewer_attribution // null) | type == "array" then .reviewer_attribution
      else null end
    ),
    reviewer_attribution_legacy_text: (
      if (.reviewer_attribution // null) | type == "array" then null
      elif (.reviewer_attribution // null) | type == "string" then .reviewer_attribution
      else (.convergence // .cross_reviewer_agreement // null) end
    ),
    fingerprint: (.fingerprint // null),
    improvement: (.improvement // null),
    value: (.value // null),
    effort: (.effort // null),
    suggested_action: (.suggested_action // .suggested_fix // null),
    fix_status: (.fix_status // null),
    decision: ($decision_match // null),
    files_modified: (
      ((.ref // .id) | fnorm) as $finding_canon |
      if ($fix_log_match // null) == null then null
      else
        [ ($fix_log_match.changes_summary // [])[]
          | select((.finding_id // null) != null and (.finding_id | fnorm) == $finding_canon)
          | .file
        ]
        | if length == 0 then null else . end
      end
    ),
    devils_advocate_signals: (.devils_advocate_signals // null)
  };

def warnings_for_finding($input_file):
  [
    (if (has("ref") and (has("id") | not)) then
       { file: $input_file, kind: "field_alias_applied", detail: "id projected from `ref`" }
     else empty end),
    (if (has("description") and (has("summary") | not)) then
       { file: $input_file, kind: "field_alias_applied", detail: "summary projected from `description`" }
     else empty end),
    (if (has("files") and (has("file") | not)) then
       { file: $input_file, kind: "field_alias_applied", detail: "file projected from `files[0]`" }
     else empty end),
    (if (has("file_path") and (has("file") | not)) then
       { file: $input_file, kind: "file_path_aliased_to_file", detail: "file projected from `file_path`" }
     else empty end),
    (if (has("suggested_fix") and (has("suggested_action") | not)) then
       { file: $input_file, kind: "field_alias_applied", detail: "suggested_action projected from `suggested_fix`" }
     else empty end),
    (if (has("convergence")) then
       { file: $input_file, kind: "field_alias_applied", detail: "reviewer_attribution projected from `convergence`" }
     else empty end),
    (if (has("cross_reviewer_agreement")) then
       { file: $input_file, kind: "field_alias_applied", detail: "reviewer_attribution projected from `cross_reviewer_agreement`" }
     else empty end),
    (if (has("severity") | not) then
       { file: $input_file, kind: "field_default_applied", detail: "severity defaulted to MINOR" }
     else empty end),
    (if (has("fingerprint") | not) then
       { file: $input_file, kind: "fingerprint_missing", detail: "no fingerprint in source" }
     else empty end),
    (if ((.quality_profile // null) != "modern")
        and (
          ((.evidence // []) | length) == 0
          or ((.impact // null) == null)
          or ((.severity_rationale // null) == null)
          or ((.recommended_next_step // null) == null)
          or ((.verification_path // null) == null)
          or ((.proportional_remediation // null) == null)
        ) then
       { file: $input_file, kind: "finding_quality_legacy_weak",
         detail: ("legacy finding lacks modern handoff fields: " + ((.ref // .id // "unknown") | tostring)) }
     else empty end),
    (if ((.quality_profile // null) == "modern")
        and ((.proportional_remediation // null) == null) then
       { file: $input_file, kind: "finding_quality_modern_incomplete",
         detail: ("historical modern finding predates proportional-remediation handoff: " + ((.ref // .id // "unknown") | tostring)) }
     else empty end),
    (if ((.grounded_by // null) != null) and ((.grounded_by | type) != "array") then
       { file: $input_file, kind: "field_shape_coerced",
         detail: ("grounded_by coerced from " + (.grounded_by | type) + " to array: " + ((.ref // .id // "unknown") | tostring)) }
     else empty end),
    (if ((.evidence // null) != null) and ((.evidence | type) != "array") then
       { file: $input_file, kind: "field_shape_coerced",
         detail: ("evidence coerced from " + (.evidence | type) + " to array: " + ((.ref // .id // "unknown") | tostring)) }
     else empty end),
    (if ((.ref // .id // null) != null) and ((.ref // .id) | test("^F-?[A-Z]?[0-9]+([-_].*)?$") | not) then
       { file: $input_file, kind: "fnorm_unparseable_id_form", detail: ("unparseable F-id form: " + (.ref // .id)) }
     else empty end),
    (if (.line_anchor // null) != null and
        (.line_anchor | split(",") | any(test("[^L0-9, ]"))) then
       { file: $input_file, kind: "field_dropped_unsupported_shape",
         detail: ("line_anchor partially unparseable: " + .line_anchor) }
     else empty end)
  ];

def lifecycle_matches_current($review_id; $finding_ids; $finding_fingerprints; $fix_ids):
  .record as $incident |
  (
    ($review_id != null and (
      (($incident.links // []) | any(.type == "review_log" and .id == $review_id))
      or (($incident.review_id // null) == $review_id)
    ))
    or ((($incident.links // []) | any(
      .type == "finding" and (
        ((.id // null) as $id | $id != null and ($finding_ids | index($id) != null))
        or ((.id // null) as $id | $id != null and (($id | fnorm) as $norm | $finding_ids | index($norm) != null))
        or ((.id // null) as $id | $id != null and ($finding_fingerprints | index($id) != null))
        or ((.fingerprint // null) as $fp | $fp != null and ($finding_fingerprints | index($fp) != null))
      )
    )))
    or (($incident.source_fix_ref.fix_id // null) as $fix_id | $fix_id != null and ($fix_ids | index($fix_id) != null))
    or ((($incident.links // []) | any(
      .type == "fix_log" and ((.id // null) as $fix_id | $fix_id != null and ($fix_ids | index($fix_id) != null))
    )))
    or (($incident.source_fix_ref.finding_id // null) as $source_finding_id |
      $source_finding_id != null and (
        ($finding_ids | index($source_finding_id) != null)
        or (($source_finding_id | fnorm) as $norm | $finding_ids | index($norm) != null)
      )
    )
  );

def lifecycle_links_review($record; $review_id):
  $review_id != null and (
    (($record.links // []) | any(.type == "review_log" and .id == $review_id))
    or (($record.links // []) | any((.review_id // null) == $review_id))
  );

def lifecycle_link_matches_finding($finding_ids):
  ((.id // null) as $id |
    $id != null and (
      ($finding_ids | index($id) != null)
      or (($id | fnorm) as $norm | $finding_ids | index($norm) != null)
    )
  );

def lifecycle_problem_matches_current($review_id; $incident_ids; $finding_ids; $fix_ids):
  .record as $problem |
  lifecycle_links_review($problem; $review_id)
  or (($problem.incident_ids // []) | any(. as $id | $incident_ids | index($id) != null))
  or (($problem.links // []) | any(.type == "incident" and ((.id // null) as $id | $id != null and ($incident_ids | index($id) != null))))
  or (($problem.links // []) | any(.type == "finding" and lifecycle_link_matches_finding($finding_ids)))
  or (($problem.links // []) | any(.type == "fix_log" and ((.id // null) as $id | $id != null and ($fix_ids | index($id) != null))));

def lifecycle_issue_matches_current($review_id; $problem_ids; $incident_ids; $finding_ids; $fix_ids):
  .record as $issue |
  lifecycle_links_review($issue; $review_id)
  or (($issue.links // []) | any(.type == "problem_cluster" and ((.id // null) as $id | $id != null and ($problem_ids | index($id) != null))))
  or (($issue.links // []) | any(.type == "incident" and ((.id // null) as $id | $id != null and ($incident_ids | index($id) != null))))
  or (($issue.links // []) | any(.type == "finding" and lifecycle_link_matches_finding($finding_ids)))
  or (($issue.links // []) | any(.type == "fix_log" and ((.id // null) as $id | $id != null and ($fix_ids | index($id) != null))));

def project_lifecycle_incident:
  .record |
  {
    id: .id,
    status: .status,
    severity: .severity,
    summary: .summary,
    detected_at: .detected_at,
    resolved_at: .resolved_at,
    trigger: .trigger,
    recurrence_key: .recurrence_key,
    occurrence_count: .occurrence_count,
    rca_status: .rca_status,
    closure_profile: .closure_profile,
    links: (.links // []),
    evidence_count: ((.evidence // []) | length),
    sensitive: (.sensitive // false)
  };

def project_lifecycle_problem:
  .record as $problem |
  {
    id: $problem.id,
    status: $problem.status,
    summary: $problem.summary,
    rca_status: $problem.rca_status,
    recurrence_keys: ($problem.recurrence_keys // []),
    incident_ids: ($problem.incident_ids // []),
    closure_gate_statuses: (($problem.closure_gates // {}) | with_entries(.value = .value.status)),
    retire_when: ($problem.retire_when // []),
    links: ($problem.links // []),
    evidence_count: (($problem.evidence // []) | length)
  };

def project_lifecycle_issue:
  .record as $issue |
  {
    id: $issue.id,
    external_id: $issue.external_id,
    status: $issue.status,
    title: $issue.title,
    sync_status: ($issue.sync.status // "local-only"),
    github: ($issue.sync.github // null),
    owner: ($issue.owner // null),
    due_at: ($issue.due_at // null),
    acceptance_criteria: ($issue.acceptance_criteria // []),
    closure_criteria: ($issue.closure_criteria // []),
    labels: ($issue.labels // []),
    closure_gate_statuses: (($issue.closure_gates // {}) | with_entries(.value = .value.status)),
    links: ($issue.links // []),
    evidence_count: (($issue.evidence // []) | length)
  };

. as $root |
($root.id // $root.review_id // null) as $review_id |
($fix_index[$review_id // ""] // null) as $fix_log_match |
($decisions_state.decisions // []) as $decisions |
([ $root.findings[]? | (.ref // .id // null) | select(. != null) ] +
 [ $root.findings[]? | (.ref // .id // null) | select(. != null) | fnorm ]) as $lifecycle_finding_ids |
([ $root.findings[]? | (.fingerprint // null) | select(. != null) ]) as $lifecycle_fingerprints |
([ $fix_log_match.invocation_id // null, $fix_log_match.id // null ] | map(select(. != null))) as $lifecycle_fix_ids |
([
  ($lifecycle_state.incidents // [])[]?
  | select(lifecycle_matches_current($review_id; $lifecycle_finding_ids; $lifecycle_fingerprints; $lifecycle_fix_ids))
  | project_lifecycle_incident
]) as $projected_lifecycle_incidents |
([ $projected_lifecycle_incidents[]?.id ]) as $lifecycle_incident_ids |
([
  ($lifecycle_state.problems // [])[]?
  | select(lifecycle_problem_matches_current($review_id; $lifecycle_incident_ids; $lifecycle_finding_ids; $lifecycle_fix_ids))
  | project_lifecycle_problem
]) as $projected_lifecycle_problems |
([ $projected_lifecycle_problems[]?.id ]) as $lifecycle_problem_ids |
([
  ($lifecycle_state.issues // [])[]?
  | select(lifecycle_issue_matches_current($review_id; $lifecycle_problem_ids; $lifecycle_incident_ids; $lifecycle_finding_ids; $lifecycle_fix_ids))
  | project_lifecycle_issue
]) as $projected_lifecycle_issues |
{
  schema_version: 2,
  review_id: $review_id,
  review_meta: {
    lens: ($root.lens // null),
    reviewers: ($root.reviewers // null),
    review_mode: ($root.review_mode // null),
    invoked_at: ($root.invoked_at // null),
    completed_at: ($root.completed_at // null),
    status: ($root.status // null)
  },
  provider_trust: ($root.provider_trust | object_or_null),
  review_scope: ($root.review_scope | object_or_null),
  plan_review: ($root.plan_review | object_or_null),
  review_prompt_profile: (
    ($root.review_prompt_profile | object_or_null) as $rpp |
    if $rpp == null then null
    # redaction_summary is sub-indexed (.redacted_values/.blocked_paths/.warnings), so it
    # needs the same guard one level down — the shape found in a real log on disk.
    else $rpp + { redaction_summary: ($rpp.redaction_summary | object_or_null) }
    end
  ),
  reviewer_evidence_packet: ($root.reviewer_evidence_packet | object_or_null),
  # Roster entries are themselves sub-indexed, so drop non-object entries too rather than
  # letting array_or_empty wrap a scalar into a one-element list the renderer would crash on.
  reviewer_roster: (
    ($root.reviewer_roster // []) |
    if type == "array" then map(select(type == "object")) else [] end
  ),
  findings: [
    $root.findings[]? |
    . as $source_finding |
    (($source_finding.ref // $source_finding.id // null) | fnorm) as $source_finding_norm |
    ($source_finding.fingerprint // null) as $source_finding_fingerprint |
    (
      $decisions
      | map(select(
          ((decision_key // "") | fnorm) == $source_finding_norm
          or (
            ($source_finding_fingerprint != null)
            and ((.finding_fingerprint // null) == $source_finding_fingerprint)
          )
        ))
      | first
    ) as $decision_match |
	    project_finding($root; $fix_log_match; $decision_match) | . + {
	      fix_plan: (if $fix_log_match != null then
	        . as $f
	        | (($fix_log_match.fix_plans // [])
	          | map(select((.finding_id // null) != null and (.finding_id | fnorm) == ($f.id | fnorm)))
	          | first
	        )
	      else null end),
	      verification_cycle: (if $fix_log_match != null then
	        . as $f
	        | (($fix_log_match.verification_cycles // [])
	          | map(select((.finding_id // null) != null and (.finding_id | fnorm) == ($f.id | fnorm)))
	          | first
	        )
	      else null end),
	      resolution: (if $fix_log_match != null then
        . as $f
        | ($fix_log_match.findings_addressed // []) as $fa |
        # Slug-aware + zero-pad-aware change_summary lookup: try exact finding_id first,
        # then try normalized form (strips slug suffix + leading zeros).
        ( ($fix_log_match.changes_summary // [])
          | map(select(.finding_id == $f.id
                       or (.finding_id | fnorm) == ($f.id | fnorm)))
          | first
        ) as $cs
        | ( ($fix_log_match.final_dispositions // [])
          | map(select((.finding_id // null) != null and .finding_id == $f.id))
          | first
        ) as $fd_exact
        | ( ($fix_log_match.final_dispositions // [])
          | map(select((.finding_id // null) != null and (.finding_id | fnorm) == ($f.id | fnorm)))
          | first
        ) as $fd_normalized
        | ($fd_exact // $fd_normalized) as $fd
        | {
            addressed: is_addressed($f.id; $fa),
            fix_invocation_id: $fix_log_match.invocation_id,
            cycle_status: $fix_log_match.status,
            final_disposition: ($fd // null),
            fix_outcome: ($cs.fix_outcome // null),
            change_summary: ($cs.change // null),
            root_cause: ($cs.root_cause // null),
            files_modified: $f.files_modified
          }
      elif $fix_dir_given and $review_id != null and (($root.fix_invocation_id // null) != null) then
        {
          status: "unlinked",
          addressed: false,
          fix_invocation_id: null,
          cycle_status: null,
          change_summary: null,
          root_cause: null,
          files_modified: null
        }
      else null end),
      wont_fix: (
        if (.fingerprint // null) != null then
          .fingerprint as $fp
          | ((if ($wf_registry | type) == "object" then $wf_registry.entries else $wf_registry end) | map(select(.fingerprint == $fp or ((.matching_fingerprints // []) | index($fp) != null))) | first) as $match
          | (if $match != null then
              ($match | del(.matching_fingerprints)) + { recurring_in_current_review: true }
            else null end)
        else null end
      ),
      calibration: null
    }
  ],
  lifecycle: {
    incidents: $projected_lifecycle_incidents,
    problems: $projected_lifecycle_problems,
    issues: $projected_lifecycle_issues,
    loader_warnings: ($lifecycle_state.loader_warnings // [])
  },
  loader_warnings: (
    [ $root.findings[]? | warnings_for_finding($INPUT_FILE_PATH) | .[] ]
    + (if ($fix_dir_given and $fix_log_match == null and $review_id != null and (($root.fix_invocation_id // null) != null)) then
        [{ file: $INPUT_FILE_PATH, kind: "fix_log_unjoinable",
           detail: "no fix-log references this review_id" }]
      else [] end)
    + (if $fix_log_match != null then
        # Emit addressed_unjoinable_id_shape when no finding ids overlap after normalization
        ([$root.findings[]? | (.ref // .id // null) | select(. != null) | fnorm] | unique) as $review_norms |
        (($fix_log_match.findings_addressed // []) | map(select(. != null) | fnorm) | unique) as $fix_norms |
        (if ($review_norms | length) > 0 and ($fix_norms | length) > 0
             and ([$review_norms[] | select(IN($fix_norms[]))] | length) == 0
         then
           [{ file: $INPUT_FILE_PATH, kind: "addressed_unjoinable_id_shape",
              detail: "finding ids and fix-log findings_addressed have no overlap after normalization (slug-strip + zero-pad)" }]
         else [] end)
      else [] end)
    + [{ file: $INPUT_FILE_PATH, kind: "calibration_skipped_deferred",
         detail: "calibration join deferred per Sigil #4" }]
    + [ ($root.provider_trust           | shape_warning("provider_trust"; "object"; $review_id; $INPUT_FILE_PATH)),
        ($root.review_scope             | shape_warning("review_scope"; "object"; $review_id; $INPUT_FILE_PATH)),
        ($root.plan_review              | shape_warning("plan_review"; "object"; $review_id; $INPUT_FILE_PATH)),
        ($root.review_prompt_profile    | shape_warning("review_prompt_profile"; "object"; $review_id; $INPUT_FILE_PATH)),
        (($root.review_prompt_profile | object_or_null | . // {}).redaction_summary
                                        | shape_warning("review_prompt_profile.redaction_summary"; "object"; $review_id; $INPUT_FILE_PATH)),
        ($root.reviewer_evidence_packet | shape_warning("reviewer_evidence_packet"; "object"; $review_id; $INPUT_FILE_PATH)),
        ($root.reviewer_roster          | shape_warning("reviewer_roster"; "array"; $review_id; $INPUT_FILE_PATH)),
        (if (($root.reviewer_roster | type) == "array")
            and (($root.reviewer_roster | length) != ($root.reviewer_roster | map(select(type == "object")) | length))
         then { file: $INPUT_FILE_PATH, kind: "field_shape_coerced",
                detail: ("reviewer_roster dropped "
                         + ((($root.reviewer_roster | length)
                             - ($root.reviewer_roster | map(select(type == "object")) | length)) | tostring)
                         + " non-object entries: " + ($review_id // "unknown" | tostring)) }
         else empty end) ]
    + ($decisions_state.loader_warnings // [])
  )
}
' "$INPUT_FILE" || {
  rc=$?
  echo "view-loader: jq failed to process '$INPUT_FILE' (exit $rc); source file may be malformed JSON" >&2
  exit 65
}
