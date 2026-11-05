# Microcopy — Voice & Tone

Part of [.aivv/standards/microcopy/](README.md) (MC-001..005).

### MC-001: Use plain, conversational language at a consistent reading level

**Severity**: POLISH
**Rationale**: Jargon and complex sentence structures exclude users with lower literacy, non-native speakers, and users in cognitive load. Plain language is the established baseline for accessibility (WCAG 2.1 AAA Reading Level 3.1.5; UK Government writing standard targets a reading age of 9).
**Source**: https://design-system.service.gov.uk/styles/writing/

**The rule**: UI copy targets a Grade 8 / age-14 reading level by default. Avoid Latin abbreviations (e.g., "i.e.", "etc."), uncommon technical jargon, and multi-clause sentences in interactive elements.

**Code patterns to flag**:
- Button labels with multiple clauses ("Save and continue and notify the team")
- Error messages that paraphrase exception classes verbatim ("ValidationError: invalid input format")
- Help text that uses unexplained acronyms ("Configure your CDN's TLS via the ASN policy")

**Correct pattern**: "Save changes" / "Email is required" / "Choose how secure connections are handled."

**Quick-fix hint**: Read the copy aloud. If you stumble or pause, simplify.

---

### MC-002: Address the user as "you", refer to the product/team as "we"

**Severity**: MINOR
**Rationale**: Second-person pronouns clarify ownership of the action; first-person plural reads as the product company speaking. Mixed first/second/third person within the same surface confuses agency.
**Source**: https://styleguide.mailchimp.com/voice-and-tone/

**The rule**: User-directed instructions use "you" / "your". Brand-voice statements use "we" / "our". Do not refer to the user as "the customer", "the account holder", "they", or by their stored name in instruction prose.

**Code patterns to flag**:
- "The user must enter their email" (in user-facing UI; this is third-person and dehumanizing in an interactive context)
- "Customers should review their cart" (in the customer's own cart UI)
- Tone-mixing within one screen ("You can edit. The user must confirm.")

**Correct pattern**: "Enter your email" / "We've saved your changes" / "Review your cart before checking out."

**Quick-fix hint**: If the surface is talking TO the user, say "you". If the surface is the product talking ABOUT itself, say "we". Anything else is third-person and probably wrong.

---

### MC-003: Prefer active voice over passive voice

**Severity**: MINOR
**Rationale**: Active voice clarifies the actor — who did what — which is critical when users are recovering from errors or confirming actions. Passive voice obscures agency, which feels evasive in error states ("the request was denied" — by whom?).
**Source**: https://www.atlassian.design/content/voice-and-tone

**The rule**: Default to active voice. Passive is acceptable only when the actor is genuinely unknown or irrelevant.

**Code patterns to flag**:
- "Your changes were saved" (passive — "We saved your changes" / "Changes saved" is clearer)
- "An error was encountered" (passive — "Something went wrong" / "We couldn't reach the server" is clearer)
- "The form has been submitted" (passive — "Form submitted" / "We received your form" is clearer)

**Correct pattern**: "We saved your changes" / "Something went wrong — try again" / "Form submitted."

**Quick-fix hint**: Find the verb. Find the actor. Put the actor in front of the verb.

---

### MC-004: Avoid blaming the user for system errors

**Severity**: MAJOR
**Rationale**: Phrasing system failures as user mistakes ("you entered an invalid value", "your input is wrong") shifts blame to the person and damages trust. The Nielsen Norman Group's error-message guidelines specifically call out blame-language as a top-five error-message defect.
**Source**: https://www.nngroup.com/articles/error-message-guidelines/

**The rule**: When the system rejects input, describe what's wrong with the input, not what's wrong with the user. When the system fails internally, take responsibility ("we couldn't…") rather than implying user fault.

**Code patterns to flag**:
- "You entered an invalid email"
- "You did something wrong"
- "Your file is corrupt" (when the system is the one that detects the corruption — re-read flag is fine; "your file" framing is not)

**Correct pattern**: "Email format isn't recognized — check for typos" / "Something went wrong on our end — try again in a moment" / "We couldn't open this file. It may be corrupt."

**Quick-fix hint**: Replace "you" + a negative verb with a description of the input or the system state.

---

### MC-005: Match the product's established voice consistently across surfaces

**Severity**: POLISH
**Rationale**: A formal product that suddenly uses casual humor in an error message (or a casual product that goes formal in a confirmation) breaks the established trust signal. Voice consistency is a brand-identity pillar.
**Source**: https://www.shopify.com/polaris/content/voice-and-tone

**The rule**: Within a single product surface, voice is consistent — formality, contraction usage, idiom level. If the project's maintainer guidance / contributor docs / design system specifies a voice, defer to that. If unspecified, the existing copy in the codebase is the implicit standard.

**Code patterns to flag**:
- Mixed contractions across the same flow ("we will save your changes" next to "we'll send you an email")
- Tonal whiplash between modules (formal account-settings copy vs. emoji-heavy onboarding copy)
- Generic stock copy ("Lorem ipsum") shipping past the placeholder phase

**Correct pattern**: Sample the surrounding copy. Match it. If unsure, defer to the project's content style guide.

**Quick-fix hint**: Read the previous and next page's copy. Does this fit?
