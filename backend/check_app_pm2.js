const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function check() {
    const ssh = new NodeSSH();
    try {
        await ssh.connect({
            host: process.env.EC3_HOST || process.env.EC3_SERVER_IP,
            username: process.env.SSH_USERNAME || 'ubuntu',
            privateKey: fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8')
        });

        const container = 'EC3-user-69491ecca5fda0f50c83b31b';
        console.log('Container Status:');
        const status = await ssh.execCommand(`docker ps -a --filter name=${container}`);
        console.log(status.stdout);

        console.log('\nPM2 Describe Project:');
        const desc = await ssh.execCommand(`docker exec ${container} pm2 describe 694d13fe5fc00e1ba607376e`);
        console.log(desc.stdout || desc.stderr);

        console.log('\nPM2 List:');
        const list = await ssh.execCommand(`docker exec ${container} pm2 list`);
        console.log(list.stdout);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
