# AIVV — Agentic Independent Validation & Verification

AIVV is an open-source Claude Code plugin for structured review of session work, documents, research, plans, designs, decisions, and code. It dispatches isolated reviewers, records findings, and supports a bounded investigate → fix → verify workflow.

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

Restart Claude Code after installation, then run `/aivv`. See [INSTALL.md](INSTALL.md) for upgrades, removal, and the experimental Codex adapter.

## Documentation

- [Installation and data handling](INSTALL.md)
- [User guide](plugin/.aivv/user-guide.md)
- [Methodology](plugin/.aivv/methodology.md)
- [Runtime contract](plugin/.aivv/runtime-contract.md)
- [Roadmap](docs/roadmap.md)

## Contributing and security

Contributions are considered on a best-effort basis; there is no response-time SLA. See [CONTRIBUTING.md](CONTRIBUTING.md). For security reports, see [SECURITY.md](SECURITY.md).

AIVV is licensed under the [MIT License](LICENSE).
