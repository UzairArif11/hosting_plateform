// Check and fix firewall on EC3
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function fixFirewall() {
    const ssh = new NodeSSH();

    try {
        console.log('🔧 Connecting to EC3...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected!\n');

        // Check if ufw is active
        console.log('🔍 Checking firewall status...');
        const ufwStatus = await ssh.execCommand('sudo ufw status');
        console.log(ufwStatus.stdout);
        console.log('');

        // Check if port 4372 is listening
        console.log('🔌 Checking if port 4372 is listening...');
        const netstatResult = await ssh.execCommand('sudo netstat -tuln | grep 4372');
        console.log(netstatResult.stdout || 'Port not listening');
        console.log('');

        // Check Docker port mapping
        console.log('🐳 Checking Docker port mappings...');
        const dockerPorts = await ssh.execCommand('docker ps --format "{{.Names}}\t{{.Ports}}"');
        console.log(dockerPorts.stdout);
        console.log('');

        // Try to open the port
        console.log('🔓 Opening port 4372...');
        const allowResult = await ssh.execCommand('sudo ufw allow 4372/tcp 2>&1 || echo "UFW might not be enabled"');
        console.log(allowResult.stdout);
        console.log('');

        // Also open port range for future deployments
        console.log('🔓 Opening port range 4000-5000...');
        const rangeResult = await ssh.execCommand('sudo ufw allow 4000:5000/tcp 2>&1 || echo "UFW might not be enabled"');
        console.log(rangeResult.stdout);
        console.log('');

        // Check iptables
        console.log('🔍 Checking iptables...');
        const iptablesResult = await ssh.execCommand('sudo iptables -L -n | grep 4372');
        console.log(iptablesResult.stdout || 'No iptables rules for 4372');
        console.log('');

        // Test from localhost
        console.log('🧪 Testing from localhost...');
        const curlLocal = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost:4372');
        console.log(`Local access: HTTP ${curlLocal.stdout}`);
        console.log('');

        // Test from external (if possible)
        console.log('🌐 Testing external access...');
        const curlExternal = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://129.154.255.90:4372');
        console.log(`External access: HTTP ${curlExternal.stdout}`);
        console.log('');

        console.log('✅ Firewall configuration complete!');
        console.log('\n💡 If still not accessible, check Oracle Cloud security list:');
        console.log('   1. Go to Oracle Cloud Console');
        console.log('   2. Navigate to your VCN');
        console.log('   3. Security Lists → Ingress Rules');
        console.log('   4. Add rule: Source 0.0.0.0/0, Port 4000-5000');

        ssh.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

fixFirewall();
