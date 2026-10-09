Set-Location -LiteralPath $PSScriptRoot
Write-Host "=== PymesHub Mobile Server ===" -ForegroundColor Cyan
Write-Host "Expo starting on port 8081..." -ForegroundColor Green
pnpm exec expo start --port 8081
