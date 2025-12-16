// Test SSH connections to EC2 and EC3
require('dotenv').config();
const { testSSHConnection } = require('./services/remoteBuild');

async function testConnections() {
    console.log('🔐 Testing SSH Connections...\n');

    // Test EC2
    console.log('📡 Testing EC2 (140.238.229.147)...');
    const ec2Result = await testSSHConnection('140.238.229.147', 'EC2');

    if (ec2Result.success) {
        console.log('✅ EC2 Connection successful!');
        console.log('  Docker:', ec2Result.dockerVersion);
        console.log('  Disk:', ec2Result.diskSpace.split('\n')[1]);
    } else {
        console.log('❌ EC2 Connection failed:', ec2Result.error);
    }

    console.log('');

    // Test EC3
    console.log('📡 Testing EC3 (129.154.255.90)...');
    const ec3Result = await testSSHConnection('129.154.255.90', 'EC3');

    if (ec3Result.success) {
        console.log('✅ EC3 Connection successful!');
        console.log('  Docker:', ec3Result.dockerVersion);
        console.log('  Disk:', ec3Result.diskSpace.split('\n')[1]);
    } else {
        console.log('❌ EC3 Connection failed:', ec3Result.error);
    }

    console.log('\n✅ SSH test complete!');
    process.exit(0);
}

testConnections();
