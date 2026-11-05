# Visual Verification Triggers — State, interaction, and form-flow changes

Part of [.aivv/standards/visual-verification-triggers/](README.md) (VVT-014..019, VVT-047, VVT-055..056, VVT-059, VVT-063..064). Extended dev.86 = T23 phase 3 — `:user-valid` / `:user-invalid` interaction-gated form-validation styling (Baseline 2023) appended per the dev.86 by-domain partition policy (closes the dev.85 by-date-subfile redistribution sigil). Extended dev.89 = T23 phase 5 — `inputmode` virtual-keyboard hint (Baseline 2021) and `enterkeyhint` virtual-keyboard-action-label (Baseline 2021) appended per the same policy. Extended dev.90 = T23 phase 6 — `autocomplete` token-list attribute appended per the same policy. Extended dev.92 = T23 phase 7 — `:focus-visible` pseudo-class (Baseline 2022) and `<details>`/`<summary>` disclosure widget (Baseline 2020) appended per the same policy.

### VVT-014: New or modified form validation logic

**Pattern (diff-observable)**:
- Content match: changes to validation schemas (`zod`, `yup`, `joi`), `onSubmit`/`onBlur` handlers, new inline error-message elements, changed `aria-invalid`/`aria-describedby` wiring

**Why runtime verification is needed**: Error states, their visibility, their announcement to screen readers, and their keyboard-focus behavior are runtime properties; invalid fields must also be reachable after submit-attempt focus management.

**What to verify externally**:
- Submit with empty/invalid fields shows inline errors and moves focus to the first invalid field
- Screen reader announces error messages (via `aria-live` or `aria-describedby`)
- Error styles meet contrast requirements

**See also**: **VVT-047** for the CSS `:user-valid` / `:user-invalid` pseudo-classes — the canonical interaction-gated visual-state pairing for the validation logic this trigger covers. **VVT-055** for `inputmode` — pairs with form-validation changes whenever an input adds a virtual-keyboard hint (the hint does NOT validate; validation must be wired independently). **VVT-056** for `enterkeyhint` — pairs when an Enter-key-on-submit / search / send / next flow is added. **VVT-059** for `autocomplete` — pairs when a new form adds autofill tokens; autofill triggers validation events with the autofilled values.

**Suggested tooling**: Playwright-class browser automation | aXe DevTools | screen-reader manual test (VoiceOver/NVDA)

---

### VVT-015: Loading, skeleton, or pending-state implementation

**Pattern (diff-observable)**:
- Content match: new `isLoading`/`isPending`/`isFetching` conditionals, `<Suspense>` boundaries, skeleton components, `aria-busy` attributes

