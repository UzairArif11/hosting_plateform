# Build Custom PM2 Image - Windows PowerShell Version
# Run this script to build and deploy the optimized PM2 image to EC3

Write-Host "🏗️  Building Custom PM2 Image for Hosting Platform" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$IMAGE_NAME = "node-pm2-alpine"
$IMAGE_TAG = "latest"
$FULL_IMAGE = "${IMAGE_NAME}:${IMAGE_TAG}"

# Load environment variables
if (Test-Path "../.env") {
    Get-Content "../.env" | ForEach-Object {
        if ($_ -match "^([^#].+?)=(.*)$") {
            Set-Variable -Name $matches[1] -Value $matches[2]
        }
    }
} else {
    Write-Host "❌ .env file not found. Please create one with EC3_HOST and SSH_EC3_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Step 1: Building Docker image locally..." -ForegroundColor Yellow
docker build -t $FULL_IMAGE -f Dockerfile.pm2 .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Image built successfully: $FULL_IMAGE" -ForegroundColor Green
} else {
    Write-Host "❌ Image build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📤 Step 2: Saving image to tar archive..." -ForegroundColor Yellow
docker save $FULL_IMAGE | gzip > node-pm2-alpine.tar.gz

if ($LASTEXITCODE -eq 0) {
    $fileSize = (Get-Item node-pm2-alpine.tar.gz).Length / 1MB
    Write-Host "✅ Image saved: node-pm2-alpine.tar.gz ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host "❌ Image save failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Step 3: Uploading to EC3 server..." -ForegroundColor Yellow
scp -i $env:SSH_EC3_KEY node-pm2-alpine.tar.gz "${env:SSH_USERNAME}@${env:EC3_HOST}:/tmp/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Image uploaded to EC3" -ForegroundColor Green
} else {
    Write-Host "❌ Upload failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📥 Step 4: Loading image on EC3 server..." -ForegroundColor Yellow
ssh -i $env:SSH_EC3_KEY "${env:SSH_USERNAME}@${env:EC3_HOST}" @"
    echo 'Loading Docker image...'
    docker load < /tmp/node-pm2-alpine.tar.gz
    echo 'Verifying image...'
    docker images | grep node-pm2-alpine
    echo 'Cleaning up tar file...'
    rm -f /tmp/node-pm2-alpine.tar.gz
"@

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Image loaded on EC3" -ForegroundColor Green
} else {
    Write-Host "❌ Load failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🧹 Step 5: Cleaning up local tar file..." -ForegroundColor Yellow
Remove-Item -Path node-pm2-alpine.tar.gz -Force
Write-Host "✅ Cleanup complete" -ForegroundColor Green

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🎉 CUSTOM PM2 IMAGE DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Image: $FULL_IMAGE" -ForegroundColor White
Write-Host "Location: EC3 Server" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. The code has already been updated to use '$FULL_IMAGE'" -ForegroundColor White
Write-Host "2. Restart your platform backend (Ctrl+C and npm run dev)" -ForegroundColor White
Write-Host "3. Try deploying - containers will start in <1 second!" -ForegroundColor White
Write-Host ""
