param([string]$Goal, [string]$Only)

$ErrorActionPreference = 'Continue'
$gateCommon = $env:GATE_LIBRARY
if (-not $gateCommon -or -not (Test-Path -LiteralPath $gateCommon -PathType Leaf)) {
    Write-Host 'GATE: FAILED (GATE_LIBRARY names no gate library script; README.md, section Gate, says how to plug one in or run the steps without one)'
    exit 1
}
. $gateCommon
$gateOutput = if (Get-Command Get-GateOutputDirectory -ErrorAction SilentlyContinue) {
    Get-GateOutputDirectory (Split-Path -Leaf $PSScriptRoot)
} else {
    (New-Item -ItemType Directory -Force -Path (Join-Path ([IO.Path]::GetTempPath()) "claude\crgolden-gates\$(Split-Path -Leaf $PSScriptRoot)")).FullName
}
$GateDelta = @('plant:src/app/app.config.ts')

Register-GateStep @('node_modules install markers', 'npm run lint', 'npm run typecheck:e2e', 'npm run typecheck:spec',
    'npm run lint:css', 'npm run audit', 'Install Playwright browsers', 'Run unit tests with coverage', 'Fix LCOV paths', 'Run E2E tests',
    'Assert E2E executed at least its floor', 'Publish command reaches the CLI', 'Transfer-cache plant', 'npm run lint:utilities',
    'SonarCloud analysis', 'Fail on open Sonar issues', 'Build (production)')
Register-StepInput 'node_modules install markers' @('*')
Register-StepInput 'npm run lint' @('src/*', '*.ts', '*.mts', '*.js', '*.mjs', '*.cjs', 'eslint-sonar.rules.json', 'angular.json', 'tsconfig*.json', 'package.json', 'package-lock.json')
Register-StepInput 'npm run typecheck:e2e' @('src/*', 'e2e/*', 'integration/*', 'playwright.config.ts', 'tsconfig*.json', 'package.json', 'package-lock.json')
Register-StepInput 'npm run typecheck:spec' @('src/*', 'tsconfig*.json', 'package.json', 'package-lock.json')
Register-StepInput 'npm run lint:css' @('src/*', 'stylelint.config.mjs', 'package.json', 'package-lock.json', 'tools/stylelint/*')
Register-StepInput 'npm run audit' @('package.json', 'package-lock.json')
Register-StepInput 'Install Playwright browsers' @('*')
Register-StepInput 'Run unit tests with coverage' @('*', '!e2e/*', '!integration/*')
Register-StepInput 'Fix LCOV paths' @('*', '!e2e/*', '!integration/*')
Register-StepInput 'Run E2E tests' @('*', '!src/*.spec.ts')
Register-StepInput 'Assert E2E executed at least its floor' @('*', '!src/*.spec.ts')
Register-StepInput 'Publish command reaches the CLI' @('*')
Register-StepInput 'Transfer-cache plant' @('*', '!src/*.spec.ts')
Register-StepInput 'npm run lint:utilities' @('*')
Register-StepInput 'SonarCloud analysis' @('*')
Register-StepInput 'Fail on open Sonar issues' @('*')
Register-StepInput 'Build (production)' @('*')
Register-VolatileStep @('npm run audit')
$repo = $PSScriptRoot
$scratch = $gateOutput
$sonarBranch = Get-SonarBranchName
$unitStep = 'Run unit tests with coverage (npm run test:coverage)'
$e2eStep = 'Run E2E tests (npm run e2e)'
$sonarStep = "SonarCloud analysis (sonar-scanner, branch $sonarBranch, quality gate waited)"
$sonarIssues = 'Fail on open Sonar issues'
$env:TZ = 'UTC'
if ($env:TZ -ne 'UTC') { Write-Host 'GATE: FAILED (TZ pin)'; exit 1 }
Set-Location $repo
$probeRoots = @('src/', 'e2e/')
if ($Only) {
    $probeFile, $probeTest = $Only -split '::', 2
    $probeFile = "$probeFile".Trim().Replace('\', '/')
    $probeTest = "$probeTest".Trim()
    $probeRoot = $probeRoots | Where-Object { $probeFile.StartsWith($_, [StringComparison]::Ordinal) } | Select-Object -First 1
    if (-not $probeTest -or $probeTest.Contains(',') -or -not $probeRoot -or
            -not (Test-Path -LiteralPath (Join-Path $repo $probeFile) -PathType Leaf)) {
        Write-Host "PROBE: FAILED (a probe runs exactly one test, named by the file it lives in: -Only '<a test file under $($probeRoots -join ' | ')>::<the test's name>')"
        exit 1
    }
    $probeReport = Join-Path $gateOutput 'probe-report.json'
    if (Test-Path -LiteralPath $probeReport) { Remove-Item -LiteralPath $probeReport -Force }
    Write-Host "PROBE: running one test, '$probeTest' of $probeFile; no gate record or verdict is written"
    $global:LASTEXITCODE = $null
    if ($probeRoot -eq $probeRoots[0]) {
        npx vitest run $probeFile --coverage.enabled=false --reporter=json --outputFile="$probeReport" -t $probeTest
        $probeExit = $global:LASTEXITCODE
        if (-not (Test-Path -LiteralPath $probeReport)) { Write-Host "PROBE: FAILED (no JSON report, exit $probeExit)"; exit 1 }
        $report = Get-Content -LiteralPath $probeReport -Raw | ConvertFrom-Json
        $passed = [int]$report.numPassedTests
        $failed = [int]$report.numFailedTests
    }
    else {
        $env:PLAYWRIGHT_JSON_OUTPUT_NAME = $probeReport
        npx playwright test --project=e2e --no-deps --reporter=json --grep $probeTest
        $probeExit = $global:LASTEXITCODE
        Remove-Item Env:PLAYWRIGHT_JSON_OUTPUT_NAME -ErrorAction SilentlyContinue
        if (-not (Test-Path -LiteralPath $probeReport)) { Write-Host "PROBE: FAILED (no JSON report, exit $probeExit)"; exit 1 }
        $report = Get-Content -LiteralPath $probeReport -Raw | ConvertFrom-Json
        $passed = [int]$report.stats.expected
        $failed = [int]$report.stats.unexpected
    }
    if ($probeExit -ne 0 -or $passed -ne 1 -or $failed -ne 0) {
        Write-Host "PROBE: FAILED (a probe runs one test, and '$probeTest' passed $passed, failed $failed, exit $probeExit)"
        exit 1
    }
    Write-Host 'PROBE: PASSED for the one test named, against the last build; no verdict was saved'
    exit 0
}
exit (Invoke-Gate {
Initialize-GateState 'Churches' $repo
Get-OwedStep | Register-OwedStep
Invoke-GateLibraryStep

$markers = 'node_modules install markers'
Invoke-GateStep -Name $markers -Always -Body {
    $installed = (Test-Path (Join-Path $repo 'node_modules\.package-lock.json')) -and
        (Test-Path (Join-Path $repo 'node_modules\.bin\tsc.cmd')) -and (Test-Path (Join-Path $repo 'node_modules\.bin\vitest.cmd'))
    if (-not $installed) { Stop-Gate $markers 'incomplete install; run npm ci deliberately first' }
    Assert-NodeInstallCurrent $repo
    Write-Row $markers 'PASS' 'tsc.cmd, vitest.cmd present; every package matches package-lock.json'
}

Invoke-GateStep -Name 'npm run lint' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run lint
    Assert-StepExit 'npm run lint'
}
Invoke-GateStep -Name 'npm run typecheck:e2e' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run typecheck:e2e
    Assert-StepExit 'npm run typecheck:e2e'
}
Invoke-GateStep -Name 'npm run typecheck:spec' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run typecheck:spec
    Assert-StepExit 'npm run typecheck:spec'
}
Invoke-GateStep -Name 'npm run lint:css' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run lint:css
    Assert-StepExit 'npm run lint:css'
}
Invoke-GateStep -Name 'npm run audit' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run audit
    Assert-StepExit 'npm run audit'
}

