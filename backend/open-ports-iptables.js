// Try to open ports using iptables
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function openPortsIPTables() {
    const ssh = new NodeSSH();

    try {
        console.log('🔧 Opening ports on EC3 using iptables...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected!\n');

        // Open port 4372
        console.log('🔓 Opening port 4372...');
        const port4372 = await ssh.execCommand('sudo iptables -I INPUT -p tcp --dport 4372 -j ACCEPT');
        console.log(port4372.stdout || 'Done');

        // Open port range 4000-5000
        console.log('🔓 Opening port range 4000-5000...');
        const portRange = await ssh.execCommand('sudo iptables -I INPUT -p tcp --dport 4000:5000 -j ACCEPT');
        console.log(portRange.stdout || 'Done');

        // List current rules
        console.log('\n📋 Current iptables rules:');
        const listRules = await ssh.execCommand('sudo iptables -L INPUT -n --line-numbers | head -20');
        console.log(listRules.stdout);

        console.log('\n✅ iptables rules added!');
        console.log('\n⚠️  NOTE: These rules are temporary!');
        console.log('They will be lost on reboot unless you also:');
        console.log('1. Open ports in Oracle Cloud Security List');
        console.log('2. Or save iptables rules permanently');

        console.log('\n🧪 Testing access...');
        const testResult = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost:4372');
        console.log(`Local test: HTTP ${testResult.stdout}`);

        console.log('\n💡 Try accessing now:');
        console.log('   http://129.154.255.90:4372');

        ssh.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

openPortsIPTables();
