# Source Grounding

Read this before source-grounding, citing normative sources, or making factual external-system claims. Verify that any source used for a load-bearing claim supports it and is current and applicable when those qualities matter.

Contents:
- Factual-claim grounding triggers
- Graceful degradation
- Output contract and schema mapping

#### Factual-claim grounding (when a material conclusion or finding relies on an external claim)

AIVV's reviewer shares training data with the agent that produced the artifact. Material claims grounded in that shared data can be confidently wrong in both directions. When a claim affects the artifact's conclusion, safety, or intended use, verify it against authoritative sources before relying on it. Use targeted research; this does not require checking every factual sentence in every artifact.

**Token-efficiency:** trigger-gated. Research claims that matter to a finding or decision — not every review or every factual sentence.

**Trigger table (for material claims, fire on any match):**

| Trigger | Example claim shape | Source (ordered preference) |
|---|---|---|
| Numeric/percentage stat as evidence | "64% better outcomes", "3× faster" | WebSearch → cite primary URL |
| Named research citation without a verifiable source | "per ICSE 2025 literature", "per Google SRE handbook" | WebSearch → verify the primary source; if unavailable, state the evidence limitation |
| Library/framework API claim (incl. version-specific availability / deprecation / removal) | "React's `useTransition` supports X", "Next.js 14 App Router does Y", "deprecated in React 19", "added in Node 20", "removed in Next.js 14" | Context7 (resolve library-id first) → WebSearch fallback |
| Standard/spec/protocol claim | "WCAG 2.2 AA requires X", "RFC 6749 OAuth flow", "HTTP/2 HPACK limit" | WebSearch → cite spec section |
| CVE/CWE/OWASP claim | "CWE-89 SQL injection", "OWASP A01:2021" | WebSearch against CWE/MITRE or OWASP → cite ID |
| Tool/framework behavior claim | "ESLint flags X by default", "TypeScript `strict` implies Y" | Context7 → WebSearch fallback |

**Anti-triggers (DO NOT launch external research solely because):** internal-repo claims (verify within the confirmed scope); business-logic claims with no applicable external authority; subjective judgments ("readable", "idiomatic", "simpler"); self-evident behavior visible in the artifact. A citation avoids an uncited-claim trigger, but it does not by itself establish that the cited content supports the claim, is current, or applies to the reviewed context. Check load-bearing citations before relying on them.

**Graceful degradation (ordered):**

1. **Context7 available + library-id resolves** → use Context7 (versioned, indexed). *Context7 is opportunistic — MCP availability depends on host-environment; `aivv:reviewer` does not declare `mcp__context7__*` in its tools frontmatter and will fall through to WebSearch when Context7 is not reachable in the dispatched session. Either path satisfies the graceful-degradation contract.*
2. Else → WebSearch.
3. WebSearch unavailable / rate-limited → label finding `[unverified — external grounding unavailable]`; include the claim + intended source so an online user can verify later. Do NOT silently accept.
4. A current, applicable primary source directly contradicts a material artifact claim → report the contradiction with the verified URL and evidence; set confidence according to how directly the source resolves the claim.
5. Source supports the material claim → use it as evidence where needed. Do not create a finding merely because the artifact did not cite it.
6. Source-not-found → label `[unverifiable — no authoritative source located]`; downgrade confidence of any finding resting on the claim.

**Output contract:** every finding that rests on a groundable external claim carries a `grounded_by` marker in the finding text — one of `{context7:<library-id>@<version>}`, `{websearch:<URL>}`, `{unverified}`, `{unverifiable}`. The first two are citations; the last two are honest-limitation labels. An uncited factual claim is not automatically a finding or MAJOR defect. Treat a material evidence gap as a finding only when the missing support meaningfully weakens the conclusion, decision, safety, or intended use; assess impact, confidence, and remediation under the shared methodology.

**Schema mapping (dev.31+ — typed field graduated):** `grounded_by` is now a typed optional array property on `.aivv/schemas/finding.json` envelopes. PREFERRED form for new emissions: a `grounded_by` array of citation objects, each `{source_type, source_ref, excerpt?}` with `source_type` ∈ `{websearch, webfetch, context7, runtime, unverified, unverifiable, internal-repo}`. Use `runtime` only for orchestrator-captured runtime path evidence such as axe-core output, computed-style contrast records, screenshots, or screenshot-diff artifacts. **Backward-compat (legacy form, accepted during migration window):** the dev.21 free-form substring `grounded_by:{<source_type>:<source_ref>}` inside `summary` remains valid; consumers MAY regex-extract via `grounded_by:\{([^}]+)\}`. Readers MUST handle both forms — check the typed array first, fall back to substring extraction from `summary` / `description` if the array is absent. When a materially consequential missing citation or evidence gap warrants a finding, use `category: documentation-gap` where appropriate and describe the actual consequence; absence alone does not assign a finding or severity.

*Rationale:* a fabricated or stale load-bearing claim can escape review when it sounds plausible. Checking its source and applicability makes the evidence gap visible without assigning a defect tier solely because a citation is absent.
