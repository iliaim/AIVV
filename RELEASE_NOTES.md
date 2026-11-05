# Release notes

## 0.2.2 — cross-agent plugin packaging

- Add native plugin package manifests for Codex and Claude Code around the shared AIVV skills and runtime.
- Document the shared review core and host-specific adapter boundary.
- Prefer the active packaged runtime over a legacy Codex runtime when both are installed.
- Make the Codex profile installer runnable as documented and verify its generated profiles stay read-only.

## 0.2.1 — guard and prompt-boundary fixes

- Clarify how investigator probes follow each host's tool restrictions.
- Keep newline-terminated prompt values inside their nonce fences without an extra blank line.
- Tighten path confinement for dash-prefixed paths and clarify guard regression coverage.
- Remove an unsupported Git flag from the guard's deny pattern.

## 0.2.0 — public preview

- Publish the AIVV plugin source and user documentation under the MIT License.
- Provide review, remediation, calibration, methodology, and read-only report-viewing commands.
- Add per-invocation boundaries around untrusted prompt content and enforce a read-only Bash policy for investigator and reviewer agents.
- Include an experimental Codex installer; Claude Code remains the primary supported host.

This release is a preview. See the README and platform adapter documentation for current limitations and host support.
