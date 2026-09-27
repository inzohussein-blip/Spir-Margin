# Spir-Margin - update this computer to the newest release.
#
#   Double-click update-windows.cmd in the program's folder, or it is started
#   by the program itself (Settings -> Updates, or automatically at night):
#   powershell -ExecutionPolicy Bypass -File scripts\windows\update.ps1 [-Quiet] [-Force]
#   ... -Quiet   no dialogs (the program shows the progress itself)
#   ... -Force   install the newest release even if this copy already is it
#
# How, and why in this order:
#   1. asks for the newest release (GitHub Releases, published only when the
#      tests pass) and stops if this copy is already it;
#   2. downloads it and builds it in updates\stage-N, beside the running
#      program, which goes on working meanwhile. If anything fails up to
#      here, nothing of the installed program has been touched;
#   3. stops the program, copies the database folder aside, and swaps the
#      new files in by renaming them (instant, same disk); the old ones wait
#      in updates\previous-N;
#   4. starts it and waits for it to answer. If it does not, the old files
#      and the database copy go back, and the old version starts again.
#
# Never moved or replaced: the database (.pglite-data), the settings file
# (.env.local, which holds the session key), backups, logs.
#
# Progress goes to updates\status.json, which Settings -> Updates reads, and
# the details to logs\update.log.
#
# Written for Windows PowerShell 5.1, which every Windows 10/11 has: no
# PowerShell 7-only syntax.

param(
    [string]$Repo = "inzohussein-blip/Spir-Margin",
    [string]$Api = "",
    [int]$Port = 0,
    [switch]$Quiet,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # Invoke-WebRequest is many times slower with its progress bar
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$AppDir     = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$UpdatesDir = Join-Path $AppDir "updates"
$StatusFile = Join-Path $UpdatesDir "status.json"
$LockFile   = Join-Path $UpdatesDir "update.lock"
$LogDir     = Join-Path $AppDir "logs"
$LogFile    = Join-Path $LogDir "update.log"
$DataDir    = Join-Path $AppDir ".pglite-data"
$DataCopy   = Join-Path $UpdatesDir "data-before-update"

# What an update never touches, whatever the release contains.
$script:Target = 0

$Keep = @(".pglite-data", "backups", "logs", "updates", ".env.local", ".env", ".git")

if (-not $Api) { $Api = $env:SPIR_UPDATE_API }
if (-not $Api) { $Api = "https://api.github.com" }
$Api = $Api.TrimEnd("/")

function Say([string]$text) {
    Write-Host $text
    try {
        if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
        $line = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") + "  " + $text + "`r`n"
        [System.IO.File]::AppendAllText($LogFile, $line)
    } catch { }
}

function Tell([string]$text, [string]$kind) {
    Say $text
    if ($Quiet) { return }
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $icon = [System.Windows.Forms.MessageBoxIcon]::Information
        if ($kind -eq "error") { $icon = [System.Windows.Forms.MessageBoxIcon]::Error }
        $opts = [System.Windows.Forms.MessageBoxOptions]::RtlReading -bor [System.Windows.Forms.MessageBoxOptions]::RightAlign
        [void][System.Windows.Forms.MessageBox]::Show($text, "Spir-Margin",
            [System.Windows.Forms.MessageBoxButtons]::OK, $icon,
            [System.Windows.Forms.MessageBoxDefaultButton]::Button1, $opts)
    } catch { }
}

function Set-Status([string]$state, [int]$number, [string]$detail) {
    # Read by the program (Settings -> Updates). Plain UTF-8, no BOM.
    try {
        if (-not (Test-Path $UpdatesDir)) { New-Item -ItemType Directory -Path $UpdatesDir | Out-Null }
        $o = [ordered]@{
            state  = $state
            number = $number
            detail = $detail
            at     = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            pid    = $PID
        }
        [System.IO.File]::WriteAllText($StatusFile, ($o | ConvertTo-Json -Compress))
    } catch { }
    Say "[$state] $detail"
}

function Get-CurrentNumber {
    # version.json comes inside every release; a copy installed before
    # releases existed has none, and counts as number 0.
    $file = Join-Path $AppDir "version.json"
    if (-not (Test-Path $file)) { return 0 }
    try {
        $v = [System.IO.File]::ReadAllText($file) | ConvertFrom-Json
        return [int]$v.number
    } catch {
        return 0
    }
}

function Get-LatestRelease {
    $url = "$Api/repos/$Repo/releases/latest"
    $r = Invoke-RestMethod -Uri $url -UserAgent "Spir-Margin-updater" -TimeoutSec 30 -UseBasicParsing
    $number = 0
    if ($r.tag_name -match "^build-(\d+)$") { $number = [int]$Matches[1] }
    $zip = $null
    foreach ($a in @($r.assets)) {
        if ($a -and $a.name -eq "spir-margin.zip") { $zip = $a.browser_download_url }
    }
    return [pscustomobject]@{ Number = $number; Zip = $zip; Tag = $r.tag_name }
}

