#!/usr/bin/env bash
# skills/aivv-view/scripts/view-browser.sh — static multi-cycle findings browser
#
# When --output is set, this writes the browser file plus a sibling reviews/
# directory containing linked single-review reports. Stdout mode remains a
# standalone index and shows commands for generating individual reports.
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

VIEW_HTML_SCRIPT="${AIVV_VIEW_HTML_SCRIPT:-$SCRIPT_DIR/view-html.sh}"
STATE_DIR=""
WONT_FIX=""
OUTPUT=""
VIEWER_VERSION="0.1.0-browser-dev"

while [ $# -gt 0 ]; do
  case "$1" in
    --state-dir) STATE_DIR="$2"; shift 2 ;;
    --wont-fix)  WONT_FIX="$2"; shift 2 ;;
    --output|-o) OUTPUT="$2"; shift 2 ;;
    --*) echo "view-browser: unknown flag '$1'" >&2; exit 64 ;;
    *) echo "view-browser: unexpected argument '$1'" >&2; exit 64 ;;
  esac
done

require_jq
if [ -z "$STATE_DIR" ]; then
  STATE_DIR="$(aivv_view_default_state)"
  export AIVV_VIEW_INCLUDE_HISTORY=history
fi

[ -z "$WONT_FIX" ] && WONT_FIX="$STATE_DIR/wont-fix-registry.json"
require_jq

tmpdir=$(mktemp -d)
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

summary_file="$tmpdir/summaries.ndjson"
: > "$summary_file"

short_error() {
  local file="$1"
  aivv_view_sanitized_error
}

error_envelope() {
  local review_file="$1" kind="$2" message="$3"
  local basename_file review_id
  basename_file="$(basename "$review_file")"
  review_id="$(printf '%s' "$basename_file" | sed -E 's/^review-//; s/\.json$//')"
  jq -n -c \
    --arg review_id "$review_id" \
    --arg file "$basename_file" \
    --arg kind "$kind" \
    --arg message "$message" \
    '{
      schema_version: 2,
      review_id: $review_id,
      review_meta: {lens: null, reviewers: null, review_mode: null, invoked_at: null, completed_at: null, status: "pipeline-error"},
      provider_trust: null,
      findings: [],
      loader_warnings: [{file: $file, kind: $kind, detail: $message}],
      loader_warnings_anomalous: [{file: $file, kind: $kind, detail: $message, sentence: ($kind + ": " + $message), count: 1}],
      browser_pipeline_error: $kind
    }'
}

