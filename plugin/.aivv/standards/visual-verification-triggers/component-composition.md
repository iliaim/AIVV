# Visual Verification Triggers — Component composition and layout primitive changes

Part of [.aivv/standards/visual-verification-triggers/](README.md) (VVT-010..013, VVT-067). Extended dev.98 = T23 phase 8 batch 1 — HTML `<dialog>` element + `.showModal()` / `.show()` API (Baseline Widely available since March 2022) appended per the dev.86 by-domain partition policy.

### VVT-010: Swapped layout primitive or wrapper component

**Pattern (diff-observable)**:
- Content match: changed JSX/template tag (`<div>` → `<section>`/`<article>`/`<main>`/`<aside>`/`<nav>`), or swapped design-system wrapper (`<Box>` → `<Stack>`, `<Container>` → `<Grid>`)

**Why runtime verification is needed**: Design-system wrappers ship their own padding, gap, and display rules; swapping them changes spacing and alignment in ways the diff hides.

**What to verify externally**:
- Spacing around and inside the swapped element matches the prior baseline
- No regression in nested interactive element alignment

**Suggested tooling**: manual screenshot comparison | Playwright-class browser automation (visual diff)

---

### VVT-011: Children prop / slot restructure

**Pattern (diff-observable)**:
- Content match: hunks that reorder, wrap, or unwrap children passed to a component; changes to `React.Children.map`, Vue `<slot>`, Svelte `<slot>` consumers

**Why runtime verification is needed**: Parent components often style children via `:first-child`, `:last-child`, `:nth-child`, `> *`, or grid-area assignments; reordering invisibly reshuffles which child gets which style.

**What to verify externally**:
- First/last element styling still targets the correct child
- Grid/flex order matches intent

**Suggested tooling**: manual screenshot comparison | Chrome DevTools-class in-browser inspection

---

### VVT-012: Portal, teleport, or detached-DOM usage

**Pattern (diff-observable)**:
- Content match: added `ReactDOM.createPortal`, `<Teleport>` (Vue), `{#portal}` (Svelte), `createPortal` from a design system, or new `document.body.appendChild` in component code

**Why runtime verification is needed**: Portals bypass the DOM hierarchy, escaping ancestor CSS and scroll containers — behavior is entirely runtime-visible.

**What to verify externally**:
- Portal content inherits the intended theme (CSS variables, `.dark` class)
- Portal does not trap focus incorrectly
- Portal scrolls correctly on small viewports

**Suggested tooling**: Playwright-class browser automation | manual keyboard test

---

### VVT-013: Conditional rendering of layout regions

**Pattern (diff-observable)**:
- Content match: new `{condition && <Region />}`, ternary returning different JSX shapes, or feature-flag-gated layout branches

**Why runtime verification is needed**: Each branch must be individually checked; diff review covers only the branch-new code, not the collapsed-vs-expanded layouts.

**What to verify externally**:
- Both branches render without layout collapse or orphaned containers
- Transition between branches (if animated) does not flash

**Suggested tooling**: Playwright-class browser automation (visit both branch states) | manual toggle test

---

### VVT-067: HTML `<dialog>` element + `.showModal()` / `.show()` API — Baseline Widely available since March 2022

**Pattern (diff-observable)**:
- Content match: new `<dialog>` element in markup; new `dialogRef.showModal()` / `dialogRef.show()` / `dialogRef.close(<returnValue>)` JS calls; new `::backdrop` pseudo-element styling on a dialog; `<form method="dialog">` submission inside a dialog; framework wrappers that delegate to native `<dialog>` (Radix `Dialog`, HeadlessUI `Dialog`, Reach `AlertDialog`, Material Web `MdDialog`, Lit-based design-system dialogs)
- File/path match: any HTML, JSX/TSX/Vue/Svelte; component files exporting Dialog/Modal/Alert/Sheet/Drawer primitives; global stylesheets that target `dialog`, `dialog[open]`, or `::backdrop`

