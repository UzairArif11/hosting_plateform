const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const Deployment = require('../models/Deployment');
const Project = require('../models/Project');
const User = require('../models/User');
const docker = require('./docker');
const containerOrchestrator = require('./containerOrchestrator');
const githubService = require('./github');
const logger = require('../utils/logger');

const BUILD_DIR = process.env.BUILD_DIR || '/tmp/builds';
const MAX_BUILD_TIME = parseInt(process.env.MAX_BUILD_TIME) || 15 * 60 * 1000; // 15 minutes

/**
 * Execute complete build and deployment process
 */
async function executeBuild(deploymentId, callbacks = {}) {
    const { onProgress = () => { }, onLog = () => { } } = callbacks;

    let deployment = null;
    let project = null;
    let user = null;
    let buildPath = null;

    try {
        // Load deployment
        deployment = await Deployment.findById(deploymentId)
            .populate('projectId')
            .populate('userId');

        if (!deployment) {
            throw new Error('Deployment not found');
        }

        project = deployment.projectId;
        user = deployment.userId;

        await deployment.updateStatus('building');
        await onLog('info', '🚀 Starting deployment...');
        await onProgress(5);

        // Step 1: Clone repository
        await onLog('info', '📦 Cloning repository...');
        buildPath = await cloneRepository(deployment, project, user, onLog);
        await onProgress(20);

        // Step 2: Detect framework
        await onLog('info', '🔍 Detecting framework...');
        const framework = await detectFramework(buildPath, deployment, onLog);
        await onProgress(25);

        // Step 3: Install dependencies
        await onLog('info', '📥 Installing dependencies...');
        await installDependencies(buildPath, framework, deployment, onLog);
        await onProgress(45);

        // Step 4: Build project
        await onLog('info', '🔨 Building project...');
        const buildOutput = await buildProject(buildPath, framework, deployment, project, onLog);
        await onProgress(70);

        // Step 5: Deploy to container
        await onLog('info', '🚢 Deploying to container...');
        await deployment.updateStatus('deploying');
        const deploymentInfo = await deployToContainer(buildPath, buildOutput, deployment, project, user, onLog);
        await onProgress(90);

        // Step 6: Finalize
        await onLog('success', '✅ Deployment successful!');
        await deployment.updateStatus('success', {
            deploymentUrl: deploymentInfo.url,
            containerId: deploymentInfo.containerId,
            containerName: deploymentInfo.containerName,
            port: deploymentInfo.port,
            serverKey: deploymentInfo.serverKey
        });

        await deployment.calculateAnalytics();
        await onProgress(100);

        // Cleanup
        await cleanup(buildPath);

        return {
            success: true,
            deploymentUrl: deploymentInfo.url,
            deployment: deployment.toObject()
        };

    } catch (error) {
        logger.error(`Build failed for deployment ${deploymentId}:`, error);

        if (deployment) {
            await deployment.setError(error, getCurrentPhase(error));
            await onLog('error', `❌ Deployment failed: ${error.message}`);
        }

        // Cleanup on error
        if (buildPath) {
            await cleanup(buildPath);
        }

        throw error;
    }
}

/**
 * Clone repository from GitHub
 */
