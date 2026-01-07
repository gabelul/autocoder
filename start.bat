@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo   AutoCoder - Autonomous Coding Agent
echo ========================================
echo.

REM Load .env file if it exists
if exist .env (
    for /f "tokens=1,2 delims==" %%a in ('type .env ^| findstr /v "^#" ^| findstr /v "^$"') do (
        set %%a=%%b
    )
)

REM Run autocoder CLI
autocoder

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] autocoder command not found
    echo.
    echo Please install the package first:
    echo   pip install -e '.[dev]'
    echo.
    pause
    exit /b 1
)
