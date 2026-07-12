@echo off
setlocal

set "AGM_ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%AGM_ROOT%scripts\Start-AGM.ps1"

if errorlevel 1 (
  echo.
  echo AGM startup failed. Check the message above.
  pause
)

endlocal
