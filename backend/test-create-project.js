// Test project creation API directly
// Run: node test-create-project.js

const axios = require('axios');

async function testCreateProject() {
    try {
        console.log('🧪 Testing project creation API...\n');

        // You need to replace this with your actual token
        // Get it from: localStorage.getItem('token') in browser console
        const token = 'YOUR_TOKEN_HERE';

        if (token === 'YOUR_TOKEN_HERE') {
            console.log('❌ Please update the token in this file!');
            console.log('1. Open http://localhost:3000');
            console.log('2. Login');
            console.log('3. Open browser console (F12)');
            console.log('4. Run: localStorage.getItem(\'token\')');
            console.log('5. Copy the token and paste it in this file\n');
            process.exit(1);
        }

        const projectData = {
            name: 'Test Project',
            repository: {
                url: 'https://github.com/UzairArif11/Trello-Clone',
                fullName: 'UzairArif11/Trello-Clone',
                branch: 'main'
            },
            framework: 'nextjs'
        };

        console.log('📤 Sending request:');
        console.log(JSON.stringify(projectData, null, 2));
        console.log('');

        const response = await axios.post('http://localhost:5000/api/projects', projectData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Success!');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('❌ Error:', error.response?.status, error.response?.statusText);
        console.log('');
        console.log('📋 Error Details:');
        console.log(JSON.stringify(error.response?.data, null, 2));
        console.log('');

        if (error.response?.status === 500) {
            console.log('⚠️  500 Internal Server Error');
            console.log('Check backend terminal for detailed error logs!');
        } else if (error.response?.status === 403) {
            console.log('⚠️  403 Forbidden');
            console.log('Possible causes:');
            console.log('  - No GitHub access token');
            console.log('  - Repository access denied');
            console.log('  - Insufficient capacity');
        } else if (error.response?.status === 401) {
            console.log('⚠️  401 Unauthorized');
            console.log('Token is invalid or expired. Get a new one!');
        }
    }
}

testCreateProject();
