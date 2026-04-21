const express = require('express');
const router = express.Router();
const containerOrchestrator = require('../services/containerOrchestrator');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

// In production, test endpoints require admin auth.
// In development, they are open for convenience.
const testGuard = process.env.NODE_ENV === 'development'
    ? (req, res, next) => next()
    : [requireAuth, requireAdmin];

/**
 * Test endpoint to check EC2 vs EC3 capacity
 * GET /api/test/server-capacity
 */
router.get('/server-capacity', testGuard, async (req, res) => {
    try {
        logger.info('Testing server capacity check...');
        const { resolveHost } = require('../utils/serverResolver');

        // Dynamically get all worker servers
        await containerOrchestrator.getOracleServers();
        const allServers = containerOrchestrator.ORACLE_SERVERS;
        const workerKeys = Object.keys(allServers).filter(k => allServers[k].type !== 'api_main');

        const servers = {};
        for (const key of workerKeys) {
            const status = await containerOrchestrator.getServerUtilization(key);
            const srv = allServers[key];
            servers[key] = {
                connected: status.success,
                ...(status.success ? {
                    utilization: status.utilization,
                    capacity: {
                        shared: `${status.utilization.sharedCapacity}/${srv.sharedPool?.maxUsers || 150} users`,
                        dedicated: `${status.utilization.dedicatedCapacity}/${srv.dedicatedPool?.maxUsers || 50} containers`
                    },
                    resources: {
                        cpu: `${status.utilization.cpuUsed.toFixed(2)}/${srv.totalCPU || 2} OCPU`,
                        ram: `${status.utilization.ramUsed.toFixed(2)}/${srv.totalRAM || 12} GB`
                    }
                } : {
                    error: status.error,
                    note: 'Server not configured or not reachable'
                })
            };
        }

        // Choose best server for shared containers
        const bestServerForShared = await containerOrchestrator.chooseBestServerForUser('shared');
        const bestServerForDedicated = await containerOrchestrator.chooseBestServerForUser('dedicated');

        const result = {
            success: true,
            timestamp: new Date().toISOString(),
            servers,
            recommendations: {
                forNewFreeUser: {
                    server: bestServerForShared,
                    reason: `${bestServerForShared} has more shared container capacity`,
                    containerType: 'shared'
                },
                forNewPaidUser: {
                    server: bestServerForDedicated,
                    reason: `${bestServerForDedicated} has more dedicated container capacity`,
                    containerType: 'dedicated'
                }
            },
            configuration: {
                registeredServers: workerKeys.join(', '),
                note: workerKeys.length > 0
                    ? `${workerKeys.length} worker server(s) configured`
                    : 'No worker servers registered. Add servers in Admin Panel → Servers.'
            }
        };

        logger.info('Server capacity check complete', {
            serversChecked: workerKeys,
            bestForShared: bestServerForShared,
            bestForDedicated: bestServerForDedicated
        });

        res.json(result);

    } catch (error) {
        logger.error('Server capacity check failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            note: 'This is expected if Oracle Cloud servers are not configured yet'
        });
    }
});

/**
 * Test endpoint to simulate user assignment
 * POST /api/test/simulate-assignment
 * Body: { username: 'testuser', planType: 'free' | 'paid' }
 */
