# QuickBooks MCP Server — One-line installer for Windows
#
# Usage (in PowerShell):
#   irm https://raw.githubusercontent.com/BIM4GIB/QuickerBooks/main/install.ps1 | iex
#
$ErrorActionPreference = "Stop"

$Repo = "BIM4GIB/QuickerBooks"
$Branch = "main"
$Base = "https://raw.githubusercontent.com/$Repo/$Branch"
$InstallDir = Join-Path $env:USERPROFILE ".mcp-quickbooks"

Write-Host ""
Write-Host "=== QuickBooks MCP Server - Installer ===" -ForegroundColor Cyan
Write-Host ""

# ---- Step 1: Check for Node.js ----

function Install-NodeJS {
    Write-Host "Installing Node.js 22 LTS..." -ForegroundColor Yellow

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    } else {
        # Fallback: direct MSI download
        $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
        $msiUrl = "https://nodejs.org/dist/v22.12.0/node-v22.12.0-$arch.msi"
        $msiPath = Join-Path $env:TEMP "node-install.msi"
        Write-Host "Downloading Node.js installer..."
        Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -UseBasicParsing
        Write-Host "Running installer (you may see a UAC prompt)..."
        Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn" -Wait -Verb RunAs
        Remove-Item $msiPath -Force
    }

    # Refresh PATH so node is available in this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + `
                [System.Environment]::GetEnvironmentVariable("Path", "User")

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "Node.js was installed but may require a terminal restart." -ForegroundColor Yellow
        Write-Host "Please close this terminal, open a new one, and run this installer again."
        exit 1
    }
}

$nodeFound = Get-Command node -ErrorAction SilentlyContinue
if ($nodeFound) {
    $ver = (node -v) -replace 'v', ''
    $major = [int]($ver.Split('.')[0])
    if ($major -lt 20) {
        Write-Host "Node.js $ver found, but version 20+ is required."
        $yn = Read-Host "Install Node.js 22? [Y/n]"
        if ($yn -match '^[nN]') {
            Write-Host "Please upgrade Node.js manually: https://nodejs.org/"
            exit 1
        }
        Install-NodeJS
    } else {
        Write-Host "Node.js v$ver found" -ForegroundColor Green
    }
} else {
    $yn = Read-Host "Node.js not found. Install it now? [Y/n]"
    if ($yn -match '^[nN]') {
        Write-Host "Please install Node.js 20+ from https://nodejs.org/"
        exit 1
    }
    Install-NodeJS
}

# ---- Step 2: Download bundles ----

Write-Host ""
Write-Host "Downloading QuickBooks MCP server..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Invoke-WebRequest -Uri "$Base/bundle/server.mjs"  -OutFile (Join-Path $InstallDir "server.mjs")        -UseBasicParsing
Invoke-WebRequest -Uri "$Base/bundle/cli.mjs"     -OutFile (Join-Path $InstallDir "cli.mjs")           -UseBasicParsing
Invoke-WebRequest -Uri "$Base/GETTING_STARTED.md" -OutFile (Join-Path $InstallDir "GETTING_STARTED.md") -UseBasicParsing

# Verify checksums
Invoke-WebRequest -Uri "$Base/bundle/SHA256SUMS" -OutFile (Join-Path $InstallDir "SHA256SUMS") -UseBasicParsing
Write-Host "Verifying downloads..."
$checksums = Get-Content (Join-Path $InstallDir "SHA256SUMS")
foreach ($line in $checksums) {
    $parts = $line -split "\s+"
    $expectedHash = $parts[0]
    $fileName = $parts[1]
    $filePath = Join-Path $InstallDir $fileName
    $actualHash = (Get-FileHash -Path $filePath -Algorithm SHA256).Hash.ToLower()
    if ($actualHash -ne $expectedHash) {
        Write-Host "ERROR: Checksum mismatch for $fileName! File may have been tampered with." -ForegroundColor Red
        Write-Host "Expected: $expectedHash"
        Write-Host "Got:      $actualHash"
        exit 1
    }
}
Write-Host "Checksums verified" -ForegroundColor Green

Write-Host "Downloaded to $InstallDir" -ForegroundColor Green

# ---- Step 3: Run setup wizard ----

Write-Host ""
& node (Join-Path $InstallDir "cli.mjs") setup

Write-Host ""
Write-Host "A getting-started guide has been saved to:" -ForegroundColor Cyan
Write-Host "  $(Join-Path $InstallDir 'GETTING_STARTED.md')"
Write-Host ""
Write-Host "Open it for example prompts and tips on testing safely."


