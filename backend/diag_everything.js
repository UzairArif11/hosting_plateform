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

        console.log('--- All Containers ---');
        const ps = await ssh.execCommand('docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
        console.log(ps.stdout);

        const targetUser = '69491ecca5fda0f50c83b31b';
        // Find container for this user
        const containerLine = ps.stdout.split('\n').find(l => l.includes(targetUser));
        if (containerLine) {
            const containerName = containerLine.split(/\s+/)[0];
            console.log(`\n--- Inspecting Container: ${containerName} ---`);

            console.log('\nPM2 List:');
            const list = await ssh.execCommand(`docker exec ${containerName} pm2 list`);
            console.log(list.stdout);

            console.log('\nPM2 Status (JSON):');
            const jlist = await ssh.execCommand(`docker exec ${containerName} pm2 jlist`);
            console.log(jlist.stdout);

            console.log('\nNginx Config for this user:');
            const nginx = await ssh.execCommand('sudo cat /etc/nginx/sites-available/default');
            const userBlocks = nginx.stdout.split('\n').filter(l => l.includes(targetUser) || l.includes('ss-694d3a39')).join('\n');
            console.log(userBlocks);
        } else {
            console.log(`\nNo container found for user ${targetUser}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
