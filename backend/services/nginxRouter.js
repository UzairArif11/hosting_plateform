const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const Settings = require('../models/Settings');

/**
 * Get the deployment config file name for a server
 */
function getDeploymentConfigFile(serverKey) {
    return `user-deployments-${serverKey.toLowerCase()}.conf`;
}

/**
 * Ensure deployment config file exists and is properly configured
 * Returns the full config file path
 */
async function ensureDeploymentConfigFile(ssh, serverKey, domain) {
    const configFileName = getDeploymentConfigFile(serverKey);
    const configPath = `/etc/nginx/sites-available/${configFileName}`;
    const enabledPath = `/etc/nginx/sites-enabled/${configFileName}`;

    // Check if config file exists
    const checkResult = await ssh.execCommand(`sudo test -f ${configPath} && echo "exists" || echo "missing"`);
    
    if (checkResult.stdout.trim() === 'missing') {
        logger.info(`Creating deployment config file: ${configFileName}`);
        
        // Create the deployment config file
        const configContent = '# User Deployments Configuration for ' + domain + '\n' +
            '# This file is managed by nginxRouter.js - DO NOT manually edit\n' +
            '\n' +
            '# HTTP to HTTPS redirect\n' +
            'server {\n' +
            '    listen 80;\n' +
            '    listen [::]:80;\n' +
            '    \n' +
            '    server_name ' + domain + ' www.' + domain + ';\n' +
            '    \n' +
            '    # Redirect HTTP to HTTPS\n' +
            '    return 301 https://$server_name$request_uri;\n' +
            '}\n' +
            '\n' +
            '# HTTPS server block for user deployments\n' +
            'server {\n' +
            '    listen 443 ssl http2;\n' +
            '    listen [::]:443 ssl http2;\n' +
            '    \n' +
            '    server_name ' + domain + ' www.' + domain + ';\n' +
            '    \n' +
            '    # SSL Configuration (update paths if certificate exists)\n' +
            '    # ssl_certificate /etc/letsencrypt/live/' + domain + '/fullchain.pem;\n' +
            '    # ssl_certificate_key /etc/letsencrypt/live/' + domain + '/privkey.pem;\n' +
            '    ssl_protocols TLSv1.2 TLSv1.3;\n' +
            '    ssl_prefer_server_ciphers on;\n' +
            '    \n' +
            '    # Security headers\n' +
            '    add_header X-Frame-Options "SAMEORIGIN" always;\n' +
            '    add_header X-Content-Type-Options "nosniff" always;\n' +
            '    add_header X-XSS-Protection "1; mode=block" always;\n' +
            '    \n' +
            '    client_max_body_size 100M;\n' +
            '    \n' +
            '    # Root location (health check)\n' +
            '    location / {\n' +
            '        return 200 \'User Deployments Server - ' + domain + '\';\n' +
            '        add_header Content-Type text/plain;\n' +
            '    }\n' +
            '    \n' +
            '    # User deployment locations will be added here automatically by nginxRouter.js\n' +
            '    # Format: location /projectname-{id}/ { proxy_pass http://localhost:{port}/; }\n' +
            '}\n';

        // Write config file
        const tempFile = path.join(os.tmpdir(), `nginx-${configFileName}-${Date.now()}`);
        fs.writeFileSync(tempFile, configContent);
        
        await ssh.putFile(tempFile, `/tmp/${configFileName}`);
        await ssh.execCommand(`sudo mv /tmp/${configFileName} ${configPath}`);
        try { fs.unlinkSync(tempFile); } catch (e) { }
        
        logger.info(`✅ Created deployment config file: ${configFileName}`);
    }

    // Check if SSL certificate exists and update config
    const certCheck = await ssh.execCommand(`sudo test -f /etc/letsencrypt/live/${domain}/fullchain.pem && echo "exists" || echo "missing"`);
    if (certCheck.stdout.trim() === 'exists') {
        // Update SSL paths in config file (uncomment SSL certificate lines)
        await ssh.execCommand(`sudo sed -i 's|# ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem|ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem|g' ${configPath}`);
        await ssh.execCommand(`sudo sed -i 's|# ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem|ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem|g' ${configPath}`);
        logger.info(`✅ SSL certificate paths updated in ${configFileName}`);
    }

    // Enable the config file in sites-enabled
    const enabledCheck = await ssh.execCommand(`sudo test -f ${enabledPath} && echo "exists" || echo "missing"`);
    if (enabledCheck.stdout.trim() === 'missing') {
        await ssh.execCommand(`sudo ln -s ${configPath} ${enabledPath}`);
        logger.info(`✅ Enabled deployment config: ${configFileName}`);
    }

    return configPath;
}

