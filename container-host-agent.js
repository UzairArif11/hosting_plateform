// Container Host Agent - Functional Programming Approach
const express = require('express');
const Docker = require('dockerode');
const os = require('os');
const fs = require('fs').promises;

const app = express();
const docker = new Docker();

app.use(express.json());

// Pure function - Parse memory string to bytes
const parseMemoryToBytes = (memStr) => {
  const units = { 'g': 1073741824, 'm': 1048576, 'k': 1024 };
  const match = memStr.match(/^(\d+)([gmk])$/i);
  return match ? parseInt(match[1]) * units[match[2].toLowerCase()] : 512 * 1048576;
};

// Pure function - Create container configuration
const createContainerConfig = (userId, config) => ({
  name: config.name || `user-${userId}-container`,
  Image: config.image || 'user-workspace:latest',
  Env: [
    `USER_ID=${userId}`,
    `PLAN=${config.env?.PLAN || 'free'}`,
    `MAX_PROJECTS=${config.env?.MAX_PROJECTS || 3}`,
    `MAX_DEPLOYMENTS=${config.env?.MAX_DEPLOYMENTS || 10}`
  ],
  HostConfig: {
    Memory: parseMemoryToBytes(config.resources?.memory || '512m'),
    CpuShares: (config.resources?.cpu || 0.5) * 1024,
    RestartPolicy: { Name: 'unless-stopped' },
    PortBindings: config.ports ? {
      '3000/tcp': [{ HostPort: String(config.ports.start) }]
    } : {}
  },
  WorkingDir: '/app',
  Volumes: {
    [`/app/workspace`]: {},
    [`/app/.cache`]: {}
  },
  Labels: {
    'user.id': userId.toString(),
    'user.plan': config.env?.PLAN || 'free',
    'managed-by': 'vercel-clone'
  }
});

// Pure function - Create user directory structure
const createUserDirectoryStructure = (userId) => [
  `/app/users/${userId}`,
  `/app/users/${userId}/workspace`,
  `/app/users/${userId}/projects`,
  `/app/users/${userId}/.cache`
];

// Function - Execute command in container
const execInContainer = (container) => async (command) => {
  try {
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true
    });
    
    const stream = await exec.start({ hijack: true, stdin: false });
    
    return new Promise((resolve, reject) => {
      let output = '';
      
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });
      
      stream.on('end', () => {
        resolve(output.trim());
      });
      
      stream.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Failed to execute command: ${error.message}`);
  }
};

// Function - Set resource limits using cgroups
const setResourceLimits = async (userId, resources) => {
  try {
    const cgroupPath = `/sys/fs/cgroup/memory/user-${userId}`;
    const cpuPath = `/sys/fs/cgroup/cpu/user-${userId}`;
    
    // Set memory limit
    if (resources.memory) {
      const memoryBytes = parseMemoryToBytes(resources.memory);
      await fs.writeFile(`${cgroupPath}/memory.limit_in_bytes`, memoryBytes.toString());
    }
    
    // Set CPU limit  
    if (resources.cpu) {
      const cpuShares = Math.floor(resources.cpu * 1024);
      await fs.writeFile(`${cpuPath}/cpu.shares`, cpuShares.toString());
    }
    
    return { success: true, userId, limits: resources };
  } catch (error) {
    console.warn(`Failed to set cgroup limits for user ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Function - Add user to shared container
const addUserToSharedContainer = async (userId, resources) => {
  try {
    const sharedContainer = docker.getContainer('shared-free-container');
    const execCommand = execInContainer(sharedContainer);
    
    // Create user directories
    const directories = createUserDirectoryStructure(userId);
    
    for (const dir of directories) {
      await execCommand(['mkdir', '-p', dir]);
      await execCommand(['chown', '1000:1000', dir]);
    }
    
    // Set resource limits
    await setResourceLimits(userId, resources);
    
    // Create user config file
    const userConfig = JSON.stringify({
      userId,
      plan: 'free',
      resources,
      createdAt: new Date().toISOString()
    });
    
    await execCommand(['sh', '-c', `echo '${userConfig}' > /app/users/${userId}/config.json`]);
    
    return {
      success: true,
      containerId: 'shared-free-container',
      userId,
      resources,
      directories
    };
  } catch (error) {
    throw new Error(`Failed to add user to shared container: ${error.message}`);
  }
};

