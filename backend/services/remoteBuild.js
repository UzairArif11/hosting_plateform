const { NodeSSH } = require('node-ssh');
const path = require('path');
const logger = require('../utils/logger');
const fsPromises = require('fs').promises;
const fs = require('fs');

/**
 * Copy build files to remote server and build Docker image there
 */
async function buildOnRemoteServer(buildPath, imageName, serverHost, serverKey, onLog) {
    const ssh = new NodeSSH();

    try {
        await onLog('info', `📡 Connecting to ${serverHost} via SSH...`);

        // Get SSH credentials based on server
        const sshConfig = getSSHConfig(serverKey, serverHost);

        if (!sshConfig) {
            throw new Error(`SSH configuration not found for ${serverKey}`);
        }

        // Connect to remote server
        await ssh.connect(sshConfig);

        await onLog('info', `✅ SSH connection established to ${serverHost}`);

        // Create remote directory
        const remotePath = `/tmp/builds/${path.basename(buildPath)}`;
        await ssh.execCommand(`mkdir -p ${remotePath}`);
        await onLog('info', `📁 Created remote directory: ${remotePath}`);

        // Copy build directory to remote server
        await onLog('info', `📤 Copying build files to ${serverHost}...`);

        const buildDir = path.join(buildPath, 'build');
        await ssh.putDirectory(buildDir, `${remotePath}/build`, {
            recursive: true,
            concurrency: 10,
            validate: (itemPath) => {
                return !itemPath.includes('node_modules');
            }
        });

        // Copy Dockerfile
        const dockerfilePath = path.join(buildPath, 'Dockerfile');
        await ssh.putFile(dockerfilePath, `${remotePath}/Dockerfile`);

        await onLog('info', `✅ Files copied successfully`);

        // Build Docker image on remote server
        await onLog('info', `🐳 Building Docker image on ${serverHost}...`);

        const buildCommand = `cd ${remotePath} && docker build -t ${imageName} .`;
        const buildResult = await ssh.execCommand(buildCommand);

        if (buildResult.code !== 0) {
            await onLog('error', `Build stderr: ${buildResult.stderr}`);
            throw new Error(`Docker build failed on ${serverHost}: ${buildResult.stderr}`);
        }

        await onLog('info', `✅ Docker image built successfully: ${imageName}`);

        // Verify image exists
        const verifyResult = await ssh.execCommand(`docker images ${imageName} --format "{{.Repository}}:{{.Tag}}"`);
        await onLog('info', `✅ Image verified: ${verifyResult.stdout}`);

        // Cleanup remote build directory
        await ssh.execCommand(`rm -rf ${remotePath}`);
        await onLog('info', `🧹 Cleaned up remote build directory`);

        ssh.dispose();

        return {
            success: true,
            imageName: imageName,
            server: serverHost
        };

    } catch (error) {
        logger.error(`Remote build failed on ${serverHost}:`, error);
        ssh.dispose();
        throw error;
    }
}

/**
 * Get SSH configuration for a server
 * Supports both key-based and password authentication
 */
function getSSHConfig(serverKey, serverHost) {
    const username = process.env.SSH_USERNAME || 'ubuntu';
    const usePassword = process.env.SSH_USE_PASSWORD === 'true';

    const config = {
        host: serverHost,
        username: username
    };

    if (usePassword) {
        // Password authentication
        const password = process.env.SSH_PASSWORD;
        if (!password) {
            throw new Error('SSH_PASSWORD not set in .env');
        }
        config.password = password;
        logger.info(`Using password authentication for ${serverKey}`);
    } else {
        // Key-based authentication
        const keyPath = serverKey === 'EC2'
            ? process.env.SSH_EC2_KEY
            : process.env.SSH_EC3_KEY;

        if (!keyPath) {
            throw new Error(`SSH key not configured for ${serverKey}`);
        }

        // Read the key file content (synchronously for simplicity)
        try {
            const keyContent = fs.readFileSync(keyPath, 'utf8');
            config.privateKey = keyContent;
            logger.info(`Using key authentication for ${serverKey}: ${keyPath}`);
        } catch (error) {
            throw new Error(`Failed to read SSH key from ${keyPath}: ${error.message}`);
        }
    }

    return config;
}

/**
 * Test SSH connection to a server
 */
async function testSSHConnection(serverHost, serverKey) {
    const ssh = new NodeSSH();

    try {
        const sshConfig = getSSHConfig(serverKey, serverHost);

        await ssh.connect(sshConfig);

        const dockerVersion = await ssh.execCommand('docker --version');
        const diskSpace = await ssh.execCommand('df -h /');

        ssh.dispose();

        return {
            success: true,
            dockerVersion: dockerVersion.stdout,
            diskSpace: diskSpace.stdout
        };
    } catch (error) {
        ssh.dispose();
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    buildOnRemoteServer,
    testSSHConnection
};