/**
 * FIXED VERSION - Uses separate config file instead of modifying default
 * Adds location blocks to user-deployments-{serverKey}.conf
 */
async function updateNginxRouting(projectName, port, serverHost, serverKey, deploymentId) {
    const ssh = new NodeSSH();

    try {
        logger.info(`Updating Nginx routing for ${projectName} on port ${port} on server ${serverKey}`);

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
        // IMPORTANT: This must stay in sync with any URL path generation
        // logic used during the build step (e.g. for Next.js basePath)
        const shortName = projectName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 12);

        const shortId = deploymentId.substring(0, 8);

        // Deterministic URL path (no timestamp) so it can be computed
        // consistently during both build and routing configuration.
        const urlPath = `${shortName}-${shortId}`;

        logger.info(`Generated unique URL path (deterministic): ${urlPath}`);

        // Get domain from database settings
        const domain = await Settings.getDomainForServer(serverKey);
        logger.info(`Using domain: ${domain} for server ${serverKey}`);

        // Ensure deployment config file exists
        const configPath = await ensureDeploymentConfigFile(ssh, serverKey, domain);

        // Read existing deployment config (NOT default)
        const readResult = await ssh.execCommand(`sudo cat ${configPath}`);
        if (readResult.code !== 0) {
            throw new Error(`Failed to read Nginx deployment config: ${readResult.stderr}`);
        }
        let config = readResult.stdout;

        // Create location block
        // IMPORTANT: We serve all apps from a sub-path like /demosmartpor-xxxx/.
        // To keep Next.js simple (no hard basePath assumptions), we strip the
        // prefix before proxying so the app always sees requests starting at `/`.
        //
        // Example:
        //   https://ec2.foodpanda.site/demosmartpor-1234/       → http://localhost:PORT/
        //   https://ec2.foodpanda.site/demosmartpor-1234/_next → http://localhost:PORT/_next
        //
        // This avoids 404s and missing CSS/JS when templates are not configured
        // with a basePath, and works for both pages and static assets.
        const locationBlock = `    # ${projectName} - Port ${port} - ${deploymentId}
    location /${urlPath}/ {
        # Strip the deployment prefix so the app sees root-relative paths
        rewrite ^\\/${urlPath}(.*)$ $1 break;

        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }`;

        // Find the HTTPS server block (443) and insert location block before the closing brace
        const lines = config.split('\n');
        const newLines = [];
        let inHttpsServer = false;
        let httpsServerDepth = 0;
        let lastBraceIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Detect HTTPS server block (443 ssl)
            if (trimmed.includes('listen 443') && trimmed.includes('ssl')) {
                inHttpsServer = true;
                httpsServerDepth = 1;
            }

            if (inHttpsServer) {
                const open = (line.match(/{/g) || []).length;
                const close = (line.match(/}/g) || []).length;
                httpsServerDepth += open - close;

                // Check if this is the closing brace of the HTTPS server block
                if (httpsServerDepth === 0 && trimmed === '}') {
                    lastBraceIndex = i;
                    // Insert location block before this closing brace
                    newLines.push(locationBlock);
                    newLines.push('');
                }
            }

            newLines.push(line);
        }

        // If we didn't find the HTTPS server block, append to end (shouldn't happen)
        if (lastBraceIndex === -1) {
            logger.warn('HTTPS server block not found, appending location block to end');
            // Remove last closing brace, add location block, then add closing brace back
            if (newLines[newLines.length - 1].trim() === '}') {
                newLines.pop();
                newLines.push(locationBlock);
                newLines.push('');
                newLines.push('}');
            }
        }

        const newConfig = newLines.join('\n');
        const tempFile = path.join(os.tmpdir(), `nginx-deployment-${Date.now()}.conf`);
        fs.writeFileSync(tempFile, newConfig);

        await ssh.putFile(tempFile, `/tmp/deployment-${getDeploymentConfigFile(serverKey)}`);
        await ssh.execCommand(`sudo mv /tmp/deployment-${getDeploymentConfigFile(serverKey)} ${configPath}`);
        try { fs.unlinkSync(tempFile); } catch (e) { }

        const testResult = await ssh.execCommand('sudo nginx -t 2>&1');
        if (!testResult.stdout.includes('successful') && !testResult.stdout.includes('syntax is ok')) {
            throw new Error(`Nginx config test failed: ${testResult.stdout}`);
        }

        await ssh.execCommand('sudo systemctl reload nginx');

        const settings = await Settings.getSettings();
        const protocol = settings.protocol || 'https';
        const fullUrl = `${protocol}://${domain}/${urlPath}/`;
        logger.info(`✅ Nginx routing updated in ${configPath}: ${fullUrl} → localhost:${port}`);

        ssh.dispose();
        return { success: true, url: fullUrl, urlPath: urlPath };

    } catch (error) {
        logger.error(`Failed to update Nginx routing: ${error.message}`);
        ssh.dispose();
        return { success: false, error: error.message };
    }
}