function Get-ServerArgs {
    # How the installer set this computer up: the start-up shortcut holds the
    # port and the address, e.g.  "C:\...\run-hidden.vbs" 3000 127.0.0.1
    $p = 3000
    $h = "127.0.0.1"
    $lnk = Join-Path ([Environment]::GetFolderPath("Startup")) "Spir-Margin.lnk"
    if (Test-Path $lnk) {
        try {
            $a = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk).Arguments
            if ($a -match '"\s+(\d+)\s+(\S+)\s*$') {
                $p = [int]$Matches[1]
                $h = $Matches[2]
            }
        } catch { }
    }
    if ($Port -gt 0) { $p = $Port }
    return [pscustomobject]@{ Port = $p; Host = $h }
}

function Stop-Server([int]$port) {
    # The restart loop first, or it would start the server again five seconds later.
    Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -like "*run-server.cmd*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in @($listening)) {
        if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
    }
    # Wait for the port, and the database files, to be let go.
    for ($i = 0; $i -lt 30; $i++) {
        $still = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if (-not $still) { break }
        Start-Sleep -Seconds 1
    }
    Start-Sleep -Seconds 2
}

function Start-Server($srv) {
    $wscript = Join-Path $env:WINDIR "System32\wscript.exe"
    $runHidden = Join-Path $AppDir "scripts\windows\run-hidden.vbs"
    Start-Process -FilePath $wscript -ArgumentList "`"$runHidden`" $($srv.Port) $($srv.Host)"
}

function Wait-Answer([int]$port, [int]$seconds) {
    # The first start of a new version applies its database changes, which
    # can take a while; the manifest names the program once it is serving.
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/manifest.webmanifest" -UseBasicParsing -TimeoutSec 5
            if ($r.Content -match "Spir-Margin") { return $true }
        } catch { }
        Start-Sleep -Seconds 3
    }
    return $false
}

function Invoke-Npm([string]$dir, [string]$npmArgs) {
    # Through cmd.exe, so npm's own PowerShell shim and its execution policy
    # never come into it; its output goes to the log. A plain .NET process
    # rather than Start-Process, whose exit code Windows PowerShell 5.1
    # sometimes loses.
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
    Say "npm $npmArgs"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c npm $npmArgs >> `"$LogFile`" 2>&1"
    $psi.WorkingDirectory = $dir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $p.WaitForExit()
    if ($p.ExitCode -ne 0) { throw "npm $npmArgs failed (exit $($p.ExitCode)), see logs\update.log" }
}

function Move-WithRetry([string]$from, [string]$to) {
    # A virus scanner looking at a file can hold a rename up for a moment.
    for ($i = 1; $i -le 10; $i++) {
        try {
            Move-Item -LiteralPath $from -Destination $to -Force
            return
        } catch {
            if ($i -eq 10) { throw }
            Start-Sleep -Seconds 2
        }
    }
}

function Remove-Quietly([string]$path) {
    if (Test-Path -LiteralPath $path) {
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
        # Deep node_modules folders defeat Remove-Item now and then; rd copes better.
        if (Test-Path -LiteralPath $path) { & cmd.exe /c rd /s /q $path 2>$null | Out-Null }
    }
}

function Clear-OldWork {
    # Left-overs of an earlier update: stages, old files, downloads.
    if (-not (Test-Path $UpdatesDir)) { return }
    Get-ChildItem -LiteralPath $UpdatesDir -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "stage-*" -or $_.Name -like "previous-*" -or $_.Name -like "spir-margin-*.zip" } |
        ForEach-Object { Remove-Quietly $_.FullName }
}

function Switch-Files([string]$newRoot, [string]$previous, $done) {
    # Swap every top-level file and folder of the release in, keeping the old
    # one in $previous. Each step is recorded in $done as it happens, so a
    # failure half-way can be undone.
    New-Item -ItemType Directory -Path $previous -Force | Out-Null
    foreach ($item in @(Get-ChildItem -LiteralPath $newRoot -Force)) {
        if ($Keep -contains $item.Name) { continue }
        $dst = Join-Path $AppDir $item.Name
        $hadOld = Test-Path -LiteralPath $dst
        if ($hadOld) { Move-WithRetry $dst (Join-Path $previous $item.Name) }
        $entry = [pscustomobject]@{ Name = $item.Name; HadOld = $hadOld; Placed = $false }
        [void]$done.Add($entry)
        Move-WithRetry $item.FullName $dst
        $entry.Placed = $true
    }
}

function Undo-Switch($done, [string]$newRoot, [string]$previous) {
    for ($i = $done.Count - 1; $i -ge 0; $i--) {
        $d = $done[$i]
        $dst = Join-Path $AppDir $d.Name
        if ($d.Placed -and (Test-Path -LiteralPath $dst)) { Move-WithRetry $dst (Join-Path $newRoot $d.Name) }
        if ($d.HadOld) { Move-WithRetry (Join-Path $previous $d.Name) $dst }
    }
}

function Restore-Data {
    if (-not (Test-Path $DataCopy)) { return }
    Remove-Quietly $DataDir
    Copy-Item -LiteralPath $DataCopy -Destination $DataDir -Recurse -Force
}

function Invoke-Update {
    Set-Status "checking" 0 "asking $Api for the newest release"
    $current = Get-CurrentNumber
    $rel = Get-LatestRelease
    if (-not $rel.Zip -or $rel.Number -le 0) { throw "the newest release ($($rel.Tag)) has no spir-margin.zip" }
    if ($rel.Number -le $current -and -not $Force) {
        Set-Status "uptodate" $current "this computer already has release $current"
        Tell "هذا الحاسوب يعمل بأحدث إصدار ($current)." "info"
        return
    }
    $n = $rel.Number
    $script:Target = $n

    # ---------------------------------------------------------- 2. download and build beside it
    Clear-OldWork
    $zip = Join-Path $UpdatesDir "spir-margin-$n.zip"
    $stage = Join-Path $UpdatesDir "stage-$n"
    Set-Status "downloading" $n "downloading release $n"
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $rel.Zip -OutFile $zip -UseBasicParsing -UserAgent "Spir-Margin-updater" -TimeoutSec 600
    Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force
    $newRoot = Join-Path $stage "spir-margin"
    if (-not (Test-Path (Join-Path $newRoot "package.json"))) { throw "the downloaded release is not a Spir-Margin folder" }
    foreach ($f in @(Get-ChildItem -Path (Join-Path $newRoot "scripts\windows") -File -ErrorAction SilentlyContinue)) {
        try { Unblock-File -Path $f.FullName -ErrorAction SilentlyContinue } catch { }
    }
    # The build reads the same settings as the program.
    $envFile = Join-Path $AppDir ".env.local"
    if (Test-Path $envFile) { Copy-Item -LiteralPath $envFile -Destination (Join-Path $newRoot ".env.local") -Force }

    Set-Status "building" $n "installing dependencies and building release $n (the program keeps working)"
    Invoke-Npm $newRoot "ci --no-audit --no-fund"
    Invoke-Npm $newRoot "run build"

    # ---------------------------------------------------------- 3. swap
    $srv = Get-ServerArgs
    Set-Status "switching" $n "stopping the program and switching to release $n"
    Stop-Server $srv.Port
    $previous = Join-Path $UpdatesDir "previous-$n"
    $done = New-Object System.Collections.ArrayList
    try {
        if (Test-Path $DataDir) {
            Remove-Quietly $DataCopy
            Copy-Item -LiteralPath $DataDir -Destination $DataCopy -Recurse -Force
        }
        Switch-Files $newRoot $previous $done
    } catch {
        # Whatever went wrong, the program must not be left stopped.
        $why = $_.Exception.Message
        try { Undo-Switch $done $newRoot $previous } catch { Say "could not undo the switch: $($_.Exception.Message)" }
        Start-Server $srv
        throw "could not switch the files: $why"
    }

    # ---------------------------------------------------------- 4. start, or go back
    Set-Status "starting" $n "starting release $n"
    Start-Server $srv
    if (Wait-Answer $srv.Port 300) {
        Set-Status "done" $n "release $n is running"
        Clear-OldWork
        Tell "تمّ تحديث Spir-Margin إلى الإصدار $n." "info"
        return
    }

    Say "release $n did not answer; going back"
    Stop-Server $srv.Port
    Undo-Switch $done $newRoot $previous
    Restore-Data
    Start-Server $srv
    [void](Wait-Answer $srv.Port 180)
    Set-Status "rolledback" $n "release $n did not start; the previous version and its data are back"
    Tell ("لم يعمل الإصدار $n على هذا الحاسوب، فأُعيد الإصدار السابق وبياناته كما كانت.`n" +
          "التفاصيل في:`n$LogFile") "error"
}

function Main {
    if (-not (Test-Path $UpdatesDir)) { New-Item -ItemType Directory -Path $UpdatesDir | Out-Null }

    # One update at a time: a lock naming the process that holds it.
    if (Test-Path $LockFile) {
        $holder = 0
        try { $holder = [int]([System.IO.File]::ReadAllText($LockFile).Trim()) } catch { }
        if ($holder -gt 0 -and (Get-Process -Id $holder -ErrorAction SilentlyContinue)) {
            Tell "يجري تحديث Spir-Margin الآن. انتظر حتى ينتهي." "info"
            return
        }
    }
    [System.IO.File]::WriteAllText($LockFile, [string]$PID)
    try {
        Invoke-Update
    } catch {
        $why = $_.Exception.Message
        Set-Status "failed" $script:Target $why
        Tell ("تعذّر تحديث Spir-Margin، والبرنامج الحالي يعمل كما كان.`n`n$why`n`n" +
              "تأكّد من الاتصال بالإنترنت ثم أعد المحاولة. التفاصيل في:`n$LogFile") "error"
    } finally {
        Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue
    }
}

# Dot-sourced (the tests load the functions this way): define, do not run.
if ($MyInvocation.InvocationName -ne ".") { Main }
