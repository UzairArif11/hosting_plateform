@echo off
echo Starting MongoDB for Vercel Clone Platform...
docker-compose up -d mongodb mongo-express

if %errorlevel% == 0 (
    echo.
    echo ✅ MongoDB started successfully!
    echo.
    echo MongoDB Connection:
    echo   Host: localhost:27017
    echo   Database: vercel_clone
    echo   Username: admin
    echo   Password: password123
    echo.
    echo Web UI: http://localhost:8081
    echo.
    echo Connection String:
    echo mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin
) else (
    echo ❌ Failed to start MongoDB!
)

pause
