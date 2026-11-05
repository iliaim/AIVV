# Installing AIVV

AIVV is distributed as a Claude Code plugin. The Codex adapter is experimental; Claude Code is the primary supported host.

## Claude Code

In a Claude Code session, run:

```text
/plugin marketplace add iliaim/AIVV
/plugin install aivv@aivv
```

Restart Claude Code, confirm AIVV appears in `/plugin`, and run `/aivv` in a repository you want reviewed.

To update, run `/plugin update aivv`. To remove AIVV, run `/plugin uninstall aivv`.

## Codex (experimental)

Clone the repository and run the installer for your shell:

```bash
./scripts/install-codex.sh --scope user
```

```powershell
.\scripts\install-codex.ps1 -Scope user
```

Restart Codex after installation. The Codex adapter remains experimental; see [the adapter notes](plugin/.aivv/platform-adapters/codex.md).

## Data and permissions

AIVV stores review, fix, and calibration state in a per-user location outside the project checkout. The exact paths, migration behavior, and privacy boundaries are documented in the [runtime contract](plugin/.aivv/runtime-contract.md). Review output can contain excerpts from the target project; handle and share it accordingly.
