# Standards Lookup

Read this when a review needs a standard. Start with applicable guidance in the
target project; it remains authoritative. Use AIVV's bundled catalog only as a
supplement, and open only the relevant rule file.

1. Start at [`.aivv/standards/README.md`](../../../.aivv/standards/README.md), then
   follow its links to the relevant family index and rule.
2. Before citing an AIVV rule ID, verify it with the injected
   `standards-lookup.mjs` helper:

   ```bash
   node "<absolute-path-to-standards-lookup.mjs>" --id <RULE-ID>
   node "<absolute-path-to-standards-lookup.mjs>" --grep-title "<phrase>"
   node "<absolute-path-to-standards-lookup.mjs>" --family <family>
   ```

   Use the injected absolute path. If none is available, resolve `AIVV_ROOT`
   through [`.aivv/runtime-root.md`](../../../.aivv/runtime-root.md); do not
   assume an environment variable is set.
3. Cite only IDs whose documented pattern matches the evidence. The helper
   verifies that an ID exists and locates its rule; it does not verify an
   external legal, standards, API, or research claim. Use
   [source-grounding.md](source-grounding.md) for those claims.

Do not load every catalog or rule file. If no AIVV rule applies, use relevant
project guidance and evidence-based judgment without inventing a rule ID.
