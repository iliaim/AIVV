#!/usr/bin/env bash
# skills/aivv-view/scripts/view.sh — entry point for /aivv view
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

VIEW_HTML_SCRIPT="${AIVV_VIEW_HTML_SCRIPT:-$SCRIPT_DIR/view-html.sh}"
VIEWER_VERSION="0.2.0"
STATE_DIR=""
WONT_FIX=""
REVIEW_ID=""
REVIEW_FILE=""
MODE=""
HTML_OUTPUT=""
OPEN_HTML=0
INBOX=0
ACTION_INBOX_SCRIPT="${AIVV_ACTION_INBOX_SCRIPT:-$SCRIPT_DIR/../../../tools/aivv-action-inbox.mjs}"

# Argument parsing
while [ $# -gt 0 ]; do
  case "$1" in
    --version)   echo "aivv-view $VIEWER_VERSION"; exit 0 ;;
    --storage-context) export AIVV_VIEW_STORAGE_CONTEXT="$2"; shift 2 ;;
    --state-dir) STATE_DIR="$2"; shift 2 ;;
    --review-id) REVIEW_ID="$2"; shift 2 ;;
    --review-file) REVIEW_FILE="$2"; shift 2 ;;
    --json)      MODE="json"; shift ;;
    --summary)   MODE="summary"; shift ;;
    --tui)       MODE="tui"; shift ;;
    --html)      MODE="html"; shift ;;
    --browser)   MODE="browser"; shift ;;
    --inbox)     INBOX=1; shift ;;
    --open)      OPEN_HTML=1; shift ;;
    -o)          HTML_OUTPUT="$2"; shift 2 ;;
    --list)      MODE="list"; shift ;;
    --help|-h)
      cat <<'EOF'
Usage: aivv view                          # interactive default: write/open findings browser; JSON when piped
       aivv view <review-id>              # show specific review (positional, prefix-matched)
       aivv view <review-id> --tui        # force interactive fzf TUI
       aivv view <review-id> --html       # render static HTML report to stdout
       aivv view <review-id> --html -o report.html  # write HTML to file
       aivv view <review-id> --html -o report.html --open  # write HTML and open it
       aivv view <review-id> --inbox       # serve a local batch-remediation Action Inbox
       aivv view --browser                # render static multi-cycle findings browser to stdout
       aivv view --browser -o browser.html --open  # write browser and open it
       aivv view <review-id> --json       # force JSON output
       aivv view <review-id> --summary    # force human-friendly summary
       aivv view --list                   # enriched per-cycle index
       aivv view --version

Examples:
  aivv view                               # write/open the cached findings browser when interactive
  aivv view <id-prefix> --json            # resolve a unique review ID by prefix
  aivv view 17T13 --html -o report.html   # generate shareable HTML report
  aivv view 17T13 --html -o report.html --open  # generate and open report in browser
  aivv view --browser -o browser.html      # generate cross-cycle findings browser
  aivv view --list | jq '.[] | select(.lens == "visual")'
  aivv view 17T13 --json | jq '.findings[] | select(.severity=="CRITICAL")'

Flags:
  --review-id <id>   Same as positional <review-id>; provided for scripting clarity.
  --storage-context <file>  Use a bound invocation context on hosts with uncertain identity.
  --state-dir <dir>  Read a specific historical state directory (default: external state plus bounded legacy history).
  --tui              Force interactive fzf TUI (default when stdout is a TTY and fzf is installed).
  --html             Render single-file static HTML report (self-contained, offline-readable).
  --browser          Render static multi-cycle browser; -o also writes linked reports/ files.
  --inbox            Explicitly start a loopback Action Inbox for one review; prints a local report URL.
  -o <file>          With --html/--browser: write output to file instead of stdout.
  --open             With --html/--browser -o <file>: open the generated report in the default browser.
  --json             Force JSON output (default when stdout is piped).
  --summary          Force human-friendly plain-text summary.
  --list             List indexed cycles with enriched per-cycle metadata.
  --version          Print viewer version and exit.

Exit codes (per sysexits convention):
   0 — success
  64 — usage error (unknown flag, malformed argument)
  65 — review not found for given id-or-prefix
  70 — ambiguous prefix (multiple matches)
 127 — jq not installed (see install hint)
