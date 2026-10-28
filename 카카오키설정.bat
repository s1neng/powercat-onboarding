@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File collector\kakao-key.ps1
pause
