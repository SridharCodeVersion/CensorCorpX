@echo off
echo ========================================
echo   CensorCorpX AI - Project Launcher
echo ========================================
echo.
echo This script will start both:
echo   1. Backend Server (FastAPI on port 8000)
echo   2. Frontend Server (Vite on port 1139)
echo.
echo Press Ctrl+C in each window to stop the servers.
echo ========================================
echo.

REM Start Backend in a new window
echo Starting Backend Server...
start "CensorCorpX Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && (if exist "venv\Scripts\activate.bat" (call venv\Scripts\activate.bat) else if exist "venv_new\Scripts\activate.bat" (call venv_new\Scripts\activate.bat) else (echo ERROR: No virtual environment found! && pause && exit /b 1)) && echo Backend server starting on http://localhost:8000... && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

REM Wait 3 seconds for backend to initialize
echo Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

REM Start Frontend in a new window
echo Starting Frontend Server...
start "CensorCorpX Frontend (Port 1139)" cmd /k "cd /d "%~dp0frontend" && echo Frontend server starting... && npm run dev"

echo.
echo ========================================
echo Both servers are starting!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:1139
echo.
echo Check the individual terminal windows for status.
echo Close this window or press any key to exit launcher.
echo ========================================
pause >nul
