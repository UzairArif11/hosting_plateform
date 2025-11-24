# MongoDB Docker Setup - Quick Reference

## ✅ Setup Complete!

Your MongoDB Docker environment is now running and ready to use.

## Current Status
- ✅ MongoDB 7.0 container: **Running**
- ✅ Mongo Express web UI: **Running**
- ✅ Database initialized: **vercel_clone**
- ✅ Collections created: **users, projects, deployments, plans**
- ✅ Default plans inserted: **free, pro, enterprise**
- ✅ Indexes created for performance

## Access Information

### MongoDB Database
- **Host**: localhost:27017
- **Database**: vercel_clone
- **Username**: admin
- **Password**: password123
- **Connection String**: `mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin`

### Web Interface (Mongo Express)
- **URL**: http://localhost:8081
- **Authentication**: None required (development only)

## Management Commands

### PowerShell Script (Recommended)
```powershell
# Start MongoDB
.\setup-mongodb.ps1 start

# Check status  
.\setup-mongodb.ps1 status

# View logs
.\setup-mongodb.ps1 logs

# Open MongoDB shell
.\setup-mongodb.ps1 shell

# Stop MongoDB
.\setup-mongodb.ps1 stop

# Restart MongoDB
.\setup-mongodb.ps1 restart
```

### Quick Start (Double-click)
- Run `mongodb-start.bat` to start MongoDB instantly

### Docker Compose
```bash
# Start services
docker-compose up -d mongodb mongo-express

# Stop services
docker-compose down

# Check status
docker-compose ps
```

## Backend Integration

Your backend environment file (`.env.example`) has been updated with the correct MongoDB URI:
```
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin
```

To use this in your backend:
1. Copy `.env.example` to `.env` in the backend directory
2. Update any other environment variables as needed
3. Your Node.js application will now connect to the MongoDB container

## Database Schema

The following collections are ready to use:

- **users**: User accounts and profiles
- **projects**: User projects and repositories
- **deployments**: Deployment history and status
- **plans**: Subscription plans (free, pro, enterprise)

## Next Steps

1. **Start your backend**: Navigate to the backend directory and run `npm start`
2. **Test connection**: Your backend should now connect to MongoDB automatically
3. **View data**: Use Mongo Express at http://localhost:8081 to browse your data
4. **Development**: You can now create users, projects, and deployments

## Troubleshooting

If you encounter issues:
1. Run `.\setup-mongodb.ps1 status` to check container health
2. View logs with `.\setup-mongodb.ps1 logs`
3. Restart with `.\setup-mongodb.ps1 restart`

## Data Persistence

Your data is automatically persisted in Docker volumes:
- `vercel-clone-platform_mongodb_data`
- `vercel-clone-platform_mongodb_config`

Data will survive container restarts and system reboots.

---
**Ready to develop!** Your MongoDB environment is fully configured and running.
