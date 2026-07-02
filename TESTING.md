# Testing

The Churches test suite covers **frontend unit tests** (Vitest) and **browser E2E + smoke tests**
(TypeScript Playwright). This repo tests the Angular SSR + Node BFF
stack. The Directory API has its own suite in the [Directory](https://github.com/crgolden/Directory) repo.

Unit test coding standards (no control-flow in tests, etc.) are in the workspace-level
[Unit Test Standards](../TESTING.md#unit-test-standards).

## Test tiers

| Tier | Tool | Location | Requires live servers? | Runs in CI |
|------|------|----------|------------------------|------------|
| Frontend unit | Vitest | `src/**/*.spec.ts` | No | Every push/PR |
| E2E (regression) | Playwright (`--project=e2e`) | `e2e/` | No — Playwright manages the Node SSR server + mock Directory API | Every push/PR |
| Smoke (post-deploy) | Playwright (`--project=smoke`) | `e2e/smoke/` | Yes — targets the deployed stack | Post-deploy only |

---

## Frontend unit tests

```powershell
npx vitest run             # one-shot
npx vitest run --coverage  # LCOV → coverage/lcov.info
```

Vitest runs with `pool: threads`, `fileParallelism: false`, `testTimeout: 15000`. Angular 21 is zoneless —
always call `fixture.detectChanges()` manually.

---

## E2E tests (regression)

No live servers needed. Playwright manages two local servers for the test run:

1. **Mock Directory API** (`npx tsx e2e/mocks/directory-server.ts`, port 4001) — handles
   `/directory/api/*` routes and the `/_test/*` control API used by test helpers.
2. **Node SSR + BFF server** (port 4000) — starts the built `dist/churches.client/server/server.mjs`
   with in-memory session store, dummy OIDC values, and `DirectoryApiAddress` pointing at the mock.

Every `/bff/**` and `/directory/api/**` call is either handled by the mock server or intercepted by
Playwright route mocks — no real Identity or Directory is contacted.

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
`auth-flow.spec.ts` (BFF login/logout), `contribute.spec.ts`, `moderation.spec.ts`, `edge-cases.spec.ts`.

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

## CI pipeline

The GitHub Actions workflow (`.github/workflows/main_crgolden-churches.yml`) runs on every push and PR:

1. `npm ci` → lint
2. `npx vitest run --coverage` (LCOV → `coverage/lcov.info`)
3. `npm run e2e` (self-builds the `ci` configuration, then runs Playwright E2E; Chromium cached by version)
4. SonarCloud analysis via `sonarsource/sonarcloud-github-action` (JS LCOV only; no C# paths)
5. `npm run build` (production configuration) → `npm prune --omit=dev` → deploy to `crgolden-churches` (Linux)
6. Post-deploy smoke (`npm run e2e:smoke` against `webapp-url`)

ADO test results and Azure Monitor telemetry are published from the Playwright JUnit XML
(`playwright-results.xml`), which is written by the `junit` reporter in `playwright.config.ts`.

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
See `../DESIGN-LANGUAGE.md` and `../TESTING-COVERAGE.md`.
