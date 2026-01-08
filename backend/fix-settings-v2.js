const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Extract MONGODB_URI from .env manually to avoid require issues
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const mongoUriMatch = envContent.match(/MONGODB_URI=(.+)/);
const mongoUri = mongoUriMatch ? mongoUriMatch[1].trim().replace(/['"]/g, '') : null;

if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

const SettingsSchema = new mongoose.Schema({
    serverDomains: {
        EC2: String,
        EC3: String,
        EC4: String,
        EC5: String
    }
}, { strict: false, collection: 'settings' });

const Settings = mongoose.model('Settings', SettingsSchema);

async function fixSettings() {
    try {
        console.log('Connecting to:', mongoUri);
        await mongoose.connect(mongoUri);
        console.log('Connected to DB');

        const settings = await Settings.findOne();
        if (!settings) {
            console.log('No settings found in DB');
            process.exit(0);
        }

        console.log('Current EC3 Domain:', settings.serverDomains?.EC3);

        // Ensure serverDomains exists
        if (!settings.serverDomains) settings.serverDomains = {};

        settings.serverDomains.EC3 = 'ec3.foodpanda.site';

        // Use direct update to be sure
        await Settings.updateOne({}, {
            $set: { 'serverDomains.EC3': 'ec3.foodpanda.site' }
        });

        console.log('✅ Updated EC3 domain to: ec3.foodpanda.site');

        const updated = await Settings.findOne();
        console.log('✅ Updated Settings:', JSON.stringify(updated.serverDomains, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating settings:', error);
        process.exit(1);
    }
}

fixSettings();