async function cloneRepository(deployment, project, user, onLog) {
    const buildId = `${deployment._id}-${Date.now()}`;
    const buildPath = path.join(BUILD_DIR, buildId);

    try {
        // Create build directory
        await fs.mkdir(buildPath, { recursive: true });

        // Get repository URL with token
        const repoUrl = project.repository.url;
        const repoWithAuth = repoUrl.replace(
            'https://github.com/',
            `https://${user.githubAccessToken}@github.com/`
        );

        await onLog('info', `Cloning ${project.repository.owner}/${project.repository.name}...`);

        // Clone repository
        const cloneCommand = `git clone --depth 1 --branch ${deployment.branch} ${repoWithAuth} ${buildPath}`;
        const { stdout, stderr } = await execAsync(cloneCommand, {
            timeout: 5 * 60 * 1000 // 5 minutes timeout
        });

        if (stderr && !stderr.includes('Cloning into')) {
            await onLog('warn', stderr);
        }

        await onLog('info', `✓ Repository cloned successfully`);

        // Get commit information
        const { stdout: commitSha } = await execAsync('git rev-parse HEAD', { cwd: buildPath });
        const { stdout: commitMsg } = await execAsync('git log -1 --pretty=%B', { cwd: buildPath });
        const { stdout: authorName } = await execAsync('git log -1 --pretty=%an', { cwd: buildPath });
        const { stdout: authorEmail } = await execAsync('git log -1 --pretty=%ae', { cwd: buildPath });

        deployment.commitSha = commitSha.trim();
        deployment.commitMessage = commitMsg.trim();
        deployment.commitAuthor = {
            name: authorName.trim(),
            email: authorEmail.trim()
        };
        await deployment.save();

        return buildPath;

    } catch (error) {
        error.phase = 'clone';
        throw new Error(`Failed to clone repository: ${error.message}`);
    }
}

/**
 * Detect framework from package.json and files
 */
async function detectFramework(buildPath, deployment, onLog) {
    try {
        // Check if package.json exists
        const packageJsonPath = path.join(buildPath, 'package.json');
        let framework = 'static';

        try {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

            // Detect from dependencies
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

            if (deps.next) {
                framework = 'nextjs';
            } else if (deps.nuxt) {
                framework = 'nuxtjs';
            } else if (deps.react) {
                framework = 'react';
            } else if (deps.vue) {
                framework = 'vue';
            } else if (deps['@angular/core']) {
                framework = 'angular';
            } else if (deps.svelte) {
                framework = 'svelte';
            } else if (deps.express || deps.fastify || deps['@nestjs/core']) {
                framework = 'nodejs';
            }

            deployment.framework = framework;
            deployment.metadata = {
                ...deployment.metadata,
                dependencies: Object.keys(deps).length,
                nodeVersion: packageJson.engines?.node || 'latest',
                npmVersion: packageJson.engines?.npm || 'latest'
            };
            await deployment.save();

        } catch (err) {
            // No package.json, assume static site
            framework = 'static';
        }

        await onLog('info', `✓ Detected framework: ${framework}`);
        return framework;

    } catch (error) {
        error.phase = 'detect';
        throw error;
    }
}

/**
 * Install dependencies
 */
async function installDependencies(buildPath, framework, deployment, onLog) {
    if (framework === 'static') {
        await onLog('info', '✓ No dependencies to install (static site)');
        return;
    }

    try {
        const startTime = Date.now();

        // Detect package manager
        let packageManager = 'npm';
        try {
            await fs.access(path.join(buildPath, 'yarn.lock'));
            packageManager = 'yarn';
        } catch {
            try {
                await fs.access(path.join(buildPath, 'pnpm-lock.yaml'));
                packageManager = 'pnpm';
            } catch {
                packageManager = 'npm';
            }
        }

        await onLog('info', `Using package manager: ${packageManager}`);

        // Install command
        const installCmd = packageManager === 'yarn' ? 'yarn install --frozen-lockfile' :
            packageManager === 'pnpm' ? 'pnpm install --frozen-lockfile' :
                'npm ci';

        deployment.installCommand = installCmd;
        await deployment.save();

        // Execute install
        const { stdout, stderr } = await execAsync(installCmd, {
            cwd: buildPath,
            timeout: 10 * 60 * 1000, // 10 minutes
            maxBuffer: 10 * 1024 * 1024 // 10MB
        });

        if (stdout) await onLog('info', stdout.substring(0, 500));
        if (stderr) await onLog('warn', stderr.substring(0, 500));

        const installTime = Date.now() - startTime;
        await onLog('info', `✓ Dependencies installed in ${(installTime / 1000).toFixed(2)}s`);

    } catch (error) {
        error.phase = 'install';
        throw new Error(`Failed to install dependencies: ${error.message}`);
    }
}

