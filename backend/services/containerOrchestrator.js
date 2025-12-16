const docker = require('./docker');
const logger = require('../utils/logger');
const net = require('net');
// Enhanced 3-Server Architecture with Load Balancing
// NEW SYSTEM: Free users get SHARED containers, Paid users get DEDICATED containers
// Both shared and dedicated containers can be allocated on EC2 or EC3 (load balanced)

// Shared Resource Caps - 10% per user to prevent resource monopolization
const SHARED_RESOURCE_CAPS = {
  EC2: {
    totalCPU: 2.0,        // 2 CPU cores total
    totalRAM: 12288,      // 12GB in MB
    maxUsers: 150,
    perUserCap: {
      cpu: 0.2,           // 10% of total CPU
      ram: 1228,          // 10% of total RAM (MB)
      storage: 10,
      bandwidth: 100
    },
    perUserMin: {
      cpu: 0.013,         // Guaranteed minimum
      ram: 81,            // Guaranteed minimum (MB)
      storage: 1,
      bandwidth: 10
    }
  },
  EC3: {
    totalCPU: 3.0,        // 3 CPU cores total
    totalRAM: 18432,      // 18GB in MB
    maxUsers: 200,
    perUserCap: {
      cpu: 0.3,           // 10% of total CPU
      ram: 1843,          // 10% of total RAM (MB)
      storage: 10,
      bandwidth: 100
    },
    perUserMin: {
      cpu: 0.015,         // Guaranteed minimum
      ram: 92,            // Guaranteed minimum (MB)
      storage: 1,
      bandwidth: 10
    }
  }
};

const ORACLE_SERVERS = {
  EC1: {
    name: 'EC1-API-Main',
    host: process.env.EC1_SERVER_IP,
    type: 'api_main',
    description: 'Main API server - handles all backend requests, admin panel, frontend hosting'
  },
  EC2: {
    name: 'EC2-Mixed-Server',
    host: process.env.EC2_SERVER_IP,
    totalCPU: parseFloat(process.env.EC2_TOTAL_CPU) || 4,
    totalRAM: parseInt(process.env.EC2_TOTAL_RAM) || 24,
    maxContainers: parseInt(process.env.EC2_MAX_CONTAINERS) || 200,
    type: 'mixed_users',
    description: 'Handles both FREE users (shared containers) and PAID users (dedicated containers)',
    sharedPool: {
      maxUsers: 150,        // Max users in shared container
      cpuLimit: 2,          // CPU reserved for shared users
      ramLimit: 12          // RAM reserved for shared users (GB)
    },
    dedicatedPool: {
      maxUsers: 50,         // Max dedicated containers
      cpuLimit: 2,          // CPU for dedicated users
      ramLimit: 12          // RAM for dedicated users (GB)
    }
  },
  EC3: {
    name: 'EC3-Mixed-Server',
    host: process.env.EC3_SERVER_IP,
    totalCPU: parseFloat(process.env.EC3_TOTAL_CPU) || 8,
    totalRAM: parseInt(process.env.EC3_TOTAL_RAM) || 48,
    maxContainers: parseInt(process.env.EC3_MAX_CONTAINERS) || 300,
    type: 'mixed_users',
    description: 'Handles both FREE users (shared containers) and PAID users (dedicated containers)',
    sharedPool: {
      maxUsers: 200,        // Max users in shared container
      cpuLimit: 3,          // CPU reserved for shared users
      ramLimit: 18          // RAM reserved for shared users (GB)
    },
    dedicatedPool: {
      maxUsers: 100,        // Max dedicated containers
      cpuLimit: 5,          // CPU for dedicated users
      ramLimit: 30          // RAM for dedicated users (GB)
    }
  }
};

