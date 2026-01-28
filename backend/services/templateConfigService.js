const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Load template configuration from .template.config.json
 * This enables user panel customization
 */
async function loadTemplateConfig(buildPath) {
    try {
        const configPath = path.join(buildPath, '.template.config.json');
        
        // Check if config file exists
        try {
            await fs.access(configPath);
        } catch {
            logger.info('No .template.config.json found - using default config');
            return null;
        }

        // Read and parse config
        const configContent = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configContent);

        logger.info('✅ Loaded template configuration:', {
            name: config.name,
            framework: config.framework,
            databaseModes: config.userCustomizable?.database?.modes,
            authModes: config.userCustomizable?.authentication?.modes
        });

        return config;
    } catch (error) {
        logger.error('Failed to load template config:', error);
        return null;
    }
}

/**
 * Generate environment variables based on user selections
 */
function generateEnvironmentVariables(templateConfig, userSelections) {
    const envVars = {};

    // Add base environment variables from template
    if (templateConfig.environmentVariables) {
        templateConfig.environmentVariables.forEach(envVar => {
            const userValue = userSelections[envVar.key];
            envVars[envVar.key] = userValue || envVar.default || '';
        });
    }

    // Add database-specific environment variables
    if (userSelections.DATABASE_MODE && userSelections.DATABASE_MODE !== 'none') {
        const dbMode = userSelections.DATABASE_MODE;
        const dbEnvVars = templateConfig.userCustomizable?.database?.envVars?.[dbMode];
        
        if (dbEnvVars) {
            dbEnvVars.forEach(key => {
                if (userSelections[key]) {
                    envVars[key] = userSelections[key];
                }
            });
        }
    }

    // Add authentication-specific environment variables
    if (userSelections.AUTH_MODE && userSelections.AUTH_MODE !== 'none') {
        const authMode = userSelections.AUTH_MODE;
        const authEnvVars = templateConfig.userCustomizable?.authentication?.envVars?.[authMode];
        
        if (authEnvVars) {
            authEnvVars.forEach(key => {
                if (userSelections[key]) {
                    envVars[key] = userSelections[key];
                }
            });
        }
    }

    return envVars;
}

/**
 * Write environment variables to .env file
 */
async function writeEnvFile(buildPath, envVars) {
    try {
        const envContent = Object.entries(envVars)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        await fs.writeFile(path.join(buildPath, '.env'), envContent);
        logger.info(`✅ Environment file written with ${Object.keys(envVars).length} variables`);
    } catch (error) {
        logger.error('Failed to write .env file:', error);
        throw error;
    }
}

/**
 * Get available database modes from template config
 */
function getAvailableDatabaseModes(templateConfig) {
    return templateConfig?.userCustomizable?.database?.modes || [];
}

/**
 * Get available authentication modes from template config
 */
function getAvailableAuthModes(templateConfig) {
    return templateConfig?.userCustomizable?.authentication?.modes || [];
}

/**
 * Validate user selections against template config
 */
function validateUserSelections(templateConfig, userSelections) {
    const errors = [];

    // Validate database mode
    if (userSelections.DATABASE_MODE) {
        const availableModes = getAvailableDatabaseModes(templateConfig);
        if (!availableModes.includes(userSelections.DATABASE_MODE)) {
            errors.push(`Invalid database mode: ${userSelections.DATABASE_MODE}`);
        }
    }

    // Validate authentication mode
    if (userSelections.AUTH_MODE) {
        const availableModes = getAvailableAuthModes(templateConfig);
        if (!availableModes.includes(userSelections.AUTH_MODE)) {
            errors.push(`Invalid authentication mode: ${userSelections.AUTH_MODE}`);
        }
    }

    // Validate required environment variables
    if (templateConfig.environmentVariables) {
        templateConfig.environmentVariables.forEach(envVar => {
            if (envVar.required && !userSelections[envVar.key]) {
                errors.push(`Required environment variable missing: ${envVar.key}`);
            }
        });
    }

    return errors;
}

module.exports = {
    loadTemplateConfig,
    generateEnvironmentVariables,
    writeEnvFile,
    getAvailableDatabaseModes,
    getAvailableAuthModes,
    validateUserSelections
};