$playwright = 'Install Playwright browsers (npm run playwright:install)'
Invoke-GateStep -Name $playwright -Needs @($markers) -Always -Body {
    Install-PlaywrightBrowser $playwright { npx playwright install --dry-run chromium } { npm run playwright:install }
}

Invoke-GateStep -Name $unitStep -Needs @($markers, $playwright) -Body {
    $global:LASTEXITCODE = $null
    npm run test:coverage
    Assert-StepExit $unitStep
}

$lcovStep = 'Fix LCOV paths for SonarQube'
Invoke-GateStep -Name $lcovStep -Needs @($unitStep) -Body {
    $lcov = Join-Path $repo 'coverage\lcov.info'
    if (-not (Test-Path $lcov)) { Stop-Gate $lcovStep 'coverage/lcov.info missing' }
    (Get-Content $lcov) -replace '\\', '/' | Set-Content $lcov
    Write-Row $lcovStep 'PASS' ''
}

$floorStep = 'Assert E2E executed at least its floor'
$results = Join-Path $repo 'playwright-results.xml'
$e2eRun = @{ Ran = $false }
Invoke-GateStep -Name $e2eStep -Needs @($markers, $playwright) -Body {
    $e2eRun.Ran = $true
    if (Test-Path $results) { Remove-Item $results -Force }
    $global:LASTEXITCODE = $null
    npm run e2e
    Assert-StepExit $e2eStep
}
if ($e2eRun.Ran) {
    Invoke-GateStep -Name $floorStep -Always -Body {
        if (-not (Test-Path $results)) { Stop-Gate $floorStep 'playwright-results.xml missing' }
        $floor = [int](Get-Content (Join-Path $repo 'e2e\e2e-settings.json') -Raw | ConvertFrom-Json).executedTestFloor
        $xml = [xml](Get-Content $results -Raw)
        $tests = [int]$xml.testsuites.tests
        $skipped = [int]$xml.testsuites.skipped
        $executed = $tests - $skipped
        if ($floor -le 0 -or $executed -lt $floor) { Stop-Gate $floorStep "executed $executed (tests $tests, skipped $skipped), floor $floor" }
        Write-Row $floorStep 'PASS' "executed $executed (tests $tests, skipped $skipped), floor $floor"
    }
}
elseif (@(Get-FailedStep -Step @($e2eStep)).Count) {
    Write-PrerequisiteUnreached -Step @($floorStep) -Failed @($e2eStep)
}

