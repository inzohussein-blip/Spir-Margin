# Install Spir-Margin so it starts with Windows.
#
#   Right-click > Run with PowerShell, or:
#   powershell -ExecutionPolicy Bypass -File scripts\service\install-windows.ps1
#
# Uninstall:
#   schtasks /Delete /TN "Spir-Margin" /F
#
# This registers a scheduled task that runs at logon. A task is used rather
# than a Windows service because Node needs no service wrapper here, and a
# task is something the company can see and remove in Task Scheduler without
# extra tools.

param(
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$AppDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node) { throw "node was not found on PATH." }

if (-not (Test-Path (Join-Path $AppDir ".next"))) {
    throw "No build found. Run 'npm run build' first."
}

$nextBin = Join-Path $AppDir "node_modules\next\dist\bin\next"
if (-not (Test-Path $nextBin)) { throw "Next.js is not installed. Run 'npm ci' first." }

# A tiny launcher, so the task has one thing to run and the port and working
# directory live in a file the company can read.
$launcher = Join-Path $AppDir "scripts\service\start-windows.cmd"
@"
@echo off
cd /d "$AppDir"
set NODE_ENV=production
set PORT=$Port
"$($node.Source)" "$nextBin" start -p $Port
"@ | Set-Content -Path $launcher -Encoding ASCII

Write-Host "Installing:"
Write-Host "  directory : $AppDir"
Write-Host "  port      : $Port"

schtasks /Create /TN "Spir-Margin" /TR "`"$launcher`"" /SC ONLOGON /RL LIMITED /F | Out-Null
schtasks /Run /TN "Spir-Margin" | Out-Null

Write-Host ""
Write-Host "Spir-Margin will now start when you sign in, at http://localhost:$Port"
Write-Host "Open that address, then install it from Settings."
