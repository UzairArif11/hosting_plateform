const github = require('./github');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const buildQueue = require('./buildQueue');
const logger = require('../utils/logger');

/**
 * Deploy a template for a user or as an admin demo
 * If existingProject is provided, creates a new deployment for that project (redeploy)
 */
async function deployTemplate({ template, user, projectName, environmentVariables, mode, isAdminDemo = false, existingProject = null }) {
    try {
        // ===== SMART TEMPLATE VALIDATION =====
        // 1. Validate mode is supported by template
        if (mode && template.supportedModes) {
            if (!template.supportedModes.includes(mode)) {
                return {
                    success: false,
                    error: `This template does not support ${mode} mode. Supported modes: ${template.supportedModes.join(', ')}`
                };
            }
        }

        // 2. For Pro Mode: Ensure DATABASE_URL is provided
        if (mode === 'pro') {
            const hasDatabaseUrl = (environmentVariables || []).some(
                v => v.key === 'DATABASE_URL' && v.value && v.value.trim()
            );
            if (!hasDatabaseUrl) {
                return {
                    success: false,
                    error: 'Pro Mode requires a DATABASE_URL environment variable. Please provide your external database connection string.'
                };
            }
        }

        // 3. For Lite Mode: Only strip EXTERNAL database URLs (keep local SQLite files)
        if (mode === 'lite' && environmentVariables) {
            environmentVariables = environmentVariables.filter(v => {
                // Keep DATABASE_URL if it's a local SQLite file
                if (v.key === 'DATABASE_URL' && v.value && v.value.startsWith('file:')) {
                    logger.info('Lite Mode: Keeping local SQLite DATABASE_URL');
                    return true; // Keep it
                }
                // Strip external database URLs (postgres, mysql, mongodb)
                if (v.key === 'DATABASE_URL') {
                    logger.info('Lite Mode: Stripped external DATABASE_URL (use local SQLite instead)');
                    return false; // Remove it
                }
                return true; // Keep other variables
            });
        }
        // ===== END SMART TEMPLATE VALIDATION =====

        // Merge template env vars with user-provided ones
        const mergedEnvVars = (template.environmentVariables || []).map(templateVar => {
            const userVar = (environmentVariables || []).find(v => v.key === templateVar.key);
            return {
                key: templateVar.key,
                value: userVar?.value || templateVar.defaultValue || '',
                isSecret: templateVar.isSecret || false,
                environments: ['production']
            };
        });

        let project;

        if (existingProject) {
            // ===== REDEPLOY: Reuse existing project =====
            project = existingProject;

            // Update env vars on the existing project
            project.environmentVariables = mergedEnvVars;
            await project.save();

            logger.info('♻️ Redeploying template to existing project', {
                projectId: project._id,
                userId: user._id,
                templateName: template.name,
                envVarsCount: mergedEnvVars.length
            });
        } else {
            // ===== NEW DEPLOY: Create project =====
            // Generate unique slug
            const slugBase = projectName.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

            // Ensure uniqueness
            let slug = `${user.username || user._id}-${slugBase}`;
            let slugExists = await Project.findOne({ slug });
            let attempts = 0;
            while (slugExists && attempts < 5) {
                slug = `${user.username || user._id}-${slugBase}-${Math.random().toString(36).substring(2, 6)}`;
                slugExists = await Project.findOne({ slug });
                attempts++;
            }

            // IMPORTANT: Use shared template repository (not forked)
            const repoInfo = {
                url: `https://github.com/${template.githubRepo}`,
                fullName: template.githubRepo,
                branch: template.githubBranch || 'main',
                provider: 'github',
                isPrivate: false
            };

            logger.info('✅ Using shared template repository - users customize via env vars and settings', {
                userId: user._id,
                templateRepo: template.githubRepo,
                note: 'Template is shared, users customize dynamically via environment variables'
            });

            // Check for existing project with same name and append suffix if needed
            let finalProjectName = projectName;
            let nameExists = await Project.findOne({ name: finalProjectName, owner: user._id });
            let nameAttempts = 0;

            while (nameExists && nameAttempts < 10) {
                finalProjectName = `${projectName}-${Math.floor(1000 + Math.random() * 9000)}`;
                nameExists = await Project.findOne({ name: finalProjectName, owner: user._id });
                nameAttempts++;
            }

            // Create project
            project = await Project.create({
                name: finalProjectName,
                slug: slug,
                owner: user._id,
                templateId: template._id,
                repository: repoInfo,
                framework: template.framework,
                buildConfig: template.buildConfig || {},
                environmentVariables: mergedEnvVars,
                autoDeployEnabled: true,
                metadata: {
                    deployedFromTemplate: template._id,
                    templateName: template.name,
                    deployedAt: new Date(),
                    sharedTemplate: true
                },
                status: 'active',
                domains: [{
                    domain: `${slug}.${process.env.BASE_DOMAIN || 'foodpanda.site'}`,
                    isCustom: false,
                    isPrimary: true,
                    verified: true
                }],
                settings: {
                    notifications: {
                        email: true
                    }
                }
            });

            logger.info('✅ Project created from shared template', {
                projectId: project._id,
                userId: user._id,
                projectName: projectName,
                templateRepo: template.githubRepo,
                envVarsCount: mergedEnvVars.length
            });
        }

        // Create initial deployment
        const deployment = await Deployment.create({
            projectId: project._id,
            userId: user._id,
            branch: template.githubBranch || 'main',
            commitSha: 'TEMPLATE_INIT', // Placeholder for validation
            commitMessage: isAdminDemo ? 'Admin demo template deployment' : 'Initial template deployment',
            commitAuthor: {
                name: 'System',
                email: 'system@vcp.dev'
            },
            status: 'queued',
            environment: 'production',
            trigger: 'manual', // Use 'manual' to satisfy strict DB validator (enum)
            metadata: {
                templateId: template._id,
                templateName: template.name,
                deploymentMode: mode || null, // Track Smart Template mode
                isTemplateDeployment: true, // Flag for UI/Logic differentiation
                isAdminDemo: isAdminDemo // Flag to track admin demo deployments
            }
        });

        // Add to build queue
        await buildQueue.addDeployment(
            deployment._id.toString(),
            project._id.toString(),
            user._id.toString(),
            { priority: 3 } // Higher priority for template deployments
        );

        logger.info('Template deployed', {
            templateId: template._id,
            templateName: template.name,
            userId: user._id,
            projectId: project._id
        });

        return {
            success: true,
            project,
            deployment
        };

    } catch (error) {
        logger.error('Template deployment failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    deployTemplate
};
