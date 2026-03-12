require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const cookieParser = require('cookie-parser');

// Import utilities
const connectDB = require('./utils/database');
const logger = require('./utils/logger');
const sshTunnelManager = require('./services/sshTunnelManager');

// Global error handlers for debugging
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const deploymentRoutes = require('./routes/deployments');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhooks');
const settingsRoutes = require('./routes/settings');
const templateRoutes = require('./routes/templates');
const analyticsRoutes = require('./routes/analytics');
const invitationsRoutes = require('./routes/invitations');

// Import middleware
const { requireAuth } = require('./middleware/auth');
const { requireAdmin } = require('./middleware/admin');

// Import passport configuration
require('./config/passport');


// Validate critical environment variables
const requiredEnvVars = ['JWT_SECRET', 'SESSION_SECRET', 'MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error('❌ CRITICAL ERROR: Missing required environment variables:');
  missingEnvVars.forEach(key => console.error(`   - ${key}`));
  console.error('Server cannot start securely. Please add them to your .env file.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Trust proxy (required for rate limiting behind Nginx/reverse proxy)
app.set('trust proxy', 1);

// Initialize WebSocket for real-time deployment updates
const websocketService = require('./services/websocket');
websocketService.initializeWebSocket(server);

// Global middleware
app.use(helmet());
app.use(compression());
app.use(express.static('public')); // Serve static files (e.g. tracker.js)
app.use('/uploads', express.static('uploads')); // Serve payment screenshot uploads
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);


// Session configuration
// Note: Using MemoryStore for development. For production, uncomment MongoStore.
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  // store: MongoStore.create({
  //   mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel-clone',
  //   touchAfter: 24 * 3600, // lazy session update
  //   autoRemove: 'native' // Default
  // }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));





// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Cookie parsing middleware
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB and migrations are now initialized in the async IIFE at the end of this file
// (removed duplicate connectDB call that was causing crashes)

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API health check endpoint (for tests)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/deployments', requireAuth, deploymentRoutes);
app.use('/api/billing', requireAuth, billingRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
app.use('/api/settings', settingsRoutes); // Settings (public domain lookup, admin for updates)
app.use('/api/test', require('./routes/test')); // Test endpoints (no auth required)
app.use('/api/webhooks', webhookRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/invitations', invitationsRoutes);

// Audit logs routes
const auditRoutes = require('./routes/audit');
app.use('/api/audit', auditRoutes);

// User self-service routes
const userRoutes = require('./routes/user');
app.use('/api/user', userRoutes);

// Resource monitoring routes
const resourceRoutes = require('./routes/resources');
app.use('/api/resources', resourceRoutes);

// IP restrictions routes
const ipRestrictionsRoutes = require('./routes/ipRestrictions');
app.use('/api/ip-restrictions', ipRestrictionsRoutes);

// Start account lifecycle cron jobs
const { startCronJobs } = require('./cron/accountLifecycleCron');
try {
  startCronJobs();
  logger.info('✅ Account lifecycle cron jobs started');
} catch (error) {
  logger.error('Failed to start cron jobs:', error);
}

// Start exchange rate auto-update cron (every 6 hours)
const { startExchangeRateCron } = require('./cron/exchangeRateCron');
try {
  startExchangeRateCron();
  logger.info('✅ Exchange rate cron started');
} catch (error) {
  logger.error('Failed to start exchange rate cron:', error);
}

// Start resource monitoring
const resourceMonitoring = require('./services/resourceMonitoring');
setInterval(async () => {
  try {
    await resourceMonitoring.monitorResources();
  } catch (error) {
    logger.error('Resource monitoring error:', error);
  }
}, 5 * 60 * 1000); // Every 5 minutes

logger.info('✅ Resource monitoring started (every 5 minutes)');


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Import container orchestrator for resource monitoring
const containerOrchestrator = require('./services/containerOrchestrator');
let monitoringInterval = null;

// SSH Tunnel Initialization for Secure Docker API Access
async function initializeSSHTunnels() {
  console.log('\n🔒 Initializing SSH tunnels for secure Docker access...');

  const tunnels = [];

  if (process.env.EC2_SERVER_IP) {
    console.log(`   Creating EC2 tunnel: localhost:2376 → ${process.env.EC2_SERVER_IP}:2376`);
    const result = await sshTunnelManager.createTunnel('EC2', process.env.EC2_SERVER_IP, 2376, 2376);
    tunnels.push({ server: 'EC2', success: result.success });
    if (result.success) console.log('   ✅ EC2 tunnel active');
    else console.error(`   ❌ EC2 failed: ${result.error}`);
  }

  if (process.env.EC3_SERVER_IP) {
    // Check if EC3 is the same as EC1 (same server)
    const localIP = process.env.EC1_SERVER_IP;
    const isSameServer = process.env.EC3_SERVER_IP === localIP ||
      process.env.EC3_SERVER_IP === process.env.EC2_SERVER_IP ||
      !process.env.EC1_SERVER_IP; // If no EC1_SERVER_IP, assume EC3 is local

    if (isSameServer) {
      console.log(`   Skipping EC3 tunnel (same server as EC1) - using local Docker directly`);
      tunnels.push({ server: 'EC3', success: true, local: true });
    } else {
      console.log(`   Creating EC3 tunnel: localhost:2377 → ${process.env.EC3_SERVER_IP}:2376`);
      const result = await sshTunnelManager.createTunnel('EC3', process.env.EC3_SERVER_IP, 2377, 2376);
      tunnels.push({ server: 'EC3', success: result.success });
      if (result.success) console.log('   ✅ EC3 tunnel active');
      else console.error(`   ❌ EC3 failed: ${result.error}`);
    }
  }

  const successCount = tunnels.filter(t => t.success).length;
  console.log(`✅ SSH tunnels: ${successCount}/${tunnels.length} active\n`);

  if (successCount === 0 && tunnels.length > 0) {
    console.warn('⚠️  WARNING: No tunnels established! Remote Docker management unavailable.\n');
  }
}

// Start server
const PORT = process.env.PORT || 5000;

// Initialize database and tunnels before starting HTTP server
(async () => {
  try {
    await connectDB();

    // Run migrations with error handling (non-fatal)
    try {
      logger.info('Running database migrations...');
      await require('./migrations/fix-indexes')();
      logger.info('✅ Migrations completed');
    } catch (migrationError) {
      logger.error('⚠️  Migration failed (non-fatal):', migrationError?.message || String(migrationError));
      // Continue server startup even if migration fails
    }

    // Initialize SSH tunnels with error handling (non-fatal)
    try {
      await initializeSSHTunnels();
    } catch (tunnelError) {
      logger.error('⚠️  SSH tunnel initialization failed (non-fatal):', tunnelError?.message || String(tunnelError));
      logger.warn('Server will start without SSH tunnels. Remote Docker operations may fail.');
      // Continue server startup - tunnels are optional for local Docker
    }

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

      // Start resource monitoring for shared containers
      monitoringInterval = containerOrchestrator.startResourceMonitoring(60000); // Check every minute
      logger.info(`📊 Resource monitoring active for shared containers`);

      // Start alert monitoring (High Server Load)
      containerOrchestrator.startAlertMonitoring();

      // Start User Resource Enforcement (RAM/Storage Limits)
      const resourceEnforcer = require('./services/resourceEnforcer');
      resourceEnforcer.startEnforcement();
    });
  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');

  // Close SSH tunnels
  logger.info('Closing SSH tunnels...');
  await sshTunnelManager.closeAllTunnels();

  // Stop resource monitoring
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    logger.info('Resource monitoring stopped');
  }

  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  await sshTunnelManager.closeAllTunnels();
  process.exit(0);
});

module.exports = { app };
