// Debug route to test OAuth configuration
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Debug endpoint to check OAuth config
router.get('/debug/oauth-config', (req, res) => {
  const config = {
    hasGitHubClientId: !!process.env.GITHUB_CLIENT_ID,
    hasGitHubSecret: !!process.env.GITHUB_CLIENT_SECRET,
    apiUrl: process.env.API_URL,
    frontendUrl: process.env.FRONTEND_URL,
    nodeEnv: process.env.NODE_ENV,
    callbackUrl: `${process.env.API_URL || 'http://localhost:5000'}/api/auth/github/callback`,
    jwtSecret: process.env.JWT_SECRET ? 'SET' : 'MISSING',
    isProduction: process.env.NODE_ENV === 'production',
    isHTTPS: process.env.FRONTEND_URL?.startsWith('https://')
  };

  logger.info('OAuth Debug Config', config);
  res.json(config);
});

module.exports = router;

