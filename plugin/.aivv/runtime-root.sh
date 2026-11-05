#!/usr/bin/env bash
# POSIX shell entrypoint for the single-owner Node resolver. The Node form is
# the portable contract for Codex hosts that do not provide Bash.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/runtime-root.mjs" "$@"