// Get current server utilization
const getServerUtilization = async (serverKey) => {
  try {
    const server = ORACLE_SERVERS[serverKey];
    if (!server || server.type === 'api_main') {
      return { success: false, error: 'Invalid server for containers' };
    }

    const containers = await docker.listContainers(server.host, false);
    if (!containers.success) {
      return { success: false, error: containers.error };
    }

    let sharedUsers = 0;
    let dedicatedUsers = 0;
    let totalCpuUsed = 0;
    let totalRamUsed = 0;

    containers.containers.forEach(container => {
      const name = container.names[0];
      if (name.includes('-shared-')) {
        sharedUsers++;
      } else if (name.includes('-dedicated-')) {
        dedicatedUsers++;
        // Extract resources from container name
        const cpu = extractResourceFromName(name, 'cpu') || 0.5;
        const ram = extractResourceFromName(name, 'ram') || 1;
        totalCpuUsed += cpu;
        totalRamUsed += ram;
      }
    });

    return {
      success: true,
      server: serverKey,
      utilization: {
        sharedUsers,
        dedicatedUsers,
        totalUsers: sharedUsers + dedicatedUsers,
        cpuUsed: totalCpuUsed,
        ramUsed: totalRamUsed,
        cpuAvailable: server.totalCPU - totalCpuUsed,
        ramAvailable: server.totalRAM - totalRamUsed,
        sharedCapacity: server.sharedPool.maxUsers - sharedUsers,
        dedicatedCapacity: server.dedicatedPool.maxUsers - dedicatedUsers
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Choose best server for new user (load balancing between EC2/EC3)
const chooseBestServerForUser = async (containerType = 'shared') => {
  try {
    const [ec2Status, ec3Status] = await Promise.all([
      getServerUtilization('EC2'),
      getServerUtilization('EC3')
    ]);

    if (!ec2Status.success || !ec3Status.success) {
      return 'EC2'; // Default fallback
    }

    if (containerType === 'shared') {
      // For shared containers, choose server with more shared capacity
      if (ec2Status.utilization.sharedCapacity > ec3Status.utilization.sharedCapacity) {
        return 'EC2';
      } else {
        return 'EC3';
      }
    } else {
      // For dedicated containers, choose server with more dedicated capacity
      if (ec2Status.utilization.dedicatedCapacity > ec3Status.utilization.dedicatedCapacity) {
        return 'EC2';
      } else {
        return 'EC3';
      }
    }
  } catch (error) {
    logger.error('Error choosing best server:', error);
    return 'EC2'; // Default fallback
  }
};

// Allocate container for user (shared vs dedicated on both EC2/EC3)
const allocateContainer = async (user, plan) => {
  try {
    logger.info(`allocateContainer called with plan: ${JSON.stringify(plan)}`);

    const isFreePlan = !plan || plan === 'free' || plan.isTrial || plan.name === 'free-trial';
    const containerType = isFreePlan ? 'shared' : 'dedicated';

    logger.info(`isFreePlan: ${isFreePlan}, containerType: ${containerType}`);

    // Choose best server based on container type and current load
    const targetServer = await chooseBestServerForUser(containerType);
    const server = ORACLE_SERVERS[targetServer];

    if (isFreePlan) {
      // Create shared container allocation (can be on EC2 or EC3)
      logger.info('Calling allocateSharedContainer');
      return await allocateSharedContainer(user, targetServer, server);
    } else {
      // Create dedicated container (can be on EC2 or EC3)
      logger.info('Calling allocateDedicatedContainer');
      return await allocateDedicatedContainer(user, plan, targetServer, server);
    }
  } catch (error) {
    logger.error('Container allocation failed:', error);
    throw error;  // Re-throw instead of returning error object
  }
};

// Allocate shared container for free users
const allocateSharedContainer = async (user, serverKey, server) => {
  try {
    const containerName = `${serverKey}-shared-user-${user.username}-${Date.now()}`;
    const port = await getAvailablePort(serverKey);

    // Get resource caps for this server
    const resourceCaps = SHARED_RESOURCE_CAPS[serverKey];
    if (!resourceCaps) {
      throw new Error(`No resource caps defined for server ${serverKey}`);
    }

    // NOTE: We do NOT create the container here!
    // Container creation happens in buildExecutor.js using the built Docker image
    // This function only allocates resources and updates the database

    // Update user assignment with allocated resources
    const User = require('../models/User');
    await User.findByIdAndUpdate(user._id || user.id, {
      assignedServer: serverKey,
      containerName: containerName,
      assignedPort: port,
      containerType: 'shared',
      resourceAllocation: {
        cpu: resourceCaps.perUserCap.cpu,
        ram: resourceCaps.perUserCap.ram / 1024,
        storage: resourceCaps.perUserCap.storage,
        bandwidth: resourceCaps.perUserCap.bandwidth,
        maxCpu: resourceCaps.perUserCap.cpu,
        maxRam: resourceCaps.perUserCap.ram / 1024,
        guaranteedCpu: resourceCaps.perUserMin.cpu,
        guaranteedRam: resourceCaps.perUserMin.ram / 1024
      }
    });

    logger.info('Shared container allocated', {
      userId: user._id || user.id,
      username: user.username,
      server: serverKey,
      containerName,
      port,
      type: 'shared'
    });

    // Return allocation info for buildExecutor to use
    return {
      containerName: containerName,
      port: port,
      serverKey: serverKey,
      host: server.host
    };

  } catch (error) {
    logger.error('Shared container allocation failed:', error);
    throw error;
  }
};

// Allocate dedicated container for paid users
const allocateDedicatedContainer = async (user, plan, serverKey, server) => {
  try {
    const planResources = plan.resources || { cpu: 1, ram: 4, storage: 50 };
    const containerName = `${serverKey}-dedicated-user-${user.username}-${planResources.cpu}cpu-${planResources.ram}ram-${Date.now()}`;
    const port = await getAvailablePort(serverKey);

    const result = await docker.runContainer('node:18-alpine', containerName, {
      host: server.host,
      port: port,
      memory: planResources.ram * 1024, // GB to MB
      cpu: planResources.cpu,
      env: [
        `USER_ID=${user._id || user.id}`,
        `USER_NAME=${user.username}`,
        `CONTAINER_TYPE=dedicated`,
        `SERVER=${serverKey}`,
        `PLAN=${plan.name}`,
        `ALLOCATED_CPU=${planResources.cpu}`,
        `ALLOCATED_RAM=${planResources.ram}`
      ]
    });

    if (result.success) {
      // Update user assignment
      const User = require('../models/User');
      await User.findByIdAndUpdate(user._id || user.id, {
        oracleAccountId: serverKey,
        containerType: 'dedicated',
        resourceAllocation: {
          cpu: planResources.cpu,
          ram: planResources.ram,
          storage: planResources.storage,
          bandwidth: planResources.bandwidth || 1024
        }
      });

      logger.info('Dedicated container allocated', {
        userId: user._id || user.id,
        username: user.username,
        server: serverKey,
        containerName,
        type: 'dedicated',
        resources: planResources
      });

      return {
        success: true,
        container: {
          name: containerName,
          server: serverKey,
          type: 'dedicated',
          resources: planResources,
          url: `http://${server.host}:${port}`
        }
      };
    }

    return result;
  } catch (error) {
    logger.error('Dedicated container allocation failed:', error);
    return { success: false, error: error.message };
  }
};

// Upgrade user from shared to dedicated (on same server - data preserved)
const upgradeUserToDedicated = async (userId, newPlan) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (user.containerType === 'dedicated') {
      // User already has dedicated, just scale resources if needed
      return await scaleContainerResources(userId, newPlan.resources);
    }

    const currentServer = user.oracleAccountId || 'EC2';
    const server = ORACLE_SERVERS[currentServer];

    logger.info('Upgrading user from shared to dedicated on same server', {
      userId,
      username: user.username,
      currentServer,
      plan: newPlan.name,
      dataPersistence: true
    });

    // Use the data preservation upgrade process
    const upgradeResult = await recreateContainerWithDataPreservation(userId, {
      cpu: newPlan.resources.cpu,
      ram: newPlan.resources.ram,
      storage: newPlan.resources.storage,
      bandwidth: newPlan.resources.bandwidth
    });

    if (upgradeResult.success) {
      // Update user to dedicated type
      await User.findByIdAndUpdate(userId, {
        containerType: 'dedicated',
        plan: newPlan._id
      });

      logger.info('User successfully upgraded to dedicated container', {
        userId,
        username: user.username,
        server: currentServer,
        from: 'shared',
        to: 'dedicated',
        plan: newPlan.name,
        dataPreserved: true
      });

      return {
        success: true,
        upgrade: {
          server: currentServer,
          from: 'shared',
          to: 'dedicated',
          container: upgradeResult.container,
          migration: false, // No server migration - same server
          dataPreserved: true,
          method: upgradeResult.method
        }
      };
    }

    return upgradeResult;
  } catch (error) {
    logger.error('User upgrade to dedicated failed:', error);
    return { success: false, error: error.message };
  }
};

// Move user and upgrade (only if necessary)
const moveAndUpgradeUser = async (userId, targetServer, newPlan) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);

    const sourceServer = user.oracleAccountId || 'EC2';
    const sourceHost = ORACLE_SERVERS[sourceServer].host;
    const targetHost = ORACLE_SERVERS[targetServer].host;

    const oldContainerName = `${sourceServer}-shared-user-${user.username}`;

    // Create dedicated container on target server
    const dedicatedResult = await allocateDedicatedContainer(user, newPlan, targetServer, ORACLE_SERVERS[targetServer]);

    if (dedicatedResult.success) {
      // Remove old container from source server
      await docker.stopContainer(oldContainerName, sourceHost);

      logger.info('User moved and upgraded', {
        userId,
        username: user.username,
        from: sourceServer,
        to: targetServer,
        upgrade: 'shared_to_dedicated',
        plan: newPlan.name
      });

      return {
        success: true,
        upgrade: {
          server: targetServer,
          from: 'shared',
          to: 'dedicated',
          container: dedicatedResult.container,
          migration: true
        }
      };
    }

    return dedicatedResult;
  } catch (error) {
    logger.error('Move and upgrade failed:', error);
    return { success: false, error: error.message };
  }
};

