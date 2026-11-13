# AIVV runtime-root contract

Every shipped command that invokes an AIVV helper must resolve and pin one
`AIVV_ROOT` before the invocation reads state, extracts session context, asks a
scope question, or dispatches a reviewer. Do not run
`node tools/<helper>.mjs` from the consuming project: that project is not the
AIVV installation.

For an actual `/aivv` or `/aivv-fix` route, call the selected runtime's
`runtime-root.mjs --preflight <aivv|aivv-fix|aivv-view|aivv-calibrate>` once,
using the profile for the active skill.
The command resolves one root, checks that route's required shared contracts,
helpers, and procedure references, and prints the absolute root. Export that
value as `AIVV_ROOT` for every later helper call and keep all procedure reads in
the same selected runtime. A preflight failure is terminal for the invocation:
surface its single `AIVV_INSTALLATION_INCOMPLETE` diagnostic, repair or
reinstall that installation, restart the host, and retry in a new invocation.
Do not search another cache, borrow matching files from another version, or
retry the same missing reference. Read-only help routes that do not use AIVV
runtime assets may return before preflight.

The `aivv` and `aivv-fix` profiles also validate the source files and referenced
line bounds named by `.aivv/standards/index.json`, so a missing indexed standard
is diagnosed before dispatch rather than when a reviewer requests it.

## Reference resolution

Resolve Markdown links and bare procedure filenames relative to the document
that names them, starting from the absolute path of the loaded `SKILL.md`.
For example, its `references/orchestration-workflow.md` belongs to that skill,
not to `plugin/skills/aivv` under the consuming project's working directory.
Use the loaded package's shared `.aivv` contract and tools through the runtime
resolver below. Standalone skills carry their own `.aivv` bootstrap copy; their
shared runtime remains the sibling `aivv-runtime` selected by the resolver.

Keep procedure reads in that installation for the invocation. Do not substitute
a workspace checkout, another cached version, or a legacy copy merely because
it contains a matching filename. An explicit development override may select a
different runtime; keep that choice visible and use its procedures consistently.

## Helper resolution

For Codex agent and skill paths, `<codex-home>` means `$CODEX_HOME` when it is
set, otherwise `$HOME/.codex` on POSIX; on PowerShell use `$env:CODEX_HOME`
when set, otherwise `$HOME/.codex`. Project-scoped installs continue to use
`<target>/.codex`.

The resolver has one owner, `runtime-root.mjs`; `runtime-root.sh` is only a
POSIX entrypoint for that same resolver. It uses this order:

1. An explicit `AIVV_ROOT` is a development/debugging override and selects
   that path even when incomplete, so preflight can report its missing files.
2. `CLAUDE_PLUGIN_ROOT`, when set, selects the Claude plugin root even when
   incomplete; do not fall through to another cached runtime.
3. `PLUGIN_ROOT`, when set without `CLAUDE_PLUGIN_ROOT`, selects the active
   Codex plugin package even when incomplete; do not fall through to another
   cached runtime.
4. `AIVV_RUNTIME_ROOT_HELPER`, when selected, identifies the resolver to run;
   that resolver selects its own containing AIVV package unless a higher
   priority root override is set.
5. Otherwise, derive the runtime from the loaded skill directory, after
   resolving symlinks, so a skill reached through a linked skills folder
   selects the installation it physically belongs to. A bundled
   plugin resolves to its package root. A standalone skill directory containing
   both `SKILL.md` and `.aivv` is only a bootstrap: select its sibling
   `<codex-root>/aivv-runtime`. If that sibling is missing, keep the bootstrap
   as the selected root so preflight reports the incomplete installation; do
   not fall through to another cache. A legacy skill directory without its own
   `.aivv` resolves to the same sibling runtime. This path-derived branch never
   assumes `$HOME/.codex`.
6. `CODEX_HOME/aivv-runtime` is the fallback for legacy Codex installs that do
   not expose a usable skill directory, including custom Codex roots.
