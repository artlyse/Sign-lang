@echo off
setlocal
cd /d "%~dp0"
set "PROJECT_ROOT=%~dp0..\.."
set "PYTHON=%PROJECT_ROOT%\backend\venv\Scripts\python.exe"

if not exist "%PYTHON%" (
  echo ERROR: No existe el venv del backend:
  echo %PYTHON%
  echo Crea/activa primero backend\venv.
  pause
  exit /b 1
)

echo Instalando requisitos en EL MISMO venv del backend...
"%PYTHON%" -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo Hubo un error instalando requisitos.
  pause
  exit /b 1
)

echo.
echo Listo. No se reinstalo PyTorch, por lo que se conserva tu build CUDA.
pause
