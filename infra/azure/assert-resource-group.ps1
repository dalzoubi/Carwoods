param(
    [string] $ExpectedName = 'carwoods.com',
    [string] $ActualName = $env:AZURE_RESOURCE_GROUP
)

if (-not $ActualName) {
    Write-Error 'AZURE_RESOURCE_GROUP is not set. Expected resource group name for deployment.'
    exit 1
}

if ($ActualName -ne $ExpectedName) {
    Write-Error "AZURE_RESOURCE_GROUP is '$ActualName' but must be '$ExpectedName' for this project."
    exit 1
}

Write-Host "Resource group check OK: $ExpectedName"
