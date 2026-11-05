# Runtime Visual Verification

Read this before runtime or visual verification; static review continues when runtime artifacts or host adapters are unavailable.

Contents:
- Runtime correctness
- UI/UX/accessibility trigger conditions
- Visual verification advisory

#### Runtime Correctness (when code changes exist)

Static analysis — type checks, linters, compilation — verifies structure. It does not verify runtime semantics. For any non-trivial code change, ask: **what does the runtime environment do with this, independently of what the type checker said?**

This is especially important when the session context claims something "passes" or "compiles clean." Passing the type checker is necessary but not sufficient. Look for cases where the framework, browser, runtime, or external system will behave differently from what the code assumes — particularly around ordering, mutual exclusivity, implicit defaults, and lifecycle events.

#### UI/UX/Accessibility (when diff touches UI surfaces)

**Trigger conditions** (apply when ANY match — see `.aivv/standards/visual-verification-triggers.md` for the full list):
- Diff touches files matching `**/*.{html,tsx,jsx,vue,svelte}`
- Diff touches `**/*.{css,scss,sass,less,styl,module.css,module.scss}`
- Diff touches assets: `**/*.{png,jpg,jpeg,webp,avif,gif,svg,ico}`
- Diff touches frontend-package paths (`app/`, `pages/`, `components/`, `src/ui/`, `src/frontend/`, `web/`, `client/`)
- Diff touches viewport / document-level files (`index.html`, `app/layout.*`, `_document.*`, `head.*`)
- Diff adds/modifies form handling, validation, state rendering, or navigation

**Topic-based triggers** (apply when session context matches, even if the diff is backend-only or absent):
- Session topic involves **error handling, error messages, or user-facing error UX** — consult UX-005, UX-013, UX-028, UX-029, UX-036, A11Y-035 at minimum
- Session topic involves **notifications, toasts, snackbars, or alert systems** — consult UX-013, A11Y-028, A11Y-035
- Session topic involves **form validation or input error states** — consult UX-004, UX-005, UX-028, UX-036, A11Y-011, A11Y-042
- Session topic involves **e-commerce checkout, payment forms, or cart abandonment** — consult UX-030 through UX-036 + A11Y-061 (cc-* token enumeration authority)
- Session topic involves **data tables, sortable lists, ARIA grid widgets, or pagination controls** — consult UX-037 through UX-041 + A11Y-008 (`<table>` + `<caption>` + `<th scope>` baseline)
- Session topic involves **search inputs, filter panels, faceted-navigation checkboxes, tri-state select-all, or result-count announcements** — consult UX-042 through UX-046 + A11Y-048 (combobox) + HEU-LUX-doherty (debounce timing) + MC-023 (empty filter-result microcopy)
- Session reviews a **plan or design document** (no diff) that describes user-facing behavior — apply all UI/UX/a11y standards to the planned behavior as described, not just to code

**Visual verification advisory** — emit after the findings section when ANY `VVT-NNN` trigger matches the diff:

```
## ⚠ Visual verification required

This change alters rendered behavior in {files/components}. Code-level review found {N} findings; runtime rendered-output verification is needed to catch issues code review cannot (visual regressions, computed contrast, focus-ring appearance, cross-viewport layout, accessibility tree behavior).

Matched triggers: {comma-separated VVT-IDs with one-line descriptions}

Verify externally via Playwright-class browser automation, Chrome DevTools-class in-browser inspection, or manual screenshot comparison before merge. When using the B3 workflow, resolve `AIVV_ROOT` through the bundled `.aivv/runtime-root.md` runtime-root contract, then run `node "$AIVV_ROOT/tools/runtime-evidence.mjs" emit --review <review-log.json>`, execute the generated specs in the target project, and ingest Playwright JSON with `node "$AIVV_ROOT/tools/runtime-evidence.mjs" ingest --review <review-log.json> --results <results.json>`. Specific things to verify per trigger are documented at `.aivv/standards/visual-verification-triggers.md`.
```

If NO triggers match, do NOT emit this block — code-level review stands on its own.
