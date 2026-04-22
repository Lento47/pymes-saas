@echo off
setlocal enabledelayedexpansion

REM Build Enterprise Bundle - empaqueta API, Web y Node.js para el Tauri app

set ROOT_DIR=%~dp0..
set BUNDLE_DIR=%ROOT_DIR%\.enterprise-runtime-bundle
set API_SRC=%ROOT_DIR%\apps\api
set WEB_SRC=%ROOT_DIR%\apps\web

echo.
echo 🔨 Building Enterprise Runtime Bundle...
echo.

REM Clean previous bundle
if exist "%BUNDLE_DIR%" rmdir /s /q "%BUNDLE_DIR%"
mkdir "%BUNDLE_DIR%"

REM Build API
echo 📦 Building API...
cd /d "%API_SRC%"
call pnpm install --frozen-lockfile
if !errorlevel! neq 0 exit /b !errorlevel!
call pnpm run build
if !errorlevel! neq 0 exit /b !errorlevel!
call pnpm prune --prod
if !errorlevel! neq 0 exit /b !errorlevel!

REM Copy API to bundle
echo 📋 Packaging API...
mkdir "%BUNDLE_DIR%\a"
xcopy "%API_SRC%\dist" "%BUNDLE_DIR%\a\dist" /e /i /y
xcopy "%API_SRC%\node_modules" "%BUNDLE_DIR%\a\node_modules" /e /i /y
xcopy "%API_SRC%\prisma" "%BUNDLE_DIR%\a\prisma" /e /i /y
if exist "%API_SRC%\.env.enterprise.example" (
  copy "%API_SRC%\.env.enterprise.example" "%BUNDLE_DIR%\a\"
)

REM Copy schema.sql to API bundle
echo 📄 Adding database schema...
if exist "%API_SRC%\prisma\schema.enterprise.sqlite.sql" (
  copy "%API_SRC%\prisma\schema.enterprise.sqlite.sql" "%BUNDLE_DIR%\a\schema.sql"
) else (
  echo ⚠️  Warning: schema.enterprise.sqlite.sql not found, generating...
  cd /d "%API_SRC%"
  call pnpm run db:generate:enterprise
  if !errorlevel! neq 0 exit /b !errorlevel!
  copy "%API_SRC%\prisma\schema.enterprise.sqlite.sql" "%BUNDLE_DIR%\a\schema.sql"
)

REM Build Web
echo 🌐 Building Web...
cd /d "%WEB_SRC%"
call pnpm install --frozen-lockfile
if !errorlevel! neq 0 exit /b !errorlevel!
call pnpm run build
if !errorlevel! neq 0 exit /b !errorlevel!

REM Copy Web to bundle
echo 📋 Packaging Web...
mkdir "%BUNDLE_DIR%\w"
xcopy "%WEB_SRC%\dist" "%BUNDLE_DIR%\w\dist" /e /i /y
copy "%WEB_SRC%\package.json" "%BUNDLE_DIR%\w\"
xcopy "%WEB_SRC%\node_modules" "%BUNDLE_DIR%\w\node_modules" /e /i /y

echo.
echo ✅ Enterprise Runtime Bundle ready at %BUNDLE_DIR%
echo.
echo Next steps:
echo 1. Copy .enterprise-runtime-bundle to apps\desktop\src-tauri\resources\
echo 2. Run: pnpm --filter @pymeshub/desktop tauri:build:enterprise
echo.

cd /d "%ROOT_DIR%"
