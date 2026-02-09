const Docker = require('dockerode');
const logger = require('../utils/logger');

// Create Docker client
const createDockerClient = (host = null) => {
  if (host) {
    // Check if this is the local server (EC1/EC3 same machine)
    const localIP = process.env.EC1_SERVER_IP || 'localhost';
    const isLocalServer = host === localIP || 
                         host === 'localhost' || 
                         host === '127.0.0.1' ||
                         host === process.env.EC3_SERVER_IP; // EC3 = EC1 (same server)

    if (isLocalServer || host === process.env.EC3_SERVER_IP) {
      // 🏠 Local server: Connect directly to local Docker daemon
      logger.info(`Connecting to local Docker daemon (same machine)`);
      return new Docker(); // Uses unix socket by default
    }

    // 🔒 SECURE: Use SSH tunnel for remote servers (EC2)
    const serverKey = host === process.env.EC2_SERVER_IP ? 'EC2' : 'EC3';

    // Get tunnel info from SSH tunnel manager
    const sshTunnelManager = require('./sshTunnelManager');
    const tunnelInfo = sshTunnelManager.getTunnelInfo(serverKey);

    if (!tunnelInfo) {
      logger.warn(`No SSH tunnel found for ${serverKey}. Falling back to local Docker.`);
      return new Docker(); // Fallback to local Docker
    }

    if (!sshTunnelManager.isTunnelActive(serverKey)) {
      logger.warn(`SSH tunnel for ${serverKey} is not active. Using local Docker.`);
      return new Docker(); // Fallback to local Docker
    }

    logger.info(`Using SSH tunnel for ${serverKey}: localhost:${tunnelInfo.localPort} → ${host}:2376`);

    return new Docker({
      host: 'localhost',              // ✅ Connect via SSH tunnel
      port: tunnelInfo.localPort,     // 2376 (EC2)
      protocol: 'http',               // Local connection, encrypted by SSH
    });
  }

  // Local Docker
  return new Docker();
};

// Build Docker image from source code
const buildImage = async (buildContext, imageName, dockerfile = 'Dockerfile') => {
  try {
    const docker = createDockerClient();

    logger.info('Starting Docker image build', { imageName });

    const stream = await docker.buildImage(buildContext, {
      t: imageName,
      dockerfile: dockerfile,
      rm: true,
      forcerm: true
    });

    // Process build stream
    const buildLogs = [];

    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      }, (event) => {
        if (event.stream) {
          buildLogs.push(event.stream.trim());
          logger.info('Build log:', event.stream.trim());
        }
      });
    });

    logger.info('Docker image built successfully', { imageName });

    return {
      success: true,
      imageName: imageName,
      logs: buildLogs
    };

  } catch (error) {
    logger.error('Failed to build Docker image:', error);
    return {
      success: false,
      error: error.message,
      logs: []
    };
  }
};

