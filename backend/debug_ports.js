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

        console.log('--- Host Ports (Listening) ---');
        const netstat = await ssh.execCommand('sudo netstat -tulpn | grep LISTEN');
        console.log(netstat.stdout);

        console.log('\n--- PM2 List in Container ---');
        const pm2 = await ssh.execCommand(`docker exec ${containerName} pm2 list`);
        console.log(pm2.stdout);

        console.log('\n--- PM2 Dump Check ---');
        const dump = await ssh.execCommand(`docker exec ${containerName} ls -l /root/.pm2/dump.pm2`);
        console.log(dump.stdout || dump.stderr);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
