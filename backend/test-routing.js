// Test nginx routing with a mock deployment
const nginxRouter = require('./services/nginxRouter');
require('dotenv').config();

async function testRouting() {
    console.log('🧪 Testing Nginx Routing...\n');

    // Simulate a deployment
    const projectName = 'UzairArif11/Trello-Clone';
    const port = 4618; // Use existing container port
    const serverHost = '129.154.255.90';
    const serverKey = 'EC3';

    console.log('📋 Test Parameters:');
    console.log(`  Project: ${projectName}`);
    console.log(`  Port: ${port}`);
    console.log(`  Server: ${serverHost}`);
    console.log('');

    // Update nginx routing
    console.log('🔧 Updating Nginx routing...\n');
    const result = await nginxRouter.updateNginxRouting(
        projectName,
        port,
        serverHost,
        serverKey
    );

    console.log('📊 Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    if (result.success) {
        console.log('✅ Nginx routing updated successfully!\n');

        // Test the URL via SSH
        const { NodeSSH } = require('node-ssh');
        const fs = require('fs');
        const ssh = new NodeSSH();

        try {
            const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

            await ssh.connect({
                host: serverHost,
                username: 'ubuntu',
                privateKey: keyContent
            });

            console.log('🧪 Testing URL...\n');

            // Test the URL path
            const urlPath = result.urlPath;
            const testUrl = `http://localhost/${urlPath}`;

            console.log(`Testing: ${testUrl}`);
            const testResult = await ssh.execCommand(`curl -s -o /dev/null -w "%{http_code}" ${testUrl}`);
            console.log(`HTTP Status: ${testResult.stdout}\n`);

            if (testResult.stdout === '200') {
                console.log('✅ URL is working!\n');

                // Get first few lines of content
                console.log('📄 Content preview:');
                const contentResult = await ssh.execCommand(`curl -s ${testUrl} | head -10`);
                console.log(contentResult.stdout);
                console.log('');
            } else if (testResult.stdout === '502') {
                console.log('⚠️  502 Bad Gateway - Container might not be running on port ' + port);
            } else if (testResult.stdout === '500') {
                console.log('⚠️  500 Internal Server Error - Nginx config issue');
            } else {
                console.log(`⚠️  Got HTTP ${testResult.stdout}`);
            }

            // Check nginx config
            console.log('📋 Nginx config (last 30 lines):');
            const configResult = await ssh.execCommand('tail -30 /etc/nginx/sites-available/default');
            console.log(configResult.stdout);

            ssh.dispose();

            console.log('\n🌐 Public URL:');
            console.log(`   ${result.url}`);
            console.log('\n💡 Test in browser:');
            console.log(`   http://foodpanda.site/${urlPath}`);

        } catch (error) {
            console.error('❌ Test error:', error.message);
            ssh.dispose();
        }

    } else {
        console.log('❌ Nginx routing failed!');
        console.log(`Error: ${result.error}`);
    }
}

testRouting().catch(console.error);
