// Configure Nginx for URL path routing to port 4392
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

async function configureNginxForURLPath() {
    const ssh = new NodeSSH();

    try {
        console.log('🔧 Configuring Nginx for URL path routing...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected\n');

        // Nginx config with proper URL path routing
        const nginxConfig = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    # UzairArif11/Trello-Clone - Port 4392
    location /uzairarif11-trello-clone/ {
        proxy_pass http://localhost:4392/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Default - also proxy to 4392
    location / {
        proxy_pass http://localhost:4392;
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

        // Write to local temp file
        const tempFile = path.join(os.tmpdir(), `nginx-${Date.now()}.conf`);
        fs.writeFileSync(tempFile, nginxConfig);
        console.log('📝 Created temp config file\n');

        // Upload to remote
        await ssh.putFile(tempFile, '/tmp/nginx-default.conf');
        console.log('📤 Uploaded config to EC3\n');

        // Move to correct location
        await ssh.execCommand('sudo mv /tmp/nginx-default.conf /etc/nginx/sites-available/default');
        console.log('✅ Moved to nginx directory\n');

        // Clean up local temp file
        fs.unlinkSync(tempFile);

        // Test config
        console.log('🧪 Testing nginx config...');
        const testResult = await ssh.execCommand('sudo nginx -t 2>&1');
        console.log(testResult.stdout);
        console.log('');

        if (testResult.code === 0) {
            // Reload nginx
            console.log('🔄 Reloading nginx...');
            await ssh.execCommand('sudo nginx -s reload');
            console.log('✅ Nginx reloaded\n');

            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Test both URLs
            console.log('🧪 Testing URLs...\n');

            console.log('1. Testing main domain:');
            const test1 = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost/');
            console.log(`   http://localhost/ → HTTP ${test1.stdout}`);

            console.log('\n2. Testing URL path:');
            const test2 = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost/uzairarif11-trello-clone/');
            console.log(`   http://localhost/uzairarif11-trello-clone/ → HTTP ${test2.stdout}`);

            console.log('\n📊 Results:\n');

            if (test1.stdout === '200' && test2.stdout === '200') {
                console.log('🎉 SUCCESS! Both URLs work!\n');
                console.log('✅ Your app is accessible at:');
                console.log('   http://foodpanda.site');
                console.log('   http://foodpanda.site/uzairarif11-trello-clone/');
                console.log('   http://129.154.255.90');
                console.log('   http://129.154.255.90/uzairarif11-trello-clone/');
            } else if (test1.stdout === '200') {
                console.log('✅ Main domain works!');
                console.log('⚠️  URL path needs fixing');
            } else {
                console.log('⚠️  Issues detected');
            }
        } else {
            console.log('❌ Nginx config test failed');
        }

        ssh.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        ssh.dispose();
    }
}

configureNginxForURLPath();
