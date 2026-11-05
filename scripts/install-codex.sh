#!/usr/bin/env bash
set -euo pipefail

scope="user"
force="false"
remove_legacy_methodology="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --scope)
      scope="${2:-}"
      shift 2
      ;;
    --scope=*)
      scope="${1#*=}"
      shift
      ;;
    --force)
      force="true"
      shift
      ;;
    --remove-legacy-methodology)
      remove_legacy_methodology="true"
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: scripts/install-codex.sh [--scope user|project] [--force] [--remove-legacy-methodology]

Installs AIVV for Codex by copying skills and subagent TOML files.
Default scope is user, using CODEX_HOME when set and ~/.codex otherwise.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [ "$scope" != "user" ] && [ "$scope" != "project" ]; then
  echo "--scope must be user or project" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
plugin_source_root="${AIVV_PLUGIN_SOURCE_ROOT:-${repo_root}/plugin}"

if [ ! -d "$plugin_source_root/skills" ] || [ ! -d "$plugin_source_root/.aivv" ]; then
  echo "AIVV plugin source root is incomplete: $plugin_source_root" >&2
  exit 1
fi

if [ "$scope" = "user" ] && [ -n "${CODEX_HOME:-}" ]; then
  codex_root="$CODEX_HOME"
elif [ "$scope" = "user" ]; then
  codex_root="${HOME}/.codex"
else
  codex_root="${repo_root}/.codex"
fi
if [ -n "${AIVV_CODEX_ROOT_OVERRIDE:-}" ]; then
  codex_root="$AIVV_CODEX_ROOT_OVERRIDE"
fi

skills_dest="${codex_root}/skills"
agents_dest="${codex_root}/agents"
runtime_dest="${codex_root}/aivv-runtime"

mkdir -p "$skills_dest" "$agents_dest" "$runtime_dest"

copy_skill() {
  local source_name="$1"
  local dest_name="$2"
  local description="$3"
  local rename_frontmatter="$4"
  shift 4
  local deps=("$@")

  local source="${plugin_source_root}/skills/${source_name}"
  local dest="${skills_dest}/${dest_name}"

  if [ ! -d "$source" ]; then
    echo "Missing source skill: $source" >&2
    exit 1
  fi

  if [ -e "$dest" ]; then
    if [ "$force" != "true" ]; then
      echo "Destination exists: $dest (rerun with --force to replace)" >&2
      exit 1
    fi
    rm -rf "$dest"
  fi

  cp -R "$source" "$dest"
  cp -R "${plugin_source_root}/.aivv" "${dest}/.aivv"

  if [ "$rename_frontmatter" = "true" ]; then
    awk '
      BEGIN { done = 0 }
      /^name:[[:space:]]+methodology[[:space:]]*$/ && done == 0 {
        print "name: aivv-methodology"
        done = 1
        next
      }
      { print }
    ' "${dest}/SKILL.md" > "${dest}/SKILL.md.tmp"
    mv "${dest}/SKILL.md.tmp" "${dest}/SKILL.md"
  fi

  mkdir -p "${dest}/agents"
  {
    printf 'name: %s\n' "$dest_name"
    printf 'description: %s\n' "$description"
    printf 'invocation_policy: explicit\n'
    printf 'tool_dependencies:\n'
    for dep in "${deps[@]}"; do
      printf '  - %s\n' "$dep"
    done
  } > "${dest}/agents/openai.yaml"
}

copy_support_dir() {
  local rel_path="$1"
  local source="${plugin_source_root}/${rel_path}"
  local dest="${runtime_dest}/${rel_path}"

  if [ ! -d "$source" ]; then
    echo "Missing support directory: $source" >&2
    exit 1
  fi

  if [ -e "$dest" ]; then
    if [ "$force" != "true" ]; then
      echo "Support destination exists: $dest (rerun with --force to replace)" >&2
      exit 1
    fi
    rm -rf "$dest"
  fi

  mkdir -p "$(dirname "$dest")"
  cp -R "$source" "$dest"
}

remove_legacy_support_dir() {
  local dest="$1"
  local marker="$2"

  if [ ! -e "$dest" ]; then
    return
  fi

  if [ -e "${dest}/${marker}" ]; then
    rm -rf "$dest"
  else
    echo "Skipping non-AIVV-looking legacy support path: $dest" >&2
  fi
}

write_agent_toml() {
  local name="$1"
  local description="$2"
  local prompt_path="$3"
  local out_path="$4"

  if grep -q "'''" "$prompt_path"; then
    echo "Cannot embed triple-single-quote sequence in TOML developer_instructions: $prompt_path" >&2
    exit 1
  fi

  {
    printf 'name = "%s"\n' "$name"
    printf 'description = "%s"\n' "$description"
    printf 'sandbox_mode = "read-only"\n'
    printf "developer_instructions = '''\n"
    cat <<'EOF'
Read the portable role definition below and follow it exactly. You are running under Codex, not Claude Code.

Codex-specific constraints:
- You are read-only: do not edit, create, delete, move, or overwrite files.
- Use shell commands only for inspection, search, and git reads; never run commands that modify workspace state.
- Do not spawn subagents.
- If web browsing is required by the host policy, use primary sources and cite them in your result.
- Return the structured output requested by the portable role.

Portable role definition:

EOF
    cat "$prompt_path"
    printf "\n'''\n"
  } > "$out_path"
}

copy_skill "aivv" "aivv" "AIVV IV&V review orchestration skill" false \
  apply_patch shell_command spawn_agent
copy_skill "aivv-fix" "aivv-fix" "AIVV finding investigation and remediation skill" false \
  apply_patch shell_command spawn_agent
copy_skill "aivv-calibrate" "aivv-calibrate" "AIVV calibration corpus visualization skill (read-only)" false \
  shell_command
copy_skill "aivv-view" "aivv-view" "AIVV read-only findings viewer skill" false \
  shell_command
copy_skill "methodology" "aivv-methodology" "AIVV methodology support skill" true \
  shell_command

if [ "$force" = "true" ]; then
  remove_legacy_support_dir "${skills_dest}/.aivv" "methodology.md"
  remove_legacy_support_dir "${skills_dest}/skills" "aivv/SKILL.md"
  remove_legacy_support_dir "${skills_dest}/tools" "dispatch.mjs"
fi

copy_support_dir ".aivv"
copy_support_dir "skills"
copy_support_dir "tools"

if [ "$remove_legacy_methodology" = "true" ] && [ -e "${skills_dest}/methodology" ]; then
  rm -rf "${skills_dest}/methodology"
fi

write_agent_toml \
  "aivv-reviewer" \
  "AIVV general advisory reviewer for session work, artifacts, plans, and decisions. Read-only." \
  "${plugin_source_root}/.aivv/prompts/reviewer-role.md" \
  "${agents_dest}/aivv-reviewer.toml"

write_agent_toml \
  "aivv-investigator" \
  "AIVV root-cause investigator for review findings. Read-only." \
  "${plugin_source_root}/.aivv/prompts/investigator-role.md" \
  "${agents_dest}/aivv-investigator.toml"

echo "Installed AIVV Codex skills into $skills_dest"
echo "Installed AIVV Codex subagents into $agents_dest"
echo "Installed AIVV Codex runtime support into ${runtime_dest}/{.aivv,skills,tools}"
echo "Restart Codex to pick up new skills and subagents."
