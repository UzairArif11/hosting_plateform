# 🔍 BACKEND MONITORING SCRIPT

Write-Host "🚀 Starting Backend Server with Monitoring..." -ForegroundColor Green
Write-Host ""

# Navigate to backend directory
Set-Location "d:\work\platform\backend"

# Start backend in background and capture output
Write-Host "📝 Starting backend server..." -ForegroundColor Cyan
$job = Start-Job -ScriptBlock {
    Set-Location "d:\work\platform\backend"
    npm run dev 2>&1
}

# Wait a moment for server to start
Start-Sleep -Seconds 3

Write-Host "✅ Backend started! Job ID: $($job.Id)" -ForegroundColor Green
Write-Host ""
Write-Host "📊 MONITORING LOGS - Watch for these events:" -ForegroundColor Yellow
Write-Host "  🚀 [CREATE_CONTAINER] - Container creation" -ForegroundColor Cyan
Write-Host "  🚀 [DEPLOY_PROJECT] - Project deployment" -ForegroundColor Cyan
Write-Host "  🐳 Docker operations" -ForegroundColor Cyan
Write-Host "  📦 File copying" -ForegroundColor Cyan
Write-Host "  🎯 PM2 process start" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Yellow
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

# Monitor job output
try {
    while ($true) {
        $output = Receive-Job -Job $job
        if ($output) {
            foreach ($line in $output) {
                # Color code different log types
                if ($line -match "\[CREATE_CONTAINER\]") {
                    Write-Host $line -ForegroundColor Green
                } elseif ($line -match "\[DEPLOY_PROJECT\]") {
                    Write-Host $line -ForegroundColor Cyan
                } elseif ($line -match "ERROR|❌") {
                    Write-Host $line -ForegroundColor Red
                } elseif ($line -match "✅|SUCCESS") {
                    Write-Host $line -ForegroundColor Green
                } elseif ($line -match "⚠️|WARN") {
                    Write-Host $line -ForegroundColor Yellow
                } else {
                    Write-Host $line
                }
            }
        }
        Start-Sleep -Milliseconds 100
    }
} finally {
    Write-Host ""
    Write-Host "🛑 Stopping backend server..." -ForegroundColor Yellow
    Stop-Job -Job $job
    Remove-Job -Job $job
    Write-Host "✅ Backend stopped" -ForegroundColor Green
}
