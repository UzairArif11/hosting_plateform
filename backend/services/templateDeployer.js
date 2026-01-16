const github = require('./github');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const buildQueue = require('./buildQueue');
const logger = require('../utils/logger');

/**
 * Deploy a template for a user
 */
async function deployTemplate({ template, user, projectName, environmentVariables }) {
    try {
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

        // Option 1: Fork template repo to user's GitHub (if user has GitHub connected)
        let repoInfo;

        // We prefer forking if possible so user owns the code
        if (user.githubAccessToken) {
            try {
                const forkResult = await github.forkRepository(
                    template.githubRepo,
                    user.githubAccessToken
                );

                if (forkResult.success) {
                    repoInfo = {
                        url: forkResult.data.cloneUrl || forkResult.data.html_url,
                        fullName: forkResult.data.full_name, // Note case difference in GitHub API vs our standard
                        branch: template.githubBranch || 'main',
                        provider: 'github',
                        isPrivate: false
                    };
                }
            } catch (err) {
                logger.warn('Failed to fork repository, falling back to clone', { error: err.message });
            }
        }

        // Option 2: Clone to platform storage (if no GitHub or fork failed)
        // NOTE: For MVP, we still require a valid public repo URL even if we don't fork it.
        // If not forked, improvements needed: create a repo in our own org? 
        // For now, we point to the template repo directly but that means user changes won't be saved to a repo they own.
        // Ideally, we should CREATE a repo for them.
        // Since our system relies on 'push' events for updates, pointing to a read-only template repo isn't ideal for long term.
        // But for "deploy template" initial demo, it works. 
        // Real implementation should probably create a new repo on user's behalf if forking isn't option.

        if (!repoInfo) {
            repoInfo = {
                url: `https://github.com/${template.githubRepo}`,
                fullName: template.githubRepo,
                branch: template.githubBranch || 'main',
                provider: 'github',
                isPrivate: false
            };
        }

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

        // Create project
        const project = await Project.create({
            name: projectName,
            slug: slug,
            owner: user._id,
            repository: repoInfo,
            framework: template.framework,
            buildConfig: template.buildConfig,
            environmentVariables: mergedEnvVars,
            autoDeployEnabled: true,
            metadata: {
                deployedFromTemplate: template._id,
                templateName: template.name,
                deployedAt: new Date()
            },
            status: 'active',
            domains: [{
                domain: `${slug}.${process.env.BASE_DOMAIN || 'vcp.dev'}`,
                isCustom: false,
                isPrimary: true,
                verified: true
            }]
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
                templateName: template.name
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
