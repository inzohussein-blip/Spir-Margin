# Spir-Margin - install, update or remove on a Windows computer.
#
#   Double-click install-windows.cmd in the app folder, or:
#   powershell -ExecutionPolicy Bypass -File scripts\windows\install.ps1 [-Port 3000] [-Lan]
#   ... -Update       fetch dependencies, rebuild, restart (after copying in a new version)
#   ... -Uninstall    remove the shortcuts and the start-up entry; the data stays
#
# What it does, and why:
#   - checks Node.js, installs dependencies and builds, so nobody has to know
#     what "npm" is;
#   - starts the program hidden at sign-in, from the Startup folder. The older
#     scheduled task needed administrator rights to create and popped up a
#     console window that, once closed, stopped the program;
#   - puts "Spir-Margin" on the desktop and in the Start menu. The icon starts
#     the program if it is not running, waits for it, and opens it in a window
#     of its own;
#   - by default listens on THIS computer only (127.0.0.1). The app ships a
#     fixed administrator account, so opening it to the office network must be
#     a deliberate choice (-Lan).
#
# Written for Windows PowerShell 5.1, which every Windows 10/11 has: no
# PowerShell 7-only syntax.

param(
    [int]$Port = 3000,
    [switch]$Lan,
    [switch]$Update,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$AppDir     = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$WinDir     = Join-Path $AppDir "scripts\windows"
$RunHidden  = Join-Path $WinDir "run-hidden.vbs"
$OpenApp    = Join-Path $WinDir "open-app.vbs"
$Icon       = Join-Path $AppDir "public\icon.ico"
$HostAddr   = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$Wscript    = Join-Path $env:WINDIR "System32\wscript.exe"
$LinkName   = "Spir-Margin.lnk"
$Desktop    = [Environment]::GetFolderPath("Desktop")
$StartMenu  = [Environment]::GetFolderPath("Programs")
$Startup    = [Environment]::GetFolderPath("Startup")

function Say([string]$text) { Write-Host $text }

function Tell([string]$text, [string]$kind) {
    # A real dialog renders Arabic properly; many consoles do not.
    Say $text
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

function Fail([string]$text) {
    Tell $text "error"
    exit 1
}

function Stop-Server {
    # The restart loop first, or it would start the server again five seconds later.
    Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -like "*run-server.cmd*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in @($listening)) {
        if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
    }
}

function Remove-Links {
    foreach ($dir in @($Desktop, $StartMenu, $Startup)) {
        $lnk = Join-Path $dir $LinkName
        if (Test-Path $lnk) { Remove-Item $lnk -Force }
    }
    # The previous installer used a scheduled task; remove it if it is there.
    $old = Get-ScheduledTask -TaskName "Spir-Margin" -ErrorAction SilentlyContinue
    if ($old) { Unregister-ScheduledTask -TaskName "Spir-Margin" -Confirm:$false -ErrorAction SilentlyContinue }
}

function New-Link([string]$dir, [string]$target, [string]$arguments, [string]$description) {
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut((Join-Path $dir $LinkName))
    $lnk.TargetPath = $target
    $lnk.Arguments = $arguments
    $lnk.WorkingDirectory = $AppDir
    if (Test-Path $Icon) { $lnk.IconLocation = "$Icon,0" }
    $lnk.Description = $description
    $lnk.Save()
}

function Invoke-Npm([string]$npmArgs) {
    # Through cmd.exe, so npm's own PowerShell shim and its execution policy
    # never come into it.
    & cmd.exe /c "npm $npmArgs"
    if ($LASTEXITCODE -ne 0) { Fail "تعذّر تنفيذ: npm $npmArgs`nراجع الرسائل أعلاه، وتأكّد من الاتصال بالإنترنت أثناء التثبيت." }
}

# ---------------------------------------------------------------- uninstall
if ($Uninstall) {
    Stop-Server
    Remove-Links
    Tell ("أُزيل Spir-Margin من سطح المكتب وقائمة ابدأ والتشغيل التلقائي.`n`n" +
          "لم تُحذف البيانات: ما زالت في`n$AppDir\.pglite-data`n" +
          "احذف هذا المجلد يدوياً فقط إن كنت متأكداً أنك لا تحتاجها.") "info"
    exit 0
}

# ---------------------------------------------------------------- checks
Set-Location $AppDir
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Fail "لم يُعثر على Node.js.`nثبّت النسخة LTS من https://nodejs.org ثم شغّل التثبيت من جديد."
}
$version = (& node -v).TrimStart("v")
$parts = $version.Split(".")
$major = [int]$parts[0]
$minor = [int]$parts[1]
if ($major -lt 18 -or ($major -eq 18 -and $minor -lt 18)) {
    Fail "نسخة Node.js الحالية ($version) قديمة. يلزم 18.18 أو أحدث — ثبّت النسخة LTS من https://nodejs.org"
}

Say "Spir-Margin"
Say "  folder : $AppDir"
Say "  port   : $Port"
Say "  listen : $HostAddr"
Say ""

# ---------------------------------------------------------------- build
if ($Update) { Stop-Server }

$haveModules = Test-Path (Join-Path $AppDir "node_modules\next\dist\bin\next")
if ($Update -or -not $haveModules) {
    Say "Installing dependencies (a few minutes the first time)..."
    Invoke-Npm "ci --no-audit --no-fund"
}

$haveBuild = Test-Path (Join-Path $AppDir ".next\BUILD_ID")
if ($Update -or -not $haveBuild) {
    Say "Building..."
    Invoke-Npm "run build"
}

# ---------------------------------------------------------------- start-up and shortcuts
Remove-Links
$serveArgs = "`"$RunHidden`" $Port $HostAddr"
$openArgs  = "`"$OpenApp`" $Port $HostAddr"
New-Link $Startup   $Wscript $serveArgs "Spir-Margin — يعمل في الخلفية"
New-Link $Desktop   $Wscript $openArgs  "Spir-Margin"
New-Link $StartMenu $Wscript $openArgs  "Spir-Margin"

# Start it now, then open it, exactly as the icon will.
Start-Process -FilePath $Wscript -ArgumentList $openArgs

$lanNote = ""
if ($Lan) {
    $lanNote = "`n`nتنبيه: البرنامج مفتوح لشبكة المكتب. الحساب المدمج admin@spir.local يعمل من أي جهاز على الشبكة — لا تستخدم هذا الخيار إلا على شبكة موثوقة."
}
Tell ("تمّ تثبيت Spir-Margin.`n`n" +
      "• افتحه من أيقونة «Spir-Margin» على سطح المكتب أو في قائمة ابدأ.`n" +
      "• يبدأ تلقائياً عند تسجيل الدخول إلى ويندوز، ويعمل بلا إنترنت.`n" +
      "• البيانات محفوظة على هذا الحاسوب في:`n  $AppDir\.pglite-data`n" +
      "  خذ منها نسخة احتياطية من الإعدادات بانتظام." + $lanNote) "info"