7. As a final self-location fallback, when neither an environment override nor
   a valid skill directory resolves a root, derive it from `runtime-root.mjs`'s
   own file location (two directories up), applying the same standalone-skill
   bootstrap rule. This only succeeds inside an intact AIVV install and exists
   so the resolver can locate itself when invoked with no other context.

Resolve once at invocation start and retain the absolute result. The bootstrap
locates the resolver itself before asking the resolver to choose the runtime
root. This matters for Codex: `SKILL_BASE_DIR` is not guaranteed to be exported
when a skill's materialized script is invoked from an unrelated project
directory. Separate commands must receive the pinned `AIVV_ROOT`; they must not
re-resolve from a changed working directory.

```bash
 AIVV_CODEX_HOME="${CODEX_HOME:-${HOME:-}/.codex}"
 AIVV_SKILL_BASE_DIR="${SKILL_BASE_DIR:-}"
 if [ -n "${AIVV_ROOT:-}" ]; then
   AIVV_RUNTIME_ROOT_HELPER="$AIVV_ROOT/.aivv/runtime-root.mjs"
 elif [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
   AIVV_RUNTIME_ROOT_HELPER="$CLAUDE_PLUGIN_ROOT/.aivv/runtime-root.mjs"
 elif [ -n "${PLUGIN_ROOT:-}" ]; then
   AIVV_RUNTIME_ROOT_HELPER="$PLUGIN_ROOT/.aivv/runtime-root.mjs"
 elif [ -n "${AIVV_RUNTIME_ROOT_HELPER:-}" ]; then
   : # Keep the explicit resolver override.
 elif [ -n "$AIVV_SKILL_BASE_DIR" ] && [ -d "$AIVV_SKILL_BASE_DIR/.aivv" ]; then
   AIVV_RUNTIME_ROOT_HELPER="$AIVV_SKILL_BASE_DIR/.aivv/runtime-root.mjs"
 elif [ -n "$AIVV_SKILL_BASE_DIR" ] && [ -f "$AIVV_SKILL_BASE_DIR/../../plugin.json" ]; then
   AIVV_RUNTIME_ROOT_HELPER="$AIVV_SKILL_BASE_DIR/../../.aivv/runtime-root.mjs"
 elif [ -n "$AIVV_SKILL_BASE_DIR" ] && [ -d "$AIVV_SKILL_BASE_DIR/../../aivv-runtime/.aivv" ]; then
   AIVV_RUNTIME_ROOT_HELPER="$AIVV_SKILL_BASE_DIR/../../aivv-runtime/.aivv/runtime-root.mjs"
 elif [ -n "$AIVV_SKILL_BASE_DIR" ] && [ -d "$AIVV_SKILL_BASE_DIR/../../.aivv" ]; then
   AIVV_RUNTIME_ROOT_HELPER="$AIVV_SKILL_BASE_DIR/../../.aivv/runtime-root.mjs"
 elif [ -n "$AIVV_SKILL_BASE_DIR" ]; then
   AIVV_RUNTIME_ROOT_HELPER="$AIVV_SKILL_BASE_DIR/../../aivv-runtime/.aivv/runtime-root.mjs"
 else
   AIVV_RUNTIME_ROOT_HELPER="$AIVV_CODEX_HOME/aivv-runtime/.aivv/runtime-root.mjs"
 fi
 if [ -z "$AIVV_RUNTIME_ROOT_HELPER" ]; then
   echo "[AIVV] AIVV_INSTALLATION_INCOMPLETE: runtime-root resolver not found in the selected installation. Repair or reinstall this AIVV installation, restart the host, and retry in a new invocation." >&2
   exit 3
 fi
# Set this to the active route: aivv, aivv-fix, aivv-view, or aivv-calibrate.
AIVV_PREFLIGHT_PROFILE="aivv"
if [ ! -f "$AIVV_RUNTIME_ROOT_HELPER" ]; then
  echo "[AIVV] AIVV_INSTALLATION_INCOMPLETE: runtime-root resolver not found in the selected installation. Repair or reinstall this AIVV installation, restart the host, and retry in a new invocation." >&2
  exit 3
fi
if ! AIVV_ROOT="$(node "$AIVV_RUNTIME_ROOT_HELPER" --preflight "$AIVV_PREFLIGHT_PROFILE" "$AIVV_SKILL_BASE_DIR")"; then
  exit 3
fi
export AIVV_ROOT
```

