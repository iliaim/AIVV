# Architecture & Structure Signals (AS-*)

**Scope:** Cross-file / module-boundary / file-tree structural simplification signals — the architecture-altitude complement to [`code-quality.md`](code-quality.md)'s within-file CQ-* catalog. Where CQ-* operates inside a single function or file (nesting, parameter lists, within-file DRY), AS-* operates on relationships BETWEEN files and the shape of the repository. Surfaces under the `code` lens when a diff's structural shape is in view — new files, moved files, cross-module imports, a growing god-file, a directory gaining its Nth sibling. Findings carry `category: improvement` (dev.146+): they are behaviour-preserving betterments, not defects.

**Severity model:** AIVV two-track discriminator per `.aivv/methodology.md` Finding Severities section. Distribution: 8 POLISH (8 rules). **Zero CRITICAL/MAJOR/MINOR by default** — a structural smell is an improvement opportunity, not a defect at current inputs. When the smell already causes a concrete failure (for example, a cyclic dependency that already produces a build failure, or a layering inversion that already blocks a required test), it has a harm mode and is re-routed to the DEFECT track for impact×likelihood scoring. Most rules route through the Improvement-articulation pass: surface only when verified present need, a specific improvement, and positive net value are established, else DROP. POLISH improvements do not drive `/aivv-fix --until-clean` continuation; use optional `value`/`effort` metadata to surface Quick Wins without borrowing a defect tier.

**Source-class:** All L3 (engineering convention — Ousterhout APoSD, Martin *Clean Architecture* / SOLID + component principles, Parnas information-hiding, Conway, Hunt/Thomas Pragmatic Programmer, Verraes). Several are peer-divergent on threshold (file size, boundary granularity) → POLISH-default with the mandatory three-part articulation/proportionality gate, mirroring CQ-013/CQ-021/CQ-022.

**Scope boundary:** AIVV surfaces signals, not prescriptions. The reviewer names the present need, concrete improvement, and positive net value; the implementer decides the restructure. **Cross-file/structural fixes are NOT auto-applied by `/aivv-fix`** — AS-* `improvement` findings and improvement findings whose `investigation_mode` is `instrumentation-first` are surfaced as advisory "out-of-current-scope; separate effort" per Branch F, never auto-applied. Project conventions over external preferences (CQ-005 is the canonical authority; it applies cross-file too).

**Relationship to CQ-*:** AS-003 is the cross-file complement to CQ-021 (within-file DRY); AS-001 is the file-level complement to CQ-013 (within-function size). The two catalogs share the `code` lens and the simplification philosophy; they differ only in altitude.

## Module shape (AS-001..002)

### AS-001: Oversized module — god-file mixing separable responsibilities

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention — peer-divergent on threshold)
**Source:** Ousterhout, J. (2018). *A Philosophy of Software Design.* CS190 lecture notes: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity (modules should be deep but cohesive; a module accreting unrelated responsibilities increases the "amount of code a developer must hold in their head" — change-amplification + cognitive-load complexity symptoms). Martin, R. (2017). *Clean Architecture.* Single Responsibility Principle at module granularity (print) <!-- PRINT-VERIFY-PENDING for Martin Clean Architecture SRP chapter -->.

**Rule:** A single file that has grown well past the surrounding files' norm AND mixes three or more separable concerns (e.g., orchestration + schema + prose + validation in one script) is a god-file flag. File size alone is not the signal — a large file with one cohesive responsibility is fine (peer-divergent: Ousterhout's "deep module" can be large). The signal is *size × responsibility-count*: a file is a candidate for splitting when a reader must understand multiple unrelated concerns to navigate it, and the concerns have independent reasons to change. Surface when a diff grows such a file further, OR when a new responsibility is added to an already-large file rather than a new module. Within-function complexity is CQ-013's job; this rule is about whole-file cohesion.

**Code patterns to flag (when Improvement-articulation passes):**
- A file an order of magnitude larger than its siblings that handles ≥3 distinct concern-classes (parsing + business logic + presentation + persistence)
- A diff that appends a new, separable feature to an already-large file instead of introducing a sibling module
- A single script orchestrating many sequential stages/sections that could be split by concern with a thin dispatcher
- A "utils"/"helpers"/"misc" file that has become a dumping ground with no cohesive theme

**grounded_by:** `{webfetch: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity}` — Ousterhout CS190: change-amplification and high cognitive load are complexity symptoms; cohesive modules reduce the code a developer must hold in their head.

