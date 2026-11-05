#!/usr/bin/env bash
# Snapshot external records under the shared lock before shell/jq joins.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
require_jq
runtime_root="$(aivv_view_runtime_root "$SCRIPT_DIR")"
exec node "$SCRIPT_DIR/storage.mjs" "$runtime_root" load "$@"