On PowerShell, select exactly one helper before checking that it exists:

```powershell
$AivvCodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$AivvSkillBaseDir = $env:SKILL_BASE_DIR
if ($env:AIVV_ROOT) {
  $AivvRuntimeRootHelper = Join-Path $env:AIVV_ROOT ".aivv/runtime-root.mjs"
} elseif ($env:CLAUDE_PLUGIN_ROOT) {
  $AivvRuntimeRootHelper = Join-Path $env:CLAUDE_PLUGIN_ROOT ".aivv/runtime-root.mjs"
} elseif ($env:PLUGIN_ROOT) {
  $AivvRuntimeRootHelper = Join-Path $env:PLUGIN_ROOT ".aivv/runtime-root.mjs"
} elseif ($env:AIVV_RUNTIME_ROOT_HELPER) {
  $AivvRuntimeRootHelper = $env:AIVV_RUNTIME_ROOT_HELPER
} elseif ($AivvSkillBaseDir -and (Test-Path -LiteralPath (Join-Path $AivvSkillBaseDir ".aivv") -PathType Container)) {
  $AivvRuntimeRootHelper = Join-Path $AivvSkillBaseDir ".aivv/runtime-root.mjs"
} elseif ($AivvSkillBaseDir -and (Test-Path -LiteralPath (Join-Path $AivvSkillBaseDir "../../plugin.json") -PathType Leaf)) {
  $AivvRuntimeRootHelper = Join-Path $AivvSkillBaseDir "../../.aivv/runtime-root.mjs"
} elseif ($AivvSkillBaseDir -and (Test-Path -LiteralPath (Join-Path $AivvSkillBaseDir "../../aivv-runtime/.aivv") -PathType Container)) {
  $AivvRuntimeRootHelper = Join-Path $AivvSkillBaseDir "../../aivv-runtime/.aivv/runtime-root.mjs"
} elseif ($AivvSkillBaseDir -and (Test-Path -LiteralPath (Join-Path $AivvSkillBaseDir "../../.aivv") -PathType Container)) {
  $AivvRuntimeRootHelper = Join-Path $AivvSkillBaseDir "../../.aivv/runtime-root.mjs"
} elseif ($AivvSkillBaseDir) {
  $AivvRuntimeRootHelper = Join-Path $AivvSkillBaseDir "../../aivv-runtime/.aivv/runtime-root.mjs"
} else {
  $AivvRuntimeRootHelper = Join-Path $AivvCodexHome "aivv-runtime/.aivv/runtime-root.mjs"
}
if (-not $AivvRuntimeRootHelper) {
  throw "[AIVV] AIVV_INSTALLATION_INCOMPLETE: runtime-root resolver not found in the selected installation. Repair or reinstall this AIVV installation, restart the host, and retry in a new invocation."
}
if (-not (Test-Path -LiteralPath $AivvRuntimeRootHelper -PathType Leaf)) {
  throw "[AIVV] AIVV_INSTALLATION_INCOMPLETE: runtime-root resolver not found in the selected installation. Repair or reinstall this AIVV installation, restart the host, and retry in a new invocation."
}
# Set this to the active route: aivv, aivv-fix, aivv-view, or aivv-calibrate.
$AivvPreflightProfile = "aivv"
$AIVV_ROOT = (& node $AivvRuntimeRootHelper --preflight $AivvPreflightProfile $env:SKILL_BASE_DIR).Trim()
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:AIVV_ROOT = $AIVV_ROOT
```

Then invoke the helper by absolute path, for example:

```bash
node "$AIVV_ROOT/tools/pre-write-validator.mjs" --fixture <fixture.json>
```

Author-side-only commands may remain relative when they intentionally target the
AIVV source checkout itself. They are not shipped runtime-helper invocations.
