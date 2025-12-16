#!/usr/bin/env node

/**
 * Cleanup Script: Delete All Containers on EC2 and EC3
 * 
 * Usage:
 *   node cleanup-containers.js --server EC2
 *   node cleanup-containers.js --server EC3
 *   node cleanup-containers.js --all
 */

require('dotenv').config();
const { Client } = require('ssh2');
const fs = require('fs');

const SERVERS = {
    EC2: {
        host: process.env.EC2_HOST || '129.159.249.123',
        keyPath: process.env.SSH_EC2_KEY || 'D:/work/ec2/uz.key'
    },
    EC3: {
        host: process.env.EC3_HOST || '129.154.255.90',
        keyPath: process.env.SSH_EC3_KEY || 'D:/work/ec3/uz.key'
    }
};

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function executeSSH(serverKey, command) {
    return new Promise((resolve, reject) => {
        const server = SERVERS[serverKey];
        const ssh = new Client();

        ssh.on('ready', () => {
            ssh.exec(command, (err, stream) => {
                if (err) {
                    ssh.end();
                    return reject(err);
                }

                let output = '';
                let errorOutput = '';

                stream.on('data', (data) => {
                    output += data.toString();
                });

                stream.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                stream.on('close', () => {
                    ssh.end();
                    if (errorOutput && !output) {
                        reject(new Error(errorOutput));
                    } else {
                        resolve(output.trim());
                    }
                });
            });
        });

        ssh.on('error', (err) => {
            reject(err);
        });

        ssh.connect({
            host: server.host,
            port: 22,
            username: process.env.SSH_USERNAME || 'ubuntu',
            privateKey: fs.readFileSync(server.keyPath)
        });
    });
}

async function listContainers(serverKey) {
    log(`\n📋 Listing containers on ${serverKey}...`, 'cyan');

    try {
        const output = await executeSSH(serverKey,
            'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}"'
        );

        if (!output) {
            log('  No containers found', 'yellow');
            return [];
        }

        const containers = output.split('\n').map(line => {
            const [id, name, status, image] = line.split('|');
            return { id, name, status, image };
        });

        log(`  Found ${containers.length} containers:`, 'blue');
        containers.forEach(c => {
            const statusColor = c.status.includes('Up') ? 'green' : 'red';
            log(`    ${c.id.substring(0, 12)} | ${c.name} | ${c.status}`, statusColor);
        });

        return containers;

    } catch (error) {
        log(`  Error listing containers: ${error.message}`, 'red');
        return [];
    }
}

async function stopAllContainers(serverKey) {
    log(`\n🛑 Stopping all containers on ${serverKey}...`, 'yellow');

    try {
        const output = await executeSSH(serverKey,
            'docker stop $(docker ps -aq) 2>/dev/null || echo "No containers to stop"'
        );
        log(`  ${output}`, 'green');
    } catch (error) {
        log(`  ${error.message}`, 'yellow');
    }
}

async function removeAllContainers(serverKey) {
    log(`\n🗑️  Removing all containers on ${serverKey}...`, 'red');

    try {
        const output = await executeSSH(serverKey,
            'docker rm -f $(docker ps -aq) 2>/dev/null || echo "No containers to remove"'
        );
        log(`  ${output}`, 'green');
    } catch (error) {
        log(`  ${error.message}`, 'yellow');
    }
}

async function showActiveContainers(serverKey) {
    log(`\n✅ Active containers on ${serverKey}:`, 'green');

    try {
        const output = await executeSSH(serverKey,
            'docker ps --format "table {{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.Ports}}"'
        );

        if (!output || output.includes('CONTAINER ID')) {
            const lines = output.split('\n');
            if (lines.length <= 1) {
                log('  No active containers', 'yellow');
            } else {
                console.log(output);
            }
        }
    } catch (error) {
        log(`  Error: ${error.message}`, 'red');
    }
}

async function cleanupServer(serverKey) {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`🧹 CLEANING UP ${serverKey}`, 'cyan');
    log(`${'='.repeat(60)}`, 'cyan');

    // List containers
    await listContainers(serverKey);

    // Confirm
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const answer = await new Promise(resolve => {
        readline.question(`\n⚠️  Delete ALL containers on ${serverKey}? (yes/no): `, resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'yes') {
        log('  Cancelled', 'yellow');
        return;
    }

    // Stop all
    await stopAllContainers(serverKey);

    // Remove all
    await removeAllContainers(serverKey);

    // Show result
    await showActiveContainers(serverKey);

    log(`\n✅ Cleanup complete for ${serverKey}`, 'green');
}

async function main() {
    const args = process.argv.slice(2);

    log('\n🧹 Container Cleanup Script', 'cyan');
    log('='.repeat(60), 'cyan');

    if (args.includes('--help') || args.length === 0) {
        log('\nUsage:', 'yellow');
        log('  node cleanup-containers.js --server EC2', 'blue');
        log('  node cleanup-containers.js --server EC3', 'blue');
        log('  node cleanup-containers.js --all', 'blue');
        log('  node cleanup-containers.js --list', 'blue');
        log('  node cleanup-containers.js --active', 'blue');
        return;
    }

    if (args.includes('--list')) {
        // Just list containers
        for (const serverKey of Object.keys(SERVERS)) {
            await listContainers(serverKey);
        }
        return;
    }

    if (args.includes('--active')) {
        // Show only active containers
        for (const serverKey of Object.keys(SERVERS)) {
            await showActiveContainers(serverKey);
        }
        return;
    }

    if (args.includes('--all')) {
        // Cleanup all servers
        for (const serverKey of Object.keys(SERVERS)) {
            await cleanupServer(serverKey);
        }
    } else if (args.includes('--server')) {
        // Cleanup specific server
        const serverIndex = args.indexOf('--server');
        const serverKey = args[serverIndex + 1];

        if (!SERVERS[serverKey]) {
            log(`\n❌ Invalid server: ${serverKey}`, 'red');
            log('   Valid servers: EC2, EC3', 'yellow');
            return;
        }

        await cleanupServer(serverKey);
    }

    log('\n✅ All done!', 'green');
}

main().catch(error => {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});
