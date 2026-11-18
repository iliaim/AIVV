# AIVV Lenses

Each file in this directory defines a **review lens** — domain-scoped focus applied on top of the universal review methodology. Selected via `/aivv --lens=<name>` (the filename stem without `.md`).

## File structure

```markdown
---
name: <lens>
description: <one-line scope>
calibration_lens: <lens>   # stored as .aivv/calibration/<this>.jsonl
applies_to: <artifact types — code / UI / schemas / docs>
runtime_driver: none | optional | required
---

## Focus
...domain-specific review focus...

## Severity anchors
...IMPACT and LIKELIHOOD anchors for this lens's findings...

## Trigger patterns
...patterns that should be investigated for concrete evidence, applicability, and impact...

## Standards to consult
- path1
- path2

## Graceful degradation
...behavior when supporting infra is absent...
```

Every lens carries Focus, Trigger patterns, Standards to consult, and Graceful degradation. Every lens except `polish` also carries Severity anchors; `polish` emits improvement findings rather than defects, so it carries `### Improvement-track anchors` (value/effort) inside `## Focus` instead. Lenses may add `###` subsections or extra sections (for example `polish` has `## Output convention`).

## How lenses compose

`/aivv` with no `--lens=` defaults to `general`. The shared general review checklist is required for every lens; the selected lens file adds its focus. When the user explicitly selects one or more lenses, use exactly that selection; do not add `general` implicitly. The orchestrator:
1. Resolves the lens name → `.aivv/lenses/<name>.md` (plugin-root-relative).
2. Reads the file; if missing, errors with the list of shipped lenses.
3. Parses frontmatter + body. The body content under `## Focus`, `## Trigger patterns`, and `## Standards to consult` is injected into the reviewer prompt under a **Lens-specific focus** section after the shared checklist and Scope and Artifact Coherence Check.
4. `calibration_lens` from frontmatter determines the per-run calibration filename.

## Current lenses

| Lens | File | Driver | Status |
|---|---|---|---|
| `general` | [general.md](general.md) | none | Default artifact review; follows the shared general review checklist |
| `code` | [code.md](code.md) | none | Specialist static code review; includes CQ-* and AS-* standards routing |
| `sec` | [sec.md](sec.md) | none | Static security review — OWASP-style code-level concerns |
| `visual` | [visual.md](visual.md) | optional (B3 externalized Playwright probe emit/ingest; host browser adapters gated) | Static UI/a11y review (WCAG 2.1/2.2 AA baseline); optional runtime evidence (RTV-* rules) via `--runtime` |
| `ux` | [ux.md](ux.md) | none | UX patterns — form/navigation/error/loading-states |
| `polish` | [polish.md](polish.md) | none | Visual-design aesthetic — typography/spacing/color/iconography/motion/layout (VD-* + heuristic L4 source-class) |
| `compliance` | [compliance.md](compliance.md) | none | Regulatory + accessibility-conformance + legal-risk — WCAG 2.1 AAA realistic subset + full ARIA APG + FTC/GDPR/CCPA/COPPA/ADA/Section 508/EU EAA (COMP-* rules) |
| `i18n` | [i18n.md](i18n.md) | none | Internationalization — translation-function discipline + CLDR pluralization + locale-aware Intl.* + RTL safety + bidi (I18N-* rules) |
| `user-journey` | [user-journey.md](user-journey.md) | optional (B3 runtime evidence artifacts) | Zero-knowledge cognitive walkthrough — AC-framing, discoverability, activation-feedback, time-to-first-success (UJ-* rules) |

## Full-* shortcut flags

The multi-lens shortcut flags (`--full-visual`, `--full-ui-ux`, `--full-a11y`, `--full`, `--full-with-journey`), their lens lists, and default M/N are defined in [`skills/aivv/references/argument-parsing.md`](../../skills/aivv/references/argument-parsing.md) (Review Shape). `--full-with-journey` defaults to N=16, which exceeds the tested ceiling of N=14, so dispatch warns.

## Not-yet-implemented (file absent = error at dispatch)

- `perf` — runtime performance lens (needs benchmark harness; deferred)

(The `runtime-visual` rule catalog is not a standalone lens. Under B3 it is an optional runtime-evidence layer on the `visual` lens, opt-in via `--runtime` or explicit emit/ingest flags, with generated Playwright probe scaffolds and user-run JSON ingest as the default path. See the `visual` row above.)

## Adding a new lens

1. Create `.aivv/lenses/<name>.md` following the structure above.
2. Content must pass the methodology.md **Scope Discipline** four-question gate before the lens graduates from draft to shipped.
3. Add a row to the table above.
4. If the lens needs a runtime driver, document the driver in the Graceful Degradation section + add a platform-adapter entry in `.aivv/platform-adapters/<platform>.md`.
5. No changes to `skills/aivv/SKILL.md` required — the orchestrator loads lenses by filename convention.
