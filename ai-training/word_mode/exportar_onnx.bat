@echo off
setlocal
cd /d "%~dp0"
set "PROJECT_ROOT=%~dp0..\.."
set "PYTHON=%PROJECT_ROOT%\backend\venv\Scripts\python.exe"

if not exist "%PYTHON%" (
  echo ERROR: No existe:
  echo %PYTHON%
  pause
  exit /b 1
)

echo Verificando ONNX...
"%PYTHON%" -c "import onnx; print('ONNX:', onnx.__version__)" >nul 2>&1
if errorlevel 1 (
  echo ONNX no esta instalado. Instalando...
  "%PYTHON%" -m pip install onnx
  if errorlevel 1 (
    echo ERROR instalando ONNX.
    pause
    exit /b 1
  )
)

echo.
echo Exportando el ultimo word_model.pt SIN volver a entrenar...
"%PYTHON%" export_word_model.py

echo.
pause
