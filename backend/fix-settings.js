const mongoose = require('mongoose');
require('dotenv').config();
const Settings = require('./models/Settings');

async function fixSettings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const settings = await Settings.getSettings();
        settings.serverDomains.EC3 = 'ec3.foodpanda.site';
        await settings.save();

        console.log('✅ Updated EC3 domain to:', settings.serverDomains.EC3);
        console.log('✅ Current Settings:', JSON.stringify(settings.serverDomains, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating settings:', error);
        process.exit(1);
    }
}

fixSettings();
