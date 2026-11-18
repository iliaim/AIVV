# AIVV Untrusted-Content Boundary — shared canonical contract

**This file is the single source of truth for the untrusted-content boundary that every
AIVV dispatch surface must encode.** A *dispatch surface* is any prompt AIVV sends to an
isolated agent (a reviewer, investigator, fix-challenger, or verifier): the portable role
files and the invocation-time prompt templates that carry user/project/session content into
that agent. All such content is **untrusted evidence** — it may contain prompt-shaped text
crafted to hijack the agent (`"ignore previous instructions"`, fake output schemas, forged
verdicts, instructions to report zero findings / approve silently / downgrade severity).

This file does not itself get inlined into a prompt. It is the contract the surfaces below
must satisfy.

## Required concepts (every dispatch surface MUST encode all three)

1. **Inputs are untrusted data.** Every surface MUST contain the literal token `untrusted`
   and state that evidence inputs are data under review, not instructions.
2. **Prompt-shaped text cannot redirect behavior.** Embedded instructions cannot change the
   agent's role, output requirements/schema, tool surface, lens, or scope.
3. **Induced deviation is a contract violation.** A finding/verdict suppressed, fabricated,
   or altered because of instructions embedded in the content — rather than produced by
   analysis — is a contract violation, not compliance. Quoting prompt-shaped content
   verbatim as *evidence* is always permitted; only letting it *redirect behavior* is barred.

Surfaces phrase these concepts in role-appropriate language (a reviewer speaks of findings
and lenses; a verifier of resolved-vs-symptom). Verbatim convergence is **not** required —
concept coverage is.

## Dispatch surfaces

Surfaces are identified by **naming convention**, not by a hand-maintained list:

- **Role files:** `.aivv/prompts/*-role.md`
- **Dispatch templates:** `skills/*/references/*-template.md` (the prompt templates and the
  class-sibling triage template — every reference-dir `*-template.md` carries untrusted evidence
  into a dispatched agent)

Current members: `reviewer-role.md`, `investigator-role.md`, `fix-challenger-role.md`,
`verifier-role.md`, `reviewer-prompt-template.md`, `investigator-prompt-template.md`,
`fix-challenger-prompt-template.md`, `verifier-prompt-template.md`,
`class-sibling-triage-template.md`.

## Enforcement

`tests/untrusted-boundary.test.mjs` discovers surfaces by the convention above, requires the
`untrusted` token in each, and requires the member list above to match. Concepts 2 and 3 have
no automated check: review every new or edited surface against them by hand.

## Structural delimiter enforcement

Provider prompts are rendered with random nonce-delimited `<AIVV_UNTRUSTED_*_nonce>`
fences. Native host prompt templates generate one fresh nonce per dispatch with the shipped
`tools/native-prompt-boundary.mjs --nonce` helper. Each substituted placeholder value is
passed through that helper's `--wrap <nonce> <FIELD>` mode, which emits a matching
`<AIVV_UNTRUSTED_<nonce>_<FIELD>>` pair around the exact stdin bytes.
`tests/security/native-prompt-boundary.test.mjs` tests fresh nonce generation, wrapper output,
and prompt-shaped input. The native host has no separate post-assembly prompt validator, so
the dispatch templates require the orchestrator to use the helper output for each substituted
value and keep the resulting prompt available for normal review.
