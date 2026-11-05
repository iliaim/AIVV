#!/usr/bin/env bash
# skills/aivv-view/scripts/view-html.sh — Phase 2 static HTML renderer (v1a)
#
# Produces a self-contained single-file HTML report from one review's canonical
# envelope (Phase 0 loader output, humanized). All finding data is HTML-escaped
# via jq's @html filter; the output is XSS-safe even for code-snippet summaries.
#
# v1a IA (design record in the project's author-side docs, not shipped):
#   - Sticky <header> with meta row + filter row (search + severity chip-toggles
#     + decisions-only + hide-addressed/verified)
#   - <main> with <details id="decisions-summary"> (aria-hidden when count==0),
#     heads-up block, severity-grouped <section>s containing progressive
#     <details class="card"> per finding (header always-visible + expanded body)
#   - <footer> with generator + version
#
# Called by view.sh with a resolved --file path; also usable standalone:
#   bash view-html.sh --file .aivv/state/review-<id>.json [--fix-dir .aivv/state] \
#                     [--wont-fix .aivv/state/wont-fix-registry.json] [--output report.html]
set -euo pipefail
umask 077
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

TEMPLATES_DIR="$SCRIPT_DIR/../templates"
FIX_DIR=""
WONT_FIX=""
REVIEW_FILE=""
OUTPUT=""  # empty = stdout
BACK_HREF=""
BACK_LABEL="Findings Browser"
ACTION_ENDPOINT=""
ACTION_TOKEN=""
VIEWER_VERSION="0.2.0"

while [ $# -gt 0 ]; do
  case "$1" in
    --file)      REVIEW_FILE="$2"; shift 2 ;;
    --fix-dir)   FIX_DIR="$2";     shift 2 ;;
    --wont-fix)  WONT_FIX="$2";    shift 2 ;;
    --output|-o) OUTPUT="$2";      shift 2 ;;
    --back-href) BACK_HREF="$2";   shift 2 ;;
    --back-label) BACK_LABEL="$2"; shift 2 ;;
    --action-endpoint) ACTION_ENDPOINT="$2"; shift 2 ;;
    --action-token) ACTION_TOKEN="$2"; shift 2 ;;
    --*) echo "view-html: unknown flag '$1'" >&2; exit 64 ;;
    *) echo "view-html: unexpected argument '$1'" >&2; exit 64 ;;
  esac
done