EOF
      exit 0 ;;
    --*) echo "aivv view: unknown flag '$1'. Run 'aivv view --help' for usage." >&2; exit 64 ;;
    *)
      if [ -z "$REVIEW_ID" ]; then
        REVIEW_ID="$1"
        shift
      else
        echo "aivv view: unexpected extra argument '$1'. Only one review-id permitted." >&2
        exit 64
      fi ;;
  esac
done

if [ "$OPEN_HTML" = "1" ] && { { [ "$MODE" != "html" ] && [ "$MODE" != "browser" ]; } || [ -z "$HTML_OUTPUT" ]; }; then
  echo "aivv view: --open requires --html or --browser with -o report.html" >&2
  exit 64
fi

require_jq
if [ -z "$STATE_DIR" ]; then
  STATE_DIR="$(aivv_view_default_state)"
  export AIVV_VIEW_INCLUDE_HISTORY=history
fi

# Derive WONT_FIX path from STATE_DIR (after all args parsed so --state-dir is respected)
WONT_FIX="$STATE_DIR/wont-fix-registry.json"

require_jq

# Bare interactive invocation defaults to the browser-first experience. Piped
# invocations stay JSON later in the file so existing scripts keep working.
if [ "$INBOX" = "0" ] && [ -z "$MODE" ] && [ -z "$REVIEW_ID" ] && [ -z "$REVIEW_FILE" ] && [ -t 1 ]; then
  MODE="browser"
  HTML_OUTPUT="$(aivv_view_storage cache)/browser.html"
  OPEN_HTML=1
fi

if [ "$INBOX" = "1" ] && { [ -n "$MODE" ] || [ -n "$HTML_OUTPUT" ] || [ "$OPEN_HTML" = "1" ]; }; then
  echo "aivv view: --inbox serves one review and cannot be combined with another output mode, -o, or --open." >&2
  exit 64
fi

