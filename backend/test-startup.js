// Test loading auth routes
require('dotenv').config();

console.log('✅ Step 1: dotenv loaded');

const mongoose = require('mongoose');
console.log('✅ Step 2: mongoose loaded');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel-clone')
    .then(async () => {
        console.log('✅ Step 3: MongoDB connected');

        try {
            const User = require('./models/User');
            console.log('✅ Step 4: User model loaded');

            const passport = require('./config/passport');
            console.log('✅ Step 5: Passport config loaded');

            const authRoutes = require('./routes/auth');
            console.log('✅ Step 6: Auth routes loaded');

            console.log('✅ All components loaded successfully!');
            process.exit(0);
        } catch (error) {
            console.error('❌ Loading failed:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    })
    .catch((err) => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });
