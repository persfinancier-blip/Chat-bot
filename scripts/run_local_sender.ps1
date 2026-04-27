param(
    [int]$MaxMessages = 5
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir = Join-Path $ProjectRoot "logs"
$LockPath = Join-Path $ProjectRoot "logs\sender.lock"
$LogPath = Join-Path $ProjectRoot "logs\sender.log"
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$EnvFile = Join-Path $ProjectRoot ".env.local"

New-Item -ItemType Directory -Force $LogDir | Out-Null

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogPath -Value "$timestamp $Message" -Encoding UTF8
}

function Import-LocalEnv {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        return
    }

    Get-Content -Path $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            return
        }
        $parts = $line.Split("=", 2)
        if ($parts.Count -ne 2) {
            return
        }
        $name = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        if ($name) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$lockStream = $null
try {
    $lockStream = [System.IO.File]::Open($LockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
} catch {
    Write-Log "LOCKED another local sender instance is running"
    exit 0
}

try {
    Set-Location $ProjectRoot
    Import-LocalEnv $EnvFile

    if (-not (Test-Path $Python)) {
        Write-Log "ERROR missing venv python: $Python"
        exit 1
    }

    $env:LOCAL_MODE = "sender"
    if ($env:SERVER_MODE) {
        Remove-Item Env:SERVER_MODE -ErrorAction SilentlyContinue
    }

    Write-Log "START local sender max_messages=$MaxMessages"
    & $Python "scripts\local_sender_worker.py" --max-messages $MaxMessages *>> $LogPath
    $exitCode = $LASTEXITCODE
    Write-Log "END local sender exit_code=$exitCode"
    exit $exitCode
} catch {
    Write-Log "FATAL $($_.Exception.GetType().Name): $($_.Exception.Message)"
    exit 1
} finally {
    if ($lockStream) {
        $lockStream.Close()
        $lockStream.Dispose()
    }
}
