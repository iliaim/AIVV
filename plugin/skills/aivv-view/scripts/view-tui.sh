#!/usr/bin/env bash
# skills/aivv-view/scripts/view-tui.sh — Phase 1 fzf TUI
#
# Architecture: self-calling script with internal --_ subcommands.
# fzf bindings call back into this script (via SELF variable exported to env).
# AIVV_TUI_TMPDIR must be set in the environment for subcommand modes;
# it is exported by the main-entry path before fzf is launched.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
AIVV_ROOT="$(aivv_view_runtime_root "$SCRIPT_DIR")"

# ──────────────────────────────────────────────────────────────────────────────
# Internal subcommand dispatch  (invoked by fzf bindings via AIVV_TUI_TMPDIR)
# ──────────────────────────────────────────────────────────────────────────────
case "${1:-}" in

  # ── List findings for fzf's left pane ─────────────────────────────────────
  --_list)
    tmpdir="${AIVV_TUI_TMPDIR:-}"
    [ -z "$tmpdir" ] && { echo "view-tui: AIVV_TUI_TMPDIR not set" >&2; exit 1; }
    show_polish=$(jq -r '.show_polish' "$tmpdir/state.json" 2>/dev/null || echo "false")
    group_by=$(jq -r '.group_by' "$tmpdir/state.json" 2>/dev/null || echo "severity")
    jq -r \
      --argjson show_polish "$show_polish" \
      --arg group_by "$group_by" '
      def sev_rank: {"CRITICAL":0,"MAJOR":1,"MINOR":2,"POLISH":3}[.] // 99;
      def group_key:
        if $group_by == "severity" then (.severity | sev_rank | tostring | "0" + .) + (.id // "")
        elif $group_by == "rule"   then (.rule_id  // "~no-rule") + (.id // "")
        elif $group_by == "file"   then (.location_label // .file // "~no-file") + (.id // "")
        elif $group_by == "lens"   then (.lens     // "~no-lens") + (.id // "")
        else (.severity | sev_rank | tostring) + (.id // "")
        end;
      [.findings[] | select(if $show_polish then true else .severity != "POLISH" end)]
      | sort_by(group_key)
      | .[]
      | [
          (.id // "?"),
          .severity,
          (if .file then "\(.location_label // .file)\(if .line then ":\(.line|tostring)" else "" end)" elif .location_label then .location_label else "—" end),
          (.summary // "(no summary)" | .[0:70])
        ]
      | @tsv
    ' "$tmpdir/findings.json"
    exit 0 ;;

  # ── Preview a single finding in the right pane ────────────────────────────
  --_preview)
    finding_id="${2:-}"
    tmpdir="${AIVV_TUI_TMPDIR:-}"
    [ -z "$tmpdir" ] && exit 0
	    preview_out=$(jq -r --arg id "$finding_id" '
	      def resolution_state:
	        (.resolution as $r |
	          if $r == null then "open"
	          elif ($r.status // "") == "verified" then "verified"
	          elif ($r.addressed // false) == true or (($r.status // "") == "fixed") then "addressed"
	          else "open" end);
	      .findings[] | select(.id == $id) |
	      (resolution_state) as $resolution_state |
	      "══ \(.severity) ─ \(.id) " + ("═" * (60 - (.severity|length) - (.id|length) - 5 | if . < 0 then 0 else . end)),
      "",
      "  \(.summary // "(no summary)")",
      "",
      (if .file then
        "  File:      \(.location_label // .file)\(if .line then ":\(.line|tostring)" else "" end)"
      elif .location_label then
        "  Location:  \(.location_label)"
      else "" end),
      (if .rule_id then "  Rule:      \(.rule_id)" else "" end),
      (if .agreement_label then "  By:        \(.agreement_label)" else "" end),
      (if .category then "  Category:  \(.category)" else "" end),
      (if .runtime_evidence then "  Runtime:   \(.runtime_evidence_label // .runtime_evidence.outcome)" else "" end),
      "",
      "  ── Resolution ───────────────────────────────────────────",
      (if .resolution then
        "  Status:     \(.status_label // "—")",
        "  Addressed:  \(.resolution.addressed | if . then "✓ yes" else "✗ no" end)",
        (if .resolution.change_summary then
          "  Change:     \(.resolution.change_summary | .[0:80])"
        else "" end),
        (if .resolution.root_cause then
          "  Root cause: \(.resolution.root_cause | .[0:80])"
        else "" end)
      else
        "  Open · not yet investigated"
      end),
      "",
	      (if .suggested_action then
	        if ($resolution_state | IN("addressed", "verified")) then
	          "  ── Audit trail ───────────────────────────────────────────",
	          "  Original recommendation: \(.suggested_action | .[0:160])",
	          ""
	        else
	          "  ── Suggested action ─────────────────────────────────────",
	          "  \(.suggested_action | .[0:160])",
	          ""
	        end
	      else "" end),
      (if .wont_fix then
        "  ── Wont-fix ──────────────────────────────────────────",
        "  Decided: \(.wont_fix.decided_at // "?")",
        "  Reason:  \(.wont_fix.reason // "(none)")",
        ""
      else "" end),
      (if .runtime_evidence then
        "  ── Runtime evidence ───────────────────────────────────",
        "  Outcome:  \(.runtime_evidence_label // .runtime_evidence.outcome)",
        "  Spec:     \(.runtime_evidence.spec_path // "—")",
        "  Result:   \(.runtime_evidence.result_path // "—")",
        (if .runtime_evidence.assertion_message then "  Message:  \(.runtime_evidence.assertion_message | .[0:120])" else "" end),
        ""
      else "" end),
      (if (.grounded_by | length) > 0 then
        "  ── Sources ──────────────────────────────────────────────",
        (.grounded_by[] | "  · \(.source_type // "?"): \(.source_ref // "(no source_ref)")\(if .excerpt then " — \(.excerpt | .[0:50])" else "" end)"),
        ""
      else "" end)
    ' "$tmpdir/findings.json" 2>/dev/null || true)
    if [ -z "$preview_out" ]; then
      echo "  (finding '$finding_id' not found in loaded envelope)"
    else
      printf '%s\n' "$preview_out"
    fi
    exit 0 ;;

  # ── Open file:line in $EDITOR ─────────────────────────────────────────────
  --_open-editor)
    finding_id="${2:-}"
    tmpdir="${AIVV_TUI_TMPDIR:-}"
    [ -z "$tmpdir" ] && exit 0
    file=$(jq -r --arg id "$finding_id" \
      '.findings[] | select(.id == $id) | .file // empty' "$tmpdir/findings.json" 2>/dev/null | head -1 || true)
    line=$(jq -r --arg id "$finding_id" \
      '.findings[] | select(.id == $id) | .line // empty' "$tmpdir/findings.json" 2>/dev/null | head -1 || true)
    if [ -z "$file" ]; then
      echo "aivv-tui: finding '$finding_id' has no file reference" >&2
      exit 0
    fi
    # Split $EDITOR on spaces so multi-word values like "emacsclient -nw" or "code --wait" work.
    # Then detect VS Code-class editors that use --goto file:line instead of +line file.
    read -ra ed_arr <<< "${EDITOR:-vi}"
    ed_bin="${ed_arr[0]##*/}"   # basename of first token
    if [ -n "$line" ]; then
      case "$ed_bin" in
        code|code-insiders|codium|cursor|windsurf)
          exec "${ed_arr[@]}" --goto "$file:$line" ;;
        subl|sublime_text)
          exec "${ed_arr[@]}" "$file:$line" ;;
        *)
          exec "${ed_arr[@]}" "+$line" "$file" ;;
      esac
    else
      exec "${ed_arr[@]}" "$file"
    fi
    exit 0 ;;

  # ── Open rule body in $PAGER ──────────────────────────────────────────────
  --_open-rule)
    finding_id="${2:-}"
    tmpdir="${AIVV_TUI_TMPDIR:-}"
    [ -z "$tmpdir" ] && exit 0
    rule_id=$(jq -r --arg id "$finding_id" \
      '.findings[] | select(.id == $id) | .rule_id // empty' "$tmpdir/findings.json" 2>/dev/null | head -1 || true)
    read -ra pager_arr <<< "${PAGER:-less}"
    if [ -z "$rule_id" ]; then
      printf "  (finding '%s' has no rule_id)\n" "$finding_id" | "${pager_arr[@]}"
      exit 0
    fi
    # Search for the rule heading in standards files
    standards_dir="$AIVV_ROOT/.aivv/standards"
    rule_file=$(grep -rl "^### $rule_id" "$standards_dir" 2>/dev/null | head -1 || true)
    if [ -n "$rule_file" ]; then
      "${pager_arr[@]}" "$rule_file"
    else
      printf "  Rule %s: no standards file found (looked in %s)\n" "$rule_id" "$standards_dir" | "${pager_arr[@]}"
    fi
    exit 0 ;;

  # ── Show wont-fix detail ──────────────────────────────────────────────────
  --_show-wont-fix)
    finding_id="${2:-}"
    tmpdir="${AIVV_TUI_TMPDIR:-}"
    [ -z "$tmpdir" ] && exit 0
    read -ra pager_arr <<< "${PAGER:-less}"
    wf_out=$(jq -r --arg id "$finding_id" '
      .findings[] | select(.id == $id) |
      if .wont_fix then
        "Wont-fix record for \(.id):",
        "  Decided:  \(.wont_fix.decided_at // "?")",
        "  Reason:   \(.wont_fix.reason // "(none)")",
        "  Approved: \(.wont_fix.user_approved | if . then "yes" else "no" end)",
        (if .wont_fix.recurring_in_current_review then
          "  ↩ This finding is marked as recurring in the current review."
        else "" end)
      else
        "(finding \($id) has no wont-fix record)"
      end
    ' "$tmpdir/findings.json" 2>/dev/null || true)
    if [ -z "$wf_out" ]; then
      echo "  (finding '$finding_id' not found in loaded envelope)" | "${pager_arr[@]}"
    else
      printf '%s\n' "$wf_out" | "${pager_arr[@]}"
    fi
    exit 0 ;;

  # ── Toggle POLISH visibility ──────────────────────────────────────────────
  --_toggle-polish)
    tmpdir="${AIVV_TUI_TMPDIR:-}"
    [ -z "$tmpdir" ] && exit 0
    current=$(jq -r '.show_polish' "$tmpdir/state.json" 2>/dev/null || echo "false")
    jq --argjson cur "$current" '.show_polish = ($cur | not)' "$tmpdir/state.json" \
      > "$tmpdir/state.json.tmp" && mv "$tmpdir/state.json.tmp" "$tmpdir/state.json"
    exit 0 ;;

  # ── Cycle group-by: severity → rule → file → lens → severity ─────────────
  --_cycle-group-by)
    tmpdir="${AIVV_TUI_TMPDIR:-}"
    [ -z "$tmpdir" ] && exit 0
    current=$(jq -r '.group_by' "$tmpdir/state.json" 2>/dev/null || echo "severity")
    case "$current" in
      severity) next="rule" ;;
      rule)     next="file" ;;
      file)     next="lens" ;;
      *)        next="severity" ;;
    esac
    jq --arg next "$next" '.group_by = $next' "$tmpdir/state.json" \
      > "$tmpdir/state.json.tmp" && mv "$tmpdir/state.json.tmp" "$tmpdir/state.json"
    exit 0 ;;

  # ── Help overlay ──────────────────────────────────────────────────────────
  --_help)
    read -ra pager_arr <<< "${PAGER:-less}"
    cat <<'HELPEOF' | "${pager_arr[@]}"
