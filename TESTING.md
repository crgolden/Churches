# Churches Testing

## Unit Tests

Run directly against the compiled test exe (no live servers needed):

```powershell
cd Churches
dotnet build Churches.Tests
.\Churches.Tests\bin\Debug\net10.0\Churches.Tests.exe -trait "Category=Unit" -showLiveOutput
```

## E2E Tests (Regression)

No live servers needed. The factory serves the Angular production build; all BFF and API calls are Playwright route mocks.

**Prerequisites (one-time):**

```powershell
# 1. Build Angular production output
cd churches.client
npm run build
cd ..

# 2. Install Playwright Chromium browser
pwsh Churches.Tests\bin\Debug\net10.0\playwright.ps1 install chromium
```

**Run:**

```powershell
dotnet build Churches.Tests
.\Churches.Tests\bin\Debug\net10.0\Churches.Tests.exe -trait "Category=E2E" -showLiveOutput
```

Artifacts (screenshots, trace, video) for failed tests are written to:
`Churches.Tests\bin\Debug\net10.0\TestResults\PlaywrightArtifacts\E2E\`

## Smoke Tests (Post-Deploy)

Requires all 4 servers running and test credentials set. Uses the real Identity server login flow.

**Servers required:**
- `dotnet run --project Churches.Api` (API `https://localhost:7002`)
- `dotnet run --project Churches.Server` (BFF `https://localhost:7135`)
- `dotnet run` in Identity project (Identity `https://localhost:7261`)
- `npm start` in `churches.client/` (SPA `https://localhost:56432`)

Or against the deployed app, set `SmokeBaseUrl` to the deployed URL.

**Run:**

```powershell
.\Invoke-SmokeTests.ps1
```

Or targeting a specific deployed URL:

```powershell
.\Invoke-SmokeTests.ps1 -BaseUrl https://your-churches-app.azurewebsites.net
```

Credentials are read from `Churches.Server` user secrets (`c7445659-3c3d-4e0e-86ee-d983bd5c741f`).
Keys: `AdminEmail`, `AdminPassword`.

## Local SonarCloud analysis

Two SonarCloud projects share the one `Churches.Tests` project: `crgolden-directory` (the
`Churches.Api` minimal API) and `crgolden-churches` (the `Churches.Server` BFF + Angular client). Unit
coverage is OpenCover (branch-bearing, via `coverlet.console` pinned in `dotnet-tools.json` — restore
with `dotnet tool restore`); integration coverage stays VS Coverage XML. The `--include` filter selects
which assembly each project measures.

```powershell
dotnet build Churches.slnx --configuration Release
dotnet tool restore

# Churches.Api unit coverage (crgolden-directory)
dotnet coverlet Churches.Tests\bin\Release\net10.0 `
  --target "dotnet" `
  --targetargs "test --project Churches.Tests --no-build --configuration Release -- --filter-trait Category=Unit" `
  --format opencover --output "coverage.opencover.xml" `
  --skipautoprops --exclude-by-attribute GeneratedCodeAttribute `
  --exclude-by-file "**/obj/**" --exclude-by-file "**/Program.cs" `
  --does-not-return-attribute DoesNotReturnAttribute --include "[Churches.Api]*"
# For the crgolden-churches BFF project swap the include to --include "[Churches.Server]*"
# (its C# surface is a composition root; the real client logic is the Angular Vitest/LCOV suite).
```

Sonar `begin` uses `-Dsonar.cs.opencover.reportsPaths=coverage.opencover.xml` for unit and
`-Dsonar.cs.vscoveragexml.reportsPaths=coverage-integration.xml` for the `Churches.Api` integration run
(see `.github/workflows/main_crgolden-directory.yml`).

### When to build a truth table

The coverage **score is read from SonarCloud, never hand-maintained** here. Build a per-method table in `COVERAGE-TRUTH-TABLES.md` only when SonarCloud flags a method with **cognitive complexity > 15 AND uncovered conditions > 0**. See `../DESIGN-LANGUAGE.md` and `../TESTING-COVERAGE.md`.
