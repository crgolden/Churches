param([string]$Goal)

$ErrorActionPreference = 'Continue'
$gateCommon = Join-Path $PSScriptRoot '..\Tools\Gates\GateCommon.ps1'
if (-not (Test-Path -LiteralPath $gateCommon)) {
    Write-Host "GATE: FAILED (the Tools repository must be cloned beside this one: $gateCommon)"
    exit 1
}
. $gateCommon
$gateOutput = Join-Path ([IO.Path]::GetTempPath()) "crgolden-gates\$(Split-Path -Leaf $PSScriptRoot)"
New-Item -ItemType Directory -Force -Path $gateOutput | Out-Null
$GateDelta = @('plant:src/zz-bail-plant.spec.ts', 'plant:integration/zz-maxfail-plant.spec.ts', 'plant:src/app/app.config.ts')

Register-GateSteps @('node_modules install markers', 'npm run lint', 'npm run typecheck:e2e', 'npm run typecheck:spec',
    'npm run lint:css', 'Install Playwright browsers', 'Run unit tests with coverage', 'Vitest bail plant', 'Fix LCOV paths', 'Run E2E tests',
    'Assert E2E executed at least its floor', 'Playwright max-failures plant', 'Transfer-cache plant', 'npm run lint:utilities',
    'SonarCloud analysis', 'Fail on open Sonar issues', 'Build (production)')
$repo = $PSScriptRoot
$scratch = $gateOutput
$bailReport = Join-Path $scratch 'churches-bail-plant.json'
$maxFailReport = Join-Path $scratch 'churches-maxfail-plant.json'
$bailPlant = Join-Path $repo 'src\zz-bail-plant.spec.ts'
$maxFailPlant = Join-Path $repo 'integration\zz-maxfail-plant.spec.ts'
$plantedFailures = 3
$sonarBranch = "branch-local-$($env:COMPUTERNAME.ToLowerInvariant())"
$unitStep = 'Run unit tests with coverage (npm run test:coverage)'
$e2eStep = 'Run E2E tests (npm run e2e, CI=true)'
$sonarStep = "SonarCloud analysis (sonar-scanner, branch $sonarBranch, quality gate waited)"
$sonarIssues = 'Fail on open Sonar issues'
$env:TZ = 'UTC'
$env:CI = 'true'
if ($env:TZ -ne 'UTC') { Write-Host 'GATE: FAILED (TZ pin)'; exit 1 }
Set-Location $repo
Initialize-GateState 'Churches' $repo
Invoke-CatalogSteps

$installed = (Test-Path (Join-Path $repo 'node_modules\.package-lock.json')) -and
    (Test-Path (Join-Path $repo 'node_modules\.bin\tsc.cmd')) -and (Test-Path (Join-Path $repo 'node_modules\.bin\vitest.cmd'))
if (-not $installed) { Stop-Gate 'node_modules install markers' 'incomplete install; run npm ci deliberately first' }
Write-Row 'node_modules install markers' 'PASS' '.package-lock.json, tsc.cmd, vitest.cmd present'

if (-not (Test-StepCarried 'npm run lint')) {
    $global:LASTEXITCODE = $null
    npm run lint
    $null = Test-Exit 'npm run lint'
}
if (-not (Test-StepCarried 'npm run typecheck:e2e')) {
    $global:LASTEXITCODE = $null
    npm run typecheck:e2e
    $null = Test-Exit 'npm run typecheck:e2e'
}
if (-not (Test-StepCarried 'npm run typecheck:spec')) {
    $global:LASTEXITCODE = $null
    npm run typecheck:spec
    $null = Test-Exit 'npm run typecheck:spec'
}
if (-not (Test-StepCarried 'npm run lint:css')) {
    $global:LASTEXITCODE = $null
    npm run lint:css
    $null = Test-Exit 'npm run lint:css'
}

Install-PlaywrightBrowsers 'Install Playwright browsers (npm run playwright:install)' { npx playwright install --dry-run chromium } { npm run playwright:install }

if (-not (Test-StepCarried $unitStep)) {
    $global:LASTEXITCODE = $null
    npm run test:coverage
    $null = Test-Exit $unitStep
}