**Why runtime verification is needed**: `<dialog>` is a native top-layer-rendering primitive whose two modes — `.showModal()` (modal) and `.show()` (non-modal) — differ in behaviors invisible to diff review. Per MDN's `HTMLDialogElement.showModal()` description (paraphrased — see Source line for the verbatim Baseline quote): the method displays the dialog as a modal dialog, rendering into the top layer with a `::backdrop` pseudo-element; elements inside the same document as the dialog (except the dialog and its descendants) become inert (equivalent to having the `inert` attribute set); only the containing document is blocked (an iframe `.showModal()` does not block the parent page). Diff review shows the markup and the method call but cannot reveal: (a) **modal vs non-modal divergence** — `.showModal()` renders to the Top Layer above all stacking contexts, displays a `::backdrop` pseudo-element, makes the rest of the document inert, and intercepts Escape with a `cancel` event followed by `close`; `.show()` keeps the dialog in normal flow, does NOT inert the document, does NOT show `::backdrop`, and does NOT respond to Escape. Picking the wrong mode is the canonical defect; (b) **Top Layer stacking against existing UI** — Top Layer renders ABOVE `position: fixed` chrome and `z-index: <large>` stacking contexts; pre-existing toasts / sticky headers / floating action buttons may be silently obscured. Verify the dialog does not bury critical chrome and that any peer Top Layer surface (popover, fullscreen, picture-in-picture) stacks acceptably; (c) **focus behavior on open** — per WHATWG's dialog focusing-steps algorithm: if the dialog itself has `autofocus`, focus moves to the dialog; otherwise focus moves to the dialog's **focus delegate** (the first descendant subtree containing `autofocus`, falling back to the first sequentially focusable descendant per the focus-delegate algorithm); otherwise focus moves to the dialog itself. Verify the initial-focus target matches design intent (do not focus the destructive "Delete" button by accident); (d) **focus restoration on close** — the browser restores focus to the previously-focused element on `dialog.close()`; verify the trigger button still exists and is visible when the dialog closes (regression class: dynamically-removed trigger leaves focus on `<body>`, surfacing as "Tab starts from the top" for keyboard users); (e) **Escape handling subtleties** — `.showModal()`-mode Escape fires a cancelable `cancel` event before `close`; if any handler calls `preventDefault()` on `cancel`, the dialog stays open — verify intended dismiss behavior; the new `closedby` attribute (Baseline Limited at time of authoring; values `any` / `closerequest` / `none`) opts into varying close-request behavior — `closedby="any"` enables light-dismiss (outside-click closes); `closedby="closerequest"` enables only the platform close-request (Escape) without outside-click; `closedby="none"` disables both. Not universally supported, so manual outside-click handlers may still be needed for cross-browser parity; (f) **`::backdrop` styling regressions** — `::backdrop` inherits NOTHING from its dialog or parents (initial values only); `backdrop-filter: blur()` on the backdrop renders independently of dialog content; entry/exit animation on `::backdrop` requires `@starting-style` for the open transition (see VVT-048); (g) **form integration** — `<form method="dialog">` submits by closing the dialog and assigning the submitter's `value` to `dialog.returnValue`; verify the returnValue is consumed by the close handler and not silently dropped; (h) **scroll-lock on the underlying page** — `.showModal()` does NOT lock body scroll by default; some browsers/UAs treat it differently; verify body scroll behavior matches design (often `overflow: hidden` on `:has(dialog[open])` or on `<body>` while open is desired); (i) **iframe scope** — Top Layer + inert + Escape are scoped per-document; a `.showModal()` inside an iframe blocks only that iframe, not the parent page — verify the embed context matches design intent.

