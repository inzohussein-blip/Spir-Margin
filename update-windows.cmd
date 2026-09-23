@echo off
rem Spir-Margin - double-click to update this computer to the newest release.
rem
rem   update-windows.cmd          download, build beside the running program, switch, restart
rem   update-windows.cmd -Force   reinstall the newest release even if this copy already is it
rem
rem The data, the settings file and the backups are never touched. If the new
rem release does not start, the previous one comes back by itself.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\update.ps1" %*
echo.
pause
