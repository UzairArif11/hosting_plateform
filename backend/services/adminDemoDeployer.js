/**
 * Admin Template Demo Deployer
 * 
 * Deploys template demos directly to admin containers WITHOUT creating user projects.
 * This is separate from regular user deployments.
 */

const { execSync } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');
const websocketService = require('./websocket');

const BUILD_DIR = '/tmp/admin-demos';
const ADMIN_SERVER_IP = process.env.EC2_SERVER_IP || '140.238.229.147';
const ADMIN_SSH_KEY = process.env.SSH_EC2_KEY || '/home/ubuntu/.ssh/ec2_key';

/**
 * Deploy a template as an admin demo
 * @param {Object} params
 * @param {Object} params.template - Template document
 * @param {string} params.deploymentId - Unique deployment ID for tracking
 * @returns {Promise<Object>} Deployment result with URL
 */
async function deployAdminDemo({ template, deploymentId }) {
    const emitLog = (level, message) => {
        logger.info(`[${deploymentId}] ${message}`);
        const io = websocketService.getIO();
        if (io) {
            io.emit('deployment-log', {
                deploymentId,
                timestamp: new Date().toISOString(),
                level,
                message
            });
        }
    };

    const emitProgress = (progress, status = 'deploying') => {
        const io = websocketService.getIO();
        if (io) {
            io.emit('template-demo-status', {
                templateId: template._id.toString(),
                status,
                progress,
                message: `${progress}% complete`
            });
        }
    };

    try {
        emitLog('info', '🚀 Starting admin demo deployment...');
        emitProgress(5);

        // Create build directory
        const buildPath = path.join(BUILD_DIR, deploymentId);
        await fs.mkdir(buildPath, { recursive: true });

        // Clone repository
        emitLog('info', `📦 Cloning ${template.githubRepo}...`);
        emitProgress(10);

        const repoUrl = `https://github.com/${template.githubRepo}`;
        const token = process.env.GITHUB_API_TOKEN;
        const repoWithAuth = token ? repoUrl.replace('https://github.com/', `https://${token}@github.com/`) : repoUrl;

        try {
            execSync(`git clone --depth 1 --branch ${template.githubBranch || 'main'} ${repoWithAuth} ${buildPath}`, {
                stdio: 'pipe',
                timeout: 5 * 60 * 1000
            });
            emitLog('info', '✓ Repository cloned successfully');
        } catch (error) {
            throw new Error(`Failed to clone repository: ${error.message}`);
        }

        emitProgress(20);

        // Install dependencies
        emitLog('info', '📥 Installing dependencies...');
        try {
            execSync('npm install --legacy-peer-deps', {
                cwd: buildPath,
                stdio: 'pipe',
                timeout: 10 * 60 * 1000
            });
            emitLog('info', '✓ Dependencies installed');
        } catch (error) {
            emitLog('warn', `npm install failed, trying npm ci...`);
            try {
                execSync('npm ci', { cwd: buildPath, stdio: 'pipe' });
                emitLog('info', '✓ Dependencies installed via npm ci');
            } catch (ciError) {
                throw new Error(`Failed to install dependencies: ${error.message}`);
            }
        }

        emitProgress(35);

        // Generate Prisma client if needed
        const hasPrisma = await fs.access(path.join(buildPath, 'prisma', 'schema.prisma'))
            .then(() => true)
            .catch(() => false);

        if (hasPrisma) {
            emitLog('info', '🔧 Generating Prisma client...');
            try {
                execSync('npx prisma generate', {
                    cwd: buildPath,
                    stdio: 'pipe',
                    env: {
                        ...process.env,
                        DATABASE_URL: 'file:./dev.db' // Default for demos
                    }
                });
                emitLog('info', '✓ Prisma client generated');
            } catch (prismaError) {
                emitLog('warn', `⚠️ Prisma generation failed, skipping (not critical for demo)`);
                emitLog('warn', `Prisma error: ${prismaError.message.split('\n')[0]}`);
                // Continue deployment - many templates work without Prisma client
            }
        }

        emitProgress(50);

        // Sanitize package.json (remove prisma generate from build scripts)
        try {
            const packageJsonPath = path.join(buildPath, 'package.json');
            const packageJsonData = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonData);

            let modified = false;

            // Remove prisma generate from build script
            if (packageJson.scripts && packageJson.scripts.build && packageJson.scripts.build.includes('prisma generate')) {
                packageJson.scripts.build = packageJson.scripts.build.replace('prisma generate &&', '').replace('prisma generate', '').trim();
                if (packageJson.scripts.build === '') packageJson.scripts.build = 'next build';
                modified = true;
                emitLog('info', '🔧 Autosix: Removed broken prisma generate from build script');
            }

            // Remove postinstall if it has prisma
            if (packageJson.scripts && packageJson.scripts.postinstall && packageJson.scripts.postinstall.includes('prisma')) {
                delete packageJson.scripts.postinstall;
                modified = true;
                emitLog('info', '🔧 Autosix: Removed broken postinstall script');
            }

            if (modified) {
                await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
            }
        } catch (err) {
            emitLog('warn', `Failed to sanitize package.json: ${err.message}`);
        }

        // Auto-Patch: Create missing critical files to prevent build failures
        try {
            // 1. Create lib/db.ts if missing
            const libDir = path.join(buildPath, 'lib');
            const dbPath = path.join(libDir, 'db.ts');
            if (!await fs.access(dbPath).then(() => true).catch(() => false)) {
                await fs.mkdir(libDir, { recursive: true });
                await fs.writeFile(dbPath, `
// Mock DB client auto-generated by AdminDeployer
export const db = {
  user: { findMany: async () => [], findUnique: async () => null, create: async (d) => d },
  post: { findMany: async () => [], findUnique: async () => null, create: async (d) => d }
};
`);
                emitLog('info', '🔧 Autosix: Created missing lib/db.ts');
            }

            // 2. Create components/Navbar.tsx if missing
            const compDir = path.join(buildPath, 'components');
            const navPath = path.join(compDir, 'Navbar.tsx');
            if (!await fs.access(navPath).then(() => true).catch(() => false)) {
                await fs.mkdir(compDir, { recursive: true });
                await fs.writeFile(navPath, `
import Link from 'next/link';
export default function Navbar() {
  return (
    <nav className="p-4 border-b"><div className="container mx-auto font-bold">SmartPortfolio (Demo)</div></nav>
  );
}
`);
                emitLog('info', '🔧 Autosix: Created missing components/Navbar.tsx');
            }

            // 3. Ensure Tailwind dependencies
            try {
                execSync('npm list tailwindcss', { cwd: buildPath, stdio: 'ignore' });
            } catch (e) {
                emitLog('warn', '⚠️ Tailwind missing, forcing install...');
                execSync('npm install tailwindcss postcss autoprefixer --save-dev', { cwd: buildPath, stdio: 'ignore' });
                emitLog('info', '🔧 Autosix: Installed Tailwind CSS');
            }

        } catch (patchError) {
            emitLog('warn', `Patch warning: ${patchError.message}`);
        }

        // Build project
        emitLog('info', '🔨 Building project...');
        try {
            execSync('npm run build', {
                cwd: buildPath,
                stdio: 'pipe',
                timeout: 15 * 60 * 1000,
                env: {
                    ...process.env,
                    NODE_ENV: 'production',
                    DATABASE_URL: 'file:./dev.db' // Lite mode default
                }
            });
            emitLog('info', '✓ Build completed');
        } catch (error) {
            throw new Error(`Build failed: ${error.message}`);
        }

        emitProgress(70);

        // Create container name
        const containerName = `admin-${template.slug}`;

        emitLog('info', `🐳 Deploying to container: ${containerName}...`);

        // Stop and remove old container if exists
        try {
            execSync(`ssh -i ${ADMIN_SSH_KEY} -o StrictHostKeyChecking=no ubuntu@${ADMIN_SERVER_IP} "docker stop ${containerName} 2>/dev/null || true; docker rm ${containerName} 2>/dev/null || true"`, {
                stdio: 'pipe'
            });
        } catch (e) {
            // Ignore if container doesn't exist
        }

        // Create .tar.gz of build
        const tarFile = `/tmp/admin-demo-${deploymentId}.tar.gz`;
        execSync(`tar -czf ${tarFile} -C ${buildPath} .`, {
            stdio: 'pipe'
        });

        emitProgress(80);

        // Upload to server
        emitLog('info', '📤 Uploading to server...');
        execSync(`scp -i ${ADMIN_SSH_KEY} -o StrictHostKeyChecking=no ${tarFile} ubuntu@${ADMIN_SERVER_IP}:/tmp/`, {
            stdio: 'pipe'
        });

        // Extract and run container
        emitLog('info', '🚀 Starting container...');
        const port = 3000 + Math.floor(Math.random() * 1000); // Random port for now

        execSync(`ssh -i ${ADMIN_SSH_KEY} -o StrictHostKeyChecking=no ubuntu@${ADMIN_SERVER_IP} "
            mkdir -p /tmp/admin-demos/${containerName} && \
            tar -xzf /tmp/admin-demo-${deploymentId}.tar.gz -C /tmp/admin-demos/${containerName} && \
            docker run -d \
                --name ${containerName} \
                --restart unless-stopped \
                -p ${port}:3000 \
                -v /tmp/admin-demos/${containerName}:/app \
                -w /app \
                node:18-alpine \
                sh -c 'npm start || npx next start' && \
            rm /tmp/admin-demo-${deploymentId}.tar.gz
        "`, {
            stdio: 'pipe'
        });

        emitLog('info', '✅ Container started successfully');
        emitProgress(90);

        // Generate demo URL
        const demoUrl = `http://${ADMIN_SERVER_IP}:${port}`;

        emitLog('info', `✅ Admin demo deployed: ${demoUrl}`);
        emitProgress(100, 'success');

        // Cleanup local files
        await fs.rm(buildPath, { recursive: true, force: true });
        await fs.rm(tarFile, { force: true });

        return {
            success: true,
            demoUrl,
            containerName,
            port
        };

    } catch (error) {
        emitLog('error', `❌ Deployment failed: ${error.message}`);
        emitProgress(0, 'failed');

        const io = websocketService.getIO();
        if (io) {
            io.emit('template-demo-status', {
                templateId: template._id.toString(),
                status: 'failed',
                progress: 0,
                error: error.message
            });
        }

        throw error;
    }
}

/**
 * Remove an admin demo deployment
 */
async function removeAdminDemo({ template }) {
    const containerName = `admin-${template.slug}`;

    try {
        execSync(`ssh -i ${ADMIN_SSH_KEY} -o StrictHostKeyChecking=no ubuntu@${ADMIN_SERVER_IP} "
            docker stop ${containerName} 2>/dev/null || true && \
            docker rm ${containerName} 2>/dev/null || true && \
            rm -rf /tmp/admin-demos/${containerName} 2>/dev/null || true
        "`, {
            stdio: 'pipe'
        });

        logger.info(`Admin demo removed: ${containerName}`);
        return { success: true };
    } catch (error) {
        logger.error(`Failed to remove admin demo: ${error.message}`);
        throw error;
    }
}

module.exports = {
    deployAdminDemo,
    removeAdminDemo
};
