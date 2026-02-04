const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const Deployment = require('../models/Deployment');
const Project = require('../models/Project');
const User = require('../models/User');
const Settings = require('../models/Settings');
const docker = require('./docker');
const containerOrchestrator = require('./containerOrchestrator');
const githubService = require('./github');
const websocketService = require('./websocket');
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
        websocketService.emitDeploymentStatus(deploymentId, 'building');
        websocketService.emitDeploymentLog(deploymentId, { message: '🚀 Starting deployment...', level: 'info' });
        websocketService.emitDeploymentProgress(deploymentId, 5);
        await onLog('info', '🚀 Starting deployment...');
        await onProgress(5);

        // Step 1: Clone repository
        websocketService.emitDeploymentLog(deploymentId, { message: '📦 Cloning repository...', level: 'info' });
        await onLog('info', '📦 Cloning repository...');
        buildPath = await cloneRepository(deployment, project, user, onLog);
        websocketService.emitDeploymentLog(deploymentId, { message: '✓ Repository cloned successfully', level: 'success' });
        websocketService.emitDeploymentProgress(deploymentId, 20);
        await onProgress(20);

        // Step 2: Detect framework
        await onLog('info', '🔍 Detecting framework...');
        const framework = await detectFramework(buildPath, deployment, onLog);
        await onProgress(25);

        // CRITICAL FIX: Auto-fix invalid Prisma schema before dependencies install
        const prismaSchemaPath = path.join(buildPath, 'prisma', 'schema.prisma');
        try {
            // Check if prisma schema exists
            await fs.access(prismaSchemaPath);
            
            // File exists, proceed with fix
            await onLog('info', '🔧 Checking Prisma schema for invalid syntax...');
            
            let schemaContent = await fs.readFile(prismaSchemaPath, 'utf8');
            
            // Check for invalid conditional syntax in url field
            if (schemaContent.includes('env("DATABASE_URL") != ""') || 
                schemaContent.includes('env("DATABASE_URL")!=""') ||
                schemaContent.includes('? env("DATABASE_URL") :')) {
                
                await onLog('info', '⚠️  Invalid Prisma syntax detected - auto-fixing...');
                
                // Fix: Replace the invalid conditional with simple env variable
                // This regex matches the exact pattern we saw in the template
                schemaContent = schemaContent.replace(
                    /url\s*=\s*env\("DATABASE_URL"\)\s*!=\s*""\s*\?\s*env\("DATABASE_URL"\)\s*:\s*"[^"]+"/g,
                    'url = env("DATABASE_URL")'
                );
                
                // Write fixed schema back
                await fs.writeFile(prismaSchemaPath, schemaContent, 'utf8');
                await onLog('info', '✅ Prisma schema auto-fixed - conditional syntax removed');
                logger.info(`[${deploymentId}] Auto-fixed invalid Prisma schema syntax`);
            } else {
                await onLog('info', '✅ Prisma schema is valid - no fix needed');
            }
        } catch (prismaFixError) {
            // Schema file doesn't exist or can't be read - not a Prisma project, skip
            if (prismaFixError.code !== 'ENOENT') {
                logger.warn(`Prisma schema check warning: ${prismaFixError.message}`);
            }
        }

        // Step 3: Install dependencies (Local Build)
        websocketService.emitDeploymentLog(deploymentId, { message: '📥 Installing dependencies locally...', level: 'info' });
        await onLog('info', '📥 Installing dependencies locally...');
        await installDependencies(buildPath, framework, deployment, onLog);
        websocketService.emitDeploymentLog(deploymentId, { message: '✓ Dependencies installed', level: 'success' });
        websocketService.emitDeploymentProgress(deploymentId, 45);
        await onProgress(45);

        // Step 4: Build project (Local Build)
        websocketService.emitDeploymentLog(deploymentId, { message: '🔨 Building project locally...', level: 'info' });
        await onLog('info', '🔨 Building project locally...');
        const buildOutput = await buildProject(buildPath, framework, deployment, project, onLog);
        websocketService.emitDeploymentLog(deploymentId, { message: '✓ Build completed successfully', level: 'success' });
        websocketService.emitDeploymentProgress(deploymentId, 70);
        await onProgress(70);

        // Step 5: Deploy to container
        websocketService.emitDeploymentLog(deploymentId, { message: '🚢 Deploying to container...', level: 'info' });
        await onLog('info', '🚢 Deploying to container...');
        await deployment.updateStatus('deploying');
        websocketService.emitDeploymentStatus(deploymentId, 'deploying');
        const deploymentInfo = await deployToContainer(buildPath, buildOutput, deployment, project, user, onLog);
        websocketService.emitDeploymentLog(deploymentId, { message: '✓ Container deployed', level: 'success' });
        websocketService.emitDeploymentProgress(deploymentId, 90);
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
        websocketService.emitDeploymentLog(deploymentId, { message: '✅ Deployment successful!', level: 'success' });
        websocketService.emitDeploymentProgress(deploymentId, 100);
        websocketService.emitDeploymentStatus(deploymentId, 'success', { url: deploymentInfo.url });
        await onProgress(100);

        // Check if this is an admin demo deployment - emit template-specific event
        if (deployment.metadata?.isAdminDemo && deployment.metadata?.templateId) {
            try {
                const Template = require('../models/Template');
                const template = await Template.findById(deployment.metadata.templateId);

                if (template) {
                    // Update template document with deployment info
                    template.demoDeploymentUrl = deploymentInfo.url;
                    template.demoProjectId = project._id;
                    template.demoDeploymentId = deployment._id;
                    template.demoStatus = 'success';
                    template.demoProgress = 100;
                    template.demoError = null;
                    await template.save();

                    // Emit template-demo-status event for admin UI
                    const io = websocketService.getIO();
                    if (io) {
                        const payload = {
                            templateId: template._id.toString(),
                            status: 'success',
                            progress: 100,
                            demoUrl: deploymentInfo.url,
                            message: 'Deployment successful!'
                        };
                        logger.info(`📡 Emitting template-demo-status (success) for ${template._id}: ${deploymentInfo.url}`);
                        io.emit('template-demo-status', payload);
                    }
                    
                    logger.info(`Admin ${deployment.userId} deployed demo for template ${template.name} at ${deploymentInfo.url}`);
                }
            } catch (err) {
                logger.error('Failed to update template after successful deployment:', err);
            }
        }

        // Cleanup local build directory
        await cleanup(buildPath);

        // Cleanup remote build directory and Docker cache if it exists
        if (deploymentInfo.remotePath && deploymentInfo.serverKey) {
            try {
                const { NodeSSH } = require('node-ssh');
                const ssh = new NodeSSH();

                const remoteBuild = require('./remoteBuild');
                const serverHost = deploymentInfo.host || (deploymentInfo.serverKey === 'EC2' ? '129.154.255.90' : '152.67.11.146');
                const sshConfig = remoteBuild.getSSHConfig(deploymentInfo.serverKey, serverHost);

                if (sshConfig) {
                    await ssh.connect(sshConfig);

                    // Cleanup files
                    await ssh.execCommand(`rm -rf ${deploymentInfo.remotePath}`);
                    await onLog('info', `🧹 Cleaned up remote build directory`);

                    // NEW: Prune dangling images to keep storage low (as requested)
                    await ssh.execCommand('docker image prune -f');
                    await ssh.execCommand('docker builder prune -af'); // Clear build cache too
                    await onLog('info', `🧹 Pruned dangling Docker images and build cache on ${deploymentInfo.serverKey}`);

                    ssh.dispose();
                }
            } catch (cleanupError) {
                logger.warn(`Remote cleanup failed: ${cleanupError.message}`);
                await onLog('warn', `Remote cleanup warning: ${cleanupError.message}`);
            }
        }

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

        // Emit failure via Socket.IO
        websocketService.emitDeploymentLog(deploymentId, {
            message: `❌ Deployment failed: ${error.message}`,
            level: 'error'
        });
        websocketService.emitDeploymentStatus(deploymentId, 'failed', {
            error: error.message,
            phase: getCurrentPhase(error)
        });

        // CRITICAL FIX: Always try to update template status on failure
        // Look up template by checking if this project was deployed from a template
        try {
            const Template = require('../models/Template');
            const Project = require('../models/Project');
            
            if (deployment && deployment.projectId) {
                const project = await Project.findById(deployment.projectId);
                
                // Check if this is a demo deployment by finding template with matching demoDeploymentId
                const template = await Template.findOne({ demoDeploymentId: deploymentId });
                
                if (template) {
                    logger.error(`🔧 FOUND template via demoDeploymentId lookup: ${template.displayName}`);
                    
                    // Update template status
                    template.demoStatus = 'failed';
                    template.demoError = error.message || 'Deployment failed';
                    template.demoProgress = 0;
                    await template.save();
                    
                    // Emit socket event
                    const io = websocketService.getIO();
                    if (io) {
                        const payload = {
                            templateId: template._id.toString(),
                            status: 'failed',
                            progress: 0,
                            error: error.message || 'Deployment failed',
                            message: 'Deployment failed'
                        };
                        logger.error(`📡 FORCE EMITTING template-demo-status (failed) for ${template._id}`);
                        io.emit('template-demo-status', payload);
                        io.sockets.emit('template-demo-status', payload);
                    }
                    
                    logger.error(`✅ Template status updated via direct lookup`);
                } else {
                    logger.warn(`No template found with demoDeploymentId: ${deploymentId}`);
                }
            }
        } catch (templateLookupError) {
            logger.error('Failed to lookup template for failed deployment:', templateLookupError);
        }

        // Check if this is an admin demo deployment - emit template-specific failure event
        // CRITICAL: Check metadata properly
        const isAdminDemo = deployment?.metadata?.isAdminDemo === true || deployment?.metadata?.isAdminDemo === 'true';
        const templateId = deployment?.metadata?.templateId;

        logger.error('Checking template metadata for failure event:', {
            deploymentId: deployment?._id,
            hasDeployment: !!deployment,
            hasMetadata: !!deployment?.metadata,
            metadataKeys: deployment?.metadata ? Object.keys(deployment.metadata) : [],
            isAdminDemo: isAdminDemo,
            templateId: templateId,
            rawMetadata: deployment?.metadata
        });

        if (deployment && isAdminDemo && templateId) {
            try {
                const Template = require('../models/Template');
                const template = await Template.findById(templateId);

                if (template) {
                    // Update template document with error
                    template.demoStatus = 'failed';
                    template.demoError = error.message || 'Deployment failed';
                    template.demoProgress = 0;
                    await template.save();

                    // Emit template-demo-status event for admin UI (CRITICAL - ALWAYS EMIT)
                    const io = websocketService.getIO();
                    if (io) {
                        const payload = {
                            templateId: template._id.toString(),
                            status: 'failed',
                            progress: 0,
                            error: error.message || 'Deployment failed',
                            message: 'Deployment failed'
                        };
                        logger.error(`📡 EMITTING template-demo-status (failed) for ${template._id}: ${error.message}`);
                        io.emit('template-demo-status', payload);
                        
                        // Also emit to specific room if exists
                        io.to(`template-${template._id}`).emit('template-demo-status', payload);
                        
                        // Emit globally to ensure frontend receives it
                        io.sockets.emit('template-demo-status', payload);
                    } else {
                        logger.error(`❌ Socket.IO not available to emit template-demo-status`);
                    }
                    
                    logger.error(`❌ Admin demo deployment failed for template: ${template.name}`, {
                        templateId: template._id,
                        error: error.message
                    });
                } else {
                    logger.error(`❌ Template not found for failed deployment: ${templateId}`);
                }
            } catch (err) {
                logger.error('Failed to update template after deployment failure:', err);
            }
        } else {
            logger.warn('Deployment failed but no template metadata found - checking database directly', {
                deploymentId: deployment?._id,
                hasMetadata: !!deployment?.metadata,
                isAdminDemo: isAdminDemo,
                templateId: templateId
            });

            // FALLBACK: Try to find template by checking recent deployments
            if (deployment) {
                try {
                    const Project = require('../models/Project');
                    const project = await Project.findById(deployment.projectId);
                    
                    if (project?.metadata?.deployedFromTemplate) {
                        const Template = require('../models/Template');
                        const template = await Template.findById(project.metadata.deployedFromTemplate);
                        
                        if (template && template.demoDeploymentId?.toString() === deployment._id.toString()) {
                            logger.info(`📡 Found template via project metadata - updating status`);
                            
                            template.demoStatus = 'failed';
                            template.demoError = error.message || 'Deployment failed';
                            template.demoProgress = 0;
                            await template.save();

                            const io = websocketService.getIO();
                            if (io) {
                                const payload = {
                                    templateId: template._id.toString(),
                                    status: 'failed',
                                    progress: 0,
                                    error: error.message || 'Deployment failed',
                                    message: 'Deployment failed'
                                };
                                logger.error(`📡 EMITTING template-demo-status via fallback for ${template._id}`);
                                io.emit('template-demo-status', payload);
                                io.sockets.emit('template-demo-status', payload);
                            }
                        }
                    }
                } catch (fallbackErr) {
                    logger.error('Fallback template lookup failed:', fallbackErr);
                }
            }
        }

        // Cleanup on error
        if (buildPath) {
            await cleanup(buildPath);
        }

        // Feature: Also prune build cache on remote server if it failed to free ROM
        try {
            const Project = require('../models/Project');
            const project = await Project.findById(deployment?.projectId);
            const User = require('../models/User');
            const user = await User.findById(deployment?.userId);

            if (user?.assignedServer) {
                const remoteBuild = require('./remoteBuild');
                const serverHost = process.env[`${user.assignedServer}_SERVER_IP`] || '129.154.255.90';
                const sshConfig = remoteBuild.getSSHConfig(user.assignedServer, serverHost);
                if (sshConfig) {
                    const { NodeSSH } = require('node-ssh');
                    const ssh = new NodeSSH();
                    await ssh.connect(sshConfig);
                    await ssh.execCommand('docker image prune -f && docker builder prune -af');
                    ssh.dispose();
                }
            }
        } catch (e) { /* ignore cleanup error */ }

        throw error;
    }
}

