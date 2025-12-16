// Check nginx error
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function checkNginxError() {
    const ssh = new NodeSSH();

    try {
        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('📋 Nginx error log:\n');
        const errorLog = await ssh.execCommand('sudo tail -20 /var/log/nginx/error.log');
        console.log(errorLog.stdout);

        console.log('\n📄 Nginx config:\n');
        const config = await ssh.execCommand('cat /etc/nginx/sites-available/default');
        console.log(config.stdout);

        ssh.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

checkNginxError();
