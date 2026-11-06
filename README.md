# AIVV — Agentic Independent Validation & Verification

AIVV is an open-source, cross-agent package for structured review of session work, documents, research, plans, designs, decisions, and code, with remediation and calibration. It keeps review rules, prompts, schemas, and state formats shared, with host adapters for Claude Code and Codex tool names, permissions, dispatch, and installation. Both hosts have native plugin packages. Codex custom read-only profiles still need a separate install step; the [Codex adapter](plugin/.aivv/platform-adapters/codex.md) records verified desktop review, confirmation, persistence, and restart rediscovery coverage and its limits.

## What it does

- `/aivv` proposes a scope and review approach for you to confirm, then runs a general advisory review. Use `--reviewers=N` for multiple reviewers or `--lens=code` for a code-focused review.
- `/aivv-fix` investigates and remediates selected findings through explicit safety gates.
- `/aivv-calibrate` supports project-specific calibration.
- `/aivv-view` reads AIVV review and fix records.

AIVV reviews static artifacts. It does not replace runtime tests, security testing, or independent organizational review. Multiple model instances can share correlated reasoning, so reviewer agreement is not proof of correctness. See [the methodology](plugin/.aivv/methodology.md).

## Install

In Claude Code, add the marketplace and install AIVV:

```text
/plugin marketplace add iliaim/AIVV
/plugin install aivv@aivv
```

Restart Claude Code after installation, then run `/aivv`. See [INSTALL.md](INSTALL.md) for upgrades, removal, and Codex setup.

For Codex, add the native plugin:

```bash
codex plugin marketplace add iliaim/AIVV --ref main
codex plugin add aivv@aivv
```

From a clone of the AIVV repository, install the read-only reviewer and investigator profiles:

```bash
./scripts/install-codex.sh --scope user
```

Restart Codex, start a new chat, and ask, “Review the changes in this repository with AIVV.” See [INSTALL.md](INSTALL.md) for PowerShell instructions and Codex hook trust details.

## Documentation

- [Installation and data handling](INSTALL.md)
- [User guide](plugin/.aivv/user-guide.md)
- [Methodology](plugin/.aivv/methodology.md)
- [Runtime contract](plugin/.aivv/runtime-contract.md)
- [Roadmap](docs/roadmap.md)

## Contributing and security

Contributions are considered on a best-effort basis; there is no response-time SLA. See [CONTRIBUTING.md](CONTRIBUTING.md). For security reports, see [SECURITY.md](SECURITY.md).

AIVV is licensed under the [MIT License](LICENSE).