/**
 * Clone repository from GitHub
 */
async function cloneRepository(deployment, project, user, onLog) {
    // Use deployment ID as buildId (no timestamp) so retries clean up and reuse the same directory
    const buildId = deployment._id.toString();
    const buildPath = path.join(BUILD_DIR, buildId);

    try {
        // Clean up existing directory if it exists
        try {
            const exists = await fs.access(buildPath).then(() => true).catch(() => false);
            if (exists) {
                await onLog('info', `Cleaning up existing build directory...`);
                await fs.rm(buildPath, { recursive: true, force: true });
                await onLog('info', `✓ Old directory removed`);
            }
        } catch (cleanupError) {
            await onLog('warn', `Cleanup warning: ${cleanupError.message}`);
        }

        // Ensure parent directory exists
        await fs.mkdir(BUILD_DIR, { recursive: true });

        // Get repository URL with token
        // For template deployments, use platform token FIRST (user's token may not have access to template repos)
        const isTemplateDeployment = deployment.metadata?.isTemplateDeployment;
        const githubToken = isTemplateDeployment
            ? (process.env.GITHUB_API_TOKEN || user.githubAccessToken)
            : (user.githubAccessToken || process.env.GITHUB_API_TOKEN);

        if (!githubToken) {
            throw new Error('No GitHub token available for repository access. Add GITHUB_API_TOKEN to .env');
        }

        const repoUrl = project.repository.url;
        const repoWithAuth = repoUrl.replace(
            'https://github.com/',
            `https://${githubToken}@github.com/`
        );

        await onLog('info', `Cloning ${project.repository.fullName}...`);

        // Clone repository
        // Clone repository with retries
        let retries = 3;
        let lastError = null;

        while (retries > 0) {
            try {
                const cloneCommand = `git clone --depth 1 --branch ${deployment.branch} ${repoWithAuth} ${buildPath}`;
                const { stdout, stderr } = await execAsync(cloneCommand, {
                    timeout: 5 * 60 * 1000 // 5 minutes timeout
                });

                if (stderr && !stderr.includes('Cloning into')) {
                    await onLog('warn', stderr);
                }

                // If successful, break format loop
                lastError = null;
                break;
            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    await onLog('warn', `Git clone failed: ${error.message}. Retrying... (${retries} attempts left)`);
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s before retry

                    // Clean up partial clone if exists
                    try {
                        await fs.rm(buildPath, { recursive: true, force: true });
                    } catch (cleanupErr) {
                        await onLog('warn', `Cleanup failed: ${cleanupErr.message}`);
                    }
                }
            }
        }

        if (lastError) {
            throw lastError;
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

        // Check if node_modules already exists (from previous build)
        const nodeModulesPath = path.join(buildPath, 'node_modules');
        let nodeModulesExists = false;

        try {
            await fs.access(nodeModulesPath);
            nodeModulesExists = true;

            // Check if package.json changed
            const packageJsonPath = path.join(buildPath, 'package.json');
            const packageJson = await fs.readFile(packageJsonPath, 'utf8');
            const packageHash = require('crypto').createHash('md5').update(packageJson).digest('hex');

            const hashFile = path.join(buildPath, '.package-hash');
            let previousHash = '';
            try {
                previousHash = await fs.readFile(hashFile, 'utf8');
            } catch { }

            if (packageHash === previousHash) {
                await onLog('info', '⚡ Using existing node_modules (package.json unchanged)');
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                await onLog('success', `✓ Dependencies ready in ${duration}s (cached)`);

                deployment.installTime = Date.now() - startTime;
                deployment.metadata = {
                    ...deployment.metadata,
                    dependenciesCached: true
                };
                await deployment.save();
                return;
            } else {
                await onLog('info', '📦 Package.json changed, reinstalling dependencies...');
            }
        } catch {
            nodeModulesExists = false;
        }

        // Install command
        let installCmd = packageManager === 'yarn' ? 'yarn install --frozen-lockfile' :
            packageManager === 'pnpm' ? 'pnpm install --frozen-lockfile' :
                'npm ci';

        deployment.installCommand = installCmd;
        await deployment.save();

        // Execute install with fallback
        let stdout, stderr;
        try {
            const result = await execAsync(installCmd, {
                cwd: buildPath,
                timeout: 10 * 60 * 1000, // 10 minutes
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });
            stdout = result.stdout;
            stderr = result.stderr;
        } catch (error) {
            // Check for pnpm not found
            if (packageManager === 'pnpm' && (error.message.includes('not found') || error.message.includes('pnpm: command not found'))) {
                await onLog('warn', 'pnpm not found, falling back to npm install --legacy-peer-deps...');
                // Fallback to npm with legacy peer deps for robustness
                installCmd = 'npm install --legacy-peer-deps';
                const result = await execAsync(installCmd, {
                    cwd: buildPath,
                    timeout: 10 * 60 * 1000,
                    maxBuffer: 10 * 1024 * 1024
                });
                stdout = result.stdout;
                stderr = result.stderr;
            } else
                // If npm ci fails (no package-lock.json), fallback to npm install
                if (packageManager === 'npm' && (error.message.includes('package-lock.json') || error.message.includes('ERESOLVE'))) {
                    await onLog('warn', 'npm ci failed/conflict, falling back to npm install --legacy-peer-deps...');
                    installCmd = 'npm install --legacy-peer-deps --include=dev';
                    const result = await execAsync(installCmd, {
                        cwd: buildPath,
                        timeout: 10 * 60 * 1000,
                        maxBuffer: 10 * 1024 * 1024
                    });
                    stdout = result.stdout;
                    stderr = result.stderr;
                } else {
                    throw error;
                }
        }

        if (stdout) await onLog('info', stdout.substring(0, 500));
        if (stderr) await onLog('warn', stderr.substring(0, 500));

        const installTime = Date.now() - startTime;
        await onLog('info', `✓ Dependencies installed in ${(installTime / 1000).toFixed(2)}s`);

        // Check if Prisma is used and generate client locally (before Docker build)
        // This avoids issues with symlinks in node_modules/.bin inside Docker containers
        let hasPrismaGenerated = false;
        try {
            await fs.access(path.join(buildPath, 'prisma', 'schema.prisma'));
            await onLog('info', '✓ Detected Prisma - generating client locally...');

            // Read package.json to get exact Prisma version
            const packageJsonPath = path.join(buildPath, 'package.json');
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);

            // Get Prisma version from devDependencies or dependencies
            const prismaVersion = packageJson.devDependencies?.prisma || packageJson.dependencies?.prisma || 'latest';
            const versionClean = prismaVersion.replace(/[\^~]/, ''); // Remove ^ or ~

            await onLog('info', `Using Prisma version: ${versionClean}`);

            // Write DATABASE_URL to .env for Prisma generation
            const envPath = path.join(buildPath, '.env');
            let envContent = '';
            try {
                envContent = await fs.readFile(envPath, 'utf8');
            } catch { }
            if (!envContent.includes('DATABASE_URL')) {
                await fs.writeFile(envPath, `${envContent}\nDATABASE_URL=file:./dev.db\n`);
            }

            // Detect architecture and configure binaryTargets for Docker
            const arch = process.arch;
            const isARM = arch === 'arm64' || arch === 'aarch64';
            const binaryTarget = isARM ? 'linux-arm64-openssl-3.0.x' : 'linux-amd64-openssl-3.0.x';

            // Read and modify schema.prisma to add binaryTargets
            const schemaPath = path.join(buildPath, 'prisma', 'schema.prisma');
            let schemaContent = await fs.readFile(schemaPath, 'utf8');
            if (!schemaContent.includes('binaryTargets')) {
                schemaContent = schemaContent.replace(
                    /(generator\s+client\s*{[^}]*provider\s*=\s*["']prisma-client-js["'])/,
                    `$1\n  binaryTargets = ["native", "${binaryTarget}"]`
                );
                await fs.writeFile(schemaPath, schemaContent);
                await onLog('info', `Added binaryTargets: ["native", "${binaryTarget}"]`);
            }

            // Use local prisma binary if devDeps installed, otherwise npx
            const prismaBin = path.join(buildPath, 'node_modules', '.bin', 'prisma');
            let prismaCmd;
            try {
                await fs.access(prismaBin);
                prismaCmd = `"${prismaBin}" generate`;
            } catch {
                prismaCmd = `npx -y prisma@${versionClean} generate --schema="${schemaPath}"`;
            }

            const { stdout: prismaOut, stderr: prismaErr } = await execAsync(prismaCmd, {
                cwd: buildPath,
                timeout: 3 * 60 * 1000,
                maxBuffer: 5 * 1024 * 1024
            });

            if (prismaOut) await onLog('info', prismaOut.substring(0, 300));
            await onLog('info', '✓ Prisma client generated successfully');
            hasPrismaGenerated = true;

            // Modify package.json build script to skip prisma generate (already done locally)
            if (packageJson.scripts && packageJson.scripts.build) {
                const originalBuild = packageJson.scripts.build;
                // Remove "prisma generate &&" from build command
                packageJson.scripts.build = originalBuild
                    .replace(/prisma\s+generate\s*&&\s*/gi, '')
                    .replace(/&&\s*prisma\s+generate/gi, '')
                    .replace(/^\s*prisma\s+generate\s*$/gi, 'echo "Prisma already generated"');

                if (originalBuild !== packageJson.scripts.build) {
                    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
                    await onLog('info', `Modified build script: "${originalBuild}" → "${packageJson.scripts.build}"`);
                }
            }
        } catch (err) {
            // No Prisma or generation failed (non-fatal, continue with build)
            if (err.code !== 'ENOENT') {
                await onLog('warn', `Prisma generation warning: ${err.message.substring(0, 200)}`);
            }
        }

        // Save package.json hash for next build
        const packageJsonPath = path.join(buildPath, 'package.json');
        const packageJson = await fs.readFile(packageJsonPath, 'utf8');
        const packageHash = require('crypto').createHash('md5').update(packageJson).digest('hex');
        const hashFile = path.join(buildPath, '.package-hash');
        await fs.writeFile(hashFile, packageHash);

        deployment.installTime = installTime;
        deployment.metadata = {
            ...deployment.metadata,
            dependenciesCached: false
        };
        await deployment.save();

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

        // Fix: Ensure build commands use npx or npm run to avoid "command not found" errors
        // If command doesn't start with npm/npx/yarn/pnpm, wrap it with npx
        if (!buildCommand.match(/^(npm|npx|yarn|pnpm|echo)/)) {
            buildCommand = `npx ${buildCommand}`;
            await onLog('info', `Wrapped build command with npx: ${buildCommand}`);
        }

        deployment.buildCommand = buildCommand;
        deployment.outputDirectory = outputDir;
        await deployment.save();

        await onLog('info', `Build command: ${buildCommand}`);

        // For Next.js deployments that are served from a sub-path (e.g. /project-xxxx),
        // we need a deterministic URL path so we can:
        // 1) Configure Next.js basePath/assetPrefix during build
        // 2) Configure Nginx routing to the same sub-path after deployment
        let deploymentUrlPath = null;
        if (framework === 'nextjs') {
            const shortName = project.name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .substring(0, 12);

            const shortId = deployment._id.toString().substring(0, 8);

            // IMPORTANT: This MUST stay in sync with nginxRouter.js
            // (see updateNginxRouting URL path generation).
            deploymentUrlPath = `${shortName}-${shortId}`;

            deployment.metadata = {
                ...deployment.metadata,
                urlPath: deploymentUrlPath
            };
            await deployment.save();

            await onLog('info', `Using deployment URL path for Next.js basePath: /${deploymentUrlPath}`);
        }

        // Write environment variables
        if (project.environmentVariables && project.environmentVariables.length > 0) {
            const envContent = project.environmentVariables
                .map(env => `${env.key}=${env.value}`)
                .join('\n');
            await fs.writeFile(path.join(buildPath, '.env'), envContent);
            await onLog('info', `✓ Environment variables written (${project.environmentVariables.length} vars)`);
        }

        // Determine Node.js version for Docker build
        const nodeVersion = project.buildConfig?.nodeVersion || template?.buildConfig?.nodeVersion || '20';
        await onLog('info', `Using Node.js version: ${nodeVersion} (in Docker)`);

        // Use slim instead of alpine for better compatibility (Next.js SWC on ARM64, OpenSSL)
        const dockerImage = `node:${nodeVersion}-slim`;

        // Detect package manager from lock files
        let dockerPackageManager = 'npm';
        let dockerInstallCmd = 'npm install --legacy-peer-deps';

        try {
            if (await fs.access(path.join(buildPath, 'pnpm-lock.yaml')).then(() => true).catch(() => false)) {
                dockerPackageManager = 'pnpm';
                dockerInstallCmd = 'corepack enable && pnpm install --frozen-lockfile';
                await onLog('info', 'Detected pnpm-lock.yaml, will use pnpm in Docker');
            } else if (await fs.access(path.join(buildPath, 'yarn.lock')).then(() => true).catch(() => false)) {
                dockerPackageManager = 'yarn';
                dockerInstallCmd = 'corepack enable && yarn install --frozen-lockfile';
                await onLog('info', 'Detected yarn.lock, will use yarn in Docker');
            }
        } catch (err) {
            // Ignore errors, default to npm
        }

        // Execute build inside Docker container with specific Node.js version
        if (framework !== 'static' && framework !== 'nodejs') {
            await onLog('info', `Building inside Docker container with Node.js ${nodeVersion} and ${dockerPackageManager}...`);

            // Ensure build command uses the correct package manager
            let dockerBuildCmd = buildCommand;

            // If using pnpm but build command starts with npm/npx, replace it
            if (dockerPackageManager === 'pnpm' && dockerBuildCmd.startsWith('npx ')) {
                dockerBuildCmd = dockerBuildCmd.replace(/^npx /, 'pnpm exec ');
                await onLog('info', `Converted build command for pnpm: ${dockerBuildCmd}`);
            } else if (dockerPackageManager === 'pnpm' && dockerBuildCmd.startsWith('npm run ')) {
                dockerBuildCmd = dockerBuildCmd.replace(/^npm run /, 'pnpm ');
                await onLog('info', `Converted build command for pnpm: ${dockerBuildCmd}`);
            }

            // Check if Prisma is used (schema.prisma exists)
            let hasPrisma = false;
            try {
                await fs.access(path.join(buildPath, 'prisma', 'schema.prisma'));
                hasPrisma = true;
                await onLog('info', '✓ Prisma detected - client already generated locally');
            } catch (err) {
                // No Prisma schema found
            }

            // Build command sequence
            // Note: Prisma client already generated locally during install phase
            // Docker build just runs the build command with pre-generated Prisma client
            const buildSequence = dockerBuildCmd;

            // Build command to run inside Docker with corepack for pnpm/yarn
            // NOTE: For Next.js we also pass a per-deployment basePath so that
            // static assets (/_next/...) are generated under the correct sub-path.
            const basePathEnvArgs = (framework === 'nextjs' && deploymentUrlPath)
                ? `-e NEXT_PUBLIC_BASE_PATH=/${deploymentUrlPath} -e __NEXT_ROUTER_BASEPATH=/${deploymentUrlPath}`
                : '';

            const dockerBuildCommand = `docker run --rm \
                -v "${buildPath}:/app" \
                -w /app \
                -e NODE_ENV=production \
                -e CI=false \
                -e PUBLIC_URL=. \
                ${basePathEnvArgs} \
                ${dockerImage} \
                sh -c "${buildSequence}"`;

            try {
                const { stdout, stderr } = await execAsync(dockerBuildCommand, {
                    timeout: MAX_BUILD_TIME,
                    maxBuffer: 20 * 1024 * 1024, // 20MB
                    shell: '/bin/bash'
                });

                if (stdout) {
                    const logs = stdout.split('\n').slice(-20).join('\n'); // Last 20 lines
                    await onLog('info', logs);
                }
                if (stderr && !stderr.includes('warning')) {
                    await onLog('warn', stderr.substring(0, 500));
                }
            } catch (error) {
                await onLog('error', `Docker build failed: ${error.message}`);
                throw error;
            }
        }

        const buildTime = Date.now() - startTime;
        deployment.buildDuration = buildTime;
        await deployment.save();

        await onLog('info', `✓ Build completed in ${(buildTime / 1000).toFixed(2)}s`);

        // Generate server.js for static sites (React, Vue, etc.) - NOT for Next.js
        if (['react', 'vue', 'angular', 'static', 'vite', 'cra'].includes(framework)) {
            await onLog('info', 'Generating zero-dependency server.js for static serving...');

            const serverScript = `
const http = require('http');
const fs = require('fs');
const path = require('path');

// Get port from args
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 ? parseInt(args[portIdx + 1]) : (process.env.PORT || 3000);
// server.js is now in root, serving outputDir
const buildDir = path.join(__dirname, '${outputDir}');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

http.createServer(function (request, response) {
    let filePath = request.url === '/' ? '/index.html' : request.url;
    // Remove query params
    filePath = filePath.split('?')[0];
    
    let absPath = path.join(buildDir, filePath);
    
    // Security check logic omitted for simplicity in this context, but path.join handles .. traversal mostly normalized
    
    let extname = String(path.extname(absPath)).toLowerCase();
    
    // Attempt to read file
    fs.readFile(absPath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT') {
                // SPA Fallback: Serve index.html
                fs.readFile(path.join(buildDir, 'index.html'), function(error, content) {
                    if (error) {
                        response.writeHead(500);
                        response.end('Error loading index.html: ' + error.code);
                    }
                    else {
                        response.writeHead(200, { 'Content-Type': 'text/html' });
                        response.end(content, 'utf-8');
                    }
                });
            }
            else {
                response.writeHead(500);
                response.end('Server Error: '+error.code);
            }
        }
        else {
            const contentType = mimeTypes[extname] || 'application/octet-stream';
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });

}).listen(port);
console.log('Server running at http://localhost:' + port);
`;
            // Write server.js to the ROOT directory for remote build compatibility
            // This ensures it gets copied to the container and can find the future outputDir
            // const actualOutputDir = path.join(buildPath, outputDir);

            // Ensure output dir exists (it should after build)
            try {
                // await fs.access(actualOutputDir);
                await fs.writeFile(path.join(buildPath, 'server.js'), serverScript);
                await onLog('info', `✓ server.js generated in root serving ./${outputDir}`);
            } catch (err) {
                await onLog('warn', `Error generating server.js: ${err.message}`);
            }
        }

        // Generate Next.js starter script that uses next start
        if (framework === 'nextjs') {
            await onLog('info', 'Generating Next.js starter script...');

            const nextServerScript = `
const { spawn } = require('child_process');

// Get port from args
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 ? args[portIdx + 1] : (process.env.PORT || '3000');

console.log('Starting Next.js on port', port);

// Start Next.js production server
const child = spawn('npx', ['next', 'start', '-p', port], {
    stdio: 'inherit',
    env: { ...process.env, PORT: port }
});

child.on('error', (error) => {
    console.error('Failed to start Next.js:', error);
    process.exit(1);
});

child.on('exit', (code) => {
    console.log('Next.js exited with code', code);
    process.exit(code || 0);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
`;

            await fs.writeFile(path.join(buildPath, 'server.js'), nextServerScript);
            await onLog('info', '✓ Next.js starter script generated (uses next start)');
        }

        // Get build size
        const buildOutputPath = path.join(buildPath, outputDir);
        // Calculate build size (cross-platform)
        let buildSize = 0; // Initialize buildSize
        try {
            // Calculate build size - ONLY measure the output directory, not entire buildPath
            const getDirectorySize = async (dirPath) => {
                let size = 0;
                const files = await fs.readdir(dirPath);
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const stats = await fs.stat(filePath);
                    if (stats.isDirectory()) {
                        size += await getDirectorySize(filePath);
                    } else {
                        size += stats.size;
                    }
                }
                return size;
            };

            // Measure ONLY the output directory (e.g., build/) not the entire repo
            // Ensure output directory exists before trying to measure it
            await fs.access(buildOutputPath);
            buildSize = await getDirectorySize(buildOutputPath);
        } catch (sizeError) {
            await onLog('warn', `Failed to calculate build size: ${sizeError.message}`);
        }

        deployment.metadata = {
            ...deployment.metadata,
            buildSize,
            buildCache: false
        };
        await deployment.save();

        await onLog('info', `✓ Build size: ${(buildSize / 1024 / 1024).toFixed(2)} MB (${outputDir}/ folder only)`);

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
        await onLog('info', `Checking for existing container for user ${user._id}...`);
        let containerInfo = await containerOrchestrator.getUserContainer(user._id);

        if (!containerInfo) {
            // Allocate new container
            await onLog('info', 'No existing container found. Allocating new container...');
            await onLog('info', `User plan: ${user.currentPlan || 'undefined'}`);
            await onLog('info', `User email: ${user.email}`);

            try {
                containerInfo = await containerOrchestrator.allocateContainer(user, user.currentPlan || 'free');

                if (!containerInfo) {
                    throw new Error('allocateContainer returned null/undefined');
                }

                await onLog('info', `✓ Container allocated successfully`);
                await onLog('info', `Container details: ${JSON.stringify({
                    name: containerInfo.containerName,
                    port: containerInfo.port,
                    server: containerInfo.serverKey
                })}`);
            } catch (allocError) {
                await onLog('error', `Container allocation failed: ${allocError.message}`);
                await onLog('error', `Stack: ${allocError.stack}`);
                throw new Error(`Failed to allocate container: ${allocError.message}`);
            }
        } else {
            await onLog('info', `✓ Using existing container: ${containerInfo.containerName}`);
        }

        if (!containerInfo || !containerInfo.containerName) {
            throw new Error('Container info is invalid - missing containerName');
        }

        const { containerName, serverKey, host } = containerInfo;
        let { port } = containerInfo; // Use let for port since it may be reassigned for shared containers


        if (!host) {
            throw new Error(`Container info missing host. ServerKey: ${serverKey}, Available servers: ${Object.keys(containerOrchestrator.ORACLE_SERVERS).join(', ')}`);
        }

        await onLog('info', `Deploying to container: ${containerName} on ${host}:${port}`);

        // ALL USERS: Use PM2 container (node-pm2-alpine:latest) - no Docker image building needed
        // All deployments run as PM2 processes inside the user's existing container
        await onLog('info', '📦 Using PM2 container - uploading files only (no Docker image build)...');

        // Verify server.js exists before upload (required for PM2)
        const serverJsPath = path.join(buildPath, 'server.js');
        try {
            await fs.access(serverJsPath);
            await onLog('info', '✅ Verified server.js exists before upload');
        } catch (err) {
            await onLog('error', `❌ server.js NOT FOUND at ${serverJsPath} before upload!`);
            throw new Error(`server.js not found before upload: ${err.message}`);
        }

        const remoteBuild = require('./remoteBuild');

        // Optimization: For frontend sites (React/Vue/Angular), we ONLY need the production build folder and 'server.js'
        // Exclude source code and .git to make transfer lighting fast
        // IMPORTANT: For Next.js/Node apps, we NEED production dependencies at runtime
        // For static compiled apps (React/Vue/Angular), we can exclude everything except build folder
        const isNodeApp = ['nextjs', 'nodejs', 'nuxtjs'].includes(deployment.framework);
        const isStaticCompiled = ['react', 'vue', 'angular', 'vite', 'cra'].includes(deployment.framework);

        let options;
        if (isStaticCompiled) {
            // Static apps: exclude everything except build folder and server.js
            options = { exclude: ['node_modules', 'src', 'public', '.git', '.github'], include: ['server.js'] };
        } else {
            // Node apps (Next.js): exclude source but keep dependencies for production
            options = { exclude: ['src', '.git', '.github'], include: ['server.js', 'node_modules'] };
        }

        await remoteBuild.uploadToRemoteServer(
            buildPath,
            deployment._id.toString(),
            host,
            serverKey,
            onLog,
            options
        );


        let containerResult;
        let newContainerId;
        let newContainerName;

        // ALL USERS: Deploy project to user's container
        await onLog('info', `Deploying project to user container: ${containerName}`);

        const freeTierContainer = require('./freeTierContainer');

        // Construct REMOTE path where files were uploaded
        // We uploaded the root buildPath to /tmp/builds/${deployment.id}
        // For remote builds, we need the SOURCE directory, not the output directory (which will be created in container)
        // Ensure forward slashes for Linux
        const remoteBuildPath = `/tmp/builds/${deployment.id}`.replace(/\\/g, '/');

        containerResult = await freeTierContainer.deployProjectToUserContainer(
            user,
            project,
            remoteBuildPath,      // Pass REMOTE path
            containerInfo
        );

        newContainerId = containerResult.containerId;
        newContainerName = containerResult.containerName;
        port = containerResult.port;

        await onLog('info', `✅ Project deployed to user container on port ${port}`);

        // Update Nginx routing for URL path access
        await onLog('info', 'Configuring domain routing...');
        const nginxRouter = require('./nginxRouter');
        const routingResult = await nginxRouter.updateNginxRouting(
            project.name,
            port,
            host,
            serverKey,
            deployment._id.toString()  // Pass deployment ID for unique URL
        );


        // Note: Container cleanup not needed for PM2 deployments
        // Projects run as PM2 processes in the user's container
        // Old PM2 processes are automatically stopped/deleted before starting new ones


        // Generate deployment URL
        const domain = await Settings.getDomainForServer(serverKey);
        const protocol = (await Settings.getSettings()).protocol || 'https';

        const deploymentUrl = routingResult.success
            ? routingResult.url
            : `${protocol}://${domain}/${project.name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${deployment._id.toString().substring(0, 8)}/`;

        const deployTime = Date.now() - startTime;
        deployment.deployDuration = deployTime;
        deployment.deploymentUrl = deploymentUrl; // Ensure it's saved to the model
        deployment.serverKey = serverKey; // Save serverKey for cleanup
        deployment.port = port; // Save port for reference
        deployment.containerName = newContainerName; // Save container name
        await deployment.save();

        await onLog('info', `✓ Container deployed in ${(deployTime / 1000).toFixed(2)}s`);
        await onLog('success', `🌐 Deployment URL: ${deploymentUrl}`);

        return {
            url: deploymentUrl,
            containerId: containerName,
            containerName,
            port,
            serverKey,
            remotePath: `/tmp/builds/${deployment.id}`  // For cleanup after deployment
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
FROM node:18-slim
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
FROM node:18-slim
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
 * Cleanup old build directories (keep recent ones for fast rebuilds)
 */
async function cleanup(buildPath) {
    try {
        // Check if build directory exists
        try {
            await fs.access(buildPath);
        } catch {
            // Build directory doesn't exist, nothing to cleanup
            return;
        }

        // Check age of build directory
        const stats = await fs.stat(buildPath);
        const ageMs = Date.now() - stats.mtimeMs;
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (ageMs > maxAge) {
            // Old build, remove it
            await fs.rm(buildPath, { recursive: true, force: true });
            logger.info(`Cleaned up old build directory (${Math.floor(ageMs / (24 * 60 * 60 * 1000))} days old): ${buildPath}`);
        } else {
            // Recent build, keep it for faster rebuilds
            logger.info(`Keeping build directory for reuse (node_modules cached): ${buildPath}`);
        }
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
