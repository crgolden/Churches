# Testing

The Churches test suite covers **frontend unit tests** (Vitest) and **browser E2E + smoke tests**
(TypeScript Playwright). This repo tests the Angular SSR + Node BFF
stack. The Directory API has its own suite in the [Directory](https://github.com/crgolden/Directory) repo.

Unit test coding standards (no control-flow in tests, etc.) are in the workspace-level
[Unit Test Standards](../AGENTS/TESTING.md#unit-test-standards).

## Test tiers

| Tier | Tool | Location | Requires live servers? | Runs in CI |
|------|------|----------|------------------------|------------|
| Frontend unit | Vitest | `src/**/*.spec.ts` | No | Every push/PR |
| E2E (regression) | Playwright (`--project=e2e`) | `e2e/` | No — Playwright manages the Node SSR server + mock Directory API | Every push/PR |
| Smoke (post-deploy) | Playwright (`--project=smoke`) | `e2e/smoke/` | Yes — targets the deployed stack | Post-deploy only |
| Synthetic walker | Playwright (`--project=synthetic`) | `e2e/synthetic/` | Yes — targets the deployed stack | Scheduled (`synthetic.yml`), never a merge gate |

---

## Frontend unit tests

```powershell
npx vitest run             # one-shot
npx vitest run --coverage  # LCOV → coverage/lcov.info
```

Vitest runs with `pool: threads`, `fileParallelism: false`, `testTimeout: 15000`. Angular 22 is zoneless —
always call `fixture.detectChanges()` manually.

---

## E2E tests (regression)

No live servers needed. Playwright manages two local servers for the test run, started in this order
(the mock Directory API must be healthy before the SSR server starts — its warmup request during
Angular bootstrap hits the mock directly):

1. **Mock Directory API** (`npx tsx e2e/mocks/directory-server.ts`, port 4001) — handles
   `/directory/api/*` routes and the `/_test/*` control API used by test helpers.
2. **Node SSR + BFF server** (port 4000) — starts the built `dist/churches.client/server/server.mjs`
   with in-memory session store, dummy OIDC values, and `DirectoryApiAddress` pointing at the mock.

Every `/bff/**` and `/directory/api/**` call is either handled by the mock server or intercepted by
Playwright route mocks — no real Identity or Directory is contacted.

The `e2e` project (`playwright.config.ts`) runs serialized — `fullyParallel: false`, single worker —
because every spec shares the mock server's in-memory state; concurrent specs would race on it.

**Authentication is mocked wholesale, and no tier exercises the real OIDC exchange.** `e2e/fixtures.ts`
fulfils `/bff/user` with a fixed claim array — `authedPage` with user claims, `modPage` with
`churches.mod=true` — so every moderator test passes regardless of which token really carried the claim,
and `anonymousPage` fulfils it as 401. The PKCE authorization-code flow, the token exchange, and the
userinfo call are not covered by the E2E tier, and the smoke tier does not cover them either: its five
tests are `/health`, SPA bootstrap, two CSRF cases, and one unauthenticated 401. The discriminating test
for where the `churches.mod` claim actually arrives from is `src/bff/routes.spec.ts`, not anything in
`e2e/`.

**Route order in the mock matters.** `GET /churches/:slug` must be registered *after* every
`/churches/:churchId/*` route in `e2e/mocks/directory.ts`, because Express matches in registration order
and `:slug` would otherwise swallow a UUID segment. Moving it up produces 404s on the child-curation
routes rather than an error.

**Prerequisites (one-time):** install the Playwright Chromium browser:

```powershell
npx playwright install chromium
```

**Run:**

```powershell
npm run e2e   # self-builds the ci configuration (allowedHosts=localhost), then runs Playwright
```

> `npm run e2e` builds the `ci` configuration itself, so it always runs against a correct SSR build
> regardless of what is currently in `dist/` (a prior `npm run build` production build won't break it).

Failure artifacts (screenshot, trace, video) are written to `playwright-artifacts/`.

**E2E coverage (`e2e/`):** `anonymous.spec.ts` (public search/landing), `church-detail.spec.ts`,
`auth-flow.spec.ts` (BFF session/claims), `contribute.spec.ts`, `moderation.spec.ts`, `edge-case.spec.ts`.

**Map view:** `anonymous.spec.ts` seeds a church with coordinates, toggles "Map view" on `/churches`,
and asserts `div.leaflet-container` is visible, at least one `.leaflet-marker-icon` renders, **and that
`leaflet.css` actually applied** — it reads computed styles that only the stylesheet supplies (position /
overflow). This guards against a map that renders DOM but has a broken stylesheet.

**SSR assertions:** `church-detail.spec.ts` fetches raw HTML (`javaScriptEnabled: false`) and asserts
the server-rendered `<h1>`, `<title>`, `<meta name="description">`, `<link rel="canonical">`, `og:*`
Open Graph tags, and `<script type="application/ld+json">` on `/churches/:slug`. These prove the SEO
gap is closed.

---

## Smoke tests (post-deploy)

`e2e/smoke/api.spec.ts` targets a **deployed** stack. Tests are skipped unless `SmokeBaseUrl` is set.

```powershell
# Against the deployed app (reads SmokeBaseUrl from the argument)
.\Invoke-SmokeTests.ps1

# Or a specific target
.\Invoke-SmokeTests.ps1 -BaseUrl https://your-churches-app.azurewebsites.net
```

Smoke tests exercise: `GET /health` (must return `Healthy`), SPA bootstrap, BFF CSRF enforcement
(requests without `X-CSRF: 1` rejected with 401), proxy reachability (search returns 200 with header),
and unauthenticated protected endpoint (corrections POST returns 401).

---

## Synthetic walker

`e2e/synthetic/walker.spec.ts` performs a **seeded random walk of the deployed app**: one real
login through Identity, then a weighted random sequence of read-only actions (search, open
results, paginate, map view, contribute-form view — no mutating POSTs). It runs on a schedule
from `.github/workflows/synthetic.yml` (twice daily, plus `workflow_dispatch` with a `seed`
input) and is **never a merge gate** — it exists to catch regressions in production and to feed
real traffic into observability. Tests skip unless `SmokeBaseUrl` is set.

Environment contract:

| Variable | Meaning |
|---|---|
| `SmokeBaseUrl` | Deployed app URL (same switch the smoke tier uses; disables `webServer`) |
| `SYNTHETIC_SEED` | **Required** decimal uint32; the whole walk derives from it |
| `SYNTHETIC_STEPS` | Optional step budget override (default 40) |
| `TEST_USERNAME` / `TEST_PASSWORD` | Identity test account; the email must be in Identity's `ReCAPTCHATestEmails` |
| `SYNTHETIC_MARKER` | Must equal Identity's `ReCAPTCHASyntheticMarkerSecret`; sent as `X-Synthetic-Marker` on Identity-origin requests (redirect hops can carry it to this app's own origin; never to third parties) |

Replay a failed walk with the seed from the job summary / failure message:

```powershell
$env:SYNTHETIC_SEED = '<seed>'; $env:SmokeBaseUrl = '<deployed app URL>'; npm run e2e:synthetic
```

Same seed ⇒ same RNG decisions given the same action availability; divergence caused by live-data
drift (a search returning different rows) is expected — the guarantee is the decision sequence,
which is what makes a failure reproducible in practice.

- **The seed is a run parameter, not unit-test data.** The generated-test-data rule
  (CODE-STYLE.md rule 11) is scoped to unit tests; do not "fix" the walker by making the seed
  unrepeatable.
- **The engine comes from `@crgolden/modules/synthetic-walker`** (the Modules repo). Installing
  it needs GitHub Packages auth — CI uses the `PACKAGES_READ_TOKEN` secret; locally a
  `read:packages` PAT in your user `~/.npmrc`. A 401 on the `@crgolden` scope during `npm ci`
  means the token is missing. Dependabot needs the **same secret again in its own store**
  (`gh secret set PACKAGES_READ_TOKEN --app dependabot`) plus the `registries:` block in
  `.github/dependabot.yml`, or every Dependabot PR fails `npm ci` with that same 401.
- **The engine waits for Angular hydration before every step, and that wait is load-bearing.** A
  scheduled walk failed at step 1 with a native form GET to `/?`: the click landed after SSR
  paint but before hydration attached `(submit)="$event.preventDefault()"`, so the browser
  submitted the form itself. The search inputs carry no `name` attributes, which is why the query
  string came back empty — that empty `/?` is the signature of this race. Measured against
  production: at Playwright's `load` event the page still carries `[ngh]` annotations, which
  Angular removes only once hydration claims the DOM, while `ng-server-context` persists forever
  and is **not** a usable signal. A local run rarely reproduces it because the app is warm; the
  race needs a cold F1 instance, so CI is where it shows up.
- Walker traffic is identifiable by the User-Agent suffix `crgolden-synthetic/1.0`; the secret
  marker header goes to Identity-origin requests and, via redirect propagation, this app's own
  origin — never to third-party hosts (verified from a trace network log).
- **GitHub disables scheduled workflows after 60 days without repo activity in public repos**;
  a push, a `workflow_dispatch`, or the Actions UI re-enables it. Schedules fire from `main` only.

---

## CI pipeline

The GitHub Actions workflow (`.github/workflows/main_crgolden-churches.yml`) runs on every push and PR:

1. `npm ci` → lint
2. `npx vitest run --coverage` (LCOV → `coverage/lcov.info`)
3. `npm run e2e` (self-builds the `ci` configuration, then runs Playwright E2E; Chromium cached by version)
4. SonarCloud analysis via `sonarsource/sonarqube-scan-action` (JS LCOV only; no C# paths). That action, not
   `sonarcloud-github-action`: the latter is deprecated and its pinned scanner-cli bundles a JRE 17 that
   SonarQube Cloud no longer accepts, so "modernising" back to it breaks the step. It also needs no JDK or
   scanner setup step of its own.
5. `npm run build` (production configuration) → `npm prune --omit=dev` → deploy to `crgolden-churches` (Linux)
6. Post-deploy smoke (`npm run e2e:smoke` against `webapp-url`)

There is no SQL dacpac in this pipeline.

---

## Local SonarCloud analysis

A single SonarCloud project, `crgolden_Churches`, covers the Angular client (Vitest LCOV). There is no
C# surface. Use the global sonar-scanner CLI:

```powershell

# Generate coverage first
npx vitest run --coverage

# Run the scanner (uses global sonar-scanner.properties; override token via env)
$env:SONAR_TOKEN = '<token>'
sonar-scanner `
  -Dsonar.projectKey=crgolden_Churches `
  -Dsonar.organization=crgolden `
  -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info `
  -Dsonar.exclusions="**/node_modules/**,**/*.d.ts,e2e/**,instrumentation.mjs" `
  -Dsonar.coverage.exclusions="e2e/**,src/test-setup.ts" `
  -Dsonar.test.inclusions="**/*.spec.ts"
```

### When to build a truth table

The coverage **score is read from SonarCloud, never hand-maintained** here. Build a per-method table
only when SonarCloud flags a method with **cognitive complexity > 15 AND uncovered conditions > 0**.
See `../AGENTS/DESIGN-LANGUAGE.md` and `../AGENTS/TESTING-COVERAGE.md`.
