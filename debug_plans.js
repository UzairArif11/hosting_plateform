const mongoose = require('mongoose');
const User = require('./backend/models/User');
const Plan = require('./backend/models/Plan');
require('dotenv').config({ path: './backend/.env' });

async function debugPlans() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        console.log('\n=== PLANS ===');
        const plans = await Plan.find({});
        plans.forEach(p => {
            console.log(`Plan: ${p.name} (Display: ${p.displayName}) ID: ${p._id}`);
            console.log(`  Features (${p.features.length}):`);
            p.features.forEach(f => {
                console.log(`    - ${f.name}: enabled=${f.enabled}, desc="${f.description}"`);
            });
            console.log('----------------');
        });

        console.log('\n=== USERS ===');
        const users = await User.find({}).populate('plan');
        users.forEach(u => {
            console.log(`User: ${u.email}`);
            console.log(`  Plan: ${u.plan?.name || u.planType} (ID: ${u.plan?._id})`);
            if (u.plan) {
                console.log(`  Plan Features Count: ${u.plan.features.length}`);
            }
            console.log('----------------');
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debugPlans();
