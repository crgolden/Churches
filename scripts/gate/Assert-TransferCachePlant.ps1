param([Parameter(Mandatory)][string]$ReportPath)

function Stop-Plant([string]$Reason) {
    Write-Host $Reason
    exit 1
}

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$appConfig = Join-Path $repo 'src\app\app.config.ts'
$original = [IO.File]::ReadAllText($appConfig)
$cacheOptions = 'withHttpTransferCacheOptions({ includeRequestsWithCredentials: true, includeRequestsWithAuthHeaders: true })'
$planted = $original.Replace($cacheOptions, 'withNoHttpTransferCache()').Replace('withHttpTransferCacheOptions,', 'withNoHttpTransferCache,')
if ($planted.Contains('withHttpTransferCacheOptions') -or -not $planted.Contains('withNoHttpTransferCache()')) {
    Stop-Plant 'the plant did not apply: app.config.ts no longer carries the transfer-cache options this step replaces'
}
Set-Location -LiteralPath $repo
[IO.File]::WriteAllText($appConfig, $planted)
if (Test-Path -LiteralPath $ReportPath) { Remove-Item -LiteralPath $ReportPath -Force }
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = $ReportPath
try {
    $global:LASTEXITCODE = $null
    npm run build:e2e
    $plantBuildExit = $global:LASTEXITCODE
    $global:LASTEXITCODE = $null
    npx playwright test --project=e2e --no-deps --reporter=json --grep 'Server-rendered pages'
    $plantExit = $global:LASTEXITCODE
}
finally {
    [IO.File]::WriteAllText($appConfig, $original)
    Remove-Item Env:PLAYWRIGHT_JSON_OUTPUT_NAME -ErrorAction SilentlyContinue
}
if ([IO.File]::ReadAllText($appConfig) -ne $original) { Stop-Plant 'app.config.ts was not restored' }
$global:LASTEXITCODE = $null
npm run build:e2e
if ($global:LASTEXITCODE -ne 0) { Stop-Plant "the rebuild after restoring app.config.ts exited $global:LASTEXITCODE" }
if ($plantBuildExit -ne 0) { Stop-Plant "the planted build exited $plantBuildExit, so the spec never ran against the plant" }
if (-not (Test-Path -LiteralPath $ReportPath)) { Stop-Plant "no JSON report (exit $plantExit): the plant did not run" }
$stats = (Get-Content -LiteralPath $ReportPath -Raw | ConvertFrom-Json).stats
$detail = "exit $plantExit, passed $($stats.expected), failed $($stats.unexpected), not run $($stats.skipped)"
if ($plantExit -eq 0 -or $stats.unexpected -ne 1) { Stop-Plant "the hydration test did not go red alone: $detail" }
if ($stats.expected -ne 1) { Stop-Plant "the navigation control did not pass under the plant: $detail" }
Write-Host $detail
exit 0