$publishStep = 'Publish command reaches the CLI (the workflow line run without GITHUB_RUN_ID must fail on the run identity, not on usage)'
Invoke-GateStep -Name $publishStep -Needs @($e2eStep) -Body {
    Test-PublishCommandLine $publishStep (Join-Path $repo '.github\workflows\main_crgolden-churches.yml') 'Churches' $repo `
        (Get-Content (Join-Path $repo 'e2e\e2e-settings.json') -Raw | ConvertFrom-Json).cucumberMessagesFile
}

$transferCacheStep = 'Transfer-cache plant (transfer cache switched off, the "Server-rendered pages" feature must fail its hydration scenario and pass its navigation control)'
Invoke-GateStep -Name $transferCacheStep -Needs @($markers, $playwright) -Body {
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
        npm run build:e2e
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
    npm run build:e2e
    if ($global:LASTEXITCODE -ne 0) { Stop-Gate $transferCacheStep "the rebuild after restoring app.config.ts exited $global:LASTEXITCODE" }
    if ($plantBuildExit -ne 0) { Stop-Gate $transferCacheStep "the planted build exited $plantBuildExit, so the spec never ran against the plant" }
    if (-not (Test-Path $transferCacheReport)) { Stop-Gate $transferCacheStep "no JSON report (exit $plantExit): the plant did not run" }
    $stats = (Get-Content $transferCacheReport -Raw | ConvertFrom-Json).stats
    $detail = "exit $plantExit, passed $($stats.expected), failed $($stats.unexpected), not run $($stats.skipped)"
    if ($plantExit -eq 0 -or $stats.unexpected -ne 1) { Stop-Gate $transferCacheStep "the hydration test did not go red alone: $detail" }
    if ($stats.expected -ne 1) { Stop-Gate $transferCacheStep "the navigation control did not pass under the plant: $detail" }
    Write-Row $transferCacheStep 'PASS' $detail
}

Invoke-GateStep -Name 'npm run lint:utilities' -Needs @($e2eStep) -Body {
    $global:LASTEXITCODE = $null
    npm run lint:utilities
    Assert-StepExit 'npm run lint:utilities'
}

if (Test-StepCarried $sonarIssues) {
    $null = Test-StepCarried $sonarStep
}
else {
    $sonarStartedAt = [DateTimeOffset]::UtcNow
    Invoke-GateStep -Name $sonarStep -Needs @($unitStep, $lcovStep) -Always -Body {
        $global:LASTEXITCODE = $null
        sonar-scanner -D"sonar.projectKey=crgolden_Churches" -D"sonar.organization=crgolden" -D"sonar.host.url=https://sonarcloud.io" -D"sonar.javascript.lcov.reportPaths=coverage/lcov.info" -D"sonar.exclusions=**/node_modules/**,**/*.d.ts,e2e/**,integration/**,.features-gen/**,instrumentation.mjs,**/*.spec.ts" -D"sonar.tests=src" -D"sonar.coverage.exclusions=e2e/**,integration/**,scripts/**,**/*.config.*,src/test-setup*.ts,gate.ps1,src/proxy.conf.js,src/environments/**,src/main.ts,src/main.server.ts,src/server.ts,src/app/app.routes.server.ts" -D"sonar.test.inclusions=**/*.spec.ts" -D"sonar.scanner.skipJreProvisioning=true" -D"sonar.scm.use.blame.algorithm=GIT_NATIVE_BLAME" -D"sonar.qualitygate.wait=true" -D"sonar.branch.name=$sonarBranch"
        Assert-StepExit $sonarStep
    }
    Invoke-GateStep -Name $sonarIssues -Needs @($sonarStep) -Always -Body {
        Assert-NoOpenSonarIssue $sonarIssues 'crgolden_Churches' $sonarBranch $sonarStartedAt
    }
}

Invoke-GateStep -Name 'Build (production)' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run build
    Assert-StepExit 'Build (production)'
}

Write-Row 'Publish E2E scenario results / upload / prune devDependencies / assemble / deploy' 'NOT RUN' 'delivery steps, not checks'
Complete-Gate
})