**Why runtime verification is needed**: Loading-state layout stability (does the skeleton match the loaded content's footprint?), flash-of-loading (does it appear for requests < 200ms?), and `prefers-reduced-motion` handling are runtime-only signals.

**What to verify externally**:
- Skeleton dimensions match loaded content (no CLS on resolve)
- Fast responses do not flash the skeleton
- Loading state is announced to assistive tech

**Suggested tooling**: Chrome DevTools-class in-browser inspection (Network throttle) | Playwright-class browser automation

---

### VVT-016: Error boundary or error-state UI added or modified

**Pattern (diff-observable)**:
- Content match: new `componentDidCatch`/`ErrorBoundary`, error-route handlers, fallback UI JSX, `<ErrorBoundary fallback={...}>`

**Why runtime verification is needed**: Error UI is rarely exercised in development; its layout, retry affordance, and focus management only surface when the error path is triggered.

**What to verify externally**:
- Error UI renders at all viewports without overflow
- Retry/back action is keyboard reachable
- Focus moves to the error heading on error

**Suggested tooling**: Playwright-class browser automation (force error via mocked failure) | manual trigger

---

### VVT-017: Focus management code

**Pattern (diff-observable)**:
- Content match: new `ref.current.focus()`, `autoFocus` additions, `focus-trap-react` / `@radix-ui/react-focus-scope` usage, `tabindex` attribute changes, `aria-activedescendant` wiring

**Why runtime verification is needed**: Focus order, trap integrity, and restoration on unmount are entirely runtime behaviors; a diff cannot show whether focus lands on the right element or escapes a modal.

**What to verify externally**:
- Tab traversal order is logical (no skipped elements, no hidden tabstops)
- Modal focus trap cannot escape via Tab or Shift+Tab
- Focus returns to the trigger element on modal close
- Visible focus indicator on every focusable element

**See also**: **VVT-040** (`modern-platform.md`) for the HTML `inert` attribute — a declarative focus-management primitive that removes a subtree from the tab order + accessibility tree. **VVT-067** (`component-composition.md`) for HTML `<dialog>` + `.showModal()` — provides native focus-on-open + focus-restore-on-close + focus trap automatically, eliminating manual focus-management code when the modal use case can adopt the native primitive.

**Suggested tooling**: manual keyboard walk | Playwright-class browser automation (`page.keyboard.press('Tab')` sequence)

---

### VVT-018: Keyboard event handler additions

**Pattern (diff-observable)**:
- Content match: new `onKeyDown`/`onKeyUp`/`onKeyPress`, `addEventListener('keydown', ...)`, key-combo libraries (`react-hotkeys`, `mousetrap`)

**Why runtime verification is needed**: Keyboard shortcut conflicts with browser/OS shortcuts, and interaction with IME composition, are runtime-only concerns.

**What to verify externally**:
- Shortcut does not conflict with browser defaults (Ctrl+S, Cmd+K, etc.) unless intentional
- Shortcut does not fire during IME composition
- Shortcut is discoverable (hint, tooltip, or help overlay)

**See also**: **VVT-055** for `inputmode` — does NOT change which key events fire, only virtual-keyboard layout. **VVT-056** for `enterkeyhint` — labels the virtual-keyboard Enter key, but the actual key-event handler (submit / next / search) must still be wired independently.

**Suggested tooling**: manual keyboard test | Playwright-class browser automation

---

### VVT-019: Dialog, modal, popover, or tooltip behavior change

**Pattern (diff-observable)**:
- Content match: changes to `<dialog>` usage, `showModal()`/`show()`, Radix/HeadlessUI `Dialog`/`Popover`/`Tooltip` props, `role="dialog"`/`role="alertdialog"` changes

**Why runtime verification is needed**: Dismiss behavior (Escape, click-outside, focus-out), scroll-lock on body, and inert background are interactive behaviors invisible in the diff.

**What to verify externally**:
- Escape key closes the overlay
- Click-outside closes (if designed to)
- Body scroll is locked while open
- Background is inert to pointer and keyboard

**See also**: **VVT-067** (`component-composition.md`) for the specific HTML `<dialog>` element + `.showModal()` / `.show()` API trigger — VVT-019 is the broader behavior-change trigger; VVT-067 is the specific native-element-and-API trigger covering Top Layer + native inert backdrop + native focus management. **VVT-039** (`modern-platform.md`) for the native HTML `popover` attribute / Popover API — a declarative alternative to `<dialog>` for non-modal popover surfaces (Baseline 2024). **VVT-040** for the `inert` attribute that achieves background-inert declaratively. **VVT-044** (`framework-observer.md`) for Custom Element / Shadow DOM dialog implementations (Spectrum, Material Web, Lit-based design systems often ship dialogs as custom elements). **VVT-048** (`css-styling.md`) for `@starting-style` entry transitions on top-layer dialogs / popovers — the canonical entry-animation primitive for dialog open/close transitions. **VVT-054** (`css-styling.md`) for the `prefers-reduced-motion` trigger — required pairing whenever a dialog / modal / popover ships entry/exit animations.

**Suggested tooling**: Playwright-class browser automation | manual keyboard + pointer test

---

### VVT-047: CSS `:user-valid` / `:user-invalid` pseudo-class additions — Baseline 2023

**Pattern (diff-observable)**:
- Content match: added or modified selectors using `:user-valid` or `:user-invalid` (e.g., `input:user-invalid`, `select:user-valid + .field-status`); often paired with removal of `:valid` / `:invalid` declarations (migration from page-load-eager to user-interaction-gated validation styling)
- File/path match: `**/*.{css,scss,sass,less}`, CSS-in-JS template literals, form-component styles

**Why runtime verification is needed**: `:user-valid` and `:user-invalid` match a form control's validation state ONLY after the user has interacted with it — committed a change (typically via blur), attempted to submit the form, or made a change that turns an invalid value valid while focus remains. This is intentionally different from `:valid` / `:invalid`, which match on initial page load regardless of interaction. Diff review shows the selector swap but cannot reveal the runtime UX difference: a `:invalid` red-border on every empty required field at page load (potentially user-hostile) vs the new `:user-invalid` red-border only after the user has tried to commit. The re-validation cadence is also runtime-observable: once `:user-invalid` has fired on a control, the user-agent re-validates at every keystroke while focused — so a user fixing an invalid value sees the error styling clear as soon as input becomes valid, not only on next blur.

**What to verify externally**:
- Initial page load: empty required fields do NOT show invalid styling (until interaction occurs)
- Blur from an invalid field: invalid styling appears
- Submit attempt: all invalid fields show styling (even ones the user never touched)
- Fixing an invalid value while focused: styling clears at the keystroke that makes the value valid (per-keystroke re-validation while focused)
- AT exposure: error messaging tied to `aria-invalid` / `aria-describedby` follows the visual state — do NOT rely on `:user-invalid` alone for AT announcement (`:user-*` are CSS-only signals; assistive tech does not observe them)

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/:user-valid (Baseline Widely available since November 2023; "only matches once the user has interacted with it"; per-keystroke re-validation once initially applied while focused)

**See also**: **VVT-014** for the broader form-validation-logic trigger (validation-schema changes, `aria-invalid` / `aria-describedby` wiring) — pair with `:user-*` for the visible + AT-announced combination.

**Suggested tooling**: Playwright-class browser automation with `page.fill()` + `page.blur()` + `page.locator(':user-invalid')` checks | manual keyboard walk

---

### VVT-055: HTML `inputmode` attribute additions or changes — Baseline Widely available since December 2021

**Pattern (diff-observable)**:
- Content match: added or changed `inputmode="<value>"` attribute on `<input>` elements or `contenteditable` regions (values: `none`, `text`, `decimal`, `numeric`, `tel`, `search`, `email`, `url`); removed from a previously-set input
- File/path match: any template / JSX / SFC / form-component file; checkout / payment form components; mobile-first input flows

**Why runtime verification is needed**: `inputmode` is a hint to the user-agent's virtual-keyboard renderer — desktop browsers ignore it entirely. Diff review shows the attribute set but cannot reveal: (a) **virtual-keyboard layout actually shown** — varies by OS (iOS / Android / desktop), by keyboard app (default vs Gboard vs SwiftKey vs third-party IME), and by user locale; verify the correct keyboard appears on the target audience's devices; (b) **`inputmode` is hint-only, NOT validation** — typing arbitrary characters via paste, autocomplete, or a hardware keyboard is NOT prevented by `inputmode`. Per MDN: "It's important to understand that the `inputmode` attribute doesn't cause any validity requirements to be enforced on input. To require that input conforms to a particular data type, choose an appropriate `<input>` element type." Server-side validation is required independent of `inputmode`; (c) **`inputmode` does NOT replace `type=`** — `inputmode="numeric"` on a `<input type="text">` still accepts any string; only `type="number"` triggers the input-validation logic. The combined-pattern recommendation `<input type="email" inputmode="email">` (type for validation + inputmode for keyboard hint) is community best practice rather than MDN-normative — MDN's actual canonical recommendation per the verbatim text above is to use the appropriate `<input>` element type; (d) **interaction with `pattern=` attribute** — `inputmode` does not change the pattern-validation regex; if both are set, they're independent; (e) **`inputmode="none"`** suppresses the on-screen keyboard entirely — verify the intended use case (custom keyboard component, virtual-keyboard-via-JS) actually renders an alternative input affordance.

**What to verify externally**:
- Real-device test (iOS Safari + Android Chrome): the displayed virtual keyboard matches the intended `inputmode` value — `numeric` shows the 0-9 keypad, `email` includes `@`, `tel` shows phone keypad, etc.
- Paste path: pasting non-matching characters (e.g., letters into `inputmode="numeric"`) is NOT prevented — verify the form's validation layer catches these
- Hardware-keyboard path: typing on a Bluetooth keyboard against a `inputmode="numeric"` field accepts any character — verify form validation
- The element has an appropriate `type=` attribute for validation, and pairs `inputmode=` as a virtual-keyboard hint when the chosen `type=` (e.g., `type="text"`) does not convey the intended keyboard layout. MDN's normative canonical recommendation is to choose the appropriate `<input>` element type; the combined `type=` + `inputmode=` pattern is community best practice rather than MDN-normative — `inputmode` alone is not sufficient for type-safe input.
- `inputmode="none"` deployments render a working alternative input affordance (custom virtual keyboard, autocomplete suggestions, etc.)

**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode (per-feature page; Baseline banner verbatim: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since December 2021"; 8 enumerated values; MDN verbatim on the hint-vs-validation distinction: "It's important to understand that the `inputmode` attribute doesn't cause any validity requirements to be enforced on input. To require that input conforms to a particular data type, choose an appropriate `<input>` element type.")

**See also**: **VVT-014** for the broader form-validation-logic trigger — `inputmode` does NOT validate; pair with VVT-014 whenever a new input adds `inputmode` to ensure the validation layer is independent. **VVT-018** for keyboard event handlers — `inputmode` interacts with virtual-keyboard layout but does NOT change which key events fire. **VVT-056** for `enterkeyhint` — the canonical sibling attribute that customizes the virtual-keyboard's Enter-key label (pair these whenever a form input adds one or both). **Cross-catalog peer**: **UX-035** (`ui-ux/checkout-payment.md`) — the policy rule that mandates `inputmode="numeric"` on numeric-only payment inputs (card-number, CVV, postal-code); VVT-055 is the runtime-verification trigger for the broader use-case surface (not just payment).

**Suggested tooling**: Real-device testing on iOS Safari + Android Chrome (the only environments where `inputmode` has runtime effect) | Playwright-class browser automation with mobile-emulation profile (limited fidelity — emulation reproduces viewport but NOT the OS virtual-keyboard renderer)

---

### VVT-056: HTML `enterkeyhint` attribute additions or changes — Baseline Widely available since November 2021

**Pattern (diff-observable)**:
- Content match: added or changed `enterkeyhint="<value>"` attribute on form controls (`<input>`, `<textarea>`) or `contenteditable` elements (values: `enter`, `done`, `go`, `next`, `previous`, `search`, `send`)
- File/path match: any template / JSX / SFC / form-component file; multi-step forms; search inputs; chat / messaging components

**Why runtime verification is needed**: `enterkeyhint` is a hint to the user-agent's virtual-keyboard renderer — controls only the Enter-key's LABEL on the on-screen keyboard, NOT the form's submit behavior. Diff review shows the attribute set but cannot reveal: (a) **label rendering varies by OS / IME / locale** — MDN's per-value table column reads "Example label (depends on user agent and user language)", confirming both the visual rendering and the localized text vary by environment; verify the intended label appears on target audience devices (iOS may show "search" as 🔍, Android may show as text); (b) **default Enter-key behavior is unchanged** — `enterkeyhint="next"` does NOT auto-advance to the next field unless JS handles `keydown` / `Enter` explicitly; verify the form's submit / advance / search behavior matches the label's promise; (c) **inference fallback** — when `enterkeyhint` is absent, per MDN the user agent "might use contextual information from the `inputmode`, `type`, or `pattern` attributes" to choose an Enter-key label — this inference path is UA-optional (not guaranteed), so the absence-of-`enterkeyhint` baseline must be tested independently; verify any inferred label is also acceptable; (d) **mismatched label + behavior is user-hostile** — labeling the Enter key as "send" while the form actually triggers "next field" produces a worse UX than no hint at all; the label must reflect the actual user-facing behavior; (e) **`<textarea>` Enter-key** — per spec applies to textarea but the default Enter-behavior in textareas is inserting a newline, so `enterkeyhint` on textarea is rarely useful unless paired with JS submit-on-Enter logic.

**What to verify externally**:
- Real-device test (iOS Safari + Android Chrome): the displayed Enter-key label matches the intended `enterkeyhint` value at target audience locales
- Behavior matches label: an Enter key labeled "send" actually submits / sends; one labeled "next" actually advances field; one labeled "search" actually triggers search
- Locale spot-check: at least 2 non-English locales render the label coherently (test with locale-changed device, not just spoofed `lang` attribute)
- `<textarea>` deployments: if the textarea pairs `enterkeyhint="send"` with submit-on-Enter, verify multi-line input is still possible via Shift+Enter or alternative affordance
- Inferred-default acceptable when `enterkeyhint` is absent (e.g., `<input type="search">` infers `search`; verify the inferred label is acceptable for that path)

**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint (per-feature page; Baseline banner verbatim: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since November 2021"; 7 enumerated values; per-value Example-label column header reads "Example label (depends on user agent and user language)" — confirming label varies by environment; UA MAY use contextual information from `inputmode` / `type` / `pattern` to choose an Enter-key label when `enterkeyhint` is absent — UA-optional per MDN, not guaranteed)

**See also**: **VVT-014** for the broader form-validation-logic trigger — pair when an input adds `enterkeyhint="send"` / `"go"` to verify the form's submit-on-Enter path is wired. **VVT-018** for keyboard event handlers — `enterkeyhint` is a label only; submit-on-Enter behavior requires explicit `onKeyDown` / `onSubmit` handling. **VVT-055** for `inputmode` — the canonical sibling attribute that customizes the keyboard's main layout (pair these whenever a form input adds one or both).

**Suggested tooling**: Real-device testing on iOS Safari + Android Chrome | locale-changed device (NOT just `lang` attribute spoofing) | Playwright-class browser automation with mobile-emulation profile (limited fidelity for keyboard-label rendering)

---

### VVT-059: HTML `autocomplete` token-list attribute additions or changes — Baseline Widely available since July 2015 (per IDL property page)

**Pattern (diff-observable)**:
- Content match: added or changed `autocomplete="<token-list>"` attribute on `<input>`, `<select>`, `<textarea>`, or `<form>` elements. Token values include `off`, `on`, `name`, `email`, `tel`, `username`, `current-password`, `new-password`, `one-time-code`, `cc-name`, `cc-number`, `cc-exp`, `cc-csc`, `street-address`, `address-line1`/`2`/`3`, `address-level1`/`2`/`3`/`4`, `postal-code`, `country`, `country-name`, mode prefixes `shipping` / `billing`, contact-type prefixes `home` / `work` / `mobile`, etc.
- File/path match: any template / JSX / SFC / form-component file; sign-up / checkout / payment / personal-info forms; password / OTP / 2FA flows

**Why runtime verification is needed**: `autocomplete` tokens are hints to the browser's autofill UI and to password managers — the actual UI rendered, the data stored, and the suggested-values source are runtime-only properties. Diff review shows the token set but cannot reveal: (a) **browser autofill UI variation** — per MDN: "The source of the suggested values is generally up to the browser; typically values come from past values entered by the user, but they may also come from pre-configured values." Verify the autofill dropdown / suggestion UI behaves as intended across Chrome / Safari / Firefox / Edge + mobile keyboards (each renders the suggestion affordance differently); (b) **password-manager interaction with `autocomplete="off"`** — per MDN: "In most modern browsers, setting `autocomplete` to `\"off\"` will not prevent a password manager from asking the user if they would like to save username and password information, or from automatically filling in those values in a site's login form." `autocomplete="off"` on login / payment forms is often ignored by password managers — verify the intended behavior actually occurs; (c) **token-prefix collisions on multi-address forms** — when a form has both shipping and billing address blocks with unprefixed `autocomplete="postal-code"` on both, browsers autofill both with the same stored value; verify the mode-prefix (`autocomplete="shipping postal-code"` vs `autocomplete="billing postal-code"`) disambiguates correctly; (d) **dynamic state persistence (Firefox-specific)** — per MDN: "The `autocomplete` attribute also controls whether Firefox will — unlike other browsers — persist the dynamic disabled state and (if applicable) dynamic checkedness of an `<input>` element, `<textarea>` element, or entire `<form>` across page loads." Verify Firefox reload behavior matches intent (set `autocomplete="off"` on form to prevent Firefox-only stale state restoration); (e) **`name`/`id` and form-ownership prerequisites** — UA-autofill may require the control to have `name` and/or `id` and be a descendant of a `<form>` element with a submit button; verify autofill triggers even when these are present (some browsers require additional structural hints).

**What to verify externally**:
- Browser-by-browser autofill UI test (Chrome / Safari / Firefox / Edge desktop + iOS Safari + Android Chrome): each renders suggestion / autofill differently; verify the user-facing affordance behaves as intended
- Password-manager test (1Password, Bitwarden, Chrome built-in, Safari Keychain): `autocomplete="off"` deployments on payment / login forms — verify whether the manager respects or ignores `off` per the actual product requirement
- Multi-address form: verify `shipping` / `billing` mode prefixes disambiguate the stored autofill values (browser stores and offers shipping postal-code distinct from billing postal-code)
- Firefox reload test: verify `autocomplete="off"` on form prevents stale `<input disabled>` / `<input checked>` state restoration on page reload (Firefox-specific behavior)
- Token enumeration: for personal-info / commerce flows, the **specific tokens** chosen (e.g., `cc-name` not `name`; `current-password` not just `password`) align with the policy defined by A11Y-061 (WCAG 1.3.5) and UX-006 / UX-031 / UX-034 (checkout patterns)

**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete (attribute reference page — full token list + UA-behavior prose; no per-attribute Baseline banner). https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/autocomplete (IDL property per-feature page — Baseline banner verbatim: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since July 2015."). MDN verbatim on autofill source: "The source of the suggested values is generally up to the browser; typically values come from past values entered by the user, but they may also come from pre-configured values." MDN verbatim on password-manager override: "In most modern browsers, setting `autocomplete` to `\"off\"` will not prevent a password manager from asking the user if they would like to save username and password information, or from automatically filling in those values in a site's login form." MDN verbatim on Firefox dynamic-state persistence: "The `autocomplete` attribute also controls whether Firefox will — unlike other browsers — persist the dynamic disabled state and (if applicable) dynamic checkedness of an `<input>` element, `<textarea>` element, or entire `<form>` across page loads."

**See also**: **VVT-014** for the broader form-validation-logic trigger — pair when a new form adds `autocomplete` tokens; autofill replaces user-entered values and triggers validation events. **Cross-catalog peers**: **A11Y-061** (`accessibility/forms.md`, "Use HTML `autocomplete` attribute on personal-information fields") — WCAG 1.3.5 authority defining the canonical token list for personal-info + cc-* commerce tokens; VVT-059 is the runtime-verification trigger for code changes A11Y-061 governs. **UX-006** (`ui-ux/forms.md`, "Use the `autocomplete` attribute on standard fields") — UX-conversion-rate authority on standard-field token coverage. **UX-031** (`ui-ux/checkout-payment.md`, single name field with `autocomplete="name"`) — checkout-name pattern; VVT-059 covers the runtime check. **UX-034** (`ui-ux/checkout-payment.md`, shipping/billing mode prefixes + `autocomplete="off"` anti-pattern on payment) — multi-address disambiguation pattern; VVT-059 is the runtime trigger for those checkout-form code changes.

**Suggested tooling**: Real-device testing across Chrome / Safari / Firefox / Edge + mobile; password-manager test with 1Password / Bitwarden / browser-native; Playwright-class browser automation with `page.fill()` + autofill-dropdown verification; Lighthouse a11y audit (autocomplete rule)

---

### VVT-063: CSS `:focus-visible` pseudo-class additions or changes — Baseline Widely available since March 2022

**Pattern (diff-observable)**:
- Content match: added or modified `:focus-visible { ... }` CSS rules; switched between `:focus { ... }` and `:focus-visible { ... }`; removed `outline: 0` / `outline: none` paired with `:focus-visible` replacement; `@supports selector(:focus-visible) { ... }` blocks
- File/path match: any stylesheet, global reset CSS, design-token files, button / link / form-control component styles

**Why runtime verification is needed**: `:focus-visible` matches when the element matches `:focus` AND the user-agent's heuristic determines the focus indicator should be visible — typically when the user navigated by keyboard rather than by mouse click. Diff review shows the selector swap but cannot reveal: (a) **UA heuristic behavior varies** — per MDN: "applies while an element matches the `:focus` pseudo-class and the UA (User Agent) determines via heuristics that the focus should be made evident on the element"; the exact heuristic (keyboard navigation vs mouse click vs touch tap vs focus-via-JS-call) differs across Chrome / Safari / Firefox / Edge — verify the focus ring appears in the intended scenarios on each target browser; (b) **mouse-click on `<button>` no-ring is the default in supporting browsers** — buttons clicked with a pointer do NOT match `:focus-visible` even though they DO match `:focus`; legacy `:focus { outline: ... }` rules render a ring on click, `:focus-visible` rules do not; verify the visual change matches intent; (c) **`@supports` fallback** — when migrating from `:focus` to `:focus-visible`, the canonical pattern wraps the fallback in `@supports not selector(:focus-visible) { :focus { outline: ... } }`; verify the fallback renders correctly in older browsers (pre-March-2022 release lines); (d) **focus ring still meets WCAG 2.4.7 + 1.4.11** — `:focus-visible` only addresses *when* the ring shows, not *what* the ring looks like; the ring must still meet visible-focus contrast (minimum 3:1 non-text contrast per WCAG 1.4.11) and not be removed entirely; (e) **JS-driven focus** — programmatic `element.focus({ focusVisible: true })` and `element.focus({ focusVisible: false })` are not universally supported; without the option, the UA heuristic applies — verify modal-open / accordion-expand / route-change focus flows produce the intended ring.

**What to verify externally**:
- Keyboard-navigation path (Tab through every interactive element): every focused element shows a visible focus ring meeting WCAG 1.4.11 non-text contrast (3:1 minimum)
- Mouse-click path on buttons: ring does NOT appear (default browser heuristic) — verify the design accommodates this; if a click-shows-ring is intentional, use `:focus` instead of `:focus-visible`
- Touch-tap path on buttons: ring does NOT appear (treated like mouse click by most UAs)
- Programmatic-focus path (modal opens → first focusable element focuses; route change → top-of-content focuses): ring appears correctly per the design's a11y intent
- `@supports not selector(:focus-visible)` fallback renders an acceptable focus indicator in pre-Baseline browsers
- Per-surface contrast: focus ring is visible on every surface color the focused element renders against (light card, dark card, primary button, etc.) — typically requires theme-aware ring color token or compound outline + box-shadow

**Source**: https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible (per-feature page; Baseline banner verbatim: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since March 2022"; MDN verbatim on UA-heuristic gating: "applies while an element matches the `:focus` pseudo-class and the UA (User Agent) determines via heuristics that the focus should be made evident on the element")

**See also**: **VVT-017** for focus management code — `:focus-visible` styling complements focus-target placement; pair when programmatic focus is added (modal open, route change). **VVT-018** for keyboard event handlers — focus-visible interaction with key handlers (Tab to traverse, Enter/Space to activate). **VVT-008** (`css-styling.md`) for color / contrast / theme-token changes — pair when the focus-ring color is defined via a design token. **Cross-catalog peers**: **A11Y-030** (`accessibility/keyboard-focus.md`, "Never remove focus outline without providing a replacement") — the WCAG 2.4.7 compliance authority; A11Y-030 mandates the policy, VVT-063 is the runtime-verification trigger when code touches `:focus` / `:focus-visible` rules. **A11Y-036** (same file, "Sticky/fixed elements must not fully obscure focused content") — WCAG 2.4.11 (Level AA, Focus Not Obscured Minimum) authority — sticky/fixed-overlay-on-focus check; pair when sticky/fixed elements interact with newly-focused elements. **A11Y-037** (same file, "Focused element must be fully visible (Enhanced)") — WCAG 2.4.12 (Level AAA, Focus Not Obscured Enhanced) variant — the AAA-tier extension of A11Y-036, relevant when focus rings render under fixed headers. **A11Y-038** (same file, "Focus indicator must meet thickness and contrast minimums") — WCAG 2.4.13 (Level AAA, Focus Appearance) visible-focus-indicator policy; VVT-063 flags when code changes warrant runtime check. **IS-005** (`interaction-states/buttons-ctas.md`, "Focus state must be visible on all interactive controls") — the interaction-state-inventory authority for focus visibility. **VD-COLOR-14** (`visual-design/color.md`, "Focus ring color contrast against multiple backgrounds") — the design-token policy for theme-aware focus-ring color; VVT-063 is the runtime trigger when those tokens are applied.

**Suggested tooling**: Manual keyboard walk (Tab through every interactive element) | Playwright-class browser automation with `page.keyboard.press('Tab')` sequence + visible-focus-ring screenshot diff | aXe DevTools (focus-visible-related rules) | Lighthouse a11y audit (visible focus indicator)

---

### VVT-064: HTML `<details>` / `<summary>` element additions or changes — Baseline Widely available since January 2020

**Pattern (diff-observable)**:
- Content match: added or modified `<details>` element with `<summary>` child; added or changed `open` attribute (boolean); added `name` attribute (Baseline support varies — for connected accordion-group behavior); custom CSS on `summary` (e.g., `summary { list-style: none; }` to remove default disclosure triangle); `::details-content` pseudo-element styling; `toggle` event listeners on `<details>`
- File/path match: any template / JSX / SFC / partial; FAQ / accordion / "show more" components; help-text / disclosure-pattern surfaces

**Why runtime verification is needed**: `<details>` provides a native disclosure widget with default UA styling that varies meaningfully across browsers. Diff review shows the markup but cannot reveal: (a) **default UA disclosure triangle rendering** — per MDN: "A disclosure widget is typically presented onscreen using a small triangle that rotates (or twists) to indicate open/closed state"; the triangle shape, color, and rotation animation differ across UAs; verify the default rendering matches design intent OR custom CSS replaces the affordance; (b) **`open` attribute boolean semantics** — per MDN, `open` is a Boolean attribute: presence (any value, including `"false"`) means open; absence means closed. The common mistake `open="false"` renders OPEN — verify the conditional-rendering logic uses presence/absence correctly; (c) **`name` attribute accordion-grouping** — multiple `<details>` with the same `name` value form a connected group where only one can be open at a time; per MDN verbatim: "`<details>` elements don't have to be adjacent to one another in the source to be part of the same group."; verify the grouping behavior matches design intent + verify cross-browser support (the `name` attribute on `<details>` is newer than the element itself); (d) **keyboard interaction** — click toggles per MDN's documented behavior; Space activation per HTML's activation-behavior algorithm; Enter activation is UA-dependent (verify empirically across target browsers); verify Tab focuses the `<summary>` correctly and the disclosure responds to the intended activation keys; (e) **AT announcement** — screen readers announce the open/closed state via the `<summary>` accessible-description relationship; verify the announcement matches design intent across VoiceOver / NVDA / JAWS; (f) **`toggle` event vs `change` event** — `<details>` fires a `toggle` event (not `change`); custom JS that listens for `change` will silently miss state changes; (g) **default `display: list-item` on `<summary>`** — per MDN: "Fully standards-compliant implementations automatically apply the CSS `display: list-item` to the `<summary>` element"; custom CSS that sets `summary { display: block; }` without also handling the marker (`::marker` or `list-style: none`) may render double markers or none at all.

**What to verify externally**:
- Default UA rendering of the disclosure triangle matches design intent across Chrome / Safari / Firefox / Edge; if not, custom CSS (e.g., `summary { list-style: none; }` + custom `::before` content) renders consistently
- Keyboard interaction: Tab focuses `<summary>`; Space activates per the `<summary>` element's documented behavior; Enter behavior depends on UA implementation per HTML's activation-behavior (verify empirically across target browsers); focus ring is visible per VVT-063 + A11Y-030
- AT announcement: screen readers (at least VoiceOver + NVDA) announce open/closed state coherently
- `open` attribute conditional logic uses presence/absence (NOT `open="true"` / `open="false"` strings) — `open="false"` renders open
- `name` attribute accordion-grouping (if used): only one in the group is open at a time; tested in target browsers (older browsers may not honor `name` grouping)
- `toggle` event handler (if attached) fires on every open/close transition
- Custom `::details-content` styling (if used) renders correctly — this is a newer pseudo-element with varying support; provide a fallback

**Source**: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details (per-feature page; Baseline banner verbatim: "Baseline Widely available — This feature is well established and works across many devices and browser versions. It's been available across browsers since January 2020"; with note "Some parts of this feature may have varying levels of support" — the `name` attribute and `::details-content` pseudo-element are newer than the element itself; MDN verbatim on UA rendering: "A disclosure widget is typically presented onscreen using a small triangle that rotates (or twists) to indicate open/closed state, with a label next to the triangle. The contents of the `<summary>` element are used as the label for the disclosure widget. The contents of the `<details>` provide the accessible description for the `<summary>`"; MDN verbatim on `<summary>` default styling: "Fully standards-compliant implementations automatically apply the CSS `display: list-item` to the `<summary>` element")

**See also**: **VVT-013** (`component-composition.md`) for conditional rendering of layout regions — `<details>` is a native conditional-render primitive; pair when migrating from JS-driven conditional render to `<details>`. **VVT-018** for keyboard event handlers — `<details>` ships with native UA toggle interaction (per HTML's activation-behavior; verify in target browsers); pair when JS adds additional keyboard interaction to the disclosure. **Cross-catalog peers**: **A11Y-050** (`accessibility/aria/apg-widgets.md`, "Disclosure pattern (button + content)") — the ARIA APG Disclosure-widget policy authority; A11Y-050 explicitly recommends `<details>` / `<summary>` for simple disclosure. VVT-064 is the runtime-verification trigger when code adopts the native disclosure. **A11Y-045** (same file, Accordion pattern) — the ARIA APG Accordion-widget policy; pair when `<details>` `name` attribute is used for accordion-grouping (native equivalent of the ARIA-driven `aria-expanded` + `aria-controls` accordion pattern).

**Suggested tooling**: Real-browser test across Chrome / Safari / Firefox / Edge (default disclosure rendering varies) | screen-reader manual test (VoiceOver / NVDA) for open/closed state announcement | Playwright-class browser automation with `page.click('summary')` + `page.locator('details[open]')` assertions
