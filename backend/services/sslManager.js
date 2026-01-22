const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const logger = require('../utils/logger');

const execAsync = promisify(exec);

class SSLManager {
    constructor() {
        this.certPath = '/etc/letsencrypt/live';
        this.certbotBin = 'certbot';
    }

    /**
     * Provision or renew SSL certificate for a domain
     * @param {string} domain - The domain to provision certificate for
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async provisionCertificate(domain) {
        try {
            logger.info(`Provisioning SSL certificate for ${domain}`);

            // Validate domain format
            if (!this.isValidDomain(domain)) {
                return {
                    success: false,
                    message: 'Invalid domain format'
                };
            }

            // Check if certificate already exists
            const exists = await this.certificateExists(domain);
            if (exists) {
                logger.info(`Certificate already exists for ${domain}, attempting renewal`);
                return await this.renewCertificate(domain);
            }

            // Obtain new certificate (webroot method for active nginx)
            const webrootPath = `/var/www/html`;
            const command = `sudo ${this.certbotBin} certonly --webroot -w ${webrootPath} -d ${domain} --non-interactive --agree-tos --email admin@${domain} --keep-until-expiring`;

            logger.info(`Executing certbot command for ${domain}`);
            const { stdout, stderr } = await execAsync(command);

            if (stderr && !stderr.includes('Congratulations')) {
                logger.error(`Certbot error for ${domain}:`, stderr);
                return {
                    success: false,
                    message: `Certificate provisioning failed: ${stderr}`
                };
            }

            logger.info(`SSL certificate provisioned successfully for ${domain}`);
            return {
                success: true,
                message: 'Certificate provisioned successfully',
                certPath: `${this.certPath}/${domain}`
            };

        } catch (error) {
            logger.error(`SSL provisioning error for ${domain}:`, error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Renew existing certificate
     * @param {string} domain
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async renewCertificate(domain) {
        try {
            const command = `sudo ${this.certbotBin} renew --cert-name ${domain} --non-interactive`;
            const { stdout } = await execAsync(command);

            logger.info(`Certificate renewed for ${domain}`);
            return {
                success: true,
                message: 'Certificate renewed successfully'
            };
        } catch (error) {
            logger.error(`Certificate renewal error for ${domain}:`, error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Check if certificate exists for domain
     * @param {string} domain
     * @returns {Promise<boolean>}
     */
    async certificateExists(domain) {
        try {
            const certDir = `${this.certPath}/${domain}`;
            await fs.access(certDir);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get certificate info
     * @param {string} domain
     * @returns {Promise<{success: boolean, data?: object}>}
     */
    async getCertificateInfo(domain) {
        try {
            const certFile = `${this.certPath}/${domain}/fullchain.pem`;
            const command = `openssl x509 -in ${certFile} -noout -dates`;
            const { stdout } = await execAsync(command);

            return {
                success: true,
                data: {
                    domain,
                    certPath: certFile,
                    info: stdout
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Validate domain format
     * @param {string} domain
     * @returns {boolean}
     */
    isValidDomain(domain) {
        const regex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
        return regex.test(domain);
    }

    /**
     * Revoke certificate
     * @param {string} domain
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async revokeCertificate(domain) {
        try {
            const command = `sudo ${this.certbotBin} revoke --cert-name ${domain} --non-interactive`;
            await execAsync(command);

            logger.info(`Certificate revoked for ${domain}`);
            return {
                success: true,
                message: 'Certificate revoked successfully'
            };
        } catch (error) {
            logger.error(`Certificate revocation error:`, error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
}

module.exports = new SSLManager();
