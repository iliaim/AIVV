# Review Shape Resolution

Canonical runtime procedure for turning `/aivv` arguments, preferences, scope
confirmation, and smart-lens detection into the final reviewer count and
`reviewer_lens_assignments`. Referenced from [`SKILL.md`](../SKILL.md) Steps
1.4, 3.4, 3.5, and 3.6.

Read this file before resolving or recomputing review shape: reviewer count,
`lenses_list`, `--lens-replicate`, full-audit wrappers (`--full-ui-ux`,
`--full-visual`, `--full-a11y`, `--full`, `--full-with-journey`), scope
confirmation, smart-lens detection, or high-risk floor reporting.

## 1. Pipeline

1. Parse the requested static shape from [`argument-parsing.md`](argument-parsing.md):
   `--reviewers=N`, `--lens=<list>`, `--lens-replicate=M`, `--full-*`
   wrappers, `--auto-lens` / `--no-auto-lens`, and `--auto-scope` /
   `--ask-scope`.
2. Apply the preliminary Step 1.4 composition from
   [`lens-composition.md`](lens-composition.md). This validates explicit
   K/M/N combinations and yields a provisional `reviewer_lens_assignments`.
3. Load config/default overlays from [`preferences.md`](preferences.md). If any
   of `default_reviewers`, `default_lenses`, or `default_lens_replicate`
   supplies an unset shape value, rerun the Step 1.4 composition before Step
   1.9.
4. Extract session context and compute the Step 2.5 `lens_ceiling` buckets.
   This judgment is advisory only; `sec` and `compliance` high-risk floors can
   override a `no` bucket.
5. Gather paths / plan / file / idea context, then run the Step 3.4 scope gate
   from [`scope-confirmation.md`](scope-confirmation.md). The gate must produce
   `final_scope` before any floor or ceiling is admitted to dispatch.
6. Recompute smart-lens detection against `final_scope` in Step 3.5, then apply
   Step 3.6 consent / mode handling.
7. Apply the adaptive-confidence floor: when reviewer count is not pinned by
   explicit `--reviewers`, wrapper flags, or config, raise a single-reviewer
   default to 2 reviewers if the scope gate found an ambiguous/non-trivial
   session, high-risk lens floors were detected, or review scope spans multiple
   unrelated files/topics. This is a pre-dispatch confidence floor, not a schema
   default change; low-risk explicit artifact reviews remain at one reviewer.
8. Rebuild `reviewer_lens_assignments` exactly once after detection, unless the
   dispatch shape is fixed by a tier-1 explicit selection. Detection-added
   lenses run at M=1 and are appended after the explicit/configured block.

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

`scope-confirmation.md` owns the classifier, prompt/announcement copy,
non-interactive suppression, per-session suppression, and `scope_confirmation`
audit block. This file owns only the ordering contract:

- Step 3.4 runs after context gathering and before Step 3.5/3.6.
- Its output is `final_scope`; a user narrowing also sets `dropped_scope`.
- Ordinary floor and ceiling path checks run against `paths intersect final_scope.paths`.
- If a scope adjustment changes the session subset, recompute `lens_ceiling`
  before final lens admission.
- High-risk floor still applies to remaining in-scope paths.
- When `was_trivial == false` and reviewer count is otherwise unpinned, the
  adaptive-confidence floor may raise the count from 1 to 2 before final
  reviewer assignment.

## 4. Detection And Consent

Step 3.5 combines four inputs:

- existing `lenses_list` from explicit/default shape;
- deterministic floor matches from lens frontmatter `detect_paths`;
- Step 2.5 ceiling matches admitted by Step 3.6 mode/consent;
- `sec` / `compliance` high-risk floor matches from `high_risk_paths`.

Path matching uses `git diff --name-only HEAD -- ":(glob)<glob>"`, cached diff,
and untracked `git status --porcelain` paths. Split comma-separated frontmatter
glob lists on `,`, trim tokens, and reject brace expansion assumptions. Generated
and vendored paths are excluded for ordinary floor/ceiling checks, but not for
`high_risk_paths`.

Modes:

- `smart`: apply floor, relevant ceiling, and high-risk matches.
- `ask`: auto-apply floor; ask for non-obvious ceiling additions when
  interactive; report-but-do-not-apply ceiling additions when non-interactive.
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

- `lenses_list`: final ordered dispatch lenses, always including `code`;
- `reviewer_lens_assignments`: final list read by Step 4 / Step 5;
- `lens_origin`: explicit, config/default, floor, ceiling, or high-risk;
- `scope_confirmation`: audit block fields from `scope-confirmation.md`;
- `final_scope`: positive include scope for prompt and detection;
- `dropped_scope`: only when the user narrowed scope;
- `lens_detection`: mode, applied lenses, detected-but-not-applied lenses, and
  high-risk not-applied warnings.

These fields are the only review-shape handoff into reviewer prompt
construction. Step 4 must not infer review shape again from raw flags.
