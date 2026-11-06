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
Existing AIVV destinations are never replaced without --force. With --force,
the current destinations are backed up under the selected Codex root first.
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

required_source_dirs=(
  "${plugin_source_root}/skills/aivv"
  "${plugin_source_root}/skills/aivv-fix"
  "${plugin_source_root}/skills/aivv-calibrate"
  "${plugin_source_root}/skills/aivv-view"
  "${plugin_source_root}/skills/methodology"
  "${plugin_source_root}/.aivv"
  "${plugin_source_root}/skills"
  "${plugin_source_root}/tools"
)
required_source_files=(
  "${plugin_source_root}/.aivv/prompts/reviewer-role.md"
  "${plugin_source_root}/.aivv/prompts/investigator-role.md"
)
for source in "${required_source_dirs[@]}"; do
  if [ ! -d "$source" ]; then
    echo "Missing AIVV source directory: $source" >&2
    exit 1
  fi
done
for source in "${required_source_files[@]}"; do
  if [ ! -f "$source" ]; then
    echo "Missing AIVV source file: $source" >&2
    exit 1
  fi
  if grep -q "'''" "$source"; then
    echo "Cannot embed triple-single-quote sequence in TOML developer_instructions: $source" >&2
    exit 1
  fi
done

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

skill_names=(aivv aivv-fix aivv-calibrate aivv-view aivv-methodology)
support_paths=(.aivv skills tools)
replacement_paths=()
for name in "${skill_names[@]}"; do
  replacement_paths+=("skills/${name}")
done
for rel_path in "${support_paths[@]}"; do
  replacement_paths+=("aivv-runtime/${rel_path}")
done
replacement_paths+=(
  "agents/aivv-reviewer.toml"
  "agents/aivv-investigator.toml"
)

path_exists() {
  [ -e "$1" ] || [ -L "$1" ]
}

conflicts=()
backup_paths=()
for rel_path in "${replacement_paths[@]}"; do
  destination="${codex_root}/${rel_path}"
  if path_exists "$destination"; then
    if [ "$force" = "true" ]; then
      backup_paths+=("${rel_path}")
    else
      conflicts+=("${destination}")
    fi
  fi
done

if [ "$force" = "true" ]; then
  legacy_paths=(
    "skills/.aivv|methodology.md"
    "skills/skills|aivv/SKILL.md"
    "skills/tools|dispatch.mjs"
  )
  for entry in "${legacy_paths[@]}"; do
    rel_path="${entry%%|*}"
    marker="${entry#*|}"
    destination="${codex_root}/${rel_path}"
    if path_exists "$destination" && path_exists "${destination}/${marker}"; then
      backup_paths+=("${rel_path}")
    fi
  done
fi

if [ "$remove_legacy_methodology" = "true" ] && path_exists "${skills_dest}/methodology"; then
  backup_paths+=("skills/methodology")
fi

if [ "${#conflicts[@]}" -gt 0 ]; then
  echo "Existing AIVV destinations found; no files were changed:" >&2
  for destination in "${conflicts[@]}"; do
    printf '  %s\n' "$destination" >&2
  done
  echo "Rerun with --force to back up and replace them." >&2
  exit 1
fi

backup_root=""
if [ "${#backup_paths[@]}" -gt 0 ]; then
  mkdir -p "$codex_root"
  backup_root="$(mktemp -d "${codex_root}/.aivv-install-backup.XXXXXX")"
  for rel_path in "${backup_paths[@]}"; do
    source="${codex_root}/${rel_path}"
    backup_destination="${backup_root}/previous/${rel_path}"
    mkdir -p "$(dirname "$backup_destination")"
    cp -R "$source" "$backup_destination"
  done
  {
    printf 'Original Codex root: %s\n' "$codex_root"
    cat <<'EOF'
Each entry under previous/ mirrors its original relative path under the Codex root.
To restore an entry, copy it back to that same relative path.
EOF
  } > "${backup_root}/README.txt"
  echo "Backed up existing AIVV destinations to $backup_root"
fi

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

if [ "$remove_legacy_methodology" = "true" ] && path_exists "${skills_dest}/methodology"; then
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
