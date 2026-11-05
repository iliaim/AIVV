# OpenAI Codex adapter

**Status:** Native plugin package and separate profile installer are verified in isolated Codex CLI homes. Shared skills and runtime ship in the package. Actual cold reviewer and investigator dispatch remains experimental until an end-to-end Codex run is verified.

Install the plugin from Codex CLI:

```bash
codex plugin marketplace add iliaim/AIVV --ref main
codex plugin add aivv@aivv
```

The plugin packages AIVV skills and runtime files. Codex plugin packages do not install the custom read-only reviewer and investigator agent profiles, so full cold dispatch still uses `scripts/install-codex.sh` (macOS/Linux) or `scripts/install-codex.ps1` (PowerShell). Keep results advisory; they are not an independent organizational or compliance audit. See [INSTALL.md](https://github.com/iliaim/AIVV/blob/main/INSTALL.md) for the current setup paths.
