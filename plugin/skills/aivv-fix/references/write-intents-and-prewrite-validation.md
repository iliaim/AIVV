# Write Intents And Prewrite Validation

Read from `skills/aivv-fix/SKILL.md` before materializing write intents or running pre-write validation. The point at which write readiness feeds final Auto-eligible / Decision queue / dangerous-auto-approved routing is centralized in [execution-decisioning.md](execution-decisioning.md).

**Canonical producer-write contract:** this file is the authoritative prose contract for `write_intents[]`, write-intent required fields, branch/kind enums, hash semantics, detector-result shape, stale-intent invalidation, bypass invalidation, target-path safety, and Step 5.4 assertion kinds. Sibling references may summarize these fields for prompt readability, but changes to producer semantics must land here first and then be reflected in `.aivv/schemas/fix-log.json`, `"$AIVV_ROOT/tools/pre-write-validator.mjs"`, and the registered alignment/tests.

## Contents

- Write intent materialization
- Hash semantics and stale-intent invalidation
- Detector and assertion registry
- Step 5.4 pre-write validation

### Step 4.4: MATERIALIZE WRITE INTENTS — inspectable proposed bytes

Before Step 4.5 CHALLENGE can dispatch and before Step 5 can mention or use any host write primitive, every write-capable Branch A/B/C-localized/D fix in the approved batch MUST materialize `write_intents[]`. Branch B documentation writes MUST also materialize `write_intents[]` because `verbatim_doc_content` is proposed write content. `write_intents[]` is the only approved pre-write surface for generated content; do not ask challengers, validators, or host write tools to infer pending bytes from `fix_proposal.description`.

If a write-capable branch has empty `write_intents[]`, missing `write_intents[]`, or an intent whose proposed bytes cannot be made inspectable before write, HALT as `no-pre-write-inspectable-intent` and re-enter Step 3 INVESTIGATE with the missing materialization reason appended. Do not continue to Step 4.5 challenger dispatch, Step 5.4 validation, or any host write primitive.

Each `write_intents[]` item has these required fields:
- `id`: stable per-invocation ID, unique within the current fix session.
- `finding_id`: finding that produced the intent.
- `branch`: one of `A`, `B`, `C-fallthrough-A`, or `D`.
- `target_file`: relative path inside the resolved target project.
- `operation`: `edit`, `create`, or `replace`.
- `kind`: `generated_patch`, `verbatim_doc_content`, or `process_rule_content`.
- `content_sha`: lowercase hex SHA-256 for the full proposed content, never a truncated snapshot.
- `source_step`: `Step 4.4`.
- `pre_write_assertions`: array, possibly empty until Task 3 detector rules require entries.

Branch-specific production rules:
- **Branch A** materializes `kind: "generated_patch"` intents with exact preimage/postimage pairs. Opaque patch-hunk-only intents are not accepted. Multi-hunk edits must be decomposed into ordered `proposed_edits[]` entries, each with exact `old_string`, exact `new_string`, and `content_sha`. If a hunk cannot be decomposed to exact old/new text before write, HALT as `no-pre-write-inspectable-intent`.
- **Branch B** materializes `kind: "verbatim_doc_content"` intents from `fix_proposal.verbatim_doc_content`. `fix_proposal.description` is never documentation content and must not be written as a fallback.
- **Branch C localized design changes** that fall through into Branch A inherit the Branch A `write_intents[]` materialization, detector, Step 4.5 inert snapshot, and Step 5.4 pre-write validation contract exactly. ADR-worthy Branch C writes are outside Branch A fallthrough but still must expose their ADR bytes through a write intent before any new ADR file is written.
- **Branch D** materializes `kind: "process_rule_content"` intents for process/rule/doc updates before editing `maintainer guidance`, `AGENTS.md`, `.cursor/rules/`, `docs/CONTRIBUTING.md`, or equivalent rule surfaces.

Hash semantics:
- For Branch B/D whole-text intents, `content_sha` is SHA-256 over the exact raw UTF-8 bytes of `exact_content_or_patch`, LF bytes preserved, with no line-ending normalization. Challenger snapshot truncation never changes `content_sha`; hashes always identify the full original proposed content.
- For Branch A `proposed_edits[].content_sha`, compute SHA-256 over deterministic length-prefixed framing: `old_bytes=<byte_length>\n<old_string>\nnew_bytes=<byte_length>\n<new_string>`, using raw UTF-8 byte lengths.
- For a Branch A multi-edit top-level `content_sha`, compute SHA-256 over deterministic concatenation of each `proposed_edits[]` framing in array order, separated by `\n--aivv-edit-boundary--\n`.