$bailStep = "Vitest bail plant ($plantedFailures failing tests planted, bail: 1 must stop the run before the second)"
if (-not (Test-StepCarried $bailStep)) {
    $cases = 1..$plantedFailures | ForEach-Object { "  it('planted failure $_', () => { expect(true).toBe(false); });" }
    Set-Content -Path $bailPlant -Value (@("describe('bail plant', () => {") + $cases + @('});'))
    if (Test-Path $bailReport) { Remove-Item $bailReport -Force }
    try {
        $global:LASTEXITCODE = $null
        npx vitest run src/zz-bail-plant.spec.ts --coverage.enabled=false --reporter=json --outputFile="$bailReport"
        $plantExit = $global:LASTEXITCODE
    }
    finally { Remove-Item $bailPlant -Force -ErrorAction SilentlyContinue }
    if (Test-Path $bailPlant) { Stop-Gate $bailStep 'the plant file could not be removed' }
    if (-not (Test-Path $bailReport)) { Stop-Gate $bailStep "no JSON report (exit $plantExit): the plant did not run" }
    $report = Get-Content $bailReport -Raw | ConvertFrom-Json
    $detail = "exit $plantExit, collected $($report.numTotalTests), failed $($report.numFailedTests)"
    if ($report.numTotalTests -ne $plantedFailures) { Stop-Gate $bailStep "the plant did not apply: $detail" }
    if ($plantExit -eq 0 -or $report.numFailedTests -lt 1) { Stop-Gate $bailStep "the planted failures did not fail the run: $detail" }
    if ($report.numFailedTests -ge $plantedFailures) { Stop-Gate $bailStep "bail did not stop the run: $detail" }
    Write-Row $bailStep 'PASS' $detail
}

if (-not (Test-StepCarried 'Fix LCOV paths for SonarQube')) {
    $lcov = Join-Path $repo 'coverage\lcov.info'
    if (-not (Test-Path $lcov)) { Stop-Gate 'Fix LCOV paths for SonarQube' 'coverage/lcov.info missing' }
    (Get-Content $lcov) -replace '\\', '/' | Set-Content $lcov
    Write-Row 'Fix LCOV paths for SonarQube' 'PASS' ''
}

if (-not (Test-StepCarried $e2eStep)) {
    $results = Join-Path $repo 'playwright-results.xml'
    if (Test-Path $results) { Remove-Item $results -Force }
    $global:LASTEXITCODE = $null
    npm run e2e
    $null = Test-Exit $e2eStep
    $floorStep = 'Assert E2E executed at least its floor'
    if (-not (Test-Path $results)) { Stop-Gate $floorStep 'playwright-results.xml missing' }
    $floor = [int](Get-Content (Join-Path $repo 'e2e\e2e-settings.json') -Raw | ConvertFrom-Json).executedTestFloor
    $xml = [xml](Get-Content $results -Raw)
    $tests = [int]$xml.testsuites.tests
    $skipped = [int]$xml.testsuites.skipped
    $executed = $tests - $skipped
    if ($floor -le 0 -or $executed -lt $floor) { Stop-Gate $floorStep "executed $executed (tests $tests, skipped $skipped), floor $floor" }
    Write-Row $floorStep 'PASS' "executed $executed (tests $tests, skipped $skipped), floor $floor"
}

