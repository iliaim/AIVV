# Contributing to AIVV

Contributions are welcome. The maintainer reviews issues and pull requests on a best-effort basis; there is no formal response-time SLA, and a review or merge is not guaranteed.

## Before opening a pull request

1. Explain the user-visible problem or improvement and keep the change focused.
2. Include or update appropriate verification for behavior changes.
3. Run `node tests/security/investigator-bash-guard.test.mjs`. When Claude Code is available, also validate the plugin with `claude plugin validate --profile directory plugin` from the repository root, and describe the checks you ran.
4. Do not include credentials, private project data, or review artifacts from real repositories.

Please describe behavior changes and any limitations in the pull request. Maintainers may ask for revisions, defer the change, or close it without merging.

## Licensing

AIVV is distributed under the MIT License. Contributions submitted to this repository are offered for distribution under that license. No separate DCO sign-off or CLA is required.
