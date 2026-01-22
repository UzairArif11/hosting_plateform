@echo off
echo ========================================
echo  RUNNING CRITICAL BUG FIXES
echo ========================================
echo.

cd /d "d:\work\platform"

echo [1/3] Checking Node.js...
node --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found!
    pause
    exit /b 1
)

echo.
echo [2/3] Running database migration script...
node fix-critical-bugs.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Migration script failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Done!
echo ========================================
echo.
echo  Next steps:
echo  1. Restart your backend server
echo  2. Test features in the admin panel
echo  3. Check the walkthrough.md for verification
echo.
echo ========================================
pause