// Run container from image
const runContainer = async (imageName, containerName, options = {}) => {
  try {
    logger.info('🐳 Step 1: Starting container creation...', {
      imageName,
      containerName,
      host: options.host || 'local',
      port: options.port || '3000',
      memory: options.memory || 512,
      cpu: options.cpu || 1
    });

    const docker = createDockerClient(options.host);
    logger.info('✅ Step 2: Docker client created');

    // Pull image first
    logger.info(`⬇️ Pulling image ${imageName}...`);
    try {
      await new Promise((resolve, reject) => {
        docker.pull(imageName, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, onFinished, onProgress);

          function onFinished(err, output) {
            if (err) return reject(err);
            resolve(output);
          }

          function onProgress(event) {
            // Optional: log progress
          }
        });
      });
      logger.info(`✅ Image ${imageName} pulled successfully`);
    } catch (pullError) {
      logger.warn(`⚠️ Failed to pull image ${imageName}: ${pullError.message}. Trying to run anyway (might exist locally)...`);
    }

    const containerConfig = {
      Image: imageName,
      name: containerName,
      ExposedPorts: {
        '80/tcp': {},
        '443/tcp': {}
      },
      HostConfig: {
        PortBindings: {
          '80/tcp': [{ HostPort: String(options.port || '3000') }]  // Map nginx port 80 to host port
        },
        Memory: Math.floor((options.memory || 512) * 1024 * 1024), // Convert MB to bytes
        CpuShares: Math.round((options.cpu || 1) * 1024), // CPU shares (Soft Limit)
        NanoCpus: Math.floor((options.cpu || 1) * 1000000000), // CPU Hard Limit (1 CPU = 1e9 NanoCPU)
        // StorageOpt: options.storage ? { size: `${options.storage}G` } : undefined, // DISABLED due to fs incompatibility
        RestartPolicy: {
          Name: options.restart || 'unless-stopped'
        }
      },
      Env: options.env || [],
      WorkingDir: '/app'
      // NOTE: Do NOT set Cmd - use the image's default CMD (nginx)
    };

    // Support for Host Networking (crucial for multi-project PM2 with unique ports)
    if (options.networkMode) {
      containerConfig.HostConfig.NetworkMode = options.networkMode;
      if (options.networkMode === 'host') {
        containerConfig.HostConfig.PortBindings = {};
        // Keep ExposedPorts empty if host mode (ports are exposed by process binding)
      }
    }

    // Only set Cmd if explicitly provided

    // Only set Cmd if explicitly provided
    if (options.cmd) {
      containerConfig.Cmd = options.cmd;
    }

    logger.info('📋 Step 3: Container config prepared', {
      image: containerConfig.Image,
      name: containerConfig.name,
      memory: `${options.memory || 512}MB`,
      cpu: options.cpu || 1
    });

    logger.info('🔨 Step 4: Creating container...');
    const container = await docker.createContainer(containerConfig);
    logger.info('✅ Step 5: Container created successfully', { containerId: container.id });

    logger.info('▶️  Step 6: Starting container...');
    await container.start();
    logger.info('✅ Step 7: Container started');

    logger.info('🔍 Step 8: Inspecting container...');
    const info = await container.inspect();
    logger.info('✅ Step 9: Container inspection complete');

    logger.info('🎉 Container started successfully!', {
      containerId: container.id,
      containerName: containerName,
      port: options.port || '3000',
      status: info.State.Status,
      ipAddress: info.NetworkSettings.IPAddress
    });

    return {
      success: true,
      containerId: container.id,
      containerName: containerName,
      port: options.port || '3000',
      status: info.State.Status,
      ipAddress: info.NetworkSettings.IPAddress
    };

  } catch (error) {
    logger.error('❌ CONTAINER CREATION FAILED:', {
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
      imageName,
      containerName,
      host: options.host
    });

    return {
      success: false,
      error: error.message,
      errorDetails: {
        name: error.name,
        code: error.code,
        statusCode: error.statusCode
      }
    };
  }
};