// Get available port for server
const getAvailablePort = async (serverKey, maxOffset = 1000) => {
  const basePort = serverKey === 'EC2' ? 3000 : 4000;

  for (let i = 0; i < maxOffset; i++) {
    const port = basePort + Math.floor(Math.random() * maxOffset);
    const isFree = await isPortFree(port);
    if (isFree) return port;
  }
  throw new Error('No available port found.');
};

const isPortFree = (port) => {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port);
  });
};

// Extract resource from container name
const extractResourceFromName = (containerName, resourceType) => {
  const regex = resourceType === 'cpu' ? /(\d+\.?\d*)cpu/i : /(\d+)ram/i;
  const match = containerName.match(regex);
  return match ? parseFloat(match[1]) : null;
};

// Get user's current container information
const getUserContainer = async (userId) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      logger.warn(`User not found: ${userId}`);
      return null;
    }

    // Check if user has container assigned (using new field names)
    if (!user.assignedServer || !user.containerName) {
      logger.debug(`User ${userId} has no container assigned yet`);
      return null;
    }

    const server = ORACLE_SERVERS[user.assignedServer];
    if (!server) {
      logger.error(`Invalid server assignment for user ${userId}: ${user.assignedServer}`);
      return null;
    }

    logger.info(`Found existing container for user ${userId}: ${user.containerName} on ${user.assignedServer}`);

    // Return in the format expected by buildExecutor
    return {
      containerName: user.containerName,
      port: user.assignedPort || 3001,
      serverKey: user.assignedServer,
      host: server.host
    };
  } catch (error) {
    logger.error(`Error getting user container: ${error.message}`);
    return null;
  }
};

