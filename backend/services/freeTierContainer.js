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
        const containerName = `${serverKey}-user-${user._id}`;

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
        logger.info('🐳 [CREATE_CONTAINER] Calling docker.runContainer with node:18-alpine');
        const result = await docker.runContainer('node:18-alpine', containerName, {
            host: server.host,
            port: port,
            memory: resources.ram * 1024, // GB to MB
            cpu: resources.cpu,
            storage: resources.storage,
            env: [
                `USER_ID=${user._id}`,
                `USER_EMAIL=${user.email}`,
                `PLAN_TYPE=${user.planType || 'free'}`
            ],
            restart: 'unless-stopped',
            networkMode: 'host', // Use host networking
            // Keep container running
            cmd: ['sh', '-c', 'apk add --no-cache git && npm install -g pm2 && pm2 start /dev/null --name keepalive && tail -f /dev/null']
        });

        // Handle "Container Already Exists" (Conflict) gracefully
        if (!result.success) {
            if (result.error && (result.error.includes('Conflict') || result.error.includes('already in use'))) {
                logger.info('⚠️ [CREATE_CONTAINER] Container already exists, reusing it:', containerName);

                // Fetch existing container details to get ID
                // Note: We assume it's healthy if it exists
                // If we really wanted to be robust, we'd inspect it here.

                return {
                    success: true,
                    containerName: containerName,
                    containerId: result.containerId || 'existing', // docker.run might not return ID on failure
                    port: port, // Reuse the port meant for this allocation session (or fetch from DB if needed, but irrelevant for Host Mode)
                    reused: true
                };
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


        // Install dependencies AND Build inside container (Remote Build)
        logger.info(`📦 Running npm install & build inside container...`);

        // Add memory optimization flags for React/Node builds
        // PUBLIC_URL='.' makes React use relative paths (works with any subpath)
        const buildCommand = `docker exec ${containerName} sh -c "cd ${projectPath} && [ -f package.json ] && npm install && NODE_OPTIONS='--max-old-space-size=900' PUBLIC_URL='.' GENERATE_SOURCEMAP=false npm run build --if-present"`;
        const buildResult = await ssh.execCommand(buildCommand);

        // Log the build output
        if (buildResult.stdout) {
            logger.info(`Build output: ${buildResult.stdout.substring(0, 500)}`);
        }
        if (buildResult.stderr) {
            logger.warn(`Build warnings: ${buildResult.stderr.substring(0, 500)}`);
        }

        // Check if build succeeded
        if (buildResult.code !== 0) {
            throw new Error(`Build failed with code ${buildResult.code}: ${buildResult.stderr}`);
        }

        // Verify build directory was created
        const checkBuildDir = await ssh.execCommand(`docker exec ${containerName} ls -la ${projectPath}/build`);
        if (checkBuildDir.code !== 0) {
            logger.warn(`Build directory not found at ${projectPath}/build - may be using different output directory or is Node.js app`);
        } else {
            logger.info(`✅ Build directory verified: ${projectPath}/build`);
        }


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
        const startCommand = `docker exec ${containerName} pm2 start ${projectPath}/server.js --name ${project._id} -- --port ${port}`;
        const startResult = await ssh.execCommand(startCommand);

        if (startResult.code !== 0) {
            throw new Error(`Failed to start PM2 process: ${startResult.stderr}`);
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
    const maxPort = 9999;
    const maxAttempts = 100;

    for (let i = 0; i < maxAttempts; i++) {
        const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
        if (await isPortFree(port)) {
            return port;
        }
    }
    throw new Error('No available port found after multiple attempts');
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

module.exports = {
    createUserContainer,
    deployProjectToUserContainer,
    stopProjectInUserContainer,
    removeProjectFromUserContainer,
    listProjectsInUserContainer,
    getAvailablePort
};
