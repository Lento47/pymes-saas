@echo off
REM Validate that enterprise runtime bundle is complete before building MSI

setlocal enabledelayedexpansion

set ROOT_DIR=%~dp0..
set BUNDLE_DIR=%ROOT_DIR%\.enterprise-runtime-bundle
set TAURI_RESOURCES=%ROOT_DIR%\apps\desktop\src-tauri\resources\enterprise-runtime

echo Validating enterprise runtime bundle...
echo.

REM Check if bundle exists
if not exist "%BUNDLE_DIR%" (
  echo ❌ ERROR: .enterprise-runtime-bundle not found
  echo    Run: .\scripts\build-enterprise-bundle.bat
  exit /b 1
)

REM Required files in bundle
set MISSING=0

if not exist "%BUNDLE_DIR%\a\dist\src\main.js" (
  echo ❌ Missing: a\dist\src\main.js
  set /a MISSING=!MISSING!+1
) else (
  echo ✓ Found: main.js
)

if not exist "%BUNDLE_DIR%\a\schema.sql" (
  echo ❌ Missing: a\schema.sql
  set /a MISSING=!MISSING!+1
) else (
  echo ✓ Found: schema.sql
)

if not exist "%BUNDLE_DIR%\a\prisma\schema.prisma" (
  echo ❌ Missing: a\prisma\schema.prisma
  set /a MISSING=!MISSING!+1
) else (
  echo ✓ Found: schema.prisma
)

if not exist "%BUNDLE_DIR%\w\dist\index.cjs" (
  echo ❌ Missing: w\dist\index.cjs
  set /a MISSING=!MISSING!+1
) else (
  echo ✓ Found: index.cjs
)

if not exist "%BUNDLE_DIR%\a\node_modules" (
  echo ❌ Missing: a\node_modules
  set /a MISSING=!MISSING!+1
) else (
  echo ✓ Found: node_modules
)

if not exist "%BUNDLE_DIR%\w\node_modules" (
  echo ❌ Missing: w\node_modules
  set /a MISSING=!MISSING!+1
) else (
  echo ✓ Found: web node_modules
)

if !MISSING! gtr 0 (
  echo.
  echo ❌ Bundle validation failed (!MISSING! files missing^)
  echo    Run: .\scripts\build-enterprise-bundle.bat
  exit /b 1
)

echo.
echo ✅ Enterprise runtime bundle is valid
echo.

exit /b 0
