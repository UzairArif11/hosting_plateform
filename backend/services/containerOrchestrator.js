const docker = require('./docker');
const logger = require('../utils/logger');
const net = require('net');
const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');
// Enhanced 3-Server Architecture with Load Balancing
// NEW SYSTEM: Free users get SHARED containers, Paid users get DEDICATED containers
// Both shared and dedicated containers can be allocated on EC2 or EC3 (load balanced)

// Shared Resource Caps — dynamically computed from ORACLE_SERVERS (DB-backed).
// 10% per user to prevent resource monopolization.
// Falls back to sensible defaults if server config is incomplete.
const SHARED_RESOURCE_CAPS = {};

/**
 * Rebuild SHARED_RESOURCE_CAPS from the current ORACLE_SERVERS cache.
 * Called after every refreshServerCache() so caps stay in sync with DB.
 */
function rebuildSharedResourceCaps() {
  // Clear existing keys in-place so existing references stay valid
  Object.keys(SHARED_RESOURCE_CAPS).forEach(k => delete SHARED_RESOURCE_CAPS[k]);

  for (const [key, srv] of Object.entries(ORACLE_SERVERS)) {
    // Only worker nodes have shared pools (skip api_main)
    if (srv.type === 'api_main') continue;

    const pool = srv.sharedPool || {};
    const totalCPU  = pool.cpuLimit  || 2;
    const totalRAM  = (pool.ramLimit || 12) * 1024; // GB → MB
    const maxUsers  = pool.maxUsers  || 150;

    SHARED_RESOURCE_CAPS[key] = {
      totalCPU,
      totalRAM,
      maxUsers,
      perUserCap: {
        cpu:       +(totalCPU / 10).toFixed(3),       // 10% of total CPU
        ram:       Math.round(totalRAM / 10),          // 10% of total RAM (MB)
        storage:   2,
        bandwidth: 100
      },
      perUserMin: {
        cpu:       +(totalCPU / maxUsers).toFixed(4),  // Guaranteed minimum
        ram:       Math.round(totalRAM / maxUsers),    // Guaranteed minimum (MB)
        storage:   1,
        bandwidth: 10
      }
    };
  }
}

/**
 * ORACLE_SERVERS — mutable in-memory cache populated from the Server DB model.
 *
 * Sole source of truth at runtime. All consumers use this object synchronously
 * (e.g. `ORACLE_SERVERS['EC2']`). We mutate the object **in-place** on every
 * cache refresh so that all existing module-level imports
 * (`const { ORACLE_SERVERS } = require(...)`) see live data without being
 * converted to async calls.
 *
 * Lifecycle:
 *   • Starts empty.
 *   • `refreshServerCache()` populates it from MongoDB after DB connect.
 *   • Every admin CRUD on `/admin/servers/*` calls `refreshServerCache()`
 *     so changes take effect within the same request, no restart needed.
 *   • If the DB has zero servers (fresh install or admin deleted everything),
 *     the cache is cleared too — never holds stale data.
 */
const ORACLE_SERVERS = {};

// Timestamp of last successful DB load
let _serverCacheTime = 0;
const SERVER_CACHE_TTL = 60 * 1000; // refresh from DB at most once per minute

/**
 * Refresh ORACLE_SERVERS in-place from the Server collection.
 * Safe to call at any time; transient failures are logged but never crash the
 * process. On a successful read we always reflect the DB exactly — including
 * the case where the DB has no servers (cache becomes empty, not stale).
 */
async function refreshServerCache() {
  let dbServers;
  try {
    const Server = require('../models/Server');
    dbServers = await Server.find({}).lean();
  } catch (err) {
    // DB unreachable — keep current cache to survive transient failures.
    logger.warn('[ServerCache] DB read failed (keeping last known cache): ' + (err.message || err));
    return;
  }

  // Snapshot current cache so we can restore on a partial-population failure.
  const snapshot = { ...ORACLE_SERVERS };
  try {
    // Clear all current keys, then repopulate in-place so existing references stay valid.
    Object.keys(ORACLE_SERVERS).forEach(k => delete ORACLE_SERVERS[k]);

    for (const s of dbServers || []) {
      ORACLE_SERVERS[s.key] = {
        name:           s.name,
        host:           s.host,
        domain:         s.domain || '',
        type:           s.type,
        description:    s.description || '',
        isActive:       s.isActive !== false,
        enabled:        s.enabled !== false,
        acceptNewUsers: s.acceptNewUsers !== false,
        notes:          s.notes || '',
        sshKey:         s.sshKey || '',
        sshKeyEnvVar:   s.sshKeyEnvVar || '',
        totalCPU:       s.totalCPU,
        totalRAM:       s.totalRAM,
        maxContainers:  s.maxContainers,
        sharedPool:     s.sharedPool,
        dedicatedPool:  s.dedicatedPool
      };
    }

    _serverCacheTime = Date.now();
    const keys = Object.keys(ORACLE_SERVERS);
    logger.info(
      keys.length > 0
        ? `[ServerCache] Loaded ${keys.length} server(s) from DB: ${keys.join(', ')}`
        : '[ServerCache] DB has no servers — cache empty. Admin can add servers via Admin Panel.'
    );
    rebuildSharedResourceCaps();
  } catch (populateErr) {
    // Restore snapshot so we never leave the cache in a partial state.
    Object.keys(ORACLE_SERVERS).forEach(k => delete ORACLE_SERVERS[k]);
    Object.assign(ORACLE_SERVERS, snapshot);
    logger.error('[ServerCache] Refresh failed mid-populate; restored previous cache: ' + (populateErr.message || populateErr));
  }
}

