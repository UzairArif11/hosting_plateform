// Set up Nginx reverse proxy on EC3
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function setupNginx() {
    const ssh = new NodeSSH();

    try {
        console.log('🚀 Setting up Nginx reverse proxy on EC3...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected to EC3\n');

        // Install Nginx
        console.log('📦 Installing Nginx...');
        const installResult = await ssh.execCommand('sudo apt update && sudo apt install -y nginx');
        console.log('✅ Nginx installed\n');

        // Create Nginx config
        console.log('⚙️  Configuring Nginx...');

        const nginxConfig = `
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    location / {
        proxy_pass http://localhost:4372;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

        // Write config
        await ssh.execCommand(`sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOF'
${nginxConfig}
EOF`);

        console.log('✅ Nginx configured\n');

        // Test config
        console.log('🧪 Testing Nginx config...');
        const testResult = await ssh.execCommand('sudo nginx -t');
        console.log(testResult.stderr); // nginx -t outputs to stderr

        // Restart Nginx
        console.log('\n🔄 Restarting Nginx...');
        await ssh.execCommand('sudo systemctl restart nginx');
        await ssh.execCommand('sudo systemctl enable nginx');
        console.log('✅ Nginx restarted\n');

        // Check status
        console.log('📊 Nginx status:');
        const statusResult = await ssh.execCommand('sudo systemctl status nginx | head -10');
        console.log(statusResult.stdout);

        // Test access
        console.log('\n🧪 Testing access...');
        const curlResult = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost');
        console.log(`HTTP Status: ${curlResult.stdout}\n`);

        if (curlResult.stdout === '200') {
            console.log('🎉 SUCCESS!\n');
            console.log('Your app is now accessible at:');
            console.log('   http://129.154.255.90');
            console.log('   http://foodpanda.site (if DNS is pointed here)');
        } else {
            console.log('⚠️  Nginx is running but app might not be responding');
            console.log('Check that container is running on port 4372');
        }

        ssh.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

setupNginx();
