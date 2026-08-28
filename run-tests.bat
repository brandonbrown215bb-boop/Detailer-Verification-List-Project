@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Automated Test Suite
echo ======================================================================
echo.

call "%~dp0scripts\init_env.bat"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b %ERRORLEVEL%
)

REM 3. Run C# xUnit Test Suite
echo [1/2] Running C# xUnit Verification Tests...
dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --logger "console;verbosity=normal"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] C# xUnit test suite failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 4. Run Node.js AST Converter Tests
echo.
echo [2/2] Running Node.js AST Converter Tests...
node scripts/test_ast_converter.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Node.js AST converter tests failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ======================================================================
echo  [SUCCESS] All unit tests and verification checks passed!
echo ======================================================================
pause
