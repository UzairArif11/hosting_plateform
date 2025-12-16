// Test the Nginx routing update
const nginxRouter = require('./services/nginxRouter');
require('dotenv').config();

async function testRouting() {
    console.log('🧪 Testing Nginx routing update...\n');

    // Test with the actual project name
    const projectName = 'UzairArif11/Trello-Clone';
    const port = 4201;
    const serverHost = '129.154.255.90';
    const serverKey = 'EC3';

    console.log('Project:', projectName);
    console.log('Port:', port);
    console.log('Server:', serverHost);
    console.log('');

    const result = await nginxRouter.updateNginxRouting(
        projectName,
        port,
        serverHost,
        serverKey
    );

    console.log('\n📊 Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
        console.log('\n✅ SUCCESS!');
        console.log(`\nYour app should be accessible at:`);
        console.log(`  ${result.url}`);
        console.log(`  http://foodpanda.site (main domain)`);
    } else {
        console.log('\n❌ FAILED!');
        console.log(`Error: ${result.error}`);
    }
}

testRouting().catch(console.error);
