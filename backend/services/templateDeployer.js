const github = require('./github');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const buildQueue = require('./buildQueue');
const logger = require('../utils/logger');

/**
 * Deploy a template for a user
 */
async function deployTemplate({ template, user, projectName, environmentVariables, mode }) {
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

        // 3. For Lite Mode: Strip DATABASE_URL if accidentally provided
        if (mode === 'lite' && environmentVariables) {
            environmentVariables = environmentVariables.filter(v => v.key !== 'DATABASE_URL');
            logger.info('Lite Mode: DATABASE_URL stripped from environment variables');
        }
        // ===== END SMART TEMPLATE VALIDATION =====
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
        // All users deploy from the same template repo
        // Users customize via environment variables and project settings (dynamic customization)
        // This allows template to be updated and all users benefit from updates
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

        // Create project - Shared template repo, dynamic customization via env vars
        // User has FULL CONTROL via:
        // - Environment variables (add/update/delete) - for dynamic data customization
        // - Build config (customize build process)
        // - Project settings (all editable)
        // Template repo is shared - users customize via environment variables (like API keys, database URLs, etc.)
        const project = await Project.create({
            name: projectName,
            slug: slug,
            owner: user._id, // This is the correct field (not userId)
            repository: repoInfo, // Shared template repo
            framework: template.framework,
            buildConfig: template.buildConfig || {}, // User can edit this later
            environmentVariables: mergedEnvVars, // User can add/update/delete these - DYNAMIC CUSTOMIZATION
            autoDeployEnabled: true, // User can toggle this
            metadata: {
                deployedFromTemplate: template._id,
                templateName: template.name,
                deployedAt: new Date(),
                sharedTemplate: true // Template is shared, customization via env vars
            },
            status: 'active',
            domains: [{
                domain: `${slug}.${process.env.BASE_DOMAIN || 'vcp.dev'}`,
                isCustom: false,
                isPrimary: true,
                verified: true
            }],
            // User can edit all these settings via PUT /api/projects/:id
            settings: {
                notifications: {
                    email: true
                }
            }
        });

        logger.info('✅ Project created from shared template - user customizes via env vars', {
            projectId: project._id,
            userId: user._id,
            projectName: projectName,
            templateRepo: template.githubRepo,
            envVarsCount: mergedEnvVars.length,
            note: 'Template is shared, user customizes dynamically via environment variables'
        });

        // Create initial deployment
        const deployment = await Deployment.create({
            projectId: project._id,
            userId: user._id,
            branch: template.githubBranch || 'main',
            status: 'queued',
            environment: 'production',
            trigger: 'template',
            metadata: {
                templateId: template._id,
                templateName: template.name,
                deploymentMode: mode || null // Track Smart Template mode
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
