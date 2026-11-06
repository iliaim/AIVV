# AIVV Configuration Reference

AIVV reads user preferences from two locations (highest precedence first):

1. **CLI flags** (e.g., `/aivv --reviewers=3`) — always win
2. **Project-level config:** `<target>/.aivv/config.json` — applies when AIVV runs in that project
3. **User-level config:** `~/.aivv/config.json` — applies across all projects
4. **Plugin defaults** — hardcoded fallback (per golden JSON Schema at `.aivv/schemas/config.schema.json`; legacy v2/v3/v4/v5/v6 schemas remain available as compatibility artifacts)

## Resolution algorithm

> **Shared contract:** referenced by both `/aivv` and `/aivv-fix`. Changes here propagate to both orchestrators; skill-specific deltas stay in the calling SKILL.md.

This is the shared config/preferences resolution mechanism reused by both `/aivv` (Step 1.5) and `/aivv-fix`. It is the single source of truth for the precedence order and the golden-schema dispatch; skill-specific procedure (e.g. `/aivv` Step 1.5 auto-create, lens-value validation, the thoroughness dial, and `/aivv-fix` apply-policy bindings) layers on top of this core in the respective skill.

**W9 golden-schema dispatch:** resolve with precedence CLI > project config > user config > schema defaults; validate readable user/project config objects against `.aivv/schemas/config.schema.json` regardless of `schema_version`; treat `schema_version` as compatibility/minimum-reader metadata; resolve absent additive keys from the golden schema defaults; allow unknown keys for forward compatibility while surfacing known-key typos through the validator. Do not route ordinary preference reads through legacy `config.vN.schema.json` files.

