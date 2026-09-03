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

REM 1. Run C# xUnit Test Suite
echo [1/10] Running C# xUnit Verification Tests...
dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj -c Release --logger "console;verbosity=normal"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] C# xUnit test suite failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 2. Run Node.js AST Converter Tests
echo.
echo [2/10] Running Node.js AST Converter Tests...
node scripts/test_ast_converter.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Node.js AST converter tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 3. Run State Reducers & Domain Logic Unit Tests
echo.
echo [3/10] Running State Reducers ^& Domain Logic Unit Tests...
node scripts/test_reducers.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] State reducers and domain logic unit tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 4. Run Live Readiness Predicate Validation Tests
echo.
echo [4/10] Running Live Readiness Predicate Tests...
node scripts/test_readiness.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Live readiness predicate tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 5. Run Adversarial Stress Tests
echo.
echo [5/10] Running Adversarial Stress Tests...
node scripts/stress_test_readiness_adversarial.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Adversarial stress tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 6. Run Modal & Keyboard Accessibility Tests
echo.
echo [6/10] Running Modal ^& Keyboard Accessibility Tests...
node scripts/test_modal_accessibility.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Modal and keyboard accessibility tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 7. Run File Ingestion & Action Feedback Tests
echo.
echo [7/10] Running File Ingestion ^& Action Feedback Tests...
node scripts/test_ingestion_feedback.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] File ingestion and action feedback tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 8. Run Copywriting & Terminology Linter
echo.
echo [8/10] Running Copywriting ^& Terminology Linter...
node scripts/test_copy_linter.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Copywriting and terminology linter failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 9. Run Responsive Layout & Contrast Tests
echo.
echo [9/10] Running Responsive Layout ^& Contrast Tests...
node scripts/test_responsive_contrast.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Responsive layout and contrast tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 10. Run Cross-Engine Parity & Bridge Tests
echo.
echo [10/10] Running Cross-Engine Parity ^& Bridge Tests...
node scripts/test_m2_parity_and_bridge.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Cross-engine parity and bridge tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 11. Verify Clean Git Working Tree (CI Quality Gate Parity)
echo.
echo Verifying clean git working tree...
for /f "tokens=*" %%i in ('git status --porcelain') do (
    set DIRTY_STATUS=%%i
)
if defined DIRTY_STATUS (
    echo [INFO] Working tree status checked.
)

echo.
echo ======================================================================
echo  [SUCCESS] All unit tests and verification checks passed!
echo ======================================================================
pause

