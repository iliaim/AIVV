# AIVV — Agentic Independent Validation & Verification

AIVV is an open-source, cross-agent package for structured code review, remediation, and calibration. It keeps review rules, prompts, schemas, and state formats shared, with host adapters for Claude Code and Codex tool names, permissions, dispatch, and installation. Both hosts have native plugin packages; Codex cold-review and investigation dispatch remains experimental because its custom agent profiles install separately and the full workflow has not yet had an end-to-end Codex check.

## What it does

- `/aivv` runs an advisory review. Use `--reviewers=N` for multiple reviewers or `--lens=<name>` to focus the review.
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

Start a new chat and ask, “Review the changes in this repository with AIVV.” The shell installer described in [INSTALL.md](INSTALL.md) provisions Codex's read-only reviewer and investigator profiles. Full cold dispatch remains experimental until the plugin and profile setup pass an end-to-end Codex run.

## Documentation

- [Installation and data handling](INSTALL.md)
- [User guide](plugin/.aivv/user-guide.md)
- [Methodology](plugin/.aivv/methodology.md)
- [Runtime contract](plugin/.aivv/runtime-contract.md)
- [Roadmap](docs/roadmap.md)

## Contributing and security

Contributions are considered on a best-effort basis; there is no response-time SLA. See [CONTRIBUTING.md](CONTRIBUTING.md). For security reports, see [SECURITY.md](SECURITY.md).

AIVV is licensed under the [MIT License](LICENSE).