// Scale container resources without losing data/configuration
const scaleContainerResources = async (userId, newResources) => {
  try {
    const containerInfo = await getUserContainer(userId);
    if (!containerInfo.success) {
      return containerInfo;
    }

    const { container, user } = containerInfo;
    const server = ORACLE_SERVERS[user.oracleAccountId];

    logger.info('Starting container resource scaling', {
      userId,
      username: user.username,
      containerName: container.name,
      currentResources: user.resourceAllocation,
      newResources
    });

    // Step 1: Update container resources in-place (Docker update command)
    const updateResult = await docker.updateContainerResources(container.name, {
      memory: newResources.ram * 1024, // GB to MB
      cpu: newResources.cpu
    }, server.host);

    if (!updateResult.success) {
      logger.warn('In-place resource update failed, attempting container recreation', {
        userId,
        error: updateResult.error
      });

      // Step 2: If in-place update fails, recreate container with data preservation
      return await recreateContainerWithDataPreservation(userId, newResources);
    }

    // Step 3: Update user's resource allocation in database
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, {
      resourceAllocation: {
        cpu: newResources.cpu,
        ram: newResources.ram,
        storage: newResources.storage,
        bandwidth: newResources.bandwidth || user.resourceAllocation.bandwidth
      }
    });

    logger.info('Container resources scaled successfully', {
      userId,
      username: user.username,
      method: 'in-place-update',
      newResources
    });

    return {
      success: true,
      method: 'in-place-update',
      container: {
        name: container.name,
        server: user.oracleAccountId,
        resources: newResources
      },
      message: 'Container resources updated without data loss'
    };

  } catch (error) {
    logger.error('Container resource scaling failed:', error);
    return { success: false, error: error.message };
  }
};

