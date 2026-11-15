# Release notes

## 0.5.5 — later decisions and run-wide checks

- A completed or failed fix log can now record a decision made after the run on a finding it left `deferred` or `needs_evidence`, such as an owner approval days later. The entry is changed in place and keeps a copy of what it replaces; nothing else in the log can change.
- Each finding closed on evidence still needs its own evidence, but the run's required checks are proven once for the run. A finding no longer has to carry copies of the checks that prove the other findings. A halt now names the check that no evidence proves.

## 0.5.4 — notice repeated repairs

- At Step 4, `/aivv-fix` notes when earlier fix runs on the same project already changed the files it plans to change, newest first, so a loop that starts a fresh run each round can see it is repairing the same area again. The note is report only: it blocks nothing, sets no threshold, and does not count against the rework limit.

## 0.5.3 — nested hand-back and symlinked installs

- `/aivv --fix` and outer-loop chains now return control from the nested fix run to the run that started it, so the outer run closes its progress items and restores the paused step. Progress items are again marked in progress as each phase begins, and the workflow outline maps each phase to its step numbers.
- Resolve symlinks in the loaded skill directory before locating the runtime, so a copy linked into a project's skills folder uses its own runtime instead of a separate, possibly older, Codex install.
- Make the cross-process storage tests use a reliable checkout fixture so they pass on Linux CI.

## 0.5.2 — keep the session's task list

- `/aivv` and `/aivv-fix` add a fixed set of AIVV progress items to the session's existing task list at the current step instead of replacing it, and never rewrite a list they cannot fully reproduce.
- When the outermost run ends, AIVV restores the paused step and continues with the remaining steps only after a clean outcome; otherwise it stops and names the next step.
- Update the Claude Code, Codex, and Hermes adapters with each host's progress-tool behavior.

## 0.5.1 — experimental Hermes skills discovery

- Add an experimental Hermes skills-only adapter with portable instructions for installing canonical skills from a clone of the public `main` branch; discovery does not imply verified review or remediation support.
- Remove the obsolete Hermes-specific adapter and proof artifacts in favor of the documented external-skills route.

## 0.5.0 — provider-neutral runtime

- Centralize provider, model, authentication, and prompt-source metadata; select providers and models through the shared runtime contract.
- Keep shared roles and guidance provider-neutral, with transport, authentication, and host capability details in adapters.
- Add provider-neutrality and adapter-registry coverage to public CI.

## 0.4.2 — skill metadata and CI maintenance

- Keep Claude Code skill metadata required for its plugin UX and document the host-specific validation path.
- Remove repeated `/aivv-fix` reference callouts where the progressive-disclosure index already defines the trigger.
- Upgrade CI actions to their current Node 24-compatible major versions.

## 0.4.1 — readable review scope

- Show a clear scope and method proposal before review dispatch, and repeat the resolved scope after clarification.
- Bind procedure loading to the installed plugin layout.

## 0.4.0 — streamlined scope resolution

- Proceed with clearly scoped review requests without a second approval; clarify material ambiguity and use `--ask-scope` when explicit approval is wanted.
- Resolve reviewer count and provider consent after applying the final confidence floor and review shape.
- Simplify shared skill guidance by routing detailed procedures to canonical references.

## 0.3.1 — scope announcements and routine edits

- Announce resolved scope and method for clear explicit read-only reviews by default; ask for genuine ambiguity, missing authority, material scope expansion, or an explicit ask preference.
- Keep per-intent approval for explicitly unknown risky shapes, while ordinary source/config language labels and inert prompt-shaped fixture text use the existing write-intent, challenge, target-path, and verification gates.

## 0.3.0 — general review and confirmed scope

- Default to the `general` lens for documents, research, plans, designs, workflows, decisions, and code. Explicit configured lenses remain unchanged; historical findings retain their original lens semantics.
- Confirm the subject, boundaries, and review approach before every review pass, including clear file requests and outer-loop passes. Legacy `announce` settings and `--auto-scope` warn and require confirmation; unavailable prompts leave the review pending.
- Select relevant evidence, standards, and review methods using a shared checklist that covers accuracy, completeness, fitness for purpose, design, alternatives, and proportionate improvements.
- Include the checklist in portable reviewer prompts and distinguish general and code reviews in report labels.
- Rate non-code general findings by their consequences; code-era financial and keyword shortcuts do not automatically make a bounded document error CRITICAL. Software severity policies remain in effect.

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
