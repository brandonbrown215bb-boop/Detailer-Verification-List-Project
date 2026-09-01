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
echo [2/3] Running Node.js AST Converter Tests...
node scripts/test_ast_converter.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Node.js AST converter tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 5. Run Live Readiness Predicate Validation Tests (M1)
echo.
echo [3/4] Running Live Readiness Predicate Tests (M1)...
node scripts/test_readiness.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Live readiness predicate tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 6. Run Adversarial Stress Tests (M1)
echo.
echo [4/5] Running Adversarial Stress Tests (M1)...
node scripts/stress_test_readiness_adversarial.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Adversarial stress tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 7. Run Modal & Keyboard Accessibility Tests (M2)
echo.
echo [5/7] Running Modal & Keyboard Accessibility Tests (M2)...
node scripts/test_modal_accessibility.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Modal and keyboard accessibility tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 8. Run File Ingestion & Action Feedback Tests (M3)
echo.
echo [6/8] Running File Ingestion & Action Feedback Tests (M3)...
node scripts/test_ingestion_feedback.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] File ingestion and action feedback tests failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 9. Run Copywriting & LaTeX Sanitization Linter (M4)
echo.
echo [7/8] Running Copywriting & Terminology Linter (M4)...
node scripts/test_copy_linter.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Copywriting and terminology linter failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 10. Run Responsive Layout & Contrast Tests (M5)
echo.
echo [8/8] Running Responsive Layout & Contrast Tests (M5)...
node scripts/test_responsive_contrast.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Responsive layout and contrast tests failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ======================================================================
echo  [SUCCESS] All unit tests and verification checks passed!
echo ======================================================================
pause