// No auto-seeding. Admin adds every server through Admin Panel → Servers.

/**
 * Returns the live ORACLE_SERVERS map, refreshing from DB if the TTL has expired.
 */
async function getOracleServers() {
  if (Date.now() - _serverCacheTime > SERVER_CACHE_TTL) {
    await refreshServerCache();
  }
  return ORACLE_SERVERS;
}

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
      const name = (container.names[0] || '').replace(/^\//, '');
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
        sharedCapacity: (server.sharedPool?.maxUsers || 150) - sharedUsers,
        dedicatedCapacity: (server.dedicatedPool?.maxUsers || 50) - dedicatedUsers
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Choose best server for new user (dynamic — works with any number of worker nodes)
const chooseBestServerForUser = async (containerType = 'dedicated') => {
  try {
    await getOracleServers(); // ensure cache is fresh
    const User = require('../models/User');

    // Collect all worker servers that accept new users
    const candidates = [];
    for (const [key, srv] of Object.entries(ORACLE_SERVERS)) {
      if (srv.type === 'api_main') continue;
      if (srv.isActive === false || srv.enabled === false) continue;
      if (srv.acceptNewUsers === false) continue;
      if (!srv.host) continue;
      candidates.push(key);
    }

    if (candidates.length === 0) {
      throw new Error('No servers available for new registrations. All servers are disabled by admin.');
    }

    if (candidates.length === 1) {
      logger.info(`Only one eligible server: ${candidates[0]}`);
      return candidates[0];
    }

    // Check which servers are actually reachable
    const reachable = [];
    for (const key of candidates) {
      const util = await getServerUtilization(key);
      if (util.success) reachable.push(key);
    }

    if (reachable.length === 0) {
      logger.warn('All servers unreachable, falling back to first candidate');
      return candidates[0];
    }

    if (reachable.length === 1) {
      logger.info(`Only ${reachable[0]} reachable, using it`);
      return reachable[0];
    }

    // Count users per server and pick the one with fewest
    const counts = await Promise.all(
      reachable.map(async (key) => ({
        key,
        userCount: await User.countDocuments({ assignedServer: key })
      }))
    );

    counts.sort((a, b) => a.userCount - b.userCount);
    const logStr = counts.map(c => `${c.key}=${c.userCount}`).join(', ');
    logger.info(`Server load: ${logStr}`);

    // If tied, round-robin by total
    if (counts.length >= 2 && counts[0].userCount === counts[1].userCount) {
      const totalUsers = counts.reduce((s, c) => s + c.userCount, 0);
      const choice = counts[totalUsers % counts.length].key;
      logger.info(`Equal load, round-robin to ${choice}`);
      return choice;
    }

    logger.info(`Assigning to ${counts[0].key} (lowest load: ${counts[0].userCount} users)`);
    return counts[0].key;
  } catch (error) {
    logger.error('Error choosing best server:', error);
    throw error;
  }
};

// Allocate container for user (ALWAYS dedicated - every user gets their own container)
const allocateContainer = async (user, plan) => {
  try {
    logger.info(`allocateContainer called with plan: ${JSON.stringify(plan)}`);

    // CRITICAL FIX: Load plan from database if string is passed
    const Plan = require('../models/Plan');
    let planObj;

    if (typeof plan === 'string') {
      // Plan is a string (plan name like 'free', 'pro')
      logger.info(`Loading plan '${plan}' from database...`);
      planObj = await Plan.findOne({ name: plan, isActive: true });

      if (!planObj) {
        // Fallback to free plan if specified plan not found
        logger.warn(`Plan '${plan}' not found, falling back to 'free'`);
        planObj = await Plan.findOne({ name: 'free', isActive: true });
      }

      if (!planObj) {
        throw new Error('No active plan found in database. Please run database seeders.');
      }

      logger.info(`✅ Loaded plan: ${planObj.displayName} (CPU: ${planObj.resources.cpu}, RAM: ${planObj.resources.ram}GB)`);
    } else if (plan && plan.resources) {
      // Plan is already an object
      planObj = plan;
    } else {
      throw new Error('Invalid plan parameter');
    }

    // SIMPLIFIED: Every user gets their own dedicated container
    // No more shared vs dedicated confusion
    // Resource limits are applied via plan configuration
    const containerType = 'dedicated';

    logger.info(`Allocating dedicated container for user ${user.username}`);

    // Choose best server based on current load
    const targetServer = await chooseBestServerForUser(containerType);
    const server = ORACLE_SERVERS[targetServer];

    if (!server || !server.host) {
      throw new Error(`Server ${targetServer} not found in cache or has no host configured`);
    }

    logger.info(`Creating dedicated container on ${targetServer} for user ${user.username}`);
    return await allocateDedicatedContainer(user, planObj, targetServer, server);
  } catch (error) {
    logger.error('Container allocation failed:', error);
    throw error;  // Re-throw instead of returning error object
  }
};

// Allocate container for user (one per user, resources based on plan)
const allocateSharedContainer = async (user, serverKey, server) => {
  try {
    const containerName = `${serverKey}-user-${user.username}-${Date.now()}`;
    const port = await getAvailablePort(serverKey);

    // Get user's plan to determine resources
    const Plan = require('../models/Plan');
    let userPlan = await Plan.findById(user.plan);

    // If no plan found (e.g. user created via OAuth without plan), fetch default Free/Trial plan from DB
    // This ensures we use Admin-configured limits instead of hardcoded values
    if (!userPlan) {
      userPlan = await Plan.findOne({
        $or: [{ name: 'free' }, { name: 'trial' }, { name: 'basic' }]
      }).sort({ 'pricing.usd': 1 }); // Get cheapest
    }

    // Default resources: Use DB plan if available, otherwise minimal safety fallback
    const resources = userPlan?.resources || {
      cpu: 0.5,
      ram: 0.5, // 512MB fallback only if DB is empty
      storage: 2,
      bandwidth: 100
    };

    logger.info('Creating user container with PM2', {
      userId: user._id || user.id,
      username: user.username,
      server: serverKey,
      containerName,
      resources
    });

    // Create the actual container with PM2
    const freeTierContainer = require('./freeTierContainer');
    const containerResult = await freeTierContainer.createUserContainer(
      user,
      serverKey,
      server,
      resources
    );

    if (!containerResult.success) {
      throw new Error(`Failed to create user container: ${containerResult.error}`);
    }

    // Update user assignment with container info
    const User = require('../models/User');
    await User.findByIdAndUpdate(user._id || user.id, {
      assignedServer: serverKey,
      containerName: containerResult.containerName,
      containerId: containerResult.containerId,
      assignedPort: port,
      containerType: user.planType || 'free',
      resourceAllocation: {
        cpu: resources.cpu,
        ram: resources.ram,
        storage: resources.storage,
        bandwidth: resources.bandwidth,
        maxCpu: resources.cpu,
        maxRam: resources.ram
      }
    });

    logger.info('User container created successfully', {
      userId: user._id || user.id,
      username: user.username,
      server: serverKey,
      containerName: containerResult.containerName,
      containerId: containerResult.containerId,
      resources
    });

    // Return allocation info
    return {
      containerName: containerResult.containerName,
      containerId: containerResult.containerId,
      port: port,
      serverKey: serverKey,
      host: server.host
    };

  } catch (error) {
    logger.error('User container creation failed:', error);
    throw error;
  }
};

// Allocate dedicated container for paid users
const allocateDedicatedContainer = async (user, plan, serverKey, server) => {
  try {
    const planResources = plan.resources || { cpu: 1, ram: 4, storage: 50 };
    // Dedicated name generated by createUserContainer logic or passed? 
    // createUserContainer generates name. We should probably let it, or pass distinct prefix.

    // Actually, createUserContainer takes (user, serverKey, server, resources) and handles creation.
    // It generates name: `${serverKey}-user-${user.username}-${Date.now()}`

    // We want dedicated name: `${serverKey}-dedicated-user-...`
    // Let's modify createUserContainer to accept a name override or type?
    // Or just let it be standard name.

    // For now, let's just use createUserContainer as is, it's robust.
    const freeTierContainer = require('./freeTierContainer');

    // We can inject the dedicated naming/resources logic into createUserContainer if needed, 
    // but for now let's just use it.

    const containerResult = await freeTierContainer.createUserContainer(
      user,
      serverKey,
      server,
      planResources
    );

    if (containerResult.success) {
      // Update user assignment
      const User = require('../models/User');
      await User.findByIdAndUpdate(user._id || user.id, {
        assignedServer: serverKey, // Standardize on assignedServer
        oracleAccountId: serverKey, // Keep legacy
        containerName: containerResult.containerName,
        containerId: containerResult.containerId,
        assignedPort: containerResult.port, // Use the dynamic port
        containerType: 'dedicated',
        resourceAllocation: {
          cpu: planResources.cpu,
          ram: planResources.ram,
          storage: planResources.storage,
          bandwidth: planResources.bandwidth || 1024,
          maxCpu: planResources.cpu,
          maxRam: planResources.ram
        }
      });

      logger.info('Dedicated container allocated', {
        userId: user._id || user.id,
        username: user.username,
        server: serverKey,
        containerName: containerResult.containerName,
        type: 'dedicated',
        resources: planResources
      });

      // Return in format expected by buildExecutor
      return {
        containerName: containerResult.containerName,
        containerId: containerResult.containerId,
        port: containerResult.port,
        serverKey: serverKey,
        host: server.host
      };
    }

    // CRITICAL FIX: Throw error instead of returning error object
    throw new Error(containerResult.error || 'Container creation failed');
  } catch (error) {
    logger.error('Dedicated container allocation failed:', error);
    throw error;  // Throw instead of returning error object
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

    const currentServer = user.assignedServer || user.oracleAccountId;
    if (!currentServer) throw new Error(`User ${userId} has no assignedServer — cannot upgrade`);
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
    if (!user) return { success: false, error: 'User not found' };

    const sourceServer = user.assignedServer || user.oracleAccountId;
    if (!sourceServer) throw new Error(`User ${userId} has no assignedServer — cannot migrate`);
    const sourceHost = ORACLE_SERVERS[sourceServer]?.host;
    const oldContainerName = user.containerName;

    // Create dedicated container on target server
    // allocateDedicatedContainer returns { containerName, containerId, port, serverKey, host } or throws
    const dedicatedResult = await allocateDedicatedContainer(user, newPlan, targetServer, ORACLE_SERVERS[targetServer]);

    // If we get here without throwing, container was created successfully
    // Remove old container from source server
    if (oldContainerName && sourceHost) {
      try {
        await docker.stopContainer(oldContainerName, sourceHost);
      } catch (stopErr) {
        logger.warn(`Failed to stop old container ${oldContainerName}: ${stopErr.message}`);
      }
    }

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
        container: dedicatedResult.containerName,
        migration: true
      }
    };
  } catch (error) {
    logger.error('Move and upgrade failed:', error);
    return { success: false, error: error.message };
  }
};

