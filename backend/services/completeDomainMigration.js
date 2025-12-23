const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const Settings = require('../models/Settings');
const Deployment = require('../models/Deployment');
const logger = require('../utils/logger');
const domainMigration = require('./domainMigration');

// Helper function to connect to server via SSH
async function connectToServer(serverKey) {
    const ssh = new NodeSSH();
    const keyPath = serverKey === 'EC2' ? process.env.SSH_EC2_KEY
        : serverKey === 'EC3' ? process.env.SSH_EC3_KEY
            : process.env.SSH_EC3_KEY;

    const keyContent = fs.readFileSync(keyPath, 'utf8');
    const host = process.env[`${serverKey}_HOST`] || process.env.EC3_SERVER_IP;

    await ssh.connect({
        host: host,
        username: process.env.SSH_USERNAME || 'ubuntu',
        privateKey: keyContent
    });

    return ssh;
}

/**
 * Complete Domain Migration Service
 * Handles both database AND server configuration updates
 */

/**
 * Migrate domain completely (database + server configuration)
 */
async function migrateServerDomainComplete(serverKey, oldDomain, newDomain) {
    try {
        logger.info(`Starting complete domain migration for ${serverKey}: ${oldDomain} → ${newDomain}`);

        const result = {
            serverKey,
            oldDomain,
            newDomain,
            steps: {
                databaseUpdate: false,
                nginxBackup: false,
                nginxUpdate: false,
                nginxTest: false,
                nginxReload: false,
                sslUpdate: false,
                deploymentMigration: false,
                userNotification: false
            },
            errors: []
        };

        // Step 1: Migrate database and notify users
        logger.info(`[${serverKey}] Step 1: Migrating database and notifying users...`);
        try {
            const migrationResult = await domainMigration.migrateDomainForServer(serverKey, oldDomain, newDomain);
            result.steps.databaseUpdate = true;
            result.steps.deploymentMigration = true;
            result.steps.userNotification = true;
            result.migratedDeployments = migrationResult.migrated;
            result.notifiedUsers = migrationResult.notified;
            logger.info(`[${serverKey}] ✓ Database migration complete: ${migrationResult.migrated} deployments, ${migrationResult.notified} users notified`);
        } catch (error) {
            result.errors.push(`Database migration failed: ${error.message}`);
            logger.error(`[${serverKey}] Database migration failed:`, error);
            return result;
        }

        // Step 2: Connect to server via SSH
        logger.info(`[${serverKey}] Step 2: Connecting to server...`);
        let ssh;
        try {
            ssh = await connectToServer(serverKey);
            logger.info(`[${serverKey}] ✓ Connected to server`);
        } catch (error) {
            result.errors.push(`SSH connection failed: ${error.message}`);
            logger.error(`[${serverKey}] SSH connection failed:`, error);
            return result;
        }

        try {
            // Step 3: Backup Nginx configuration
            logger.info(`[${serverKey}] Step 3: Backing up Nginx configuration...`);
            const backupTimestamp = Date.now();
            const backupResult = await ssh.execCommand(
                `sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.${backupTimestamp}`
            );

            if (backupResult.code !== 0) {
                throw new Error(`Backup failed: ${backupResult.stderr}`);
            }
            result.steps.nginxBackup = true;
            result.backupFile = `/etc/nginx/sites-available/default.backup.${backupTimestamp}`;
            logger.info(`[${serverKey}] ✓ Nginx config backed up to: default.backup.${backupTimestamp}`);

            // Step 4: Update server_name in Nginx configuration
            logger.info(`[${serverKey}] Step 4: Updating Nginx server_name...`);

            // Read current config
            const readResult = await ssh.execCommand('sudo cat /etc/nginx/sites-available/default');
            if (readResult.code !== 0) {
                throw new Error(`Failed to read Nginx config: ${readResult.stderr}`);
            }

            let nginxConfig = readResult.stdout;

            // Replace old domain with new domain in server_name directives
            nginxConfig = nginxConfig.replace(
                new RegExp(`server_name\\s+${oldDomain.replace(/\./g, '\\.')}`, 'g'),
                `server_name ${newDomain}`
            );
            nginxConfig = nginxConfig.replace(
                new RegExp(`server_name\\s+www\\.${oldDomain.replace(/\./g, '\\.')}`, 'g'),
                `server_name www.${newDomain}`
            );
            nginxConfig = nginxConfig.replace(
                new RegExp(`server_name\\s+${oldDomain.replace(/\./g, '\\.')}\\s+www\\.${oldDomain.replace(/\./g, '\\.')}`, 'g'),
                `server_name ${newDomain} www.${newDomain}`
            );

            // Write updated config
            const writeResult = await ssh.execCommand(
                `echo '${nginxConfig.replace(/'/g, "'\\''")}' | sudo tee /etc/nginx/sites-available/default > /dev/null`
            );

            if (writeResult.code !== 0) {
                throw new Error(`Failed to write Nginx config: ${writeResult.stderr}`);
            }
            result.steps.nginxUpdate = true;
            logger.info(`[${serverKey}] ✓ Nginx config updated`);

            // Step 5: Test Nginx configuration
            logger.info(`[${serverKey}] Step 5: Testing Nginx configuration...`);
            const testResult = await ssh.execCommand('sudo nginx -t 2>&1');

            if (!testResult.stdout.includes('successful') && !testResult.stdout.includes('syntax is ok')) {
                // Rollback on failure
                logger.error(`[${serverKey}] Nginx test failed, rolling back...`);
                await ssh.execCommand(
                    `sudo cp /etc/nginx/sites-available/default.backup.${backupTimestamp} /etc/nginx/sites-available/default`
                );
                throw new Error(`Nginx config test failed: ${testResult.stdout}`);
            }
            result.steps.nginxTest = true;
            logger.info(`[${serverKey}] ✓ Nginx config test passed`);

            // Step 6: Reload Nginx
            logger.info(`[${serverKey}] Step 6: Reloading Nginx...`);
            const reloadResult = await ssh.execCommand('sudo systemctl reload nginx');

            if (reloadResult.code !== 0) {
                // Rollback on failure
                logger.error(`[${serverKey}] Nginx reload failed, rolling back...`);
                await ssh.execCommand(
                    `sudo cp /etc/nginx/sites-available/default.backup.${backupTimestamp} /etc/nginx/sites-available/default`
                );
                await ssh.execCommand('sudo systemctl reload nginx');
                throw new Error(`Nginx reload failed: ${reloadResult.stderr}`);
            }
            result.steps.nginxReload = true;
            logger.info(`[${serverKey}] ✓ Nginx reloaded`);

            // Step 7: Update SSL certificate
            logger.info(`[${serverKey}] Step 7: Updating SSL certificate...`);

            // Check if certificate already exists for new domain
            const certCheckResult = await ssh.execCommand(`sudo certbot certificates 2>&1 | grep -q "${newDomain}"`);

            if (certCheckResult.code === 0) {
                // Certificate exists, reinstall
                logger.info(`[${serverKey}] Certificate exists for ${newDomain}, reinstalling...`);
                const certResult = await ssh.execCommand(
                    `sudo certbot --nginx -d ${newDomain} -d www.${newDomain} --reinstall --redirect --non-interactive 2>&1`
                );

                if (certResult.code !== 0 && !certResult.stdout.includes('Successfully')) {
                    logger.warn(`[${serverKey}] SSL certificate update warning: ${certResult.stdout}`);
                    result.errors.push(`SSL update warning: ${certResult.stdout}`);
                } else {
                    result.steps.sslUpdate = true;
                    logger.info(`[${serverKey}] ✓ SSL certificate updated`);
                }
            } else {
                // Certificate doesn't exist, obtain new one
                logger.info(`[${serverKey}] Obtaining new certificate for ${newDomain}...`);
                const certResult = await ssh.execCommand(
                    `sudo certbot --nginx -d ${newDomain} -d www.${newDomain} --agree-tos --redirect --non-interactive 2>&1`
                );

                if (certResult.code !== 0 && !certResult.stdout.includes('Successfully')) {
                    logger.warn(`[${serverKey}] SSL certificate obtain warning: ${certResult.stdout}`);
                    result.errors.push(`SSL obtain warning: ${certResult.stdout}`);
                } else {
                    result.steps.sslUpdate = true;
                    logger.info(`[${serverKey}] ✓ SSL certificate obtained`);
                }
            }

        } catch (error) {
            result.errors.push(`Server configuration failed: ${error.message}`);
            logger.error(`[${serverKey}] Server configuration failed:`, error);
        } finally {
            if (ssh) {
                ssh.dispose();
            }
        }

        // Determine overall success
        result.success = result.steps.databaseUpdate &&
            result.steps.nginxUpdate &&
            result.steps.nginxReload;

        if (result.success) {
            logger.info(`[${serverKey}] ✅ Complete domain migration successful!`);
        } else {
            logger.error(`[${serverKey}] ❌ Domain migration completed with errors`);
        }

        return result;

    } catch (error) {
        logger.error(`Complete domain migration failed for ${serverKey}:`, error);
        return {
            success: false,
            serverKey,
            oldDomain,
            newDomain,
            error: error.message
        };
    }
}

/**
 * Migrate all domains completely (database + server configuration)
 */
async function migrateAllDomainsComplete(oldServerDomains, newServerDomains) {
    try {
        logger.info('Starting complete domain migration for all servers');

        const results = {
            total: 0,
            successful: 0,
            failed: 0,
            servers: {}
        };

        for (const serverKey of Object.keys(newServerDomains)) {
            const oldDomain = oldServerDomains[serverKey];
            const newDomain = newServerDomains[serverKey];

            // Skip if domain hasn't changed
            if (oldDomain === newDomain) {
                logger.info(`Domain unchanged for ${serverKey}: ${oldDomain}`);
                continue;
            }

            results.total++;

            const result = await migrateServerDomainComplete(serverKey, oldDomain, newDomain);

            results.servers[serverKey] = result;

            if (result.success) {
                results.successful++;
            } else {
                results.failed++;
            }
        }

        logger.info(`Complete domain migration finished: ${results.successful} successful, ${results.failed} failed`);

        return results;

    } catch (error) {
        logger.error('Complete domain migration failed:', error);
        throw error;
    }
}

module.exports = {
    migrateServerDomainComplete,
    migrateAllDomainsComplete
};