$maxFailStep = "Playwright max-failures plant ($plantedFailures failing tests planted, --max-failures=1 must stop the run)"
if (-not (Test-StepCarried $maxFailStep)) {
    $e2eScript = (Get-Content (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json).scripts.e2e
    if ($e2eScript -notmatch '--max-failures=1\b') { Stop-Gate $maxFailStep "package.json's e2e script does not carry --max-failures=1: $e2eScript" }
    $cases = 1..$plantedFailures | ForEach-Object { "test('planted failure $_', () => { expect(true).toBe(false); });" }
    Set-Content -Path $maxFailPlant -Value (@("import { expect, test } from '@playwright/test';", '') + $cases)
    if (Test-Path $maxFailReport) { Remove-Item $maxFailReport -Force }
    $env:PLAYWRIGHT_JSON_OUTPUT_NAME = $maxFailReport
    try {
        $global:LASTEXITCODE = $null
        npx playwright test integration/zz-maxfail-plant.spec.ts --project=integration --max-failures=1 --reporter=json
        $plantExit = $global:LASTEXITCODE
    }
    finally {
        Remove-Item $maxFailPlant -Force -ErrorAction SilentlyContinue
        Remove-Item Env:PLAYWRIGHT_JSON_OUTPUT_NAME -ErrorAction SilentlyContinue
    }
    if (Test-Path $maxFailPlant) { Stop-Gate $maxFailStep 'the plant file could not be removed' }
    if (-not (Test-Path $maxFailReport)) { Stop-Gate $maxFailStep "no JSON report (exit $plantExit): the plant did not run" }
    $stats = (Get-Content $maxFailReport -Raw | ConvertFrom-Json).stats
    $collected = $stats.expected + $stats.unexpected + $stats.skipped + $stats.flaky
    $detail = "exit $plantExit, collected $collected, failed $($stats.unexpected), not run $($stats.skipped)"
    if ($collected -ne $plantedFailures) { Stop-Gate $maxFailStep "the plant did not apply: $detail" }
    if ($plantExit -eq 0 -or $stats.unexpected -lt 1) { Stop-Gate $maxFailStep "the planted failures did not fail the run: $detail" }
    if ($stats.unexpected -ge $plantedFailures) { Stop-Gate $maxFailStep "max-failures did not stop the run: $detail" }
    Write-Row $maxFailStep 'PASS' $detail
}

$transferCacheStep = 'Transfer-cache plant (transfer cache switched off, the "Server-rendered pages" feature must fail its hydration scenario and pass its navigation control)'
if (-not (Test-StepCarried $transferCacheStep)) {
    $appConfig = Join-Path $repo 'src\app\app.config.ts'
    $transferCacheReport = Join-Path $scratch 'churches-transfer-cache-plant.json'
    $original = [IO.File]::ReadAllText($appConfig)
    $cacheOptions = 'withHttpTransferCacheOptions({ includeRequestsWithCredentials: true, includeRequestsWithAuthHeaders: true })'
    $planted = $original.Replace($cacheOptions, 'withNoHttpTransferCache()').Replace('withHttpTransferCacheOptions,', 'withNoHttpTransferCache,')
    if ($planted.Contains('withHttpTransferCacheOptions') -or -not $planted.Contains('withNoHttpTransferCache()')) {
        Stop-Gate $transferCacheStep 'the plant did not apply: app.config.ts no longer carries the transfer-cache options this step replaces'
    }
    [IO.File]::WriteAllText($appConfig, $planted)
    if (Test-Path $transferCacheReport) { Remove-Item $transferCacheReport -Force }
    $env:PLAYWRIGHT_JSON_OUTPUT_NAME = $transferCacheReport
    try {
        $global:LASTEXITCODE = $null
        npm run build:ci
        $plantBuildExit = $global:LASTEXITCODE
        $global:LASTEXITCODE = $null
        npx playwright test --project=e2e --no-deps --reporter=json --grep "Server-rendered pages"
        $plantExit = $global:LASTEXITCODE
    }
    finally {
        [IO.File]::WriteAllText($appConfig, $original)
        Remove-Item Env:PLAYWRIGHT_JSON_OUTPUT_NAME -ErrorAction SilentlyContinue
    }
    if ([IO.File]::ReadAllText($appConfig) -ne $original) { Stop-Gate $transferCacheStep 'app.config.ts was not restored' }
    $global:LASTEXITCODE = $null
    npm run build:ci
    if ($global:LASTEXITCODE -ne 0) { Stop-Gate $transferCacheStep "the rebuild after restoring app.config.ts exited $global:LASTEXITCODE" }
    if ($plantBuildExit -ne 0) { Stop-Gate $transferCacheStep "the planted build exited $plantBuildExit, so the spec never ran against the plant" }
    if (-not (Test-Path $transferCacheReport)) { Stop-Gate $transferCacheStep "no JSON report (exit $plantExit): the plant did not run" }
    $stats = (Get-Content $transferCacheReport -Raw | ConvertFrom-Json).stats
    $detail = "exit $plantExit, passed $($stats.expected), failed $($stats.unexpected), not run $($stats.skipped)"
    if ($plantExit -eq 0 -or $stats.unexpected -ne 1) { Stop-Gate $transferCacheStep "the hydration test did not go red alone: $detail" }
    if ($stats.expected -ne 1) { Stop-Gate $transferCacheStep "the navigation control did not pass under the plant: $detail" }
    Write-Row $transferCacheStep 'PASS' $detail
}

if (-not (Test-StepCarried 'npm run lint:utilities')) {
    $global:LASTEXITCODE = $null
    npm run lint:utilities
    $null = Test-Exit 'npm run lint:utilities'
}

if (Test-StepCarried $sonarIssues) {
    $null = Test-StepCarried $sonarStep
}
else {
    $sonarStartedAt = [DateTimeOffset]::UtcNow
    $env:JAVA_HOME = "$env:SystemDrive\sonar-scanner-8.0.1.6346-windows-x64\jre"
    $global:LASTEXITCODE = $null
    sonar-scanner -D"sonar.projectKey=crgolden_Churches" -D"sonar.organization=crgolden" -D"sonar.host.url=https://sonarcloud.io" -D"sonar.javascript.lcov.reportPaths=coverage/lcov.info" -D"sonar.exclusions=**/node_modules/**,**/*.d.ts,e2e/**,integration/**,.features-gen/**,instrumentation.mjs,**/*.spec.ts" -D"sonar.tests=src" -D"sonar.coverage.exclusions=e2e/**,integration/**,scripts/**,**/*.config.*,src/test-setup*.ts,gate.ps1,src/proxy.conf.js,src/environments/**,src/main.ts,src/main.server.ts,src/server.ts,src/app/app.routes.server.ts" -D"sonar.test.inclusions=**/*.spec.ts" -D"sonar.scanner.skipJreProvisioning=true" -D"sonar.qualitygate.wait=true" -D"sonar.branch.name=$sonarBranch"
    $null = Test-Exit $sonarStep
    Test-SonarIssues $sonarIssues 'crgolden_Churches' $sonarBranch $sonarStartedAt
}

if (-not (Test-StepCarried 'Build (production)')) {
    $global:LASTEXITCODE = $null
    npm run build
    $null = Test-Exit 'Build (production)'
}

Write-Row 'Publish E2E scenario results / upload / prune devDependencies / assemble / deploy' 'NOT RUN' 'delivery steps, not checks'
Complete-Gate