**What to verify externally**:
- Visual: dialog renders in Top Layer above pre-existing fixed-position chrome (verify with a sticky header / floating action button overlap test); `::backdrop` covers the inert region acceptably (color, opacity, blur match design); entry/exit animation (if any) does not flash or jank
- Focus behavior: keyboard-only Tab traversal stays inside the dialog; Shift+Tab from the first focusable wraps to the last; Tab from the last wraps to the first; initial focus lands on a sensible target (cancel/close/primary action per design intent); on close, focus returns to the triggering element
- Escape behavior: Escape closes the dialog (showModal mode); `cancel` event handlers do not unintentionally block close
- `.show()` (non-modal) mode: dialog does NOT inert background; user can interact with both the dialog and surrounding content; no `::backdrop` renders — verify this is the intended UX
- Form submission: `<form method="dialog">` submission closes the dialog and `dialog.returnValue` reflects the submitter's value; consumer reads returnValue correctly
- A11Y: screen-reader announcement on open (NVDA / VoiceOver / TalkBack); accessible name present (`aria-labelledby` to a heading inside the dialog); A11Y-049 / A11Y-047 compliance (see See also below)
- Stacking: peer Top Layer surfaces (popover, native `<select>`, fullscreen) stack acceptably when both open
- Mobile: dialog renders correctly within mobile viewport (no horizontal overflow); body scroll behavior matches design (locked or not, per intent)

**Source**: https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal (per-feature page; Baseline banner verbatim: "Baseline Widely available" + descriptor sentence "This feature is well established and works across many devices and browser versions. It's been available across browsers since March 2022". The showModal page banner has NO asterisked caveat-footnote — the two-segment Widely-available + descriptor form is the complete banner. Behavior paraphrase: `.showModal()` displays the dialog as a modal dialog, rendering into the top layer with a `::backdrop` pseudo-element; elements inside the same document — except the dialog and its descendants — become inert (equivalent to setting the `inert` attribute); only the containing document is blocked, so an iframe `.showModal()` does not block the parent page.

**See also**: **VVT-019** (`state-interaction.md`) for the broader "Dialog, modal, popover, or tooltip behavior change" trigger — VVT-067 is the specific HTML `<dialog>` + imperative-API trigger; VVT-019 covers framework dialog wrappers and behavior changes more broadly. **VVT-039** (`modern-platform.md`) for the sibling Top Layer primitive — HTML `popover` attribute / Popover API; both render to Top Layer but differ on modal semantics (popover is non-modal by default, dialog `.showModal()` is modal with native inert backdrop). **VVT-040** (`modern-platform.md`) for the `inert` attribute — `.showModal()` makes the document inert automatically; verify any manual `inert` toggling does not double-up. **VVT-017** for focus management — `<dialog>` provides native focus-on-open + focus-restore-on-close, distinct from manually-managed focus traps. **VVT-048** (`css-styling.md`) for `@starting-style` entry transitions — the canonical entry-animation primitive for top-layer dialogs (paired with `::backdrop`). **VVT-054** (`css-styling.md`) for `prefers-reduced-motion` — required pairing whenever a dialog ships entry/exit animations. **Cross-catalog peers**: **A11Y-049** (`accessibility/aria/apg-widgets.md`, "Dialog (Modal) — focus trap + initial focus + Esc + return focus") — the WCAG/APG compliance authority for modal dialogs; VVT-067 is the runtime-verification trigger for code authoring `<dialog>` + `.showModal()` that must respect A11Y-049's focus + Esc + return-focus requirements. **A11Y-047** (same file, "Alertdialog — `role="alertdialog"` requires name + describedby + focus trap") — directly relevant when a `<dialog>` is used for destructive-confirmation flows (alertdialog semantics). **UX-014** (`ui-ux/feedback-confirmation.md`, "Modal dialogs must trap focus, close on Escape, and restore focus on close") — the UX-discipline authority for the same behaviors VVT-067 verifies.

**Suggested tooling**: Playwright-class browser automation with `page.locator('dialog').evaluate(d => d.open)` open-state assertions + `page.keyboard.press('Escape')` close test | Chrome DevTools-class in-browser inspection (focus inspector for trap verification, Top Layer overlay viewer) | manual screen-reader test (NVDA / VoiceOver / TalkBack) for accessible-name and on-open announcement | aXe DevTools for ARIA conformance