# --browser mode: multi-cycle static report, no single review resolution needed.
if [ "$MODE" = "browser" ]; then
  if [ -n "$HTML_OUTPUT" ]; then
    html_parent="$HTML_OUTPUT"
    if [[ "$HTML_OUTPUT" == */* ]]; then
      html_parent="${HTML_OUTPUT%/*}"
      [ -z "$html_parent" ] && html_parent="/"
    else
      html_parent="."
    fi
    mkdir -p "$html_parent"
  fi

  browser_args=(--state-dir "$STATE_DIR" --wont-fix "$WONT_FIX")
  if [ -n "$HTML_OUTPUT" ]; then
    browser_args+=(--output "$HTML_OUTPUT")
  fi

  bash "$SCRIPT_DIR/view-browser.sh" "${browser_args[@]}"
  if [ "$OPEN_HTML" = "1" ]; then
    open_report "$HTML_OUTPUT"
  fi
  exit 0
fi

# --list mode
if [ "$MODE" = "list" ]; then
  files=()
  while IFS= read -r f; do files+=("$f"); done < <(aivv_view_review_files "$STATE_DIR")
  if [ "${#files[@]}" -eq 0 ]; then
    echo "[]"
    echo "aivv view: no reviews found in $STATE_DIR. Run /aivv first to surface findings." >&2
    exit 0
  fi
  aivv_view_storage list "$STATE_DIR" "${AIVV_VIEW_INCLUDE_HISTORY:-explicit}"
  exit 0
fi

# Resolve REVIEW_ID → matching review file(s)
matches=()
if [ -n "$REVIEW_FILE" ]; then
  # Direct file path mode — used by HTML renderer fixtures + ad-hoc rendering
  if [ ! -f "$REVIEW_FILE" ]; then
    echo "aivv view: review-file '$REVIEW_FILE' not found." >&2
    exit 65
  fi
  matches=("$REVIEW_FILE")
elif [ -z "$REVIEW_ID" ]; then
  # Bare invocation — find latest by .invoked_at, mtime fallback
  best_file=""
  best_ts=""
  review_files=()
  while IFS= read -r f; do review_files+=("$f"); done < <(aivv_view_review_files "$STATE_DIR")
  for f in "${review_files[@]}"; do
    ts=$(aivv_view_storage timestamp "$f" 2>/dev/null || true)
    if [ -z "$best_file" ]; then
      best_file="$f"
      best_ts="$ts"
    elif [ -n "$ts" ] && [ -n "$best_ts" ] && [[ "$ts" > "$best_ts" ]]; then
      best_file="$f"
      best_ts="$ts"
    elif [ -z "$ts" ] && [ -z "$best_ts" ]; then
      # Both empty — keep mtime order (ls -t already orders by mtime)
      true
    fi
  done
  if [ -z "$best_file" ] || [ ! -f "$best_file" ]; then
    echo "aivv view: no reviews found in $STATE_DIR. Run /aivv first to surface findings." >&2
    exit 65
  fi
  matches=("$best_file")
else
  # Anchored prefix match: filename must be review-<REVIEW_ID>*
  review_files=()
  while IFS= read -r f; do review_files+=("$f"); done < <(aivv_view_review_files "$STATE_DIR")
  for f in "${review_files[@]}"; do
    name=$(basename "$f" .json)
    if [[ "$name" == review-"$REVIEW_ID"* ]]; then
      matches+=("$f")
    fi
  done
  if [ "${#matches[@]}" -eq 0 ]; then
    echo "aivv view: no review matches prefix '$REVIEW_ID' in $STATE_DIR (and bounded legacy history when defaulted); use --state-dir <known-history-dir> for other nested history." >&2
    exit 65
  fi
  if [ "${#matches[@]}" -gt 1 ]; then
    echo "aivv view: ambiguous prefix '$REVIEW_ID'. Candidate review-ids:" >&2
    for f in "${matches[@]}"; do
      printf '  %s\n' "$(basename "$f" .json | sed 's/^review-//')" >&2
    done
    exit 70
  fi
fi

# Historical companions remain read-only and are joined within their source store.
SELECTED_STATE_DIR="$STATE_DIR"
if [ "${AIVV_VIEW_INCLUDE_HISTORY:-}" = history ]; then
  SELECTED_STATE_DIR="$(aivv_view_state_for_review "${matches[0]}")"
fi
WONT_FIX="$SELECTED_STATE_DIR/wont-fix-registry.json"
if ! aivv_view_visible "${matches[0]}"; then
  echo "aivv view: selected review import is incomplete; retry after import completes." >&2
  exit 65
fi

# TTY auto-detect: bare interactive defaults to browser above; specific reviews
# still prefer --tui when interactive, with summary fallback and JSON when piped.
if [ "$INBOX" = "0" ] && [ -z "$MODE" ]; then
  if [ -t 1 ]; then
    if command -v fzf >/dev/null 2>&1; then MODE="tui"; else MODE="summary"; fi
  else
    MODE="json"
  fi
fi

# --tui: delegate entirely to view-tui.sh (which has its own loader + prefix-match logic)
if [ "$MODE" = "tui" ]; then
  exec bash "$SCRIPT_DIR/view-tui.sh" \
    --state-dir "$STATE_DIR" \
    ${REVIEW_ID:+--review-id "$REVIEW_ID"} \
    --wont-fix "$WONT_FIX"
fi

# --inbox: short-lived loopback server. It is deliberately opt-in; static --html
# reports remain offline and clipboard-only.
if [ "$INBOX" = "1" ]; then
  [ -f "$ACTION_INBOX_SCRIPT" ] || { echo "aivv view: Action Inbox helper is unavailable: $ACTION_INBOX_SCRIPT" >&2; exit 70; }
  command -v node >/dev/null 2>&1 || { echo "aivv view: viewer storage resolution requires Node.js." >&2; exit 127; }
  inbox_context_args=()
  if [ -n "${AIVV_VIEW_STORAGE_CONTEXT:-}" ]; then inbox_context_args=(--storage-context "$AIVV_VIEW_STORAGE_CONTEXT"); fi
  exec node "$ACTION_INBOX_SCRIPT" serve ${inbox_context_args[@]+"${inbox_context_args[@]}"} \
    --review-file "${matches[0]}" \
    --state-dir "$STATE_DIR" \
    --fix-dir "$SELECTED_STATE_DIR" \
    --wont-fix "$WONT_FIX" \
    --html-script "$VIEW_HTML_SCRIPT"
fi

# --html: delegate to view-html.sh with the resolved file path
if [ "$MODE" = "html" ]; then
  if [ -n "$HTML_OUTPUT" ]; then
    html_parent="$HTML_OUTPUT"
    if [[ "$HTML_OUTPUT" == */* ]]; then
      html_parent="${HTML_OUTPUT%/*}"
      [ -z "$html_parent" ] && html_parent="/"
    else
      html_parent="."
    fi
    mkdir -p "$html_parent"
  fi

  html_args=(
    --file "${matches[0]}"
    --fix-dir "$SELECTED_STATE_DIR"
    --wont-fix "$WONT_FIX"
  )
  if [ -n "$HTML_OUTPUT" ]; then
    html_args+=(--output "$HTML_OUTPUT")
  fi

  html_tmpdir=$(mktemp -d)
  trap 'rm -rf "$html_tmpdir"' EXIT
  trap 'rm -rf "$html_tmpdir"; exit 129' HUP
  trap 'rm -rf "$html_tmpdir"; exit 130' INT
  trap 'rm -rf "$html_tmpdir"; exit 143' TERM
  html_stdout="$html_tmpdir/view-html.out"
  html_stderr="$html_tmpdir/view-html.err"
  if bash "$VIEW_HTML_SCRIPT" "${html_args[@]}" >"$html_stdout" 2>"$html_stderr"; then
    cat "$html_stderr" >&2
    if [ -z "$HTML_OUTPUT" ]; then
      cat "$html_stdout"
    fi
  else
    rc=$?
    printf 'aivv view: HTML renderer failed: %s\n' \
      "$(aivv_view_sanitized_error)" >&2
    exit "$rc"
  fi
  if [ "$OPEN_HTML" = "1" ]; then
    open_report "$HTML_OUTPUT"
  fi
  exit 0
