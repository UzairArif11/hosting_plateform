@echo off
REM ========================================
REM EC1 - Complete Project Setup (Windows)
REM Main server: Backend + Frontend + MongoDB
REM ========================================

echo ========================================
echo EC1 - Complete Project Setup
echo ========================================
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please run as Administrator!
    echo Right-click this file and select "Run as Administrator"
    pause
    exit /b 1
)

echo Step 1: Checking prerequisites...
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js installed

REM Check Docker
docker --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Docker is not installed!
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo [OK] Docker installed

echo.
echo Step 2: Installing dependencies...
echo.

REM Install backend dependencies
echo Installing backend dependencies...
cd backend
call npm install
if %errorLevel% neq 0 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b 1
)
cd ..

REM Install frontend dependencies
echo Installing frontend dependencies...
cd frontend
call npm install
if %errorLevel% neq 0 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo Step 3: Setting up environment files...
echo.

REM Create backend .env if not exists
if not exist "backend\.env" (
    echo Creating backend/.env...
    (
        echo # Server
        echo PORT=5000
        echo NODE_ENV=development
        echo.
        echo # Frontend
        echo FRONTEND_URL=http://localhost:3000
        echo.
        echo # MongoDB
        echo MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin
        echo.
        echo # JWT ^& Session
        echo JWT_SECRET=your-secret-key-change-this-in-production
        echo SESSION_SECRET=your-session-secret-change-this-in-production
        echo.
        echo # GitHub OAuth
        echo GITHUB_CLIENT_ID=your_github_client_id
        echo GITHUB_CLIENT_SECRET=your_github_client_secret
        echo GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
        echo.
        echo # Google OAuth
        echo GOOGLE_CLIENT_ID=your_google_client_id
        echo GOOGLE_CLIENT_SECRET=your_google_client_secret
        echo GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
        echo.
        echo # Oracle Cloud Servers ^(add your IPs here^)
        echo # EC2_SERVER_IP=your_ec2_ip
        echo # EC3_SERVER_IP=your_ec3_ip
    ) > backend\.env
    echo [OK] Created backend/.env
    echo.
    echo IMPORTANT: Edit backend/.env and add your OAuth credentials!
    echo.
) else (
    echo [OK] backend/.env already exists
)

REM Create frontend .env.local if not exists
if not exist "frontend\.env.local" (
    echo Creating frontend/.env.local...
    echo NEXT_PUBLIC_API_URL=http://localhost:5000 > frontend\.env.local
    echo [OK] Created frontend/.env.local
) else (
    echo [OK] frontend/.env.local already exists
)

echo.
echo Step 4: Starting MongoDB...
echo.

REM Start MongoDB with Docker Compose
docker-compose up -d
if %errorLevel% neq 0 (
    echo ERROR: Failed to start MongoDB
    pause
    exit /b 1
)

echo [OK] MongoDB started
echo Waiting for MongoDB to be ready...
timeout /t 5 /nobreak >nul

echo.
echo Step 5: Creating initial database setup...
echo.

REM Wait for MongoDB to be fully ready
echo Waiting for MongoDB connection...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Edit backend/.env and add your OAuth credentials:
echo    - GITHUB_CLIENT_ID
echo    - GITHUB_CLIENT_SECRET
echo    - GOOGLE_CLIENT_ID
echo    - GOOGLE_CLIENT_SECRET
echo.
echo 2. Start the backend:
echo    cd backend
echo    npm run dev
echo.
echo 3. Start the frontend (in a new terminal):
echo    cd frontend
echo    npm run dev
echo.
echo 4. Access the application:
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:5000
echo    MongoDB:  http://localhost:8081 (admin/password123)
echo.
echo 5. Make yourself admin:
echo    cd backend
echo    node make-admin.js your-email@gmail.com
echo.
echo ========================================
echo.
pause
