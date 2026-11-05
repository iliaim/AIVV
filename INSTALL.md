# Installing AIVV

AIVV shares its review workflows and data contracts across Claude Code and Codex, with host-specific adapters for tools, permissions, agent dispatch, and installation. Claude Code is supported. The Codex plugin package installs through the native CLI. Its cold-review and investigation profiles need a separate installer, and that full workflow has not yet had an end-to-end Codex check.

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

The native plugin packages AIVV's skills and support files. AIVV's custom read-only reviewer and investigator `.toml` profiles still require the installer below. Profile installation has been smoke-checked; actual cold-review and investigation dispatch remain experimental until an end-to-end Codex run is verified.

Codex may ask you to review and trust the bundled safety hook before it runs. Review the hook definition before enabling it.

## Codex agent profiles (experimental dispatch adapter)

Clone the repository and run the installer for your shell:

```bash
./scripts/install-codex.sh --scope user
```

```powershell
.\scripts\install-codex.ps1 -Scope user
```

Restart Codex after installation. See [the adapter notes](plugin/.aivv/platform-adapters/codex.md) for the current capability boundary.

## Data and permissions

AIVV stores review, fix, and calibration state in a per-user location outside the project checkout. The exact paths, migration behavior, and privacy boundaries are documented in the [runtime contract](plugin/.aivv/runtime-contract.md). Review output can contain excerpts from the target project; handle and share it accordingly.

The runtime requires Node.js on `PATH`. AIVV does not require an npm package or an MCP server.
