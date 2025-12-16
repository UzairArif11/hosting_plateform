const Settings = require('../models/Settings');
const Deployment = require('../models/Deployment');
const User = require('../models/User');
const logger = require('../utils/logger');
const emailService = require('./emailService');

/**
 * Domain Migration Service
 * Handles updating deployment URLs when admin changes domains
 */

/**
 * Migrate all deployments to new domain
 */
async function migrateDomainForServer(serverKey, oldDomain, newDomain) {
    try {
        logger.info(`Starting domain migration for ${serverKey}: ${oldDomain} → ${newDomain}`);

        // Find all deployments on this server
        const deployments = await Deployment.find({
            serverKey: serverKey,
            status: 'success',
            url: { $exists: true, $ne: null }
        }).populate('userId projectId');

        if (deployments.length === 0) {
            logger.info(`No deployments found for ${serverKey}`);
            return { success: true, migrated: 0, notified: 0 };
        }

        logger.info(`Found ${deployments.length} deployments to migrate`);

        let migrated = 0;
        let notified = 0;
        const userNotifications = new Map(); // Group by user

        for (const deployment of deployments) {
            try {
                // Skip if user has custom domain (paid users)
                if (deployment.projectId?.customDomain) {
                    logger.info(`Skipping deployment ${deployment._id} - has custom domain`);
                    continue;
                }

                // Update URL
                const oldUrl = deployment.url;
                const newUrl = oldUrl.replace(oldDomain, newDomain);

                deployment.url = newUrl;
                deployment.metadata = {
                    ...deployment.metadata,
                    domainMigration: {
                        oldDomain,
                        newDomain,
                        migratedAt: new Date(),
                        oldUrl
                    }
                };

                await deployment.save();
                migrated++;

                logger.info(`Migrated: ${oldUrl} → ${newUrl}`);

                // Group notifications by user
                const userId = deployment.userId._id.toString();
                if (!userNotifications.has(userId)) {
                    userNotifications.set(userId, {
                        user: deployment.userId,
                        deployments: []
                    });
                }

                userNotifications.get(userId).deployments.push({
                    projectName: deployment.projectId?.name || 'Unknown',
                    oldUrl,
                    newUrl,
                    deploymentId: deployment._id
                });

            } catch (error) {
                logger.error(`Failed to migrate deployment ${deployment._id}:`, error);
            }
        }

        // Send email notifications to affected users
        for (const [userId, data] of userNotifications) {
            try {
                await sendDomainChangeNotification(data.user, data.deployments, oldDomain, newDomain);
                notified++;
            } catch (error) {
                logger.error(`Failed to notify user ${userId}:`, error);
            }
        }

        logger.info(`Domain migration complete: ${migrated} deployments migrated, ${notified} users notified`);

        return {
            success: true,
            migrated,
            notified,
            skipped: deployments.length - migrated
        };

    } catch (error) {
        logger.error('Domain migration failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Send email notification to user about domain change
 */
async function sendDomainChangeNotification(user, deployments, oldDomain, newDomain) {
    try {
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #f9fafb;
            padding: 20px;
            border: 1px solid #e5e7eb;
        }
        .deployment {
            background: white;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .url {
            font-family: monospace;
            background: #f3f4f6;
            padding: 8px;
            border-radius: 4px;
            word-break: break-all;
            margin: 5px 0;
        }
        .old-url {
            color: #dc2626;
            text-decoration: line-through;
        }
        .new-url {
            color: #059669;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 12px;
        }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔄 Deployment URLs Updated</h1>
        </div>
        <div class="content">
            <p>Hello ${user.name || user.email},</p>
            
            <p>We're writing to inform you that our deployment domain has been updated:</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>Old Domain:</strong> <span class="old-url">${oldDomain}</span></p>
                <p style="margin: 5px 0;"><strong>New Domain:</strong> <span class="new-url">${newDomain}</span></p>
            </div>

            <p><strong>Your affected deployments (${deployments.length}):</strong></p>

            ${deployments.map(d => `
                <div class="deployment">
                    <h3 style="margin: 0 0 10px 0;">${d.projectName}</h3>
                    <p style="margin: 5px 0; font-size: 12px; color: #6b7280;">Old URL:</p>
                    <div class="url old-url">${d.oldUrl}</div>
                    <p style="margin: 5px 0; font-size: 12px; color: #6b7280;">New URL:</p>
                    <div class="url new-url">${d.newUrl}</div>
                    <a href="${d.newUrl}" class="button">Visit Deployment</a>
                </div>
            `).join('')}

            <p style="margin-top: 20px;">
                <strong>What you need to do:</strong>
            </p>
            <ul>
                <li>Update any bookmarks or saved links</li>
                <li>Update links in your documentation</li>
                <li>Inform your users if you've shared these URLs</li>
            </ul>

            <p style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <strong>⚠️ Important:</strong> The old URLs will continue to work for the next 30 days, 
                but please update your links as soon as possible.
            </p>

            <p>If you have any questions, please don't hesitate to contact our support team.</p>

            <p>Best regards,<br>The Deployment Team</p>
        </div>
        <div class="footer">
            <p>This is an automated notification about your deployments.</p>
            <p>If you have a custom domain configured, this change does not affect you.</p>
        </div>
    </div>
</body>
</html>
        `;

        const emailText = `
Deployment URLs Updated

Hello ${user.name || user.email},

Our deployment domain has been updated:
Old Domain: ${oldDomain}
New Domain: ${newDomain}

Your affected deployments (${deployments.length}):

${deployments.map(d => `
Project: ${d.projectName}
Old URL: ${d.oldUrl}
New URL: ${d.newUrl}
`).join('\n')}

What you need to do:
- Update any bookmarks or saved links
- Update links in your documentation
- Inform your users if you've shared these URLs

Important: The old URLs will continue to work for the next 30 days, but please update your links as soon as possible.

Best regards,
The Deployment Team
        `;

        await emailService.sendEmail({
            to: user.email,
            subject: `🔄 Your Deployment URLs Have Been Updated`,
            html: emailHtml,
            text: emailText
        });

        logger.info(`Domain change notification sent to ${user.email}`);

    } catch (error) {
        logger.error(`Failed to send domain change notification to ${user.email}:`, error);
        throw error;
    }
}

/**
 * Migrate all domains when settings are updated
 */
async function migrateAllDomains(oldServerDomains, newServerDomains) {
    try {
        logger.info('Starting full domain migration');

        const results = {
            total: 0,
            migrated: 0,
            notified: 0,
            skipped: 0,
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

            const result = await migrateDomainForServer(serverKey, oldDomain, newDomain);

            results.servers[serverKey] = result;
            results.migrated += result.migrated || 0;
            results.notified += result.notified || 0;
            results.skipped += result.skipped || 0;
        }

        results.total = results.migrated + results.skipped;

        logger.info(`Full domain migration complete:`, results);

        return results;

    } catch (error) {
        logger.error('Full domain migration failed:', error);
        throw error;
    }
}

module.exports = {
    migrateDomainForServer,
    migrateAllDomains,
    sendDomainChangeNotification
};
