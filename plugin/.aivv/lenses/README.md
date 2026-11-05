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

## Trigger patterns
...patterns that should be investigated for concrete evidence, applicability, and impact...

## Standards to consult
- path1
- path2

## Graceful degradation
...behavior when supporting infra is absent...
```

## How lenses compose

`/aivv` with no `--lens=` defaults to `code`. The orchestrator:
1. Resolves the lens name → `.aivv/lenses/<name>.md` (plugin-root-relative).
2. Reads the file; if missing, errors with the list of shipped lenses.
3. Parses frontmatter + body. The body content under `## Focus`, `## Trigger patterns`, and `## Standards to consult` is injected into the reviewer prompt under a **Lens-specific focus** section after the universal Session-Diff Coherence Check.
4. `calibration_lens` from frontmatter determines the per-run calibration filename.

## Current lenses (v0.1)

| Lens | File | Driver | Status |
|---|---|---|---|
| `code` | [code.md](code.md) | none | Default static code review; includes CQ-* and AS-* standards routing |
| `sec` | [sec.md](sec.md) | none | Static security review — OWASP-style code-level concerns |
| `visual` | [visual.md](visual.md) | optional (B3 externalized Playwright probe emit/ingest; host browser adapters gated) | Static UI/a11y review (WCAG 2.1/2.2 AA baseline); optional runtime evidence (RTV-* rules) via `--runtime` |
| `ux` | [ux.md](ux.md) | none | UX patterns — form/navigation/error/loading-states (UX-001..046, dev.43+) |
| `polish` | [polish.md](polish.md) | none | Visual-design aesthetic — typography/spacing/color/iconography/motion/layout (VD-* + heuristic L4 source-class, dev.43+) |
| `compliance` | [compliance.md](compliance.md) | none | Regulatory + accessibility-conformance + legal-risk — WCAG 2.1 AAA realistic subset + full ARIA APG + FTC/GDPR/CCPA/COPPA/ADA/Section 508/EU EAA (COMP-* rules, dev.105+) |
| `i18n` | [i18n.md](i18n.md) | none | Internationalization — translation-function discipline + CLDR pluralization + locale-aware Intl.* + RTL safety + bidi (I18N-* rules, dev.105+) |
| `user-journey` | [user-journey.md](user-journey.md) | optional (B3 runtime evidence artifacts) | Zero-knowledge cognitive walkthrough — AC-framing, discoverability, activation-feedback, time-to-first-success (UJ-* rules, dev.121+) |

## Full-* shortcut flags

For multi-lens audits, `/aivv` accepts K×M-composition shortcut flags (dev.59+). Each sets a fixed lens-list + wrapper-default M; `--lens-replicate=<M>` overrides M per the 4-tier M-precedence chain. See [`skills/aivv/references/argument-parsing.md`](../../skills/aivv/references/argument-parsing.md) §§2n-2r for full per-flag rules + conflict-rejection.

| Flag | K | M (default) | N (default) | Lenses | First-introduced |
|---|---|---|---|---|---|
| `--full-visual` | 2 | 3 | 6 | `visual + polish` | dev.59 |
| `--full-ui-ux` | 6 | 2 | 12 | `visual + ux + polish + compliance + i18n + user-journey` | dev.105 (K=5→6 at dev.121) |
| `--full-a11y` | 2 | 2 | 4 | `visual + compliance` | dev.105 |
| `--full` | 7 | 2 | 14 | `code + sec + visual + ux + polish + compliance + i18n` | dev.105 |
| `--full-with-journey` | 8 | 2 | 16 | `code + sec + visual + ux + polish + compliance + i18n + user-journey` | dev.121 |

**Note on `--full-with-journey`:** N=16 at the M=2 default **exceeds the dev.70 T8 empirically tested ceiling (N=14)** — dispatch emits a user-visible warning. Use `--full-with-journey --lens-replicate=1` (N=8) to keep all 8 lenses within a smaller dispatch. `--full` stays K=7/N=14 (no `user-journey`); add the journey lens explicitly via `--full-with-journey`.

## Not-yet-implemented (file absent = error at dispatch)

- `perf` — runtime performance lens (needs benchmark harness; deferred)

(The `runtime-visual` rule catalog is not a standalone lens. Under B3 it is an optional runtime-evidence layer on the `visual` lens, opt-in via `--runtime` or explicit emit/ingest flags, with generated Playwright probe scaffolds and user-run JSON ingest as the default path. See the `visual` row above.)

(The pre-dev.105 `a11y` deferral note has been retired: `--full-a11y` shipped dev.105 as `visual + compliance` composition, resolving the dev.22-era "pure-a11y sibling" split-decision via wrapper-flag composition rather than standalone-lens authoring. Users wanting accessibility-conformance audit invoke `--full-a11y`; users wanting a11y + UX patterns together invoke `--full-ui-ux`.)

## Adding a new lens

1. Create `.aivv/lenses/<name>.md` following the structure above.
2. Content must pass the methodology.md **Scope Discipline** four-question gate before the lens graduates from draft to shipped.
3. Add a row to the table above.
4. If the lens needs a runtime driver, document the driver in the Graceful Degradation section + add a platform-adapter entry in `.aivv/platform-adapters/<platform>.md`.
5. No changes to `skills/aivv/SKILL.md` required — the orchestrator loads lenses by filename convention.
