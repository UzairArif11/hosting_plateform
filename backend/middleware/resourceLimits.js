/**
 * Resource Limits Middleware
 * 
 * Enforces template resource limits:
 * - Max storage per project
 * - Max files per project
 * - Max listings (if not using user's DB)
 */

const Project = require('../models/Project');
const Template = require('../models/Template');
const logger = require('../utils/logger');

/**
 * Check if project exceeds resource limits
 * @param {Object} project - Project document
 * @param {Object} limits - Resource limits from template
 * @returns {Promise<{exceeded: boolean, reason?: string}>}
 */
async function checkResourceLimits(project, limits = {}) {
    // Check storage limit
    if (limits.maxStoragePerProject) {
        const currentStorage = project.currentUsage?.storage || 0;
        const maxStorageMB = limits.maxStoragePerProject;
        
        if (currentStorage > maxStorageMB) {
            return {
                exceeded: true,
                reason: `Storage limit exceeded. Current: ${currentStorage}MB, Max: ${maxStorageMB}MB`
            };
        }
    }

    // Check file count limit
    if (limits.maxFilesPerProject) {
        // This would need to be tracked in project model
        const currentFiles = project.currentUsage?.files || 0;
        const maxFiles = limits.maxFilesPerProject;
        
        if (currentFiles > maxFiles) {
            return {
                exceeded: true,
                reason: `File limit exceeded. Current: ${currentFiles}, Max: ${maxFiles}`
            };
        }
    }

    return { exceeded: false };
}

/**
 * Express middleware to enforce resource limits
 */
function enforceResourceLimits() {
    return async (req, res, next) => {
        try {
            const projectId = req.params.projectId || req.body.projectId;
            if (!projectId) {
                return next();
            }

            const project = await Project.findById(projectId);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Get template if deployed from template
            let template = null;
            if (project.metadata?.deployedFromTemplate) {
                template = await Template.findById(project.metadata.deployedFromTemplate);
            }

            if (!template || !template.resourceLimits) {
                // No limits set, allow
                return next();
            }

            // Check limits
            const limitCheck = await checkResourceLimits(project, template.resourceLimits);
            
            if (limitCheck.exceeded) {
                return res.status(403).json({
                    success: false,
                    error: limitCheck.reason,
                    upgradeRequired: true
                });
            }

            next();
        } catch (error) {
            logger.error('Resource limit check error:', error);
            next(); // Continue on error (don't block)
        }
    };
}

/**
 * Update project resource usage
 * @param {string} projectId - Project ID
 * @param {Object} usage - Usage to add (storage, files, etc.)
 */
async function updateResourceUsage(projectId, usage = {}) {
    try {
        const project = await Project.findById(projectId);
        if (!project) return;

        if (!project.currentUsage) {
            project.currentUsage = { storage: 0, files: 0 };
        }

        if (usage.storage) {
            project.currentUsage.storage = (project.currentUsage.storage || 0) + usage.storage;
        }

        if (usage.files) {
            project.currentUsage.files = (project.currentUsage.files || 0) + usage.files;
        }

        await project.save();
    } catch (error) {
        logger.error('Update resource usage error:', error);
    }
}

module.exports = {
    checkResourceLimits,
    enforceResourceLimits,
    updateResourceUsage
};
