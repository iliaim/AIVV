---
name: sec
description: Security review lens — auth/authz, input validation, injection surfaces, secret handling, dependency hygiene
calibration_lens: sec
applies_to: source code, config, auth/session flows, API handlers, data-access code
detect_paths: "**/auth/**, **/*auth*, **/*login*, **/*signin*, **/*session*, **/*token*, **/*jwt*, **/*oauth*, **/*sso*, **/*crypto*, **/*password*, **/*secret*, **/*credential*, **/*.pem, **/*.key, **/middleware/**, **/*sql*, **/*query*"
detect_keywords: "security, authentication, authorization, injection, vulnerability, secret, credential, encryption, token, session, sql, xss, csrf"
detect_high_risk: true
high_risk_paths: "**/auth/**, **/*login*, **/*session*, **/*token*, **/*crypto*, **/*password*, **/*secret*, **/*credential*, **/*.pem, **/*.key, **/payments/**, **/*payment*, **/*billing*, **/*checkout*, **/*charge*, **/*invoice*, **/*stripe*, **/*pii*, **/*personal*, **/migrations/**, **/*migration*, **/*.env, **/*.env.*, **/secrets/**"
runtime_driver: none
---

## Focus

Apply these review concerns **in addition to** the universal Phase 2 VERIFY rules:

### Authentication & authorization

- Every state-changing endpoint verifies session/token validity before side-effects
- Authorization checks are co-located with the action (not assumed to happen upstream)
- Privilege escalation paths: user-controlled input → role or permission assignment
- Session invalidation: logout, password change, role change — does the session lifecycle close correctly?
- Token handling: lifetime, rotation, storage (never in localStorage for sensitive tokens), transmission (HTTPS-only)

### Input validation at trust boundaries

