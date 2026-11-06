# Review Shape Resolution

Canonical runtime procedure for turning `/aivv` arguments, preferences, scope
resolution, and smart-lens detection into the final reviewer count and
`reviewer_lens_assignments`. Referenced from [`SKILL.md`](../SKILL.md) Steps
1.4, 3.4, 3.5, and 3.6.

Read this file before resolving or recomputing review shape: reviewer count,
`lenses_list`, `--lens-replicate`, full-audit wrappers (`--full-ui-ux`,
`--full-visual`, `--full-a11y`, `--full`, `--full-with-journey`), scope
resolution, smart-lens detection, or high-risk floor reporting.

## 1. Pipeline

1. Parse the requested static shape from [`argument-parsing.md`](argument-parsing.md):
   `--reviewers=N`, `--lens=<list>`, `--lens-replicate=M`, `--full-*`
   wrappers, `--auto-lens` / `--no-auto-lens`, and `--auto-scope` /
   `--ask-scope`.
   <!-- Codex-SPECIFIC --> Resolve native model and reasoning labels under the
   [Codex adapter](../../../.aivv/platform-adapters/codex.md#native-model-and-reasoning-labels)
   before describing the proposed method.
2. Load config/default overlays from [`preferences.md`](preferences.md). An
   omitted `default_lenses` resolves to the golden default `general`; do not
   inject `general` into an explicit, configured, or fixed wrapper lens list.
3. Apply the preliminary Step 1.4 composition from
   [`lens-composition.md`](lens-composition.md). This validates explicit
   K/M/N combinations and yields a provisional `reviewer_lens_assignments`.
   If any
   of `default_reviewers`, `default_lenses`, or `default_lens_replicate`
   supplies an unset shape value, rerun the Step 1.4 composition before Step
   1.9.
4. Extract session context and gather available paths / plan / file / idea
   material. Resolve the requested material boundary. Ask before detection only
   if the subject/boundary is genuinely ambiguous or authority to inspect it is
   missing; clear explicit read-only requests proceed without re-approval.
5. After `final_scope` is resolved, compute/recompute the Step 2.5
   `lens_ceiling` and run Step 3.5 detection only against that scope. Resolve
   Step 3.6 mode and candidate additions using Detection Mode below.
6. Apply the adaptive-confidence floor: when reviewer count is not pinned by
   explicit `--reviewers`, wrapper flags, or config, raise a single-reviewer
   default to 2 reviewers if scope resolution found an ambiguous/non-trivial
   session, high-risk lens floors were detected, or review scope spans multiple
   unrelated files/topics. This is a pre-dispatch confidence floor, not a schema
   default change; low-risk explicit artifact reviews remain at one reviewer.
7. Rebuild `reviewer_lens_assignments` exactly once after detection and the
   confidence floor, unless the dispatch shape is fixed by a tier-1 explicit
   selection. Detection-added lenses run at M=1 and are appended after the
   explicit/configured block. Resolve the final reviewer count and provider set
   before requesting any reviewer-cost or provider-egress consent; do not treat
   consent for an earlier shape as authorization for a shape changed by the
   confidence floor or lens resolution. If consent is declined or unavailable,
   retain the last authorized valid shape and report any unapplied confidence
   floor or lens; hold if no authorized valid shape remains. Announce the
   complete final scope and method
   before dispatch. If ask mode was explicitly selected by `--ask-scope` or a
   manual-provenance config value, request confirmation once with that complete
   resolved proposal. Otherwise ask only if the method
   would materially expand scope or needs authority the request did not grant;
   never add a redundant lens-only approval unless the user explicitly requested lens selection.

## 2. Composition Rules

`lens-composition.md` owns the K/M/N matrix:

- K=1, M=1: homogeneous dispatch; all reviewers use the single lens.
- K=N, M=1: 1:1 multi-lens spike; reviewer `i` gets `lenses_list[i]`.
- M>=2: KxM block replication; requires `N == K*M`; reviewer `i` gets
  `lenses_list[i // M]`.
- Mismatches reject with the exact errors in `lens-composition.md`.

Full-audit wrappers are KxM shortcuts. `--lens-replicate=<M>` can override the
wrapper default M through the precedence chain in `argument-parsing.md`.

## 3. Scope Before Lenses

`scope-confirmation.md` owns scope resolution, announce/ask conditions, hold
conditions, and the compatible `scope_confirmation` audit block. This file owns
only the ordering contract:

- Step 3.4 resolves scope after available context gathering and before lens detection.
- Resolve `final_scope` before detection; announce the final method after lens
  and depth resolution but before dispatch.
- Its output is `final_scope`; a user narrowing also sets `dropped_scope`.
- Ordinary floor and ceiling path checks run against `paths intersect final_scope.paths`.
- If a scope adjustment changes the session subset, recompute `lens_ceiling`
  before final lens admission.
- High-risk floor still applies to remaining in-scope paths.
- Detection and depth changes within the requested boundary are announced, not
  separately approved unless explicit ask mode applies. Material scope expansion
  or missing authority is held.
- When `was_trivial == false` and reviewer count is otherwise unpinned, the
  adaptive-confidence floor may raise the count from 1 to 2 before final
  reviewer assignment.

## 4. Detection Mode

Step 3.5 combines four inputs:

- existing `lenses_list` from explicit/default shape;
- deterministic floor matches from lens frontmatter `detect_paths`;
- Step 2.5 ceiling matches admitted by Step 3.6 mode;
- `sec` / `compliance` high-risk floor matches from `high_risk_paths`.

When Git is available, path matching uses `git diff --name-only HEAD --
":(glob)<glob>"`, cached diff, and untracked `git status --porcelain` paths. If
Git is unavailable or there is no diff, continue using only available session
and artifact context; do not invent path matches, file counts, or commit counts.
Split comma-separated frontmatter
glob lists on `,`, trim tokens, and reject brace expansion assumptions. Generated
and vendored paths are excluded for ordinary floor/ceiling checks, but not for
`high_risk_paths`.

Modes:

- `smart`: apply floor, relevant ceiling, and high-risk matches.
- `ask`: auto-apply floor. A default/wizard value reports optional ceiling candidates
  without adding them or blocking the requested review. A manual-provenance `ask`
  preference requests a choice about those additions when interactive. If
  declined, canceled, or unavailable, report them as not applied and continue
  with the authorized shape. Non-interactive runs report candidates without
  adding them. Do not infer a request for questions from a persisted default.
- `off`: detect/report only; no auto-apply beyond explicit/default lenses.

## 5. Fixed Shape Suppression

Tier-1 explicit shape suppresses smart-lens recompute: explicit `--lens=`,
any `--full-*` flag, or multi-model fixed dispatch shape. In that case, do not
add floor or ceiling lenses and do not prompt for lens consent.

The high-risk floor is still computed. If `sec` or `compliance` matches
`high_risk_paths` but is not in the fixed dispatch shape, emit the warning from
Step 3.5: a not-applied line naming the high-risk lens and path basis. This
keeps an explicit fixed shape from silently dropping high-risk coverage.

## 6. Final Output Contract

Before Step 4 prompt construction, the orchestrator must have:

- `lenses_list`: final ordered dispatch lenses, using the confirmed explicit or
  configured choices, or the golden default `general` when no lens was set;
- `reviewer_lens_assignments`: final list read by Step 4 / Step 5;
- `lens_origin`: explicit, config/default, floor, ceiling, or high-risk;
- `scope_confirmation`: audit block fields from `scope-confirmation.md`;
- `final_scope`: positive include scope for prompt and detection;
- `dropped_scope`: only when the user narrowed scope;
- `lens_detection`: mode, applied lenses, detected-but-not-applied lenses, and
  high-risk not-applied warnings.

These fields are the only review-shape handoff into reviewer prompt
construction. Step 4 must not infer review shape again from raw flags.
