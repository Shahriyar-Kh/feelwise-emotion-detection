@echo off
setlocal enabledelayedexpansion
title FeelWise - All Services Launcher
echo ============================================
echo 🚀 Starting FeelWise Multi-Module System...
echo ============================================

REM === Get the directory where this script is located ===
set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%FastAPI_Backend
set FRONTEND_DIR=%SCRIPT_DIR%Frontend
set FACE_VENV_DIR=%BACKEND_DIR%\venv310
set FRONTEND_PORT=

REM Allow a short external path for the face venv to avoid Windows long-path issues
if exist "D:\fw310\Scripts\activate.bat" (
    set FACE_VENV_DIR=D:\fw310
)

REM === Check if backend directory exists ===
if not exist "%BACKEND_DIR%" (
    echo ❌ ERROR: FastAPI_Backend directory not found at %BACKEND_DIR%
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

REM === Check if frontend directory exists ===
if not exist "%FRONTEND_DIR%" (
    echo ❌ ERROR: Frontend directory not found at %FRONTEND_DIR%
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

REM === Check if virtual environments exist ===
if not exist "%BACKEND_DIR%\venv\Scripts\activate.bat" (
    echo ❌ ERROR: Python 3.12+ virtual environment not found
    echo Please create it with: python -m venv FastAPI_Backend\venv
    pause
    exit /b 1
)

if not exist "%FACE_VENV_DIR%\Scripts\activate.bat" (
    echo ⚠️  WARNING: Python 3.10 virtual environment not found at venv310
    echo Face analysis will not run. Create it with: py -3.10 -m venv D:\fw310
)

REM === Find an available frontend port ===
for /f %%P in ('powershell -NoProfile -Command "$ports = 5500..5510; foreach ($p in $ports) { if (-not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)) { Write-Output $p; break } }"') do set FRONTEND_PORT=%%P

if not defined FRONTEND_PORT (
    echo ❌ ERROR: Could not find an available frontend port between 5500 and 5510
    pause
    exit /b 1
)

echo.
echo ✅ Environment check passed. Starting services...
echo.

REM === Start Text Analysis API ===
echo ▶ Starting Text Analysis API (port 8001)...
start "Text Analysis API" /D "%BACKEND_DIR%" "%BACKEND_DIR%\venv\Scripts\python.exe" -m uvicorn text-analysis-api:app --reload --port 8001

timeout /t 2 /nobreak >nul

REM === Start Speech Analysis API ===
echo ▶ Starting Speech Analysis API (port 8000)...
start "Speech Analysis API" /D "%BACKEND_DIR%" "%BACKEND_DIR%\venv\Scripts\python.exe" -m uvicorn speech_analysis_fastapi:app --reload --port 8000

timeout /t 2 /nobreak >nul

REM === Start Journal API ===
echo ▶ Starting Journal API (port 8004)...
start "Journal API" /D "%BACKEND_DIR%" "%BACKEND_DIR%\venv\Scripts\python.exe" -m uvicorn journal_api:app --reload --port 8004

timeout /t 2 /nobreak >nul

REM === Start Face Analysis API (Python 3.10) ===
if exist "%FACE_VENV_DIR%\Scripts\activate.bat" (
    echo ▶ Starting Face Analysis API on port 8002...
    start "Face Analysis API" /D "%BACKEND_DIR%" "%FACE_VENV_DIR%\Scripts\python.exe" -m uvicorn face-analysis-api:app --reload --port 8002
    
    timeout /t 2 /nobreak >nul
) else (
    echo ⚠️  Skipping Face Analysis API because the Python 3.10 face venv was not found
)

REM === Start Node.js Main Server ===
echo ▶ Starting Node.js Main Server (port 5000)...
start "Node.js Main Server" cmd /k "cd /d "%BACKEND_DIR%" && npm start"

timeout /t 2 /nobreak >nul

REM === Start Frontend Static Server ===
echo ▶ Starting Frontend Server (port %FRONTEND_PORT%)...
start "Frontend Server" /D "%FRONTEND_DIR%" "%BACKEND_DIR%\venv\Scripts\python.exe" -m http.server %FRONTEND_PORT%

echo.
echo ============================================
echo ✅ All services are launching!
echo.
echo 📋 Service URLs:
echo   - Text API:    http://localhost:8001
echo   - Face API:    http://localhost:8002
echo   - Speech API:  http://localhost:8000
echo   - Journal API: http://localhost:8004
echo   - Main Server: http://localhost:5000
echo   - Frontend:    http://127.0.0.1:%FRONTEND_PORT%/login.html
echo.
echo ============================================
echo Press any key to continue...
pause

