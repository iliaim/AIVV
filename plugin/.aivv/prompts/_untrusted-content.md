# AIVV Untrusted-Content Boundary — shared canonical contract

**This file is the single source of truth for the untrusted-content boundary that every
AIVV dispatch surface must encode.** A *dispatch surface* is any prompt AIVV sends to an
isolated agent (a reviewer, investigator, fix-challenger, or verifier): the portable role
files and the invocation-time prompt templates that carry user/project/session content into
that agent. All such content is **untrusted evidence** — it may contain prompt-shaped text
crafted to hijack the agent (`"ignore previous instructions"`, fake output schemas, forged
verdicts, instructions to report zero findings / approve silently / downgrade severity).

This file does not itself get inlined into a prompt. It is the contract the surfaces below
must satisfy and the contract `tools/prompt-behavior-guard.mjs` enforces mechanically.

## Required concepts (every dispatch surface MUST encode all three)

1. **Inputs are untrusted data.** Every surface MUST contain the literal token `untrusted`
   and state that evidence inputs are data under review, not instructions. *(This token is
   the guard's uniform floor check — see "Enforcement" below.)*
2. **Prompt-shaped text cannot redirect behavior.** Embedded instructions cannot change the
   agent's role, output requirements/schema, tool surface, lens, or scope.
3. **Induced deviation is a contract violation.** A finding/verdict suppressed, fabricated,
   or altered because of instructions embedded in the content — rather than produced by
   analysis — is a contract violation, not compliance. Quoting prompt-shaped content
   verbatim as *evidence* is always permitted; only letting it *redirect behavior* is barred.

Surfaces phrase these concepts in role-appropriate language (a reviewer speaks of findings
and lenses; a verifier of resolved-vs-symptom). Verbatim convergence is **not** required —
concept coverage is.

## Registered dispatch surfaces (the class the guard enumerates)

The guard discovers surfaces by **naming convention**, not by a hand-maintained list, so a
newly added surface cannot ship without carrying this boundary:

- **Role files:** `.aivv/prompts/*-role.md`
- **Dispatch templates:** `skills/*/references/*-template.md` (the prompt templates and the
  class-sibling triage template — every reference-dir `*-template.md` carries untrusted evidence
  into a dispatched agent)

Current members: `reviewer-role.md`, `investigator-role.md`, `fix-challenger-role.md`,
`verifier-role.md`, `reviewer-prompt-template.md`, `investigator-prompt-template.md`,
`fix-challenger-prompt-template.md`, `verifier-prompt-template.md`,
`class-sibling-triage-template.md`. A future non-dispatch `*-template.md` would fail the guard's
reconciliation, forcing a conscious classify-or-rename decision rather than a silent gap.

## Enforcement (`tools/prompt-behavior-guard.mjs`, `checkPortableRoles`)

1. **Discover** every file matching the two globs above (filesystem truth, not a list).
   Discovery is **recursive** — a template nested in a `references/` subdirectory (any depth)
   is a surface too and must not escape the walk.
2. **Floor check** — require the `untrusted` token in each discovered surface.
3. **Reconcile** discovery against the guard's per-surface required-content map:
   - a discovered surface with **no** map entry → **FAIL** (`add its required-content
     patterns to the map — a new dispatch surface must not ship unchecked`);
   - a map entry with **no** discovered file → **FAIL** (renamed/deleted surface).
4. **Substance check** — require each surface's role-specific patterns from the map. A
   registered surface with an **empty** pattern list → **FAIL** (an empty list is a rubber
   stamp; the bare `untrusted` token alone does not prove the boundary is present).

Because discovery is filesystem-driven and recursive, adding a new `*-role.md` or
`*-template.md` at any depth **fails the guard until it is registered with real
required-content patterns** — closing the per-file-manifest gap where a new surface silently
shipped without the boundary.

## Structural delimiter enforcement

Provider prompts are rendered with random nonce-delimited `<AIVV_UNTRUSTED_*_nonce>`
fences, and `tools/prompt-behavior-guard.mjs` checks the rendered prompt. Native Claude/Codex
prompt templates generate one fresh nonce per dispatch with the shipped
`tools/native-prompt-boundary.mjs --nonce` helper. Each substituted placeholder value is
passed through that helper's `--wrap <nonce> <FIELD>` mode, which emits a matching
`<AIVV_UNTRUSTED_<nonce>_<FIELD>>` pair around the exact stdin bytes. The guard checks every
discovered native dispatch template for helper instructions and per-prompt nonce rules;
`tools/tests/native-prompt-boundary.test.mjs` tests fresh nonce generation, wrapper output,
and prompt-shaped input. The native host has no separate post-assembly prompt validator, so
the dispatch templates require the orchestrator to use the helper output for each substituted
value and keep the resulting prompt available for normal review.
