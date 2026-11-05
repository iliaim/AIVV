# Code Quality & Simplification Signals (CQ-*)

**Scope:** Code-review signals for simplification, complexity, abstraction, and redundancy. Surfaces under the `code` lens, and through the shared methodology when a general review includes logic code (not pure UI/markup/config).

**Severity model:** AIVV two-track discriminator per `.aivv/methodology.md` Finding Severities section. Distribution: 1 MAJOR / 15 POLISH (16 rules). **Zero CRITICAL by design** — no CQ-* rule carries financial/security/data-integrity/availability blast-radius per default. CQ-002 remains MAJOR because weakening tests during a simplification is an observable behavior-contract risk. Other CQ-* smells default to POLISH improvement opportunities; when a concrete failure/harm mode has already materialized, re-route to the DEFECT track for impact×likelihood scoring. POLISH improvements do not drive `/aivv-fix --until-clean` continuation; use optional `value`/`effort` metadata to surface Quick Wins without borrowing a defect tier.

**Source-class:** Most rules are L3 (engineering convention — Ousterhout APoSD, Fowler Refactoring, Beck Tidy First?, Metz POODR, Hunt/Thomas Pragmatic Programmer, agent-skills:code-simplification SKILL.md). CQ-010 is L2 (Campbell cognitive-complexity paper grounds in cognitive-load theory). Zero L1 (no legal/safety). Zero pure L4.

**Divergent-source decision-points:** CQ-013 (function size — Metz 5-line vs Ousterhout deep modules), CQ-021 (DRY vs WET — Metz/Verraes vs Hunt/Thomas), CQ-022 (comments — Fowler vs Ousterhout). All three default to POLISH on the IMPROVEMENT track with mandatory Improvement+Value articulation; reviewer DROPs the finding if both can't be articulated. If a concrete failure/harm mode has already materialized, re-route to the DEFECT track for impact×likelihood scoring.

**Scope boundary:** AIVV surfaces signals, not prescriptions. Reviewer flags the smell; implementer fixes it. Project conventions over external preferences (CQ-005 is the canonical authority).

## Simplification process (CQ-001..005)

### CQ-001: Chesterton's Fence — understand before changing

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Ousterhout, J. (2018). *A Philosophy of Software Design.* CS190 lecture notes: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity ; agent-skills:code-simplification SKILL.md Principle "Understand Before Touching (Chesterton's Fence)" ; git-blame convention.

**Rule:** Refactors that remove or restructure code without documenting the original purpose are reviewer flags. Before changing code, the implementer should answer: what is its responsibility, what calls it, what edge cases does it handle, why was it written this way (per git blame / commit message)? Surface the finding when a refactor diff removes code with no commit-message or PR-description explanation of why the removed code's purpose is no longer needed.

**Code patterns to flag:**
- Deletion of non-trivial code blocks (>10 lines) with commit-message body silent on what the code was doing
- Renaming + restructuring of a function whose name encodes domain semantics, without preserving the domain meaning
- Removal of code paths handling specific edge cases (null checks, error branches) when the commit-message doesn't explain why those edges no longer manifest

**grounded_by:** `{webfetch: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity}`

**See also:** CQ-002 (behavior preservation), CQ-003 (scope discipline).

### CQ-002: Behavior preservation — tests pass unmodified

**Severity (default):** MAJOR
**Source-class:** L3 (engineering convention)
**Source:** agent-skills:code-simplification SKILL.md Principle 1 (behavior-preservation invariant: the simplification must not change what the code does — only how it expresses it; the verification gate is whether all existing tests still pass without modification); test-driven-development discipline (TDD Red-Green-Refactor cycle: refactor phase must not change test outcomes).

**Rule:** A simplification that modifies, weakens, or deletes tests alongside production code is a MAJOR flag. Tests are the behavioral contract; a refactor that passes only because the contract was relaxed has not preserved behavior — it has hidden a regression. Surface when a simplification diff modifies test files, downgrades test assertions (e.g., from exact-match to truthiness), or comments out test cases without an explicit test-migration rationale in the commit message.

**Code patterns to flag:**
- Simplification commit whose diff includes both production-code changes AND test-file modifications (absent explicit test-refactor rationale)
- Test assertions weakened in tandem with production code restructuring (e.g., `expect(result).toBe(42)` → `expect(result).toBeTruthy()`)
- Commented-out test cases with no explanation of why the tested behavior no longer applies
- Test file deletions paired with production-code refactors

**grounded_by:** `{unverified: agent-skills:code-simplification SKILL.md — AIVV internal reference, not a public URL; principle is well-established TDD discipline (Beck TDD by Example + Fowler Refactoring Ch. 2)}` <!-- PRINT-VERIFY-PENDING for Beck + Fowler print sources -->

**See also:** CQ-001 (understand before changing), CQ-003 (scope discipline).

