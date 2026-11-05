# Microcopy — Capitalization & Punctuation

Part of [.aivv/standards/microcopy/](README.md) (MC-036..038).

### MC-036: One trailing punctuation rule per surface; default to no period on labels and buttons

**Severity**: POLISH
**Rationale**: Buttons and labels are not sentences — adding a period makes them feel like instructions. The Apple HIG, Material Design, and most major design systems specify no trailing period on UI controls.
**Source**: https://developer.apple.com/design/human-interface-guidelines/writing#General-text-formatting

**The rule**: Buttons, field labels, menu items, and headings have no trailing period. Body prose, error messages, help text (full sentences) do end with periods.

**Code patterns to flag**:
- `<Button>Save changes.</Button>` (period on button)
- Mixed within the same form (some labels period-suffixed, others not)

**Correct pattern**: "Save changes" (no period) / "Email is required." (with period — full sentence).

**Quick-fix hint**: Is it a fragment or a sentence? Fragments don't need periods.

---

### MC-037: Use straight quotes in code, curly quotes in body prose (when project supports it)

**Severity**: POLISH
**Rationale**: ASCII straight quotes (`'` `"`) in body prose look amateur. Curly quotes (`'` `'` `"` `"`) are the typographic default for English prose. Most modern frameworks support Unicode strings; legacy ASCII-only environments are the exception.
**Source**: https://practicaltypography.com/straight-and-curly-quotes.html

**The rule**: Body prose (descriptions, error messages, help text, dialog content) uses curly quotes. Code identifiers, technical exemplars, and user input echoes (where the user typed straight quotes) use straight quotes. Apply consistently per surface.

**Code patterns to flag**:
- Mixed straight + curly quotes in the same prose surface
- Apostrophes consistently rendered as `'` in user-facing copy ("don't", "you're")

**Correct pattern**: Body: "Don't share your password." Code identifier in prose: `"const x = 1"` (straight, monospace).

**Quick-fix hint**: If the prose is for human reading, use curly quotes. If it's reproducing code, use straight.

---

### MC-038: Use the en dash for ranges, em dash for asides — set consistently

**Severity**: POLISH
**Rationale**: Hyphen (`-`), en dash (`–`), and em dash (`—`) have distinct typographic uses. Consistent use signals careful authoring; inconsistent use signals careless authoring. The user-facing impact is small but cumulative.
**Source**: https://practicaltypography.com/hyphens-and-dashes.html

**The rule**: Hyphen for compound words ("on-blur", "pre-filled"). En dash for ranges and connections ("pages 4–10", "Monday–Friday"). Em dash for asides and breaks ("Save changes — they will be applied immediately"). Apply consistently.

**Code patterns to flag**:
- Hyphen used in place of em dash in body prose ("Save changes - they will be applied")
- Inconsistent dash treatment across the same surface

**Correct pattern**: "Save changes — they will be applied." / "Active hours: 9–17." / "On-blur validation."

**Quick-fix hint**: When unsure, the em dash (`—`) is for asides. The en dash (`–`) is for ranges. The hyphen (`-`) is for compound words.
