const fs = require('fs');
const { NodeSSH } = require('node-ssh');

// Read the key file
const keyPath = 'D:/work/ec3/uz.key';

console.log('🔍 Analyzing SSH key...\n');

try {
    const keyContent = fs.readFileSync(keyPath, 'utf8');

    console.log('📄 Key file content preview:');
    console.log(keyContent.substring(0, 100) + '...\n');

    // Try different formats
    const formats = [
        { name: 'Direct string', value: keyContent },
        { name: 'Buffer', value: Buffer.from(keyContent) },
        { name: 'Trimmed', value: keyContent.trim() },
    ];

    console.log('🔧 Testing connection with different formats...\n');

    testConnection(keyContent);

} catch (error) {
    console.error('❌ Error reading key:', error.message);
}

async function testConnection(keyContent) {
    const ssh = new NodeSSH();

    try {
        console.log('📡 Attempting connection to EC3...');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyContent,
            passphrase: '', // Empty passphrase
            tryKeyboard: false,
        });

        console.log('✅ SUCCESS! Connection established!');

        const result = await ssh.execCommand('docker --version');
        console.log('Docker version:', result.stdout);

        ssh.dispose();

        console.log('\n✅ The key works! Update your .env:');
        console.log('SSH_EC3_KEY=D:/work/ec3/uz.key');
        console.log('SSH_EC2_KEY=D:/work/ec2/uz.key  (if same key)');

    } catch (error) {
        console.log('❌ Connection failed:', error.message);

        // Try with passphrase
        if (error.message.includes('passphrase')) {
            console.log('\n💡 Key might be encrypted with a passphrase');
            console.log('Add to .env:');
            console.log('SSH_KEY_PASSPHRASE=your_passphrase');
        }

        // Try reading as buffer
        tryBufferFormat();
    }
}

async function tryBufferFormat() {
    const ssh = new NodeSSH();

    try {
        console.log('\n🔧 Trying buffer format...');

        const keyBuffer = fs.readFileSync('D:/work/ec3/uz.key');

        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: keyBuffer,
        });

        console.log('✅ SUCCESS with buffer format!');
        ssh.dispose();

    } catch (error) {
        console.log('❌ Buffer format also failed');
        console.log('\n💡 Suggestions:');
        console.log('1. Check if key is encrypted (has passphrase)');
        console.log('2. Try converting key format:');
        console.log('   ssh-keygen -p -m PEM -f D:/work/ec3/uz.key');
        console.log('3. Or use password authentication instead');
    }
}
