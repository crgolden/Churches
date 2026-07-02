[CmdletBinding()]
param(
    [string] $BaseUrl = 'https://crgolden-churches.azurewebsites.net'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$env:SmokeBaseUrl = $BaseUrl

Push-Location $PSScriptRoot
try {
    npm run e2e:smoke
}
finally {
    Pop-Location
}
