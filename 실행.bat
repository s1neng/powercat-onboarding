@echo off
cd /d "%~dp0"
start "" http://localhost:8770/
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 -Root . -Port 8770
