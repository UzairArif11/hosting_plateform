const express = require('express');
const router = express.Router();
const containerOrchestrator = require('../services/containerOrchestrator');
const logger = require('../utils/logger');

/**
 * Test endpoint to check EC2 vs EC3 capacity
 * GET /api/test/server-capacity
 */
router.get('/server-capacity', async (req, res) => {
    try {
        logger.info('Testing server capacity check...');

        // Get server utilization for both EC2 and EC3
        const ec2Status = await containerOrchestrator.getServerUtilization('EC2');
        const ec3Status = await containerOrchestrator.getServerUtilization('EC3');

        // Choose best server for shared containers
        const bestServerForShared = await containerOrchestrator.chooseBestServerForUser('shared');

        // Choose best server for dedicated containers
        const bestServerForDedicated = await containerOrchestrator.chooseBestServerForUser('dedicated');

        const result = {
            success: true,
            timestamp: new Date().toISOString(),
            servers: {
                EC2: {
                    connected: ec2Status.success,
                    ...(ec2Status.success ? {
                        utilization: ec2Status.utilization,
                        capacity: {
                            shared: `${ec2Status.utilization.sharedCapacity}/${process.env.EC2_MAX_SHARED || 150} users`,
                            dedicated: `${ec2Status.utilization.dedicatedCapacity}/${process.env.EC2_MAX_DEDICATED || 50} containers`
                        },
                        resources: {
                            cpu: `${ec2Status.utilization.cpuUsed.toFixed(2)}/${process.env.EC2_TOTAL_CPU || 2} OCPU`,
                            ram: `${ec2Status.utilization.ramUsed.toFixed(2)}/${process.env.EC2_TOTAL_RAM || 12} GB`
                        }
                    } : {
                        error: ec2Status.error,
                        note: 'Server not configured or not reachable'
                    })
                },
                EC3: {
                    connected: ec3Status.success,
                    ...(ec3Status.success ? {
                        utilization: ec3Status.utilization,
                        capacity: {
                            shared: `${ec3Status.utilization.sharedCapacity}/${process.env.EC3_MAX_SHARED || 200} users`,
                            dedicated: `${ec3Status.utilization.dedicatedCapacity}/${process.env.EC3_MAX_DEDICATED || 100} containers`
                        },
                        resources: {
                            cpu: `${ec3Status.utilization.cpuUsed.toFixed(2)}/${process.env.EC3_TOTAL_CPU || 4} OCPU`,
                            ram: `${ec3Status.utilization.ramUsed.toFixed(2)}/${process.env.EC3_TOTAL_RAM || 24} GB`
                        }
                    } : {
                        error: ec3Status.error,
                        note: 'Server not configured or not reachable'
                    })
                }
            },
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
                EC2_SERVER_IP: process.env.EC2_SERVER_IP || 'Not configured',
                EC3_SERVER_IP: process.env.EC3_SERVER_IP || 'Not configured',
                note: process.env.EC2_SERVER_IP && process.env.EC3_SERVER_IP
                    ? 'Both servers configured'
                    : 'Add EC2_SERVER_IP and EC3_SERVER_IP to .env to enable Oracle Cloud deployment'
            }
        };

        logger.info('Server capacity check complete', {
            ec2Connected: ec2Status.success,
            ec3Connected: ec3Status.success,
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
router.post('/simulate-assignment', async (req, res) => {
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
                    serverName: bestServer === 'EC2' ? 'EC2-Mixed-Server' : 'EC3-Mixed-Server',
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
router.get('/list-containers', async (req, res) => {
    try {
        const docker = require('../services/docker');
        const User = require('../models/User');

        logger.info('Listing all containers...');

        // Get containers from both servers
        const ec2Containers = await docker.listContainers(process.env.EC2_SERVER_IP, true);
        const ec3Containers = await docker.listContainers(process.env.EC3_SERVER_IP, true);

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
                ec2Containers: 0,
                ec3Containers: 0,
                usersWithAssignments: users.length,
                sharedContainers: 0,
                dedicatedContainers: 0
            },
            servers: {
                EC2: {
                    connected: ec2Containers.success,
                    containers: [],
                    error: ec2Containers.error || null
                },
                EC3: {
                    connected: ec3Containers.success,
                    containers: [],
                    error: ec3Containers.error || null
                }
            },
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

        // Process EC2 containers
        if (ec2Containers.success && ec2Containers.containers) {
            result.servers.EC2.containers = ec2Containers.containers.map(c => {
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
            result.summary.ec2Containers = ec2Containers.containers.length;
            result.summary.totalContainers += ec2Containers.containers.length;
        }

        // Process EC3 containers
        if (ec3Containers.success && ec3Containers.containers) {
            result.servers.EC3.containers = ec3Containers.containers.map(c => {
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
            result.summary.ec3Containers = ec3Containers.containers.length;
            result.summary.totalContainers += ec3Containers.containers.length;
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
