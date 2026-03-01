@echo off
echo ========================================
echo   Starting CensorCorpX AI Platform
echo ========================================
echo.

REM Start backend in a new window
echo [1/2] Starting Backend Server...
start "CensorCorpX Backend" cmd /k "%~dp0start-backend.bat"

REM Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
echo [2/2] Starting Frontend...
start "CensorCorpX Frontend" cmd /k "%~dp0start-frontend.bat"

echo.
echo ========================================
echo   Both servers are starting!
echo ========================================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo ========================================
echo.
echo You can close this window.
timeout /t 5
