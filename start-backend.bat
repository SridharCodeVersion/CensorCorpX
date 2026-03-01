@echo off
setlocal

cd /d "%~dp0"

IF NOT EXIST "backend\venv" (
    echo [ERROR] Virtual environment not found at backend\venv. Please create it first.
    exit /b 1
)

echo [INFO] Activating virtual environment...
call backend\venv\Scripts\activate.bat

echo [INFO] Starting Backend on port 8000...
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
