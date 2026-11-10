# Installing AIVV

AIVV shares review workflows and data contracts across hosts, with host adapters for tools, permissions, agent dispatch, and installation. Claude Code and Codex have operational integrations; Hermes Agent currently has an experimental local skills-only discovery adapter, not verified review or remediation support. Codex still needs the separate profile installer. See the [Codex adapter](plugin/.aivv/platform-adapters/codex.md) for verified desktop review, confirmation, persistence, restart rediscovery, and remaining capability boundaries.

## Claude Code

In a Claude Code session, run:

```text
/plugin marketplace add iliaim/AIVV
/plugin install aivv@aivv
```

The equivalent terminal commands are:

```bash
claude plugin marketplace add iliaim/AIVV
claude plugin install aivv@aivv
```

Restart Claude Code, confirm AIVV appears in `/plugin`, and run `/aivv` in a repository you want reviewed.

To update, run `/plugin update aivv`. To remove AIVV, run `/plugin uninstall aivv`.

## Codex plugin

From Codex CLI, add the AIVV marketplace and install the plugin:

```bash
codex plugin marketplace add iliaim/AIVV --ref main
codex plugin add aivv@aivv
```

Start a new Codex chat and ask: `Review the changes in this repository with AIVV.`

The native plugin packages AIVV's skills and support files. AIVV's custom read-only reviewer and investigator `.toml` profiles still require the installer below. The [adapter notes](plugin/.aivv/platform-adapters/codex.md) record the verified coverage and limits.

Codex skips bundled plugin hooks until a user reviews and trusts the current hook definition. Review `plugin/hooks/hooks.json` and `plugin/tools/investigator-bash-guard.mjs` before enabling the AIVV hook. If the hook is not trusted, Codex still enforces the profile's read-only sandbox, but the additional command allowlist from the hook is not active.

## Codex agent profiles

Clone the repository and run the installer for your shell:

```bash
./scripts/install-codex.sh --scope user
```

```powershell
.\scripts\install-codex.ps1 -Scope user
```

Restart Codex after installation. See [the adapter notes](plugin/.aivv/platform-adapters/codex.md) for the current capability boundary.

The installer checks all AIVV destinations before changing files. If it finds an existing destination, it stops and lists the conflicts. To upgrade, rerun with `--force` (PowerShell: `-Force`). The installer first copies every existing AIVV destination to a hidden `.aivv-install-backup.*` directory under the selected Codex root and prints its path. The `previous/` directory preserves each original path, so local edits can be restored from that backup; the installer does not merge local edits into the new files.

## Hermes Agent (experimental local skills-only route)

Hermes does not need an AIVV Python plugin or copied skill files. Point one Hermes profile's `skills.external_dirs` at the `plugin/skills` directory in an AIVV checkout. This exposes the existing canonical skills; it does **not** establish that AIVV review dispatch, reviewer isolation, read-only enforcement, persistence, peer-skill chaining, or remediation works in Hermes.

### Install

1. Clone the canonical AIVV source from the public `main` branch, or use an existing checkout:

   ```bash
   git clone --branch main https://github.com/iliaim/AIVV.git AIVV
   ```

   Hermes external skill directories are local filesystem paths, not GitHub URLs. For updates to a clean clone, run `git -C /path/to/AIVV pull --ff-only origin main` after checking for local changes. Note the absolute path to the checkout's `plugin/skills` directory.
2. Choose the Hermes profile explicitly and inspect its current external directories:

   ```bash
   hermes profile list
   hermes -p default config path
   hermes -p default config get skills.external_dirs
   ```

3. Ensure template substitution is enabled, then add the AIVV skills root. Replace the example path with the real absolute path:

   ```bash
   hermes -p default config set skills.template_vars true
   hermes -p default config set skills.external_dirs '["/absolute/path/to/AIVV/plugin/skills"]'
   ```

   `skills.external_dirs` replaces the full list. If the profile already has entries, include those existing paths plus the AIVV path in the new JSON list; do not accidentally remove other skill sources. Use `hermes -p <profile>` consistently for a non-default profile.

4. From the local terminal, verify Node and all operational route preflights. Set `AIVV_PLUGIN` to the checkout's `plugin` directory:

   ```bash
   AIVV_PLUGIN="/absolute/path/to/AIVV/plugin"
   for skill in aivv aivv-fix aivv-view aivv-calibrate; do
     node "$AIVV_PLUGIN/.aivv/runtime-root.mjs" --preflight "$skill" "$AIVV_PLUGIN/skills/$skill" || exit 1
   done
   ```

5. Verify the profile-specific discovery list, then start a new Hermes session or run `/reload-skills` in an existing session. The CLI should show the five AIVV entries as external and enabled:

   ```bash
   hermes -p default skills list --source local --enabled-only
   ```

   In-session, use Hermes `skills_list` and `skill_view` to confirm the names `aivv`, `aivv-fix`, `aivv-view`, `aivv-calibrate`, and `methodology` and check their loaded source.

### Limits and maintenance

- **Local terminal backend only for now.** Hermes and its terminal backend must access the same AIVV path and have Node.js on `PATH`. Docker, SSH, and other remote terminal backends are unsupported until path and Node access are verified from inside that backend.
- `/aivv-view` additionally requires Bash and `jq` 1.6 or later. Other commands may have their own existing AIVV runtime requirements.
- Hermes ignores Claude Code's `user-invocable: false` frontmatter, so the support-only `methodology` skill also appears as `/methodology` in Hermes. This is a known visibility difference.
- Hermes resolves same-named skills in this order: project, profile-local, `skills.create_dir` (if configured), then external directories. A higher-priority skill can shadow AIVV; verify the loaded skill source when results are unexpected.
- The external directory is the live AIVV checkout, not a copy or pinned snapshot. Its contents are writable if Hermes tools and OS permissions allow it. `skills.write_approval` only gates skill-manager writes, applies to the whole profile, and is **not** a filesystem sandbox. Use an OS-enforced read-only source if you need write protection.
- If the old AIVV Hermes plugin is already installed and its command surface overlaps, first verify the external skills, then disable the old plugin in that same profile with `hermes -p <profile> plugins disable aivv`. Disabling is reversible; do not remove its files or stored data as part of this setup.
- To update, update the AIVV checkout and reload/restart the Hermes session. To uninstall, remove only the AIVV path from that profile's `skills.external_dirs` list while preserving the other entries.

## Data and permissions

AIVV stores review, fix, and calibration state in a per-user location outside the project checkout. The exact paths, migration behavior, and privacy boundaries are documented in the [runtime contract](plugin/.aivv/runtime-contract.md). Review output can contain excerpts from the target project; handle and share it accordingly.

The runtime requires Node.js on `PATH`. AIVV does not require an npm package or an MCP server.
