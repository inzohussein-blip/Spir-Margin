@echo off
rem Spir-Margin - double-click to install on this computer.
rem
rem   install-windows.cmd              install
rem   install-windows.cmd -Update      after copying in a new version
rem   install-windows.cmd -Uninstall   remove shortcuts and start-up (keeps data)
rem   install-windows.cmd -Lan         also serve the office network (see docs\INSTALL.md)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\install.ps1" %*
echo.
pause
