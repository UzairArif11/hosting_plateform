const acme = require('acme-client');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../utils/logger');

const CERT_DIR = process.env.SSL_CERT_DIR || '/etc/letsencrypt/live';
const CHALLENGE_DIR = process.env.SSL_CHALLENGE_DIR || '/var/www/challenges';

class SSLAutomation {
    constructor() {
        this.issuingCerts = new Set(); // Track in-progress issuances
    }

    /**
     * Automatically issue SSL certificate for verified domain
     */
    async autoIssueCertificate(domain, projectId) {
        // Prevent duplicate issuance
        if (this.issuingCerts.has(domain)) {
            logger.info(`Certificate issuance already in progress for ${domain}`);
            return { status: 'pending', message: 'Certificate issuance in progress' };
        }

        try {
            this.issuingCerts.add(domain);
            logger.info(`Starting automatic SSL certificate issuance for ${domain}`);

            // Create ACME client (Let's Encrypt)
            const accountKey = await this.getOrCreateAccountKey();
            const client = new acme.Client({
                directoryUrl: acme.directory.letsencrypt.production,
                accountKey
            });

            // Register account if needed
            await client.createAccount({
                termsOfServiceAgreed: true,
                contact: [`mailto:${process.env.ADMIN_EMAIL || 'admin@platform.com'}`]
            });

            // Create CSR (Certificate Signing Request)
            const [key, csr] = await acme.forge.createCsr({
                commonName: domain,
                altNames: [`www.${domain}`]
            });

            // Request certificate with HTTP-01 challenge
            const cert = await client.auto({
                csr,
                email: process.env.ADMIN_EMAIL || 'admin@platform.com',
                termsOfServiceAgreed: true,
                challengePriority: ['http-01'],
                challengeCreateFn: async (authz, challenge, keyAuthorization) => {
                    if (challenge.type === 'http-01') {
                        await this.setupHTTPChallenge(domain, challenge.token, keyAuthorization);
                    }
                },
                challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
                    if (challenge.type === 'http-01') {
                        await this.cleanupHTTPChallenge(domain, challenge.token);
                    }
                }
            });

            // Save certificates
            await this.saveCertificates(domain, key, cert);

            // Configure Nginx
            await this.configureNginx(domain, projectId);

            logger.info(`✅ SSL certificate issued successfully for ${domain}`);

            return {
                status: 'success',
                message: 'SSL certificate issued and configured',
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
            };

        } catch (error) {
            logger.error(`SSL certificate issuance failed for ${domain}:`, error);
            return {
                status: 'failed',
                message: error.message || 'Certificate issuance failed'
            };
        } finally {
            this.issuingCerts.delete(domain);
        }
    }

    /**
     * Get or create ACME account key
     */
    async getOrCreateAccountKey() {
        const keyPath = path.join(CERT_DIR, '../accounts/account.key');

        try {
            // Try to load existing key
            const keyPem = await fs.readFile(keyPath, 'utf8');
            return keyPem;
        } catch {
            // Create new account key
            logger.info('Creating new ACME account key');
            const accountKey = await acme.forge.createPrivateKey();

            await fs.mkdir(path.dirname(keyPath), { recursive: true });
            await fs.writeFile(keyPath, accountKey);

            return accountKey;
        }
    }

    /**
     * Setup HTTP-01 challenge
     */
    async setupHTTPChallenge(domain, token, keyAuthorization) {
        const challengePath = path.join(CHALLENGE_DIR, domain, '.well-known/acme-challenge');
        await fs.mkdir(challengePath, { recursive: true });

        const filePath = path.join(challengePath, token);
        await fs.writeFile(filePath, keyAuthorization);

        logger.info(`HTTP challenge file created for ${domain}: ${token}`);
    }

    /**
     * Cleanup HTTP-01 challenge
     */
    async cleanupHTTPChallenge(domain, token) {
        try {
            const filePath = path.join(CHALLENGE_DIR, domain, '.well-known/acme-challenge', token);
            await fs.unlink(filePath);
            logger.info(`HTTP challenge file cleaned up for ${domain}`);
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    /**
     * Save certificates to disk
     */
    async saveCertificates(domain, privateKey, certificate) {
        const certPath = path.join(CERT_DIR, domain);
        await fs.mkdir(certPath, { recursive: true });

        await fs.writeFile(path.join(certPath, 'privkey.pem'), privateKey);
        await fs.writeFile(path.join(certPath, 'fullchain.pem'), certificate);

        logger.info(`Certificates saved for ${domain}`);
    }

    /**
     * Configure Nginx for HTTPS
     */
    async configureNginx(domain, projectId) {
        // Get project details
        const Project = require('../models/Project');
        const project = await Project.findById(projectId);

        if (!project) {
            throw new Error('Project not found');
        }

        // Get container/deployment info
        const containerName = project.containerName || project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const port = project.port || 3000;

        const nginxConfig = `
# HTTPS server for ${domain}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${domain} www.${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy to application
    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/challenges/${domain};
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};
    
    # ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/challenges/${domain};
    }
    
    # Redirect all other requests to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}
`;

        // Write Nginx config
        const configPath = `/etc/nginx/sites-available/${domain}`;
        await fs.writeFile(configPath, nginxConfig);

        // Create symlink in sites-enabled
        const enabledPath = `/etc/nginx/sites-enabled/${domain}`;
        try {
            await fs.unlink(enabledPath); // Remove if exists
        } catch { }
        await fs.symlink(configPath, enabledPath);

        // Test and reload Nginx
        try {
            await execAsync('nginx -t');
            await execAsync('systemctl reload nginx');
            logger.info(`Nginx configured and reloaded for ${domain}`);
        } catch (error) {
            logger.error(`Nginx configuration failed: ${error.message}`);
            throw new Error('Nginx configuration failed');
        }
    }

    /**
     * Check if certificate needs renewal (< 30 days remaining)
     */
    async needsRenewal(domain) {
        try {
            const certPath = path.join(CERT_DIR, domain, 'fullchain.pem');
            const certPem = await fs.readFile(certPath, 'utf8');

            const forge = require('node-forge');
            const cert = forge.pki.certificateFromPem(certPem);

            const daysUntilExpiry = Math.floor(
                (cert.validity.notAfter - new Date()) / (1000 * 60 * 60 * 24)
            );

            return daysUntilExpiry < 30;
        } catch {
            return true; // If can't read cert, assume renewal needed
        }
    }
}

module.exports = new SSLAutomation();