// Function - Create dedicated container
const createDedicatedContainer = async (userId, config) => {
  try {
    const containerConfig = createContainerConfig(userId, config);
    
    // Remove existing container if it exists
    try {
      const existingContainer = docker.getContainer(containerConfig.name);
      await existingContainer.stop();
      await existingContainer.remove();
    } catch (error) {
      // Container doesn't exist, which is fine
    }
    
    // Create new container
    const container = await docker.createContainer(containerConfig);
    await container.start();
    
    // Wait for container to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const execCommand = execInContainer(container);
    
    // Initialize user workspace
    await execCommand(['mkdir', '-p', '/app/workspace', '/app/projects', '/app/.cache']);
    await execCommand(['chown', '-R', '1000:1000', '/app']);
    
    // Create user config
    const userConfig = JSON.stringify({
      userId,
      plan: config.env?.PLAN || 'pro',
      resources: config.resources,
      containerId: containerConfig.name,
      port: config.ports?.start,
      createdAt: new Date().toISOString()
    });
    
    await execCommand(['sh', '-c', `echo '${userConfig}' > /app/config.json`]);
    
    return {
      success: true,
      containerId: containerConfig.name,
      userId,
      port: config.ports?.start,
      resources: config.resources
    };
  } catch (error) {
    throw new Error(`Failed to create dedicated container: ${error.message}`);
  }
};

// Function - Remove user container
const removeUserContainer = async (userId) => {
  try {
    const containerName = `user-${userId}-container`;
    
    // Try to remove dedicated container
    try {
      const container = docker.getContainer(containerName);
      await container.stop();
      await container.remove();
      
      return {
        success: true,
        message: `Dedicated container ${containerName} removed`,
        userId
      };
    } catch (error) {
      // Container might not exist or might be shared
    }
    
    // Try to remove user from shared container
    try {
      const sharedContainer = docker.getContainer('shared-free-container');
      const execCommand = execInContainer(sharedContainer);
      
      // Remove user directories
      await execCommand(['rm', '-rf', `/app/users/${userId}`]);
      
      return {
        success: true,
        message: `User ${userId} removed from shared container`,
        userId
      };
    } catch (error) {
      throw new Error(`Failed to remove user from shared container: ${error.message}`);
    }
  } catch (error) {
    throw new Error(`Failed to remove user container: ${error.message}`);
  }
};

// Function - Get system stats
const getSystemStats = () => ({
  timestamp: new Date().toISOString(),
  cpu: {
    usage: os.loadavg()[0] / os.cpus().length * 100,
    cores: os.cpus().length,
    loadAverage: os.loadavg()
  },
  memory: {
    total: os.totalmem(),
    free: os.freemem(),
    usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100)
  },
  uptime: os.uptime()
});

// Function - Get container stats
const getContainerStats = async () => {
  try {
    const containers = await docker.listContainers();
    
    const containerStats = await Promise.all(
      containers.map(async (containerInfo) => {
        try {
          const container = docker.getContainer(containerInfo.Id);
          const stats = await container.stats({ stream: false });
          
          return {
            id: containerInfo.Id.substring(0, 12),
            name: containerInfo.Names[0].replace('/', ''),
            status: containerInfo.Status,
            cpuUsage: calculateCpuUsage(stats),
            memoryUsage: calculateMemoryUsage(stats)
          };
        } catch (error) {
          return {
            id: containerInfo.Id.substring(0, 12),
            name: containerInfo.Names[0].replace('/', ''),
            status: containerInfo.Status,
            error: error.message
          };
        }
      })
    );
    
    return containerStats;
  } catch (error) {
    return { error: error.message };
  }
};

// Pure function - Calculate CPU usage
const calculateCpuUsage = (stats) => {
  try {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                     (stats.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats.system_cpu_usage - 
                        (stats.precpu_stats?.system_cpu_usage || 0);
    
    if (systemDelta > 0) {
      return (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
    }
    return 0;
  } catch (error) {
    return 0;
  }
};

// Pure function - Calculate memory usage
const calculateMemoryUsage = (stats) => {
  try {
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 0;
    
    return memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;
  } catch (error) {
    return 0;
  }
};

// Function - Handle container commands
const handleContainerCommand = async (req, res) => {
  try {
    const { action, userId, config } = req.body;
    
    let result;
    
    switch (action) {
      case 'add_user_to_shared':
        result = await addUserToSharedContainer(userId, config.resources);
        break;
        
      case 'create_dedicated_container':
        result = await createDedicatedContainer(userId, config);
        break;
        
      case 'remove_user_container':
        result = await removeUserContainer(userId);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Container command error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Function - Handle stats request
const handleStatsRequest = async (req, res) => {
  try {
    const systemStats = getSystemStats();
    const containerStats = await getContainerStats();
    
    const response = {
      system: systemStats,
      containers: containerStats,
      summary: {
        totalContainers: containerStats.length,
        cpuUsage: systemStats.cpu.usage,
        memoryUsage: systemStats.memory.usage,
        availableMemory: systemStats.memory.free,
        uptime: systemStats.uptime
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
};

// Routes
app.post('/container-command', handleContainerCommand);
app.get('/stats', handleStatsRequest);
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    agent: 'container-host-agent'
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Container host agent running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /container-command - Execute container operations');
  console.log('  GET  /stats - Get system and container statistics');
  console.log('  GET  /health - Health check endpoint');
});

// Export functions for testing
module.exports = {
  addUserToSharedContainer,
  createDedicatedContainer,
  removeUserContainer,
  getSystemStats,
  getContainerStats,
  parseMemoryToBytes,
  createContainerConfig
};
