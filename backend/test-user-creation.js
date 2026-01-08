// Test user creation with the same data structure as OAuth
const mongoose = require('mongoose');
const User = require('./models/User');
const Plan = require('./models/Plan');
require('dotenv').config();

async function testUserCreation() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin');
    console.log('✅ Connected\n');

    // Get default plan
    console.log('Looking up default plan...');
    const defaultPlan = await Plan.findTrialPlan();
    console.log('Plan found:', !!defaultPlan);
    if (defaultPlan) {
      console.log('Plan ID:', defaultPlan._id.toString());
      console.log('Plan Resources:', defaultPlan.resources);
    }
    console.log('');

    // Test user data (matching OAuth flow)
    const testData = {
      githubId: 'test_' + Date.now(),
      username: 'testuser_' + Date.now(),
      email: `test_${Date.now()}@github.com`,
      displayName: 'Test User',
      avatar: '',
      profileUrl: '',
      githubAccessToken: 'test_token_' + Date.now(),
      provider: 'github',
      plan: defaultPlan?._id || null,
      planType: 'free',
      status: 'trial',
      subscriptionStatus: 'trial',
      isTrialActive: true,
      trialStarted: new Date(),
      trialExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };

    console.log('Test User Data:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('');

    // Create user instance
    console.log('Creating User instance...');
    const newUser = new User(testData);

    // Set resource allocation
    if (defaultPlan && defaultPlan.resources) {
      console.log('Setting resource allocation...');
      newUser.resourceAllocation = { ...defaultPlan.resources };
      console.log('Resource allocation:', newUser.resourceAllocation);
    }

    // Validate before save
    console.log('\nValidating before save...');
    const validationError = newUser.validateSync();
    if (validationError) {
      console.log('❌ Validation Errors:');
      Object.entries(validationError.errors).forEach(([key, err]) => {
        console.log(`  ${key}:`, err.message);
      });
      await mongoose.disconnect();
      return;
    }
    console.log('✅ Validation passed\n');

    // Try to save
    console.log('Attempting to save...');
    const savedUser = await newUser.save();
    console.log('✅ User saved successfully!');
    console.log('User ID:', savedUser._id.toString());
    console.log('Username:', savedUser.username);

    // Clean up test user
    console.log('\nCleaning up test user...');
    await User.findByIdAndDelete(savedUser._id);
    console.log('✅ Test user deleted');

    await mongoose.disconnect();
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    
    if (error.name === 'ValidationError' && error.errors) {
      console.error('\nValidation Errors:');
      Object.entries(error.errors).forEach(([key, err]) => {
        console.error(`  ${key}:`, {
          message: err.message,
          value: err.value,
          kind: err.kind
        });
      });
    }

    if (error.name === 'MongoServerError') {
      console.error('\nMongoDB Error:');
      console.error('Code:', error.code);
      console.error('Code Name:', error.codeName);
      console.error('Error Message:', error.errmsg || error.message);
      
      if (error.errorInfo) {
        console.error('Error Info:', JSON.stringify(error.errorInfo, null, 2));
      }
    }

    console.error('\nStack:', error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testUserCreation();
