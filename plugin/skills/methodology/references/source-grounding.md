# Source Grounding

Read this before source-grounding, citing normative sources, or making factual external-system claims; every quoted or paraphrased source claim must be verified against the cited source.

Contents:
- Factual-claim grounding triggers
- Graceful degradation
- Output contract and schema mapping

#### Factual-claim grounding (when findings rest on external-system claims)

AIVV's reviewer shares training data with the agent that produced the artifact. Claims grounded in that shared data can be confidently wrong in both directions. **Grounding turns coherence-catch into systematic-catch**: the reviewer verifies factual claims against authoritative external sources before asserting or accepting them.

**Token-efficiency:** trigger-gated. Fire only on claim-based findings — not every review.

**Trigger table (fire on ANY match):**

| Trigger | Example claim shape | Source (ordered preference) |
|---|---|---|
| Numeric/percentage stat as evidence | "64% better outcomes", "3× faster" | WebSearch → cite primary URL |
| Named research citation without URL | "per ICSE 2025 literature", "per Google SRE handbook" | WebSearch → cite URL; flag uncited if none |
| Library/framework API claim (incl. version-specific availability / deprecation / removal) | "React's `useTransition` supports X", "Next.js 14 App Router does Y", "deprecated in React 19", "added in Node 20", "removed in Next.js 14" | Context7 (resolve library-id first) → WebSearch fallback |
| Standard/spec/protocol claim | "WCAG 2.2 AA requires X", "RFC 6749 OAuth flow", "HTTP/2 HPACK limit" | WebSearch → cite spec section |
| CVE/CWE/OWASP claim | "CWE-89 SQL injection", "OWASP A01:2021" | WebSearch against CWE/MITRE or OWASP → cite ID |
| Tool/framework behavior claim | "ESLint flags X by default", "TypeScript `strict` implies Y" | Context7 → WebSearch fallback |

**Anti-triggers (DO NOT fire — token discipline):** internal-repo claims (verify by Grep, not external source); business-logic claims (no authoritative source exists); subjective judgments ("readable", "idiomatic", "simpler"); self-evident code behavior (read the code); claims already carrying an authoritative citation (accept and move on).

**Graceful degradation (ordered):**

1. **Context7 available + library-id resolves** → use Context7 (versioned, indexed). *Context7 is opportunistic — MCP availability depends on host-environment; `aivv:reviewer` does not declare `mcp__context7__*` in its tools frontmatter and will fall through to WebSearch when Context7 is not reachable in the dispatched session. Either path satisfies the graceful-degradation contract.*
2. Else → WebSearch.
3. WebSearch unavailable / rate-limited → label finding `[unverified — external grounding unavailable]`; include the claim + intended source so an online user can verify later. Do NOT silently accept.
4. Source contradicts the artifact → emit HIGH-confidence finding with the URL.
5. Source confirms the artifact → attach citation to any existing finding; no new finding needed.
6. Source-not-found → label `[unverifiable — no authoritative source located]`; downgrade confidence of any finding resting on the claim.

**Output contract:** every finding that rests on a groundable claim carries a `grounded_by` marker in the finding text — one of `{context7:<library-id>@<version>}`, `{websearch:<URL>}`, `{unverified}`, `{unverifiable}`. The first two are citations; the last two are honest-limitation labels. **Uncited factual claims in the reviewed artifact are themselves findings** (label `uncited-factual-claim`, severity MAJOR — an uncited precise-sounding claim is indistinguishable from a hallucination).

**Schema mapping (dev.31+ — typed field graduated):** `grounded_by` is now a typed optional array property on `.aivv/schemas/finding.json` envelopes. PREFERRED form for new emissions: a `grounded_by` array of citation objects, each `{source_type, source_ref, excerpt?}` with `source_type` ∈ `{websearch, webfetch, context7, runtime, unverified, unverifiable, internal-repo}`. Use `runtime` only for orchestrator-captured runtime path evidence such as axe-core output, computed-style contrast records, screenshots, or screenshot-diff artifacts. **Backward-compat (legacy form, accepted during migration window):** the dev.21 free-form substring `grounded_by:{<source_type>:<source_ref>}` inside `summary` remains valid; consumers MAY regex-extract via `grounded_by:\{([^}]+)\}`. Readers MUST handle both forms — check the typed array first, fall back to substring extraction from `summary` / `description` if the array is absent. For `uncited-factual-claim` findings, set the envelope `category: documentation-gap` (missing citation is a doc gap) and include `uncited-factual-claim:` as a label prefix in the `summary` text — this preserves the semantic signal without adding a sixth category enum value.

*Rationale:* a fabricated precise statistic can escape review when it sounds plausible. Treating uncited factual claims as findings makes the check explicit instead of relying on reviewers to notice that a number feels overprecise.
