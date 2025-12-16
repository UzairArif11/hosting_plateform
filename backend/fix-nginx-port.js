// Fix nginx to point to correct port
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
require('dotenv').config();

async function fixNginxPort() {
    const ssh = new NodeSSH();

    try {
        console.log('🔧 Fixing Nginx to point to port 4392...\n');

        const keyContent = fs.readFileSync(process.env.SSH_EC3_KEY, 'utf8');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent
        });

        console.log('✅ Connected\n');

        // Simple nginx config that works
        const nginxConfig = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    # UzairArif11/Trello-Clone - Port 4392
    location /uzairarif11-trello-clone {
        rewrite ^/uzairarif11-trello-clone(.*)$ $1 break;
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

        // Write config
        console.log('📝 Writing nginx config...');
        await ssh.execCommand(`echo '${nginxConfig}' | sudo tee /etc/nginx/sites-available/default > /dev/null`);

        // Test config
        console.log('🧪 Testing nginx config...');
        const testResult = await ssh.execCommand('sudo nginx -t 2>&1');
        console.log(testResult.stdout);

        if (testResult.code === 0) {
            // Reload nginx
            console.log('\n🔄 Reloading nginx...');
            await ssh.execCommand('sudo nginx -s reload');
            console.log('✅ Nginx reloaded\n');

            // Test the URL
            console.log('🧪 Testing URL...');
            const urlTest = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost/uzairarif11-trello-clone');
            console.log(`HTTP Status: ${urlTest.stdout}\n`);

            if (urlTest.stdout === '200') {
                console.log('🎉 SUCCESS!\n');
                console.log('Your app is now accessible at:');
                console.log('  http://foodpanda.site/uzairarif11-trello-clone');
                console.log('  http://129.154.255.90/uzairarif11-trello-clone');
                console.log('  http://foodpanda.site (main domain)');
            } else {
                console.log(`⚠️  Got HTTP ${urlTest.stdout}`);
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

fixNginxPort();
