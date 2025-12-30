# Simple Build Script for Custom PM2 Image
# Run each step manually

Write-Host "🏗️  Step 1: Building Docker image locally..." -ForegroundColor Yellow
Write-Host "This will take about 2 minutes..."
Write-Host ""
Write-Host "Run this command:" -ForegroundColor Cyan
Write-Host "docker build -t node-pm2-alpine:latest -f Dockerfile.pm2 ." -ForegroundColor Green
Write-Host ""
Write-Host "Press Enter when done to continue..."
$null = Read-Host

Write-Host ""
Write-Host "📤 Step 2: Save image to tar file..." -ForegroundColor Yellow
Write-Host "Run this command:" -ForegroundColor Cyan
Write-Host "docker save node-pm2-alpine:latest | gzip > node-pm2-alpine.tar.gz" -ForegroundColor Green
Write-Host ""
Write-Host "Press Enter when done to continue..."
$null = Read-Host

Write-Host ""
Write-Host "🚀 Step 3: Upload to EC3 server..." -ForegroundColor Yellow
Write-Host "Run this command:" -ForegroundColor Cyan
Write-Host "scp -i `$env:SSH_EC3_KEY node-pm2-alpine.tar.gz ubuntu@`$env:EC3_HOST:/tmp/" -ForegroundColor Green
Write-Host ""
Write-Host "Press Enter when done to continue..."
$null = Read-Host

Write-Host ""
Write-Host "📥 Step 4: Load on EC3 server..." -ForegroundColor Yellow
Write-Host "Run these commands:" -ForegroundColor Cyan
Write-Host "ssh -i `$env:SSH_EC3_KEY ubuntu@`$env:EC3_HOST" -ForegroundColor Green
Write-Host "Then on the server:" -ForegroundColor Gray
Write-Host "  docker load < /tmp/node-pm2-alpine.tar.gz" -ForegroundColor Green
Write-Host "  rm /tmp/node-pm2-alpine.tar.gz" -ForegroundColor Green
Write-Host "  exit" -ForegroundColor Green
Write-Host ""
Write-Host "Press Enter when done..."
$null = Read-Host

Write-Host ""
Write-Host "🧹 Step 5: Clean up local tar file..." -ForegroundColor Yellow
Remove-Item -Path node-pm2-alpine.tar.gz -Force -ErrorAction SilentlyContinue
Write-Host "✅ Done!"
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🎉 READY TO USE!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Now restart your backend and try deploying!" -ForegroundColor White
