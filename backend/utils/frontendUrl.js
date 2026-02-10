/**
 * Return the main platform frontend URL for redirects and CORS.
 * Never returns the deployment server (ec2/ec3/ec4/ec5) so that when
 * no token / auth fails we redirect to the main site (e.g. foodpanda.site),
 * not to ec2.foodpanda.site/setup or ec2.foodpanda.site/login.
 */
function getMainFrontendUrl() {
    const raw = (process.env.FRONTEND_URL || '').trim();
    const baseDomain = process.env.BASE_DOMAIN || 'foodpanda.site';
    const isProduction = process.env.NODE_ENV === 'production';
    const protocol = isProduction ? 'https' : 'http';

    // Deployment server hostnames (user apps live here, not the main dashboard)
    const deploymentHostPattern = /^https?:\/\/(ec2|ec3|ec4|ec5)\.[^/]+/i;
    if (raw && !deploymentHostPattern.test(raw)) {
        return raw.replace(/\/+$/, '');
    }

    // Development: default to localhost
    if (!isProduction && !raw) {
        return 'http://localhost:3000';
    }

    // Use main domain (dashboard lives here)
    return `${protocol}://${baseDomain}`;
}

module.exports = { getMainFrontendUrl };