/**
 * Remove Nginx location block for a deployment
 * Uses separate deployment config file instead of default
 */
async function removeNginxRouting(deploymentId, serverHost, serverKey) {
    const ssh = new NodeSSH();

    try {
        logger.info(`Removing Nginx routing for deployment ${deploymentId} from server ${serverKey}`);

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

        const configPath = `/etc/nginx/sites-available/${getDeploymentConfigFile(serverKey)}`;

        // Read existing deployment config (NOT default)
        const readResult = await ssh.execCommand(`sudo cat ${configPath}`);
        if (readResult.code !== 0) {
            logger.warn(`Deployment config file ${configPath} not found, assuming already removed`);
            ssh.dispose();
            return { success: true, message: 'Config file not found (may have been already removed)' };
        }

        let config = readResult.stdout;

        // Remove location block(s) for this deployment ID
        // Pattern: # projectname - Port XXXX - deploymentId
        const lines = config.split('\n');
        const newLines = [];
        let skipBlock = false;
        let removed = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Check if this is the start of a location block for this deployment
            if (trimmed.includes(`- ${deploymentId}`) && trimmed.startsWith('#')) {
                skipBlock = true;
                removed = true;
                logger.info(`Found location block for deployment ${deploymentId}, removing...`);
                continue; // Skip the comment line
            }

            // If we're skipping, continue until we find the closing brace
            if (skipBlock) {
                // Check if this is the closing brace of the location block
                if (trimmed === '}' && (i === 0 || lines[i - 1].trim().includes('$http_upgrade'))) {
                    skipBlock = false;
                    continue; // Skip the closing brace
                }
                // Skip all lines in the block (including the location line and proxy_pass lines)
                continue;
            }

            // Keep all other lines
            newLines.push(line);
        }

        if (!removed) {
            logger.warn(`No Nginx location block found for deployment ${deploymentId}`);
            ssh.dispose();
            return { success: true, message: 'No location block found (may have been already removed)' };
        }

        const newConfig = newLines.join('\n');
        const tempFile = path.join(os.tmpdir(), `nginx-remove-${Date.now()}.conf`);
        fs.writeFileSync(tempFile, newConfig);

        await ssh.putFile(tempFile, `/tmp/deployment-remove-${getDeploymentConfigFile(serverKey)}`);
        await ssh.execCommand(`sudo mv /tmp/deployment-remove-${getDeploymentConfigFile(serverKey)} ${configPath}`);
        try { fs.unlinkSync(tempFile); } catch (e) { }

        const testResult = await ssh.execCommand('sudo nginx -t 2>&1');
        if (!testResult.stdout.includes('successful') && !testResult.stdout.includes('syntax is ok')) {
            throw new Error(`Nginx config test failed: ${testResult.stdout}`);
        }

        await ssh.execCommand('sudo systemctl reload nginx');
        logger.info(`✅ Nginx location block removed from ${configPath} for deployment ${deploymentId}`);

        ssh.dispose();
        return { success: true, message: 'Nginx location block removed successfully' };

    } catch (error) {
        logger.error(`Failed to remove Nginx routing: ${error.message}`);
        ssh.dispose();
        return { success: false, error: error.message };
    }
}

module.exports = { updateNginxRouting, removeNginxRouting };
