// Quick test - just check if URL works
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function quickTest() {
    const ssh = new NodeSSH();

    try {
        console.log('🧪 Quick URL Test...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected\n');

        // Test the URL
        console.log('Testing: http://localhost/uzairarif11-trello-clone');
        const test = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost/uzairarif11-trello-clone');
        console.log(`HTTP Status: ${test.stdout}\n`);

        if (test.stdout === '200') {
            console.log('✅ SUCCESS! URL is working!\n');
            console.log('🌐 Access your app at:');
            console.log('   http://foodpanda.site/uzairarif11-trello-clone');
            console.log('   http://129.154.255.90/uzairarif11-trello-clone');
        } else if (test.stdout === '502') {
            console.log('⚠️  502 Bad Gateway');
            console.log('Container is not responding. Checking...\n');

            const ps = await ssh.execCommand('docker ps | grep 4618');
            console.log('Container status:');
            console.log(ps.stdout || 'Not found');
        } else {
            console.log(`⚠️  HTTP ${test.stdout}`);
        }

        ssh.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

quickTest();