AIVV Viewer — fzf TUI hotkeys
══════════════════════════════════════════════════════════
  Enter     Open file:line in $EDITOR (set EDITOR env var)
  p         Toggle POLISH findings (hidden by default)
  g         Cycle group-by: severity → rule → file → lens
  r         Open rule body in $PAGER
  w         Show Wont-fix recurrence detail
  /         Search / filter (fzf built-in; type to narrow)
  Tab       Preview-scroll-down
  Shift-Tab Preview-scroll-up
  ?         This help
  q / ESC   Quit

Tip: pipe to --json for full structured data:
  aivv view <id> --json | jq '.findings[] | select(.severity=="CRITICAL")'
HELPEOF
    exit 0 ;;

esac

# ──────────────────────────────────────────────────────────────────────────────
# Main entry — argument parsing
# ──────────────────────────────────────────────────────────────────────────────
STATE_DIR=""
WONT_FIX=""
REVIEW_ID=""

while [ $# -gt 0 ]; do
  case "$1" in
    --state-dir) STATE_DIR="$2"; shift 2 ;;
    --review-id) REVIEW_ID="$2"; shift 2 ;;
    --wont-fix)  WONT_FIX="$2";  shift 2 ;;
    --*)
      echo "view-tui: unknown flag '$1'. Run 'aivv view --help' for usage." >&2
      exit 64 ;;
    *)
      if [ -z "$REVIEW_ID" ]; then
        REVIEW_ID="$1"; shift
      else
        echo "view-tui: unexpected extra argument '$1'" >&2; exit 64
      fi ;;
  esac
