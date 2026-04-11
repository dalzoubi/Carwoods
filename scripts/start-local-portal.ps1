param(
    [string]$SqlContainerName = "carwoods-sql",
    [string]$SqlImage = "",
    [string]$SqlFallbackImage = "mcr.microsoft.com/azure-sql-edge:latest",
    [string]$SqlDatabaseName = "carwoods_portal",
    [string]$SqlSaPassword = "YourStrong!Pass123",
    [switch]$SkipMigrations,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
    # Avoid turning native-command stderr (for example container stderr from `docker logs`)
    # into terminating PowerShell errors. We handle native command failures via $LASTEXITCODE.
    $PSNativeCommandUseErrorActionPreference = $false
}

$sqlImageProvidedByUser = -not [string]::IsNullOrWhiteSpace($SqlImage)
$isWindowsHost = $env:OS -eq "Windows_NT"
if ([string]::IsNullOrWhiteSpace($SqlImage)) {
    if ($isWindowsHost) {
        $SqlImage = "mcr.microsoft.com/mssql/server:2019-latest"
    } else {
        $SqlImage = "mcr.microsoft.com/mssql/server:2022-latest"
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$apiDir = Join-Path $repoRoot "apps/api"
$migrationsDir = Join-Path $repoRoot "infra/db/migrations"
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

function Get-ContainerStatus {
    param([string]$ContainerName)
    $status = docker inspect --format "{{.State.Status}}" $ContainerName 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    return ($status | Out-String).Trim()
}

function Get-ContainerExitCode {
    param([string]$ContainerName)
    $exitCode = docker inspect --format "{{.State.ExitCode}}" $ContainerName 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    return ($exitCode | Out-String).Trim()
}

function Get-ContainerImage {
    param([string]$ContainerName)
    $image = docker inspect --format "{{.Config.Image}}" $ContainerName 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    return ($image | Out-String).Trim()
}

function Get-ContainerLogsTail {
    param(
        [string]$ContainerName,
        [int]$Tail = 60
    )
    $logs = & docker logs --tail $Tail $ContainerName 2>&1
    if ($LASTEXITCODE -ne 0) {
        return "Unable to read docker logs."
    }
    $text = ($logs | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($text)) {
        return "No container logs were emitted."
    }
    return $text
}

function Get-SqlImageRunArgs {
    param([string]$ImageName)
    if ($ImageName -like "mcr.microsoft.com/mssql/server:*") {
        return @("--platform", "linux/amd64")
    }
    return @()
}

function Get-DockerArch {
    $arch = docker info --format "{{.Architecture}}" 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    return ($arch | Out-String).Trim()
}

function Assert-SupportedSqlImageForDockerArch {
    param([string]$ImageName)
    $dockerArch = Get-DockerArch
    if ([string]::IsNullOrWhiteSpace($dockerArch)) {
        return
    }

    if ($dockerArch -eq "aarch64" -and (
        $ImageName -like "mcr.microsoft.com/mssql/server:*" -or
        $ImageName -like "mcr.microsoft.com/azure-sql-edge:*"
    )) {
        throw @"
Docker engine architecture '$dockerArch' is not compatible with '$ImageName' in this setup.
SQL Server containers are crashing with exit code 139 on this host.

Use one of these options:
  1) Run this script on an x64 Docker host.
  2) Point API to an existing SQL Server/Azure SQL instance by editing:
     apps/api/local.settings.json -> Values.DATABASE_URL
     then run: npm run dev:portal
"@
    }
}

function New-SqlContainer {
    param(
        [string]$ContainerName,
        [string]$ImageName
    )
    $runArgs = @(
        "run",
        "--name", $ContainerName
    )
    $runArgs += Get-SqlImageRunArgs -ImageName $ImageName
    $runArgs += @(
        "--ulimit", "stack=8192:8192",
        "-e", "ACCEPT_EULA=Y",
        "-e", "MSSQL_SA_PASSWORD=$SqlSaPassword",
        "-p", "1433:1433",
        "-d",
        $ImageName
    )
    Assert-SupportedSqlImageForDockerArch -ImageName $ImageName
    & docker @runArgs | Out-Null
    return $LASTEXITCODE
}