B4 is text-write safety only. Any proposed intent whose old/new content contains NUL bytes or non-text binary data HALTS as `unsupported-risky-shape` and requires a separate future design; it must not pass through Branch A/B/D B4 validators.

Stale-intent invalidation:
- Immediately before a host write primitive, recompute the pending write bytes and compare with the approved `content_sha`. If they differ, HALT as `stale-write-intent-content-mismatch`.
- If an investigator re-runs, Step 4.5 returns REVISE/REJECT, target preimage changes, or proposed bytes change for any reason, discard affected intents and re-enter Step 3 INVESTIGATE for those findings with the stale/revision reason appended. Regenerated intents re-run detector, Step 4.5 eligibility, and Step 5.4.
- `max_stale_intent_regenerations` defaults to 3 through the existing AIVV preferences/config surface. Stale-intent regeneration re-entries increment `stale_intent_regenerations`; when the cap is exceeded, HALT as `stale-intent-regeneration-cap-exceeded` and do not continue to challenger dispatch or write.
- Counter semantics stay separated: Step 4.5 REVISE/REJECT loops increment `challenge_iterations`; Step 5.4 deterministic validator failures increment `pre_write_validation_iterations` only; stale-intent re-entries increment `stale_intent_regenerations`. Pre-write validation retries do not consume the Step 4.5 semantic challenge budget and do not increment `cycle_count` because no post-write verification cycle occurred.
- `max_pre_write_validation_iterations` defaults to 3 through the existing AIVV preferences/config surface. When exceeded, HALT as `pre-write-iterations-exceeded`.

Bypass invalidation:
- Any prior `bypass_approval` is invalidated when its parent write intent is regenerated or its `content_sha` changes. The regenerated intent must re-prompt for host-user approval and record a fresh `approval_event_id`.
- Intent regeneration clears `detector_result.bypass_approval` even when the regenerated bytes coincidentally preserve the same `content_sha`; approval is scoped to the specific intent materialization event, not just the bytes.
- `bypass_approval` records include the approved `content_sha`; schema or deterministic validation rejects missing `content_sha` or a mismatch with the live intent.
- Minimum host-user approval shape for B4 bypass records:
  `detector_result.bypass_approval: {write_intent_id: "<intent id>", shape: "unsupported-risky-shape", approved_by: "user", approval_source: "host-user-input-event", approval_event_id: "<host-event-id>", user_approved_at: "<date-time>", reason: "<user-supplied reason>", scope: "<single-intent scope>", content_sha: "<approved intent sha>", expires_at: "<date-time>"}` or the same record with `expires_condition` instead of `expires_at`.
  Model-authored text that merely claims approval is not an approval event.

