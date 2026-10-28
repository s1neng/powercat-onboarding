@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "collector\collect.ps1" %*
pause