/**
 * Build project
 */
async function buildProject(buildPath, framework, deployment, project, onLog) {
    const startTime = Date.now();

    try {
        let buildCommand = '';
        let outputDir = '';

        // Determine build command and output directory
        switch (framework) {
            case 'nextjs':
                buildCommand = 'npm run build';
                outputDir = '.next';
                break;
            case 'react':
                buildCommand = 'npm run build';
                outputDir = 'build';
                break;
            case 'vue':
                buildCommand = 'npm run build';
                outputDir = 'dist';
                break;
            case 'angular':
                buildCommand = 'npm run build';
                outputDir = 'dist';
                break;
            case 'svelte':
                buildCommand = 'npm run build';
                outputDir = 'public/build';
                break;
            case 'nuxtjs':
                buildCommand = 'npm run build';
                outputDir = '.nuxt';
                break;
            case 'nodejs':
                buildCommand = 'echo "No build needed for Node.js"';
                outputDir = '.';
                break;
            case 'static':
                buildCommand = 'echo "No build needed for static site"';
                outputDir = '.';
                break;
            default:
                buildCommand = 'npm run build';
                outputDir = 'dist';
        }

        // Override with project config if available
        if (project.buildConfig?.buildCommand) {
            buildCommand = project.buildConfig.buildCommand;
        }
        if (project.buildConfig?.outputDirectory) {
            outputDir = project.buildConfig.outputDirectory;
        }

        deployment.buildCommand = buildCommand;
        deployment.outputDirectory = outputDir;
        await deployment.save();

        await onLog('info', `Build command: ${buildCommand}`);

        // Write environment variables
        if (project.environmentVariables && project.environmentVariables.length > 0) {
            const envContent = project.environmentVariables
                .map(env => `${env.key}=${env.value}`)
                .join('\n');
            await fs.writeFile(path.join(buildPath, '.env'), envContent);
            await onLog('info', `✓ Environment variables written (${project.environmentVariables.length} vars)`);
        }

        // Execute build
        if (framework !== 'static' && framework !== 'nodejs') {
            const { stdout, stderr } = await execAsync(buildCommand, {
                cwd: buildPath,
                timeout: MAX_BUILD_TIME,
                maxBuffer: 20 * 1024 * 1024, // 20MB
                env: {
                    ...process.env,
                    NODE_ENV: 'production',
                    CI: 'true'
                }
            });

            if (stdout) {
                const logs = stdout.split('\n').slice(-20).join('\n'); // Last 20 lines
                await onLog('info', logs);
            }
            if (stderr && !stderr.includes('warning')) {
                await onLog('warn', stderr.substring(0, 500));
            }
        }

        const buildTime = Date.now() - startTime;
        deployment.buildDuration = buildTime;
        await deployment.save();

        await onLog('info', `✓ Build completed in ${(buildTime / 1000).toFixed(2)}s`);

        // Get build size
        const buildOutputPath = path.join(buildPath, outputDir);
        const { stdout: sizeOutput } = await execAsync(`du -sb ${buildOutputPath}`);
        const buildSize = parseInt(sizeOutput.split('\t')[0]);

        deployment.metadata = {
            ...deployment.metadata,
            buildSize,
            buildCache: false
        };
        await deployment.save();

        await onLog('info', `✓ Build size: ${(buildSize / 1024 / 1024).toFixed(2)} MB`);

        return {
            outputDir,
            buildSize,
            buildPath
        };

    } catch (error) {
        error.phase = 'build';
        throw new Error(`Build failed: ${error.message}`);
    }
}

/**
 * Deploy to Docker container
 */
