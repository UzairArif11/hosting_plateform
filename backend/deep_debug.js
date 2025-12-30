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

        const containerName = 'EC3-user-69491ecca5fda0f50c83b31b';

        console.log('--- PM2 Status ---');
        const pm2 = await ssh.execCommand(`docker exec ${containerName} pm2 list`);
        console.log(pm2.stdout);

        console.log('\n--- PM2 Logs (Combined) ---');
        const logs = await ssh.execCommand(`docker exec ${containerName} pm2 logs --lines 20 --no-daemon`);
        console.log(logs.stdout);

        console.log('\n--- Listening Ports in Container ---');
        const netstat = await ssh.execCommand(`docker exec ${containerName} netstat -tulpn`);
        console.log(netstat.stdout);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
