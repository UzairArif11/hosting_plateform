// Fix SSH key format issue
const fs = require('fs');
const path = require('path');

console.log('🔧 Checking SSH key format...\n');

const ec2Key = process.env.SSH_EC2_KEY || 'D:/work/ec2';
const ec3Key = process.env.SSH_EC3_KEY || 'D:/work/ec3';

function checkKeyFormat(keyPath) {
    try {
        const content = fs.readFileSync(keyPath, 'utf8');

        console.log(`📄 ${path.basename(keyPath)}:`);

        if (content.includes('BEGIN OPENSSH PRIVATE KEY')) {
            console.log('  ✅ OpenSSH format (Good!)\n');
            return true;
        } else if (content.includes('BEGIN RSA PRIVATE KEY')) {
            console.log('  ⚠️  RSA format (Needs conversion)\n');
            console.log('  Convert with:');
            console.log(`  ssh-keygen -p -m PEM -f "${keyPath}"\n`);
            return false;
        } else if (content.includes('BEGIN PRIVATE KEY')) {
            console.log('  ⚠️  PKCS8 format (Needs conversion)\n');
            console.log('  Convert with:');
            console.log(`  ssh-keygen -p -m PEM -f "${keyPath}"\n`);
            return false;
        } else {
            console.log('  ❌ Unknown format\n');
            return false;
        }
    } catch (error) {
        console.log(`  ❌ Error reading file: ${error.message}\n`);
        return false;
    }
}

const ec2Ok = checkKeyFormat(ec2Key);
const ec3Ok = checkKeyFormat(ec3Key);

console.log('='.repeat(50));

if (ec2Ok && ec3Ok) {
    console.log('✅ All keys are in correct format!');
    console.log('\nYou can now run: node test-ssh-connections.js');
} else {
    console.log('⚠️  Some keys need conversion');
    console.log('\nOR use password authentication instead:');
    console.log('Add to .env:');
    console.log('SSH_PASSWORD=your_password');
    console.log('SSH_USE_PASSWORD=true');
}

console.log('='.repeat(50));