router.post('/simulate-assignment', testGuard, async (req, res) => {
    try {
        const { username = 'testuser', planType = 'free' } = req.body;

        logger.info('Simulating user assignment', { username, planType });

        // Simulate user object
        const mockUser = {
            _id: 'test-user-id',
            username: username,
            email: `${username}@test.com`
        };

        // Simulate plan
        const mockPlan = planType === 'free' ? {
            name: 'free-trial',
            isTrial: true
        } : {
            name: 'pro',
            isTrial: false,
            resources: {
                cpu: 2,
                ram: 8,
                storage: 100,
                bandwidth: 2048
            }
        };

        // Get best server
        const containerType = planType === 'free' ? 'shared' : 'dedicated';
        const bestServer = await containerOrchestrator.chooseBestServerForUser(containerType);

        // Get server details
        const serverStatus = await containerOrchestrator.getServerUtilization(bestServer);

        const result = {
            success: true,
            simulation: {
                user: {
                    username: mockUser.username,
                    email: mockUser.email
                },
                plan: {
                    type: planType,
                    name: mockPlan.name,
                    containerType: containerType
                },
                assignment: {
                    server: bestServer,
                    serverName: (containerOrchestrator.ORACLE_SERVERS[bestServer]?.name) || bestServer,
                    containerType: containerType,
                    resources: planType === 'free' ? {
                        cpu: '0.2 OCPU (10% cap)',
                        ram: '1.2 GB (10% cap)',
                        storage: '10 GB',
                        bandwidth: '100 GB/month'
                    } : mockPlan.resources
                },
                serverStatus: serverStatus.success ? {
                    currentUsers: serverStatus.utilization.totalUsers,
                    sharedUsers: serverStatus.utilization.sharedUsers,
                    dedicatedUsers: serverStatus.utilization.dedicatedUsers,
                    availableCapacity: containerType === 'shared'
                        ? serverStatus.utilization.sharedCapacity
                        : serverStatus.utilization.dedicatedCapacity
                } : {
                    error: 'Server not reachable',
                    note: 'This is a simulation - actual assignment would happen when Oracle Cloud is configured'
                }
            },
            note: 'This is a simulation. Actual container creation requires Oracle Cloud servers to be configured.'
        };

        res.json(result);

    } catch (error) {
        logger.error('Simulation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * List all containers and their assigned users
 * GET /api/test/list-containers
 */
router.get('/list-containers', testGuard, async (req, res) => {
    try {
        const docker = require('../services/docker');
        const User = require('../models/User');
        const { resolveHost } = require('../utils/serverResolver');

        logger.info('Listing all containers...');

        // Dynamically get all worker servers
        await containerOrchestrator.getOracleServers();
        const allServers = containerOrchestrator.ORACLE_SERVERS;
        const workerKeys = Object.keys(allServers).filter(k => allServers[k].type !== 'api_main');

        // Get all users with container assignments
        const users = await User.find({
            oracleAccountId: { $exists: true, $ne: null }
        }, {
            email: 1,
            username: 1,
            oracleAccountId: 1,
            containerType: 1,
            resourceAllocation: 1,
            currentUsage: 1
        });

        const result = {
            success: true,
            timestamp: new Date().toISOString(),
            summary: {
                totalContainers: 0,
                usersWithAssignments: users.length,
                sharedContainers: 0,
                dedicatedContainers: 0
            },
            servers: {},
            users: users.map(u => ({
                email: u.email,
                username: u.username,
                server: u.oracleAccountId,
                containerType: u.containerType,
                resources: u.resourceAllocation,
                usage: u.currentUsage
            })),
            note: 'Containers are created during first deployment, not during registration'
        };

        // Process containers from each server dynamically
        for (const key of workerKeys) {
            const host = resolveHost(key);
            let serverContainers = { success: false, error: 'No host' };
            if (host) {
                try {
                    serverContainers = await docker.listContainers(host, true);
                } catch (e) {
                    serverContainers = { success: false, error: e.message };
                }
            }

            result.servers[key] = {
                connected: serverContainers.success,
                containers: [],
                error: serverContainers.error || null
            };

            if (serverContainers.success && serverContainers.containers) {
                result.servers[key].containers = serverContainers.containers.map(c => {
                    const containerName = c.Names?.[0]?.replace('/', '') || c.names?.[0]?.replace('/', '') || 'unknown';
                    const isShared = containerName.includes('shared');
                    const isDedicated = containerName.includes('dedicated');

                    if (isShared) result.summary.sharedContainers++;
                    if (isDedicated) result.summary.dedicatedContainers++;

                    return {
                        id: c.Id || c.id,
                        name: containerName,
                        image: c.Image || c.image,
                        status: c.Status || c.status,
                        state: c.State || c.state,
                        type: isShared ? 'shared' : isDedicated ? 'dedicated' : 'unknown',
                        created: c.Created || c.created
                    };
                });
                result.summary.totalContainers += serverContainers.containers.length;
            }
        }

        res.json(result);

    } catch (error) {
        logger.error('List containers failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
