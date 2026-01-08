const { NodeSSH } = require('node-ssh');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
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

        // DON'T cleanup yet - files are needed for docker cp during deployment
        // Cleanup will happen in buildExecutor after deployment completes
        // await ssh.execCommand(`rm -rf ${remotePath}`);
        // await onLog('info', `🧹 Cleaned up remote build directory`);

        ssh.dispose();

        return {
            success: true,
            imageName: imageName,
            server: serverHost,
            remotePath: remotePath  // Return path so it can be cleaned later
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

/**
 * Upload build files to remote server (without building Docker image)
 * Used for shared container deployments
 */
async function uploadToRemoteServer(buildPath, deploymentId, serverHost, serverKey, onLog, options = {}) {
    const ssh = new NodeSSH();
    try {
        await onLog('info', `📡 Connecting to ${serverHost} via SSH...`);

        // Get SSH credentials
        const sshConfig = getSSHConfig(serverKey, serverHost);

        await ssh.connect(sshConfig);
        await onLog('info', `✅ SSH connection established to ${serverHost}`);

        // Create remote directory using deployment ID
        const remotePath = `/tmp/builds/${deploymentId}`;
        await ssh.execCommand(`mkdir -p ${remotePath}`);
        await onLog('info', `📁 Created remote directory: ${remotePath}`);

        // Create a compressed archive of the build directory for MUCH faster transfer
        const tarFileName = `build-${deploymentId}.tar.gz`;
        const localTarPath = path.join(path.dirname(buildPath), tarFileName);
        const remoteTarPath = `/tmp/${tarFileName}`;

        await onLog('info', `📦 Compressing build files for fast transfer...`);

        // Verify server.js exists before creating tar (critical for PM2)
        const serverJsPath = path.join(buildPath, 'server.js');
        try {
            await fsPromises.access(serverJsPath);
            await onLog('info', '✅ Verified server.js exists locally before tar');
        } catch (err) {
            await onLog('warn', `⚠️ server.js not found at ${serverJsPath} - will check after tar`);
        }

        // Use system tar
        // Handle exclusions if provided (to skip node_modules for static sites)
        let excludeCmd = '';
        if (options.exclude) {
            const excludes = Array.isArray(options.exclude) ? options.exclude : [options.exclude];
            excludeCmd = excludes.map(ex => `--exclude="${ex}"`).join(' ') + ' ';
        }

        const normalizedBuildPath = buildPath.replace(/\\/g, '/');
        
        // Create tar archive - explicitly include server.js if it exists
        // Use --no-wildcards-match-slash to ensure proper matching
        const tarCommand = `tar ${excludeCmd}--no-wildcards-match-slash -czf "${localTarPath}" -C "${normalizedBuildPath}" .`;
        await onLog('info', `Running: ${tarCommand.replace(/\s+/g, ' ')}`);
        await execAsync(tarCommand);

        // Verify server.js is in the tar archive
        try {
            const verifyTar = await execAsync(`tar -tzf "${localTarPath}" | grep -E "(^|\/)server\.js$" || echo "NOT_FOUND"`);
            if (verifyTar.stdout && verifyTar.stdout.includes('NOT_FOUND')) {
                await onLog('error', `❌ server.js NOT FOUND in tar archive!`);
                await onLog('info', `Files in tar: ${(await execAsync(`tar -tzf "${localTarPath}" | head -20`)).stdout}`);
                throw new Error('server.js not included in tar archive');
            } else {
                await onLog('info', `✅ Verified server.js is in tar archive`);
            }
        } catch (verifyErr) {
            if (verifyErr.message.includes('server.js not included')) {
                throw verifyErr;
            }
            // If grep fails for other reasons, continue (server.js might be there)
            await onLog('warn', `Could not verify server.js in tar: ${verifyErr.message}`);
        }

        // Get compressed size for logging
        const stats = await fsPromises.stat(localTarPath);
        const compressedSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        await onLog('info', `📤 Uploading compressed archive (${compressedSizeMB} MB) to ${serverHost}...`);

        // Upload the single tarball
        await ssh.putFile(localTarPath, remoteTarPath);

        await onLog('info', `🔓 Extracting files on ${serverKey}...`);

        // Extract archive remotely
        // -x: extract, -z: uncompress, -f: file, -C: destination directory
        await ssh.execCommand(`tar -xzf ${remoteTarPath} -C ${remotePath}`);

        // Cleanup
        await ssh.execCommand(`rm ${remoteTarPath}`);
        try {
            await fsPromises.unlink(localTarPath);
        } catch (e) {
            logger.warn(`Failed to delete local tarball: ${e.message}`);
        }

        await onLog('info', `✅ Files copied and extracted successfully`);
        ssh.dispose();
        return { success: true, remotePath };

    } catch (error) {
        logger.error(`Upload failed:`, error);
        ssh.dispose();
        throw error;
    }
}

module.exports = {
    buildOnRemoteServer,
    testSSHConnection,
    uploadToRemoteServer,
    getSSHConfig
};