**Deterministic anchor (dev.162+):** a cheap, falsifiable *trigger* for when to run this rule's cohesion check is a file crossing ~1000 lines, or growing materially while already past it. The reviewer computes it via `git diff --numstat <base>...HEAD` (`<base>` = the PR/merge base, typically `origin/main`; per-file `<added> <removed>`) plus a file read for the resulting total — not by eyeballing. The line-count crossing is NOT itself the finding (per the Rule above, size alone is not the signal); it is an attention trigger that prompts the size × responsibility-count assessment. Default threshold 1000 lines, project-overridable per CQ-005 — deliberately conservative vs ESLint `max-lines`' 300-line default, since AIVV surfaces a high-confidence structural prompt, not a style cap. Ported from the Cursor `thermo-nuclear-code-quality-review` skill's deterministic 1k-line tripwire, landed at the architecture altitude where file size belongs (rather than duplicated as a within-file CQ rule).

**grounded_by:** `{webfetch: https://eslint.org/docs/latest/rules/max-lines}` — ESLint max-lines documents a per-file line cap to aid maintainability and reduce complexity (default 300; notes file length should not run into the thousands), grounding the line-count-as-attention-trigger heuristic.

**See also:** AS-002 (module-boundary fit), AS-007 (mixed-responsibility / multiple actors), CQ-013 (function size — the within-function complement), CQ-025 (relocated-not-removed — decomposition must reduce complexity, not relocate it across files).

### AS-002: Module-boundary fit — information leakage across files

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Parnas, D. (1972). "On the Criteria To Be Used in Decomposing Systems into Modules." *Communications of the ACM* 15:12 (information hiding: each module hides a design decision; modules are decomposed around what is likely to change, not around processing steps) (print) <!-- PRINT-VERIFY-PENDING for Parnas 1972 CACM -->. Ousterhout, J. APoSD — "information leakage" anti-pattern: the same design decision reflected in two modules so a change to it requires editing both (https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity — change-amplification symptom).

**Rule:** A module boundary is mis-placed when the same design decision must be changed in two files together (information leakage), or when related code that shares a single reason to change is split across distant files while unrelated code shares a file. The boundary should hide a design decision behind a narrow interface; a boundary that forces callers to know the module's internal representation (or that splits one decision across two modules) is a structural flag. Surface when a diff changes the same decision in two places in lockstep, or when a new file's interface exposes internal representation that a narrower boundary would hide.

**Code patterns to flag (when Improvement-articulation passes):**
- A single design decision (a data format, a protocol detail, a magic constant's meaning) edited in two modules in the same diff — the boundary leaks it
- A module whose public interface exposes its internal data representation, forcing callers to mirror its internals
- Related code with one reason to change split across distant files; unrelated code with different reasons to change sharing one file
- A "manager"/"coordinator" that reaches into the internals of the modules it coordinates rather than calling a narrow interface

**grounded_by:** `{webfetch: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity}` — Ousterhout CS190: information leakage (a design decision reflected in multiple modules) is a change-amplification complexity cause; cohesive boundaries hide decisions. Parnas 1972 grounds the information-hiding criterion (print, pending).

**See also:** AS-001 (oversized module), AS-006 (dependency direction across boundaries).

## Cross-file knowledge (AS-003)

### AS-003: Cross-file knowledge duplication — one fact in N files

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Verraes, M. (2014). "DRY is About Knowledge." https://verraes.net/2014/08/dry-is-about-knowledge/ (DRY concerns knowledge — a single business rule or fact — not syntax; the same knowledge expressed in multiple places will drift). Hunt, A. & Thomas, D. (1999). *The Pragmatic Programmer.* "DRY — Don't Repeat Yourself: every piece of knowledge must have a single, unambiguous, authoritative representation within a system" (print; system-level scope) <!-- PRINT-VERIFY-PENDING for Hunt/Thomas Pragmatic Programmer DRY -->.

**Rule:** The same piece of knowledge — an enum's value set, a constant's meaning, a vocabulary, a regex, a rule — declared in two or more files that must be edited in lockstep is a cross-file DRY violation. This is the system-level complement to CQ-021: CQ-021 evaluates duplication *within* a file (and warns that syntactic duplication is not automatically a violation); AS-003 evaluates the same *knowledge* replicated *across* files where the copies are genuinely the same fact that will always change together. A telltale sign that this smell is already real: the codebase has built a compensating coherence gate (a validator that fails the build when the copies diverge) — the gate is evidence that a single source of truth is missing, not that the duplication is safe. Surface when a diff adds or edits a value that already exists in another file as the same authoritative fact, OR when a new copy of an existing vocabulary is introduced. Honour the knowledge-equivalence test (CQ-021): flag only genuinely-same knowledge, not coincidental syntactic similarity.

**Code patterns to flag (when Improvement-articulation passes):**
- The same enum / constant / vocabulary literally re-declared in ≥2 files that must change together (the canonical case: one logical value set maintained in several schema/prompt/doc copies)
- A value copied into a sidecar (a doc table, a system-prompt template) that has drifted, or will drift, from its authoritative declaration
- A new coherence-gate / cross-file validator being added — a signal to ask whether a single source of truth would remove the need for the gate
- A regex or format string duplicated across modules that all parse the same data shape

**grounded_by:** `{webfetch: https://verraes.net/2014/08/dry-is-about-knowledge/}` — Verraes: DRY is about knowledge equivalence (the same fact / business rule), not syntactic similarity; the same knowledge in multiple places drifts. Hunt/Thomas grounds the "single authoritative representation within a system" scope (print, pending).

**See also:** CQ-021 (within-file duplication-vs-wrong-abstraction — the within-file complement), AS-002 (information leakage — a related cross-file coupling smell).

## Dependency & layout (AS-004..006)

### AS-004: File-tree fights the domain

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention — peer-divergent)
**Source:** Conway, M. (1968). "How Do Committees Invent?" — Conway's Law: https://www.melconway.com/Home/Conways_Law.html (a system's structure mirrors the communication structure of the organization that builds it; layout reflects seams). Martin, R. (2017). *Clean Architecture.* "Screaming Architecture" — the top-level structure should communicate the domain, not the framework (print) <!-- PRINT-VERIFY-PENDING for Martin Clean Architecture "Screaming Architecture" chapter -->.

