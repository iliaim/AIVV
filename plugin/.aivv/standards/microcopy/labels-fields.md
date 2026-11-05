# Microcopy — Labels & Field Names

Part of [.aivv/standards/microcopy/](README.md) (MC-011..015).

### MC-011: Field labels are nouns describing what the field captures

**Severity**: MAJOR
**Rationale**: Labels like "Enter your email" or "Type your name" mix instruction with identification, increasing the read-time per field. Concise nouns ("Email", "Full name", "Phone") let users scan a form in a fraction of the time. NN/g eye-tracking shows label-as-noun forms have ~20% lower time-to-first-input.
**Source**: https://www.nngroup.com/articles/form-design-white-space/

**The rule**: Field labels are nouns or noun phrases. Verbs and instructions ("Enter…", "Type…", "Please provide…") move to placeholder hints or help text below the field, not into the label itself.

**Code patterns to flag**:
- `<label>Enter your email</label>`, `<label>Type your full name</label>`, `<label>Please provide a phone number</label>`
- Labels that include the format instruction inline ("Phone number (10 digits, no dashes)") — split format hint into placeholder or help text

**Correct pattern**: `<label>Email</label>` with `placeholder="you@example.com"` for format hint when needed.

**Quick-fix hint**: If the label starts with a verb, the verb is in the wrong place.

---

### MC-012: Mark required fields visibly; do not rely on optional-marking alone

**Severity**: MAJOR
**Rationale**: Forms where every required field is marked are clearer than forms where every optional field is marked. The `(required)` / `*` convention is the established web pattern (W3C Forms WG, GOV.UK). When a form has more required than optional fields, marking the optional ones is acceptable — but pick one convention per form, not both.
**Source**: https://www.nngroup.com/articles/required-fields/

**The rule**: Required fields are marked with a visible indicator (`*` after the label or `(required)` text) AND the `required` attribute on the input. Optional fields can be marked `(optional)` instead, but never mix conventions within one form.

**Code patterns to flag**:
- Inputs with `required` attribute but no visible required indicator on the label
- Forms that mark some required fields but not all
- Both `*` (required) and `(optional)` markers used in the same form

**Correct pattern**: `<label htmlFor="email">Email <span aria-hidden="true">*</span></label>` with `<input id="email" required aria-required="true" />`. Pair `*` with a legend explaining "* = required" in the form.

**Quick-fix hint**: Pick a convention. Apply it to every field.

---

### MC-013: Don't use placeholder text as the only label

**Severity**: MAJOR
**Rationale**: Cross-references UX-002 (lives in `ui-ux/forms.md` per dev.62 retrofit). Placeholder-as-label is a top-tier UX defect: placeholders disappear on focus, are low-contrast by default, often interpreted as pre-filled values, and are not announced consistently by screen readers.
**Source**: https://www.smashingmagazine.com/2018/06/placeholder-attribute/

**The rule**: Every input has a visible `<label>`. Placeholder text is reserved for format examples ("e.g., 555-0123") or affordance hints, never for the field's identifying name.

**Code patterns to flag**: Same as UX-002 — the rule is restated here so reviewers applying the `ux`/`polish` lens find it without cross-file lookup.

**Correct pattern**: `<label htmlFor="phone">Phone</label><input id="phone" placeholder="e.g., 555-0123" />`

**Quick-fix hint**: If a placeholder vanishes when the user starts typing, the user no longer knows what the field is for.

---

### MC-014: Help text describes format / constraints / examples — not field purpose

**Severity**: MINOR
**Rationale**: Help text below a field is for "how to fill this in" — format examples, constraints ("8-32 characters"), examples of valid values. Repeating the label name ("Enter your email here") wastes space and adds no information.
**Source**: https://design-system.service.gov.uk/components/text-input/#hint-text

**The rule**: Help text answers "how do I fill this in correctly?" — format, validation rules, examples. It does not repeat or rephrase the label.

**Code patterns to flag**:
- `<label>Email</label><span class="help">Enter your email address</span>` (redundant)
- Help text that restates the requirement instead of showing format ("Phone is required" — that belongs in error state, not help text)

**Correct pattern**: `<label>Phone</label><span class="help">Include country code, e.g., +1 555-0123</span>`

**Quick-fix hint**: If you remove the help text, does the user lose any *new* information? If no, delete it.

---

### MC-015: Don't capitalize random words in labels

**Severity**: POLISH
**Rationale**: "Email Address" is title case; "Email address" is sentence case. Mixed capitalization within the same form ("First name", "Last Name", "Email Address", "phone") signals careless authoring and reduces scanability.
**Source**: https://www.shopify.com/polaris/content/grammar-and-mechanics

**The rule**: Use sentence case for labels by default. Capitalize only the first word and proper nouns. Apply consistently across all labels in the form.

**Code patterns to flag**: Mixed cases within the same form's labels.

**Correct pattern**: "First name", "Last name", "Email", "Phone" (all sentence case).

**Quick-fix hint**: Sample one label. Match the rest to it.
