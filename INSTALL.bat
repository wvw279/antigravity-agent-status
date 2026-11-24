@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File "%~dp0installer-ui.ps1"
if errorlevel 1 (
    echo Failed to launch GUI installer. Trying console mode...
    node "%~dp0install.mjs"
    pause
)
