@echo off
setlocal enabledelayedexpansion

REM Fast enterprise build script - parallelizes installations and builds

set ROOT_DIR=%~dp0..

echo.
echo 🚀 Starting optimized enterprise build...
echo.

REM 1. Install root dependencies
echo 📦 Installing root dependencies...
cd /d "%ROOT_DIR%"
call pnpm install --frozen-lockfile
if !errorlevel! neq 0 exit /b !errorlevel!

REM 2. Install API and Web (sequential due to Windows limitations)
REM Note: Windows batch doesn't support parallel execution well
echo.
echo 📦 Installing API dependencies...
cd /d "%ROOT_DIR%\apps\api"
call pnpm install --frozen-lockfile
if !errorlevel! neq 0 exit /b !errorlevel!

echo 📦 Installing Web dependencies...
cd /d "%ROOT_DIR%\apps\web"
call pnpm install --frozen-lockfile
if !errorlevel! neq 0 exit /b !errorlevel!

REM 3. Build API and Web (sequential)
echo.
echo 🔨 Building API...
cd /d "%ROOT_DIR%\apps\api"
call pnpm run build
if !errorlevel! neq 0 exit /b !errorlevel!

echo 🔨 Building Web...
cd /d "%ROOT_DIR%\apps\web"
call pnpm run build
if !errorlevel! neq 0 exit /b !errorlevel!

REM 4. Prepare enterprise runtime
echo.
echo 📋 Preparing enterprise runtime...
cd /d "%ROOT_DIR%\apps\desktop"
call pnpm run prepare:enterprise-runtime
if !errorlevel! neq 0 exit /b !errorlevel!

REM 5. Build enterprise MSI
echo.
echo 📦 Building MSI installer...
call pnpm run tauri:build:enterprise
if !errorlevel! neq 0 exit /b !errorlevel!

echo.
echo ✅ Build complete!
echo.
echo Output:
dir "%ROOT_DIR%\apps\desktop\src-tauri\target\release\bundle\msi\"

cd /d "%ROOT_DIR%"
