@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

cd /d "%~dp0."

title Aether Mocks - Dev Environment

echo ===================================================
echo   Aether Mocks - Starting Dev Environment
echo   (Frontend: Vite on :5173 ^| Backend: Static on :8080)
echo ===================================================
echo.

REM ---------- 1. Check Node & Install dependencies if missing ----------
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Please install Node.js to run Aether Mocks.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/4] Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b 1
    )
) else (
    echo [1/4] Node dependencies OK.
)
echo.

REM ---------- 2. Regenerate catalog & extract mock test data ----------
echo [2/4] Regenerating mocks catalog and extracting mock tests...
if exist "start.js" (
    call node start.js
) else (
    echo [ERROR] start.js not found in app directory. Aborting.
    pause
    exit /b 1
)

if errorlevel 1 (
    echo [ERROR] Mock test generation failed. Aborting.
    pause
    exit /b 1
)
echo.

REM ---------- 3. Start BACKEND static server on :8080 ----------
echo [3/4] Starting BACKEND static server on http://localhost:8080 ...
netstat -ano | findstr :8080 | findstr LISTENING >nul 2>&1
if errorlevel 1 (
    if exist "server.js" (
        start "Aether Backend :8080" /min cmd /c "node server.js"
    ) else (
        python --version >nul 2>&1
        if not errorlevel 1 (
            start "Aether Backend :8080" /min cmd /c "python -m http.server 8080 --bind 127.0.0.1 --directory ..\public"
        )
    )
    timeout /t 2 /nobreak >nul
    echo       [OK] Backend started -> http://localhost:8080
) else (
    echo       [OK] Backend is already running on http://localhost:8080
)
echo.

REM ---------- 4. Start FRONTEND (Vite dev) ----------
echo [4/4] Starting FRONTEND (Vite dev server)...
echo.
echo   Frontend (open this): http://localhost:5173/v2/
echo   Backend (proxied):   http://localhost:8080
echo.
echo   Press Ctrl+C in this window to stop the frontend.
echo ===================================================
echo.

call npm run dev -- --open

echo.
echo Dev server stopped.
pause
