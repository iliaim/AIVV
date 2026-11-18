# Contributing to AIVV

Contributions are welcome. The maintainer reviews issues and pull requests on a best-effort basis; there is no formal response-time SLA, and a review or merge is not guaranteed.

## Platform portability

Keep review methodology, prompts, schemas, lenses, and state behavior in the shared AIVV files; put host tool names, permissions, subagent dispatch, install metadata, and path handling in that host's adapter. See [platform-adapters/README.md](plugin/.aivv/platform-adapters/README.md) before adding or changing a host or provider integration.

## Before opening a pull request

1. Explain the user-visible problem or improvement and keep the change focused.
2. Include or update appropriate verification for behavior changes.
3. Run `node --test --test-concurrency=1` (Node 22+) from the repository root. When Claude Code is available, also run `claude plugin validate plugin` and `claude plugin validate .claude-plugin/marketplace.json`; a warning that the plugin manifest omits `version` is expected, because the marketplace entry supplies it. If you edit a standards rule heading, run `node scripts/standards-index.mjs write`. Describe the checks you ran.
4. Do not include credentials, private project data, or review artifacts from real repositories.

Please describe behavior changes and any limitations in the pull request. Maintainers may ask for revisions, defer the change, or close it without merging.

## Licensing

AIVV is distributed under the MIT License. Contributions submitted to this repository are offered for distribution under that license. No separate DCO sign-off or CLA is required.
