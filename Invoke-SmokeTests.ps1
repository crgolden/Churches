[CmdletBinding()]
param(
    [string] $BaseUrl = 'https://localhost:56432',
    [string] $Configuration = 'Debug'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$userSecretsId = 'c7445659-3c3d-4e0e-86ee-d983bd5c741f'

$secrets = dotnet user-secrets list --id $userSecretsId 2>$null |
    ForEach-Object {
        if ($_ -match '^(.+?)\s*=\s*(.+)$') { [pscustomobject]@{ Key = $Matches[1].Trim(); Value = $Matches[2].Trim() } }
    }

$adminEmail = ($secrets | Where-Object Key -eq 'AdminEmail').Value
$adminPassword = ($secrets | Where-Object Key -eq 'AdminPassword').Value

if (-not $adminEmail -or -not $adminPassword) {
    Write-Error "AdminEmail and AdminPassword not found in user secrets ($userSecretsId). Run: dotnet user-secrets set AdminEmail <email> --id $userSecretsId"
}

$env:AdminEmail = $adminEmail
$env:AdminPassword = $adminPassword
$env:SmokeBaseUrl = $BaseUrl

$exePath = Join-Path $PSScriptRoot "Churches.Tests\bin\$Configuration\net10.0\Churches.Tests.exe"

if (-not (Test-Path $exePath)) {
    Write-Host "Building Churches.Tests..."
    dotnet build "$PSScriptRoot\Churches.Tests\Churches.Tests.csproj" --configuration $Configuration
}

& $exePath -trait "Category=Smoke" -showLiveOutput