done

require_jq
if [ -z "$STATE_DIR" ]; then
  STATE_DIR="$(aivv_view_default_state)"
  export AIVV_VIEW_INCLUDE_HISTORY=history
fi

WONT_FIX="${WONT_FIX:-$STATE_DIR/wont-fix-registry.json}"

require_jq

# ──────────────────────────────────────────────────────────────────────────────
# Graceful degradation — fall back to --summary if fzf is absent
# ──────────────────────────────────────────────────────────────────────────────
if ! require_fzf 2>/dev/null; then
  echo "aivv-view: fzf not found — falling back to --summary. Install fzf for the interactive TUI." >&2
  exec bash "$SCRIPT_DIR/view.sh" \
    --state-dir "$STATE_DIR" \
    --summary \
    ${REVIEW_ID:+--review-id "$REVIEW_ID"}
fi

# ──────────────────────────────────────────────────────────────────────────────
# Temp dir + state initialization
# ──────────────────────────────────────────────────────────────────────────────
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
export AIVV_TUI_TMPDIR="$TMP_DIR"

printf '{"show_polish":false,"group_by":"severity"}\n' > "$TMP_DIR/state.json"

# ──────────────────────────────────────────────────────────────────────────────
# Resolve review file (mirrors view.sh prefix-match logic)
# ──────────────────────────────────────────────────────────────────────────────
INPUT_FILE=""
if [ -z "$REVIEW_ID" ]; then
  best_file="" best_ts=""
  review_files=()
  while IFS= read -r f; do review_files+=("$f"); done < <(aivv_view_review_files "$STATE_DIR")
  for f in "${review_files[@]}"; do
    ts=$(aivv_view_storage timestamp "$f" 2>/dev/null || true)
    if [ -z "$best_file" ]; then
      best_file="$f"; best_ts="$ts"
    elif [ -n "$ts" ] && [ -n "$best_ts" ] && [[ "$ts" > "$best_ts" ]]; then
      best_file="$f"; best_ts="$ts"
    fi
  done
  if [ -z "$best_file" ] || [ ! -f "$best_file" ]; then
    echo "aivv view: no reviews found in $STATE_DIR. Run /aivv first to surface findings." >&2
    exit 65
  fi
  INPUT_FILE="$best_file"
