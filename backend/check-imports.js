const authMiddleware = require('./middleware/auth');
const adminMiddleware = require('./middleware/admin');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const deploymentRoutes = require('./routes/deployments');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhooks');

console.log('authMiddleware:', typeof authMiddleware);
console.log('adminMiddleware:', typeof adminMiddleware);
console.log('authRoutes:', typeof authRoutes);
console.log('projectRoutes:', typeof projectRoutes);
console.log('deploymentRoutes:', typeof deploymentRoutes);
console.log('billingRoutes:', typeof billingRoutes);
console.log('adminRoutes:', typeof adminRoutes);
console.log('webhookRoutes:', typeof webhookRoutes);
