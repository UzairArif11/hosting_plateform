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

        const containerName = 'EC3-user-69491ecca5fda0f50c83b31b';
        console.log(`--- Inspecting Container: ${containerName} ---`);

        const inspect = await ssh.execCommand(`docker inspect ${containerName}`);
        const data = JSON.parse(inspect.stdout)[0];

        console.log('Network Mode:', data.HostConfig.NetworkMode);
        console.log('Port Bindings:', JSON.stringify(data.HostConfig.PortBindings, null, 2));

        console.log('\n--- Checking Listening Ports INSIDE Container ---');
        const internalNetstat = await ssh.execCommand(`docker exec ${containerName} netstat -tulpn`);
        console.log(internalNetstat.stdout || 'No ports listening inside.');

        console.log('\n--- Docker Logs ---');
        const dlogs = await ssh.execCommand(`docker logs ${containerName} --tail 50`);
        console.log(dlogs.stdout);
        console.log(dlogs.stderr);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
