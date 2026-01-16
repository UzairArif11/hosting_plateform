#!/usr/bin/env node

/**
 * Vercel Clone Platform CLI
 * Simple command-line interface for platform operations
 */

const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_PATH = path.join(os.homedir(), '.vcp-cli-config.json');
const API_URL = process.env.VCP_API_URL || 'http://localhost:5000/api';

// Helper to load config
function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
        return {};
    }
}

// Helper to save config
function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Commands
const commands = {
    async login([email, password]) {
        if (!email || !password) {
            console.error('Usage: vcp-cli login <email> <password>');
            process.exit(1);
        }

        try {
            const res = await axios.post(`${API_URL}/auth/login`, { email, password });
            const { token, user } = res.data;

            saveConfig({ token, userId: user._id, email: user.email });
            console.log('✅ Logged in successfully as', user.email);
        } catch (error) {
            console.error('❌ Login failed:', error.response?.data?.error || error.message);
            process.exit(1);
        }
    },

    async list() {
        const config = loadConfig();
        if (!config.token) {
            console.error('❌ Not logged in. Run: vcp-cli login <email> <password>');
            process.exit(1);
        }

        try {
            const res = await axios.get(`${API_URL}/projects`, {
                headers: { Authorization: `Bearer ${config.token}` }
            });

            const projects = res.data.projects || [];
            console.log(`\n📦 Your Projects (${projects.length}):\n`);

            projects.forEach(p => {
                console.log(`  • ${p.name} (${p.slug})`);
                console.log(`    URL: ${p.deploymentUrl || 'Not deployed'}`);
                console.log(`    Status: ${p.status}\n`);
            });
        } catch (error) {
            console.error('❌ Failed to list projects:', error.response?.data?.error || error.message);
            process.exit(1);
        }
    },

    async deploy([projectId]) {
        const config = loadConfig();
        if (!config.token) {
            console.error('❌ Not logged in. Run: vcp-cli login');
            process.exit(1);
        }

        if (!projectId) {
            console.error('Usage: vcp-cli deploy <projectId>');
            process.exit(1);
        }

        try {
            console.log('🚀 Triggering deployment...');
            const res = await axios.post(
                `${API_URL}/projects/${projectId}/deploy`,
                {},
                { headers: { Authorization: `Bearer ${config.token}` } }
            );

            console.log('✅ Deployment started!');
            console.log('Deployment ID:', res.data.deployment._id);
        } catch (error) {
            console.error('❌ Deployment failed:', error.response?.data?.error || error.message);
            process.exit(1);
        }
    },

    async logs([deploymentId]) {
        const config = loadConfig();
        if (!config.token) {
            console.error('❌ Not logged in');
            process.exit(1);
        }

        if (!deploymentId) {
            console.error('Usage: vcp-cli logs <deploymentId>');
            process.exit(1);
        }

        try {
            const res = await axios.get(`${API_URL}/deployments/${deploymentId}/logs`, {
                headers: { Authorization: `Bearer ${config.token}` }
            });

            const logs = res.data.logs || [];
            console.log(`\n📋 Deployment Logs:\n`);

            logs.forEach(log => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                console.log(`[${time}] [${log.level.toUpperCase()}] ${log.message}`);
            });
        } catch (error) {
            console.error('❌ Failed to fetch logs:', error.response?.data?.error || error.message);
            process.exit(1);
        }
    },

    help() {
        console.log(`
Vercel Clone Platform CLI

Usage: vcp-cli <command> [options]

Commands:
  login <email> <password>  Login to your account
  list                       List all your projects
  deploy <projectId>        Trigger a deployment
  logs <deploymentId>       View deployment logs
  help                      Show this help message

Examples:
  vcp-cli login user@example.com password123
  vcp-cli list
  vcp-cli deploy 507f1f77bcf86cd799439011
  vcp-cli logs 507f1f77bcf86cd799439012
    `);
    }
};

// Main
const [, , command, ...args] = process.argv;

if (!command || !commands[command]) {
    commands.help();
    process.exit(command ? 1 : 0);
}

commands[command](args).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
