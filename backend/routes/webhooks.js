const express = require('express');
const githubService = require('../services/github');
const payoneerService = require('../services/payoneer');
const logger = require('../utils/logger');

const router = express.Router();

// GitHub webhook handler
router.post('/github', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const eventType = req.headers['x-github-event'];
    const payload = req.body;

    // Verify webhook signature
    const isValid = githubService.verifyWebhookSignature(
      JSON.stringify(payload),
      signature
    );

    if (!isValid) {
      logger.security('Invalid GitHub webhook signature', {
        eventType,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    logger.info('GitHub webhook received', {
      eventType,
      repository: payload.repository?.full_name,
      action: payload.action
    });

    // Handle the webhook event
    const result = await githubService.handleWebhookEvent(eventType, payload);

    if (result.success) {
      res.json({
        success: true,
        message: 'Webhook processed successfully',
        ...result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to process webhook'
      });
    }
  } catch (error) {
    logger.error('GitHub webhook error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal webhook processing error'
    });
  }
});

// Payoneer webhook handler
router.post('/payoneer', async (req, res) => {
  try {
    const signature = req.headers['payoneer-signature'];
    const payload = req.body;
    const rawBody = JSON.stringify(payload);

    // Verify webhook signature
    const isValid = payoneerService.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      logger.security('Invalid Payoneer webhook signature', {
        eventType: payload.type,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    logger.billing('Payoneer webhook received', {
      eventType: payload.type,
      eventId: payload.id,
      resourceId: payload.data?.id
    });

    // Handle the webhook event
    const result = await payoneerService.handleWebhook(payload);

    if (result.success) {
      res.json({
        success: true,
        message: 'Webhook processed successfully',
        handled: result.handled
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to process webhook'
      });
    }
  } catch (error) {
    logger.error('Payoneer webhook error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal webhook processing error'
    });
  }
});

// Generic webhook verification endpoint
router.get('/verify/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { challenge } = req.query;

    logger.info('Webhook verification request', {
      provider,
      challenge: challenge ? 'provided' : 'missing',
      ip: req.ip
    });

    switch (provider) {
      case 'github':
        // GitHub doesn't typically use challenge verification
        res.json({
          success: true,
          message: 'GitHub webhook endpoint verified'
        });
        break;

      case 'payoneer':
        // Return challenge if provided (some webhook services use this pattern)
        if (challenge) {
          res.json({
            success: true,
            challenge: challenge
          });
        } else {
          res.json({
            success: true,
            message: 'Payoneer webhook endpoint verified'
          });
        }
        break;

      default:
        res.status(404).json({
          success: false,
          error: 'Unknown webhook provider'
        });
    }
  } catch (error) {
    logger.error('Webhook verification error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
});

// Test webhook endpoint (for development)
router.post('/test/:provider', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({
      success: false,
      error: 'Test endpoint not available in production'
    });
  }

  try {
    const { provider } = req.params;
    const payload = req.body;

    logger.info('Test webhook received', {
      provider,
      payload: JSON.stringify(payload).substring(0, 200) + '...'
    });

    let result;

    switch (provider) {
      case 'github':
        result = await githubService.handleWebhookEvent('push', payload);
        break;

      case 'payoneer':
        result = await payoneerService.handleWebhook(payload);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown provider for test webhook'
        });
    }

    res.json({
      success: true,
      message: `Test ${provider} webhook processed`,
      result
    });
  } catch (error) {
    logger.error('Test webhook error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Test webhook failed'
    });
  }
});

// Webhook health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook service is healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      github: '/api/webhooks/github',
      payoneer: '/api/webhooks/payoneer'
    }
  });
});

module.exports = router;