async function deployToContainer(buildPath, buildOutput, deployment, project, user, onLog) {
    const startTime = Date.now();

    try {
        const framework = deployment.framework;
        const outputPath = path.join(buildPath, buildOutput.outputDir);

        // Get user's container or create new one
        let containerInfo = await containerOrchestrator.getUserContainer(user._id);

        if (!containerInfo) {
            // Allocate new container
            await onLog('info', 'Allocating new container...');
            containerInfo = await containerOrchestrator.allocateContainer(user, user.currentPlan);
        }

        const { containerName, port, serverKey } = containerInfo;

        await onLog('info', `Deploying to container: ${containerName}`);

        // Create Dockerfile based on framework
        const dockerfile = generateDockerfile(framework, buildOutput.outputDir);
        await fs.writeFile(path.join(buildPath, 'Dockerfile'), dockerfile);

        // Build Docker image
        const imageName = `${project.name}-${deployment._id}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        await onLog('info', `Building Docker image: ${imageName}`);

        const buildImageCmd = `docker build -t ${imageName} ${buildPath}`;
        await execAsync(buildImageCmd, {
            timeout: 10 * 60 * 1000 // 10 minutes
        });

        // Stop existing container if running
        try {
            await docker.stopContainer(containerName);
            await docker.removeContainer(containerName);
            await onLog('info', '✓ Stopped previous deployment');
        } catch (err) {
            // Container might not exist, ignore
        }

        // Run new container
        await onLog('info', 'Starting new container...');

        const server = containerOrchestrator.ORACLE_SERVERS[serverKey];
        await docker.runContainer(imageName, containerName, {
            host: server.host,
            port: port,
            memory: user.resourceAllocation.ram * 1024, // Convert GB to MB
            cpu: user.resourceAllocation.cpu,
            env: project.environmentVariables?.map(e => `${e.key}=${e.value}`) || [],
            restart: 'unless-stopped'
        });

        // Generate deployment URL
        const deploymentUrl = deployment.isPreview
            ? `https://preview-${project.name}-${deployment._id.toString().substring(0, 8)}.${process.env.BASE_DOMAIN || 'vcp.dev'}`
            : `https://${project.name}.${process.env.BASE_DOMAIN || 'vcp.dev'}`;

        const deployTime = Date.now() - startTime;
        deployment.deployDuration = deployTime;
        await deployment.save();

        await onLog('info', `✓ Container deployed in ${(deployTime / 1000).toFixed(2)}s`);
        await onLog('success', `🌐 Deployment URL: ${deploymentUrl}`);

        return {
            url: deploymentUrl,
            containerId: containerName,
            containerName,
            port,
            serverKey
        };

    } catch (error) {
        error.phase = 'deploy';
        throw new Error(`Deployment failed: ${error.message}`);
    }
}

/**
 * Generate Dockerfile based on framework
 */
function generateDockerfile(framework, outputDir) {
    const dockerfiles = {
        nextjs: `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY ${outputDir} ./${outputDir}
COPY public ./public
COPY next.config.js ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
    `,
        react: `
FROM nginx:alpine
COPY ${outputDir} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
    `,
        vue: `
FROM nginx:alpine
COPY ${outputDir} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
    `,
        angular: `
FROM nginx:alpine
COPY ${outputDir} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
    `,
        nodejs: `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
    `,
        static: `
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
    `
    };

    return dockerfiles[framework] || dockerfiles.static;
}

/**
 * Cleanup build directory
 */
async function cleanup(buildPath) {
    try {
        await fs.rm(buildPath, { recursive: true, force: true });
        logger.info(`Cleaned up build directory: ${buildPath}`);
    } catch (error) {
        logger.warn(`Failed to cleanup build directory: ${error.message}`);
    }
}

/**
 * Get current phase from error
 */
function getCurrentPhase(error) {
    return error.phase || 'build';
}

module.exports = {
    executeBuild,
    cloneRepository,
    detectFramework,
    installDependencies,
    buildProject,
    deployToContainer,
    cleanup
};
