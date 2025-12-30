const mongoose = require('mongoose');
const User = require('./models/User');
const Plan = require('./models/Plan');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findById('69491ecca5fda0f50c83b31b').populate('plan');

        console.log('User Status:', user.status);
        console.log('Plan:', user.plan ? user.plan.name : 'No Plan');
        console.log('Resource Allocation:', JSON.stringify(user.resourceAllocation, null, 2));
        console.log('Allocated Resources:', JSON.stringify(user.allocatedResources, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
