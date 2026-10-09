@echo off
cd /d "%~dp0"
call pnpm exec expo start --port 8081