// Stop and remove container
const stopContainer = async (containerName, host = null) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    await container.stop();
    await container.remove();

    logger.info('Container stopped and removed', { containerName });

    return {
      success: true,
      containerName: containerName
    };

  } catch (error) {
    logger.error('Failed to stop container:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get container status
const getContainerStatus = async (containerName, host = null) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    const info = await container.inspect();

    return {
      success: true,
      status: info.State.Status,
      running: info.State.Running,
      startedAt: info.State.StartedAt,
      ports: info.NetworkSettings.Ports,
      ipAddress: info.NetworkSettings.IPAddress
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// List all containers
const listContainers = async (host = null, showAll = true) => {
  try {
    const docker = createDockerClient(host);
    const containers = await docker.listContainers({ all: showAll });

    return {
      success: true,
      containers: containers.map(container => ({
        id: container.Id,
        names: container.Names,
        image: container.Image,
        status: container.Status,
        state: container.State,
        ports: container.Ports,
        created: container.Created
      }))
    };

  } catch (error) {
    logger.error('Failed to list containers:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get container logs
const getContainerLogs = async (containerName, host = null, tail = 100) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: tail,
      timestamps: true
    });

    return {
      success: true,
      logs: logs.toString()
    };

  } catch (error) {
    logger.error('Failed to get container logs:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Update container resources
const updateContainerResources = async (containerName, resources, host = null) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    const updateConfig = {
      Memory: resources.memory * 1024 * 1024, // MB to bytes
      CpuShares: resources.cpu * 1024
    };

    await container.update(updateConfig);

    logger.info('Container resources updated', {
      containerName,
      memory: resources.memory,
      cpu: resources.cpu
    });

    return {
      success: true,
      containerName: containerName,
      updatedResources: resources
    };

  } catch (error) {
    logger.error('Failed to update container resources:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Execute command in container
const execInContainer = async (containerName, command, host = null) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    const exec = await container.exec({
      Cmd: Array.isArray(command) ? command : ['sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start({ hijack: true, stdin: true });

    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    await new Promise((resolve) => {
      stream.on('end', resolve);
    });

    return {
      success: true,
      output: output.trim()
    };

  } catch (error) {
    logger.error('Failed to execute command in container:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Copy files/directory to container
 */
const copyToContainer = async (containerName, sourcePath, destPath, host = null) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    const tar = require('tar-fs');
    const fs = require('fs');
    const path = require('path');

    // Create tar stream from source
    const tarStream = tar.pack(sourcePath);

    // Put archive to container
    await container.putArchive(tarStream, {
      path: path.dirname(destPath)
    });

    logger.info('Files copied to container', {
      container: containerName,
      source: sourcePath,
      dest: destPath
    });

    return {
      success: true
    };

  } catch (error) {
    logger.error('Failed to copy files to container:', error);
    return {
      success: false,
      error: error.message
    };
  }
};


// Deploy application to container
const deployToContainer = async (deploymentConfig) => {
  try {
    const {
      projectName,
      imageName,
      port,
      env,
      host,
      resources
    } = deploymentConfig;

    // Generate unique container name
    const containerName = `${projectName}-${Date.now()}`;

    // Run new container
    const result = await runContainer(imageName, containerName, {
      port: port,
      env: env,
      host: host,
      memory: resources.memory || 512,
      cpu: resources.cpu || 1
    });

    if (!result.success) {
      return result;
    }

    // Wait for container to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get container stats (CPU, RAM, Storage)


    // Check if container is running
    const status = await getContainerStatus(containerName, host);

    return {
      success: true,
      deployment: {
        containerName: containerName,
        containerId: result.containerId,
        port: result.port,
        url: host ? `http://${host}:${port}` : `http://localhost:${port}`,
        status: status.success ? status.status : 'unknown'
      }
    };

  } catch (error) {
    logger.error('Failed to deploy to container:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Clean up old containers for a project
const cleanupOldContainers = async (projectName, keepCount = 2, host = null) => {
  try {
    const containers = await listContainers(host, true);

    if (!containers.success) {
      return containers;
    }

    // Filter containers for this project
    const projectContainers = containers.containers
      .filter(c => c.names.some(name => name.includes(projectName)))
      .sort((a, b) => b.created - a.created);

    // Keep only the latest containers, remove others
    const containersToRemove = projectContainers.slice(keepCount);

    for (const container of containersToRemove) {
      const containerName = container.names[0].replace('/', '');
      await stopContainer(containerName, host);
    }

    logger.info('Cleaned up old containers', {
      projectName,
      removed: containersToRemove.length
    });

    return {
      success: true,
      removedCount: containersToRemove.length
    };

  } catch (error) {
    logger.error('Failed to cleanup old containers:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Create data volume for backup purposes
const createDataVolume = async (volumeName, host = null) => {
  try {
    const docker = createDockerClient(host);

    const volume = await docker.createVolume({
      Name: volumeName,
      Driver: 'local'
    });

    logger.info('Data volume created successfully', {
      volumeName,
      volumeId: volume.Name
    });

    return {
      success: true,
      volumeName: volume.Name,
      volumeId: volume.Name
    };
  } catch (error) {
    logger.error('Failed to create data volume:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Remove data volume
const removeDataVolume = async (volumeName, host = null) => {
  try {
    const docker = createDockerClient(host);
    const volume = docker.getVolume(volumeName);

    await volume.remove();

    logger.info('Data volume removed successfully', { volumeName });

    return {
      success: true,
      volumeName: volumeName
    };
  } catch (error) {
    logger.error('Failed to remove data volume:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Backup container data to volume
const backupContainerData = async (containerName, backupVolumeName, host = null) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    // Create a temporary container to perform backup
    const backupContainer = await docker.createContainer({
      Image: 'alpine:latest',
      Cmd: ['tar', 'czf', `/backup/${containerName}-backup.tar.gz`, '-C', '/source', '.'],
      WorkingDir: '/backup',
      HostConfig: {
        VolumesFrom: [containerName],
        Binds: [`${backupVolumeName}:/backup`]
      },
      AttachStdout: true,
      AttachStderr: true
    });

    await backupContainer.start();
    await backupContainer.wait();
    await backupContainer.remove();

    logger.info('Container data backed up successfully', {
      containerName,
      backupVolumeName
    });

    return {
      success: true,
      backupVolume: backupVolumeName,
      backupFile: `${containerName}-backup.tar.gz`
    };
  } catch (error) {
    logger.error('Failed to backup container data:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Restore container data from volume
const restoreContainerData = async (containerName, backupVolumeName, host = null) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    // Create a temporary container to perform restore
    const restoreContainer = await docker.createContainer({
      Image: 'alpine:latest',
      Cmd: ['sh', '-c', `cd /target && tar xzf /backup/*-backup.tar.gz`],
      WorkingDir: '/target',
      HostConfig: {
        VolumesFrom: [containerName],
        Binds: [`${backupVolumeName}:/backup`]
      },
      AttachStdout: true,
      AttachStderr: true
    });

    await restoreContainer.start();
    await restoreContainer.wait();
    await restoreContainer.remove();

    logger.info('Container data restored successfully', {
      containerName,
      backupVolumeName
    });

    return {
      success: true,
      restoredTo: containerName
    };
  } catch (error) {
    logger.error('Failed to restore container data:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Start stopped container
const startContainer = async (containerName, host = null) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    await container.start();

    logger.info('Container started successfully', { containerName });

    return {
      success: true,
      containerName: containerName
    };
  } catch (error) {
    logger.error('Failed to start container:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Alias for execInContainer (for backward compatibility)
const execCommand = execInContainer;

// Remove container
const removeContainer = async (containerName, host = null) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    await container.remove({ force: true });

    logger.info('Container removed successfully', { containerName });

    return {
      success: true,
      containerName: containerName
    };
  } catch (error) {
    logger.error('Failed to remove container:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Enhanced run container with volume support
const runContainerWithVolumes = async (imageName, containerName, options = {}) => {
  try {
    const docker = createDockerClient(options.host);

    const containerConfig = {
      Image: imageName,
      name: containerName,
      ExposedPorts: {
        '3000/tcp': {},
        '80/tcp': {},
        '443/tcp': {}
      },
      HostConfig: {
        PortBindings: {
          '3000/tcp': [{ HostPort: options.port || '3000' }]
        },
        Memory: Math.floor((options.memory || 512) * 1024 * 1024), // Convert MB to bytes
        CpuShares: Math.round((options.cpu || 1) * 1024), // CPU shares
        RestartPolicy: {
          Name: 'unless-stopped'
        },
        Binds: options.volumes || [] // Support for volume mounts
      },
      Env: options.env || [],
      WorkingDir: '/app',
      Cmd: options.cmd || ['npm', 'start']
    };

    const container = await docker.createContainer(containerConfig);
    await container.start();

    const info = await container.inspect();

    logger.info('Container with volumes started successfully', {
      containerId: container.id,
      containerName: containerName,
      port: options.port || '3000',
      volumes: options.volumes || []
    });

    return {
      success: true,
      containerId: container.id,
      containerName: containerName,
      port: options.port || '3000',
      status: info.State.Status,
      ipAddress: info.NetworkSettings.IPAddress
    };
  } catch (error) {
    logger.error('Failed to run container with volumes:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get container stats (CPU, RAM, Storage)
const getContainerStats = async (containerName, host = null) => {
  try {
    const docker = createDockerClient(host);
    const container = docker.getContainer(containerName);

    // Get Docker stats (snapshot, not stream)
    const stats = await container.stats({ stream: false });

    // CPU Calculation
    // Based on: https://docs.docker.com/engine/api/v1.41/#operation/ContainerStats
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemCpuDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const numberCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;

    let cpuPercent = 0.0;
    if (systemCpuDelta > 0.0 && cpuDelta > 0.0) {
      cpuPercent = (cpuDelta / systemCpuDelta) * numberCpus * 100.0;
    }

    // Memory Calculation
    // usage - cache is the "real" usage often shown in docker stats, but 'usage' is safer hard limit check
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryUsageMB = memoryUsage / (1024 * 1024);

    // Storage Calculation (via exec)
    // We already have checkStorageUsage in containerOrchestrator but that's internal.
    // We can run exec here directly.
    let storageMB = 0;
    try {
      const exec = await container.exec({
        Cmd: ['du', '-sk', '/app'],
        AttachStdout: true,
        AttachStderr: true
      });
      const stream = await exec.start({ hijack: true, stdin: true });
      let output = '';
      stream.on('data', chunk => output += chunk.toString());
      await new Promise(resolve => stream.on('end', resolve));

      const kbytes = parseInt(output.split('\t')[0]);
      if (!isNaN(kbytes)) {
        storageMB = kbytes / 1024;
      }
    } catch (e) {
      // Ignore storage error, return 0
    }

    return {
      success: true,
      cpu: cpuPercent / 100, // Return as "cores used" (e.g. 0.5 for 50%)
      cpuPercent: cpuPercent,
      memory: memoryUsageMB, // MB
      storage: storageMB // MB
    };

  } catch (error) {
    // Container might not be running
    return null;
  }
};

module.exports = {
  getContainerStats,
  buildImage,
  runContainer,
  runContainerWithVolumes,
  stopContainer,
  startContainer,
  removeContainer,
  getContainerStatus,
  listContainers,
  getContainerLogs,
  updateContainerResources,
  execInContainer,
  copyToContainer,
  execCommand,
  deployToContainer,
  cleanupOldContainers,
  createDataVolume,
  removeDataVolume,
  restoreContainerData,
  getDockerClient: createDockerClient
};

