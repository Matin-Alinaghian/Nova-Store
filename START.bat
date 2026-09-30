@echo off
cd /d "%~dp0"

echo.

python --version >nul 2>&1

if errorlevel 1 (
    pause
    exit /b 1
)

python --version
echo.

if not exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" (
    echo.
    echo C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe
    echo.
    pause
    exit /b 1
)

echo.

echo.

python -m pip install -r requirements.txt

if errorlevel 1 (
    echo.
    pause
    exit /b 1
)

echo.
echo.

if not exist ".env" (
    echo.
    echo.
    pause
    exit /b 1
)

echo.

echo.
echo.
echo http://localhost:5000
echo.
echo.

python backend/app.py

if errorlevel 1 (
    echo.
    echo.
    pause
    exit /b 1
)

pause