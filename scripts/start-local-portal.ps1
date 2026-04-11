param(
    [switch]$SkipMigrations,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$apiDir = Join-Path $repoRoot "apps/api"
$envExamplePath = Join-Path $repoRoot ".env.portal.local.example"
$envLocalPath = Join-Path $repoRoot ".env.portal.local"
$apiLocalSettingsPath = Join-Path $apiDir "local.settings.json"
$apiLocalSettingsExamplePath = Join-Path $apiDir "local.settings.json.example"

function Invoke-Step {
    param(
        [string]$Message,
        [scriptblock]$Action
    )

    Write-Host "==> $Message" -ForegroundColor Cyan
    if ($DryRun) {
        return
    }
    & $Action
}

function Ensure-Tool {
    param([string]$ToolName)
    if (-not (Get-Command $ToolName -ErrorAction SilentlyContinue)) {
        throw "Required tool '$ToolName' is not available in PATH."
    }
}

function Ensure-LocalEnvFiles {
    if (-not (Test-Path $envLocalPath)) {
        Copy-Item $envExamplePath $envLocalPath
        Write-Host "Created $envLocalPath from example." -ForegroundColor Green
    } else {
        Write-Host "Using existing $envLocalPath." -ForegroundColor Green
    }

    if (-not (Test-Path $apiLocalSettingsPath)) {
        Copy-Item $apiLocalSettingsExamplePath $apiLocalSettingsPath
        Write-Host "Created $apiLocalSettingsPath from example." -ForegroundColor Green
    } else {
        Write-Host "Using existing $apiLocalSettingsPath." -ForegroundColor Green
    }
}

function Start-DevWindows {
    $apiCmd = "cd `"$apiDir`"; npm install; npm run build; npm start"
    $spaCmd = "cd `"$repoRoot`"; npm install; npm run dev:portal"

    Start-Process powershell -ArgumentList "-NoExit", "-NoProfile", "-Command", $apiCmd | Out-Null
    Start-Process powershell -ArgumentList "-NoExit", "-NoProfile", "-Command", $spaCmd | Out-Null
}

Ensure-Tool -ToolName "npm"
Ensure-Tool -ToolName "powershell"

Invoke-Step -Message "Ensuring separate local env files" -Action {
    Ensure-LocalEnvFiles
}

if (-not $SkipMigrations) {
    Invoke-Step -Message "Applying API database migrations (using configured DATABASE_URL)" -Action {
        npm --prefix $apiDir run db:migrate:local
        if ($LASTEXITCODE -ne 0) {
            throw "Database migration runner failed."
        }
    }
} else {
    Write-Host "Skipping migrations." -ForegroundColor Yellow
}

Invoke-Step -Message "Starting API and SPA dev servers in separate windows" -Action {
    Start-DevWindows
}

Write-Host ""
Write-Host "Local portal stack launched." -ForegroundColor Green
Write-Host "Use: npm run dev:portal:local" -ForegroundColor Green