- User input is validated/normalized at the trust boundary, not deep inside business logic
- Validation is positive (allowlist/parse-don't-validate), not negative (blocklist of known-bad patterns)
- Size/length/type constraints enforced before parsing
- Redirect URLs, callback URLs, filenames, content-types — anywhere user input flows into a privileged operation

### Injection surfaces

- **SQL / ORM**: parameterized queries only; no string concatenation / template-interpolation into queries; beware ORM `raw()`/`exec()` escape hatches
- **Command**: no `subprocess.run(shell=True)`, `exec()`, `eval()`, `os.system()` with user-controlled input; use `subprocess.run([args...])` list form
- **HTML/XSS**: no `dangerouslySetInnerHTML` / `v-html` / `innerHTML =` with user content without sanitization; React/Vue default escaping relied on explicitly
- **SSRF**: server-side HTTP clients with user-controlled URLs — allowlist host, block internal/loopback/metadata-service targets (AWS `169.254.169.254`, GCP `metadata.google.internal`)
- **Path traversal**: user-controlled filenames → `path.resolve` + verify inside allowed root; reject `..` segments
- **Template injection**: user-controlled strings into template engines (Jinja, Handlebars, ERB) as templates, not as data
- **Deserialization**: `pickle.loads`, `yaml.load` (non-safe), PHP `unserialize`, Java `ObjectInputStream` on untrusted input

### Secret handling

- No hardcoded secrets, API keys, tokens, or credentials in source code (especially not in test fixtures or examples)
- Secrets loaded from environment, secret manager, or external config — never from checked-in config files
- Logs/error messages don't leak secrets, full SQL, or internal paths
- `.env*` files are gitignored; if present, verify they're untracked

### Dependency hygiene (if lockfile present)

- Lockfile is committed (`package-lock.json`, `yarn.lock`, `poetry.lock`, `Pipfile.lock`, `Cargo.lock`, `go.sum`)
- Flag known-vulnerable patterns visible in code: outdated crypto libs (MD5/SHA1 for auth, DES, ECB mode), deprecated packages (`request`, old Express versions)
- No automatic version-range upgrades in lockfile (e.g., `^` without a lockfile to pin)

### Crypto & randomness

- `crypto.randomUUID` / `crypto.randomBytes` / `secrets.token_urlsafe` for tokens — never `Math.random()` / `random.random()` for security-sensitive randomness
- Passwords hashed with bcrypt/argon2/scrypt — never MD5/SHA1/plain-SHA256 without a work factor
- HMAC for message integrity, not plain hashes; constant-time comparison for secrets (`crypto.timingSafeEqual`, `hmac.compare_digest`)

### Error handling that doesn't leak

- Stack traces/internal paths/SQL errors aren't returned to end users (dev mode acceptable; production not)
- 404 vs 403 distinction: don't leak existence of protected resources via differential responses

## Severity anchors

When `severity_model: impact_likelihood` is active, use these anchors for security findings: first decide whether the issue has a real harm mode, then assign IMPACT and LIKELIHOOD before mapping to the shared severity table. In legacy mode, treat the same anchors as reviewer reasoning guidance, not an override of the configured shared severity model. Do not promote a finding to CRITICAL merely because it is security-adjacent; reachability and exposure still matter.

### IMPACT: security harm if triggered

- **CATASTROPHIC** — likely full account takeover, cross-tenant data exposure, irreversible data loss/corruption, production secret compromise, or broad service compromise.
- **SEVERE** — unauthorized access to sensitive data or privileged action, exploitable injection on a meaningful path, authentication/session bypass for a bounded role or tenant, or high-confidence credential/session leakage.
- **MODERATE** — limited privilege confusion, information disclosure without sensitive data, denial of service with bounded blast radius, missing hardening that materially weakens a reachable boundary, or security control bypass with compensating checks.
- **NEGLIGIBLE** — hardening gap with no plausible current exploit path, dead defensive-code issue, misleading security-adjacent naming, or a convention mismatch that does not weaken a trust boundary.

### LIKELIHOOD: reachability and exposure

- **CERTAIN** — reachable from a normal request, page load, or job; attacker-controlled input flows directly to the vulnerable operation; no unusual privileges or timing needed.
- **PROBABLE** — reachable from a real feature with common preconditions, low privilege, or a likely configuration; exploitation requires some setup but no rare state.
- **POSSIBLE** — reachable only through a less common role, admin path, migration/import flow, unusual data shape, or chained precondition; plausible but not expected on most runs.
- **UNLIKELY** — dead or test-only code, disabled feature, unreachable branch, trusted-only input with enforced upstream controls, or exploit requires a rare deployment/configuration not present in the reviewed project.

### Worked examples

- Dead-code SQL injection in an unused helper with no current call path: IMPACT can remain SEVERE if it would expose or mutate sensitive data when called, but LIKELIHOOD is UNLIKELY, so the shared table maps it below CRITICAL.
- Live unauthenticated SQL injection in a public API handler: IMPACT is CATASTROPHIC or SEVERE depending on data/action scope, and LIKELIHOOD is CERTAIN or PROBABLE, so it usually maps to CRITICAL.

## Trigger patterns (flag these explicitly)

These patterns should always produce a finding unless the surrounding context clearly establishes safety. If the safety claim depends on legal or compliance applicability, use declared `project_context` rather than a prose hedge; undeclared context is a reason to state the assumption, not a reason to drop the finding:

- Unparameterized SQL/query construction with user input
- `dangerouslySetInnerHTML`, `v-html`, `innerHTML =`, `document.write(` with dynamic content
- `eval(`, `new Function(`, `setTimeout(`/`setInterval(` with string arguments
- `subprocess.run(..., shell=True)`, `os.system(`, backticks in shell-adjacent contexts
- `pickle.loads(`, `yaml.load(` (without `SafeLoader`), `jsonpickle.decode(` on untrusted input
- Hardcoded strings that look like secrets: `api_key = "sk_..."`, `password = "..."`, 40+ char hex strings, AWS/GCP key prefixes
- `Math.random()` / `random.random()` in auth, token generation, CSRF tokens
- `Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Credentials: true`
- Missing CSRF tokens on state-changing non-idempotent endpoints (POST/PUT/DELETE/PATCH) in session-cookie auth
- JWT `alg: none`, JWT decoded but not verified, JWT signature check skipped in dev paths
- SSL/TLS verification disabled (`verify=False`, `rejectUnauthorized: false`, `InsecureSkipVerify: true`)
- Cookie flags missing on auth cookies: `HttpOnly`, `Secure`, `SameSite`

## Standards to consult

- OWASP Top 10 (2021) — awareness of categories, not a checklist
- CWE catalog — when recommending a classification for an identified flaw
- `.aivv/methodology.md` — universal review phases still apply; this lens is additive

(Future: vendored security reference content from `agent-skills:security-review` when Tier 3 `/aivv-sec` graduates — see the public roadmap and platform adapter notes for current support status.)

## Graceful degradation

The `sec` lens operates on static artifacts only (per methodology.md Three-Tier scope — no runtime fuzzing, no network probes). If the change set contains no code (pure doc/config change), return zero security findings and state explicitly: "Security lens: no code in review target; no findings applicable."

If the reviewer encounters domain-specific security conventions that aren't in this lens (industry frameworks — HIPAA, PCI, SOC2), note them as *out-of-lens* with: "This change touches {domain}; specialist review recommended beyond AIVV's generic security lens." Do not fabricate compliance judgments.
