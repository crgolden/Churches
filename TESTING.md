# Testing

The Churches test suite covers **frontend unit tests** (Vitest, in jsdom and in a real browser),
**integration tests** of the server-rendered HTML (Playwright's `request` fixture), **browser E2E tests**
written as Gherkin features (`playwright-bdd`), and the **synthetic walker**. This repo tests the Angular SSR + Node BFF
stack; every Directory API call goes to a mock this repo ships, so no other service is needed.

Unit tests carry no control flow: no `if`, loop or `try` in a test body.

## Test tiers

| Tier | Tool | Location | Requires live servers? | Runs in CI |
|------|------|----------|------------------------|------------|
| Frontend unit | Vitest project `unit` (jsdom) | `src/**/*.spec.ts` | No | Every push/PR |
| Frontend unit in a real browser | Vitest project `browser` (Chromium, `@vitest/browser-playwright`) | `src/**/*.browser.spec.ts` | No | Every push/PR |
| Integration | Playwright (`--project=integration`, `request` fixture only) | `integration/` | No: the same SSR server and mock Directory API as E2E | Every push/PR |
| E2E (regression) | Gherkin features, `playwright-bdd` (`--project=e2e`) | `e2e/features/`, steps in `e2e/steps/` | No: Playwright manages the Node SSR server and the mock Directory API | Every push/PR |
| Synthetic walker | Playwright (`--project=synthetic`) | `e2e/synthetic/` | Yes — targets the deployed stack | Scheduled (`synthetic.yml`), never a merge gate |

---

## Frontend unit tests

```powershell
npx vitest run             # one-shot
npx vitest run --coverage  # LCOV → coverage/lcov.info
```

Vitest runs with `pool: threads` and `fileParallelism: false`. Angular 22 is zoneless —
always call `fixture.detectChanges()` manually.

---

## E2E tests (regression)

No live servers needed. Playwright manages two local servers for the test run, started in this order
(the mock Directory API must be healthy before the SSR server starts — its warmup request during
Angular bootstrap hits the mock directly):

1. **Mock Directory API** (`npx tsx e2e/mocks/directory-server.ts`, port 4001) — handles
   `/directory/api/*` routes and the control API used by test helpers. Its routes carry no
   path prefix, because the SSR server's `directoryProxy` strips `/directory/api` before forwarding.
   The control routes and the mock's port reach every process through one generated E2E contract
   (`e2e/mocks/e2e-contract.ts`): `playwright.config.ts` builds it with `newE2eContract()` and stores it
   as JSON in `E2E_CONTRACT`, which the runner, its workers and the mock inherit. A route generated
   inside any one process instead would differ from the others' and the control call would 404.
   It is a real HTTP server rather than `page.route` interception because Node makes these calls
   during SSR, and Playwright can only intercept requests the browser makes.
2. **Node SSR + BFF server** (port 4000) — starts the built `dist/churches.client/server/server.mjs`
   with in-memory session store, dummy OIDC values, and `DirectoryApiAddress` pointing at the mock.

Every `/bff/**` and `/directory/api/**` call is either handled by the mock server or intercepted by
Playwright route mocks; no real OIDC provider or Directory API is contacted.

The `e2e` project (`playwright.config.ts`) runs serialized — `fullyParallel: false`, single worker —
because every spec shares the mock server's in-memory state; concurrent specs would race on it.

**Authentication is mocked wholesale, and no tier exercises the real OIDC exchange.** `e2e/test-data.ts`
fulfils `/bff/user` with a fixed claim array (`signInAsMember` with user claims, `signInAsModerator` with
`churches.mod=true`), so every moderator scenario passes regardless of which token really carried the claim,
and `signInAsVisitor` fulfils it as 200 with a `null` body, which is what the real BFF answers a visitor
with no session. The persona steps (`Given I am a visitor`, `a signed-in member`, `a moderator`) call them.
**Reading `/bff/user` back in a browser test therefore asserts the fixture, not the BFF**, so no E2E
scenario reads it. The PKCE authorization-code flow, the token exchange, and the
userinfo call are not covered by the E2E tier. **The synthetic walker is the only tier that drives the
real exchange**, because it signs in through the deployed OIDC provider with a passkey rather than a mock,
so a break in the PKCE flow surfaces there and nowhere else in this repo. The discriminating test for
where the `churches.mod` claim actually arrives from is `src/bff/routes.spec.ts`, not anything in
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

**E2E features (`e2e/features/`)**, each scenario written as the user sees it, in the user's words, with
no selectors or implementation details in the Gherkin:

| Feature | Covers |
|---|---|
| `searching.feature` | Search by name, state, worship style, wheelchair access, no match, Enter, Near me |
| `search-results.feature` | Result count, result links and location, no distances without a location, map view, opening a church, paging to the top, Back restoring the reader's place in-app and after a full page load, inactive churches hidden |
| `church-details.feature` | Full and sparse details, missing and inactive churches, low confidence, the correction link by persona, a moderator adding and removing a service time and adding a ministry |
| `suggesting-corrections.feature` | The form, a submission, a value for an empty field, an unchanged value, sign-in with the return address, an unknown church |
| `moderation.feature` | Non-moderators turned away, a waiting correction, approve (value applied), reject, an empty queue |
| `browsing-without-errors.feature` | No script errors moving between pages, signed out and signed in |
| `server-rendered-pages.feature` | Hydration reuses the server's responses; a later navigation still asks the directory |

- `npm run e2e` runs `bddgen` first, compiling the features into `.features-gen/e2e/` (git-ignored), and
  `typecheck:e2e` runs it too. Steps live in `e2e/steps/`, one file per area, built with `createBdd` over the
  `test` in `e2e/steps/fixtures.ts`. That fixture resets the mock Directory before every scenario, answers map
  tiles with 204, and records script errors and directory requests into the scenario's `ctx`.
- **The gate's transfer-cache plant selects the "Server-rendered pages" feature by name from `.features-gen/`**,
  which the E2E step's `bddgen` writes. A gate that carries the E2E step after `.features-gen/` was deleted
  finds nothing to select, and the plant then fails for that reason rather than for the transfer cache.
- **Map view:** "Viewing the results on a map" asserts the Leaflet container, the church's marker, **and that
  `leaflet.css` actually applied**, through computed styles only that stylesheet supplies (position /
  overflow). This guards against a map that renders DOM but has a broken stylesheet.
- **Reports:** besides the Playwright HTML report, the run writes `cucumber-report/messages.ndjson` and
  `cucumber-report/index.html`, paths from `e2e/e2e-settings.json`. CI uploads `cucumber-report/` as
  `churches-cucumber-report` and publishes the NDJSON to the `test_results` database with
  `publish-bdd-results` from `@crgolden/modules`, only when the E2E step ran.

**Integration (`integration/seo.spec.ts`)** fetches raw HTML through the `request` fixture and asserts the
server-rendered `<title>`, `<meta name="description">`, `<link rel="canonical">`, `og:*` Open Graph tags and
`<script type="application/ld+json">` on `/churches` and `/churches/:slug`. It drives HTTP rather than a
browser, so it is an integration test, and it runs as its own Playwright project against the same servers.

**Checked below the E2E layer rather than in a scenario:**

| Behavior | Where |
|---|---|
| A Next control only when another page exists, and a Previous only after the first | `church-list.component.spec.ts` (first, last and exactly-one-page cases) |
| The correction form starts on the church name | `contribute.component.spec.ts` |
| An empty correction is not submitted | `contribute.component.spec.ts` "submit does nothing when newValue is empty" |
| Where `churches.mod` comes from, and what `/bff/user` answers | `src/bff/routes.spec.ts` |
| The Location heading lines up with Contact; the moderator's service-time form is a labelled grid with a row gap | `church-detail.layout.browser.spec.ts`, in the `browser` Vitest project |

---

## Synthetic walker

`e2e/synthetic/walker.spec.ts` performs a **seeded random walk of the deployed app**: one real
login through the deployed OIDC provider, then a weighted random sequence of read-only actions (search,
open results, paginate, map view, contribute-form view; no mutating POSTs). It runs on a schedule
from `.github/workflows/synthetic.yml` (twice daily, plus `workflow_dispatch` with a `seed`
input) and is **never a merge gate**: it exists to catch regressions in production and to feed
real traffic into observability. Tests skip unless `WalkerBaseUrl` is set.

There is no separate post-deploy smoke test: `/health`, bootstrap, CSRF and the unauthenticated session
are covered by the E2E tier against mocks, and the walker exercises the same paths against production.

Environment contract:

| Variable | Meaning |
|---|---|
| `WalkerBaseUrl` | Deployed app URL; also disables `webServer` |
| `SYNTHETIC_SEED` | **Required** decimal uint32; the whole walk derives from it |
| `SYNTHETIC_STEPS` | Optional step budget override; its default and ceiling are `stepBudget` in `e2e/synthetic/walker-settings.json` |
| `PASSKEY_CREDENTIAL1` | The walker account's passkey, as the five-field JSON Playwright's virtual authenticator returns |

**The walker signs in with a passkey, not a password**, through the provider's ordinary passkey
sign-in rather than an exemption, so no password is stored in CI. Enroll a passkey for the walker
account with your provider and store the virtual authenticator's credential as `PASSKEY_CREDENTIAL1`.

Replay a failed walk with the seed from the job summary / failure message:

```powershell
$env:SYNTHETIC_SEED = '<seed>'; $env:WalkerBaseUrl = '<deployed app URL>'; npm run e2e:synthetic
```

Same seed ⇒ same RNG decisions given the same action availability; divergence caused by live-data
drift (a search returning different rows) is expected — the guarantee is the decision sequence,
which is what makes a failure reproducible in practice.

- **The seed is a run parameter, not unit-test data**; the rule that unit-test data is generated does
  not apply to it, so do not make the seed unrepeatable.
- **The engine comes from the `@crgolden/modules` package's `synthetic-walker` entry point**, installed
  from GitHub Packages ([README.md](README.md#prerequisites)). A 401 on the `@crgolden` scope during
  `npm ci` means the token is missing. Dependabot needs the **same secret again in its own store**
  (`gh secret set PACKAGES_READ_TOKEN --app dependabot`) plus the `registries:` block in
  `.github/dependabot.yml`, or every Dependabot PR fails `npm ci` with that same 401.
- **The engine waits for Angular hydration before every step, and the wait is required.** A click that
  lands after the server-rendered paint but before hydration attaches `(submit)="$event.preventDefault()"`
  lets the browser submit the search form itself, a native GET to `/?` (the inputs carry no `name`, so the
  query string is empty: that `/?` is the signature of the race). At Playwright's `load` event the page can
  still carry `[ngh]` annotations, which Angular removes once hydration claims the DOM; `ng-server-context`
  persists forever and is **not** a usable signal. The window is client-side bootstrap, so it widens on a
  slow CI runner.
- **A walker timeout may be a performance finding rather than a test defect, so diagnose before
  raising a timeout.** Post-navigation assertions route through `expectRendered`, which carries no timeout
  of its own: a page that needs more than Playwright's default to render is the finding, not a reason for
  headroom.
- Walker traffic is identifiable by the User-Agent suffix `crgolden-synthetic/1.0`; it sends no marker
  header.
- **GitHub disables scheduled workflows after 60 days without repo activity in public repos**;
  a push, a `workflow_dispatch`, or the Actions UI re-enables it. Schedules fire from `main` only.

---

## CI pipeline

The GitHub Actions workflow (`.github/workflows/main_crgolden-churches.yml`) runs on every push and PR:

1. `npm ci` → lint → `typecheck:e2e` → `typecheck:spec` → `lint:css` → `npm run audit` (fails on a high
   or critical advisory)
2. Playwright Chromium (cached by version), which the `browser` Vitest project needs as well as E2E
3. `npm run test:coverage` (both Vitest projects; LCOV → `coverage/lcov.info`)
4. `npm run e2e` (self-builds the `ci` configuration, runs `bddgen`, then the `integration` and `e2e` projects),
   then an assertion that it executed at least `executedTestFloor` tests (`e2e/e2e-settings.json`), then
   `publish-bdd-results`. Adding or removing a scenario or an integration test changes that floor in the same
   change.
5. `lint:utilities` (reads the `ci` build E2E made), then SonarCloud analysis via
   `sonarsource/sonarqube-scan-action`, then a step that fails on any open Sonar issue. The scan action, not the
   deprecated `sonarcloud-github-action`, whose pinned scanner bundles a JRE that SonarCloud rejects;
   it needs no JDK or scanner setup step of its own.
6. On `main` only: `npm run build` (production configuration) → `npm prune --omit=dev` → deploy to the App
   Service app

There is no post-deploy step. The scheduled synthetic walker (`synthetic.yml`) is what exercises the
deployed app; see [Synthetic walker](#synthetic-walker).

---

## Local SonarCloud analysis

A single SonarCloud project, `crgolden_Churches`, covers the Angular client (Vitest LCOV). Use the
SonarScanner CLI with `SONAR_TOKEN` in the environment and `sonar.host.url=https://sonarcloud.io` in its
global `conf/sonar-scanner.properties` or as one more `-D` argument:

```powershell
# Generate coverage first, over the whole suite
npx vitest run --coverage

# Run the scanner with SONAR_TOKEN already in the environment
sonar-scanner `
  "-Dsonar.projectKey=crgolden_Churches" `
  "-Dsonar.organization=crgolden" `
  "-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info" `
  "-Dsonar.exclusions=**/node_modules/**,**/*.d.ts,e2e/**,integration/**,.features-gen/**,instrumentation.mjs,**/*.spec.ts" `
  "-Dsonar.tests=src" `
  "-Dsonar.coverage.exclusions=e2e/**,integration/**,scripts/**,**/*.config.*,src/test-setup*.ts,gate.ps1,src/proxy.conf.js,src/environments/**,src/main.ts,src/main.server.ts,src/server.ts,src/app/app.routes.server.ts" `
  "-Dsonar.test.inclusions=**/*.spec.ts"
```

### When to build a truth table

The coverage **score is read from SonarCloud, never hand-maintained** here. Build a per-method truth
table (one row per combination of the method's conditions, each mapped to the test that exercises it) only
when SonarCloud flags a method with **cognitive complexity > 15 AND uncovered conditions > 0**.