// Recreate container while preserving user data and configuration
const recreateContainerWithDataPreservation = async (userId, newResources) => {
  try {
    const containerInfo = await getUserContainer(userId);
    if (!containerInfo.success) {
      return containerInfo;
    }

    const { container, user } = containerInfo;
    const server = ORACLE_SERVERS[user.oracleAccountId];

    logger.info('Starting container recreation with data preservation', {
      userId,
      username: user.username,
      oldContainer: container.name
    });

    // Step 1: Create data backup volume
    const backupVolumeName = `${user.username}-backup-${Date.now()}`;
    const createVolumeResult = await docker.createDataVolume(backupVolumeName, server.host);

    if (!createVolumeResult.success) {
      return { success: false, error: 'Failed to create backup volume' };
    }

    // Step 2: Backup user data from current container
    const backupResult = await docker.backupContainerData(container.name, backupVolumeName, server.host);
    if (!backupResult.success) {
      return { success: false, error: 'Failed to backup container data' };
    }

    // Step 3: Stop current container (but don't remove yet)
    await docker.stopContainer(container.name, server.host);

    // Step 4: Create new container with updated resources
    const newContainerName = generateContainerName(user, newResources, user.oracleAccountId);
    const port = await getAvailablePort(user.oracleAccountId);

    const createResult = await docker.runContainerWithVolumes('node:18-alpine', newContainerName, {
      host: server.host,
      port: port,
      memory: newResources.ram * 1024, // GB to MB
      cpu: newResources.cpu,
      volumes: [`${backupVolumeName}:/app/data`], // Mount backup volume
      env: [
        `USER_ID=${userId}`,
        `USER_NAME=${user.username}`,
        `CONTAINER_TYPE=${user.containerType}`,
        `SERVER=${user.oracleAccountId}`,
        `ALLOCATED_CPU=${newResources.cpu}`,
        `ALLOCATED_RAM=${newResources.ram}`,
        `RESTORED_FROM_BACKUP=true`
      ]
    });

    if (!createResult.success) {
      // Rollback: restart old container
      await docker.startContainer(container.name, server.host);
      return { success: false, error: 'Failed to create new container, rolled back to old container' };
    }

    // Step 5: Restore data to new container
    const restoreResult = await docker.restoreContainerData(newContainerName, backupVolumeName, server.host);
    if (!restoreResult.success) {
      logger.warn('Data restore failed, but container is running', {
        userId,
        newContainer: newContainerName,
        error: restoreResult.error
      });
    }

    // Step 6: Verify new container is running properly
    const healthCheck = await docker.getContainerStatus(newContainerName, server.host);
    if (!healthCheck.success || !healthCheck.running) {
      // Rollback: restart old container and remove new one
      await docker.stopContainer(newContainerName, server.host);
      await docker.startContainer(container.name, server.host);
      return { success: false, error: 'New container failed health check, rolled back' };
    }

    // Step 7: Clean up old container and backup
    await docker.removeContainer(container.name, server.host);
    await docker.removeDataVolume(backupVolumeName, server.host);

    // Step 8: Update user's resource allocation in database
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, {
      resourceAllocation: {
        cpu: newResources.cpu,
        ram: newResources.ram,
        storage: newResources.storage,
        bandwidth: newResources.bandwidth || user.resourceAllocation.bandwidth
      }
    });

    logger.info('Container recreated successfully with data preservation', {
      userId,
      username: user.username,
      oldContainer: container.name,
      newContainer: newContainerName,
      newResources
    });

    return {
      success: true,
      method: 'recreate-with-backup',
      container: {
        name: newContainerName,
        server: user.oracleAccountId,
        resources: newResources,
        url: `http://${server.host}:${port}`
      },
      message: 'Container recreated with data preservation'
    };

  } catch (error) {
    logger.error('Container recreation with data preservation failed:', error);
    return { success: false, error: error.message };
  }
};

