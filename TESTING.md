# Testing

The Churches test suite spans **backend unit tests** (xUnit v3), **frontend unit tests** (Vitest), and
**browser E2E + smoke tests** (Playwright). All backend tiers share the `Churches.Tests` project; frontend
tests live in `churches.client/`. This repo tests only the Angular client + BFF — the Directory API has its
own suite in the [Directory](https://github.com/crgolden/Directory) repo.

Unit test coding standards (MockBehavior.Strict, argument verification, SetupSequence, no control-flow in
tests, etc.) are in the workspace-level [Unit Test Standards](../TESTING.md#unit-test-standards). For Playwright
E2E tests, a `for`/`foreach` is acceptable when it is test setup rather than an assertion branch.

## Test tiers

| Tier | Trait / tool | Project | Requires Azure / live servers? | Runs in CI |
|------|-------------|---------|-------------------------------|------------|
| Backend unit | `Category=Unit` | `Churches.Tests` | No | Every push/PR |
| Frontend unit | Vitest | `churches.client` | No | Every push/PR |
| E2E (regression) | `Category=E2E` | `Churches.Tests` | No — static-file Kestrel; `/bff/**` and `/directory/api/**` are Playwright mocks | Every push/PR |
| Smoke (post-deploy) | `Category=Smoke` | `Churches.Tests` | Yes — targets the deployed stack, real OIDC login | Post-deploy only |

---

## Backend unit tests

Run directly against the compiled test exe (no live servers needed):

```powershell
dotnet build Churches.Tests --configuration Debug
.\Churches.Tests\bin\Debug\net10.0\Churches.Tests.exe -trait "Category=Unit" -showLiveOutput
```

## E2E tests (regression)

No live servers needed. `ChurchesWebApplicationFactory` is a minimal static-file Kestrel host (HTTPS, random
loopback port) that serves the Angular build from `churches.client/dist/churches.client/browser/`. It does
**not** run `Churches.Server/Program.cs` — every `/bff/**` and `/directory/api/**` call is a Playwright route
mock.

**Prerequisites (one-time):**

```powershell
# 1. Build the Angular output the factory serves
cd churches.client
npm run build
cd ..

# 2. Install the Playwright Chromium browser
pwsh Churches.Tests\bin\Debug\net10.0\playwright.ps1 install chromium
```

**Run:**

```powershell
dotnet build Churches.Tests --configuration Debug
.\Churches.Tests\bin\Debug\net10.0\Churches.Tests.exe -trait "Category=E2E" -showLiveOutput
```

Failure artifacts (screenshot, trace, video) are written to
`Churches.Tests\bin\Debug\net10.0\TestResults\PlaywrightArtifacts\E2E\`.

E2E coverage (`E2E/`): `AnonymousTests` (public search/landing), `ChurchDetailTests`, `AuthFlowTests`
(BFF login/logout), `ContributeTests` (correction submission), `ModerationTests`, `EdgeCaseTests`.

**Map view:** `AnonymousTests.ChurchList_TogglingMapView_RendersLeafletMapWithMarkers` seeds a church
with coordinates, toggles "Map view" on `/churches`, and asserts `div.leaflet-container` is visible,
at least one `.leaflet-marker-icon` renders, **and that `leaflet.css` actually applied** — it reads
computed styles that only the stylesheet supplies (`.leaflet-map-pane`/`.leaflet-tile`
`position: absolute`, `.leaflet-container` `overflow: hidden`). This last check is the important one:
markers and the container exist even with the stylesheet missing (Leaflet positions markers via inline
JS), so a broken-but-present map would otherwise pass. The assertions read CSS state, not tile images,
so they're independent of whether OpenStreetMap tile requests succeed under restricted network.
`ChurchDetailTests` applies the same guard to the church-detail `location-map`.

**Church detail:** `ChurchDetailTests` covers the `/churches/:slug` page — the schedules / ministries /
campuses sections (rendered when populated or to a moderator), the detail Leaflet map (`.leaflet-container`
plus the church and campus markers), and moderator add/delete of a schedule and a ministry. The add forms
and per-item delete buttons gate on `auth.hasModerationScope()`; the in-memory `ChurchStore` mutates via its
`Add*`/`Remove*` methods so the child POST/DELETE routes round-trip against the mocked `/directory/api`.

## Smoke tests (post-deploy)

`Category=Smoke` tests target a **deployed** stack and exercise the real OIDC login plus the BFF → Directory
proxy. They are skipped unless `SmokeBaseUrl` is set (`ChurchesFixture.IsSmoke`). `Smoke/ApiTests.cs` hits
`/directory/api/search`, `/directory/api/churches`, `/directory/api/corrections` (401 when unauthenticated),
and runs a full BFF login/logout cycle.

```powershell
# Against the deployed app
.\Invoke-SmokeTests.ps1
# Or a specific target
.\Invoke-SmokeTests.ps1 -BaseUrl https://your-churches-app.azurewebsites.net
```

Credentials (`AdminEmail`, `AdminPassword`) are read from `Churches.Server` user secrets
(`c7445659-3c3d-4e0e-86ee-d983bd5c741f`).

## Frontend unit tests

```powershell
cd churches.client
npx vitest run            # one-shot
npx vitest run --coverage # LCOV → coverage/lcov.info
```

Vitest runs with `pool: threads`, `fileParallelism: false`, `testTimeout: 15000`. Angular 21 is zoneless —
always call `fixture.detectChanges()` manually.

## CI pipeline

The GitHub Actions workflow (`.github/workflows/main_crgolden-churches.yml`) runs on every push and PR: build
the Angular client + BFF, run backend unit tests (`Category=Unit`) with coverage and frontend Vitest tests,
run SonarCloud analysis, and publish/deploy to `crgolden-churches`. There is no SQL dacpac in this pipeline.

## Local SonarCloud analysis

A single SonarCloud project, `crgolden_Churches`, covers the `Churches.Server` BFF (`--include
"[Churches.Server]*"`) and the Angular client (Vitest LCOV). The BFF's C# surface is a composition root; the
real client logic is the Angular Vitest/LCOV suite. (The church-data API is now measured by the separate
`crgolden_Directory` project in the [Directory](https://github.com/crgolden/Directory) repo.)

```powershell
dotnet build Churches.slnx --configuration Release
dotnet tool restore

dotnet coverlet Churches.Tests\bin\Release\net10.0 `
  --target "dotnet" `
  --targetargs "test --project Churches.Tests --no-build --configuration Release -- --filter-trait Category=Unit" `
  --format opencover --output "coverage.opencover.xml" `
  --skipautoprops --exclude-by-attribute GeneratedCodeAttribute `
  --exclude-by-file "**/obj/**" --exclude-by-file "**/Program.cs" `
  --does-not-return-attribute DoesNotReturnAttribute --include "[Churches.Server]*"

# Frontend LCOV: cd churches.client && npx vitest run --coverage
```

### When to build a truth table

The coverage **score is read from SonarCloud, never hand-maintained** here. Build a per-method table only when
SonarCloud flags a method with **cognitive complexity > 15 AND uncovered conditions > 0**. See
`../DESIGN-LANGUAGE.md` and `../TESTING-COVERAGE.md`.
