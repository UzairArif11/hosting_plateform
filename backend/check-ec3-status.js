// Check what's actually running on EC3
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function checkEC3() {
    const ssh = new NodeSSH();

    try {
        console.log('🔍 Connecting to EC3...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected!\n');

        // Check running containers
        console.log('📋 Running containers:\n');
        const psResult = await ssh.execCommand('docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"');
        console.log(psResult.stdout || 'No containers running');

        console.log('\n📦 All containers:\n');
        const allResult = await ssh.execCommand('docker ps -a --format "table {{.Names}}\t{{.Status}}"');
        console.log(allResult.stdout);

        console.log('\n🖼️  Docker images:\n');
        const imagesResult = await ssh.execCommand('docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"');
        console.log(imagesResult.stdout);

        console.log('\n🔌 Port 4372 status:\n');
        const portResult = await ssh.execCommand('netstat -tuln | grep 4372 || echo "Port 4372 not in use"');
        console.log(portResult.stdout);

        console.log('\n📝 Container logs (if exists):\n');
        const logsResult = await ssh.execCommand('docker logs EC3-shared-user-uzairtesta-1764745224276 2>&1 | tail -20');
        console.log(logsResult.stdout || logsResult.stderr || 'No logs');

        ssh.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

checkEC3();
