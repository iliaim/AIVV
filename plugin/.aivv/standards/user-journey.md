# Standards — User-Journey Lens (UJ-*)

> **Rule-ID prefix:** `UJ-*` — user-journey lens standards. Covers AC-framing audit (UJ-AC-01a/01b), discoverability failures (UJ-DISC-01..04), activation-feedback failures (UJ-ACT-01..03), and time-to-first-success failures (UJ-TFS-01..02). Rule-ID format: `UJ-<FAMILY>-<NN[letter]>` where FAMILY ∈ {AC, DISC, ACT, TFS}.
>
> **Calibration routing:** the `user-journey` lens → `.aivv/calibration/user-journey/<invocation-id>.jsonl` per-invocation shards (lens-directory routing per `references/self-calibration.md`; legacy `user-journey.jsonl` read via union).
>
> **Methodology grounding:** Cognitive Walkthrough (Lewis, Polson, Wharton & Rieman CHI '90; CW2 Polson, Lewis, Wharton & Rieman 1992 IJMMS) layered with Heuristic Evaluation (Nielsen & Molich CHI '90; Nielsen 10 Heuristics 1994). Gray & Salzman 1998 (*Damaged Merchandise*) critiqued UEM-comparison-experiment designs broadly; the layered CW+HE framing follows Sears 1997's heuristic-walkthrough augmentation approach as the established mitigation for single-method reliability concerns.
>
> **Product-quality grounding:** ISO/IEC 25010:2023 Interaction Capability quality characteristic — specifically the **self-descriptiveness** sub-characteristic (added in the 2023 revision; absent from the 2011 version) and **operability** sub-characteristic. Rules in this file operationalize these sub-characteristics for code-review contexts.
>
> **See also:** [.aivv/lenses/user-journey.md](../../lenses/user-journey.md) — lens dispatch and trigger conditions. [.aivv/standards/ux-heuristics/nielsen.md](ux-heuristics/nielsen.md) — HEU-NN1, HEU-NN6. [.aivv/standards/interaction-states/](interaction-states/) — IS-* per-primitive state inventories.

---

## UJ-AC: AC-framing audit rules

### UJ-AC-01a: AC text describes implementation invariant