// Generate container name based on user and resources
const generateContainerName = (user, resources, serverKey) => {
  const timestamp = Date.now();

  // Determine container type from plan or existing type
  const containerType = user.containerType || 'shared';

  if (containerType === 'shared') {
    return `${serverKey}-shared-user-${user.username}-${timestamp}`;
  } else {
    // For dedicated containers, include resource info in name
    return `${serverKey}-dedicated-user-${user.username}-${resources.cpu}cpu-${resources.ram}ram-${timestamp}`;
  }
};

// Upgrade user plan with seamless resource transition
const upgradeUserPlan = async (userId, newPlan) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const newResources = newPlan.resources || { cpu: 1, ram: 4, storage: 50, bandwidth: 1024 };

    logger.info('Starting user plan upgrade', {
      userId,
      username: user.username,
      currentPlan: user.plan,
      newPlan: newPlan.name,
      currentType: user.containerType,
      newResources
    });

    // Check if user needs to move from shared to dedicated
    if (user.containerType === 'shared' && !newPlan.isTrial && newPlan.name !== 'free-trial') {
      return await upgradeUserToDedicated(userId, newPlan);
    }

    // For dedicated containers, just scale resources
    if (user.containerType === 'dedicated') {
      const scaleResult = await scaleContainerResources(userId, newResources);
      if (scaleResult.success) {
        // Update user's plan
        await User.findByIdAndUpdate(userId, {
          plan: newPlan._id,
          subscriptionStatus: 'active'
        });

        return {
          success: true,
          upgrade: {
            server: user.oracleAccountId,
            from: user.containerType,
            to: user.containerType,
            planChanged: true,
            resourcesScaled: true,
            migration: false,
            container: scaleResult.container
          }
        };
      }
      return scaleResult;
    }

    return { success: false, error: 'Invalid container type for upgrade' };
  } catch (error) {
    logger.error('User plan upgrade failed:', error);
    return { success: false, error: error.message };
  }
};

