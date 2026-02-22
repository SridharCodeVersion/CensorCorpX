@echo off
echo Starting Dhurandhar Backend Server...
cd /d "%~dp0backend"

REM Check if venv exists, if not use venv_new
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment (venv)...
    call venv\Scripts\activate.bat
) else if exist "venv_new\Scripts\activate.bat" (
    echo Activating virtual environment (venv_new)...
    call venv_new\Scripts\activate.bat
) else (
    echo ERROR: No virtual environment found!
    echo Please create one with: python -m venv venv
    echo Then install dependencies: venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

echo Starting FastAPI server on http://localhost:8000...
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
