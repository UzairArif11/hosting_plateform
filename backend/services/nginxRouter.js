const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const logger = require('../utils/logger');
const path = require('path');
const os = require('os');
const Settings = require('../models/Settings');

/**
 * FIXED VERSION - Correctly adds location blocks to Nginx
 * Handles multiple server blocks and prevents nesting issues
 * Gets domain configuration from database
 */
async function updateNginxRouting(projectName, port, serverHost, serverKey, deploymentId) {
    const ssh = new NodeSSH();

    try {
        logger.info(`Updating Nginx routing for ${projectName} on port ${port}`);

        // Get SSH key based on server
        const keyPath = serverKey === 'EC2' ? process.env.SSH_EC2_KEY
            : serverKey === 'EC3' ? process.env.SSH_EC3_KEY
                : serverKey === 'EC4' ? process.env.SSH_EC4_KEY
                    : serverKey === 'EC5' ? process.env.SSH_EC5_KEY
                        : process.env.SSH_EC3_KEY;

        const keyContent = fs.readFileSync(keyPath, 'utf8');

        await ssh.connect({
            host: serverHost,
            username: process.env.SSH_USERNAME || 'ubuntu',
            privateKey: keyContent
        });

        // Generate Vercel-style unique URL path
        const shortName = projectName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 12);

        const shortId = deploymentId.substring(0, 8);
        const timestamp = Date.now().toString().substring(5, 13); // 8 digits

        const urlPath = `${shortName}-${shortId}-${timestamp}`;

        logger.info(`Generated unique URL path: ${urlPath}`);

        // Get domain from database settings
        const domain = await Settings.getDomainForServer(serverKey);
        logger.info(`Using domain: ${domain} for server ${serverKey}`);

        // Read existing config
        const readResult = await ssh.execCommand('cat /etc/nginx/sites-available/default');
        let config = readResult.stdout;

        // Create location block
        const locationBlock = `    # ${projectName} - Port ${port} - ${deploymentId}
    location /${urlPath}/ {
        proxy_pass http://localhost:${port}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }`;

        // Parse config to find server blocks with our domain
        const lines = config.split('\n');
        const newLines = [];
        let inServerBlock = false;
        let inLocationBlock = false;
        let currentServerHasDomain = false;
        let bracketDepth = 0;
        let serverBracketDepth = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Track server block
            if (trimmed.startsWith('server {')) {
                inServerBlock = true;
                currentServerHasDomain = false;
                serverBracketDepth = 0;
                newLines.push(line);
                continue;
            }

            // Check if this server block has our domain
            if (inServerBlock && trimmed.includes('server_name') &&
                (trimmed.includes(domain) || trimmed.includes(`www.${domain}`))) {
                currentServerHasDomain = true;
            }

            // Track location blocks to avoid nesting
            if (trimmed.startsWith('location ')) {
                inLocationBlock = true;
                bracketDepth = 0;
            }

            // Count braces to track nesting
            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;

            if (inLocationBlock) {
                bracketDepth += openBraces - closeBraces;
                if (bracketDepth <= 0) {
                    inLocationBlock = false;
                }
            }

            if (inServerBlock) {
                serverBracketDepth += openBraces - closeBraces;
            }

            // Add location block before server block closes
            if (inServerBlock && currentServerHasDomain && !inLocationBlock &&
                trimmed === '}' && serverBracketDepth === 0) {
                // This is the closing brace of the server block
                // Add our location block before it
                newLines.push(locationBlock);
                newLines.push('');
                inServerBlock = false;
                currentServerHasDomain = false;
            }

            newLines.push(line);
        }

        const newConfig = newLines.join('\n');

        // Write to local temp file
        const tempFile = path.join(os.tmpdir(), `nginx-${Date.now()}.conf`);
        fs.writeFileSync(tempFile, newConfig);

        // Upload to remote
        await ssh.putFile(tempFile, '/tmp/nginx-default.conf');

        // Move to correct location
        await ssh.execCommand('sudo mv /tmp/nginx-default.conf /etc/nginx/sites-available/default');

        // Clean up local temp file
        fs.unlinkSync(tempFile);

        // Test config
        const testResult = await ssh.execCommand('sudo nginx -t 2>&1');
        if (testResult.code !== 0) {
            logger.error(`Nginx test failed: ${testResult.stdout}`);
            throw new Error(`Nginx config test failed: ${testResult.stdout}`);
        }

        // Reload Nginx
        await ssh.execCommand('sudo systemctl reload nginx');

        // Get protocol from settings
        const settings = await Settings.getSettings();
        const protocol = settings.protocol;
        const fullUrl = `${protocol}://${domain}/${urlPath}/`;
        logger.info(`✅ Nginx routing updated: ${fullUrl} → localhost:${port}`);

        ssh.dispose();

        return {
            success: true,
            url: fullUrl,
            urlPath: urlPath
        };

    } catch (error) {
        logger.error(`Failed to update Nginx routing: ${error.message}`);
        ssh.dispose();
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    updateNginxRouting
};
