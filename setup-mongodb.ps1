# MongoDB Setup Script for Vercel Clone Platform
# This script helps you manage the MongoDB Docker container

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "shell")]
    [string]$Action = "start"
)

Write-Host "=== MongoDB Docker Management Script ===" -ForegroundColor Cyan
Write-Host "Project: Vercel Clone Platform" -ForegroundColor Gray
Write-Host ""

function Start-MongoDB {
    Write-Host "Starting MongoDB containers..." -ForegroundColor Yellow
    docker-compose up -d mongodb mongo-express
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MongoDB containers started successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "MongoDB Connection Details:" -ForegroundColor Cyan
        Write-Host "  Host: localhost" -ForegroundColor White
        Write-Host "  Port: 27017" -ForegroundColor White
        Write-Host "  Database: vercel_clone" -ForegroundColor White
        Write-Host "  Username: admin" -ForegroundColor White
        Write-Host "  Password: password123" -ForegroundColor White
        Write-Host ""
        Write-Host "MongoDB Express (Web UI):" -ForegroundColor Cyan
        Write-Host "  URL: http://localhost:8081" -ForegroundColor White
        Write-Host ""
        Write-Host "Connection String:" -ForegroundColor Cyan
        Write-Host "  mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin" -ForegroundColor White
    } else {
        Write-Host "❌ Failed to start MongoDB containers!" -ForegroundColor Red
    }
}

function Stop-MongoDB {
    Write-Host "Stopping MongoDB containers..." -ForegroundColor Yellow
    docker-compose down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MongoDB containers stopped successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to stop MongoDB containers!" -ForegroundColor Red
    }
}

function Restart-MongoDB {
    Write-Host "Restarting MongoDB containers..." -ForegroundColor Yellow
    docker-compose restart mongodb mongo-express
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MongoDB containers restarted successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to restart MongoDB containers!" -ForegroundColor Red
    }
}

function Show-Status {
    Write-Host "Checking MongoDB container status..." -ForegroundColor Yellow
    Write-Host ""
    
    docker-compose ps
    
    Write-Host ""
    Write-Host "Container Health:" -ForegroundColor Cyan
    docker ps --filter "name=vercel-clone-mongodb" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    docker ps --filter "name=vercel-clone-mongo-express" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

function Show-Logs {
    Write-Host "Showing MongoDB logs..." -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to exit logs view" -ForegroundColor Gray
    Write-Host ""
    docker-compose logs -f mongodb
}

function Open-Shell {
    Write-Host "Opening MongoDB shell..." -ForegroundColor Yellow
    Write-Host "You'll be connected to the vercel_clone database" -ForegroundColor Gray
    Write-Host "Type 'exit' to close the shell" -ForegroundColor Gray
    Write-Host ""
    docker exec -it vercel-clone-mongodb mongosh -u admin -p password123 --authenticationDatabase admin vercel_clone
}

# Check if Docker is running
try {
    docker version | Out-Null
} catch {
    Write-Host "❌ Docker is not running or not installed!" -ForegroundColor Red
    Write-Host "Please make sure Docker Desktop is running." -ForegroundColor Yellow
    exit 1
}

# Execute the requested action
switch ($Action.ToLower()) {
    "start" { Start-MongoDB }
    "stop" { Stop-MongoDB }
    "restart" { Restart-MongoDB }
    "status" { Show-Status }
    "logs" { Show-Logs }
    "shell" { Open-Shell }
    default { 
        Write-Host "Invalid action. Use: start, stop, restart, status, logs, or shell" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=== Script completed ===" -ForegroundColor Cyan
