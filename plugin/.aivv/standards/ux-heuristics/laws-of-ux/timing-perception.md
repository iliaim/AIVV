# Laws of UX — Timing & Perception (HEU-LUX-*)

Part of [.aivv/standards/ux-heuristics/laws-of-ux/](README.md). 3 rules covering time-budget heuristics — response latency, target-acquisition time, time-to-complete.

### HEU-LUX-doherty: Doherty Threshold

**Severity**: MAJOR
**Rationale**: Productivity drops sharply when system response exceeds ~400 ms. Below 400 ms, users sustain attention; above, they disengage and re-orient. Empirically validated by IBM (Doherty & Thadhani, 1982).
**Source**: https://lawsofux.com/doherty-threshold/

**The rule**: interactive operations that mutate visible state should complete or surface progress within 400 ms; longer operations require optimistic UI, skeleton, or progress affordance.

**Code patterns to flag**:
- Filter inputs where each keystroke triggers a roundtrip without debounce
- Search-as-you-type with no client-side preview while server response is pending
- Page transitions that block on full data load (>400 ms) without skeleton

**Correct pattern**: debounced server calls (300–500 ms), skeleton/spinner above 400 ms, optimistic updates for predictable mutations.

**Quick-fix hint**: instrument the typical interaction. If p50 > 400 ms, redesign the perception of speed.

---

### HEU-LUX-fitts: Fitts's Law

**Severity**: MINOR
**Rationale**: Time-to-target is a function of distance and target size. Small or distant targets cost the user time and produce mis-clicks (especially under motor stress, mobile context, accessibility needs). Empirically validated; underpins WCAG SC 2.5.5 and 2.5.8.
**Source**: https://lawsofux.com/fittss-law/

**The rule**: interactive targets are at least 24×24 CSS px (WCAG L1 floor); 44×44 on touch surfaces (Apple HIG); placed near where the user's attention/cursor already is.

**Code patterns to flag**:
- `<button>` / `<a>` with explicit `width`/`height` declarations <24px in CSS (or Tailwind `w-5 h-5` / equivalent ≤24-px utility classes)
- Click targets in dense tables with `padding: 0` and small font (effective hit area ≤ font height)
- Primary CTAs placed at the top of long pages where the user's reading position is mid-page

**Correct pattern**: minimum 24×24 (web) or 44×44 (touch); CTAs near the active reading region; large touch targets on mobile.

**Quick-fix hint**: a user with shaky hands, a small phone, or a trackpad — can they hit this target reliably?

---

### HEU-LUX-parkinson: Parkinson's Law

**Severity**: POLISH
**Rationale**: Work expands to fill the time available. Constraints (deadlines, character limits, time-boxes) drive focus and completion.
**Source**: https://lawsofux.com/parkinsons-law/

**The rule**: where appropriate, use mild constraints (character limits with counter, suggested time-to-complete, default-finish times) to support task completion.

**Code patterns to flag**:
- Free-form text fields without character counters where the destination has a limit
- Deadline-bearing tasks shown without due-date prominence
- "Quick poll" or "5-minute survey" promises followed by 20-question forms

**Correct pattern**: constraints with visible state; honest scope expectations.

**Quick-fix hint**: helpful constraints help; arbitrary constraints just frustrate.
