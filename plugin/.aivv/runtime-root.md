# AIVV runtime-root contract

Every shipped command that invokes an AIVV helper must resolve `AIVV_ROOT`
through `.aivv/runtime-root.mjs` before invoking the helper. Do not run
`node tools/<helper>.mjs` from the consuming project: that project is not the
AIVV installation.

For Codex agent and skill paths, `<codex-home>` means `$CODEX_HOME` when it is
set, otherwise `$HOME/.codex` on POSIX; on PowerShell use `$env:CODEX_HOME`
when set, otherwise `$HOME/.codex`. Project-scoped installs continue to use
`<target>/.codex`.

The resolver has one owner, `runtime-root.mjs`; `runtime-root.sh` is only a
POSIX entrypoint for that same resolver. It uses this order:

1. An explicit `AIVV_ROOT` is a development/debugging override and must be a
   valid AIVV root.
2. `CLAUDE_PLUGIN_ROOT` identifies the Claude plugin root.
3. `CODEX_HOME/aivv-runtime` is preferred when the host exposes `CODEX_HOME`,
   including custom Codex roots.
4. Otherwise, derive the host root from the loaded skill directory. A Codex
   install resolves to `<codex-root>/aivv-runtime`; a source/Claude layout
   resolves to the plugin root. This path-derived branch never assumes
   `$HOME/.codex`.
5. As a final self-location fallback, when neither an environment override nor
   a valid skill directory resolves a root, derive it from `runtime-root.mjs`'s
   own file location (two directories up). This only succeeds inside an intact
   AIVV install and exists so the resolver can locate itself when invoked with
   no other context.

Resolve once before each helper command using the same setup in every shipped
skill. The bootstrap locates the resolver itself before asking the resolver to
choose the runtime root. This matters for Codex: `SKILL_BASE_DIR` is not
guaranteed to be exported when a skill's materialized script is invoked from an
unrelated project directory.

```bash
 AIVV_CODEX_HOME="${CODEX_HOME:-${HOME:-}/.codex}"
 AIVV_RUNTIME_ROOT_HELPER="${AIVV_RUNTIME_ROOT_HELPER:-}"
 for AIVV_RUNTIME_ROOT_CANDIDATE in \
   "${AIVV_ROOT:-}/.aivv/runtime-root.mjs" \
   "${CLAUDE_PLUGIN_ROOT:-}/.aivv/runtime-root.mjs" \
   "$AIVV_CODEX_HOME/aivv-runtime/.aivv/runtime-root.mjs" \
   "${SKILL_BASE_DIR:-}/.aivv/runtime-root.mjs" \
   "${SKILL_BASE_DIR:-}/../../.aivv/runtime-root.mjs"; do
   if [ -z "$AIVV_RUNTIME_ROOT_HELPER" ] && [ -f "$AIVV_RUNTIME_ROOT_CANDIDATE" ]; then
     AIVV_RUNTIME_ROOT_HELPER="$AIVV_RUNTIME_ROOT_CANDIDATE"
   fi
 done
 if [ -z "$AIVV_RUNTIME_ROOT_HELPER" ]; then
   echo "AIVV runtime-root resolver not found; set AIVV_ROOT, CODEX_HOME, or SKILL_BASE_DIR" >&2
   exit 1
 fi
AIVV_ROOT="$(node "$AIVV_RUNTIME_ROOT_HELPER" --print "${SKILL_BASE_DIR:-}")"
```

On PowerShell, use the same candidate order and the portable Node resolver:

```powershell
$AivvCodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$AivvRuntimeRootHelper = $env:AIVV_RUNTIME_ROOT_HELPER
foreach ($candidate in @(
  $(if ($env:AIVV_ROOT) { Join-Path $env:AIVV_ROOT ".aivv/runtime-root.mjs" }),
  $(if ($env:CLAUDE_PLUGIN_ROOT) { Join-Path $env:CLAUDE_PLUGIN_ROOT ".aivv/runtime-root.mjs" }),
  (Join-Path $AivvCodexHome "aivv-runtime/.aivv/runtime-root.mjs"),
  $(if ($env:SKILL_BASE_DIR) { Join-Path $env:SKILL_BASE_DIR ".aivv/runtime-root.mjs" }),
  $(if ($env:SKILL_BASE_DIR) { Join-Path $env:SKILL_BASE_DIR "../../.aivv/runtime-root.mjs" })
)) {
  if (-not $AivvRuntimeRootHelper -and $candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    $AivvRuntimeRootHelper = $candidate
  }
}
if (-not $AivvRuntimeRootHelper) {
  throw "AIVV runtime-root resolver not found; set AIVV_ROOT, CODEX_HOME, or SKILL_BASE_DIR"
}
$AIVV_ROOT = (& node $AivvRuntimeRootHelper --print $env:SKILL_BASE_DIR).Trim()
```

Then invoke the helper by absolute path, for example:

```bash
node "$AIVV_ROOT/tools/pre-write-validator.mjs" --fixture <fixture.json>
```

Author-side-only commands may remain relative when they intentionally target the
AIVV source checkout itself. They are not shipped runtime-helper invocations.
