# Contributing to AIVV

Contributions are welcome. The maintainer reviews issues and pull requests on a best-effort basis; there is no formal response-time SLA, and a review or merge is not guaranteed.

## Platform portability

Keep review methodology, prompt contracts, schemas, lenses, and state behavior in the shared AIVV files. Put host tool names, permission rules, subagent dispatch, and runtime path handling in the relevant platform adapter. Prefer one shared workflow with small host-specific mappings over separate host copies. Claude Code-only skill frontmatter such as `argument-hint` and `user-invocable` may stay in shared files when the plugin needs them; a strict generic Agent Skills validator can reject these extensions. When changing an adapter, update its capability claims and host-specific install guidance.

## Before opening a pull request

1. Explain the user-visible problem or improvement and keep the change focused.
2. Include or update appropriate verification for behavior changes.
3. Run `node tests/security/investigator-bash-guard.test.mjs` and `node tests/plugin-package.test.mjs`. When Claude Code is available, also run `claude plugin validate --profile directory plugin` from the repository root, and describe the checks you ran.
4. Do not include credentials, private project data, or review artifacts from real repositories.

Please describe behavior changes and any limitations in the pull request. Maintainers may ask for revisions, defer the change, or close it without merging.

## Licensing

AIVV is distributed under the MIT License. Contributions submitted to this repository are offered for distribution under that license. No separate DCO sign-off or CLA is required.
