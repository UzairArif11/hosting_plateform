// Debug Nginx configuration
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function debugNginx() {
    const ssh = new NodeSSH();

    try {
        console.log('🔍 Debugging Nginx configuration...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected to EC3\n');

        // Check current Nginx config
        console.log('📄 Current Nginx config:');
        const configResult = await ssh.execCommand('cat /etc/nginx/sites-available/default');
        console.log(configResult.stdout);
        console.log('\n' + '='.repeat(80) + '\n');

        // Test Nginx config
        console.log('🧪 Testing Nginx config:');
        const testResult = await ssh.execCommand('sudo nginx -t 2>&1');
        console.log(testResult.stdout);
        console.log('Exit code:', testResult.code);
        console.log('\n' + '='.repeat(80) + '\n');

        // Check Nginx status
        console.log('📊 Nginx status:');
        const statusResult = await ssh.execCommand('sudo systemctl status nginx | head -15');
        console.log(statusResult.stdout);

        ssh.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

debugNginx();
