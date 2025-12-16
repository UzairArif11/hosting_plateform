// Test Docker connectivity to EC2 and EC3
const Docker = require('dockerode');
require('dotenv').config();

const servers = {
    EC2: process.env.EC2_SERVER_IP,
    EC3: process.env.EC3_SERVER_IP
};

async function testDockerConnection(name, host) {
    console.log(`\n🔍 Testing ${name} (${host})...`);

    try {
        const docker = new Docker({
            host: host,
            port: 2376,
            protocol: 'http'
        });

        console.log(`  ⏳ Connecting to http://${host}:2376...`);

        const info = await docker.info();
        console.log(`  ✅ SUCCESS! Docker is running`);
        console.log(`  📊 Info:`, {
            containers: info.Containers,
            images: info.Images,
            serverVersion: info.ServerVersion,
            osType: info.OSType
        });

        return true;
    } catch (error) {
        console.log(`  ❌ FAILED!`);
        console.log(`  Error: ${error.message}`);
        console.log(`  Code: ${error.code}`);

        if (error.code === 'ECONNREFUSED') {
            console.log(`  💡 Docker API is not accessible on port 2376`);
            console.log(`  💡 Make sure Docker is configured to listen on TCP`);
        } else if (error.code === 'ETIMEDOUT') {
            console.log(`  💡 Connection timed out - check firewall rules`);
        }

        return false;
    }
}

async function main() {
    console.log('🚀 Docker Connectivity Test\n');
    console.log('Environment:');
    console.log('  EC2_SERVER_IP:', process.env.EC2_SERVER_IP);
    console.log('  EC3_SERVER_IP:', process.env.EC3_SERVER_IP);

    for (const [name, host] of Object.entries(servers)) {
        await testDockerConnection(name, host);
    }

    console.log('\n✅ Test complete!');
    process.exit(0);
}

main();