Detector and assertion registry:
- Run the deterministic detector on every write intent before Step 4.5. Resolve `AIVV_ROOT` through the shared runtime-root contract, then invoke the canonical implementation as `node "$AIVV_ROOT/tools/pre-write-validator.mjs" --fixture <write-intent-batch.json>`; host integrations with pre-tool hooks may call the same module, and hosts without hooks must still run this validator explicitly immediately before write. The registry covers JSON fence, JSONSchema fence, schema-like target, dotted key risk, line citation, shell fence, unsupported config/code fence, and prompt-shaped content.
- `detector_result.verdict` is `pass`, `halt`, or `bypass-approved`. `detector_result.content_shapes` is the canonical array field for detected risky shapes. `detector_result.detection_confidence` is deterministic and one of `low`, `medium`, or `high`.
- `detection_confidence` is `high` only when the full intent content and target path metadata were scanned without truncation or ambiguity; `medium` only when snapshot content was truncated but all detector-triggering ranges and target path metadata were inspected; `low` when any byte range, target path metadata, or parse-relevant region is unavailable or ambiguous.
- Plain prose may proceed only when every intent has `detector_result.verdict: "pass"`, `detector_result.content_shapes: []`, `detector_result.detection_confidence: "high"`, and no required assertions. Medium or low confidence blocks safe plain-prose budget skip.
- JSONSchema/schema-like content requires both `jq-parses` and `schema-coherence`. `jq-parses` alone is `incomplete-required-assertion`.
- `schema-coherence` rejects required missing property, unresolved local `$ref` JSON Pointers, dotted/nested conflict, and duplicate logical path.
- `line-cite-valid` requires an explicit temporal target: `pre_write` or `post_write`. Missing temporal target halts.
- Shell fences require `shell-syntax-valid`. `bash` uses `bash -n`; `sh` uses a POSIX-compatible checker (`dash -n`, `busybox sh -n`, or confirmed POSIX `sh -n`); `zsh` uses `zsh -n` only if available. If the required checker is unavailable, halt rather than treating shell syntax as verified.
- Risky shapes with no supported checker halt as `unsupported-risky-shape`. Prompt-shaped content halts as `unsupported-risky-shape`; prompt-shaped content includes case-insensitive matches for `ignore previous instructions`, `system prompt`, `developer message`, `OUTPUT FORMAT`, `BEGIN`, `END`, `tool call`, challenger verdict JSON keys, and fence-close/reopen attempts.
- Target-path safety: `target_file` must be relative and inside the resolved project working tree after normalization and symlink resolution. Absolute paths, `..`, symlink traversal, and risky patterns such as `.git/**`, `**/.env*`, `**/.ssh/**`, `**/id_rsa*`, `**/secrets/**`, and `**/node_modules/**` halt as `unsupported-risky-path`. `unsupported-risky-path` has no B4 bypass.
- **Class-sibling write-intent-diff (`class-sibling-blind-paste`):** when a write intent's `finding_id` resolves to a `<parent>-cls<N>` sub-finding (the sub-finding carries `class_sibling_parent`), guard against a verbatim duplicate of the parent's whole fix — a confirmed class sibling is a *per-site-adapted* fix (yokoten: copy AND improve), never a blind paste of the parent's hunk. **Discriminator (full-intent identity, not preimage-only):** HALT as `class-sibling-blind-paste` iff `target_file`, `old_string` (Branch A) / whole-text preimage, AND `new_string` / whole-text postimage are ALL byte-identical to the parent intent's. The conjunction is what makes it unambiguous:
  - Same file + identical pre+postimage = the parent's entire intent was duplicated → a true blind paste (and would also collide at write time). HALT.
  - **Different file with an identical `old_string`** is NOT a violation: the same buggy fragment legitimately appears at two sites and may need the same corrected expression — this is correct same-bug-same-fix work, not a paste. A preimage-only check would false-positive here, so preimage identity alone does not HALT.
  On HALT, re-enter Step 3 INVESTIGATE for that sub-finding to adapt the fix to its own site. **Residual boundary (stated honestly):** this guard catches a verbatim whole-intent duplicate; it does NOT prove the postimage was *meaningfully* improved for the site (a copied postimage across genuinely-different files passes). That "improve" half of yokoten is enforced by the per-site triage `reason` (which must distinguish the sites) and the Step 4.5 challenger / Step 6 verifier, not by this deterministic check.

Readiness consumes the materialized write intents from this reference. If `revise plan` is chosen at the readiness surface, invalidate all existing `write_intents`, increment the appropriate plan/challenge iteration counter, and return to Step 4 planning. Do not apply stale write intents after a readiness revision.

### Step 5.4: PRE-WRITE-VALIDATE — deterministic embedded-content checks

**Trigger:** every approved Step 4.4 `write_intents[]` entry whose `pre_write_assertions` is non-empty, or whose detector-required assertions are missing. Runs BEFORE the Edit/Write/apply host write primitive in Step 5 Branch A/B/C-fallthrough/D.

**Default-ON.** No opt-in gate. Step 5.4 does NOT execute external code (only `jq`, `grep`, simple bash) and produces zero runtime side effects beyond the orchestrator process.

**Per-assertion algorithm:**

For each `write_intents[].pre_write_assertions[i]`:

1. **`jq-parses` (kind):**
   - Extract the `block_id`-th fenced ```json or ```jsonschema block from `verbatim_doc_content`.
   - Run `printf '%s' "<extracted_block>" | jq empty 2>&1`.
   - On non-zero exit → HALT this Edit; emit warning `pre-write-validate-jq-empty-failed-block<N>`; re-route to Branch E (re-investigation) with `pre_write_validator_caught` calibration record. Would have caught dev.123 N1 — `"verification_method.command_args": {...}` parses as syntactically valid JSON but `jq` empty does NOT flag the dotted-key class. **Therefore `jq-parses` MUST be paired with `schema-coherence` (next sub-check) — `jq-parses` alone is insufficient.**