[ -z "$REVIEW_FILE" ] && { echo "view-html: --file is required" >&2; exit 64; }
[ -z "$FIX_DIR" ] && FIX_DIR="$(aivv_view_state_for_review "$REVIEW_FILE")"
[ -z "$WONT_FIX" ] && WONT_FIX="$FIX_DIR/wont-fix-registry.json"
if [ -n "$ACTION_ENDPOINT" ] || [ -n "$ACTION_TOKEN" ]; then
  [[ "$ACTION_ENDPOINT" =~ ^http://127\.0\.0\.1:[0-9]+/v1/remediation-requests$ ]] \
    || { echo "view-html: --action-endpoint must be a loopback Action Inbox endpoint" >&2; exit 64; }
  [[ "$ACTION_TOKEN" =~ ^[0-9a-f]{64}$ ]] \
    || { echo "view-html: --action-token must be a 32-byte hexadecimal capability" >&2; exit 64; }
fi

require_jq

# ── Load canonical envelope (loader + humanize pipeline) ────────────────────
envelope=$(bash "$SCRIPT_DIR/view-loader.sh" \
  --file "$REVIEW_FILE" \
  --fix-dir "$FIX_DIR" \
  --wont-fix "$WONT_FIX" \
  | bash "$SCRIPT_DIR/humanize.sh")

history_notice=""
case "$REVIEW_FILE" in
  */.aivv/state/*|.aivv/state/*|*/.claude/sessions/*)
    history_notice='<p role="status">Historical project record. Import explicitly before continuation; this viewer preserves original files.</p>' ;;
esac

# ── Inline CSS and JS from templates ────────────────────────────────────────
# Keep source templates readable on disk, but compact embedded assets so large
# real-review reports stay within the viewer's single-file size budget.
compact_css() {
  perl -0pe 's@/\*.*?\*/@@gs' "$1" | sed -E '
    s/^[[:space:]]+//
    s/[[:space:]]+$//
    /^$/d
  ' | tr '\n' ' ' | sed -E 's/[[:space:]]+/ /g; s/[[:space:]]*([{}:;,>])[[:space:]]*/\1/g'
}

compact_js() {
  sed -E '
    s@^[[:space:]]*//.*$@@
    s/^[[:space:]]+//
    s/[[:space:]]+$//
    /^$/d
  ' "$1" | tr '\n' ' ' | sed -E 's/[[:space:]]+/ /g; s/[[:space:]]*([{}();,:=<>+-])[[:space:]]*/\1/g'
}

css=$(compact_css "$TEMPLATES_DIR/report.css")
js=$(compact_js "$TEMPLATES_DIR/report.js")

# ── Generate metadata block ──────────────────────────────────────────────────
meta_html=$(printf '%s' "$envelope" | jq -r '
  [
    "<span><strong>Lens:</strong> \(.review_meta.lens_label // "—" | @html)</span>",
    "<span><strong>Ran:</strong> \(.review_meta.ran_at_label // "—" | @html) · took \(.review_meta.duration_label // "—" | @html)</span>",
    "<span><strong>Reviewed by:</strong> \(.review_meta.review_mode_label // "—" | @html)</span>",
    "<span><strong>Review ID:</strong> \(.review_id // "—" | @html)</span>",
    (if (.provider_trust // null) != null then
      "<span><strong>Provider trust:</strong> \(.provider_trust.provider_trust_label // "—" | @html)</span>"
     else empty end)
  ] | join("\n")
')

# ── Generate severity chip-toggles (filter buttons, NOT anchor links) ───────
# Per spec §4.3 the chip row is a filter, not a TOC. data-severity is the JS
# hook (Task 12 wires the click handler); data-section is preserved as a stable
# section identifier for tests and future active-section behavior.
chips_html=$(printf '%s' "$envelope" | jq -r '
  def safe_sev: if IN("CRITICAL","MAJOR","MINOR","POLISH") then . else "MINOR" end;
  def sev_rank: {"CRITICAL":0,"MAJOR":1,"MINOR":2,"POLISH":3}[.] // 99;
  [.findings[]? | . as $finding | $finding + {_safe_severity: (($finding.severity // "MINOR") | safe_sev)}]
  | group_by(._safe_severity) | sort_by(.[0]._safe_severity | sev_rank)
  | map(
      .[0]._safe_severity as $sev |
      ($sev | ascii_downcase) as $token |
      "<button type=\"button\" " +
      "class=\"chip chip-toggle \($token)\" " +
      "data-severity=\"\($token)\" " +
      "data-section=\"\($token)\" " +
      "aria-pressed=\"true\">" +
      "\($sev | @html) <span>(\(length))</span>" +
      "</button>"
    )
  | join("\n")
')

# ── Decisions-summary container ─────────────────────────────────────────────
# The viewer remains read-only: controls only prepare a clipboard JSON payload
# for the user to paste into /aivv-fix or save as decisions-<review_id>.json.
action_inbox_enabled=false
[ -n "$ACTION_ENDPOINT" ] && action_inbox_enabled=true
decisions_html=$(printf '%s' "$envelope" | jq -r --argjson inbox "$action_inbox_enabled" '
  def actionable:
    (.evidence_state // "open") as $state |
    ($state | IN("verified_resolved", "wont_fix", "deferred") | not);
  ([.findings[]? | select(actionable)]) as $pending |
  ([.findings[]? | select((.decision // null) != null)]) as $captured |
  ($pending | length) as $count |
  ($captured | length) as $captured_count |
  "<details id=\"decisions-summary\" " +
  "class=\"decisions-summary\" " +
  "aria-hidden=\"\(if $count == 0 then "true" else "false" end)\"" +
  (if $count == 0 then " hidden" else "" end) + ">" +
  "<summary><strong>\($count)</strong> decision\(if $count == 1 then "" else "s" end) pending your call" +
  (if $captured_count > 0 then " · <strong>\($captured_count)</strong> captured" else "" end) +
  "</summary>" +
  "<div class=\"decisions-body\">" +
  (if $inbox then
    "<p>Select the findings to remediate, review their scope, then queue one batch for an eligible AIVV agent.</p>" +
    "<div id=\"batch-action-bar\" class=\"batch-action-bar\" hidden aria-live=\"polite\">" +
      "<span id=\"batch-selection-count\">0 findings selected</span>" +
      "<button type=\"button\" class=\"primary-action-btn\" id=\"queue-remediation\" disabled>Review and remediate selected</button>" +
    "</div>" +
    "<div id=\"action-handoff\" class=\"action-handoff\" hidden aria-live=\"polite\">" +
      "<strong>Batch queued.</strong> Copy this handoff into an eligible AIVV agent: <code id=\"action-handoff-command\"></code>" +
      "<button type=\"button\" class=\"clipboard-btn\" id=\"copy-action-handoff\">Copy handoff</button>" +
    "</div>" +
    "<p class=\"manual-handoff\">If the Inbox is unavailable, copy decisions JSON, provide it to <code>/aivv-fix --resolve \(.review_id // "" | @html)</code> for validation and external persistence.</p>"
   else
    "<p>Select outcomes on finding cards, then copy the handoff payload for <code>/aivv-fix --resolve \(.review_id // "" | @html)</code>.</p>"
   end) +
  "<button type=\"button\" class=\"clipboard-btn\" id=\"copy-decisions\" data-review-id=\"\(.review_id // "" | @html)\">Copy decisions JSON</button>" +
  "<pre id=\"decisions-preview\" class=\"decisions-preview\" aria-live=\"polite\"></pre>" +
  "</div>" +
  "</details>"
')

# ── Generate anomalous-warnings block (hidden when empty) ───────────────────
warnings_html=$(printf '%s' "$envelope" | jq -r '
  if (.loader_warnings_anomalous | length) > 0 then
    "<div class=\"heads-up\" role=\"note\">" +
    "<div class=\"heads-up-title\">Heads up</div>" +
    "<ul>" +
    ([.loader_warnings_anomalous[] | "<li>\(.sentence | @html)</li>"] | join("")) +
    "</ul></div>"
  else "" end
')

# ── Generate persisted review audit context panels ─────────────────────────
review_scope_html=$(printf '%s' "$envelope" | jq -r '
  if (.review_scope // null) == null and (.plan_review // null) == null then
    "<section id=\"review-scope\" class=\"report-section review-scope\" aria-labelledby=\"review-scope-title\">" +
    "<h2 id=\"review-scope-title\">Review Scope</h2>" +
    "<p class=\"muted\">Review scope was not recorded by this AIVV version.</p>" +
    "</section>"
  else
    (.review_scope // {}) as $s |
    (.plan_review // null) as $p |
    "<section id=\"review-scope\" class=\"report-section review-scope\" aria-labelledby=\"review-scope-title\">" +
    "<h2 id=\"review-scope-title\">Review Scope</h2>" +
    (if ($s.final_scope // null) != null then "<p>\($s.final_scope | @html)</p>" else "" end) +
    "<dl class=\"context-grid\">" +
      (if ($s.subject_type // null) != null then "<div><dt>Subject</dt><dd>\($s.subject_type | @html)</dd></div>" else "" end) +
      (if ($p.plan_path // null) != null then "<div><dt>Plan</dt><dd><code>\($p.plan_path | @html)</code></dd></div>" else "" end) +
      (if (($p // {}) | has("implementation_verified")) then "<div><dt>Implementation verified</dt><dd>\(if $p.implementation_verified then "Yes" else "No" end)</dd></div>" else "" end) +
      (if ($p.verify_skip_reason // null) != null then "<div><dt>Verification note</dt><dd>\($p.verify_skip_reason | @html)</dd></div>" else "" end) +
      (if ($s.target_project // null) != null then "<div><dt>Project</dt><dd><code>\($s.target_project | @html)</code></dd></div>" else "" end) +
      (if ($s.state_target // null) != null then "<div><dt>State target</dt><dd><code>\($s.state_target | @html)</code></dd></div>" else "" end) +
      (if (($s.included_files // []) | length) > 0 then "<div><dt>Included files</dt><dd>\(($s.included_files // []) | map("<code>\(. | @html)</code>") | join(", "))</dd></div>" else "" end) +
      (if (($s.excluded_or_dropped_scope // []) | length) > 0 then "<div><dt>Dropped scope</dt><dd>\(($s.excluded_or_dropped_scope // []) | map(. | @html) | join(", "))</dd></div>" else "" end) +
      (if ($s.scope_confirmation // null) != null then "<div><dt>Confirmation</dt><dd>\($s.scope_confirmation | @html)</dd></div>" else "" end) +
    "</dl>" +
    (if (($s.evidence_sources // []) | length) > 0 then
      "<h3>Evidence sources</h3><ul class=\"context-list\">" +
      (($s.evidence_sources // []) | map(
        "<li><strong>\(.kind // "source" | @html)</strong>: \(.summary // "" | @html)" +
        (if (.ref // null) != null then " <code>\(.ref | @html)</code>" else "" end) +
        "</li>"
      ) | join("")) +
      "</ul>"
    else "" end) +
    "</section>"
  end
')

prompt_evidence_html=$(printf '%s' "$envelope" | jq -r '
  if (.review_prompt_profile // null) == null and (.reviewer_evidence_packet // null) == null then ""
  else
    (.review_prompt_profile // {}) as $p |
    (.reviewer_evidence_packet // {}) as $e |
    "<section id=\"prompt-evidence\" class=\"report-section prompt-evidence\" aria-labelledby=\"prompt-evidence-title\">" +
    "<h2 id=\"prompt-evidence-title\">Prompt &amp; Evidence</h2>" +
    "<dl class=\"context-grid\">" +
      (if ($p.prompt_name // null) != null then "<div><dt>Prompt</dt><dd>\($p.prompt_name | @html)</dd></div>" else "" end) +
      (if ($p.prompt_version // null) != null then "<div><dt>Prompt version</dt><dd>\($p.prompt_version | @html)</dd></div>" else "" end) +
      (if ($p.prompt_sha256 // null) != null then "<div><dt>Prompt hash</dt><dd><code>\($p.prompt_sha256 | @html)</code></dd></div>" else "" end) +
      (if ($p.methodology_sha256 // null) != null then "<div><dt>Methodology hash</dt><dd><code>\($p.methodology_sha256 | @html)</code></dd></div>" else "" end) +
      (if ($p.lens // null) != null then "<div><dt>Lens</dt><dd>\($p.lens | @html)</dd></div>" else "" end) +
      (if ($p.thoroughness // null) != null then "<div><dt>Thoroughness</dt><dd>\($p.thoroughness | @html)</dd></div>" else "" end) +
      (if ($p.full_prompt_available // null) != null then "<div><dt>Full prompt</dt><dd>\(if $p.full_prompt_available then "Available" else "Not persisted" end)</dd></div>" else "" end) +
      (if ($p.redaction_summary // null) != null then "<div><dt>Prompt redactions</dt><dd>\(($p.redaction_summary.redacted_values // 0) | tostring | @html) values, \((($p.redaction_summary.blocked_paths // []) | length) | tostring | @html) blocked paths, \((($p.redaction_summary.warnings // []) | length) | tostring | @html) warnings</dd></div>" else "" end) +
      (if ($e.packet_name // null) != null then "<div><dt>Evidence packet</dt><dd>\($e.packet_name | @html)</dd></div>" else "" end) +
      (if ($e.format // null) != null then "<div><dt>Evidence format</dt><dd>\($e.format | @html)</dd></div>" else "" end) +
      (if ($e.sha256 // null) != null then "<div><dt>Evidence hash</dt><dd><code>\($e.sha256 | @html)</code></dd></div>" else "" end) +
      (if ($e.bytes // null) != null then "<div><dt>Evidence bytes</dt><dd>\($e.bytes | tostring | @html)</dd></div>" else "" end) +
      (if ($e | has("redacted")) then "<div><dt>Evidence redacted</dt><dd>\(if $e.redacted then "Yes" else "No" end)</dd></div>" else "" end) +
      (if ($e | has("truncated")) then "<div><dt>Evidence truncated</dt><dd>\(if $e.truncated then "Yes" else "No" end)</dd></div>" else "" end) +
      (if ($e.omitted_reason // null) != null then "<div><dt>Evidence omission</dt><dd>\($e.omitted_reason | @html)</dd></div>" else "" end) +
    "</dl>" +
    (if ($p.prompt_excerpt // null) != null then "<h3>Prompt excerpt</h3><pre>\($p.prompt_excerpt | @html)</pre>" else "" end) +
    (if ($e.content // null) != null then "<h3>Evidence content</h3><pre>\($e.content | @html)</pre>"
     elif ($e.content_excerpt // null) != null then "<h3>Evidence excerpt</h3><pre>\($e.content_excerpt | @html)</pre>"
     else "" end) +
    "</section>"
  end
')

reviewer_roster_html=$(printf '%s' "$envelope" | jq -r '
  if ((.reviewer_roster // []) | length) == 0 then ""
  else
    "<section id=\"reviewer-roster\" class=\"report-section reviewer-roster\" aria-labelledby=\"reviewer-roster-title\">" +
    "<h2 id=\"reviewer-roster-title\">Reviewer Roster</h2>" +
    "<ul class=\"roster-list\">" +
    ((.reviewer_roster // []) | map(
      "<li class=\"roster-item\">" +
      "<div class=\"roster-head\"><strong>\(.display_name // .label // "Reviewer" | @html)</strong>" +
      (if (.status // null) != null then "<span class=\"lifecycle-badge\">\(.status | @html)</span>" else "" end) +
      "</div>" +
      "<div class=\"roster-meta\">" +
      (if (.lens_label // .lens // null) != null then "\(.lens_label // .lens | @html)" else "Lens unknown" end) +
      (if (.dispatch_path // null) != null then " · \(.dispatch_path | @html)" else "" end) +
      (if (.provider // null) != null then " · \(.provider | @html)" else "" end) +
      (if (.model // null) != null then " · <code>\(.model | @html)</code>" else "" end) +
      (if (.model_source // null) != null then " · \(.model_source | @html)" else "" end) +
      (if (.status_reason // null) != null then " · \(.status_reason | @html)" else "" end) +
      "</div>" +
      (if ((.finding_refs // []) | length) > 0 then "<div class=\"roster-refs\">Findings: \((.finding_refs // []) | map("<code>\(. | @html)</code>") | join(", "))</div>" else "" end) +
      "</li>"
    ) | join("")) +
    "</ul></section>"
  end
')

# ── Generate incident lifecycle panel (hidden when no linked incidents) ──────
lifecycle_html=$(printf '%s' "$envelope" | jq -r '
  if ((.lifecycle.incidents // []) | length) == 0 then ""
  else
    "<section id=\"incident-lifecycle\" class=\"report-section incident-lifecycle\" aria-labelledby=\"incident-lifecycle-title\">" +
    "<h2 id=\"incident-lifecycle-title\">Incident Lifecycle</h2>" +
    "<ul class=\"incident-list\">" +
    ([.lifecycle.incidents[] |
      (.occurrence_count // 0) as $occurrence_count |
      "<li class=\"incident-item\">" +
      "<div class=\"incident-head\">" +
      "<strong>\(.summary // "Incident recorded" | @html)</strong>" +
      "<span class=\"incident-badge\">\(.severity_label // .severity // "unknown" | @html)</span>" +
      "<span class=\"incident-badge\">\(.status_label // .status // "unknown" | @html)</span>" +
      "</div>" +
      "<div class=\"incident-meta\">" +
      "<code>\(.id // "unknown" | @html)</code>" +
      " · \(.rca_status_label // .rca_status // "RCA status unknown" | @html)" +
      " · \(.closure_profile_label // .closure_profile // "Closure profile unknown" | @html)" +
      " · \($occurrence_count | tostring | @html) occurrence\(if $occurrence_count == 1 then "" else "s" end)" +
      "</div>" +
      "</li>"
    ] | join("")) +
    "</ul></section>"
  end
')

# ── Generate problem lifecycle panel (hidden when no linked problems) ───────
problem_lifecycle_html=$(printf '%s' "$envelope" | jq -r '
  if ((.lifecycle.problems // []) | length) == 0 then ""
  else
    "<section id=\"problem-lifecycle\" class=\"report-section problem-lifecycle\" aria-labelledby=\"problem-lifecycle-title\">" +
    "<h2 id=\"problem-lifecycle-title\">Problem Lifecycle</h2>" +
    "<ul class=\"lifecycle-list\">" +
    ([.lifecycle.problems[] |
      (.recurrence_keys // [] | length) as $recurrence_count |
      (.incident_ids // [] | length) as $incident_count |
      (.retire_when // [] | length) as $retire_count |
      (.evidence_count // 0) as $evidence_count |
      "<li class=\"lifecycle-item\">" +
      "<div class=\"lifecycle-head\">" +
      "<strong>\(.summary // "Problem recorded" | @html)</strong>" +
      "<span class=\"lifecycle-badge\">\(.status_label // .status // "unknown" | @html)</span>" +
      "<span class=\"lifecycle-badge\">\(.rca_status_label // .rca_status // "RCA status unknown" | @html)</span>" +
      "</div>" +
      "<div class=\"lifecycle-meta\">" +
      "<code>\(.id // "unknown" | @html)</code>" +
      " · \($recurrence_count | tostring | @html) recurrence key\(if $recurrence_count == 1 then "" else "s" end)" +
      " · \($incident_count | tostring | @html) linked incident\(if $incident_count == 1 then "" else "s" end)" +
      " · \($evidence_count | tostring | @html) evidence item\(if $evidence_count == 1 then "" else "s" end)" +
      " · \($retire_count | tostring | @html) retire-when \(if $retire_count == 1 then "criterion" else "criteria" end)" +
      "</div>" +
      "</li>"
    ] | join("")) +
    "</ul></section>"
  end
')

# ── Generate local issue lifecycle panel (hidden when no linked issues) ─────
issue_lifecycle_html=$(printf '%s' "$envelope" | jq -r '
  if ((.lifecycle.issues // []) | length) == 0 then ""
  else
    "<section id=\"issue-lifecycle\" class=\"report-section issue-lifecycle\" aria-labelledby=\"issue-lifecycle-title\">" +
    "<h2 id=\"issue-lifecycle-title\">Local Issue Mirrors</h2>" +
    "<ul class=\"lifecycle-list\">" +
    ([.lifecycle.issues[] |
      (.acceptance_criteria // [] | length) as $acceptance_count |
      (.closure_criteria // [] | length) as $closure_count |
      (.evidence_count // 0) as $evidence_count |
      (.labels // [] | join(", ")) as $labels |
      "<li class=\"lifecycle-item\">" +
      "<div class=\"lifecycle-head\">" +
      "<strong>\(.title // "Local issue recorded" | @html)</strong>" +
      "<span class=\"lifecycle-badge\">\(.status_label // .status // "unknown" | @html)</span>" +
      "<span class=\"lifecycle-badge\">\(.sync_status_label // .sync_status // "Local only" | @html)</span>" +
      "</div>" +
      "<div class=\"lifecycle-meta\">" +
      "<code>\(.id // "unknown" | @html)</code>" +
      (if (.external_id // null) != null then " · <code>\(.external_id | @html)</code>" else "" end) +
      (if (.owner // null) != null then " · Owner: \(.owner | @html)" else "" end) +
      (if $labels != "" then " · Labels: \($labels | @html)" else "" end) +
      " · \($acceptance_count | tostring | @html) acceptance \(if $acceptance_count == 1 then "criterion" else "criteria" end)" +
      " · \($closure_count | tostring | @html) closure \(if $closure_count == 1 then "criterion" else "criteria" end)" +
      " · \($evidence_count | tostring | @html) evidence item\(if $evidence_count == 1 then "" else "s" end)" +
      "</div>" +
      "</li>"
    ] | join("")) +
    "</ul></section>"
  end
')

# ── Generate explicit zero-findings state (shown only for clean reviews) ─────
empty_state_html=$(printf '%s' "$envelope" | jq -r '
  if (.findings | length) == 0 then
    ((.loader_warnings_anomalous // []) | length) as $warning_count |
    "<section class=\"empty-state\" aria-labelledby=\"empty-state-title\">" +
    "<h2 id=\"empty-state-title\">No findings</h2>" +
    "<p>" +
    (if $warning_count == 0 then
      "This review completed cleanly. There are no CRITICAL, MAJOR, MINOR, or POLISH findings to show."
     else
      "There are no CRITICAL, MAJOR, MINOR, or POLISH findings to show. Review the heads-up note above before treating this run as clean."
     end) +
    "</p>" +
    "</section>"
  else "" end
')

# ── Generate per-finding progressive cards + severity sections ──────────────
# Per spec §4.2:
#   Header (always visible): arrow + severity badge + F-ID primary badge +
#     outlined review-ref badge (conditional) + multi-model agreement chip
#     (conditional) + status chip + decision-pending dot + h4 summary + dim
#     subtitle row (file:L<anchors> · {n} reviewers · {n} files).
#   Expanded body: compact issue metadata, Reviewers when attribution exists,
#     Devil's Advocate, Root cause, Fix applied, Files modified, and Sources.
#   The always-visible header is the issue summary; the expanded body avoids
#   duplicating it for every card so large real-review reports remain portable.
#
# data-severity and data-resolution are filter-toggle hooks; text search reads
# visible card text so the renderer does not duplicate hidden search payloads.
#
# All user-supplied data passes through @html.
findings_html=$(printf '%s' "$envelope" | jq -r --argjson inbox "$action_inbox_enabled" '
  def sev_rank: {"CRITICAL":0,"MAJOR":1,"MINOR":2,"POLISH":3}[.] // 99;
  def safe_sev: if IN("CRITICAL","MAJOR","MINOR","POLISH") then . else "MINOR" end;
  def sev_lc: safe_sev | ascii_downcase;
  def esc: . // "" | @html;

  # Plain-key/value field with HTML-escaped value.
  def field(lbl; v):
    if v != null and v != "" then
      "<div class=\"field\"><span class=\"field-label\">" + lbl + "</span>" +
      "<span class=\"field-value\">" + (v | @html) + "</span></div>"
    else "" end;

  def resolution_state($f): ($f.evidence_state // "open");
  def actionable($f):
    (resolution_state($f)) as $state |
    ($state | IN("verified_resolved", "wont_fix", "deferred") | not);

  def anchor_id:
    "finding-" + ((._anchor_base // "unknown") | tostring | gsub("[^A-Za-z0-9_-]"; "-"));

  [
    .findings | to_entries[] |
    (.value.f_id_display.primary // .value.id // "unknown") as $base |
    .value + {
      _safe_severity: ((.value.severity // "MINOR") | safe_sev),
      _anchor_base: (if ($base | tostring) == "unknown" then "unknown-\(.key + 1)" else $base end)
    }
  ] |
  group_by(._safe_severity) | sort_by(.[0]._safe_severity | sev_rank) |
  map(
    . as $group |
    .[0]._safe_severity as $sev |
    ($sev | sev_lc) as $sev_token |
    "<section id=\"\($sev_token)\" data-severity-section=\"\($sev_token)\">" +
    "<h2 class=\"\($sev_token)\">" +
      "\($sev | @html) " +
      "<span class=\"sev-desc\">\(.[0].severity_desc | esc)</span> " +
    "</h2>" +
    (
      $group | map(
        . as $f |
        resolution_state($f) as $resolution_state |
        "<details id=\"\($f | anchor_id)\" class=\"card sev-\($sev_token)\" " +
          "data-severity=\"\($sev_token)\" " +
          "data-resolution=\"\($resolution_state)\" " +
          "data-finding-id=\"\($f.id // "" | @html)\" " +
          "data-fingerprint=\"\($f.fingerprint // "" | @html)\" " +
          "data-has-decision=\"\(if ($f.decision // null) != null then "true" else "false" end)\">" +
        # ─── Header (always visible) ───────────────────────────────────────
        "<summary class=\"card-header\">" +
          "<span class=\"arrow\" aria-hidden=\"true\">▶</span>" +
          "<span class=\"card-badges\">" +
          "<span class=\"sev-badge \($sev_token)\">\($sev | @html)</span>" +
          # Primary F-ID badge — fbadge class (solid color)
          "<span class=\"fbadge fbadge-primary sev-\($sev_token)\">" +
            "\($f.f_id_display.primary // $f.id // "" | @html)" +
          "</span>" +
          # Outlined review-ref badge — only when distinct from primary
          (if ($f.f_id_display.review_ref // null) != null then
            "<span class=\"fbadge fbadge-outline\">" +
              "\($f.f_id_display.review_ref | @html)" +
            "</span>"
          else "" end) +
          # Multi-model agreement chip — only when count >= 2
          (if ($f.multi_model_agreement_label // null) != null then
            "<span class=\"chip chip-agreement agreement agreement-\($f.agreement_diversity // "any" | @html)\">" +
              "\($f.multi_model_agreement_label | @html)" +
            "</span>"
          else "" end) +
          # Status chip
          "<span class=\"chip status status-\($resolution_state)\">" +
            "\($f.status_label // "Open" | @html)" +
          "</span>" +
          # Recurring chip (when applicable)
          (if ($f.wont_fix_label // null) != null then
            (if ($resolution_state | IN("addressed_unverified", "verified_resolved")) then
              "<span class=\"chip recurring\">Previously dismissed; now \($f.status_label | ascii_downcase | @html)</span>"
            else
              "<span class=\"chip recurring\">\($f.wont_fix_label | @html)</span>"
            end)
          else "" end) +
          (if ($f.decision_label // null) != null then
            "<span class=\"chip decision-chip\">\($f.decision_label | @html)</span>"
          elif actionable($f) then
            "<span class=\"decision-dot\" aria-label=\"Decision pending\"></span>"
          else "" end) +
          "</span>" +
          "<h3 class=\"card-summary\">\($f.summary | esc)</h3>" +
          # Dim subtitle row
          "<div class=\"card-subtitle\">" +
            (if ($f.location_label // $f.file // null) != null then
              "<span class=\"sub-file\"><code>\($f.location_label // $f.file | @html)" +
              (if ($f.file // null) != null and ($f.line_anchors_label // null) != null then
                ":\($f.line_anchors_label | @html)"
              elif ($f.file // null) != null and ($f.line // null) != null then
                ":\($f.line | tostring | @html)"
              else "" end) +
              "</code></span>"
            else "" end) +
            (if ($f.reviewer_attribution // null) != null and ($f.reviewer_attribution | type) == "array" then
              " · <span class=\"sub-reviewers\">\($f.reviewer_attribution | length) reviewer\(if length == 1 then "" else "s" end)</span>"
            else "" end) +
            (if ($f.files_modified_label // null) != null then
              " · <span class=\"sub-files-modified\">\($f.files_modified_label | @html)</span>"
            else "" end) +
          "</div>" +
        "</summary>" +
        # ─── Expanded body ─────────────────────────────────────────────────
        "<div class=\"card-body\">" +
          # 1. Issue metadata — keep details without duplicating the summary.
          (if (($f.category // null) != null) or (($f.confidence // null) != null) or (($f.rule_id // null) != null) or (($f.location_label // $f.file // null) != null) then
            "<section class=\"issue\">" +
              "<h4>Issue details</h4>" +
              (field("Category:";  $f.category)) +
              (field("Confidence:"; $f.confidence)) +
              (field("Rule:";       $f.rule_id)) +
              (if ($f.location_label // $f.file // null) != null then
                "<div class=\"field\"><span class=\"field-label\">\(if ($f.file // null) != null then "File:" else "Location:" end)</span>" +
                "<span class=\"field-value\"><code>\($f.location_label // $f.file | @html)" +
                (if ($f.file // null) != null and ($f.line_anchors_label // null) != null then ":\($f.line_anchors_label | @html)"
                 elif ($f.file // null) != null and ($f.line // null) != null then ":\($f.line | tostring | @html)"
                 else "" end) +
                "</code></span></div>"
              else "" end) +
            "</section>"
          else "" end) +
          # 1b. legacy-schema compatibility rules impact-likelihood metadata. These are raw reviewer axes,
          # preserved separately from the final severity badge.
          (if (($f.impact_tier // null) != null) or (($f.likelihood // null) != null) then
            "<section class=\"severity-model\">" +
              "<h4>Severity model</h4>" +
              (field("Impact tier:"; $f.impact_tier_label // $f.impact_tier)) +
              (field("Likelihood:";  $f.likelihood_label // $f.likelihood)) +
            "</section>"
          else "" end) +
          # 2. Reviewers — render only when attribution exists.
          (if ($f.reviewer_attribution // null) != null and ($f.reviewer_attribution | type) == "array" and ($f.reviewer_attribution | length) > 0 then
            "<section class=\"reviewers\">" +
              "<h4>Reviewers</h4>" +
              "<ul class=\"reviewer-list\">" +
              ($f.reviewer_attribution | map("<li><code>\(. | @html)</code></li>") | join("")) +
              "</ul>" +
            "</section>"
          elif ($f.reviewer_attribution_legacy_text // null) != null then
            "<section class=\"reviewers\">" +
              "<h4>Reviewers</h4>" +
              "<p class=\"reviewer-legacy\">\($f.reviewer_attribution_legacy_text | @html)</p>" +
            "</section>"
          else "" end) +
          # 3. Devil'\''s Advocate — only when signals present OR devils_advocate true
          (if (($f.devils_advocate_signals // null) != null and ($f.devils_advocate_signals | type) == "array" and ($f.devils_advocate_signals | length) > 0)
              or ($f.devils_advocate // false) then
            "<section class=\"da devils-advocate\" role=\"note\">" +
              "<h4>Devil'\''s Advocate</h4>" +
              (if ($f.devils_advocate_signals_label // null) != null then
                "<p class=\"da-label\">\($f.devils_advocate_signals_label | @html)</p>"
              else "" end) +
              (if ($f.devils_advocate_signals // null) != null and ($f.devils_advocate_signals | type) == "array" then
                "<ul class=\"da-signals\">" +
                ($f.devils_advocate_signals | map(
                  "<li>" +
                  (if .kind then "<span class=\"da-kind\">\(.kind | @html)</span>: " else "" end) +
                  "<span class=\"da-prose\">\(.prose // "" | @html)</span>" +
                  "</li>"
                ) | join("")) +
                "</ul>"
              else "" end) +
            "</section>"
          else "" end) +
          # 4. Fix lifecycle — keep proposed plans, applied changes, and verification distinct.
          (if (($f.fix_plan // null) != null) or (($f.verification_cycle // null) != null) or ($f.resolution != null) then
            "<section class=\"fix-lifecycle\">" +
              "<h4>Fix Lifecycle</h4>" +
              (if ($f.fix_plan // null) != null then
                "<div class=\"lifecycle-entry\">" +
                "<span class=\"lifecycle-label\">Plan</span>" +
                "<span class=\"lifecycle-value\">" +
                  (if ($f.fix_plan_status_label // null) != null then "<strong>\($f.fix_plan_status_label | @html)</strong>: " else "" end) +
                  "\($f.fix_plan.summary // $f.fix_plan.selected_approach // "Plan recorded" | @html)" +
                "</span></div>"
              else "" end) +
              (if $f.resolution and $f.resolution.change_summary then
                "<div class=\"lifecycle-entry\">" +
                "<span class=\"lifecycle-label\">Applied change</span>" +
                "<span class=\"lifecycle-value\">\($f.resolution.change_summary | @html)</span></div>"
              else "" end) +
              (if ($f.verification_cycle // null) != null then
                "<div class=\"lifecycle-entry\">" +
                "<span class=\"lifecycle-label\">Verification</span>" +
                "<span class=\"lifecycle-value\">" +
                  (if ($f.verification_cycle_status_label // null) != null then "<strong>\($f.verification_cycle_status_label | @html)</strong>" else "\($f.verification_cycle.status // "recorded" | @html)" end) +
                  (if ($f.verification_cycle.evidence // null) != null then ": \($f.verification_cycle.evidence | @html)" else "" end) +
                "</span></div>"
              else "" end) +
            "</section>"
          else "" end) +
          # 5. Root cause + 6. Fix applied (from resolution)
          (if $f.resolution then
            (if $f.resolution.root_cause then
              "<section class=\"root-cause\"><h4>Root cause</h4><p>\($f.resolution.root_cause | @html)</p></section>"
            else "" end) +
            (if $f.resolution.change_summary then
              "<section class=\"fix-applied\"><h4>Fix applied</h4><p>\($f.resolution.change_summary | @html)</p></section>"
            else "" end)
          else "" end) +
          # 6. Files modified
          (if ($f.files_modified // null) != null and ($f.files_modified | type) == "array" and ($f.files_modified | length) > 0 then
            "<section class=\"files-modified\">" +
              "<h4>Files modified (\($f.files_modified | length))</h4>" +
              "<ul class=\"file-list\">" +
              ($f.files_modified | map("<li><code>\(. | @html)</code></li>") | join("")) +
              "</ul>" +
            "</section>"
          else "" end) +
          # 6b. Runtime evidence ingested from a manifest-bound Playwright JSON run.
          (if ($f.runtime_evidence // null) != null then
            ($f.runtime_evidence) as $rt |
            "<section class=\"runtime-evidence\">" +
              "<h4>Runtime evidence</h4>" +
              (field("Outcome:"; $f.runtime_evidence_label // $rt.outcome)) +
              (field("Assertion polarity:"; $rt.assertion_polarity)) +
              (field("Spec:"; $rt.spec_path)) +
              (field("Result:"; $rt.result_path)) +
              (field("Message:"; $rt.assertion_message)) +
            "</section>"
          else "" end) +
          # 7. Reviewer recommendation. Open findings show it as active work;
          # fixed findings keep it as provenance in a collapsed audit trail.
          (if $f.suggested_action then
            if ($resolution_state | IN("addressed_unverified", "verified_resolved")) then
              "<details class=\"audit-trail\">" +
                "<summary>Audit trail</summary>" +
                "<h4>Original recommendation</h4>" +
                "<p>\($f.suggested_action | @html)</p>" +
              "</details>"
            else
              "<section class=\"suggested\"><h4>Suggested action</h4><p>\($f.suggested_action | @html)</p></section>"
            end
          else "" end) +
          # 7b. User decision capture. Static HTML only: JavaScript copies a JSON
          # payload; the viewer never writes decisions files.
          (if actionable($f) then
            "<section class=\"decision-capture\" data-decision-for=\"\($f.id // "" | @html)\">" +
              "<h4>Decision</h4>" +
              "<div class=\"decision-options\" role=\"radiogroup\" aria-label=\"Decision for \($f.id // "finding" | @html)\">" +
                (["fix","defer","wont_fix","needs_info"] | map(
                  . as $opt |
                  "<label class=\"decision-option\">" +
                  "<input type=\"radio\" name=\"decision-\($f.id // "finding" | @html)\" value=\"\($opt)\"" +
                  (if (($f.decision.decision // null) == $opt) then " checked" else "" end) +
                  "> <span>\({"fix":"Include in fix batch","defer":"Defer","wont_fix":"Won'\''t fix","needs_info":"Needs info"}[$opt])</span>" +
                  "</label>"
                ) | join("")) +
              "</div>" +
              "<label class=\"decision-notes\">Notes <textarea rows=\"2\" data-decision-notes=\"\($f.id // "" | @html)\">" +
                "\($f.decision.notes // "" | @html)" +
              "</textarea></label>" +
              (if $inbox then
                "<button type=\"button\" class=\"fix-only-btn\" data-finding-id=\"\($f.id // "" | @html)\">Fix only this finding</button>"
               else "" end) +
            "</section>"
          else "" end) +
          # 8. Improvement (legacy field, preserved)
          (if $f.improvement then
            "<section class=\"improvement\"><h4>Improvement</h4><p>\($f.improvement | @html)</p></section>"
          else "" end) +
          # 8b. legacy-schema compatibility rules improvement metadata. Only the enum values high/medium/low
          # are rendered as metadata; legacy prose `value` remains justification.
          (if (($f.value_label // null) != null) or (($f.effort // null) != null) then
            "<section class=\"improvement-metadata\">" +
              "<h4>Improvement metadata</h4>" +
              (field("Improvement value:"; $f.value_label)) +
              (field("Effort:"; $f.effort_label // $f.effort)) +
            "</section>"
          else "" end) +
          (if (($f.value // null) != null) and (($f.value_label // null) == null) then
            "<section class=\"value-justification\"><h4>Value justification</h4><p>\($f.value | @html)</p></section>"
          else "" end) +
          # 9. Sources
          (if ($f.grounded_by | length) > 0 then
            "<section class=\"sources\">" +
              "<h4>Sources</h4>" +
              "<ul class=\"source-list\">" +
              ($f.grounded_by | map(
                if type == "string" then
                  "<li>· <code>\(. | @html)</code></li>"
                else
                  "<li>· \(.source_type // "?" | @html): " +
                  (if (.source_ref // "") | test("^https?://") then
                    "<a href=\"\(.source_ref | @html)\" rel=\"noopener\">\(.source_ref | @html)</a>"
                  else
                    "\(.source_ref // "" | @html)"
                  end) +
                  (if .excerpt then " — \(.excerpt | if length > 80 then .[0:80] + "…" else . end | @html)" else "" end) +
                  "</li>"
                end
              ) | join("")) +
              "</ul>" +
            "</section>"
          else "" end) +
        "</div>" +
        "</details>"
      ) | join("\n")
    ) +
    "</section>"
  ) | join("\n")
')

# ── Page title from metadata ────────────────────────────────────────────────
page_title=$(printf '%s' "$envelope" | jq -r '
  "AIVV Review — \(.review_meta.lens_label // "—" | @html) · \(.findings | length) finding\(if (.findings|length)==1 then "" else "s" end) — \(.review_id // "—" | @html)"
')
header_title=$(printf '%s' "$envelope" | jq -r '
  "AIVV Review: \(.review_meta.lens_label // "—" | @html)"
')
back_link_html=""
if [ -n "$BACK_HREF" ]; then
  back_link_html=$(jq -nr --arg href "$BACK_HREF" --arg label "$BACK_LABEL" \
    '"<a class=\"back-link\" href=\"" + ($href|@html) + "\">← Back to " + ($label|@html) + "</a>"')
fi

# ── Visible-count seed (filter status; updated live by Task-12 JS) ──────────
total_findings=$(printf '%s' "$envelope" | jq -r '.findings | length')
action_attributes=""
if [ -n "$ACTION_ENDPOINT" ]; then
  # Both values passed the strict loopback / hexadecimal validators above, so no
  # user-provided HTML is interpolated into the local-only report configuration.
  action_attributes=" data-action-endpoint=\"$ACTION_ENDPOINT\" data-action-token=\"$ACTION_TOKEN\""
fi

# ── Assemble full HTML ───────────────────────────────────────────────────────
generate() {
cat <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${page_title}</title>
  <style>
${css}
  </style>
</head>
<body>
<a href="#main" class="skip-link">Skip to content</a>
<header class="sticky">
  ${back_link_html}
  <h1>${header_title}</h1>
  <div class="meta">
${meta_html}
  </div>
  <div class="filter-row" role="search" aria-label="Filter findings">
    <label class="search-label" for="search">
      <span class="sr-only">Search findings</span>
      <input type="search" id="search" name="search"
             placeholder="Search findings…"
             autocomplete="off" spellcheck="false"
             aria-label="Search findings">
    </label>
    <div class="chips" role="group" aria-label="Filter by severity">
${chips_html}
    </div>
    <div class="toggles">
      <label class="toggle-label">
        <input type="checkbox" id="decisions-only" name="decisions-only">
        <span>Decisions only</span>
      </label>
      <label class="toggle-label">
        <input type="checkbox" id="hide-resolved" name="hide-resolved">
        <span>Hide addressed / verified</span>
      </label>
    </div>
    <div id="a11y-live" class="visible-count" role="status" aria-live="polite" aria-atomic="true" data-total="${total_findings}">
      ${total_findings} findings shown
    </div>
  </div>
${history_notice}
</header>
<main id="main" data-severity-visible="all"${action_attributes}>
${decisions_html}
${warnings_html}
${review_scope_html}
${prompt_evidence_html}
${reviewer_roster_html}
${lifecycle_html}
${problem_lifecycle_html}
${issue_lifecycle_html}
${empty_state_html}
${findings_html}
</main>
<footer>Generated by AIVV Viewer · aivv-view ${VIEWER_VERSION}</footer>
<script>
${js}
</script>
</body>
</html>
HTML
}

# ── Write output ─────────────────────────────────────────────────────────────
if [ -n "$OUTPUT" ]; then
  generate > "$OUTPUT"
  echo "aivv view: report written to $OUTPUT" >&2
else
  generate
fi
