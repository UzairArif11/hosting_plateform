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

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const deploymentRoutes = require('./routes/deployments');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhooks');

// Import middleware
const authMiddleware = require('./middleware/auth');
const adminMiddleware = require('./middleware/admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Global middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel-clone'
  }),
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

// Connect to MongoDB
connectDB();

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  
  socket.on('join-deployment-room', (deploymentId) => {
    socket.join(`deployment-${deploymentId}`);
    logger.info(`Socket ${socket.id} joined deployment room: ${deploymentId}`);
  });

  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    logger.info(`Socket ${socket.id} joined user room: ${userId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/deployments', authMiddleware, deploymentRoutes);
app.use('/api/billing', authMiddleware, billingRoutes);
app.use('/api/admin', authMiddleware, adminMiddleware, adminRoutes);
app.use('/api/webhooks', webhookRoutes);

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

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start resource monitoring for shared containers
  monitoringInterval = containerOrchestrator.startResourceMonitoring(60000); // Check every minute
  logger.info(`📊 Resource monitoring active for shared containers`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  
  // Stop resource monitoring
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    logger.info('Resource monitoring stopped');
  }
  
  server.close(() => {
    logger.info('Process terminated');
  });
});

module.exports = { app, io };
