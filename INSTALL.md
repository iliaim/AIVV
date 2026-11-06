# Installing AIVV

AIVV shares review workflows and data contracts across Claude Code and Codex, with host adapters for tools, permissions, agent dispatch, and installation. Codex still needs the separate profile installer. See the [Codex adapter](plugin/.aivv/platform-adapters/codex.md) for verified desktop review, confirmation, persistence, restart rediscovery, and remaining capability boundaries.

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

## Data and permissions

AIVV stores review, fix, and calibration state in a per-user location outside the project checkout. The exact paths, migration behavior, and privacy boundaries are documented in the [runtime contract](plugin/.aivv/runtime-contract.md). Review output can contain excerpts from the target project; handle and share it accordingly.

The runtime requires Node.js on `PATH`. AIVV does not require an npm package or an MCP server.
