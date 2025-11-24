// MongoDB initialization script for Vercel Clone Platform
// This script runs when MongoDB container starts for the first time

print('Starting MongoDB initialization...');

// Switch to the vercel_clone database
db = db.getSiblingDB('vercel_clone');

// Create collections with validation schemas
print('Creating users collection...');
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "createdAt"],
      properties: {
        email: {
          bsonType: "string",
          description: "must be a string and is required"
        },
        password: {
          bsonType: "string",
          description: "must be a string"
        },
        githubId: {
          bsonType: "string",
          description: "GitHub user ID"
        },
        name: {
          bsonType: "string",
          description: "User display name"
        },
        avatar: {
          bsonType: "string",
          description: "User avatar URL"
        },
        plan: {
          enum: ["free", "pro", "enterprise"],
          description: "User subscription plan"
        },
        createdAt: {
          bsonType: "date",
          description: "Account creation date"
        },
        updatedAt: {
          bsonType: "date",
          description: "Last update date"
        }
      }
    }
  }
});

print('Creating projects collection...');
db.createCollection('projects', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "userId", "createdAt"],
      properties: {
        name: {
          bsonType: "string",
          description: "Project name is required"
        },
        userId: {
          bsonType: "objectId",
          description: "User ID reference is required"
        },
        repository: {
          bsonType: "object",
          description: "GitHub repository information"
        },
        deployments: {
          bsonType: "array",
          description: "Array of deployment records"
        },
        settings: {
          bsonType: "object",
          description: "Project configuration settings"
        },
        createdAt: {
          bsonType: "date",
          description: "Project creation date"
        },
        updatedAt: {
          bsonType: "date",
          description: "Last update date"
        }
      }
    }
  }
});

print('Creating deployments collection...');
db.createCollection('deployments', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["projectId", "status", "createdAt"],
      properties: {
        projectId: {
          bsonType: "objectId",
          description: "Project ID reference is required"
        },
        status: {
          enum: ["pending", "building", "ready", "error", "cancelled"],
          description: "Deployment status"
        },
        commitSha: {
          bsonType: "string",
          description: "Git commit SHA"
        },
        branch: {
          bsonType: "string",
          description: "Git branch name"
        },
        url: {
          bsonType: "string",
          description: "Deployment URL"
        },
        logs: {
          bsonType: "array",
          description: "Build and deployment logs"
        },
        createdAt: {
          bsonType: "date",
          description: "Deployment creation date"
        },
        updatedAt: {
          bsonType: "date",
          description: "Last update date"
        }
      }
    }
  }
});

print('Creating plans collection...');
db.createCollection('plans', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "price", "features"],
      properties: {
        name: {
          enum: ["free", "pro", "enterprise"],
          description: "Plan name"
        },
        price: {
          bsonType: "number",
          description: "Monthly price in USD"
        },
        features: {
          bsonType: "object",
          description: "Plan features and limits"
        }
      }
    }
  }
});

// Create indexes for better performance
print('Creating indexes...');

// Users indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "githubId": 1 }, { unique: true, sparse: true });

// Projects indexes
db.projects.createIndex({ "userId": 1 });
db.projects.createIndex({ "name": 1, "userId": 1 }, { unique: true });

// Deployments indexes
db.deployments.createIndex({ "projectId": 1 });
db.deployments.createIndex({ "status": 1 });
db.deployments.createIndex({ "createdAt": -1 });

// Insert default plans
print('Inserting default plans...');
db.plans.insertMany([
  {
    name: "free",
    price: 0,
    features: {
      projects: 3,
      deployments: 100,
      bandwidth: "100GB",
      buildMinutes: 100,
      teamMembers: 1,
      customDomain: false,
      analytics: false
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "pro",
    price: 20,
    features: {
      projects: 100,
      deployments: 1000,
      bandwidth: "1TB",
      buildMinutes: 1000,
      teamMembers: 10,
      customDomain: true,
      analytics: true
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "enterprise",
    price: 100,
    features: {
      projects: -1, // unlimited
      deployments: -1, // unlimited
      bandwidth: "10TB",
      buildMinutes: 5000,
      teamMembers: 50,
      customDomain: true,
      analytics: true,
      priority: true,
      sla: "99.9%"
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('MongoDB initialization completed successfully!');
