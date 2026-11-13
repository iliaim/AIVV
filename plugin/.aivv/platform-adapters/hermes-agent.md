# Platform Adapter: Hermes Agent

**Host:** Hermes Agent
**Status:** Experimental, skills-only integration; discovery is not full AIVV workflow support.
**Distribution:** Clone the public AIVV `main` branch and add one local Hermes `skills.external_dirs` entry pointing at its canonical `plugin/skills/` tree. No machine-specific paths, native Hermes plugin, duplicate skill copies, provider implementation, or installer script.
**Initial runtime scope:** Local terminal backend only. The Hermes process and terminal must be able to read the same AIVV checkout and run Node.js. `/aivv-view` also requires Bash and `jq` >= 1.6.

## Discovery and invocation

The canonical AIVV skill tree contains `/aivv`, `/aivv-fix`, `/aivv-view`, `/aivv-calibrate`, and `methodology`. Hermes discovers them through `skills.external_dirs`; it does not use the old Hermes plugin, adapter JSON, or proof artifacts.

Hermes does not implement Claude Code's `user-invocable: false` frontmatter. Pointing the external directory at the complete AIVV skill root therefore also exposes `/methodology` as a user-visible command. This is a known visibility difference; `methodology` remains shared support material and is not a separate AIVV workflow.

Hermes resolves same-named skills from project, profile-local, and other higher-priority roots before external directories. Check for collisions or shadowing when verifying discovery; do not assume the AIVV copy wins merely because the path is configured.

## Runtime root and reference loading

AIVV requires Node.js on `PATH` and one canonical `AIVV_ROOT` per invocation. Hermes substitutes `${HERMES_SKILL_DIR}` inside `SKILL.md` body text only when `skills.template_vars: true` (the default). It is substituted text, not an exported shell variable, and support-file content returned by `read_file` or `skill_view` is not template-expanded. Before executing an example from this adapter or another support file, replace `${HERMES_SKILL_DIR}` with the concrete absolute skill directory already shown in the expanded calling `SKILL.md`; never pass the literal token to the terminal. If the token remains literal in the active `SKILL.md` body, stop with the installation diagnostic; do not enable inline-shell expansion as a workaround.

When a shared skill example passes `${SKILL_BASE_DIR:-}` to the resolver, substitute the concrete calling-skill directory in that argument. Hermes does not export `SKILL_BASE_DIR` or `HERMES_SKILL_DIR` as shell variables.

Run the selected route's resolver directly, quoting the substituted skill path:

```bash
node "${HERMES_SKILL_DIR}/../../.aivv/runtime-root.mjs" --preflight aivv "${HERMES_SKILL_DIR}"
```

Use the matching route name for `/aivv-fix`, `/aivv-view`, or `/aivv-calibrate`. Capture the absolute package root printed by preflight, then pass that same root explicitly to all helpers in the invocation. Do not assume a shell variable survives between separate Hermes terminal calls or re-resolve from the reviewed project's working directory. A preflight failure is terminal for the invocation; surface its one `AIVV_INSTALLATION_INCOMPLETE` diagnostic and stop.

Hermes `skill_view` only serves support files inside the selected skill directory, rejects `..` traversal and absolute paths, and does not template-expand returned support-file content. Therefore:

- Use `skill_view(name, file_path="references/...")` for references inside that skill directory.
- Use `skill_view(name="aivv")` to load another AIVV skill by name.
- Use Hermes `read_file` with an absolute path derived from the substituted `${HERMES_SKILL_DIR}` for sibling `.aivv/` contracts and adapters. Do not try to open `../../.aivv/...` with `skill_view`.

## Hermes tool mapping

| AIVV operation | Hermes surface | Boundary |
|---|---|---|
| List/load a skill | `skills_list`, `skill_view` | Loader discovery only; it does not establish operational capability. |
| Read source or shared contract | `read_file` | Use absolute AIVV paths for files outside the loaded skill directory. |
| Search source | `search_files` | Scope searches to the confirmed AIVV root or user-authorized target. |
| Run Node/Git/Bash helpers | `terminal` | Local backend only until another backend's path/Node access is verified. |
| Create/edit files | `write_file`, `patch`, `terminal` | Follow AIVV's existing scope, write-intent, pre-write validation, and verification gates. Do not infer that Hermes skill-write approval protects general file or shell writes. |
| Track progress | `todo_list` | Optional host progress surface; absence does not change AIVV safety gates. Its list semantics are unverified: follow `.aivv/session-continuity.md` and use text updates when the existing list cannot be preserved. |
| Delegate work | `delegate_task` | The tool exists, but isolation and read-only properties are not established by its presence. Do not use it for AIVV reviewer/investigator dispatch until the capability gate is passed. |

## Initial capability status

The only initial capability claim is conditional asset resolution: the selected profile must load the canonical external skill root, template variables must resolve, the local terminal must reach that path and Node, and the route preflight must pass. Every operational capability below remains `unverified` until its own probe is documented. Skill discovery alone is not evidence for these claims.

| Runtime-contract capability | Initial status | Consequence |
|---|---|---|
| `can_resolve_skill_assets` | `conditional` | Require the path/template/Node preflight above. |
| `can_spawn_cold_agents` | `unverified` | Do not dispatch review or investigation agents. |
| `can_isolate_reviewer_context` | `unverified` | Make no reviewer-independence claim. |
| `can_hide_peer_outputs_until_synthesis` | `unverified` | Do not claim independent consensus. |
| `can_parallelize_agents` | `unverified` | Do not infer safe parallel review from delegation availability. |
| `can_read_conversation_history` | `unverified` | Mark missing session fields unavailable. |
| `can_read_tool_history` | `unverified` | Do not infer files touched from incomplete history. |
| `can_enforce_readonly` | `unverified` | No strong read-only claim; `skills.write_approval` only gates `skill_manage` writes and is not a filesystem sandbox. |
| `can_write_project_state` | `unverified` | Do not claim AIVV persistence works until shared-helper writes and readback are tested. |
| `can_invoke_peer_skill` | `unverified` | Do not auto-chain; provide a manual next-command handoff only after the relevant workflow is validated. |
| `can_emit_runtime_probe_scaffolds` | `unverified` | Do not claim runtime probe generation. |
| `can_ingest_runtime_results` | `unverified` | Do not claim runtime-result ingestion. |
| `can_invoke_playwright_mcp` | `unverified` | Optional host-specific capability; no default assumption. |
| `can_persist_screenshot_artifacts` | `unverified` | Do not claim screenshot-baseline support. |
| `can_receive_remediation_request` | `unverified` | Do not claim Action Inbox handoff support. |

Complete host-specific probes before promoting any status. Keep shared methodology, state formats, schemas, and provider adapters in their existing AIVV locations; add Hermes-specific behavior here rather than forking shared workflows.