**Rule:** A directory layout organized so that a single coherent change must touch many scattered locations — or whose top-level structure communicates the framework/file-type rather than the domain — is a navigability flag. Layout should reflect the domain's natural seams so a reader can predict where a thing lives. Peer-divergent (by-layer vs by-feature organization are both defensible; the signal is mismatch with how the code actually changes, not adherence to one scheme). Surface when a diff scatters one logical feature across many type-grouped directories, places a new file by convenience rather than domain fit, or grows a directory whose contents no longer share a coherent theme.

**Code patterns to flag (when Improvement-articulation passes):**
- One feature's files scattered across many type-organized directories such that a single feature change touches all of them
- A new file placed where it was convenient to import from, not where its domain says it belongs
- Top-level directories named for frameworks/file-types when the domain has clear, nameable seams
- A directory whose siblings no longer share a coherent theme (related to AS-001 at the directory level)

**grounded_by:** `{webfetch: https://www.melconway.com/Home/Conways_Law.html}` — Conway: "Any organization that designs a system (defined broadly) will produce a design whose structure is a copy of the organization's communication structure." Layout mirrors seams. Martin "Screaming Architecture" grounds domain-first top-level structure (print, pending).

**See also:** AS-008 (missing registry for a file collection), AS-007 (mixed-responsibility), AS-001 (cohesion at the file level).

### AS-005: Cyclic dependency between modules

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Martin, R. (2017). *Clean Architecture.* Acyclic Dependencies Principle — "Allow no cycles in the component dependency graph" (print) <!-- PRINT-VERIFY-PENDING for Martin Clean Architecture ADP chapter -->. Wikipedia, "Circular dependency": https://en.wikipedia.org/wiki/Circular_dependency (circular dependencies are an anti-pattern — tight coupling that prevents separate reuse, a domino effect where a local change spreads globally, and possible initialization/build failures).

**Rule:** Two modules that depend on each other (directly, or transitively through a cycle) cannot be understood, tested, reused, or built independently — a change in one ripples into the other, and the pair must be reasoned about as a unit. A new import that closes a dependency cycle between files/modules is a structural flag. Surface when a diff introduces an import that makes module A depend on B while B already depends on A (directly or transitively), or when a cycle is observable in the changed files' import graph. Re-route to the DEFECT track only when the cycle already produces a concrete failure (build error, initialization-order bug, untestable unit).

**Code patterns to flag (when Improvement-articulation passes):**
- A new `import`/`require` that closes an A→B→A cycle between two files or modules
- Two modules that each reference the other's symbols, forcing them to be loaded/built together
- A barrel/index file re-exporting modules that import back from it (initialization-order hazard)
- Mutually-recursive module references that prevent testing either in isolation

**grounded_by:** `{webfetch: https://en.wikipedia.org/wiki/Circular_dependency}` — circular dependencies cause "tight coupling of the mutually dependent modules which reduces or makes impossible the separate re-use of a single module" and a "domino effect when a small local change in one module spreads into other modules"; considered an anti-pattern. Martin ADP grounds "no cycles in the dependency graph" (print, pending).

**See also:** AS-006 (dependency direction — cycles often accompany inverted layering), AS-002 (boundary fit).

