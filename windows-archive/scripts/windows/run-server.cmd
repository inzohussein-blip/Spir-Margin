@echo off
rem Spir-Margin server, kept running.
rem
rem Started without a window by run-hidden.vbs - at sign-in (Startup folder)
rem and by the desktop shortcut. Safe to start twice: if the port already
rem answers, this exits at once instead of fighting over it.
rem
rem   run-server.cmd [port] [host]      defaults: 3000 127.0.0.1
setlocal
cd /d "%~dp0..\.."

set "PORT=%~1"
if "%PORT%"=="" set "PORT=3000"
set "HOST=%~2"
if "%HOST%"=="" set "HOST=127.0.0.1"
set "NODE_ENV=production"
if not exist "logs" mkdir "logs"

:loop
rem Already serving? Then there is nothing to do.
netstat -ano -p tcp | findstr /R /C:":%PORT% .*LISTENING" >nul && exit /b 0

rem Keep the log from growing without bound: past 5 MB it rolls over once.
if exist "logs\spir-margin.log" for %%F in ("logs\spir-margin.log") do if %%~zF GTR 5000000 move /y "logs\spir-margin.log" "logs\spir-margin.old.log" >nul

echo [%date% %time%] starting on %HOST%:%PORT% >> "logs\spir-margin.log"
node "node_modules\next\dist\bin\next" start -p %PORT% -H %HOST% >> "logs\spir-margin.log" 2>&1
echo [%date% %time%] stopped (exit %errorlevel%), restarting in 5 seconds >> "logs\spir-margin.log"

rem ping is the sleep that works without a console to read from.
ping -n 6 127.0.0.1 >nul
goto loop
