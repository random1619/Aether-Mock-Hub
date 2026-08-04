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

REM ---------- 1. Detect Python ----------
set "PY_CMD="
python --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=python"
) else (
    py --version >nul 2>&1
    if not errorlevel 1 set "PY_CMD=py"
)

REM ---------- 2. Install Node deps if missing ----------
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

REM ---------- 3. Regenerate + validate mocks catalog ----------
echo [2/4] Regenerating mocks catalog (mocks-data.js)...
if not defined PY_CMD (
    echo [ERROR] Python not found - cannot regenerate the catalog.
    echo         Install Python or run generate_mocks_data.py manually.
    pause
    exit /b 1
)
if not exist "..\generate_mocks_data.py" (
    echo [ERROR] generate_mocks_data.py not found in parent directory.
    pause
    exit /b 1
)

%PY_CMD% ..\generate_mocks_data.py
if errorlevel 1 (
    echo [ERROR] generate_mocks_data.py failed - catalog NOT updated.
    echo         Fix the generator error above, then re-run. Aborting so the
    echo         app never serves a stale or partial catalog.
    pause
    exit /b 1
)

REM Validate the generated catalog: present, non-empty, and parses as the
REM `const MOCK_DATA = [...];` contract mockCatalog.ts expects. A 0-mock or
REM malformed file would 404 every exam, so refuse to start on it.
REM NOTE: the file also carries a trailing `const MOCK_PATH_MAP = {...};`
REM statement, so slice up to the array's closing `]` before json.loads --
REM rstrip(';') alone leaves that extra statement behind and fails to parse.
%PY_CMD% -c "import re,sys,json,io; d=io.open(r'..\public\mocks-data.js',encoding='utf-8').read(); m=re.match(r'^\s*(?:(?://[^\r\n]*|/\*[\s\S]*?\*/)\s*)*(?:const|let|var)\s+MOCK_DATA\s*=\s*', d); a=json.loads(d[m.end():d.index('];',m.end())+1]) if m else None; sys.exit(0 if (isinstance(a,list) and len(a)>0) else 1)" 2>nul
if errorlevel 1 (
    echo [ERROR] mocks-data.js is missing, empty, or malformed.
    echo         The app would have no mocks to serve. Aborting.
    pause
    exit /b 1
)

REM Report the catalog size so a silent drop in mock count is visible.
for /f "delims=" %%c in ('%PY_CMD% -c "import re,json,io; d=io.open(r'..\public\mocks-data.js',encoding='utf-8').read(); m=re.match(r'^\s*(?:(?://[^\r\n]*|/\*[\s\S]*?\*/)\s*)*(?:const|let|var)\s+MOCK_DATA\s*=\s*', d); print(len(json.loads(d[m.end():d.index('];',m.end())+1])))"') do set "MOCK_COUNT=%%c"
echo       [OK] Catalog valid - %MOCK_COUNT% mocks indexed.
echo.

REM ---------- 4. Start BACKEND static server on :8080 ----------
echo [3/4] Starting BACKEND static server on http://localhost:8080 ...
if defined PY_CMD (
    netstat -ano | findstr :8080 | findstr LISTENING >nul 2>&1
    if errorlevel 1 (
        start "Aether Backend :8080" /min cmd /c "%PY_CMD% -m http.server 8080 --bind 127.0.0.1 --directory ..\public"
        timeout /t 2 /nobreak >nul
        echo       [OK] Backend started -^> http://localhost:8080
    ) else (
        echo       [OK] Backend is already running on http://localhost:8080
    )
) else (
    echo       [WARN] Python not found - static backend could not be auto-started.
)
echo.

REM ---------- 5. Start FRONTEND (Vite dev) ----------
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
