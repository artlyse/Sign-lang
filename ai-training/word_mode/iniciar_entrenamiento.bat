@echo off
setlocal
cd /d "%~dp0"
set "PROJECT_ROOT=%~dp0..\.."
set "PYTHON=%PROJECT_ROOT%\backend\venv\Scripts\python.exe"

if not exist "%PYTHON%" (
  echo ERROR: No existe %PYTHON%
  pause
  exit /b 1
)

"%PYTHON%" menu.py
pause