function Try-FallbackSqlImage {
    param(
        [string]$ContainerName,
        [string]$Context
    )

    if ($sqlImageProvidedByUser) {
        return $false
    }
    if ([string]::IsNullOrWhiteSpace($SqlFallbackImage)) {
        return $false
    }
    if ($SqlImage -eq $SqlFallbackImage) {
        return $false
    }

    $status = Get-ContainerStatus -ContainerName $ContainerName
    $exitCode = Get-ContainerExitCode -ContainerName $ContainerName
    if ($status -ne "exited" -or $exitCode -ne "139") {
        return $false
    }

    Write-Host "SQL image '$SqlImage' crashed with exit code 139 while $Context." -ForegroundColor Yellow
    Write-Host "Attempting automatic fallback image '$SqlFallbackImage'." -ForegroundColor Yellow
    docker rm -f $ContainerName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to remove SQL container '$ContainerName' before fallback image retry."
    }

    $createExitCode = New-SqlContainer -ContainerName $ContainerName -ImageName $SqlFallbackImage
    if ($createExitCode -ne 0) {
        throw "Failed to create SQL container '$ContainerName' from fallback image '$SqlFallbackImage'."
    }
    $script:SqlImage = $SqlFallbackImage
    Write-Host "Recreated SQL container '$ContainerName' from fallback image '$SqlFallbackImage'." -ForegroundColor Green
    Start-Sleep -Seconds 1

    return $true
}

function Throw-ContainerNotRunning {
    param(
        [string]$ContainerName,
        [string]$Context
    )
    $status = Get-ContainerStatus -ContainerName $ContainerName
    $exitCode = Get-ContainerExitCode -ContainerName $ContainerName
    $logsTail = Get-ContainerLogsTail -ContainerName $ContainerName -Tail 60
    $fallbackHint = ""
    if ($logsTail -match "Invalid mapping of address") {
        $fallbackHint = @"

Detected SQL Server startup memory-mapping crash.
Try the 2019 image:
  1) docker rm $ContainerName
  2) npm run dev:portal:local -- -SqlImage mcr.microsoft.com/mssql/server:2019-latest
"@
    }

    throw @"
SQL container '$ContainerName' is not running while $Context.
Current status: $status
Exit code: $exitCode
$fallbackHint

Last container logs:
$logsTail
"@
}