**L1-source forced-override:** `severity_threshold` is a rendering filter, not a suppression of legal/safety findings. Findings carrying L1-source citations (see the [Legal / safety override](#legal--safety-override-never-hidden) section below for the canonical citation set) are forced-shown regardless of the resolved `severity_threshold`. The user cannot accidentally suppress L1-source findings via preferences. The canonical detection regex lives in `skills/aivv-fix/references/polish-and-l1-source-policy.md` under "L1-source detection logic".

## Quick start

**Fastest path — interactive wizard (recommended for first-time setup):**

```bash
/aivv --setup
```

The wizard asks 4-5 preference questions, records project-kind metadata from an existing value or cheap filesystem inference, resolves a preset bundle, asks how to show readable HTML reports, and writes your preferences. A fresh setup defaults to the `general` review lens regardless of project kind; an existing `default_lenses` selection is preserved. Run `--setup --project` to configure project-scope instead of user-scope.

**Manual setup:**

Initialize a default project config:

```bash
/aivv --config-init
```

Initialize a default user config:

```bash
/aivv --config-init --user
```

Generated default config files may omit `fix_apply_policy`; omitted policy resolves from the golden schema default at runtime. Defect categories default to `auto`; `improvement` and `clarification-needed` default to `ask`. Set any category explicitly to change that posture, or to `skip` where safety floors permit skipping.

Show the effective resolved config:

```bash
/aivv --config-show
```

Set a single key (project scope):

```bash
/aivv --config-set default_reviewers=2
```

Set a single key (user scope):

```bash
/aivv --config-set auto_chain_fix=always --user
```

Get a single key (with provenance):

```bash
/aivv --config-get severity_threshold
```

**Reset config:**

```bash
# Wipe user-level config (re-created silently on next /aivv invocation):
rm ~/.aivv/config.json

# Wipe project-level config:
rm <target>/.aivv/config.json

# Re-arm the setup-hint (will appear on next /aivv invocation):
# Note: _setup_hint_shown_at lives in user-scope; use --user to target ~/.aivv/config.json
/aivv --config-set _setup_hint_shown_at=null --user
```

## Configuration keys

This table lists the stable user-facing preference keys (including `multi_model_enabled`, surfaced inline below where users routinely set it). The golden schema contains additional provider/model orchestration keys used by advanced dispatch paths; consult `.aivv/schemas/config.schema.json` for the exhaustive machine-readable property set.

| Key | Type | Default | Description |
|---|---|---|---|
| `default_reviewers` | int (1–9) | 1 | When `--reviewers=N` not set, use this |
| `default_lenses` | string \| array | `"general"` | When `--lens=` is not set, use this. An omitted or unknown configured lens warns and falls back to `general`; a valid explicit or configured lens selection is retained as written. |
| `severity_threshold` | enum (`CRITICAL` \| `MAJOR` \| `MINOR`) | `"MINOR"` | Show defect findings AT OR ABOVE this severity. L1-source findings forced-shown regardless. POLISH always rendered separately (orthogonal value-add tier — NOT on the threshold axis). |
| `auto_chain_fix` | enum (`always` \| `ask` \| `never`) | `"ask"` | Whether `/aivv` auto-chains into `/aivv-fix` when findings exist |
| `apply_polish_mode` | enum (`always` \| `ask` \| `never`) | `"ask"` | Whether `/aivv-fix` batch-applies POLISH suggestions |
| `fix_apply_policy` | object (`category` → `auto` \| `ask` \| `skip`) | defect categories `auto`; `improvement` and `clarification-needed` `ask` | Per-category `/aivv-fix` apply policy. Omitted policy resolves from the golden schema default. `auto` applies only when `fix_confidence == high` and all challenge/consequence/write gates clear; invasive improvements are never auto-eligible. |
| `polish_collapsed` | bool | `false` | Render POLISH findings expanded by default; set `true` to collapse |
| `post_review_html_viewer` | boolean | `true` | When true, `/aivv` writes a static HTML report after review-only flows and after completed auto-fix flows. First interactive setup asks before persisting the choice. |
| `post_review_html_open_mode` | enum (`link` \| `open`) | `"link"` | Controls the post-report affordance when HTML reports are enabled. `link` shows an Open report link/path without stealing focus (recommended). `open` also best-effort opens the report, preferring a Codex in-app browser local-served URL when available and falling back to the OS opener. Browser-open failures never fail the workflow. |
| `default_M` (legacy) / `default_lens_replicate` | int (1–5) | 2 | Default reviewers-per-lens for `--full-*` modes (Wave 2+). New writes use `default_lens_replicate`; legacy configs that still carry `default_M` remain readable, and readers map `default_M` to `default_lens_replicate` when the modern key is absent. Plain-dispatch binding additionally requires `_provenance==wizard` to fire (preserves v1-baseline behavior for v1 users with default_M=2 + multi-lens dispatch). |
| `runtime_driver_optin` | bool | `false` | Pre-consent to `--runtime` when MCP detected (post-dev.43) |
| `default_target` | string \| null | `null` | Default `--target=` directory. Stale paths warn but do not error. |
| `rule_id_back_fill` | bool | `false` | Back-fill `rule_id` on pre-dev.39 calibration entries via finding-text → rule-ID heuristic |
| `project_kind` | enum (`"ui"` \| `"backend"` \| `"mixed"` \| `"library"` \| `null`) | `null` | Wizard-set project category metadata. It does not select or overwrite `default_lenses`; fresh setup keeps `general`, and an existing configured lens selection is preserved. Set by `/aivv --setup`; readable/settable via `--config-set`. Runtime reads `default_lenses` directly, not `project_kind`. |
| `outer_loop_mode` | enum (`"off"` \| `"until_clean"`) | `"off"` | When `"until_clean"`, `/aivv-fix` Step 6.5 re-invokes `/aivv --fix` in a loop until all continuation-counting findings clear or a termination condition fires (cap, no-progress, user-interrupt). Continuation-counting subset: findings with `recommended_next_step` of `fix-now` or `investigate-first` AND NOT L1-source AND NOT POLISH. Legacy findings without `recommended_next_step` fall back to `severity ≥ outer_loop_severity_floor`. Default `"off"` preserves all existing behavior. Enable per-project or globally via `--config-set outer_loop_mode=until_clean`. |
| `outer_loop_max_cycles` | int (2–5) | 3 | Maximum outer-loop iterations. Min=2 (cycles=1 is equivalent to `off`). On reaching the cap, /aivv-fix emits a cap-reached banner and halts. |
| `outer_loop_severity_floor` | enum (`"CRITICAL"` \| `"MAJOR"`) | `"MAJOR"` | Legacy fallback minimum severity for outer-loop continuation when a finding lacks `recommended_next_step`. Current action gates prefer DISPOSITION (`fix-now` / `investigate-first`) over raw severity. |
| `lens_detection_mode` | enum (`"ask"` \| `"smart"` \| `"off"`) | `"ask"` | Controls smart review-lens detection (dev.154, v4 schema). `ask`: prompt before adding non-obvious detected ceiling lenses (the floor lens always auto-applies). `smart`: automatically select detected ceiling lenses. Scope resolution still clarifies material ambiguity; ask before a method change beyond the request. `off`: detect/report only. v1/v2/v3 configs predate the key and default to `ask`. |
| `severity_model` | enum (`"legacy_4pass"` \| `"impact_likelihood"`) | `"legacy_4pass"` | Selects the severity-derivation model (v5 schema). `legacy_4pass`: the current four-pass blast-radius→tone→source-class→improvement inference (the shipped default — unchanged behavior). `impact_likelihood`: the forthcoming impact×likelihood model, under active rollout. v1/v2/v3/v4 configs predate the key and default to `legacy_4pass`. Advanced/experimental — set via `--config-set severity_model=impact_likelihood`; the wizard does not ask for it. |
| `project_context` | object | `{}` | Optional environmental context for impact×likelihood and legal-applicability gating. `deployment` (`personal` \| `internal` \| `public`) feeds EXPOSURE. `data_classes`, `jurisdictions`, and `compliance_targets` tell reviewers whether hard-statute legal findings are applicable, inapplicable, or undeclared-context findings; declared targets can raise DISPOSITION from advisory to required. |
| `severity_cell_map` | object | `{}` | Optional partial override for the impact×likelihood 4×4 defect table. Omitted cells use the shipped default table in `.aivv/methodology.md`. |
| `thoroughness` | enum (`"fast"` \| `"balanced"` \| `"thorough"` \| `"exhaustive"`) | `"balanced"` | Sets the default review-effort dial when `--thoroughness=` is absent. `balanced` is the inert default; `fast` lowers effort, `thorough` raises replicate depth, and `exhaustive` adds the load-bearing-grounding obligations described in `skills/aivv/references/thoroughness-dial.md`. v1/v2/v3/v4/v5 configs predate the key and default to `balanced`. |
| `direction` | boolean | `true` | Enables the graduated direction-challenge posture by default when `--direction` / `--no-direction` is absent. Use `--no-direction` for a single invocation or `--config-set direction=false` to persist the pre-feature behavior. Historical configs that predate the key resolve the missing value from the golden schema default. |
| `scope_confirmation_mode` | enum (`"ask"` \| `"announce"`) | `"ask"` | Clarifies material scope or method ambiguity before dispatch; clear requests proceed without a second approval. Use `--ask-scope` when explicit approval is wanted. Legacy `announce` remains readable, warns, and normalizes to `ask`; `--auto-scope` is deprecated and also normalizes to `ask`. |
| `issue_sync_mode` | enum (`"off"` \| `"draft-local"` \| `"confirm-github"` \| `"auto-github"`) | `"confirm-github"` | Controls GitHub issue sync for local issue mirrors. `confirm-github` plans remote operations but requires explicit confirmation; `auto-github` may apply eligible non-sensitive operations after safety checks. |
| `issue_sync_public_repo_policy` | enum (`"block-sensitive"` \| `"confirm-sensitive"` \| `"allow"`) | `"block-sensitive"` | Controls publication of sensitive lifecycle issue content to public GitHub repositories. Sensitive records are blocked on public repos by default. |
| `multi_model_enabled` | boolean | `false` | Master switch for cross-provider multi-model review (Case D). When `true`, `/aivv` dispatches provider-diverse reviewers (Anthropic + OpenAI + Gemini, capped by reviewer count) instead of same-provider cold subagents. Provider readiness is probed via CLI OAuth (`auth_mode=auto`; no env API keys needed). Per-run override: `--multi-model` / `--no-multi-model`. The companion provider keys `reviewer_provider_priority` (default `["anthropic","openai","gemini"]`) and `multi_model_fallback_strategy` (`ask`/`subagents`/`none`) tune selection order and per-provider-failure behavior — see `.aivv/schemas/config.schema.json` for the full provider/model orchestration key set. |

### Metadata fields (advanced / debugging)

These underscore-prefixed fields are written by AIVV automatically. Users can read them via `--config-show` or reset them via `--config-set`.

| Key | Type | Default | Description |
|---|---|---|---|
| `_provenance` | enum (`"wizard"` \| `"manual"` \| `"default"`) | `"default"` | Tracks how the config was generated. `"wizard"` = set by `/aivv --setup`; `"manual"` = modified via `--config-set`; `"default"` = auto-created. Gates `default_lens_replicate` plain-dispatch binding (only fires when `_provenance == "wizard"`). |
| `_setup_hint_shown_at` | ISO 8601 timestamp \| null | null | UTC timestamp when the setup invitation hint was first shown. `null` = hint not yet shown; non-null = hint suppressed on subsequent invocations. User-scope only. Reset via `--config-set _setup_hint_shown_at=null --user`. |
| `_walkthrough_hints_shown` | object (string keys → timestamp) | `{}` | Per-feature discovery hints. Keys are walkthrough IDs (e.g., `first_findings_rendered`, `auto_apply_v1`); values are ISO 8601 timestamps (shown) or null (not yet shown). User-scope only. Reset via `--config-set _walkthrough_hints_shown='{}' --user`. |

## Friction-reduction examples

**"I always run 2 reviewers on UI work":**

```bash
/aivv --config-set default_reviewers=2
```

**"I want `/aivv --fix` to auto-chain by default across all projects":**

```bash
/aivv --config-set auto_chain_fix=always --user
```

**"I only care about CRITICAL/MAJOR findings, hide MINOR":**

```bash
/aivv --config-set severity_threshold=MAJOR
```

POLISH suggestions remain visible by default; L1 findings (legal/safety) still surface even when below threshold.

**"I want to collapse POLISH by default":**

```bash
/aivv --config-set polish_collapsed=true
```

**"I never want POLISH applied without my review (skip the per-finding prompt entirely)":**

```bash
/aivv --config-set apply_polish_mode=never
```

POLISH findings remain in the review log for later manual inspection but are not surfaced in `/aivv-fix`'s apply queue.

**"Ask before applying improvement-category fixes under the new policy map":**

```bash
/aivv --config-set fix_apply_policy='{"improvement":"ask"}'
```

**"Use a different lens by default for security-sensitive projects":**

```bash
# In the security-sensitive project:
/aivv --config-set default_lenses=sec
# OR for multi-lens dispatch (K=N==2):
/aivv --config-set default_lenses='["code","sec"]'
```

**"I want AIVV to automatically re-review after fixing (outer-loop mode)":**

```bash
# Enable until-clean outer-loop on this project:
/aivv --config-set outer_loop_mode=until_clean
# Adjust iteration cap (default 3; range 2-5):
/aivv --config-set outer_loop_max_cycles=5
# Loop only while CRITICAL findings remain (default MAJOR):
/aivv --config-set outer_loop_severity_floor=CRITICAL
```

With `outer_loop_mode=until_clean`, `/aivv-fix` will re-invoke `/aivv --fix` automatically after each inner fix cycle, until no findings with action-driving DISPOSITION remain or the cap is reached. `outer_loop_severity_floor` applies only to legacy findings that lack `recommended_next_step`.

**"This is a personal/internal/public project; calibrate exposure accordingly":**

```bash
/aivv --config-set project_context='{"deployment":"personal"}'
/aivv --config-set project_context='{"deployment":"internal"}'
/aivv --config-set project_context='{"deployment":"public"}'
```

`deployment` affects likelihood/exposure under `severity_model=impact_likelihood`. It does not by itself establish legal/data-regulatory applicability; add `data_classes`, `jurisdictions`, and `compliance_targets` when legal applicability would change the finding.

**"I want to sync preferences across machines (dotfiles pattern)":**

```bash
# Create the AIVV config directory:
mkdir -p ~/.aivv

# Symlink from your dotfiles repo to the AIVV config location.
# Use -f (force) to overwrite the auto-created ~/.aivv/config.json if you've
# already run /aivv once (preferences.md Step 0.5 creates it automatically):
ln -sf ~/dotfiles/aivv/config.json ~/.aivv/config.json

# After this, any machine with your dotfiles repo will share the same AIVV
# preferences automatically. The symlink takes effect on the next /aivv
# invocation — no restart needed (config is re-read fresh every invocation).
```

**"I want to control whether AIVV opens the HTML report after reviews/fixes":**

On first interactive use and in `/aivv --setup`, AIVV asks how to show HTML reports. The recommended/default answer is to generate the report and show an `Open report` link because the viewer shows all findings by default without stealing focus. Change the preference any time:

```bash
# Enable globally:
/aivv --config-set post_review_html_viewer=true --user

# Enable for this project only:
/aivv --config-set post_review_html_viewer=true

# Disable globally:
/aivv --config-set post_review_html_viewer=false --user

# Generate reports but only show an Open report link (recommended):
/aivv --config-set post_review_html_open_mode=link --user

# Generate reports and also auto-open them:
/aivv --config-set post_review_html_open_mode=open --user
```

Legacy configurations may still contain `scope_confirmation_mode=announce`, and
older invocations may pass `--auto-scope`. Both remain readable for
compatibility, but AIVV warns and normalizes them to `ask`. Clear requests
proceed with their stated scope; ask only when material ambiguity or a method
change beyond the request needs the user's decision. Pass `--ask-scope` when
you want approval even for a clear proposal.

**"I want to keep issue lifecycle state local only":**

Run: `/aivv --config-set issue_sync_mode=draft-local`

**"I want confirmed GitHub issue sync but never sensitive public publication":**

Run:

    /aivv --config-set issue_sync_mode=confirm-github
    /aivv --config-set issue_sync_public_repo_policy=block-sensitive

## Legal / safety override (NEVER hidden)

`severity_threshold` does NOT hide findings citing:

- WCAG SC IDs (e.g., `WCAG 2.4.11`)
- FTC enforcement actions
- EU DSA Article 25 (matches `EU-DSA`, `EU DSA`, `EUDSA` compressed forms)
- ADA, Section 508, ARIA APG patterns
- Rules with `rule_id` matching `COMP-LEGAL-*` or `A11Y-*`

These are forced-shown regardless of threshold setting. The user cannot accidentally suppress legal/safety findings via preferences. (See `skills/aivv-fix/references/polish-and-l1-source-policy.md` "L1-source detection logic" for the canonical regex; word boundaries on bare acronyms `FTC`/`DSA`/`ADA` prevent false-positive substring matches.)

Forced-show is a rendering rule, not a legal-applicability conclusion. When `project_context` declares a statute inapplicable (for example, no EU jurisdiction and no PII for a GDPR-only pattern), the finding still renders if it carries an L1 citation, but its DISPOSITION may be `document` / `defer-with-rationale` and its POLISH batch-apply path does not trip the manual-review refusal guard. When applicability is undeclared or the context makes the statute applicable, keep the manual-review guard and state the applicability assumption.

## POLISH tier (orthogonal value-add suggestions)

POLISH is a separate severity tier introduced dev.39 — improvement opportunities and value-add suggestions, NOT defects. POLISH findings:

- Are emitted only when the reviewer can articulate `Improvement:` and `Value:` lines per the Improvement-articulation pass in `.aivv/methodology.md`. If the reviewer cannot articulate both, the finding is dropped entirely (not downgraded).
- Render expanded by default below defect findings. Set `polish_collapsed: true` to collapse to a one-line summary; `--show-polish` expands for a single invocation.
- Are NOT in the `severity_threshold` enum — they're orthogonal to defect severity. Setting `severity_threshold: CRITICAL` does NOT hide POLISH; `fix_apply_policy.improvement=skip` suppresses them in the apply queue unless safety floors require escalation. Legacy `apply_polish_mode: never` maps to that modern skip policy.
- Emit calibration records with `severity: "POLISH"` (per `.aivv/schemas/finding.json` enum + `.aivv/calibration/README.md` schema). The optional `rule_id` field provides per-rule tracking (applies to all severity tiers, not POLISH-specifically). POLISH-vs-MINOR separation in the per-rule FP/TP aggregator is achieved by layering a `severity` filter (see calibration/README.md "Per-rule FP/TP rate" → "Per-tier filter" example).

When explicit `fix_apply_policy.improvement` is present, it supersedes `apply_polish_mode` for improvement/POLISH apply decisions. If explicit modern improvement policy is absent but legacy `apply_polish_mode` is explicit, the legacy value maps to the modern policy (`always` → `auto`, `ask` → `ask`, `never` → `skip`). If neither is explicit, the schema default supplies `improvement=ask`.

## `/aivv-fix` apply policy

`fix_apply_policy` is a per-category object. Known keys are `code-bug`, `design-flaw`, `process-violation`, `documentation-gap`, `improvement`, and `clarification-needed`; values are:

| Value | Meaning |
|---|---|
| `auto` | Eligible for automatic application only after `/aivv-fix` confidence, CHALLENGE, L1-source, blast-radius, shared-interface, and write-intent gates clear. |
| `ask` | Route to the aggregated `/aivv-fix` decision queue. The prompt names the concrete trade-off or blocker, not a generic yes/no. |
| `skip` | Do not apply by default. CRITICAL/MAJOR defects, `fix-now`/`investigate-first` dispositions, active containment, and L1-source/manual-review floors still escalate; `skip` cannot suppress safety-relevant findings. |

`clarification-needed` is not directly fixable and defaults to `ask`; `improvement` also defaults to `ask`. Omitted `fix_apply_policy` resolves from the golden schema default. Defect-category `auto` defaults are confidence-gated: only high-confidence, low-consequence fixes apply automatically after CHALLENGE, L1-source/manual-review, blast-radius, shared-interface, and write-intent gates clear. Medium/low-confidence fixes, trade-offs, active containment, safety-floor cases, and all invasive improvements route to the batched decision queue.

On the first `/aivv-fix` invocation where schema-default `auto` applies because no explicit policy was configured, AIVV emits a one-time notice keyed to `_walkthrough_hints_shown.auto_apply_v1`: `/aivv-fix now auto-applies only high-confidence low-consequence fixes after safety gates clear. Set fix_apply_policy categories to ask to return to prompting.` If persisting the marker fails, the notice may reappear; the workflow continues.

`--dangerously-auto-apply` is a per-run `/aivv-fix` bypass, not a recognized config key. AIVV does not write it to user/project config and it has no golden-schema property; unknown config keys remain ignored for forward compatibility. The flag requires explicit confirmation, names the bypassed gates, fails closed in non-interactive runs unless `AIVV_DANGEROUSLY_AUTO_APPLY=1` is set, and emits a final audit banner with the number of fixes applied under bypass.

## Backward compatibility

When neither `.aivv/config.json` nor `~/.aivv/config.json` exists, AIVV first asks the interactive HTML-report behavior prompt when the host supports prompts, then creates `~/.aivv/config.json`. Adding a config does NOT change defaults for keys not present in the file — the schema's `default` field is the source of truth for omitted keys, including `fix_apply_policy`.

Generated configs do not need to materialize schema-default `fix_apply_policy`. To override the default, set the key directly with `/aivv --config-set fix_apply_policy='{"improvement":"skip"}'` or another valid policy object.

## Schema validation

Config files are validated against the golden additive schema at `.aivv/schemas/config.schema.json`. The `schema_version` field remains accepted as compatibility/minimum-reader metadata; the current writer stamps `schema_version: 6`, and additive key additions do not create new `config.v<N>.schema.json` files.

Historical configs remain readable. Configs that predate `default_lenses` or other additive preferences resolve omitted values from golden schema defaults, including `general` for `default_lenses`. Explicit valid lens selections such as `code` continue to be honored. A legacy `scope_confirmation_mode: "announce"` is read with a deprecation warning and resolves to `ask`. Explicit `polish_collapsed: true` continues to collapse POLISH output. Legacy `default_M` maps to `default_lens_replicate` when the modern key is absent.

On validation error:

- **Malformed JSON:** preserve the file at its original location, warn without printing contents, and fall through to defaults. An optional diagnostic copy may go to private external quarantine after authorized initialization.
- **Known key with invalid value:** preserve the original, warn, and fall through to defaults. Never move or rewrite optional configuration during preference reads.
- **Unknown keys:** allowed by the golden schema for additive compatibility, surfaced by validate-time lint, and ignored by the current reader unless a future AIVV version defines them.

The validation strategy is: one additive golden schema for readable config shape, plus a separate unknown-key lint so typos remain visible without making future additive keys unreadable.

## File locations

| Path | Purpose |
|---|---|
| `~/.aivv/config.json` | User-level preferences (cross-project) |
| `<target>/.aivv/config.json` | Project-level preferences (overrides user) |
| `<state_dir>/quarantine/config-<scope>-<ts>.json` | Optional private diagnostic copy; original config stays in place |
| `.aivv/schemas/config.schema.json` | Golden JSON Schema definition in the AIVV plugin |
| `.aivv/schemas/config.v2.schema.json`, `.aivv/schemas/config.v3.schema.json`, `.aivv/schemas/config.v4.schema.json`, `.aivv/schemas/config.v5.schema.json`, `.aivv/schemas/config.v6.schema.json` | Legacy compatibility schema artifacts |

## See also

- `.aivv/schemas/config.schema.json` — golden schema definition
- `skills/aivv/SKILL.md` Step 1.5 — load-time merge precedence + validation branch
- `skills/aivv-fix/references/polish-and-l1-source-policy.md` "L1-source detection logic" — L1-source forced-override regex
- `.aivv/calibration/README.md` — calibration corpus per-rule FP/TP aggregator
