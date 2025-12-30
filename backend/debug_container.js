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

        console.log('--- Inspect ---');
        const inspect = await ssh.execCommand(`docker inspect ${containerName}`);
        console.log(inspect.stdout);

        console.log('\n--- Logs ---');
        const logs = await ssh.execCommand(`docker logs ${containerName} --tail 50`);
        console.log(logs.stdout);
        console.log(logs.stderr);

        console.log('\n--- PM2 List ---');
        const pm2 = await ssh.execCommand(`docker exec ${containerName} pm2 list`);
        console.log(pm2.stdout);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