**Severity**: MAJOR (CRITICAL when ALL ACs for the feature are implementation-invariant with zero user-perceptible outcome assertions)
**Rationale**: Acceptance criteria that describe only code/state invariants ("function Z is called", "variable X is set to Y") can be verified by a reviewer reading source code while the feature is functionally broken for users. The reviewer correctly verifies code-against-AC; the AC itself is framed at the wrong abstraction layer. Per Fagan 1976 (*IBM Systems Journal*), spec-phase inspection finds 60–90% of defects; user-journey ACs enable that inspection. Capers Jones, in his body of software quality research, consistently identifies requirements defects as a leading source of delivered defects — conformance-to-wrong-requirements is not quality.
**Source**: Mavin, Wilkinson, Harwood, Novak, "Easy Approach to Requirements Syntax (EARS)," IEEE RE 2009 (targets 8 requirement-quality problems, of which ambiguity is one; EARS templates are designed for single-trigger stateless conditions — multi-step user journeys require story-mapping augmentation). Patton, *User Story Mapping* (O'Reilly 2014) — user story as conversation scaffold; outcomes framed in user-observable terms. ISO/IEC 25010:2023 self-descriptiveness sub-characteristic of Interaction Capability.

**The rule**: every AC that describes a user-visible feature must contain at least one assertion in user-observable terms. The assertion must describe what the user *sees*, *can do*, or *knows* — not what the code *calls*, *stores*, or *returns*.

**Failure patterns** (fire UJ-AC-01a):
- AC: "The `activeTool` state is set to `'blur'`" — code-internal invariant; no user-perceptible clause.
- AC: "The `onBlurActivate()` event handler is called with `mode: 'blur'`" — code-internal.
- AC: "The component rerenders with `isActive: true` prop" — code-internal.

**Acceptable patterns** (do NOT fire UJ-AC-01a):
- AC: "Clicking the Blur tool highlights the tool icon in the sidebar with a blue border" — user-observable.
- "The `activeTool` state is set to `'blur'` AND the sidebar tool icon shows a blue selection ring" — mixed: one code-internal + one user-observable clause. Acceptable because the user-observable clause is present.

**Emission target**: route finding to the **task file** (not the implementation file) — the AC is the defect source. Route to spec author for AC revision BEFORE verdict is formed.

**See also**: UJ-AC-01b (related failure — AC is user-observable but reviewer cites code-side evidence instead of user-observable artifact)

---

### UJ-AC-01b: AC text user-perceptible but reviewer cites code-side evidence

**Severity**: MAJOR
**Rationale**: When an acceptance criterion states a user-observable outcome, code-side evidence alone does not prove that the user sees it. For example, a state variable changing does not establish that a visible indicator updates. Reviewers should cite rendered DOM, a screenshot or video frame, a user-action trace, or a runtime assertion that checks the rendered element. Bacchelli & Bird (ICSE 2013) discuss code and change understanding as a central aspect of modern code review. Adzic, *Specification by Example* (Manning 2011), describes living documentation as claims that should be observable by users.
**Source**: Bacchelli & Bird, "Expectations, Outcomes, and Challenges of Modern Code Review," ICSE 2013; Adzic, *Specification by Example* (Manning 2011).

**The rule**: when a reviewer cites evidence for a user-perceptible AC clause, the evidence MUST describe a user-observable artifact — rendered DOM state, screenshot or video frame, user-action trace through the rendered surface, or a Playwright assertion checking the rendered element. Code-side artifacts (function call logs, state mutation traces, source-line references) do NOT constitute user-observable evidence for user-observable AC clauses.

**Failure pattern** (fires UJ-AC-01b):
- AC: "The selected tool is visibly highlighted after activation" — user-observable.
- Reviewer cites: `activeTool` changes in application state — code-internal state mutation. Does NOT prove the cursor visibly changes in the rendered surface.

**Acceptable evidence** (does NOT fire UJ-AC-01b):
- Screenshot or video showing the rendered cursor change.
- Playwright test: `expect(page.locator('canvas')).toHaveCSS('cursor', 'crosshair')`.
- Rendered DOM snapshot showing `cursor: crosshair` in computed styles.

**Emission target**: same as UJ-AC-01a — route to task file, to spec author, for evidence-quality revision or AC revision before verdict.

**See also**: UJ-AC-01a (AC text itself describes implementation invariant instead of user-observable outcome)

---

## UJ-DISC: Discoverability failure rules

### UJ-DISC-01: Feature has no visible entry point for a zero-knowledge user

**Severity**: MAJOR
**Rationale**: A feature that cannot be discovered from the rendered surface by a user with no prior knowledge is not usable by that user, regardless of its implementation quality. Nielsen-Molich HEU-NN6 (recognition rather than recall) formalizes this: information relevant to a decision should be visible rather than requiring users to retrieve it from memory.
**Source**: Nielsen & Molich, HEU-NN6 (recognition rather than recall) — see [ux-heuristics/nielsen.md](ux-heuristics/nielsen.md). Patton, *User Story Mapping* (O'Reilly 2014) — journeys begin with discovery. ISO/IEC 25010:2023 self-descriptiveness sub-characteristic.

**The rule**: every user-visible feature must have at least one visible entry point (labeled button, menu item, toolbar icon with tooltip, or other rendered affordance) discoverable from the surface without prior knowledge of the feature's existence.

**Code patterns to flag**:
- Feature activated only by keyboard shortcut (e.g., `keydown: 'b'` → activates blur mode) with no rendered UI affordance (no button, no menu item, no tooltip showing the shortcut)
- Feature in a context menu accessible only by right-click when the surface shows no hint that right-clicking is meaningful
- Capability accessible only via URL parameter or dev-console command in the shipped product

**Correct pattern**: labeled button or icon in the visible toolbar; menu item under a labeled menu group; first-time-use tooltip pointing at the affordance.

**See also**: UJ-DISC-02 (keyboard-shortcut-only variant), UJ-DISC-03 (hover-revealed-control variant), UJ-DISC-04 (keyword-recall variant). HEU-NN6 (`ux-heuristics/nielsen.md`).

---

### UJ-DISC-02: Feature activatable only via unmarked keyboard shortcut

**Severity**: MINOR (escalate to MAJOR when the keyboard shortcut is the PRIMARY and ONLY activation path)
**Rationale**: Unmarked keyboard shortcuts require prior knowledge (recall); they fail the recognition-rather-than-recall principle for first-time users. When a shortcut is an accelerator for an already-discoverable feature (toolbar button also exists), MINOR severity. When the shortcut IS the only entry point, see UJ-DISC-01 (MAJOR).
**Source**: HEU-NN6 (recognition rather than recall). HEU-NN7 (flexibility and efficiency of use) — keyboard shortcuts are accelerators for expert users, not the primary discovery path for novices.

**The rule**: keyboard shortcuts must be discoverable via a rendered tooltip, help panel, or contextual hint at the point of relevant interaction. An unmarked shortcut that is the sole entry point is a UJ-DISC-01 violation; an unmarked accelerator supplements an existing affordance and is UJ-DISC-02 at MINOR.

**Code patterns to flag**:
- `document.addEventListener('keydown', (e) => { if (e.key === 'b') activateBlur(); })` with no UI element showing `B` as a shortcut
- Feature-flag-gated keyboard binding with no tooltip or hint added

**Correct pattern**: tooltip on the toolbar icon showing the shortcut key (e.g., `title="Blur (B)"`); keyboard shortcut legend in the help panel.

**See also**: UJ-DISC-01 (when the shortcut is the ONLY entry point — escalate there at MAJOR).

---

### UJ-DISC-03: Feature entry point requires hover to become visible

**Severity**: MINOR (MAJOR when the hovered element itself is not discoverable without prior knowledge)
**Rationale**: Touch users, users with motor impairments, and users in remote-desktop/low-bandwidth contexts may not be able to hover. Additionally, a control that only appears on hover requires the user to know in advance where to hover — a recall requirement.
**Source**: HEU-NN6 (recognition rather than recall). WCAG 2.5.3 Label in Name and WCAG 1.4.13 Content on Hover or Focus (the accessibility dimension is compliance-lens scope; the UJ-DISC-03 concern is the discoverability dimension).

**The rule**: interactive controls that appear only on hover MUST be accompanied by a persistent affordance (icon, button, `...` / `⋮` menu) visible without hover that signals more actions are available. Never rely solely on hover-reveal for primary feature activation paths.

**Code patterns to flag**:
- `<div className="hover:flex hidden" ...>` wrapping buttons with no persistent indicator
- `onMouseEnter` / `on:mouseenter` toggling visibility of a primary action button
- CSS `.action-buttons { display: none; } .row:hover .action-buttons { display: flex; }` with no persistent `⋮` or `...` affordance at rest

**Correct pattern**: `⋮` / `...` persistent icon (always visible) expanding to actions on click; hover-visible controls supplemented by a visible affordance at rest.

**See also**: UJ-DISC-01 (when the hover-revealed control is the sole entry point — escalate there).

---

### UJ-DISC-04: Feature requires keyword recall without in-context hint

**Severity**: MINOR
**Rationale**: Search bars, command palettes, and filter inputs that activate specialized features only when the user types a specific keyword require the user to remember that keyword. Without a hint (placeholder, suggestion list, documented command), this is a recall requirement.
**Source**: HEU-NN6 (recognition rather than recall). Miller's Law (HEU-LUX-millers, `ux-heuristics/laws-of-ux/`) — keyword recall competes with working memory capacity.

**The rule**: command palettes, search bars, and filter inputs that accept keywords activating features MUST surface those keywords via suggestions, placeholder text, or an accessible help hint.

**Code patterns to flag**:
- Command palette with no placeholder text and no suggestion list on empty input
- `/` keyboard shortcut opens search bar with `Search...` placeholder but no hint that commands like `> run test` are accepted

**Correct pattern**: `placeholder="Search files or type '>' to run commands"` — surfaces the keyword syntax; suggestion list on empty input showing available commands.

**See also**: UJ-DISC-02 (keyboard-shortcut variant of discovery failure). UJ-DISC-01 (when the keyword-recall requirement blocks all feature access).

---

## UJ-ACT: Activation-feedback failure rules

### UJ-ACT-01: No visible feedback when the primary activation action fires

**Severity**: MAJOR
**Rationale**: Users must be able to tell that their action took effect. A feature that changes internal state without any visible surface change leaves the user in ambiguity: did the action register? Did it succeed? HEU-NN1 (visibility of system status) operationalizes this at the implementation level; UJ-ACT-01 operationalizes it at the user-journey level — did the user PERCEIVE the change, not just did a loading state render. Per Doherty & Thadhani 1982 (IBM Systems Journal), below 400ms, users perceive the action as having taken immediate effect; a visible change must appear within that window.
**Source**: Nielsen & Molich, HEU-NN1 (visibility of system status) — the design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time — see [ux-heuristics/nielsen.md](ux-heuristics/nielsen.md). Doherty & Thadhani, "The Economic Value of Rapid Response Time," IBM Systems Journal 21(4) 1982 — 400ms productivity inflection threshold.

**The rule**: the rendered surface must visibly change within 400ms of the user's primary activation action. The change must be perceptible to a user looking at the screen — a state update invisible to the user does not satisfy this rule.

**Code patterns to flag**:
- Feature toggle that updates only internal state (e.g., `activeTool = 'blur'`) with no visual indicator (no button highlight, no cursor change, no status display)
- Feature activation that triggers only a network request with no optimistic UI update and no loading indicator
- `setActive(true)` called but no UI element reads `active` to visibly change appearance

**Correct pattern**: button highlights (border, background, or icon change) immediately on click; cursor changes to reflect the active tool; sidebar indicator updates; status bar shows active mode.

**See also**: UJ-ACT-02 (feedback exists but is off-screen), UJ-ACT-03 (pre/post visually indistinguishable). HEU-NN1 (`ux-heuristics/nielsen.md`). IS-001 (`interaction-states/buttons-ctas.md`).

---

### UJ-ACT-02: Activation feedback appears outside common viewport boundaries

**Severity**: MAJOR
**Rationale**: Feedback that requires scrolling to see fails the same way as no feedback — the user looking at the primary action point cannot tell whether it worked. This is particularly common when a UI-distant element changes (e.g., the user clicks a button at page center and the feedback appears in a fixed status bar at the bottom of an 800px viewport).
**Source**: HEU-NN1 (visibility of system status). Nielsen 1993, *Usability Engineering*, response-time thresholds — the system must respond *visibly* within the user's attention window.

**The rule**: activation feedback must appear within the user's current viewport without scrolling. Elements more than ~800px below the viewport top (common minimum laptop-screen height) should not be the sole feedback mechanism for an action triggered elsewhere on the page.

**Code patterns to flag**:
- Toast notification at `position: fixed; bottom: 0` as the sole indicator for an action triggered from a modal or header at the top of the page
- Status bar update at `position: fixed; bottom: 0` as the sole feedback for a sidebar action at top-left

**Correct pattern**: inline feedback near the activation point (button state change, inline status text); OR global feedback (toast/snackbar) near the viewport center or near the action's visual position (top-right is web convention for global feedback close to common action positions).

**See also**: UJ-ACT-01 (no feedback at all), UJ-ACT-03 (feedback present but visually indistinguishable).

---

### UJ-ACT-03: Pre-state and post-state are visually indistinguishable

**Severity**: MAJOR (MINOR when the difference exists but is subtle — requires deliberate inspection to notice)
**Rationale**: A visual change so small or subtle that a user cannot reliably distinguish the before-state from the after-state provides no effective perceptible feedback. The user perceives no change even though the code fired. When B3 runtime evidence or an explicit host runtime adapter is available, this can be verified empirically via SSIM ≥ 0.99 threshold on screenshot diff (per `runtime-visual.md` RTV-DIFF-* rules).
**Source**: Nielsen 1993, *Usability Engineering*, instantaneous perception threshold (0.1 s / just-noticeable-difference contrast change required). Perceptual similarity: SSIM ≥ 0.99 threshold (per `.aivv/standards/runtime-visual.md` RTV-DIFF-* rules for optional B3 runtime evidence).

**The rule**: the activated state must differ from the neutral state by at least one perceptible visual dimension — color, size, position, border, label text, or cursor shape — by a margin large enough to be immediately noticeable without pixel-level inspection.

**Code patterns to flag**:
- Toggle that changes only `opacity: 0.9 → 1.0` (imperceptible to most users)
- Active state indicated only by `font-weight: 600 → 700` without size or color change (subtle at most body font sizes)
- Sidebar indicator changes from `#666` to `#555` (perceptually near-identical grays)

**Correct pattern**: active state changes color, border, or icon shape visually distinct at a glance — blue border, filled vs outline icon, contrasting underline, distinct background.

**See also**: UJ-ACT-01 (no feedback change at all), UJ-ACT-02 (feedback off-screen).

---

## UJ-TFS: Time-to-first-success failure rules

### UJ-TFS-01: Task completion requires external instruction

**Severity**: MAJOR
**Rationale**: A feature that requires the user to read external documentation, ask a colleague, or have been told about a shortcut in advance cannot deliver its value to a user encountering it for the first time. This is the canonical "user story" failure mode: the story promises "user can <do X>" but the user cannot without help. Patton (*User Story Mapping*, O'Reilly 2014) frames user stories as conversations about the journey, not just the capability.
**Source**: Patton, *User Story Mapping* (O'Reilly 2014). ISO/IEC 25010:2023 operability sub-characteristic of Interaction Capability. Fagan 1976 (*IBM Systems Journal*) — spec-phase inspection prevents requirements defects from propagating to shipped features.

**The rule**: a zero-knowledge user — no prior knowledge, no documentation read, no demo seen — must be able to complete the feature's primary task successfully using only the rendered surface and any tooltips or in-context hints the surface provides.

**Zero-knowledge walkthrough protocol** (apply when evaluating for TFS-01):
1. Pretend you have never seen this feature and know nothing about it.
2. Starting from the normal entry screen, what do you SEE first?
3. At each step: *"Will a user encountering this for the first time know what to do here?"* If the answer requires knowing a shortcut, reading a README, or prior training — mark that step.
4. If any step requires external instruction to proceed, emit UJ-TFS-01.

**Code patterns to flag**:
- Keyboard-shortcut-only activation with no tooltip or visual affordance (also fires UJ-DISC-01/02)
- Feature accessible only via undocumented URL parameter
- Multi-step workflow where step 2 requires knowing a word or concept not shown on screen

**See also**: UJ-TFS-02 (multi-step undocumented sequence). UJ-DISC-01 (specific case: no visible entry point).

---

### UJ-TFS-02: Task completion requires multi-step undocumented sequence with no breadcrumb or next-step prompt

**Severity**: MINOR
**Rationale**: Complex multi-step features are acceptable; the failure is when those steps are undocumented and the UI provides no prompting, progress indicator, or next-step hint. A user who gets stuck at step 2 of 4 because the UI gave no signal that step 3 exists will abandon, even if the feature works correctly.
**Source**: HEU-NN3 (user control and freedom — backtracking without losing state). Patton, *User Story Mapping* (O'Reilly 2014) — stories must surface the entire journey, not just the happy-path activation. ISO/IEC 25010:2023 operability.

**The rule**: multi-step features must surface progress indication or next-step prompting at each step boundary. The user must be able to tell: (a) how many steps exist, OR (b) that there is a next action and what it is.

**Code patterns to flag**:
- 3-step wizard with no progress bar, no step counter, and no visible next-step CTA at each step
- Inline editor that requires Shift+Enter to submit but shows only a bare text input (no hint)
- Feature modal that opens to empty state with no explanatory text describing what to do first

**Correct pattern**: step counter ("Step 1 of 3"), progress dots, contextual empty-state text ("Draw a selection area to begin"; "Press Enter to confirm or Escape to cancel").

**See also**: UJ-TFS-01 (when the multi-step nature requires external instruction to even begin step 1).
