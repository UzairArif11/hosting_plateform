// Test the deployed app
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function testApp() {
    const ssh = new NodeSSH();

    try {
        console.log('🧪 Testing deployed app...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected to EC3\n');

        // Find running container
        console.log('🔍 Finding running container...');
        const psResult = await ssh.execCommand('docker ps --format "{{.Names}}\t{{.Ports}}" | grep uzairtesta');
        console.log(psResult.stdout);

        const lines = psResult.stdout.trim().split('\n');
        const lastContainer = lines[lines.length - 1];
        const portMatch = lastContainer.match(/0\.0\.0\.0:(\d+)/);

        if (!portMatch) {
            console.log('❌ Could not find port');
            ssh.dispose();
            return;
        }

        const port = portMatch[1];
        console.log(`\n✅ Found container on port: ${port}\n`);

        // Test HTTP
        console.log('🌐 Testing HTTP response...');
        const curlResult = await ssh.execCommand(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`);
        const statusCode = curlResult.stdout.trim();

        console.log(`HTTP Status: ${statusCode}`);

        if (statusCode === '200') {
            console.log('✅ App is responding!\n');

            // Get actual content
            console.log('📄 Fetching content...');
            const contentResult = await ssh.execCommand(`curl -s http://localhost:${port} | head -20`);
            console.log(contentResult.stdout);

            console.log('\n🎉 SUCCESS!');
            console.log(`\n🌐 Your app is live at:`);
            console.log(`   http://129.154.255.90:${port}`);
            console.log(`\n💡 Try opening this in your browser!`);
        } else {
            console.log(`⚠️  Got HTTP ${statusCode}`);
        }

        ssh.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

testApp();
