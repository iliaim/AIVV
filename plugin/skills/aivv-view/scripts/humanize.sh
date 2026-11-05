#!/usr/bin/env bash
# skills/aivv-view/scripts/humanize.sh
# Pipes canonical envelope JSON through humanize.jq + adds bash-side date labels.
# Idempotent. Standalone-invocable from any AIVV component or external script.
#
# Usage:
#   aivv view <id> --json | humanize.sh
#   humanize.sh --file canonical-envelope.json
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
require_jq

INPUT_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --file) INPUT_FILE="$2"; shift 2 ;;
    --help|-h) cat <<'EOF'
humanize.sh — annotate a canonical AIVV envelope with *_label fields.

Usage:
  humanize.sh                    # reads from stdin
  humanize.sh --file <path>      # reads from a file
  cat envelope.json | humanize.sh

Outputs the envelope with these additional fields (idempotent):
  review_meta.{lens_label, review_mode_label, ran_at_label, duration_label}
  findings[].{severity_desc, agreement_label, status_label, wont_fix_label}
  loader_warnings_anomalous[].sentence

Public jq-module form (for embedding in larger pipelines):
  jq -L <scripts-dir> 'include "humanize"; humanize' < envelope.json
EOF
      exit 0 ;;
    *) echo "humanize.sh: unknown arg '$1'" >&2; exit 64 ;;
  esac
done

# Read input (file or stdin)
if [ -n "$INPUT_FILE" ]; then
  input_json=$(cat "$INPUT_FILE")
else
  input_json=$(cat)
fi

# Pre-compute date + duration in bash (jq's date math is UTC-only)
invoked_at=$(printf '%s' "$input_json" | jq -r '.review_meta.invoked_at // ""')
completed_at=$(printf '%s' "$input_json" | jq -r '.review_meta.completed_at // ""')
ran_at_label=$(fmt_local_date "$invoked_at")
duration_label=$(fmt_duration "$invoked_at" "$completed_at")

# Apply jq humanize module + inject bash-computed labels
printf '%s' "$input_json" \
  | jq -L "$SCRIPT_DIR" \
       --arg ran_at_label "$ran_at_label" \
       --arg duration_label "$duration_label" \
       'include "humanize";
        humanize
        | .review_meta += {ran_at_label: $ran_at_label, duration_label: $duration_label}'
