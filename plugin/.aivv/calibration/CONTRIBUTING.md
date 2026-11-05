# Calibration Evidence Contributions

This document covers field-evidence contributions for AIVV calibration only. It
does not change the repository's broader contribution policy.

## Target Quality

Good calibration evidence is tied to a real review or fix run and includes:

- the AIVV version and host used;
- the target project type and relevant context;
- the review/fix command shape;
- the finding or missed finding being evaluated;
- the human judgment: true positive, false positive, false negative, or
  severity/disposition correction;
- enough source or runtime evidence for a maintainer to reproduce the judgment.

Avoid submitting private source, secrets, credentials, customer data, or
unredacted personal data. Redact sensitive content before sharing evidence.

## Capture Format

Use the schema documented in `README.md` and `.aivv/schemas/calibration.json`.
For ordinary local runs, AIVV appends JSONL records under the target project's
`.aivv/calibration/` directory. When sharing evidence manually, include only the
minimal JSONL record plus any non-sensitive supporting excerpt needed to justify
the outcome.

## Maintainer Review

Maintainers should accept calibration evidence only when:

- the target context is clear enough to judge applicability;
- the outcome is supported by source, runtime, or user-confirmed evidence;
- the record does not expose secrets or private data;
- the finding maps to the stated lens, rule, or workflow behavior.

Records that fail those checks should be rejected or returned for clarification
rather than merged into the calibration corpus.
