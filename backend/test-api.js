const http = require('http');

const testEndpoint = (path) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            console.log(`GET ${path} -> Status: ${res.statusCode}`);
            resolve(res.statusCode);
        });

        req.on('error', (e) => {
            console.error(`GET ${path} -> Error: ${e.message}`);
            resolve(null);
        });

        req.end();
    });
};

async function runTests() {
    console.log('Testing API endpoints...');
    await testEndpoint('/health');
    await testEndpoint('/api/projects');
    await testEndpoint('/api/deployments');
    await testEndpoint('/api/admin/users');
    console.log('Tests completed.');
}

runTests();