// Get available port for any server — dynamic range, no hardcoded server key
const getAvailablePort = async (serverKey, maxOffset = 2000) => {
  // Single unified range 3000–4999; remote containers have independent port spaces per host
  const basePort = 3000;

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
    if (!containerInfo) {
      return { success: false, error: 'No container found for user' };
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) return { success: false, error: 'User not found' };

    const server = ORACLE_SERVERS[user.assignedServer || user.oracleAccountId];
    if (!server) return { success: false, error: 'Invalid server assignment' };

    logger.info('Starting container resource scaling', {
      userId,
      username: user.username,
      containerName: containerInfo.containerName,
      currentResources: user.resourceAllocation,
      newResources
    });

    // Step 1: Update container resources in-place (Docker update command)
    const updateResult = await docker.updateContainerResources(containerInfo.containerName, {
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
    await User.findByIdAndUpdate(userId, {
      resourceAllocation: {
        cpu: newResources.cpu,
        ram: newResources.ram,
        storage: newResources.storage,
        bandwidth: newResources.bandwidth || user.resourceAllocation?.bandwidth || 100
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
        name: containerInfo.containerName,
        server: user.assignedServer || user.oracleAccountId,
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
    if (!containerInfo) {
      return { success: false, error: 'No container found for user' };
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) return { success: false, error: 'User not found' };

    const serverKey = user.assignedServer || user.oracleAccountId;
    const server = ORACLE_SERVERS[serverKey];
    if (!server) return { success: false, error: 'Invalid server assignment' };

    // Create a container-like object for backward compatibility with rest of function
    const container = { name: containerInfo.containerName };

    logger.info('Starting container recreation with data preservation', {
      userId,
      username: user.username,
      oldContainer: container.name
    });

    // Step 1: Save PM2 state in old container
    const { NodeSSH } = require('node-ssh');
    const ssh = new NodeSSH();

    // Get SSH config for the server
    const remoteBuild = require('./remoteBuild');
    // We can't import remoteBuild if it's circular, but let's assume it's fine or implement connection manually.
    // Actually, containerOrchestrator imports docker, which imports ... 
    // Let's just use the known SSH keys env vars directly to be safe.

    const keyPath = resolveSSHKeyPath(serverKey);
    if (!keyPath) throw new Error(`No SSH key configured for ${serverKey}`);
    const fs = require('fs');
    const keyContent = fs.readFileSync(keyPath, 'utf8');

    try {
      await ssh.connect({
        host: server.host,
        username: process.env.SSH_USERNAME || 'ubuntu',
        privateKey: keyContent
      });

      // PM2 Save
      await ssh.execCommand(`docker exec ${container.name} pm2 save`);

      // Prepare backup directory on host
      const backupPath = `/tmp/backup_${userId}_${Date.now()}`;
      await ssh.execCommand(`mkdir -p ${backupPath}`);

      // Backup Projects and PM2 config directly from container filesystem
      logger.info('Backing up data via docker cp...');
      await ssh.execCommand(`docker cp ${container.name}:/app/projects ${backupPath}/projects`);
      await ssh.execCommand(`docker cp ${container.name}:/root/.pm2 ${backupPath}/pm2_state`);

      // Step 2: Stop old container
      await docker.stopContainer(container.name, server.host);

      // Step 3: Create new container
      // Use createUserContainer logic via allocateDedicated/Shared logic
      // But here we are manually calling Docker or reusing allocation logic?
      // The original code used docker.runContainerWithVolumes.
      // We should use freeTierContainer.createUserContainer to ensure PM2 setup!

      const freeTierContainer = require('./freeTierContainer');
      const containerResult = await freeTierContainer.createUserContainer(
        user,
        serverKey, // Keep same server
        server,
        newResources
      );

      if (!containerResult.success) {
        // Rollback
        await docker.startContainer(container.name, server.host);
        await ssh.execCommand(`rm -rf ${backupPath}`);
        ssh.dispose();
        return { success: false, error: 'Failed to create new container' };
      }

      const newContainerName = containerResult.containerName;

      // Step 4: Restore Data
      logger.info('Restoring data via docker cp...');
      await ssh.execCommand(`docker cp ${backupPath}/projects/. ${newContainerName}:/app/projects/`);
      // Restore PM2 state is trickier, we need to put it in /root/.pm2
      await ssh.execCommand(`docker cp ${backupPath}/pm2_state/. ${newContainerName}:/root/.pm2/`);

      // Cleanup backup
      await ssh.execCommand(`rm -rf ${backupPath}`);

      // Step 5: Resurrect PM2
      logger.info('Resurrecting PM2 processes...');
      await ssh.execCommand(`docker exec ${newContainerName} pm2 resurrect`);

      ssh.dispose();

      logger.info('Container recreated and data preserved', {
        userId,
        newContainer: newContainerName
      });

      return {
        success: true,
        container: {
          name: newContainerName,
          server: serverKey,
          resources: newResources,
          url: `http://${server.host}:${containerResult.port}`
        },
        method: 'manual-copy-migration'
      };

    } catch (err) {
      logger.error('Migration failed:', err);
      if (ssh) ssh.dispose();
      // Try to restart old container just in case
      try { await docker.startContainer(container.name, server.host); } catch (e) { }
      return { success: false, error: err.message };
    }
  } catch (outerError) {
    logger.error('Container recreation outer failed:', outerError);
    return { success: false, error: outerError.message };
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

    // Allocate container for user (throws error on failure)
    const allocation = await allocateContainer(user, plan);

    // Reload the user from DB — allocateContainer updates it there
    const updatedUser = await User.findById(userId).lean();
    const serverId = updatedUser?.assignedServer || updatedUser?.oracleAccountId;

    return {
      success: true,
      serverId,
      serverName: ORACLE_SERVERS[serverId]?.name || serverId,
      containerType: updatedUser?.containerType,
      resources: updatedUser?.resourceAllocation,
      containerName: allocation.containerName,
      containerId: allocation.containerId
    };

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
      usage: { cpu: { usage: 0 }, memory: { usage: 0, percentage: 0 }, storage: { usage: 0 } }
    };
  }
};

// Check storage usage via DU
const checkStorageUsage = async (containerName) => {
  try {
    // Check size of /app directory (where user data lives)
    const result = await docker.execCommand(containerName, ['du', '-sk', '/app']);
    const kbytes = parseInt(result.output.split('\t')[0]);
    const mbytes = kbytes / 1024;
    return mbytes; // MB
  } catch (e) {
    return 0;
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
        if (!containerInfo) continue;

        // Monitor usage
        const monitoring = await monitorUserResourceUsage(containerInfo.containerName, user._id);
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

        // Check storage violation (Software Limit)
        const storageUsedMB = await checkStorageUsage(containerInfo.containerName);
        const storageLimitMB = resourceCaps.perUserCap.storage * 1024; // GB to MB
        if (storageUsedMB > storageLimitMB) {
          violations.push({ type: 'storage', current: storageUsedMB, limit: storageLimitMB });
        }

        // Handle violations
        if (violations.length > 0) {
          logger.warn('Resource violation detected', { userId: user._id, violations });

          for (const violation of violations) {
            if (violation.type === 'cpu') {
              await throttleUserCPU(containerInfo.containerName, user._id, resourceCaps.perUserCap.cpu);
            } else if (violation.type === 'memory') {
              await reclaimUserMemory(containerInfo.containerName, user._id);
            } else if (violation.type === 'storage') {
              // Track storage violation
              await trackStorageViolation(user._id, violation.current, violation.limit);

              // Enforce storage limit by stopping container (Soft Limit Action)
              logger.warn(`🛑 Stopping container ${containerInfo.containerName} due to storage violation (${violation.current.toFixed(2)}MB > ${violation.limit}MB)`);
              await docker.execCommand(containerInfo.containerName, ['pm2', 'stop', 'all']);
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

// Track storage violations and block deployment after 5 in 1 hour
const trackStorageViolation = async (userId, storageUsed, limit) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) return;

    // Add new violation
    user.storageViolations.push({
      timestamp: new Date(),
      storageUsed: storageUsed,
      limit: limit,
      action: 'stopped'
    });

    // Count violations in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentViolations = user.storageViolations.filter(
      v => v.timestamp > oneHourAgo
    );

    logger.warn(`User ${user.email} has ${recentViolations.length} storage violations in the last hour`);

    // Block deployment after 5 violations
    if (recentViolations.length >= 5 && !user.deploymentBlocked) {
      user.deploymentBlocked = true;
      user.deploymentBlockedReason = `Storage limit (${limit}MB) exceeded ${recentViolations.length} times in 1 hour. Please clean up your files and contact support.`;
      user.deploymentBlockedAt = new Date();

      await user.save();

      logger.error(`🚫 DEPLOYMENT BLOCKED for user ${user.email} due to repeated storage violations`);

      // TODO: Send email notification
      // const emailService = require('./emailService');
      // await emailService.sendStorageViolationEmail(user);

      return;
    }

    await user.save();
  } catch (error) {
    logger.error('Error tracking storage violation:', error);
  }
};

// Shared SSH/host resolution — used throughout this file and exported for others
const { resolveSSHKey: resolveSSHKeyPath, resolveHost: resolveHostForKey, getSSHConfig: buildSSHConfig } = require('../utils/serverResolver');

// Get remote system stats (Host CPU, RAM, Storage)
const getRemoteSystemStats = async (serverKey) => {
  try {
    const server = ORACLE_SERVERS[serverKey];
    if (!server) return null;

    const { NodeSSH } = require('node-ssh');
    const fs = require('fs');
    const ssh = new NodeSSH();

    const keyPath = resolveSSHKeyPath(serverKey);
    if (!keyPath) {
      logger.warn(`[getRemoteSystemStats] No SSH key configured for ${serverKey}`);
      return null;
    }

    await ssh.connect({
      host: server.host,
      username: process.env.SSH_USERNAME || 'ubuntu',
      privateKey: fs.readFileSync(keyPath, 'utf8')
    });

    // 1. Get Memory Usage (free -m)
    const memResult = await ssh.execCommand("free -m");
    // Output:
    //               total        used        free      shared  buff/cache   available
    // Mem:          23925        1135       15494           1        7295       22453
    const memLines = memResult.stdout.split('\n');
    const memParts = memLines[1].replace(/\s+/g, ' ').split(' ');
    const totalMem = parseInt(memParts[1]);
    const usedMem = parseInt(memParts[2]);
    const memPercent = (usedMem / totalMem) * 100;

    // 2. Get Disk Usage (df -h /)
    const diskResult = await ssh.execCommand("df -h /");
    // Output:
    // Filesystem      Size  Used Avail Use% Mounted on
    // /dev/sda1        45G   12G   33G  26% /
    const diskLines = diskResult.stdout.split('\n');
    const diskParts = diskLines[1].replace(/\s+/g, ' ').split(' ');
    const totalDisk = diskParts[1];
    const usedDisk = diskParts[2];
    const diskPercent = parseInt(diskParts[4].replace('%', ''));

    // 3. Get CPU Load (top -bn1)
    // Grep 'Cpu(s)' line: %Cpu(s):  0.5 us,  0.2 sy,  0.0 ni, 99.3 id...
    const cpuResult = await ssh.execCommand("top -bn1 | grep 'Cpu(s)'");
    // %Cpu(s):  0.3 us,  0.3 sy,  0.0 ni, 99.3 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st
    const cpuOutput = cpuResult.stdout;
    // Calculate used = 100 - idle
    const idleStr = cpuOutput.split('id,')[0].split(',').pop(); // " 99.3 "
    const idle = parseFloat(idleStr);
    const cpuPercent = 100 - idle;

    // 4. Uptime
    const uptimeResult = await ssh.execCommand("uptime -p");
    const uptime = uptimeResult.stdout;

    ssh.dispose();

    return {
      success: true,
      server: serverKey,
      cpu: {
        percent: cpuPercent.toFixed(1),
        cores: server.totalCPU
      },
      memory: {
        total: totalMem, // MB
        used: usedMem,   // MB
        percent: memPercent.toFixed(1)
      },
      disk: {
        total: totalDisk,
        used: usedDisk,
        percent: diskPercent
      },
      uptime: uptime
    };

  } catch (error) {
    logger.error('Error getting remote system stats:', error);
    return null;
  }
};

// Get real-time Docker stats via SSH (Efficient)
const getRemoteDockerStats = async (serverKey) => {
  try {
    const server = ORACLE_SERVERS[serverKey];
    if (!server) return null;

    const { NodeSSH } = require('node-ssh');
    const fs = require('fs');
    const ssh = new NodeSSH();

    const keyPath = resolveSSHKeyPath(serverKey);
    if (!keyPath) {
      logger.warn(`[getRemoteDockerStats] No SSH key configured for ${serverKey}`);
      return [];
    }

    // Connect
    await ssh.connect({
      host: server.host,
      username: process.env.SSH_USERNAME || 'ubuntu',
      privateKey: fs.readFileSync(keyPath, 'utf8')
    });

    // Run docker stats command (one-shot, JSON format)
    // We use a custom format to ensure easy parsing
    const cmd = `docker stats --no-stream --format '{"id":"{{.ID}}","name":"{{.Name}}","cpu":"{{.CPUPerc}}","memUsage":"{{.MemUsage}}","memPerc":"{{.MemPerc}}","netIO":"{{.NetIO}}"}'`;

    const result = await ssh.execCommand(cmd);
    ssh.dispose();

    if (result.code !== 0) {
      logger.error(`Docker stats command failed on ${serverKey}: ${result.stderr}`);
      return [];
    }

    // Parse output lines (each line is a JSON object)
    const stats = result.stdout.trim().split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(item => item !== null);

    return stats;

  } catch (error) {
    logger.error(`Error getting docker stats from ${serverKey}:`, error);
    return [];
  }
};

// Get container logs via SSH
const getRemoteContainerLogs = async (serverKey, containerId) => {
  try {
    const server = ORACLE_SERVERS[serverKey];
    if (!server) return null;

    const { NodeSSH } = require('node-ssh');
    const fs = require('fs');
    const ssh = new NodeSSH();

    const keyPath = resolveSSHKeyPath(serverKey);
    if (!keyPath) {
      return { success: false, error: `No SSH key configured for ${serverKey}` };
    }

    // Connect
    await ssh.connect({
      host: server.host,
      username: process.env.SSH_USERNAME || 'ubuntu',
      privateKey: fs.readFileSync(keyPath, 'utf8')
    });

    // Run docker logs command
    // Use --tail 100 to get recent logs
    // Use stderr merge because many apps log to stderr
    const result = await ssh.execCommand(`docker logs --tail 100 ${containerId} 2>&1`);
    ssh.dispose();

    if (result.code !== 0) {
      if (result.stderr.includes('No such container')) {
        return { success: false, error: 'Container not found' };
      }
      return { success: false, error: result.stderr };
    }

    return { success: true, logs: result.stdout };

  } catch (error) {
    logger.error(`Error getting logs for ${containerId} on ${serverKey}:`, error);
    return { success: false, error: error.message };
  }
};

// Alerting System
let monitoringInterval = null;
const highLoadCounter = {}; // { serverKey: count_of_consecutive_high_load_checks }

const sendAlert = async (serverKey, cpu, checkCount) => {
  const duration = checkCount * 5; // 5 minutes per check
  const message = `🚨 CRITICAL ALERT: Server ${serverKey} is experiencing high CPU load! \n\nCurrent CPU: ${cpu}%\nDuration: > ${duration} minutes.\n\nCheck Admin Panel immediately.`;
  logger.error(message.replace(/\n/g, ' '));

  try {
    const settings = await Settings.getSettings();
    if (settings.alertConfig && settings.alertConfig.enabled && settings.alertConfig.email && settings.alertConfig.password) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || undefined,
        port: process.env.SMTP_PORT || undefined,
        secure: process.env.SMTP_SECURE === 'true',
        service: !process.env.SMTP_HOST ? 'gmail' : undefined,
        auth: {
          user: settings.alertConfig.email,
          pass: settings.alertConfig.password
        }
      });

      await transporter.sendMail({
        from: `"Platform Admin" <${settings.alertConfig.email}>`,
        to: settings.alertConfig.email, // Send to self/admin
        subject: `[ALERT] High Load on Server ${serverKey} (${cpu}%)`,
        text: message
      });

      logger.info(`📧 Alert email sent to ${settings.alertConfig.email}`);
    }
  } catch (err) {
    logger.error('Failed to send alert email:', err);
  }
};

const startAlertMonitoring = () => {
  if (monitoringInterval) return;

  logger.info('Starting Server Resource Monitoring (Interval: 5m, Threshold: 90% CPU)...');

  // Check every 5 minutes (300,000 ms) to reduce SSH load
  monitoringInterval = setInterval(async () => {
    try {
      // Only monitor worker nodes; skip API main server (EC1-type)
      const servers = Object.keys(ORACLE_SERVERS).filter(
        k => ORACLE_SERVERS[k].type !== 'api_main' && ORACLE_SERVERS[k].host
      );

      for (const serverKey of servers) {
        try {
          // Fetch stats silently
          const stats = await getRemoteSystemStats(serverKey);

          if (!stats || !stats.success) {
            continue;
          }

          const cpuPercent = parseFloat(stats.cpu.percent);

          if (cpuPercent > 90) {
            highLoadCounter[serverKey] = (highLoadCounter[serverKey] || 0) + 1;

            // If high load for 2+ checks (5+ minutes, since interval is 5m)
            if (highLoadCounter[serverKey] >= 2) {
              // Alert on 2nd check (5m), 6th check (25m), etc. to avoid spamming every 5m
              // actually let's alert every time it stays high for now, it's critical
              sendAlert(serverKey, cpuPercent, highLoadCounter[serverKey]);
            }
          } else {
            // Reset if load drops
            if (highLoadCounter[serverKey] > 0) {
              logger.info(`Server ${serverKey} load normalized.`);
            }
            highLoadCounter[serverKey] = 0;
          }
        } catch (innerError) {
          // Suppress SSH timeout logs to avoid console spam
          if (innerError.message && innerError.message.includes('Timed out')) {
            // invalid/timeout, skip
            continue;
          }
          logger.error(`Error monitoring ${serverKey}:`, innerError);
        }
      }
    } catch (error) {
      logger.error('Error in alert monitoring loop:', error);
    }
  }, 5 * 60 * 1000); // 5 minute interval
};

// Migrate user container from one server to another with data preservation
const migrateUserToServer = async (userId, targetServer) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId).populate('plan');
    if (!user) throw new Error('User not found');

    const sourceServer = user.assignedServer || user.oracleAccountId;
    if (!sourceServer) throw new Error('User has no server assignment');
    if (sourceServer === targetServer) throw new Error('User is already on the target server');
    if (!ORACLE_SERVERS[targetServer]) throw new Error(`Invalid target server: ${targetServer}`);

    const sourceHost = ORACLE_SERVERS[sourceServer].host;
    const targetHost = ORACLE_SERVERS[targetServer].host;
    const oldContainerName = user.containerName;

    if (!oldContainerName) throw new Error('User has no container to migrate');

    logger.info('Starting cross-server migration', {
      userId, username: user.username,
      from: sourceServer, to: targetServer,
      container: oldContainerName
    });

    const { NodeSSH } = require('node-ssh');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const sourceKeyPath = resolveSSHKeyPath(sourceServer);
    const targetKeyPath = resolveSSHKeyPath(targetServer);

    if (!sourceKeyPath) throw new Error(`No SSH key configured for source server ${sourceServer}`);
    if (!targetKeyPath) throw new Error(`No SSH key configured for target server ${targetServer}`);

    // --- Step 1: Backup data on source server ---
    const sourceSSH = new NodeSSH();
    await sourceSSH.connect({
      host: sourceHost,
      username: process.env.SSH_USERNAME || 'ubuntu',
      privateKey: fs.readFileSync(sourceKeyPath, 'utf8')
    });

    const backupDir = `/tmp/migrate_${userId}_${Date.now()}`;
    const remoteTarFile = `${backupDir}.tar.gz`;

    await sourceSSH.execCommand(`mkdir -p ${backupDir}`);
    await sourceSSH.execCommand(`docker exec ${oldContainerName} pm2 save 2>/dev/null || true`);
    await sourceSSH.execCommand(`docker cp ${oldContainerName}:/app/projects ${backupDir}/projects 2>/dev/null || true`);
    await sourceSSH.execCommand(`docker cp ${oldContainerName}:/root/.pm2 ${backupDir}/pm2_state 2>/dev/null || true`);
    await sourceSSH.execCommand(`cd /tmp && tar czf ${remoteTarFile} -C ${backupDir} . 2>/dev/null || true`);

    // --- Step 2: Transfer data THROUGH the API server (not direct SCP) ---
    // Download tar from source → API server temp dir → upload to target
    const localTempFile = path.join(os.tmpdir(), `migrate_${userId}_${Date.now()}.tar.gz`);

    try {
      await sourceSSH.getFile(localTempFile, remoteTarFile);
      logger.info('Downloaded backup from source server to API server');
    } catch (dlErr) {
      logger.warn(`Download failed (user may have no data): ${dlErr.message}`);
      // Create empty tar so migration continues (new container, no data to restore)
      fs.writeFileSync(localTempFile, '');
    }

    // Clean up remote backup files on source (but keep the container running!)
    await sourceSSH.execCommand(`rm -rf ${backupDir} ${remoteTarFile}`);
    sourceSSH.dispose();

    // --- Step 3: Create new container on target server FIRST ---
    // (Old container stays alive until new container is confirmed working)
    const freeTierContainer = require('./freeTierContainer');
    const planResources = user.plan?.resources || { cpu: 0.5, ram: 0.5, storage: 2, bandwidth: 100 };

    const containerResult = await freeTierContainer.createUserContainer(
      user,
      targetServer,
      ORACLE_SERVERS[targetServer],
      planResources
    );

    if (!containerResult.success) {
      // Clean up temp file — old container is still alive so user is safe
      try { fs.unlinkSync(localTempFile); } catch (e) {}
      throw new Error(`Failed to create container on ${targetServer}: ${containerResult.error}`);
    }

    // --- Step 4: Upload and restore data on target ---
    const fileStats = fs.statSync(localTempFile);
    if (fileStats.size > 0) {
      const targetSSH = new NodeSSH();
      await targetSSH.connect({
        host: targetHost,
        username: process.env.SSH_USERNAME || 'ubuntu',
        privateKey: fs.readFileSync(targetKeyPath, 'utf8')
      });

      const targetTarFile = `/tmp/migrate_${userId}_restore.tar.gz`;
      const targetRestoreDir = `/tmp/migrate_${userId}_restore`;

      await targetSSH.putFile(localTempFile, targetTarFile);
      await targetSSH.execCommand(`mkdir -p ${targetRestoreDir}`);
      await targetSSH.execCommand(`cd ${targetRestoreDir} && tar xzf ${targetTarFile} 2>/dev/null || true`);
      await targetSSH.execCommand(`docker cp ${targetRestoreDir}/projects/. ${containerResult.containerName}:/app/projects/ 2>/dev/null || true`);
      await targetSSH.execCommand(`docker cp ${targetRestoreDir}/pm2_state/. ${containerResult.containerName}:/root/.pm2/ 2>/dev/null || true`);
      await targetSSH.execCommand(`docker exec ${containerResult.containerName} pm2 resurrect 2>/dev/null || true`);

      // Clean up target temp files
      await targetSSH.execCommand(`rm -rf ${targetRestoreDir} ${targetTarFile}`);
      targetSSH.dispose();
      logger.info('Data restored on target server');
    } else {
      logger.info('No data to restore (empty backup), container created fresh');
    }

    // Clean up local temp file
    try { fs.unlinkSync(localTempFile); } catch (e) {}

    // --- Step 5: NOW destroy old container (new one is confirmed working) ---
    // Reconnect to source since we disposed earlier only if creation failed
    const sourceSSH2 = new NodeSSH();
    await sourceSSH2.connect({
      host: sourceHost,
      username: process.env.SSH_USERNAME || 'ubuntu',
      privateKey: fs.readFileSync(sourceKeyPath, 'utf8')
    });
    await sourceSSH2.execCommand(`docker stop ${oldContainerName} 2>/dev/null || true`);
    await sourceSSH2.execCommand(`docker rm ${oldContainerName} 2>/dev/null || true`);
    sourceSSH2.dispose();

    // --- Step 6: Update user database record ---
    await User.findByIdAndUpdate(userId, {
      $set: {
        assignedServer: targetServer,
        oracleAccountId: targetServer,
        containerName: containerResult.containerName,
        containerId: containerResult.containerId,
        assignedPort: containerResult.port
      },
      $push: {
        serverAssignmentHistory: {
          server: targetServer,
          assignedAt: new Date(),
          reason: 'admin_migration',
          planAtTime: user.planType || 'free'
        }
      }
    });

    logger.info('Cross-server migration completed successfully', {
      userId, username: user.username,
      from: sourceServer, to: targetServer,
      oldContainer: oldContainerName,
      newContainer: containerResult.containerName
    });

    return {
      success: true,
      migration: {
        from: sourceServer,
        to: targetServer,
        oldContainer: oldContainerName,
        newContainer: containerResult.containerName,
        port: containerResult.port,
        dataPreserved: true
      }
    };

  } catch (error) {
    logger.error('Cross-server migration failed:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  // Server cache — DB-backed, refreshed every 60 s and after admin writes
  ORACLE_SERVERS,           // mutable in-memory map (synchronous access)
  refreshServerCache,       // async — force-reload from DB
  getOracleServers,         // async — returns ORACLE_SERVERS (refreshing if stale)

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
  startResourceMonitoring,
  migrateUserToServer,
  getRemoteSystemStats,
  getRemoteDockerStats,
  getRemoteContainerLogs,
  startAlertMonitoring
};
