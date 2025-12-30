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

        console.log('--- Netstat on Host ---');
        const netstat = await ssh.execCommand('sudo netstat -tulpn | grep 7243');
        console.log(netstat.stdout || 'Port 7243 NOT LISTENING');

        console.log('\n--- PM2 List in Container ---');
        const pm2 = await ssh.execCommand('docker exec EC3-user-69491ecca5fda0f50c83b31b pm2 list');
        console.log(pm2.stdout);

        console.log('\n--- Project Directory Contents ---');
        const ls = await ssh.execCommand('docker exec EC3-user-69491ecca5fda0f50c83b31b ls -la /app/projects/694d13fe5fc00e1ba607376e');
        console.log(ls.stdout);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
