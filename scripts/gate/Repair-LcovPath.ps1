$lcov = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'coverage\lcov.info'
if (-not (Test-Path -LiteralPath $lcov -PathType Leaf)) {
    Write-Host 'coverage/lcov.info missing'
    exit 1
}
(Get-Content -LiteralPath $lcov) -replace '\\', '/' | Set-Content -LiteralPath $lcov
exit 0