else
  matches=()
  review_files=()
  while IFS= read -r f; do review_files+=("$f"); done < <(aivv_view_review_files "$STATE_DIR")
  for f in "${review_files[@]}"; do
    name=$(basename "$f" .json)
    [[ "$name" == review-"$REVIEW_ID"* ]] && matches+=("$f")
  done
  if [ "${#matches[@]}" -eq 0 ]; then
    echo "aivv view: no review matches prefix '$REVIEW_ID' in $STATE_DIR." >&2; exit 65
  fi
  if [ "${#matches[@]}" -gt 1 ]; then
    echo "aivv view: ambiguous prefix '$REVIEW_ID'. Candidates:" >&2
    for f in "${matches[@]}"; do printf '  %s\n' "$(basename "$f" .json | sed 's/^review-//')" >&2; done
    exit 70
  fi
  INPUT_FILE="${matches[0]}"
fi

# ──────────────────────────────────────────────────────────────────────────────
# Load canonical envelope + humanize into temp findings file
# ──────────────────────────────────────────────────────────────────────────────
if [ "${AIVV_VIEW_INCLUDE_HISTORY:-}" = history ]; then WONT_FIX="$(aivv_view_state_for_review "$INPUT_FILE")/wont-fix-registry.json"; fi

loader_json=""
loader_rc=0
loader_json=$(bash "$SCRIPT_DIR/view-loader.sh" \
  --file "$INPUT_FILE" \
  --fix-dir "$(aivv_view_state_for_review "$INPUT_FILE")" \
  --wont-fix "$WONT_FIX") || loader_rc=$?
