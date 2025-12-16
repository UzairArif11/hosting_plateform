// Deploy the built Docker image to EC3
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function deployBuiltImage() {
    const ssh = new NodeSSH();

    try {
        console.log('🚀 Deploying built image to EC3...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected to EC3\n');

        // Find the latest built image
        console.log('🔍 Finding latest image...');
        const imagesResult = await ssh.execCommand('docker images --format "{{.Repository}}" | grep uzairarif11-trello-clone | head -1');
        const imageName = imagesResult.stdout.trim();

        if (!imageName) {
            console.log('❌ No built image found!');
            ssh.dispose();
            return;
        }

        console.log(`✅ Found image: ${imageName}\n`);

        // Stop and remove old container
        console.log('🛑 Stopping old container...');
        await ssh.execCommand('docker stop EC3-shared-user-uzairtesta-1764745224276 2>/dev/null || true');
        await ssh.execCommand('docker rm EC3-shared-user-uzairtesta-1764745224276 2>/dev/null || true');
        console.log('✅ Old container removed\n');

        // Start new container from built image
        console.log('🚀 Starting container from built image...');
        const runCommand = `docker run -d --name EC3-shared-user-uzairtesta-1764745224276 -p 4372:80 ${imageName}`;
        const runResult = await ssh.execCommand(runCommand);

        if (runResult.code !== 0) {
            console.log('❌ Failed to start container:', runResult.stderr);
            ssh.dispose();
            return;
        }

        console.log('✅ Container started!\n');

        // Wait a moment for container to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if it's running
        console.log('🔍 Checking container status...');
        const psResult = await ssh.execCommand('docker ps | grep EC3-shared-user-uzairtesta');
        console.log(psResult.stdout);

        // Test the endpoint
        console.log('\n🌐 Testing endpoint...');
        const curlResult = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost:4372');
        const statusCode = curlResult.stdout.trim();

        if (statusCode === '200') {
            console.log('✅ App is responding!\n');
            console.log('🎉 SUCCESS! Your app is now live at:');
            console.log('   http://129.154.255.90:4372');
        } else {
            console.log(`⚠️  Got HTTP ${statusCode}\n`);
            console.log('📝 Container logs:');
            const logsResult = await ssh.execCommand('docker logs EC3-shared-user-uzairtesta-1764745224276 2>&1 | tail -20');
            console.log(logsResult.stdout);
        }

        ssh.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

deployBuiltImage();
