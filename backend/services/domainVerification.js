const dns = require('dns').promises;
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Generate a unique verification token for domain ownership proof
 * @returns {string} The verification token (e.g. vcp-verification=xyz...)
 */
const generateVerificationToken = () => {
    const randomString = crypto.randomBytes(16).toString('hex');
    return `vcp-verification=${randomString}`;
};

/**
 * Verify if the domain has the required TXT record
 * @param {string} domain - The domain to verify (e.g. example.com)
 * @param {string} token - The expected verification token
 * @returns {Promise<boolean>} - True if verified, false otherwise
 */
const verifyDnsRecord = async (domain, token) => {
    try {
        // We check for a TXT record on _vercel-challenge.domain.com OR just domain.com
        // Common pattern is _platform-challenge or similar.
        // Let's support checking the root domain TXT records first for simplicity, 
        // or a specific subdomain like _vcp-challenge.${domain}

        const challengeDomain = `_vcp-challenge.${domain}`;

        logger.info(`Verifying DNS for ${domain} looking for ${token} at ${challengeDomain} and root`);

        // Check specific challenge subdomain first (preferred)
        try {
            const records = await dns.resolveTxt(challengeDomain);
            const flatRecords = records.flat();
            if (flatRecords.includes(token)) {
                return true;
            }
        } catch (e) {
            // Ignore error if subdomain doesn't exist, try root
        }

        // Fallback: Check root domain TXT records
        try {
            const rootRecords = await dns.resolveTxt(domain);
            const flatRootRecords = rootRecords.flat();
            if (flatRootRecords.includes(token)) {
                return true;
            }
        } catch (e) {
            // Ignore
        }

        return false;
    } catch (error) {
        logger.error(`DNS Verification failed for ${domain}:`, error.message);
        return false;
    }
};

/**
 * Check if the domain A record points to our server IP
 * @param {string} domain 
 * @param {string} expectedIp 
 * @returns {Promise<boolean>}
 */
const checkARecord = async (domain, expectedIp = process.env.EC2_SERVER_IP) => {
    try {
        if (!expectedIp) return true; // Skip check if we don't know our IP

        const addresses = await dns.resolve4(domain);
        return addresses.includes(expectedIp);
    } catch (error) {
        logger.warn(`Failed to resolve A record for ${domain}: ${error.message}`);
        return false;
    }
};

module.exports = {
    generateVerificationToken,
    verifyDnsRecord,
    checkARecord
};