fi

# Capture only JSON stdout; successful loader diagnostics retain stderr.
# On failure the inherited diagnostic and this source-specific message remain visible.
loader_json=""
loader_rc=0
loader_json=$(bash "$SCRIPT_DIR/view-loader.sh" --file "${matches[0]}" --fix-dir "$SELECTED_STATE_DIR" --wont-fix "$WONT_FIX") \
  || loader_rc=$?
if [ $loader_rc -ne 0 ]; then
  echo "aivv view: failed to load '${matches[0]}': $loader_json" >&2
  exit 65
fi

case "$MODE" in
  json)
    printf '%s\n' "$loader_json"
    ;;
  summary)
    printf '%s' "$loader_json" \
      | bash "$SCRIPT_DIR/humanize.sh" \
      | jq -r '
          # Severity rank for explicit sort (A6 fix: not alphabetic-by-accident)
          def sev_rank: {"CRITICAL":0,"MAJOR":1,"MINOR":2,"POLISH":3}[.] // 99;
          "  Lens:          \(.review_meta.lens_label // "—") · \(.findings | length) finding\(if (.findings|length) == 1 then "" else "s" end)",
          "  Ran:           \(.review_meta.ran_at_label // "—") · took \(.review_meta.duration_label // "—")",
          "  Reviewed by:   \(.review_meta.review_mode_label // "—")",
          "  Review ID:     \(.review_id // "—")",
          "",
          "  By severity:",
          ([.findings[] | {severity, severity_desc}]
            | group_by(.severity)
            | sort_by(.[0].severity | sev_rank)
            | map("    ● \(.[0].severity) · \(length)  \(.[0].severity_desc)")
            | join("\n")),
          "",
          ( if (.loader_warnings_anomalous | length) > 0 then
              "  Heads up:\n" + (.loader_warnings_anomalous | map("    · " + .sentence + (if (.count // 1) > 1 then "  (×\(.count))" else "" end)) | join("\n")) + "\n"
            else "" end
          ),
          "  Tip: pipe to jq for full data, or run --list to see other reviews."
        '
    ;;
esac