### AS-006: Dependency-direction / layering inversion

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Martin, R. Dependency Inversion Principle: https://en.wikipedia.org/wiki/Dependency_inversion_principle ("High-level modules should not import anything from low-level modules. Both should depend on abstractions"; "Abstractions should not depend on details. Details should depend on abstractions"). Martin, R. (2017). *Clean Architecture.* Stable Dependencies Principle — depend in the direction of stability (print) <!-- PRINT-VERIFY-PENDING for Martin Clean Architecture SDP chapter -->.

**Rule:** A dependency that points the wrong way — a high-level/policy/domain module importing a low-level/detail module, or a stable module depending on a volatile one — couples policy to detail and makes the stable core change for the wrong reasons. The fix is to depend on an abstraction so the detail depends on the policy, not vice versa. Surface when a diff adds an import from a core/domain module to a UI/IO/framework detail, or when a module that should be stable gains a dependency on a volatile one. Distinct from AS-005 (a cycle); a layering inversion can exist without a cycle.

**Code patterns to flag (when Improvement-articulation passes):**
- A domain/core module importing a concrete UI, database, network, or framework module directly
- A widely-depended-on (stable) module gaining an import from a rarely-used (volatile) one
- Concrete-depends-on-concrete across a layer boundary where an interface/abstraction belongs
- A configuration or constants module importing runtime/behavioural code (constants should be a leaf)

**grounded_by:** `{webfetch: https://en.wikipedia.org/wiki/Dependency_inversion_principle}` — Martin DIP: "High-level modules should not import anything from low-level modules. Both should depend on abstractions"; "Abstractions should not depend on details." Martin SDP grounds depend-toward-stability (print, pending).

**See also:** AS-005 (cyclic dependency), AS-002 (information leakage across boundaries).

## Document & collection structure (AS-007..008)

### AS-007: Mixed-responsibility file — one file, multiple actors

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Martin, R. Single Responsibility Principle: https://en.wikipedia.org/wiki/Single-responsibility_principle ("A module should be responsible to one, and only one, actor"; "Gather together the things that change for the same reasons. Separate those things that change for different reasons").

**Rule:** A file that serves two distinct actors/audiences — each with its own reason to change — couples unrelated edit-streams and forces each audience to wade through the other's content. The canonical cases are documents and config: one file acting as both a shipped end-user README AND an internal author working-rules document; or one file holding both user-facing configuration AND internal schema. Surface when a diff edits a file for one audience's reason while the file also carries unrelated content for a different audience, or when a new responsibility belonging to a different actor is added to an existing file. The fix is to separate by actor (extract the author-rules into a non-shipped doc; split user config from internal schema).

**Code patterns to flag (when Improvement-articulation passes):**
- A single document serving both end-users (README) and authors/maintainers (process/working rules) — two actors, two reasons to change
- A file mixing user-editable configuration with internal/derived schema that only maintainers touch
- A module changed by two unrelated triggers across recent history (two actors editing it for different reasons)
- A "constants" file that mixes public API contract values with private implementation tunables

**grounded_by:** `{webfetch: https://en.wikipedia.org/wiki/Single-responsibility_principle}` — Martin SRP: "A module should be responsible to one, and only one, actor"; "Gather together the things that change for the same reasons. Separate those things that change for different reasons."

**See also:** AS-001 (oversized module — often also mixed-responsibility), AS-004 (domain-fit at the directory level).

### AS-008: Missing index/registry for a file collection

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Ousterhout, J. APoSD — "obscurity" as a root cause of complexity: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity (when important information is not obvious, the reader faces "unknown unknowns" — they cannot tell what they need to know; a discoverable index reduces this). Convention parallel: AIVV's own `.aivv/standards/README.md` exists precisely to index its catalog.

**Rule:** A directory of N related files with no index/registry/README raising the cost of discovering what lives there is a navigability flag — the reader must open files to learn the collection's shape ("unknown unknowns"). Surface when a diff adds the Nth sibling to such a directory without a registry, or when a collection is cross-referenced only by scattered prose rather than a single index. The fix is a thin index (a README/TOC/registry) that names each member and its purpose, updated as members are added. Peer practice, not a hard rule — small collections (2–3 obvious files) do not need an index; the signal is cost-of-discovery growing with N.

**Code patterns to flag (when Improvement-articulation passes):**
- A directory accumulating many related files (adapters, plugins, rule catalogs, fixtures) with no README/index naming each member
- New members added to such a collection without a corresponding registry update (registry drift)
- A collection referenced only via scattered hard-coded prose links rather than a single index the reader can scan
- A growing set of sibling config/schema files with no manifest of which is authoritative

**grounded_by:** `{webfetch: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity}` — Ousterhout CS190: obscurity (important information not obvious) produces "unknown unknowns," a root cause of complexity; discoverable structure reduces it.

**See also:** AS-004 (file-tree fits the domain — the layout complement), AS-001 (cohesion).
