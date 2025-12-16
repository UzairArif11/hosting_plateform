/**
 * Utility functions for Docker and container name sanitization
 */

/**
 * Sanitize a string to be used as a Docker container name
 * Docker container names must match: [a-zA-Z0-9][a-zA-Z0-9_.-]*
 * 
 * @param {string} name - The name to sanitize
 * @returns {string} - Sanitized name safe for Docker
 */
function sanitizeContainerName(name) {
    if (!name) return 'unnamed';

    return name
        .replace(/[^a-zA-Z0-9-_.]/g, '-')  // Replace invalid chars with dash
        .replace(/^[^a-zA-Z0-9]+/, '')      // Remove leading invalid chars
        .replace(/--+/g, '-')                // Replace multiple dashes with single
        .replace(/^-+|-+$/g, '')             // Remove leading/trailing dashes
        .toLowerCase()
        .substring(0, 100);                  // Limit length
}

/**
 * Sanitize a string to be used as a Docker image name
 * Docker image names must be lowercase and match: [a-z0-9][a-z0-9_.-]*
 * 
 * @param {string} name - The name to sanitize
 * @returns {string} - Sanitized name safe for Docker images
 */
function sanitizeImageName(name) {
    if (!name) return 'unnamed';

    return name
        .toLowerCase()
        .replace(/[^a-z0-9-_.]/g, '-')   // Replace invalid chars with dash
        .replace(/^[^a-z0-9]+/, '')       // Remove leading invalid chars
        .replace(/--+/g, '-')             // Replace multiple dashes with single
        .replace(/^-+|-+$/g, '')          // Remove leading/trailing dashes
        .substring(0, 100);               // Limit length
}

/**
 * Sanitize a project name for use in URLs
 * 
 * @param {string} name - The project name
 * @returns {string} - URL-safe project name
 */
function sanitizeProjectName(name) {
    if (!name) return 'project';

    return name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')     // Replace invalid chars with dash
        .replace(/--+/g, '-')             // Replace multiple dashes with single
        .replace(/^-+|-+$/g, '')          // Remove leading/trailing dashes
        .substring(0, 50);                // Limit length for URLs
}

/**
 * Generate a unique container name
 * 
 * @param {string} serverKey - Server key (EC2, EC3, etc.)
 * @param {string} tier - Tier (free, pro)
 * @param {string} username - Username
 * @param {string} projectName - Project name
 * @returns {string} - Unique container name
 */
function generateContainerName(serverKey, tier, username, projectName) {
    const sanitizedUsername = sanitizeContainerName(username);
    const sanitizedProject = sanitizeContainerName(projectName);
    const timestamp = Date.now();

    return `${serverKey}-${tier}-${sanitizedUsername}-${sanitizedProject}-${timestamp}`;
}

/**
 * Generate a unique image name
 * 
 * @param {string} projectName - Project name
 * @param {string} deploymentId - Deployment ID
 * @returns {string} - Unique image name
 */
function generateImageName(projectName, deploymentId) {
    const sanitizedProject = sanitizeImageName(projectName);
    const shortId = deploymentId.toString().substring(0, 12);

    return `${sanitizedProject}-${shortId}`;
}

module.exports = {
    sanitizeContainerName,
    sanitizeImageName,
    sanitizeProjectName,
    generateContainerName,
    generateImageName
};
