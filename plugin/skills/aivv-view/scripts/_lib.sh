# skills/aivv-view/scripts/_lib.sh — shared helpers; source from view.sh and view-loader.sh
aivv_view_runtime_root() {
  local script_dir="${1:-}"
  local skill_dir="${2:-}"
  local runtime_root_helper=""

  if [ -z "$script_dir" ]; then
    echo "aivv-view: runtime-root resolution requires the script directory." >&2
    return 64
  fi
  if [ -z "$skill_dir" ]; then
    skill_dir="$(cd "$script_dir/.." 2>/dev/null && pwd)" || return 1
  fi

  local codex_home="${CODEX_HOME:-${HOME:-}/.codex}"
  if [ -n "${AIVV_ROOT:-}" ]; then
    runtime_root_helper="$AIVV_ROOT/.aivv/runtime-root.mjs"
  elif [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    runtime_root_helper="$CLAUDE_PLUGIN_ROOT/.aivv/runtime-root.mjs"
  elif [ -n "${PLUGIN_ROOT:-}" ]; then
    runtime_root_helper="$PLUGIN_ROOT/.aivv/runtime-root.mjs"
  elif [ -n "${AIVV_RUNTIME_ROOT_HELPER:-}" ]; then
    runtime_root_helper="$AIVV_RUNTIME_ROOT_HELPER"
  elif [ -f "$skill_dir/../../plugin.json" ]; then
    runtime_root_helper="$skill_dir/../../.aivv/runtime-root.mjs"
  elif [ -d "$skill_dir/.aivv" ]; then
    runtime_root_helper="$skill_dir/.aivv/runtime-root.mjs"
  else
    runtime_root_helper="$codex_home/aivv-runtime/.aivv/runtime-root.mjs"
  fi

  if [ ! -f "$runtime_root_helper" ]; then
    echo "[AIVV] AIVV_INSTALLATION_INCOMPLETE: runtime-root resolver not found in the selected installation. Repair or reinstall this AIVV installation, restart the host, and retry in a new invocation." >&2
    return 3
  fi
  node "$runtime_root_helper" --preflight aivv-view "$skill_dir"
}

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    cat >&2 <<'EOF'
aivv-view: jq is required for the viewer's loader. AIVV soft-requires jq globally (per dev.110+ platform-adapters); the viewer hard-fails at invocation because no degraded mode exists.

Install jq (version 1.6 or later — the loader uses `INDEX()` + `input_filename` + `IN()` which need 1.6+):

  macOS:           brew install jq
  Debian/Ubuntu:   sudo apt install jq
  Fedora/RHEL:     sudo dnf install jq
  Arch Linux:      sudo pacman -S jq
  Alpine:          apk add jq
  Windows:         winget install jq    (or `scoop install jq`, `choco install jq`)
  Other:           https://jqlang.github.io/jq/download/

Verify after install:
  jq --version     # should print "jq-1.6" or later

Once installed, re-run `/aivv view`.
EOF
    exit 127
  fi

  # Version check — loader needs 1.6+ features
  local jq_ver
  jq_ver=$(jq --version 2>/dev/null | sed -E 's/^jq-//; s/[^0-9.].*$//')
  local major minor
  major=$(echo "$jq_ver" | cut -d. -f1)
  minor=$(echo "$jq_ver" | cut -d. -f2)
  if [ "$major" -lt 1 ] || { [ "$major" -eq 1 ] && [ "$minor" -lt 6 ]; }; then
    cat >&2 <<EOF
aivv-view: jq $jq_ver detected; viewer requires jq 1.6 or later (uses INDEX() / IN() / input_filename).

Upgrade jq and re-run \`/aivv view\`. See https://jqlang.github.io/jq/download/ for upgrade paths.
EOF
    exit 127
  fi
}

require_fzf() {
  if ! command -v fzf >/dev/null 2>&1; then
    cat >&2 <<'EOF'
aivv-view: fzf is required for the interactive TUI (Phase 1).

Install fzf (version 0.21 or later):
  macOS:         brew install fzf
  Debian/Ubuntu: sudo apt install fzf
  Fedora/RHEL:   sudo dnf install fzf
  Arch Linux:    sudo pacman -S fzf
  Alpine:        apk add fzf
  Other:         https://github.com/junegunn/fzf#installation

Without fzf, run --summary for a plain-text view instead.
EOF
    return 1
  fi

  # Version check — loader uses execute-silent + reload actions (fzf 0.21+)
  local fzf_ver major minor
  fzf_ver=$(fzf --version 2>/dev/null | sed -E 's/^([0-9]+\.[0-9]+).*/\1/')
  major=$(echo "$fzf_ver" | cut -d. -f1)
  minor=$(echo "$fzf_ver" | cut -d. -f2)
  if [ -z "$major" ] || { [ "$major" -eq 0 ] && [ "$minor" -lt 21 ]; }; then
    cat >&2 <<EOF
aivv-view: fzf $fzf_ver detected; viewer requires fzf 0.21 or later (uses reload + execute-silent actions).

Upgrade fzf and re-run. See https://github.com/junegunn/fzf#installation
EOF
    return 1
  fi
  return 0
}

open_report() {
  local report_path="${1:-}"
  if [ -z "$report_path" ]; then
    echo "aivv view: open_report requires a report path." >&2
    return 64
  fi

  if [ "${AIVV_QUIET:-0}" = "1" ] || [ "${AIVV_HEADLESS:-0}" = "1" ]; then
    return 0
  fi

  if [ "${CI:-}" = "true" ]; then
    return 0
  fi

  if [[ "${OSTYPE:-}" == linux* ]] && [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
    return 0
  fi

  if command -v open >/dev/null 2>&1; then
    open "$report_path" >/dev/null 2>&1 && return 0
  fi
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$report_path" >/dev/null 2>&1 && return 0
  fi
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command 'Start-Process -LiteralPath $args[0]' "$report_path" >/dev/null 2>&1 && return 0
  fi
  if command -v powershell >/dev/null 2>&1; then
    powershell -NoProfile -Command 'Start-Process -LiteralPath $args[0]' "$report_path" >/dev/null 2>&1 && return 0
  fi

  echo "aivv view: warning: no opener found for '$report_path' (tried open, xdg-open, powershell.exe, powershell)." >&2
  return 0
}

# Emit review logs from the active state directory and its archival sibling.
# A closed log may be moved to archive/ by maintenance, so every viewer surface
# reads their union. The active copy wins when the same filename is present in
# both locations; that makes a restore/retry deterministic rather than silently
# showing two copies of one review.
aivv_view_storage() {
  local runtime_root
  runtime_root="$(aivv_view_runtime_root "$SCRIPT_DIR")" || return
  if [ -n "${AIVV_VIEW_STORAGE_CONTEXT:-}" ]; then
    node "$SCRIPT_DIR/storage.mjs" "$runtime_root" "$@" --storage-context "$AIVV_VIEW_STORAGE_CONTEXT"
  else
    node "$SCRIPT_DIR/storage.mjs" "$runtime_root" "$@"
  fi
}

aivv_view_default_state() {
  aivv_view_storage context | jq -r '.state_dir'
}

aivv_view_visible() {
  aivv_view_storage visible "$1"
}

aivv_view_review_files() {
  aivv_view_storage reviews "$1" "${AIVV_VIEW_INCLUDE_HISTORY:-explicit}"
}

# A historical review joins only its own historical companions. Never mix a
# frozen legacy registry with active external decisions.
aivv_view_state_for_review() {
  local directory
  directory="$(dirname "$1")"
  if [ "$(basename "$directory")" = archive ]; then directory="$(dirname "$directory")"; fi
  printf '%s\n' "$directory"
}

# Renderer stderr is untrusted and can contain credentials in formats that a
# redactor does not yet recognize. Keep the diagnostic deliberately generic:
# the caller still gets the failure and exit code without any emitted content.
aivv_view_sanitized_error() {
  printf '%s' 'renderer failed; diagnostic details were suppressed'
}

# Date formatting helpers — used by view.sh's summary mode + (future) report renderer.
# jq's date math is UTC-only; bash formats local-time via system `date` with fallback
# between GNU coreutils (`date -d`) and BSD `date` (`date -j -f`). Both invocation
# styles are tried so the helpers work on macOS, Linux, and Git Bash on Windows.
#
# fmt_local_date "<iso8601-utc>"  →  "Sat May 16, 2026 at 6:54 PM"  (local time, no zone suffix)
# fmt_duration   "<start>" "<end>"  →  "3m 43s"  (or "—" if either input is empty)
fmt_local_date() {
  local iso="${1:-}"
  [ -z "$iso" ] && { echo "—"; return; }
  # Strip fractional seconds before BSD date: "2026-05-17T18:08:40.000Z" → "2026-05-17T18:08:40Z"
  # 100% of real review-log timestamps use .NNNz form; BSD date -j -f ignores this without stripping.
  local iso_clean
  iso_clean=$(printf '%s' "$iso" | sed -E 's/\.[0-9]+Z$/Z/')
  # GNU date (Linux, modern Git Bash):
  if date -d "$iso_clean" "+%a %b %-d, %Y at %-I:%M %p" 2>/dev/null; then
    return
  fi
  # BSD date (macOS):
  if date -j -f "%Y-%m-%dT%H:%M:%SZ" "$iso_clean" "+%a %b %-d, %Y at %-I:%M %p" 2>/dev/null; then
    return
  fi
  # Final fallback: emit ISO as-is rather than crash
  echo "$iso"
}

fmt_duration() {
  local start="${1:-}" end="${2:-}"
  [ -z "$start" ] || [ -z "$end" ] && { echo "—"; return; }
  # Strip fractional seconds from both timestamps (same .000Z corpus issue as fmt_local_date).
  local start_clean end_clean
  start_clean=$(printf '%s' "$start" | sed -E 's/\.[0-9]+Z$/Z/')
  end_clean=$(printf '%s' "$end" | sed -E 's/\.[0-9]+Z$/Z/')
  local s_epoch e_epoch
  s_epoch=$(date -d "$start_clean" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$start_clean" +%s 2>/dev/null || echo "")
  e_epoch=$(date -d "$end_clean"   +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$end_clean"   +%s 2>/dev/null || echo "")
  if [ -z "$s_epoch" ] || [ -z "$e_epoch" ]; then echo "—"; return; fi
  local diff=$(( e_epoch - s_epoch ))
  echo "$(( diff / 60 ))m $(( diff % 60 ))s"
}