### CQ-003: Scope to what changed — no drive-by refactors

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** agent-skills:code-simplification SKILL.md Principle 5 (scope discipline: default to simplifying recently modified code; avoid drive-by refactors of unrelated code unless explicitly asked to broaden scope); agent-skills:incremental-implementation discipline (atomic commits scoped to a single logical change).

**Rule:** A simplification PR whose diff touches files that are orthogonal to the stated task is a scope-creep flag. Drive-by refactors — restructuring code encountered incidentally while implementing a different change — compound review surface, inflate diff size, and make behavioral regressions harder to isolate. Surface when commit-message body contains "while I was here..." phrasing, or when diff includes changes to files not referenced in the issue/PR description.

**Code patterns to flag:**
- PR diff modifies files not mentioned in the issue or PR description, with no explanation in the commit message
- Commit-message body contains "while I was here", "also cleaned up", or "took the opportunity to" phrasing
- Single commit mixes a bug fix or feature with unrelated style/structure changes in a different module

**grounded_by:** `{unverified: agent-skills:code-simplification SKILL.md + agent-skills:incremental-implementation — AIVV internal references; principle is widely established in software-engineering discipline (McConnell Code Complete, Fowler Refactoring)}`

**See also:** CQ-004 (one simplification per commit), CQ-001 (Chesterton's Fence).

### CQ-004: Incremental application — one simplification per commit

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** agent-skills:code-simplification SKILL.md 4-step process (make one simplification at a time; run tests after each change); agent-skills:incremental-implementation (deliver changes in the smallest batch that can be reviewed, understood, and rolled back independently).

**Rule:** A single commit that batches more than three distinct simplification types (e.g., rename + extract helper + dead-code removal + parameter reduction all in one commit) is a reviewability flag. Batched simplifications make it harder to isolate regressions, block partial-revert strategies, and inflate cognitive load for reviewers. Surface when a commit bundles ≥4 independently-reversible simplification actions without a stated rationale for the batch.

**Code patterns to flag:**
- Single commit touching rename + extract + delete + restructure across multiple files simultaneously
- Commit-message body enumerating ≥4 distinct refactoring operations ("renamed X, extracted Y, removed Z, inlined W")
- Large refactor diffs with no intermediate commits (suggests missing incremental-commit discipline)

**grounded_by:** `{unverified: agent-skills:code-simplification SKILL.md + agent-skills:incremental-implementation — AIVV internal references; principle is established in the literature (Beck *Tidy First?* Part II "Separate Tidying", "Chaining")}` <!-- PRINT-VERIFY-PENDING for Beck Tidy First? print chapters -->

**See also:** CQ-003 (scope discipline), CQ-001 (understand before changing).

### CQ-005: Project conventions over external preferences

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** agent-skills:code-simplification SKILL.md Principle 2 (follow project conventions: simplification means making code more consistent with the codebase, not imposing external preferences); maintainer guidance Operating Principle 1 (simplest solution that achieves the same result; avoid new abstractions).

**Rule:** A refactor that imposes an externally-sourced pattern on a codebase that already shows a different pattern consistently is a convention-violation flag. Project conventions — whether set by `.editorconfig`, existing code, or team agreement — take precedence over the reviewer's or implementer's personal preference for an alternative style. Surface when a diff introduces a pattern not present in the surrounding codebase and no project-authority source (linter config, STYLE.md, team decision) authorizes it.

**Code patterns to flag:**
- Refactor converts `for` loops to `Array.map/filter/reduce` in a codebase that consistently uses imperative loops, without project authority
- Introduces a named-export pattern in a codebase that uses default exports, without configuration change
- Replaces established error-handling convention (callbacks, error-first, try/catch) with a different pattern not authorized by project config
- Reviewer's comment cites "cleaner" or "more modern" without pointing to a project authority

**grounded_by:** `{unverified: agent-skills:code-simplification SKILL.md Principle 2 — AIVV internal reference; principle is well-established in software engineering team norms}`

**See also:** CQ-001 (Chesterton's Fence — understand before changing).

## Complexity signals (CQ-010..015)

### CQ-010: Cognitive complexity — deep nesting >3 levels

**Severity (default):** POLISH
**Source-class:** L2 (cognitive-load theory)
**Source:** Campbell, G.A. (2018). *Cognitive Complexity: A new way of measuring understandability.* SonarSource. https://www.sonarsource.com/blog/cognitive-complexity-because-testability-understandability/ ; Beck, K. (2023). *Tidy First?* O'Reilly. Tidy 1 "Guard Clauses" <!-- PRINT-VERIFY-PENDING --> ; Fowler, M. (2018). *Refactoring, 2nd ed.* "Long Method" smell <!-- PRINT-VERIFY-PENDING -->.

**Rule:** Control-flow nesting beyond 3 levels (loops, conditionals, try/catch, callbacks) measurably increases the cognitive load required to read and modify code. Campbell's cognitive complexity metric increments for each structural break in linear reading flow AND applies a nesting penalty, making deep nesting multiplicatively expensive. Surface when a function contains control-flow nesting at depth 4 or greater, or when early-return (guard-clause) refactoring would flatten the structure without changing behavior.

**Code patterns to flag:**
- Function body with `if → for → if → try` or similar 4-level nesting
- Callback-based or promise-chain structures with >3 nesting levels (pre-async/await migration opportunity)
- Nested ternary inside a nested conditional (see also CQ-014)
- Inversion opportunity: a positive-condition early-return could replace a large indented else-block

**grounded_by:** `{webfetch: https://www.sonarsource.com/blog/cognitive-complexity-because-testability-understandability/}` — Campbell defines cognitive complexity with nesting penalty; metric increments for each structural break from linear flow + adds nesting depth increment.

**See also:** CQ-014 (nested ternaries — adjacent complexity signal), CQ-011 (long parameter list), CQ-015 (spaghetti-condition — breadth/scattering is the complement to nesting depth).

### CQ-011: Long parameter list >4 — options object or data clump

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Fowler, M. (2018). *Refactoring, 2nd ed.* "Long Parameter List" smell (https://refactoring.guru/smells/long-parameter-list — catalog index; Fowler defines Long Parameter List as a smell indicating missing abstraction or data clump); Metz, S. (2012). *POODR.* Rule 3: "Pass no more than four parameters into a method" (https://thoughtbot.com/blog/sandi-metz-rules-for-developers); Beck, K. (2023). *Tidy First?* Tidy 10 "Explicit Parameters" <!-- PRINT-VERIFY-PENDING -->.

**Rule:** A function or method with more than 4 positional parameters is a signal that either (a) the function is doing too much (violating single responsibility) or (b) a group of related parameters should be bundled into a named options object or data structure. Metz's Rule 3 sets the threshold at 4; Fowler's Long Parameter List smell aligns with the same observation. Surface when a function signature has ≥5 positional parameters without an existing options-object convention in the codebase.

**Code patterns to flag:**
- `function process(id, name, type, status, createdAt, updatedAt)` — 6 positional params
- API handlers with 5+ positional arguments, particularly when several are nullable/optional
- Call sites passing `null` or `undefined` as placeholder for unused positional parameters (strong signal of abstraction mismatch)
- Parameters that always travel together across call sites (data clump — refactor to named type or struct)

**grounded_by:** `{webfetch: https://thoughtbot.com/blog/sandi-metz-rules-for-developers}` — Metz Rule 3 confirmed: "Pass no more than four parameters into a method. Hash options are parameters."

**See also:** CQ-012 (boolean flag arguments — adjacent misuse of parameters), CQ-010 (cognitive complexity).

### CQ-012: Boolean flag arguments — separate functions or options object

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Wojteklu, W. Clean Code summary gist (https://gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29 — derivative summary of Martin, R.C. (2008). *Clean Code.* <!-- PRINT-VERIFY-PENDING for Martin *Clean Code* flag-arguments chapter -->); agent-skills:code-simplification signal table.

**Rule:** Boolean flag arguments passed to control which of two behaviors a function performs are a function-abstraction failure signal. A function that takes a boolean flag to switch modes is implicitly two functions. At call sites, `doThing(true, false, true)` is unreadable without the function signature in memory. Surface when a function's parameter list includes one or more boolean arguments whose value determines a behavioral branch inside the function.

**Code patterns to flag:**
- Call sites with boolean literals as arguments: `render(item, true, false)` — caller cannot understand meaning without reading the signature
- Functions with `if (flag) { ... } else { ... }` where flag is a parameter — two-behavior function; split candidate
- Options-object with boolean fields that select mutually exclusive behaviors (different from additive options — flags that toggle branches are the smell; additive boolean options like `{ verbose: true }` are not)

**grounded_by:** `{webfetch: https://gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29}` — Wojteklu Clean Code summary confirms: "Don't use flag arguments. Split method into several independent methods that can be called from the client without the flag."

**See also:** CQ-011 (long parameter list — related misuse of function signature), CQ-010 (cognitive complexity — flag arguments add branching complexity), CQ-015 (spaghetti-condition — flag accretion is one scattering vector).

### CQ-013: Function size — peer-L3 divergent decision-point

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention — peer-divergent)
**Source:** DIVERGENT. (1) Metz, S. POODR Rule 2: "Methods can be no longer than five lines of code" (https://thoughtbot.com/blog/sandi-metz-rules-for-developers — confirmed). (2) Ousterhout, J. APoSD "deep modules" — explicitly critiques the small-functions-at-all-costs approach; APoSD ch. 4 ("Modules Should Be Deep") defines a shallow module as one whose interface is no simpler than its implementation, identifying it as a complexity red flag even when function line-count is small <!-- PRINT-VERIFY-PENDING for Ousterhout, *A Philosophy of Software Design* (APoSD) ch. 4 -->; the CS190 lecture (https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity) grounds the complexity-symptoms triplet (change amplification + cognitive load + unknown unknowns) and the dependencies/obscurity root causes. Both are L3 engineering convention.

**Rule:** Function size is a peer-divergent signal. Metz argues for ≤5 lines per method; Ousterhout argues that small functions can be "shallow modules" that increase cognitive load rather than reduce it. The divergent positions enumerated: Metz POODR Rule 2 advocates methods ≤5 lines; Ousterhout APoSD ch. 4 advocates "deep modules" where small functions can increase rather than decrease cognitive load by fragmenting domain logic. Per AIVV's L1-L4 source-class precedence, same-layer (L3 vs L3) disagreement does NOT trigger an automatic override — the finding stays on the IMPROVEMENT track unless there is a concrete failure/harm mode. Surface ONLY when the reviewer can articulate BOTH (a) a specific improvement to function size AND (b) the specific value that improvement provides in this codebase's context. DROP the finding if either cannot be articulated.

**Code patterns to flag (when Improvement-articulation passes):**
- Function >50 lines exhibiting multiple-responsibilities signal (handles both data-fetch AND presentation logic, for example)
- Shallow-module red flag: function whose public interface (signature + doc) is no simpler than its implementation — extraction would not reduce call-site cognitive load
- Conversely: micro-functions that require reading 5+ call sites to understand one operation (Ousterhout "unknown unknowns" from over-extraction)

**grounded_by:** `{webfetch: https://thoughtbot.com/blog/sandi-metz-rules-for-developers}` (Metz Rule 2 confirmed: "Methods can be no longer than five lines of code"); `{webfetch: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity}` (Ousterhout CS190: complexity = change amplification + cognitive load + unknown unknowns; root causes = dependencies + obscurity — confirmed); `<!-- PRINT-VERIFY-PENDING for Ousterhout APoSD ch. 4 "Modules Should Be Deep" — shallow-module definition -->` (APoSD ch. 4 grounds the shallow-module red flag)

**See also:** CQ-010 (cognitive complexity — nesting depth signal), CQ-011 (long parameter list — adjacent function-design signal), AS-001 (oversized module / god-file in `architecture.md` — the whole-file-cohesion complement at the architecture altitude; CQ-013 is within-function, AS-001 is whole-file), CQ-025 (relocated-not-removed — relocation often produces shallow helpers).

### CQ-014: Nested ternaries — replace with if/else, switch, or lookup object

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** agent-skills:code-simplification signal table (explicit anti-pattern: nested ternary); code-simplifier agent implementation; agent-skills:code-simplification SKILL.md.

**Rule:** Nested ternary expressions — ternaries whose consequence or alternative is itself a ternary — are a readability flag. Unlike flat ternaries (which can be concise for simple two-branch cases), nested ternaries require tracking multiple simultaneous conditions and their interactions, with no visual indentation aid. Surface when a ternary expression contains another ternary in any position (condition, true-branch, or false-branch).

**Code patterns to flag:**
- `const label = isAdmin ? 'Admin' : isEditor ? 'Editor' : 'Viewer'` — two-level ternary chain
- `a ? (b ? c : d) : e` — parenthesized nesting (any depth ≥2)
- Ternary chains used for multi-case routing that would be clearer as a `switch` statement or object-lookup map
- Template-literal expressions containing nested ternaries

**grounded_by:** `{unverified: agent-skills:code-simplification SKILL.md signal table — AIVV internal reference; the anti-pattern is widely established in JavaScript/TypeScript style guides (Airbnb, Google style guides) and ESLint `no-nested-ternary` rule}`

**See also:** CQ-010 (cognitive complexity — nested ternaries increase cognitive complexity score), CQ-012 (boolean flag arguments — related branching smell).

### CQ-015: Spaghetti-condition growth — scattered special-cases signal a missing model

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Refactoring.Guru (Shvets) summary of Fowler's "Switch Statements" smell (https://refactoring.guru/smells/switch-statements — scattered conditional logic distributed across program locations; adding a new condition forces finding and modifying every site; recommended treatments include Replace Conditional with Polymorphism and Extract Method/Move Method; Fowler *Refactoring 2nd ed.* <!-- PRINT-VERIFY-PENDING -->); Ousterhout, J. APoSD ch. 19 "Software Trends" — tactical, reactive special-casing accretes the dependencies + obscurity that constitute incremental complexity <!-- PRINT-VERIFY-PENDING for Ousterhout APoSD ch. 19 "Software Trends" tactical-vs-strategic framing -->; the CS190 lecture URL (https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity) grounds the dependencies + obscurity + incremental-accumulation claim only, not the tactical/reactive framing; Cursor cursor-team-kit thermo-nuclear skill (industry framing: a change that bolts scattered special-case conditionals onto an existing flow is a design problem, not a stylistic nit).

**Rule:** A change that adds special-case conditionals scattered across an existing flow — bolted-on `if`/`switch` branches handling new cases in several places rather than through a single model — is a design signal, not a stylistic nit. This is distinct from CQ-010, which flags nesting *depth*: CQ-015 flags *breadth and scattering* — the same decision re-made in multiple locations, the classic signal of a missing abstraction (a type code that wants polymorphism, a flag-set that wants a state object, a chain that wants a lookup table). Each new case then forces touching every site (Fowler's divergent-change / shotgun-surgery hazard). Surface when a diff adds conditional branches keyed on the same discriminator in ≥2 separate locations, or bolts a special-case onto an existing conditional instead of extending a model.

**Code patterns to flag:**
- New `if (type === 'X')` / `case 'X':` branches added in multiple functions for the same discriminator (type-code scattering → Replace Conditional with Polymorphism or a lookup table)
- A special-case `if` inserted mid-flow to patch one input shape, with no corresponding model change
- Repeated `switch`/`if` ladders over the same enum across different functions (each new enum value forces edits everywhere)
- Boolean/flag accretion on an existing branch (see also CQ-012) to handle a newly-discovered case

**grounded_by:** `{webfetch: https://refactoring.guru/smells/switch-statements}` — scattered conditional logic across locations; adding a case forces finding and modifying every site; treatment is Replace Conditional with Polymorphism / Extract Method. `{webfetch: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity}` — Ousterhout CS190: complexity stems from dependencies + obscurity and accumulates incrementally (the tactical/reactive special-casing framing is APoSD ch. 19, PRINT-VERIFY-PENDING; the CS190 URL grounds the dependencies + obscurity + incremental claim only).

**See also:** CQ-010 (cognitive complexity — nesting depth is the sibling signal; CQ-015 is the breadth/scattering axis), CQ-012 (boolean flag arguments — flag accretion is one scattering vector), CQ-021 (duplication vs wrong abstraction — scattered conditionals are often the missing-abstraction precursor), CQ-025 (relocated-not-removed — bolted-on branches relocate rather than remove complexity).

## Redundancy & abstraction (CQ-020..025)

### CQ-020: Dead code — delete, don't comment out

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Beck, K. (2023). *Tidy First?* Tidy 2 "Dead Code" <!-- PRINT-VERIFY-PENDING --> ; Refactoring.Guru (Shvets) summary of Fowler's Dead Code smell (https://refactoring.guru/smells/dead-code — confirmed: "a variable, parameter, field, method or class is no longer used (usually because it's obsolete)"; Fowler *Refactoring 2nd ed.* <!-- PRINT-VERIFY-PENDING -->); Ousterhout, J. APoSD (https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity — obscurity is a root cause of complexity per CS190 lecture; commented-out code contributes to obscurity by leaving readers uncertain whether retained code represents intended behavior or deferred deletion — implementer's extension of the obscurity principle, not a direct Ousterhout claim).

**Rule:** Commented-out code blocks, unreachable branches, unused imports, and unused functions/variables are dead code. Dead code is not archived for posterity by commenting out — version control serves that purpose. Commented-out code adds visual noise, leaves reviewers uncertain whether it will be restored, and accumulates as permanent clutter. Surface when a diff adds or retains commented-out code blocks, imports that no IDE/linter would mark as unused, or functions with no call sites.

**Code patterns to flag:**
- `// const oldFn = () => { ... }` — commented-out function bodies (delete; recover from git history if needed)
- Unreachable branches after a `return` or `throw` statement
- Import statements for modules not referenced in the file body
- `if (false) { ... }` or equivalent always-false guards around disabled logic
- Functions or class methods with no call sites in the project (verify with IDE "find usages" before flagging)

**grounded_by:** `{webfetch: https://refactoring.guru/smells/dead-code}` — Refactoring.Guru (Shvets) summary of Fowler's Dead Code smell (Fowler *Refactoring 2nd ed.* <!-- PRINT-VERIFY-PENDING -->): "a variable, parameter, field, method or class is no longer used (usually because it's obsolete)"; treatment is deletion via IDE detection.

**See also:** CQ-023 (speculative generality — dead code from features never used), CQ-001 (Chesterton's Fence — understand why before deleting), CQ-025 (relocated-not-removed — deletion is the cheapest complexity reduction).

### CQ-021: Duplication vs wrong abstraction — DRY is about knowledge

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention — peer-divergent)
**Source:** DIVERGENT (three L3 sources). (1) Metz, S. (2016). "The Wrong Abstraction." https://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction — confirmed: "duplication is far cheaper than the wrong abstraction"; "prefer duplication over the wrong abstraction." (2) Verraes, M. (2014). "DRY is About Knowledge." https://verraes.net/2014/08/dry-is-about-knowledge/ — confirmed: DRY concerns knowledge (identical business rules that will always change together), not syntax (identical lines that happen to look the same). (3) Hunt, A. & Thomas, D. (1999). *The Pragmatic Programmer.* "DRY — Don't Repeat Yourself" (print source; no public canonical-derivative URL) <!-- PRINT-VERIFY-PENDING -->.

**Rule:** Syntactic duplication (3+ similar lines across call sites) is NOT automatically a DRY violation. Duplication is a problem only when it represents the same knowledge — the same business rule or domain concept — that will always change together. When two pieces of code happen to look the same but represent different domain knowledge with independent reasons to change, deduplicating them creates harmful coupling. The wrong abstraction (an abstraction that grew parameters and conditionals to handle multiple cases) is MORE expensive than duplication. The divergent positions enumerated: Metz/Verraes advocate duplication-over-wrong-abstraction (DRY as knowledge-equivalence — same business rule that will always change together); Hunt/Thomas Pragmatic Programmer advocates DRY as syntactic deduplication (every piece of knowledge in one place). Surface ONLY when the reviewer can articulate BOTH (a) the knowledge-equivalence test (same knowledge at N sites that will always change together?) AND (b) the specific value of consolidation. DROP if either cannot be articulated.

**Code patterns to flag (when Improvement-articulation passes):**
- Extraction of a helper function based solely on syntactic similarity without knowledge-equivalence verification
- Shared function that has grown ≥3 boolean parameters or conditional paths to handle caller-specific variations (Metz's wrong-abstraction signature: "if you find yourself passing parameters and adding conditional paths through shared code, the abstraction is incorrect")
- `// TODO: consolidate with X` comment that hasn't been acted on, added as the only justification for a planned deduplication

**grounded_by:** `{webfetch: https://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction}` — Metz: "duplication is far cheaper than the wrong abstraction"; wrong abstraction identified by: parameters and conditional paths accumulate to handle different callers. `{webfetch: https://verraes.net/2014/08/dry-is-about-knowledge/}` — Verraes: DRY is about knowledge equivalence, not syntactic similarity; different business rules should remain separate regardless of code similarity.

**See also:** CQ-023 (speculative generality — over-abstraction for hypothetical callers), CQ-020 (dead code — wrong abstraction often produces dead-code branches), CQ-025 (relocated-not-removed — relocation often produces the wrong abstraction), CQ-015 (spaghetti-condition — scattered conditionals are often the missing-abstraction precursor), AS-003 (cross-file knowledge duplication in `architecture.md` — the system-level complement: CQ-021 is duplication WITHIN a file, AS-003 is the same knowledge replicated ACROSS files).

### CQ-022: Comments — what (delete) vs why (keep)

**Severity (default):** POLISH
**Source-class:** L3-L4 (engineering convention — peer-divergent)
**Source:** DIVERGENT. (1) Fowler, M. *Refactoring, 2nd ed.* Ch. 3 "Comments" smell (https://martinfowler.com/bliki/CodeSmell.html — general smell catalogue index; Fowler's Comments smell chapter argues: comments describing WHAT code does are often a sign that the name should improve instead — delete the comment, improve the name; the WHAT-vs-WHY argument lives in *Refactoring 2nd ed.* <!-- PRINT-VERIFY-PENDING for Fowler, *Refactoring 2nd ed.* (2018) Ch. 3 "Comments" smell -->; bliki/CodeSmell.html cited as general taxonomy entry point only, NOT as primary grounding for the WHAT-vs-WHY argument). (2) Beck, K. (2023). *Tidy First?* Tidy 14 "Explaining Comments" (keep comments that explain non-obvious domain decisions) + Tidy 15 "Delete Redundant Comments" (delete comments that restate what the code already says) <!-- PRINT-VERIFY-PENDING -->. (3) Ousterhout, J. APoSD ch. 12–13 "Comments Should Describe Things that Aren't Obvious from the Code" — comments that document interface contracts and non-obvious design rationale are part of the module's abstraction <!-- PRINT-VERIFY-PENDING for Ousterhout APoSD ch. 12–13 -->; the CS190 lecture (https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity) grounds the obscurity root-cause claim (unknown unknowns symptom).

**Rule:** Comments fall into two categories with opposite dispositions: (a) WHAT comments (describing what the code does mechanically) are deletion candidates — improve the name or extract a well-named function instead; (b) WHY comments (explaining non-obvious domain decisions, historical constraints, or interface contracts) are keep candidates. The divergent positions enumerated: Fowler/Beck argue most comments are a sign of poor naming (delete the comment, rename the thing); Ousterhout argues comments are part of the module abstraction interface (keep and improve them — omitting interface contracts increases the "unknown unknowns" complexity symptom). Surface ONLY when the reviewer can articulate (a) which side of the what-vs-why axis the comment falls on AND (b) the specific delete-or-keep value. DROP if either cannot be articulated.

**Code patterns to flag (when Improvement-articulation passes):**
- `// increment counter` above `count++` — pure WHAT comment; the code already says it (delete candidate)
- `// loop through items` above a `for` loop with a self-explanatory body (delete candidate)
- Absence of a WHY comment on a non-obvious algorithm (e.g., a magic number, a bitmask operation, a workaround for a third-party API quirk) — missing context is the opposite smell (add candidate)
- Comment block describing interface contract for a public function that lacks doc comments (Ousterhout: interface contract IS the abstraction)

**grounded_by:** `{webfetch: https://martinfowler.com/bliki/CodeSmell.html}` — Fowler bliki/CodeSmell.html confirms Comments as a code smell category (general taxonomy entry point); primary grounding for the WHAT-vs-WHY argument is Fowler *Refactoring 2nd ed.* Ch. 3 `<!-- PRINT-VERIFY-PENDING -->`. `{webfetch: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity}` — Ousterhout CS190: obscurity (unclear reasoning) is a root cause of complexity; WHY comments reduce the "unknown unknowns" symptom — confirmed.

**See also:** CQ-001 (Chesterton's Fence — WHY comments are part of the fence documentation), CQ-005 (project conventions — comment-style conventions are project authority).

### CQ-023: Speculative generality / YAGNI

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Refactoring.Guru (Shvets) summary of Fowler's "Speculative Generality" smell (https://refactoring.guru/smells/speculative-generality — confirmed: code created "just in case" to support anticipated future features that never materialize; primary indicator is unused classes, methods, fields, or parameters; Fowler *Refactoring 2nd ed.* <!-- PRINT-VERIFY-PENDING -->); Fowler, M. "YAGNI" bliki (https://martinfowler.com/bliki/Yagni.html — confirmed: "You Aren't Gonna Need It" — high probability of being wrong about future needs + cost of carry of unused complexity); Ousterhout, J. APoSD ch. 19 "Software Trends" — tactical vs strategic programming distinction: tactical programming (reactive to each request) produces speculative-generality anti-patterns when over-extended; strategic investment in design avoids YAGNI violations <!-- PRINT-VERIFY-PENDING for Ousterhout APoSD ch. 19 "Software Trends" tactical-vs-strategic framing -->; the CS190 lecture URL (https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity) grounds the complexity-symptoms triplet only, not the tactical-vs-strategic framing.

**Rule:** Abstraction layers, factory hierarchies, configuration knobs, or extension points introduced for hypothetical future requirements (with no current caller) are YAGNI violations. Only approximately one-third of anticipated features actually deliver value; the cost of carry of unused abstraction (complexity, maintenance, cognitive load) is paid immediately for uncertain future benefit. Surface when a diff introduces an abstraction with a single implementation, a factory class with a single concrete type, or a parameter/configuration key with no current caller.

**Code patterns to flag:**
- Abstract class or interface with a single implementing class, no documented justification for the indirection
- Factory or builder class that wraps a single concrete constructor with no polymorphism in sight
- Configuration flags or feature-toggle constants with no current callers in the project
- Plugin/hook/extension-point infrastructure introduced before the first plugin or hook exists
- `// for future use` comments adjacent to unused parameters or abstract methods

**grounded_by:** `{webfetch: https://refactoring.guru/smells/speculative-generality}` — Refactoring.Guru (Shvets) summary of Fowler's Speculative Generality smell: produces unused classes/methods/fields/parameters; treatment is deletion. `{webfetch: https://martinfowler.com/bliki/Yagni.html}` — Fowler YAGNI: ~1/3 of anticipated features deliver value; cost of carry is real and immediate.

**See also:** CQ-021 (wrong abstraction — related over-abstraction smell), CQ-020 (dead code — speculative generality often produces dead code when the future never arrives), CQ-025 (relocated-not-removed — speculative indirection with no caller relocates complexity).

### CQ-025: Refactor relocates complexity rather than removing it

**Severity (default):** POLISH
**Source-class:** L3 (engineering convention)
**Source:** Ousterhout, J. (2018). *A Philosophy of Software Design.* CS190 lecture notes (https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity — good design reduces complexity; complexity is caused by dependencies + obscurity and accumulates incrementally, so a restructuring that preserves the same dependencies and obscurity has not reduced complexity, only moved it); Beck, K. (2023). *Tidy First?* — tidyings are behaviour-preserving structure changes whose value is making subsequent change easier, not relocating mess <!-- PRINT-VERIFY-PENDING -->; Cursor cursor-team-kit `thermo-nuclear-code-quality-review` skill (https://github.com/cursor/plugins/tree/1e072c7612402c736c2612ee2341712a87397eb2/cursor-team-kit/skills/thermo-nuclear-code-quality-review — the deletion-bias framing: prefer removing moving pieces over refactors that spread the same complexity around; if a path to delete complexity exists rather than rearrange it, take it). **Deterministic-anchor rule.**

**Rule:** A refactor or simplification whose net effect is to *relocate* complexity — moving branches, state, or layers of indirection from one place to another — rather than *remove* it has not achieved its stated goal. Evaluate a refactor against the deletion bias: did the change reduce the total moving pieces (branches, parameters, layers of indirection, dependencies), or merely redistribute them? A refactor that adds an indirection layer to "clean up" a call site while preserving every dependency and branch increases complexity. Surface when a change framed as cleanup/refactor/simplification preserves the same branch count, dependency graph, or indirection depth while adding code — and ask whether a deletion path exists instead. Frame the finding as requesting justification for the added moving pieces.

**Deterministic anchor:** for a change framed as a refactor/cleanup/simplification, run `git diff --numstat <base>...HEAD` (where `<base>` is the PR/merge base, typically `origin/main`) and sum added vs removed lines. A **net-positive** diff (added > removed) is only a **coarse pre-filter** — line churn from reflow, rename, line-wrapping, or added type annotations is not complexity, so net-positive line counts routinely accompany genuine reductions. The load-bearing signal is whether the change's **branch / parameter / indirection count** actually dropped — which `git diff --numstat` does NOT measure and the reviewer must read directly. Net-positive lines *alongside an unchanged branch/indirection count* is the relocation signal; net-positive lines alone are not. The anchor prompts inspection — it does not auto-flag (extracting a genuinely shared abstraction with multiple callers is legitimately net-positive).

**Code patterns to flag:**
- A "refactor" change that is net-positive in lines while branch / condition count is unchanged (relocation, not reduction)
- A new indirection layer (wrapper / adapter / facade) introduced over a single call site with no second caller (relocation + speculative generality — see CQ-023)
- An extraction that moves a block into a helper but leaves the original complexity intact (same parameters threaded through, same branches) — the helper is shallow (see CQ-013)
- Renaming / reorganizing modules without reducing the dependency graph, described as a simplification (cross-file relocation — see AS-001)

**grounded_by:** `{webfetch: https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=complexity}` — Ousterhout: complexity stems from dependencies + obscurity and accumulates incrementally; a restructuring that preserves them relocates rather than reduces complexity. `{unverified: Cursor cursor-team-kit thermo-nuclear-code-quality-review skill (https://github.com/cursor/plugins/tree/1e072c7612402c736c2612ee2341712a87397eb2/cursor-team-kit/skills/thermo-nuclear-code-quality-review) — public industry-practice reference, not a normative standard; it is the source-of-idea for the deletion-bias framing, grounded normatively by Ousterhout}`

**See also:** CQ-020 (dead code — deletion is the cheapest complexity reduction), CQ-021 (duplication vs wrong abstraction — relocation often produces the wrong abstraction), CQ-023 (speculative generality — relocated indirection with no caller), CQ-013 (function size — relocation often produces shallow helpers), AS-001 (oversized module — cross-file decomposition must reduce complexity, not relocate it across files).

## Deferred rules

### CQ-024: Premature optimization — Knuth 97%/3% framing (DEFERRED)

<!-- DEFERRED-RETIRE-WHEN: AIVV-self or another code-lens dogfood project produces a profiler-report artifact (e.g., pprof / flamegraph / Node --prof output); retirement requires retrofitting CQ-024 with reviewer-actionable code patterns grounded in profiler output (not just the Knuth quote) plus calibration data from the dogfood artifact. On retirement: (1) move CQ-024 out of the Deferred section into ## Complexity signals, (2) add concrete code patterns to flag with profiler-evidence thresholds, (3) bump validate.sh Stage 8 CQ floor (16 as of dev.162) by +1. Until then, CQ-024 remains DEFERRED. -->

**Disposition:** Deferred from dev.109 scope. Knuth (1974) "Structured Programming with Goto Statements" — verbatim: *"Programmers waste enormous amounts of time thinking about, or worrying about, the speed of noncritical parts of their programs, and these attempts at efficiency actually have a strong negative impact when debugging and maintenance are considered. We should forget about small efficiencies, say about 97% of the time: premature optimization is the root of all evil. Yet we should not pass up our opportunities in that critical 3%."*

**Why deferred:** Optimization-flagging requires runtime-evidence artifacts (profiler reports). AIVV's static-artifact-scope ADR (three-tier scope model, Tier-2) explicitly admits profiler reports as in-scope static artifacts — so the rule itself is in-scope; the practical blocker is that no v0.1 dogfood target currently produces such artifacts AIVV could calibrate against. **Reopen when** a `code`-lens dogfood project (AIVV-self per `.aivv/methodology.md` Dogfood model section, or another sibling project) ships profiler artifacts that exercise the rule.

**Source (for reopen-time authoring):** Knuth, D. (1974). "Structured Programming with goto Statements." *Computing Surveys* 6:4, p. 268. Online verbatim record: https://en.wikiquote.org/wiki/Donald_Knuth

**See also (forward reference):** CQ-023 (speculative generality — adjacent on the "don't build for hypothetical" axis).
