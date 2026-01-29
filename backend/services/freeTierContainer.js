const docker = require('./docker');
const logger = require('../utils/logger');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');

/**
 * Create user's main container with PM2 installed
 * This container will host all user's projects as PM2 processes
 */
async function createUserContainer(user, serverKey, server, resources) {
    try {
        // Deterministic naming using User Mongo ID (No timestamp)
        // This ensures the user always maps to the same container
        // Use 'admin' prefix for admin users deploying templates, 'user' prefix for regular users
        const userType = user.role === 'admin' ? 'admin' : 'user';
        const containerName = `${serverKey}-${userType}-${user._id}`;

        // We still get a port variable for metadata, even if using Host Networking
        const port = await getAvailablePort();

        logger.info('🚀 [CREATE_CONTAINER] Starting user container creation', {
            user: user.email,
            username: user.username,
            container: containerName,
            server: serverKey,
            host: server.host,
            resources
        });

        // Create container with Node.js and PM2
        logger.info('🐳 [CREATE_CONTAINER] Calling docker.runContainer with node-pm2-alpine:latest');

        // CRITICAL FIX: Build PM2 image on server if it doesn't exist
        const { NodeSSH } = require('node-ssh');
        const ssh = new NodeSSH();
        const remoteBuild = require('./remoteBuild');

        try {
            const sshConfig = remoteBuild.getSSHConfig(serverKey, server.host);
            await ssh.connect(sshConfig);

            // Check if image exists
            const checkImage = await ssh.execCommand('docker images node-pm2-alpine:latest -q');

            if (!checkImage.stdout || checkImage.stdout.trim() === '') {
                logger.info('📦 [CREATE_CONTAINER] PM2 image not found on ' + serverKey + ', building it now...');
                logger.info('⏱️  [CREATE_CONTAINER] This is a one-time build (~30s). Image will be cached for future users.');

                // Create Dockerfile content
                const dockerfile = `FROM node:18-alpine\nRUN npm install -g pm2@latest --no-audit --no-fund --silent --prefer-offline --no-optional\nRUN pm2 --version\nWORKDIR /app\nENV NODE_ENV=production\nEXPOSE 3000\nCMD ["pm2-runtime", "start", "ecosystem.config.js"]`;

                // Write Dockerfile to remote server
                await ssh.execCommand(`mkdir -p /tmp/pm2-image && echo '${dockerfile}' > /tmp/pm2-image/Dockerfile`);

                // Build image (tagged and persisted in Docker on this server)
                const buildResult = await ssh.execCommand('cd /tmp/pm2-image && docker build -t node-pm2-alpine:latest .');

                if (buildResult.code !== 0) {
                    logger.error('❌ Failed to build PM2 image:', buildResult.stderr);
                    throw new Error('PM2 image build failed: ' + buildResult.stderr);
                }

                logger.info('✅ [CREATE_CONTAINER] PM2 image built and cached on ' + serverKey);
                logger.info('💾 [CREATE_CONTAINER] Future deployments on ' + serverKey + ' will use cached image (instant)');

                // Cleanup temp directory (image remains in Docker cache)
                await ssh.execCommand('rm -rf /tmp/pm2-image');
            } else {
                logger.info('✅ [CREATE_CONTAINER] PM2 image found in cache on ' + serverKey + ' (instant deployment)');
                logger.info('⚡ [CREATE_CONTAINER] Skipping build - using cached image');
            }

            ssh.dispose();
        } catch (sshError) {
            logger.warn('⚠️ [CREATE_CONTAINER] Could not verify/build PM2 image:', sshError.message);
            ssh.dispose();
        }

        const result = await docker.runContainer('node-pm2-alpine:latest', containerName, {
            host: server.host,
            port: port,
            memory: resources.ram * 1024,
            cpu: resources.cpu,
            storage: resources.storage,
            env: [
                `USER_ID=${user._id}`,
                `USER_EMAIL=${user.email}`,
                `PLAN_TYPE=${user.planType || 'free'}`
            ],
            restart: 'unless-stopped',
            networkMode: 'host',
            cmd: ['pm2-runtime', 'start', '/dev/null', '--name', 'keepalive']
        });

        // Handle "Container Already Exists" (Conflict) by removing and recreating (Applies new limits)
        if (!result.success) {
            if (result.error && (result.error.includes('Conflict') || result.error.includes('already in use'))) {
                logger.info('⚠️ [CREATE_CONTAINER] Container name conflict. Removing old container to apply new limits:', containerName);

                try {
                    const dockerClient = docker.getDockerClient(server.host);
                    const oldContainer = dockerClient.getContainer(containerName);
                    await oldContainer.stop().catch(() => { });
                    await oldContainer.remove().catch(() => { });

                    // RETRY Creation
                    logger.info('♻️ [CREATE_CONTAINER] Old container removed. Retrying creation...');
                    return await createUserContainer(user, serverKey, server, resources);
                } catch (retryErr) {
                    logger.error('❌ [CREATE_CONTAINER] Failed during conflict resolution:', retryErr.message);
                    throw new Error(`Conflict resolution failed: ${retryErr.message}`);
                }
            }

            logger.error('❌ [CREATE_CONTAINER] Failed to create container:', result.error);
            throw new Error(`Failed to create container: ${result.error}`);
        }

        logger.info('✅ [CREATE_CONTAINER] User container created successfully', {
            user: user.email,
            container: containerName,
            containerId: result.containerId || result.id,
            port
        });

        return {
            success: true,
            containerName,
            containerId: result.containerId || result.id,
            port
        };

    } catch (error) {
        logger.error('❌ [CREATE_CONTAINER] Error creating user container:', {
            error: error.message,
            stack: error.stack,
            user: user.email
        });
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Deploy project inside user's container as PM2 process
 * All projects run as processes in the SAME container
 */
async function deployProjectToUserContainer(user, project, buildPath, containerInfo) {
    try {
        const { containerName, serverKey, host } = containerInfo;

        // Get available port for this project
        const port = await getAvailablePort();

        logger.info('🚀 [DEPLOY_PROJECT] Starting PM2 deployment', {
            user: user.email,
            project: project.name,
            projectId: project._id,
            container: containerName,
            server: serverKey,
            host: host,
            port,
            buildPath
        });

        // Use SSH to deploy to container
        logger.info('🔐 [DEPLOY_PROJECT] Connecting via SSH to server');
        const ssh = new NodeSSH();

        // Get SSH key for server
        const keyPath = serverKey === 'EC2' ? process.env.SSH_EC2_KEY
            : serverKey === 'EC3' ? process.env.SSH_EC3_KEY
                : process.env.SSH_EC3_KEY;

        const keyContent = fs.readFileSync(keyPath, 'utf8');

        await ssh.connect({
            host: host,
            username: process.env.SSH_USERNAME || 'ubuntu',
            privateKey: keyContent
        });

        // Create project directory in container
        const projectPath = `/app/projects/${project._id}`;
        await ssh.execCommand(`docker exec ${containerName} mkdir -p ${projectPath}`);

        // Copy files to container using docker cp (more reliable than pipe)
        // Ensure proper permissions on host first
        await ssh.execCommand(`chmod -R 755 ${buildPath}`);

        // Use docker cp to copy from host to container
        // Note: buildPath is the remote path on the server
        const cpCommand = `docker cp ${buildPath}/. ${containerName}:${projectPath}/`;
        const cpResult = await ssh.execCommand(cpCommand);

        if (cpResult.code !== 0) {
            logger.error(`Docker CP failed: ${cpResult.stderr}`);
            // Fallback to tar if cp fails (or just throw)
            throw new Error(`Failed to copy files: ${cpResult.stderr}`);
        }

        logger.info(`✅ Using pre-built artifacts from local build.`);

        // Verify files were copied correctly
        const listFiles = await ssh.execCommand(`docker exec ${containerName} ls -la ${projectPath}/`);
        logger.info(`📁 Files in container: ${listFiles.stdout || 'none'}`);

        // Verify server.js exists (required for PM2)
        const checkServerJs = await ssh.execCommand(`docker exec ${containerName} test -f ${projectPath}/server.js && echo "EXISTS" || echo "MISSING"`);
        if (!checkServerJs.stdout || !checkServerJs.stdout.includes('EXISTS')) {
            // List what files actually exist
            const listResult = await ssh.execCommand(`docker exec ${containerName} find ${projectPath} -type f -name "*.js" | head -10`);
            logger.error(`❌ server.js not found in container! Files found: ${listResult.stdout || 'none'}`);

            // Also check on remote host
            const checkRemote = await ssh.execCommand(`ls -la ${buildPath}/server.js 2>&1 || echo "NOT_FOUND"`);
            logger.error(`Remote server.js check: ${checkRemote.stdout || checkRemote.stderr}`);

            throw new Error(`server.js not found in container at ${projectPath}/server.js. Files copied: ${listFiles.stdout}`);
        }
        logger.info(`✅ server.js verified: ${projectPath}/server.js`);

        // Verify build directory was created (for static sites)
        const checkBuildDir = await ssh.execCommand(`docker exec ${containerName} ls -la ${projectPath}/build 2>&1 || echo "NO_BUILD_DIR"`);
        if (checkBuildDir.stdout && checkBuildDir.stdout.includes('NO_BUILD_DIR')) {
            logger.warn(`Build directory not found at ${projectPath}/build - may be using different output directory or is Node.js app`);
        } else {
            logger.info(`✅ Build directory verified: ${projectPath}/build`);
        }



        // PM2 is pre-installed in custom image, no wait needed

        // Check if PM2 process already exists and delete it
        const pm2ListCommand = `docker exec ${containerName} pm2 list`;
        const listResult = await ssh.execCommand(pm2ListCommand);

        if (listResult.stdout && listResult.stdout.includes(project._id.toString())) {
            // Process exists, delete it first
            const deleteCommand = `docker exec ${containerName} pm2 delete ${project._id}`;
            await ssh.execCommand(deleteCommand);
            logger.info(`🗑️  Deleted old PM2 process: ${project._id}`);
        }

        // Start project with PM2
        logger.info(`🚀 Starting PM2 process for project: ${project._id}`);
        const startCommand = `docker exec ${containerName} pm2 start ${projectPath}/server.js --name ${project._id} -- --port ${port}`;
        const startResult = await ssh.execCommand(startCommand);

        if (startResult.code !== 0) {
            const errorMsg = (startResult.stderr || startResult.stdout || 'Unknown error').trim();
            logger.error(`Failed to start PM2 process: ${errorMsg}`);
            throw new Error(`Failed to start PM2 process: ${errorMsg}`);
        }

        // Save PM2 process list
        await ssh.execCommand(`docker exec ${containerName} pm2 save`);

        ssh.dispose();

        // Update project with deployment info
        const Project = require('../models/Project');
        await Project.findByIdAndUpdate(project._id, {
            containerName: containerName,
            port: port,
            server: serverKey,
            processName: project._id.toString(),
            deployedAt: new Date(),
            status: 'active'  // Valid enum value
        });

        logger.info(`✅ Project deployed as PM2 process`, {
            user: user.email,
            project: project.name,
            container: containerName,
            port,
            processName: project._id
        });

        return {
            containerName: containerName,
            port,
            serverKey,
            host: host,
            processName: project._id.toString()
        };

    } catch (error) {
        logger.error('Failed to deploy project as PM2 process:', error);
        throw error;
    }
}

/**
 * Get available port for project
 */
// Helper to check if port is free
function isPortFree(port) {
    return new Promise((resolve) => {
        const net = require('net');
        const tester = net.createServer()
            .once('error', () => resolve(false))
            .once('listening', () => tester.close(() => resolve(true)))
            .listen(port);
    });
}

/**
 * Get available port for project
 */
async function getAvailablePort() {
    const minPort = 4000;
    const maxPort = 20000; // Increased range for safety
    const maxAttempts = 200;

    // Importing Deployment model to check global usage
    const Deployment = require('../models/Deployment');

    for (let i = 0; i < maxAttempts; i++) {
        const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;

        // Check 1: Is it used in DB?
        const existing = await Deployment.findOne({ port: port, status: { $ne: 'failed' } });
        if (!existing) {
            return port;
        }
    }
    throw new Error('No available global port found after multiple attempts');
}

/**
 * Stop project PM2 process
 */
async function stopProjectInUserContainer(project, containerName, host, serverKey) {
    try {
        logger.info(`Stopping PM2 process ${project._id}`, { containerName });

        const ssh = new NodeSSH();
        const keyPath = serverKey === 'EC2' ? process.env.SSH_EC2_KEY
            : serverKey === 'EC3' ? process.env.SSH_EC3_KEY
                : process.env.SSH_EC3_KEY;

        const keyContent = fs.readFileSync(keyPath, 'utf8');

        await ssh.connect({
            host: host,
            username: process.env.SSH_USERNAME || 'ubuntu',
            privateKey: keyContent
        });

        // Stop PM2 process
        await ssh.execCommand(`docker exec ${containerName} pm2 stop ${project._id}`);
        await ssh.execCommand(`docker exec ${containerName} pm2 delete ${project._id}`);
        await ssh.execCommand(`docker exec ${containerName} pm2 save`);

        ssh.dispose();

        logger.info(`✅ PM2 process stopped`, { projectId: project._id });

        return { success: true };

    } catch (error) {
        logger.error('Failed to stop PM2 process:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Remove project from user container
 */
async function removeProjectFromUserContainer(project, containerName, host, serverKey) {
    try {
        logger.info(`Removing project ${project._id}`, { containerName });

        // Stop PM2 process first
        await stopProjectInUserContainer(project, containerName, host, serverKey);

        const ssh = new NodeSSH();
        const keyPath = serverKey === 'EC2' ? process.env.SSH_EC2_KEY
            : serverKey === 'EC3' ? process.env.SSH_EC3_KEY
                : process.env.SSH_EC3_KEY;

        const keyContent = fs.readFileSync(keyPath, 'utf8');

        await ssh.connect({
            host: host,
            username: process.env.SSH_USERNAME || 'ubuntu',
            privateKey: keyContent
        });

        // Remove project files
        await ssh.execCommand(`docker exec ${containerName} rm -rf /app/projects/${project._id}`);

        ssh.dispose();

        logger.info(`✅ Project removed`, { projectId: project._id });

        return { success: true };

    } catch (error) {
        logger.error('Failed to remove project:', error);
        return { success: false, error: error.message };
    }
}

/**
 * List all PM2 processes in user container
 */
async function listProjectsInUserContainer(containerName, host, serverKey) {
    try {
        const ssh = new NodeSSH();
        const keyPath = serverKey === 'EC2' ? process.env.SSH_EC2_KEY
            : serverKey === 'EC3' ? process.env.SSH_EC3_KEY
                : process.env.SSH_EC3_KEY;

        const keyContent = fs.readFileSync(keyPath, 'utf8');

        await ssh.connect({
            host: host,
            username: process.env.SSH_USERNAME || 'ubuntu',
            privateKey: keyContent
        });

        const result = await ssh.execCommand(`docker exec ${containerName} pm2 jlist`);

        ssh.dispose();

        const processes = JSON.parse(result.stdout || '[]');

        return {
            success: true,
            projects: processes.map(p => ({
                projectId: p.name,
                status: p.pm2_env.status,
                memory: p.monit.memory,
                cpu: p.monit.cpu,
                uptime: p.pm2_env.pm_uptime
            }))
        };

    } catch (error) {
        logger.error('Failed to list PM2 processes:', error);
        return { success: false, error: error.message, projects: [] };
    }
}

/**
 * Completely remove user container (e.g. when last project is deleted)
 */
async function removeUserContainer(user) {
    try {
        const userId = user._id || user.id;
        let serversToTry = [];

        if (user.assignedServer) {
            serversToTry.push(user.assignedServer);
        } else {
            // If server metadata is missing, try all known servers
            serversToTry = ['EC2', 'EC3'];
        }

        let removed = false;

        for (const serverKey of serversToTry) {
            const containerName = user.containerName || `${serverKey}-user-${userId}`;
            // Correct ENV keys and fallbacks for this specific environment (EC3 is on 129.154.255.90)
            const host = process.env[`${serverKey}_SERVER_IP`] || (serverKey === 'EC3' ? '129.154.255.90' : '129.154.255.90');

            try {
                logger.info(`[REMOVE_CONTAINER] Checking for ${containerName} on ${serverKey} (${host})...`);
                const dockerClient = docker.getDockerClient(host);
                const container = dockerClient.getContainer(containerName);

                // Check if it exists before trying to stop
                const info = await container.inspect();
                if (info) {
                    logger.info(`[REMOVE_CONTAINER] Found container ${containerName} on ${serverKey}. Stopping and removing...`);
                    await container.stop();
                    await container.remove();
                    logger.info(`✅ Container ${containerName} removed from ${serverKey}`);
                    removed = true;
                }
            } catch (e) {
                // Ignore if container not found on this specific server
                if (!e.message.includes('404')) {
                    logger.warn(`[REMOVE_CONTAINER] Error on ${serverKey}: ${e.message}`);
                }
            }
        }

        return { success: removed };

    } catch (error) {
        logger.error('Failed to remove user container:', error);
        return { success: false, error: error.message };
    }
}


module.exports = {
    createUserContainer,
    deployProjectToUserContainer,
    stopProjectInUserContainer,
    removeProjectFromUserContainer,
    listProjectsInUserContainer,
    removeUserContainer,
    getAvailablePort
};