// Assign user to server (for new users)
const assignUserToServer = async (userId, planName) => {
  try {
    const User = require('../models/User');
    const Plan = require('../models/Plan');

    const user = await User.findById(userId);
    const plan = await Plan.findOne({ name: planName });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Allocate container for user
    const allocation = await allocateContainer(user, plan);

    if (allocation.success) {
      return {
        success: true,
        serverId: user.oracleAccountId,
        serverName: ORACLE_SERVERS[user.oracleAccountId]?.name,
        containerType: user.containerType,
        resources: user.resourceAllocation,
        container: allocation.container
      };
    }

    return allocation;
  } catch (error) {
    logger.error('User server assignment failed:', error);
    return { success: false, error: error.message };
  }
};

// Enforce per-user resource caps using cgroups
const enforceUserResourceCaps = async (containerName, userId, caps) => {
  try {
    // Create user-specific cgroup for resource isolation
    await docker.execCommand(containerName, [
      'mkdir', '-p', `/sys/fs/cgroup/user_${userId}`
    ]);

    // Set CPU cap (Docker uses 100000 microseconds = 1 CPU core)
    const cpuQuota = Math.floor(caps.cpu * 100000);
    await docker.execCommand(containerName, [
      'sh', '-c', `echo ${cpuQuota} > /sys/fs/cgroup/user_${userId}/cpu.cfs_quota_us`
    ]);
    await docker.execCommand(containerName, [
      'sh', '-c', `echo 100000 > /sys/fs/cgroup/user_${userId}/cpu.cfs_period_us`
    ]);

    // Set memory cap (convert MB to bytes)
    const memoryLimit = caps.ram * 1024 * 1024;
    await docker.execCommand(containerName, [
      'sh', '-c', `echo ${memoryLimit} > /sys/fs/cgroup/user_${userId}/memory.limit_in_bytes`
    ]);

    // Set memory soft limit (90% for graceful handling)
    const memorySoftLimit = Math.floor(memoryLimit * 0.9);
    await docker.execCommand(containerName, [
      'sh', '-c', `echo ${memorySoftLimit} > /sys/fs/cgroup/user_${userId}/memory.soft_limit_in_bytes`
    ]);

    logger.info('User resource caps enforced', {
      userId, containerName, cpuCap: caps.cpu, ramCap: caps.ram
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to enforce user resource caps:', error);
    return { success: false, error: error.message };
  }
};

// Real-time resource usage monitoring
const monitorUserResourceUsage = async (containerName, userId) => {
  try {
    // Get CPU usage from cgroup
    const cpuUsage = await docker.execCommand(containerName, [
      'cat', `/sys/fs/cgroup/user_${userId}/cpuacct.usage`
    ]);

    // Get memory usage from cgroup
    const memoryUsage = await docker.execCommand(containerName, [
      'cat', `/sys/fs/cgroup/user_${userId}/memory.usage_in_bytes`
    ]);

    // Get memory limit
    const memoryLimit = await docker.execCommand(containerName, [
      'cat', `/sys/fs/cgroup/user_${userId}/memory.limit_in_bytes`
    ]);

    // Calculate usage percentages
    const memUsageBytes = parseInt(memoryUsage.output.trim());
    const memLimitBytes = parseInt(memoryLimit.output.trim());
    const memUsageMB = memUsageBytes / (1024 * 1024);
    const memUsagePercent = (memUsageBytes / memLimitBytes) * 100;

    // CPU usage calculation (simplified)
    const cpuUsageNs = parseInt(cpuUsage.output.trim());
    const cpuUsagePercent = (cpuUsageNs / 1000000000) / 60; // Approximate over 60 seconds

    return {
      success: true,
      usage: {
        cpu: { usage: cpuUsagePercent, usageNs: cpuUsageNs },
        memory: {
          usage: memUsageMB,
          usageBytes: memUsageBytes,
          limit: memLimitBytes / (1024 * 1024), // Convert to MB
          percentage: memUsagePercent
        },
        timestamp: Date.now()
      }
    };
  } catch (error) {
    logger.error('Failed to monitor user resource usage:', error);
    return {
      success: false,
      error: error.message,
      usage: { cpu: { usage: 0 }, memory: { usage: 0, percentage: 0 } }
    };
  }
};

// Resource violation enforcement
const throttleUserCPU = async (containerName, userId, cpuLimit) => {
  try {
    const cpuQuota = Math.floor(cpuLimit * 0.8 * 100000); // Reduce to 80% of limit
    await docker.execCommand(containerName, [
      'sh', '-c', `echo ${cpuQuota} > /sys/fs/cgroup/user_${userId}/cpu.cfs_quota_us`
    ]);
    logger.info('User CPU throttled', { userId, cpuLimit: cpuLimit * 0.8 });
  } catch (error) {
    logger.error('Failed to throttle user CPU:', error);
  }
};

const reclaimUserMemory = async (containerName, userId) => {
  try {
    // Force memory reclaim
    await docker.execCommand(containerName, [
      'sh', '-c', `echo 1 > /sys/fs/cgroup/user_${userId}/memory.force_empty`
    ]);
    logger.info('User memory reclaimed', { userId });
  } catch (error) {
    logger.error('Failed to reclaim user memory:', error);
  }
};

// Start continuous monitoring service
const startResourceMonitoring = (intervalMs = 60000) => {
  logger.info('Starting shared container resource monitoring');

  return setInterval(async () => {
    try {
      const User = require('../models/User');
      const sharedUsers = await User.find({
        containerType: 'shared',
        status: { $in: ['active', 'trial'] }
      });

      for (const user of sharedUsers) {
        const serverKey = user.oracleAccountId;
        if (!serverKey) continue;

        const resourceCaps = SHARED_RESOURCE_CAPS[serverKey];
        if (!resourceCaps) continue;

        // Get user container
        const containerInfo = await getUserContainer(user._id);
        if (!containerInfo || !containerInfo.success) continue;

        // Monitor usage
        const monitoring = await monitorUserResourceUsage(containerInfo.container.name, user._id);
        if (!monitoring.success) continue;

        const { usage } = monitoring;
        const violations = [];

        // Check CPU violation (>10% with 5% tolerance)
        if (usage.cpu.usage > resourceCaps.perUserCap.cpu * 1.05) {
          violations.push({ type: 'cpu', current: usage.cpu.usage, limit: resourceCaps.perUserCap.cpu });
        }

        // Check memory violation (>95% of allocated)
        if (usage.memory.percentage > 95) {
          violations.push({ type: 'memory', current: usage.memory.usage, limit: resourceCaps.perUserCap.ram });
        }

        // Handle violations
        if (violations.length > 0) {
          logger.warn('Resource violation detected', { userId: user._id, violations });

          for (const violation of violations) {
            if (violation.type === 'cpu') {
              await throttleUserCPU(containerInfo.container.name, user._id, resourceCaps.perUserCap.cpu);
            } else if (violation.type === 'memory') {
              await reclaimUserMemory(containerInfo.container.name, user._id);
            }
          }
        }

        // Update user usage in database
        await User.findByIdAndUpdate(user._id, {
          'currentResourceUsage': {
            cpu: usage.cpu.usage,
            ram: usage.memory.usage,
            cpuPercent: (usage.cpu.usage / resourceCaps.perUserCap.cpu) * 100,
            ramPercent: usage.memory.percentage,
            lastChecked: new Date()
          }
        });
      }
    } catch (error) {
      logger.error('Resource monitoring error:', error);
    }
  }, intervalMs);
};

module.exports = {
  ORACLE_SERVERS,
  SHARED_RESOURCE_CAPS,
  getServerUtilization,
  chooseBestServerForUser,
  allocateContainer,
  upgradeUserToDedicated,
  moveAndUpgradeUser,
  getUserContainer,
  scaleContainerResources,
  recreateContainerWithDataPreservation,
  upgradeUserPlan,
  assignUserToServer,
  enforceUserResourceCaps,
  monitorUserResourceUsage,
  startResourceMonitoring
};
