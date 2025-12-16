// Verify .env configuration
require('dotenv').config();
const fs = require('fs');

console.log('🔍 Checking .env Configuration...\n');

const checks = [
    { name: 'SSH_EC2_KEY', value: process.env.SSH_EC2_KEY, required: true },
    { name: 'SSH_EC3_KEY', value: process.env.SSH_EC3_KEY, required: true },
    { name: 'SSH_USERNAME', value: process.env.SSH_USERNAME, required: true },
    { name: 'BASE_DOMAIN', value: process.env.BASE_DOMAIN, required: true },
    { name: 'MONGODB_URI', value: process.env.MONGODB_URI, required: true },
    { name: 'EC2_SERVER_IP', value: process.env.EC2_SERVER_IP, required: true },
    { name: 'EC3_SERVER_IP', value: process.env.EC3_SERVER_IP, required: true },
];

let allGood = true;

checks.forEach(check => {
    if (!check.value && check.required) {
        console.log(`❌ ${check.name} - NOT SET`);
        allGood = false;
    } else {
        console.log(`✅ ${check.name} - ${check.value}`);

        // Check if SSH key files exist
        if (check.name.includes('SSH_') && check.name.includes('_KEY')) {
            if (fs.existsSync(check.value)) {
                console.log(`   ✓ File exists`);
            } else {
                console.log(`   ❌ File NOT found at: ${check.value}`);
                allGood = false;
            }
        }
    }
});

console.log('\n' + '='.repeat(50));

if (allGood) {
    console.log('✅ All configuration looks good!');
    console.log('\nNext step: Run SSH test');
    console.log('  node test-ssh-connections.js');
} else {
    console.log('❌ Some configuration is missing!');
    console.log('\nPlease add missing variables to backend/.env');
    console.log('See .env.example for reference');
}

console.log('='.repeat(50) + '\n');
