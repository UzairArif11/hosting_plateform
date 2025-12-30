const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function check() {
    const ssh = new NodeSSH();
    try {
        const host = process.env.EC3_HOST || process.env.EC3_SERVER_IP;
        const keyPath = process.env.SSH_EC3_KEY;
        const keyContent = fs.readFileSync(keyPath, 'utf8');

        await ssh.connect({
            host: host,
            username: process.env.SSH_USERNAME || 'ubuntu',
            privateKey: keyContent
        });

        const res = await ssh.execCommand('docker exec EC3-user-69491ecca5fda0f50c83b31b ls -R /app/projects');
        console.log(res.stdout);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
