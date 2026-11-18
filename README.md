# AIVV — Agentic Independent Validation & Verification

AIVV gives an AI coding agent a second, independent opinion. It sends fresh reviewer agents — with none of the original conversation — to check your code, documents, plans, or decisions, then helps you investigate and fix what they find, with safety checks before any change. It works in Claude Code and Codex; Hermes Agent support is experimental (discovery only).

## What it does

- `/aivv` announces the resolved scope and approach for a clear explicit read-only review, then proceeds. It asks when scope, authority, or material boundaries are unclear; use `--ask-scope` to request confirmation each run. Use `--reviewers=N` for multiple reviewers or `--lens=code` for a code-focused review.
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

Restart Claude Code, then run `/aivv`.

In Codex, add the native plugin:

```bash
codex plugin marketplace add iliaim/AIVV --ref main
codex plugin add aivv@aivv
```

See [INSTALL.md](INSTALL.md) for the Codex reviewer profiles, PowerShell, and Hermes Agent, plus upgrades and removal.

## Documentation

- [Installation and data handling](INSTALL.md)
- [User guide](plugin/.aivv/user-guide.md)
- [Methodology](plugin/.aivv/methodology.md)
- [Runtime contract](plugin/.aivv/runtime-contract.md)
- [Host and provider adapters](plugin/.aivv/platform-adapters/README.md)
- [Roadmap](docs/roadmap.md)

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md). For security reports, see [SECURITY.md](SECURITY.md).

AIVV is licensed under the [MIT License](LICENSE).
