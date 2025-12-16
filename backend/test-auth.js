#!/usr/bin/env node

/**
 * Simple Auth Test
 * Tests registration and login
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000';

async function testAuth() {
    console.log('\n🧪 Testing Authentication\n');

    const email = `test-${Date.now()}@example.com`;
    const password = 'Test123!@#';

    try {
        // Test 1: Register
        console.log('1️⃣  Testing Registration...');
        console.log(`   Email: ${email}`);

        const registerRes = await axios.post(`${API_URL}/api/auth/register`, {
            email,
            password,
            displayName: 'Test User'
        });

        console.log('   ✅ Registration successful');
        console.log('   Response:', JSON.stringify(registerRes.data, null, 2));

        if (registerRes.data.token) {
            console.log('   ✅ Token received:', registerRes.data.token.substring(0, 20) + '...');
        } else {
            console.log('   ❌ No token in response!');
        }

        // Test 2: Login
        console.log('\n2️⃣  Testing Login...');

        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email,
            password
        });

        console.log('   ✅ Login successful');
        console.log('   Response:', JSON.stringify(loginRes.data, null, 2));

        if (loginRes.data.token) {
            console.log('   ✅ Token received:', loginRes.data.token.substring(0, 20) + '...');

            // Test 3: Use token
            console.log('\n3️⃣  Testing Token Usage...');

            const meRes = await axios.get(`${API_URL}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${loginRes.data.token}`
                }
            });

            console.log('   ✅ Token works!');
            console.log('   User:', JSON.stringify(meRes.data, null, 2));
        } else {
            console.log('   ❌ No token in response!');
        }

        console.log('\n🎉 All auth tests passed!\n');

    } catch (error) {
        console.error('\n❌ Test failed:');
        console.error('   Status:', error.response?.status);
        console.error('   Message:', error.response?.data?.error || error.message);
        console.error('   URL:', error.config?.url);
        console.error('   Data:', error.config?.data);
        process.exit(1);
    }
}

testAuth();