add_pipeline_warning() {
  local envelope="$1" review_file="$2" kind="$3" message="$4"
  printf '%s' "$envelope" | jq -c \
    --arg file "$(basename "$review_file")" \
    --arg kind "$kind" \
    --arg message "$message" \
    '.loader_warnings = ((.loader_warnings // []) + [{file: $file, kind: $kind, detail: $message}])
     | .loader_warnings_anomalous = ((.loader_warnings_anomalous // []) + [{file: $file, kind: $kind, detail: $message, sentence: ($kind + ": " + $message), count: 1}])
     | .browser_pipeline_error = ((.browser_pipeline_error // null) // $kind)'
}

report_dir=""
if [ -n "$OUTPUT" ]; then
  mkdir -p "$(dirname "$OUTPUT")"
  report_dir="$(dirname "$OUTPUT")/reviews"
  mkdir -p "$report_dir"
fi

while IFS= read -r review_file; do
  review_state="$STATE_DIR"
  review_registry="$WONT_FIX"
  if [ "${AIVV_VIEW_INCLUDE_HISTORY:-}" = history ]; then
    review_state="$(aivv_view_state_for_review "$review_file")"
    review_registry="$review_state/wont-fix-registry.json"
  fi
  err_file="$tmpdir/$(basename "$review_file").err"
  out_file="$tmpdir/$(basename "$review_file").out"
  if ! loader_output=$(bash "$SCRIPT_DIR/view-loader.sh" \
      --file "$review_file" \
      --fix-dir "$review_state" \
      --wont-fix "$review_registry" 2>"$err_file"); then
    envelope=$(error_envelope "$review_file" "loader_error" "$(short_error "$err_file")")
  elif ! envelope=$(printf '%s' "$loader_output" | bash "$SCRIPT_DIR/humanize.sh" 2>"$err_file"); then
    envelope=$(error_envelope "$review_file" "humanize_error" "$(short_error "$err_file")")
  fi

  review_id_for_link=$(printf '%s' "$envelope" | jq -r --arg file "$(basename "$review_file")" '.review_id // .id // ($file | sub("^review-"; "") | sub("\\.json$"; ""))')
  safe_review_file=$(printf '%s' "$review_id_for_link" | sed -E 's/[^A-Za-z0-9_.-]+/-/g')
  report_href=""
  if [ -n "$report_dir" ] && [ "$(printf '%s' "$envelope" | jq -r '.browser_pipeline_error // ""')" = "" ]; then
    report_path="$report_dir/review-${safe_review_file}.html"
    if bash "$VIEW_HTML_SCRIPT" \
        --file "$review_file" \
        --fix-dir "$review_state" \
        --wont-fix "$review_registry" \
        --back-href "../$(basename "$OUTPUT")" \
        --back-label "Findings Browser" \
        --output "$report_path" >"$out_file" 2>"$err_file"; then
      report_href="reviews/review-${safe_review_file}.html"
    else
      envelope=$(add_pipeline_warning "$envelope" "$review_file" "render_error" "$(short_error "$err_file")")
    fi
  fi

  printf '%s\n' "$envelope" | jq -c --arg file "$(basename "$review_file")" --arg report_href "$report_href" '
    def severity_count($sev): [.findings[]? | select(.severity == $sev)] | length;
    def evidence_state($f): ($f.evidence_state // "open");
    def state_count($state): [.findings[]? | select(evidence_state(.) == $state)] | length;
    {
      review_id: (.review_id // .id // ($file | sub("^review-"; "") | sub("\\.json$"; ""))),
      source_file: $file,
      report_href: (if $report_href == "" then null else $report_href end),
      invoked_at: (.review_meta.invoked_at // .invoked_at // null),
      ran_at_label: (.review_meta.ran_at_label // null),
      lens_label: (.review_meta.lens_label // (.review_meta.lens // .lens // null)),
      review_mode_label: (.review_meta.review_mode_label // null),
      status: (.status // null),
      finding_count: (.findings | length),
      open_count: state_count("open"),
      no_fix_session_count: state_count("no_fix_session"),
      fix_unjoinable_count: state_count("fix_unjoinable"),
      addressed_unverified_count: state_count("addressed_unverified"),
      verified_resolved_count: state_count("verified_resolved"),
      deferred_count: state_count("deferred"),
      wont_fix_count: state_count("wont_fix"),
      legacy_fixed_claim_count: state_count("legacy_fixed_claim"),
      critical_count: severity_count("CRITICAL"),
      major_count: severity_count("MAJOR"),
      minor_count: severity_count("MINOR"),
      polish_count: severity_count("POLISH"),
      warning_count: (.loader_warnings_anomalous | length),
      warning_kinds: ([.loader_warnings_anomalous[]?.kind] | unique),
      warning_group_labels: ([.loader_warning_groups[]? | (.group + ": " + (.count | tostring))]),
      warning_labels: (
        ([.loader_warning_groups[]? | (.group + ": " + (.count | tostring))]) +
        ([.loader_warnings_anomalous[]? | .sentence])
      ),
      findings_preview: [
        .findings | to_entries[]? |
        .key as $idx |
        .value |
        (.f_id_display.primary // .id // "unknown") as $base |
        {
          id: (.f_id_display.primary // .id // "—"),
          anchor: ("finding-" + ((if ($base | tostring) == "unknown" then "unknown-\($idx + 1)" else $base end) | tostring | gsub("[^A-Za-z0-9_-]"; "-"))),
          review_ref: (.f_id_display.review_ref // null),
          severity: (.severity // "MINOR"),
          status_label: (.status_label // "Open"),
          file: (.file // null),
          line_label: (.line_anchors_label // (if (.line // null) != null then ("L" + (.line | tostring)) else null end)),
          summary: ((.summary // "") | if length > 220 then .[0:220] + "..." else . end),
          search_text: ([
            .summary,
            .status_label,
            .resolution.root_cause,
            .resolution.change_summary,
            (.resolution.files_modified // [] | join(" ")),
            (.files_modified // [] | join(" "))
          ] | map(. // "") | join(" "))
        }
      ]
    }' >> "$summary_file"
done < <(aivv_view_review_files "$STATE_DIR")

if [ ! -s "$summary_file" ]; then
  summaries='[]'
else
  summaries=$(jq -s 'sort_by(.invoked_at // "") | reverse' "$summary_file")
fi

total_reviews=$(printf '%s' "$summaries" | jq 'length')
total_findings=$(printf '%s' "$summaries" | jq '[.[].finding_count] | add // 0')
total_open=$(printf '%s' "$summaries" | jq '[.[].open_count] | add // 0')
total_no_fix_session=$(printf '%s' "$summaries" | jq '[.[].no_fix_session_count] | add // 0')
total_fix_unjoinable=$(printf '%s' "$summaries" | jq '[.[].fix_unjoinable_count] | add // 0')
total_addressed_unverified=$(printf '%s' "$summaries" | jq '[.[].addressed_unverified_count] | add // 0')
total_verified_resolved=$(printf '%s' "$summaries" | jq '[.[].verified_resolved_count] | add // 0')
total_wont_fix=$(printf '%s' "$summaries" | jq '[.[].wont_fix_count] | add // 0')
total_legacy_fixed_claim=$(printf '%s' "$summaries" | jq '[.[].legacy_fixed_claim_count] | add // 0')
total_warnings=$(printf '%s' "$summaries" | jq '[.[].warning_count] | add // 0')

rows_html=$(printf '%s' "$summaries" | jq -r '
  def finding_preview_html($root):
    if (.findings_preview | length) == 0 then
      "<span class=\"muted\">No findings</span>"
    else
      "<div class=\"review-cell\">" +
        "<details class=\"cycle-details\">" +
          "<summary><code>" + (.review_id | @html) + "</code><span class=\"summary-hint\">Preview findings</span></summary>" +
          "<ol class=\"finding-list\">" +
          (.findings_preview | map(
            "<li>" +
              "<div class=\"finding-head\">" +
                "<span class=\"sev " + (.severity | ascii_downcase | @html) + "\">" + (.severity | @html) + "</span>" +
                "<code>" + (.id | @html) + "</code>" +
                (if (.review_ref // null) != null then " <code class=\"muted\">" + (.review_ref | @html) + "</code>" else "" end) +
                "<span class=\"finding-status\">" + (.status_label | @html) + "</span>" +
              "</div>" +
              "<div class=\"finding-summary\">" + (.summary | @html) + "</div>" +
              (if (.file // null) != null then
                "<div class=\"finding-meta\"><code>" + (.file | @html) +
                (if (.line_label // null) != null then ":" + (.line_label | @html) else "" end) +
                "</code></div>"
              else "" end) +
              (if ($root.report_href // null) != null then
                "<a class=\"finding-link\" href=\"" + ($root.report_href | @html) + "#" + (.anchor | @html) + "\">Open finding</a>"
              else "" end) +
            "</li>"
          ) | join("")) +
          "</ol>" +
        "</details>" +
        (if (.report_href // null) != null then
          "<a class=\"report-link\" href=\"" + (.report_href | @html) + "\">Open report</a>"
        else
          "<code class=\"report-command\">aivv view " + (.review_id | @html) + " --html -o review-" + (.review_id | @html) + ".html</code>"
        end) +
      "</div>"
    end;

  .[] |
  . as $root |
  "<tr class=\"cycle-row\" " +
  "data-source=\"" + (.source_file | @html) + "\" " +
  "data-search=\"" + (([.review_id, .lens_label, .status, (.warning_kinds | join(" ")), (.findings_preview | map([.id, .severity, .status_label, .file, .summary, .search_text] | map(. // "") | join(" ")) | join(" "))] | map(. // "") | join(" ") | ascii_downcase) | @html) + "\" " +
  "data-attention=\"" + ((.open_count + .no_fix_session_count + .fix_unjoinable_count + .deferred_count + .legacy_fixed_claim_count) | tostring) + "\">" +
    "<td>" + finding_preview_html($root) + "</td>" +
    "<td>" + ((.ran_at_label // .invoked_at // "—") | @html) + "</td>" +
    "<td>" + ((.lens_label // "—") | @html) + "</td>" +
    "<td class=\"num\">" + (.finding_count | tostring) + "</td>" +
    "<td class=\"num open\">" + (.open_count | tostring) + "</td>" +
    "<td class=\"num no-fix-session\">" + (.no_fix_session_count | tostring) + "</td>" +
    "<td class=\"num fix-unjoinable\">" + (.fix_unjoinable_count | tostring) + "</td>" +
    "<td class=\"num addressed\">" + (.addressed_unverified_count | tostring) + "</td>" +
    "<td class=\"num verified\">" + (.verified_resolved_count | tostring) + "</td>" +
    "<td class=\"num\">" + (.deferred_count | tostring) + "</td>" +
    "<td class=\"num\">" + (.wont_fix_count | tostring) + "</td>" +
    "<td class=\"num legacy-fixed\">" + (.legacy_fixed_claim_count | tostring) + "</td>" +
    "<td class=\"severity-stack\">" +
      "<span class=\"sev critical\">C " + (.critical_count | tostring) + "</span>" +
      "<span class=\"sev major\">M " + (.major_count | tostring) + "</span>" +
      "<span class=\"sev minor\">m " + (.minor_count | tostring) + "</span>" +
      "<span class=\"sev polish\">P " + (.polish_count | tostring) + "</span>" +
    "</td>" +
    "<td>" + (if (.warning_labels | length) > 0 then (.warning_labels | map("<span class=\"warning-label\">" + (. | @html) + "</span>") | join(" ")) else "—" end) + "</td>" +
  "</tr>"
')

css=':root{color-scheme:light dark;--bg:#f7f7f4;--panel:#fff;--text:#202124;--muted:#60646c;--line:#d9d7cf;--accent:#245b57;--critical:#b42318;--major:#b54708;--minor:#175cd3;--polish:#6941c6;--ok:#027a48;--verified:#175cd3;--unknown:#7a5c00}@media(prefers-color-scheme:dark){:root{--bg:#111315;--panel:#1b1f23;--text:#f2f4f7;--muted:#b8bec8;--line:#353a40;--accent:#7cd4c8;--critical:#ffb4ab;--major:#ffd6a6;--minor:#b8d5ff;--polish:#d6bbfb;--ok:#a6f4c5;--verified:#b8d5ff;--unknown:#ffe08a}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{position:sticky;top:0;z-index:2;background:var(--panel);border-bottom:1px solid var(--line);padding:18px 24px}main{padding:18px 24px 32px}h1{margin:0 0 10px;font-size:24px;letter-spacing:0}.lede{margin:0 0 14px;color:var(--muted);max-width:980px}.status-legend{margin:0 0 14px;color:var(--muted);font-size:13px}.meta{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}.metric{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:color-mix(in srgb,var(--panel),var(--bg) 35%)}.metric strong{font-size:18px}.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center}input[type=search]{min-height:44px;min-width:min(440px,80vw);border:1px solid var(--line);border-radius:8px;padding:0 12px;background:var(--bg);color:var(--text)}label,.muted{color:var(--muted)}.table-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel)}.table-scroll:focus-visible{outline:3px solid var(--accent);outline-offset:2px}table{width:100%;border-collapse:collapse;background:var(--panel)}caption{text-align:left;color:var(--muted);padding:0 0 8px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-size:12px;text-transform:uppercase;color:var(--muted);background:color-mix(in srgb,var(--panel),var(--bg) 45%)}tr:last-child td{border-bottom:0}.num{text-align:right;font-variant-numeric:tabular-nums}.open{color:var(--critical);font-weight:700}.addressed{color:var(--ok);font-weight:700}.verified{color:var(--verified);font-weight:700}.unknown{color:var(--unknown);font-weight:700}.finding-head{display:flex;flex-wrap:wrap;gap:5px;align-items:center}.severity-stack{white-space:nowrap}.severity-stack .sev{display:inline-flex;margin:0 4px 4px 0}.sev{border:1px solid var(--line);border-radius:999px;padding:2px 6px;font-size:12px}.critical{color:var(--critical)}.major{color:var(--major)}.minor{color:var(--minor)}.polish{color:var(--polish)}a{color:var(--accent);font-weight:700}code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}.review-cell{display:grid;gap:6px}.cycle-details summary{cursor:pointer;display:flex;gap:6px;align-items:center}.summary-hint{color:var(--muted);font-size:12px}.report-link,.finding-link{display:inline-flex;min-height:32px;align-items:center}.report-command{display:block;white-space:normal}.finding-list{margin:10px 0 0;padding-left:22px;min-width:420px}.finding-list li{margin:0 0 12px}.finding-summary{margin:4px 0;max-width:760px;white-space:normal}.finding-meta{color:var(--muted)}.finding-status{margin-left:auto;color:var(--muted);font-size:12px}.warning-label{display:block;max-width:280px;color:var(--muted);font-size:12px}.empty{padding:22px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--muted)}footer{padding:16px 24px;color:var(--muted)}@media(max-width:760px){header,main{padding-left:14px;padding-right:14px}th,td{white-space:nowrap}.finding-summary{max-width:75vw}.finding-status{margin-left:0}.summary-hint{display:block}}@media print{header{position:static}input,.controls label{display:none}body{background:#fff;color:#111}.table-scroll{overflow:visible;border:0}table{break-inside:auto}tr{break-inside:avoid}}'

js='(function(){var q=document.getElementById("cycle-search");var needs=document.getElementById("needs-attention");var live=document.getElementById("browser-live");var rows=[].slice.call(document.querySelectorAll(".cycle-row"));var timer;function apply(){var query=(q.value||"").toLowerCase();var only=needs.checked;var shown=0;rows.forEach(function(row){var text=((row.textContent||"")+" "+(row.getAttribute("data-search")||"")).toLowerCase();var ok=text.indexOf(query)!==-1;if(only&&Number(row.getAttribute("data-attention")||"0")<1)ok=false;row.hidden=!ok;if(ok)shown++;});live.textContent=shown+" cycles shown";}q.addEventListener("input",function(){clearTimeout(timer);timer=setTimeout(apply,180);});needs.addEventListener("change",apply);var priorOpen=null;window.addEventListener("beforeprint",function(){priorOpen=[];document.querySelectorAll(".cycle-details").forEach(function(d){priorOpen.push(d.open);d.open=true;});});window.addEventListener("afterprint",function(){if(!priorOpen)return;var i=0;document.querySelectorAll(".cycle-details").forEach(function(d){d.open=priorOpen[i++];});priorOpen=null;});apply();})();'

generate() {
cat <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AIVV Findings Browser</title>
  <style>${css}</style>
</head>
<body data-browser="findings">
<header>
  <h1>AIVV Findings Browser</h1>
  <p class="lede">Needs attention includes open findings, missing fix-session evidence, unjoinable fix evidence, deferred work, and legacy fixed claims without durable fix-log evidence.</p>
  <p class="status-legend">Status guide: Open = review/fix evidence is joinable and no fix addressed the finding; No fix session = no fix log references the review; Fix unjoinable = a claimed fix cannot be linked; Addressed, unverified = fix log claims a fix but verifier evidence is absent; Verified resolved = verifier evidence confirmed resolution.</p>
  <div class="meta" aria-label="Corpus summary">
    <span class="metric"><strong>${total_reviews}</strong> cycles</span>
    <span class="metric"><strong>${total_findings}</strong> findings</span>
    <span class="metric"><strong>${total_open}</strong> Open findings</span>
    <span class="metric"><strong>${total_no_fix_session}</strong> No fix session</span>
    <span class="metric"><strong>${total_fix_unjoinable}</strong> Fix unjoinable</span>
    <span class="metric"><strong>${total_addressed_unverified}</strong> Addressed, unverified</span>
    <span class="metric"><strong>${total_verified_resolved}</strong> Verified resolved</span>
    <span class="metric"><strong>${total_wont_fix}</strong> Wont-fix</span>
    <span class="metric"><strong>${total_legacy_fixed_claim}</strong> Legacy fixed claim</span>
    <span class="metric"><strong>${total_warnings}</strong> warning notices</span>
  </div>
  <div class="controls" role="search" aria-label="Search review cycles">
    <label for="cycle-search">Search cycles</label>
    <input type="search" id="cycle-search" autocomplete="off" spellcheck="false" aria-label="Search cycles">
    <label><input type="checkbox" id="needs-attention"> Needs attention</label>
    <span id="browser-live" role="status" aria-live="polite" aria-atomic="true"></span>
  </div>
</header>
<main>
HTML
if [ "$total_reviews" -eq 0 ]; then
  cat <<'HTML'
  <div class="empty">No review logs found in the selected external state or bounded legacy history. Run /aivv to create a review, or pass --state-dir to inspect another project.</div>
HTML
else
  cat <<HTML
  <div class="table-scroll" role="region" aria-label="Review cycles table" tabindex="0">
  <table aria-label="Review cycles">
    <caption>Use each review row to open the full single-review report and deep-link to individual findings.</caption>
    <thead>
      <tr>
        <th scope="col">Review</th>
        <th scope="col">Ran</th>
        <th scope="col">Lens</th>
        <th scope="col">Findings</th>
        <th scope="col">Open</th>
        <th scope="col">No fix session</th>
        <th scope="col">Fix unjoinable</th>
        <th scope="col">Addressed, unverified</th>
        <th scope="col">Verified resolved</th>
        <th scope="col">Deferred</th>
        <th scope="col">Wont-fix</th>
        <th scope="col">Legacy fixed claim</th>
        <th scope="col">Severity</th>
        <th scope="col">Warnings</th>
      </tr>
    </thead>
    <tbody>
${rows_html}
    </tbody>
  </table>
  </div>
HTML
fi
cat <<HTML
</main>
<footer>Generated by AIVV Viewer · ${VIEWER_VERSION} · read-only static browser</footer>
<script>${js}</script>
</body>
</html>
HTML
}

if [ -n "$OUTPUT" ]; then
  generate > "$OUTPUT"
  echo "aivv view: browser written to $OUTPUT" >&2
else
  generate
fi