function Start-SqlContainer {
    $existingName = docker ps -a --filter "name=^/$SqlContainerName$" --format "{{.Names}}"
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to query Docker containers. Is Docker Desktop running?"
    }

    if ([string]::IsNullOrWhiteSpace($existingName)) {
        $createExitCode = New-SqlContainer -ContainerName $SqlContainerName -ImageName $SqlImage
        if ($createExitCode -ne 0) {
            throw "Failed to create SQL container '$SqlContainerName'."
        }
        Write-Host "Created SQL container '$SqlContainerName' from image '$SqlImage'." -ForegroundColor Green
    } else {
        $existingImage = Get-ContainerImage -ContainerName $SqlContainerName
        if ([string]::IsNullOrWhiteSpace($existingImage)) {
            throw "Unable to determine image for SQL container '$SqlContainerName'."
        }

        if ($existingImage -ne $SqlImage) {
            Write-Host "SQL container '$SqlContainerName' uses image '$existingImage' but requested image is '$SqlImage'." -ForegroundColor Yellow
            Write-Host "Recreating '$SqlContainerName' with requested image (existing container will be removed)." -ForegroundColor Yellow
            docker rm -f $SqlContainerName | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to remove SQL container '$SqlContainerName' for image switch."
            }
            $createExitCode = New-SqlContainer -ContainerName $SqlContainerName -ImageName $SqlImage
            if ($createExitCode -ne 0) {
                throw "Failed to recreate SQL container '$SqlContainerName' with image '$SqlImage'."
            }
            Write-Host "Recreated SQL container '$SqlContainerName' from image '$SqlImage'." -ForegroundColor Green
            Start-Sleep -Seconds 1
            $status = Get-ContainerStatus -ContainerName $SqlContainerName
            if ($status -ne "running") {
                $didFallback = Try-FallbackSqlImage -ContainerName $SqlContainerName -Context "starting SQL Server"
                if ($didFallback) {
                    $status = Get-ContainerStatus -ContainerName $SqlContainerName
                }
            }
            if ($status -ne "running") {
                Throw-ContainerNotRunning -ContainerName $SqlContainerName -Context "starting SQL Server"
            }
            return
        }

        $runningName = docker ps --filter "name=^/$SqlContainerName$" --format "{{.Names}}"
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to query running Docker containers."
        }
        if ([string]::IsNullOrWhiteSpace($runningName)) {
            docker start $SqlContainerName | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to start SQL container '$SqlContainerName'."
            }
            Write-Host "Started SQL container '$SqlContainerName'." -ForegroundColor Green
        } else {
            Write-Host "SQL container '$SqlContainerName' is already running." -ForegroundColor Green
        }
    }

    Start-Sleep -Seconds 1
    $status = Get-ContainerStatus -ContainerName $SqlContainerName
    if ($status -ne "running") {
        $didFallback = Try-FallbackSqlImage -ContainerName $SqlContainerName -Context "starting SQL Server"
        if ($didFallback) {
            $status = Get-ContainerStatus -ContainerName $SqlContainerName
        }
    }
    if ($status -ne "running") {
        Throw-ContainerNotRunning -ContainerName $SqlContainerName -Context "starting SQL Server"
    }
}

function Wait-ForSqlReady {
    $maxAttempts = 24
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        $status = Get-ContainerStatus -ContainerName $SqlContainerName
        if ($status -ne "running") {
            Throw-ContainerNotRunning -ContainerName $SqlContainerName -Context "waiting for SQL readiness (attempt $attempt/$maxAttempts)"
        }

        docker exec $SqlContainerName /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $SqlSaPassword -C -Q "SELECT 1" *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "SQL container is ready." -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "SQL container did not become ready in time."
}

function Ensure-DbAndMigrations {
    docker exec $SqlContainerName /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $SqlSaPassword -C -Q "IF DB_ID('$SqlDatabaseName') IS NULL CREATE DATABASE [$SqlDatabaseName];" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create or verify database '$SqlDatabaseName'."
    }

    if ($SkipMigrations) {
        Write-Host "Skipping migrations." -ForegroundColor Yellow
        return
    }

    $migrationFiles = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name
    foreach ($file in $migrationFiles) {
        $containerMigrationPath = "/tmp/$($file.Name)"
        docker cp $file.FullName "${SqlContainerName}:$containerMigrationPath" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to copy migration '$($file.Name)' into container."
        }

        docker exec $SqlContainerName /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $SqlSaPassword -C -d $SqlDatabaseName -i $containerMigrationPath | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to apply migration '$($file.Name)'."
        }
    }

    Write-Host "Applied migrations in $migrationsDir." -ForegroundColor Green
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

function Update-ApiDatabaseUrl {
    $raw = Get-Content $apiLocalSettingsPath -Raw
    $pattern = '"DATABASE_URL"\s*:\s*"[^"]*"'
    $replacement = '"DATABASE_URL": "Server=localhost,1433;Database=' + $SqlDatabaseName + ';User Id=sa;Password=' + $SqlSaPassword + ';Encrypt=yes;TrustServerCertificate=yes"'
    $updated = [Regex]::Replace($raw, $pattern, $replacement)
    Set-Content -Path $apiLocalSettingsPath -Value $updated -Encoding UTF8
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
    Invoke-Step -Message "Applying API database migrations" -Action {
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
