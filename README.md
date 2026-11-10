# AIVV — Agentic Independent Validation & Verification

AIVV is an open-source, cross-agent package for structured review of session work, documents, research, plans, designs, decisions, and code, with remediation and calibration. Shared review behavior, prompts, schemas, and state formats are provider-neutral. Host capabilities and provider transport/auth differences are declared in separate adapters; the runtime registry centralizes supported provider IDs, model defaults and acceptance status, and prompt-source metadata. Claude Code and Codex have operational host integrations; Hermes Agent has an experimental local skills-only discovery adapter, with review and remediation capabilities still unverified. The provider registry lists implemented provider IDs and model metadata; each registered provider requires a matching tested transport adapter. Adding another host or provider requires a tested adapter; the shared workflow does not assume that every possible integration is already installed.

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

## Hermes Agent (experimental local discovery)

Hermes can discover AIVV's canonical skills from a clone of the public `main` branch through `skills.external_dirs`; Hermes requires a local filesystem path, so this does not copy skills or install a native Hermes plugin. Discovery is not proof of isolated review, read-only enforcement, persistence, or remediation support. See [INSTALL.md](INSTALL.md) for setup and limitations.

## Documentation

- [Installation and data handling](INSTALL.md)
- [User guide](plugin/.aivv/user-guide.md)
- [Methodology](plugin/.aivv/methodology.md)
- [Runtime contract](plugin/.aivv/runtime-contract.md)
- [Roadmap](docs/roadmap.md)

## Contributing and security

Contributions are considered on a best-effort basis; there is no response-time SLA. See [CONTRIBUTING.md](CONTRIBUTING.md). For security reports, see [SECURITY.md](SECURITY.md).

AIVV is licensed under the [MIT License](LICENSE).
