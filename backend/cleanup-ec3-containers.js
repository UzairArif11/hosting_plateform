// Clean up old containers on EC3
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function cleanupEC3() {
    const ssh = new NodeSSH();

    try {
        console.log('🔧 Connecting to EC3...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected!\n');

        // List all containers
        console.log('📋 Current containers:\n');
        const listResult = await ssh.execCommand('docker ps -a');
        console.log(listResult.stdout);

        console.log('\n🧹 Cleaning up old containers...\n');

        // Stop all containers
        const stopResult = await ssh.execCommand('docker stop $(docker ps -aq) 2>/dev/null || true');
        console.log('Stopped containers');

        // Remove all containers
        const removeResult = await ssh.execCommand('docker rm $(docker ps -aq) 2>/dev/null || true');
        console.log('Removed containers');

        // List containers again
        console.log('\n📋 Containers after cleanup:\n');
        const listResult2 = await ssh.execCommand('docker ps -a');
        console.log(listResult2.stdout || 'No containers');

        // Show available ports
        console.log('\n🔌 Checking port usage:\n');
        const portsResult = await ssh.execCommand('netstat -tuln | grep LISTEN | grep -E ":(4[0-9]{3}|3[0-9]{3})" || echo "No ports in use"');
        console.log(portsResult.stdout);

        ssh.dispose();

        console.log('\n✅ Cleanup complete!');
        console.log('\nYou can now deploy again.');

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

cleanupEC3();