if [ $loader_rc -ne 0 ]; then
  echo "aivv view: failed to load '$INPUT_FILE': $loader_json" >&2
  exit 65
fi

printf '%s' "$loader_json" | bash "$SCRIPT_DIR/humanize.sh" > "$TMP_DIR/findings.json"

# ──────────────────────────────────────────────────────────────────────────────
# Build fzf header: review metadata + hotkey hints
# ──────────────────────────────────────────────────────────────────────────────
total_count=$(jq '.findings | length' "$TMP_DIR/findings.json")
visible_count=$(jq '[.findings[] | select(.severity != "POLISH")] | length' "$TMP_DIR/findings.json")
polish_count=$(( total_count - visible_count ))
if [ "$polish_count" -gt 0 ]; then
  count_label="${visible_count} shown · ${polish_count} POLISH hidden (press p)"
else
  count_label="${total_count} findings"
fi
review_header=$(jq -r \
  --arg count_label "$count_label" '
  "  Lens: \(.review_meta.lens_label // "—")  ·  \($count_label)  ·  \(.review_meta.ran_at_label // "—")\n" +
  "  Reviewed by: \(.review_meta.review_mode_label // "—")  ·  Review ID: \(.review_id // "—")\n" +
  "  ──────────────────────────────────────────────────────────────────\n" +
  "  Enter:open  p:polish  g:group-by  r:rule  w:wont-fix  ?:help  q:quit"
' "$TMP_DIR/findings.json")

# ──────────────────────────────────────────────────────────────────────────────
# Launch fzf
# ──────────────────────────────────────────────────────────────────────────────
SELF="$SCRIPT_DIR/view-tui.sh"

bash "$SELF" --_list | fzf \
  --ansi \
  --no-sort \
  --header "$review_header" \
  --header-first \
  --delimiter $'\t' \
  --with-nth "2,3,4" \
  --preview "bash '$SELF' --_preview {1}" \
  --preview-window "right:55%:wrap" \
  --bind "enter:execute(bash '$SELF' --_open-editor {1})" \
  --bind "p:execute-silent(bash '$SELF' --_toggle-polish)+reload(bash '$SELF' --_list)" \
  --bind "g:execute-silent(bash '$SELF' --_cycle-group-by)+reload(bash '$SELF' --_list)" \
  --bind "r:execute(bash '$SELF' --_open-rule {1})" \
  --bind "w:execute(bash '$SELF' --_show-wont-fix {1})" \
  --bind "?:execute(bash '$SELF' --_help)" \
  --bind "q:abort" \
  --bind "tab:preview-down" \
  --bind "shift-tab:preview-up" \
  || true  # fzf exits non-zero on ESC/q — treat as normal quit
