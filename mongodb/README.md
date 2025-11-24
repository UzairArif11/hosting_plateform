# MongoDB Setup for Vercel Clone Platform

This directory contains the MongoDB configuration and initialization scripts for the Vercel Clone Platform.

## Quick Start

### Option 1: Using PowerShell Script (Recommended)
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
```

### Option 2: Using Batch File
```cmd
# Double-click mongodb-start.bat or run:
.\mongodb-start.bat
```

### Option 3: Using Docker Compose Directly
```bash
# Start MongoDB and Mongo Express
docker-compose up -d mongodb mongo-express

# Check status
docker-compose ps

# Stop containers
docker-compose down
```

## Connection Details

- **Host**: localhost
- **Port**: 27017
- **Database**: vercel_clone
- **Username**: admin
- **Password**: password123
- **Auth Database**: admin

### Connection String
```
mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin
```

## Web Interface

MongoDB Express provides a web-based admin interface:
- **URL**: http://localhost:8081
- **No authentication required** (development only)

## Database Schema

The initialization script creates the following collections:

### Users Collection
```javascript
{
  email: String (required, unique),
  password: String,
  githubId: String (unique),
  name: String,
  avatar: String,
  plan: ["free", "pro", "enterprise"],
  createdAt: Date (required),
  updatedAt: Date
}
```

### Projects Collection
```javascript
{
  name: String (required),
  userId: ObjectId (required, references users),
  repository: Object,
  deployments: Array,
  settings: Object,
  createdAt: Date (required),
  updatedAt: Date
}
```

### Deployments Collection
```javascript
{
  projectId: ObjectId (required, references projects),
  status: ["pending", "building", "ready", "error", "cancelled"],
  commitSha: String,
  branch: String,
  url: String,
  logs: Array,
  createdAt: Date (required),
  updatedAt: Date
}
```

### Plans Collection
```javascript
{
  name: ["free", "pro", "enterprise"],
  price: Number,
  features: Object
}
```

## Default Data

The initialization script creates three default plans:

1. **Free Plan** ($0/month)
   - 3 projects
   - 100 deployments
   - 100GB bandwidth
   - 100 build minutes

2. **Pro Plan** ($20/month)
   - 100 projects
   - 1000 deployments
   - 1TB bandwidth
   - 1000 build minutes
   - Custom domains
   - Analytics

3. **Enterprise Plan** ($100/month)
   - Unlimited projects
   - Unlimited deployments
   - 10TB bandwidth
   - 5000 build minutes
   - 99.9% SLA
   - Priority support

## Indexes

The following indexes are created for optimal performance:

- `users.email` (unique)
- `users.githubId` (unique, sparse)
- `projects.userId`
- `projects.name + userId` (unique compound)
- `deployments.projectId`
- `deployments.status`
- `deployments.createdAt` (descending)

## Data Persistence

MongoDB data is persisted in Docker volumes:
- `mongodb_data`: Database files
- `mongodb_config`: Configuration files

To completely reset the database, remove these volumes:
```bash
docker-compose down
docker volume rm vercel-clone-platform_mongodb_data
docker volume rm vercel-clone-platform_mongodb_config
docker-compose up -d mongodb mongo-express
```

## Troubleshooting

### Container Won't Start
1. Check if Docker is running
2. Ensure ports 27017 and 8081 are not in use
3. Check Docker logs: `docker-compose logs mongodb`

### Connection Issues
1. Verify container is running: `docker-compose ps`
2. Check network connectivity: `docker network ls`
3. Test connection: `.\setup-mongodb.ps1 shell`

### Performance Issues
1. Monitor container resources: `docker stats vercel-clone-mongodb`
2. Check slow queries in MongoDB logs
3. Review index usage with MongoDB Compass or Mongo Express

## Security Notes

⚠️ **Development Only**: This configuration is for development purposes only.

For production deployment:
- Change default passwords
- Enable SSL/TLS
- Configure authentication properly
- Set up proper network security
- Enable MongoDB authentication
- Configure firewall rules