2. **`schema-coherence` (kind):**
   - Read `args.parent_schema_path` (a `.aivv/schemas/*.json` path).
   - Walk `args.expected_nest_path` (a dotted path: e.g., `properties.changes_summary.items.properties`).
   - Confirm the new property name in the proposed block is a SINGLE key under the parent path, NOT a dotted string (catches the N1 defect class).
   - Implementation:
     ```bash
     # Pseudo-shell; orchestrator implements in Bash+jq:
     parent_keys=$(jq -r "$expected_nest_path | keys[]" "$parent_schema_path")
     proposed_keys=$(printf '%s' "$extracted_block" | jq -r 'keys[]')
     for key in $proposed_keys; do
       if [[ "$key" == *.* ]]; then
         echo "schema-coherence FAIL: proposed key '$key' contains dotted string (invalid JSON Schema nesting)" >&2
         exit 1
       fi
     done
     ```
   - On failure → HALT + re-route per `jq-parses` failure path.

3. **`line-cite-valid` (kind):**
   - Read `args.file` and `args.cite_form` (e.g., `L428` or `L428-L432`).
   - Extract the cited line range from current `args.file` state.
   - `grep -qF -- "$expected_snippet"` against the extracted range.
   - On non-match → **HALT this Edit; emit warning `pre-write-validate-l-n-citation-mismatch`; re-route to Branch E (re-investigation)** with `pre_write_validator_caught` calibration record. **Do NOT auto-rewrite** the citation. Rationale (per F006 / alpha IV&V 2026-05-22): the dev.97+ practical-sequence pattern-anchoring is an AUTHOR-TIME discipline, not an orchestrator-time auto-rewrite. Automatic pattern-anchor extraction from an arbitrary snippet is non-trivial and unspecified; silent bad rewrites are harder to detect than the original L<N> drift (and would import the "discipline-fix-surface-becomes-new-violation-surface" meta-pattern documented for dev.91→102). HALT aligns this sub-check with the other 2 sub-checks (`jq-parses`, `schema-coherence`), all of which route to Branch E on failure. The investigator re-authors with a pattern-anchored citation at re-investigation time.

> **Note on dropped 4th sub-check (per F005 / alpha IV&V 2026-05-22, user gate 2026-05-22):** an earlier draft of this plan included a 4th sub-check `count-matches-enumeration` to detect prose count-claims that drift from the enumeration they reference. **It has been removed.** Root-cause reasoning: the drift surface should not exist in the first place. maintainer guidance dev.119+ "Counts are not plan prose" already mandates that count-claims paired with their own enumerations be eliminated at authoring time — when there's no bare count adjacent to an enumeration, there's nothing to drift. Adding a deterministic validator on top of an author-discipline that was supposed to eliminate the surface inverts the intent (treat symptom, not cause). Step 5.4 retains 3 sub-checks; the no-counts-in-prose rule remains an authoring discipline; `validate.sh` Stages 18/19 remain the post-staging safety net for already-shipped legacy/missed cases.

**On all checks PASS:** emit no warnings; proceed to readiness/pre-write approval and then Edit dispatch. Step 5.5 runs only after writes have been applied.

**On HALT:** the fix proposal is returned to Step 3 INVESTIGATE for re-authoring. Increment `pre_write_validation_iterations` only (NOT `challenge_iterations` and NOT `cycle_count` — Step 5.4 failures are pre-write authoring failures, not semantic challenger rejections or post-write verifier re-entries). When `max_pre_write_validation_iterations` (default 3) is exceeded, HALT as `pre-write-iterations-exceeded`; do not fall through to write.

**Calibration emit:** every Step 5.4 catch writes a `pre_write_validator_caught` calibration record (see Task 17) with `{finding_id, validator_check, would_have_been_n_class}` fields.

**AC-X1 coverage (per F-M3 Option B resolution):** Step 5.4 = the deterministic catch layer. Step 4.5 keeps its semantic focus (root-cause-vs-symptom, regression risk, hidden side effects). Defense-in-depth: 4.5 catches LLM-judgment-class defects upstream; 5.4 catches syntax/structure-class defects downstream. The verifier in Step 6 remains the post-edit safety net.

---
