const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * SSH Tunnel Manager for Secure Docker API Access
 * 
 * Creates and manages SSH tunnels to remote Docker daemons
 * Tunnels: localhost:2376 → EC2:2376, localhost:2377 → EC3:2376
 */
class SSHTunnelManager {
    constructor() {
        this.tunnels = new Map(); // serverKey → { localPort, remoteHost, status }
        this.connections = new Map(); // serverKey → SSH connection
        this.reconnectAttempts = new Map(); // serverKey → attempt count
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5 seconds
    }

    /**
     * Create SSH tunnel to remote Docker daemon
     * @param {string} serverKey - 'EC2' or 'EC3'
     * @param {string} remoteHost - Remote server IP
     * @param {number} localPort - Local port to bind (2376 for EC2, 2377 for EC3)
     * @param {number} remotePort - Remote Docker port (always 2376)
     * @returns {Promise<{success: boolean, localPort?: number, error?: string}>}
     */
    async createTunnel(serverKey, remoteHost, localPort, remotePort = 2376) {
        try {
            logger.info(`[SSH Tunnel] Creating tunnel for ${serverKey}...`, {
                remoteHost,
                localPort,
                remotePort
            });

            // Get SSH key path from environment
            const keyPath = serverKey === 'EC2'
                ? process.env.SSH_EC2_KEY
                : process.env.SSH_EC3_KEY;

            if (!keyPath) {
                throw new Error(`SSH key path not configured for ${serverKey}. Set SSH_${serverKey}_KEY in .env`);
            }

            if (!fs.existsSync(keyPath)) {
                throw new Error(`SSH key not found at ${keyPath}`);
            }

            const username = process.env.SSH_USERNAME || 'ubuntu';
            const privateKey = fs.readFileSync(keyPath, 'utf8');

            // Create SSH connection
            const ssh = new NodeSSH();

            await ssh.connect({
                host: remoteHost,
                username: username,
                privateKey: privateKey,
                readyTimeout: 30000, // 30 seconds
                keepaliveInterval: 10000 // Keep connection alive
            });

            logger.info(`[SSH Tunnel] ✅ SSH connected to ${serverKey} (${remoteHost})`);

            // Create a local TCP server that forwards connections through the SSH tunnel
            const net = require('net');
            const tcpServer = net.createServer((socket) => {
                ssh.connection.forwardOut(
                    '127.0.0.1',
                    socket.remotePort,
                    '127.0.0.1',
                    remotePort,
                    (err, stream) => {
                        if (err) {
                            logger.error(`[SSH Tunnel] Forwarding error for ${serverKey}:`, err);
                            return socket.end();
                        }
                        socket.pipe(stream).pipe(socket);
                    }
                );
            });

            await new Promise((resolve, reject) => {
                tcpServer.on('error', reject);
                tcpServer.listen(localPort, '127.0.0.1', () => {
                    tcpServer.removeListener('error', reject);
                    resolve();
                });
            });

            // Store connection and tunnel info
            this.connections.set(serverKey, ssh);
            this.tunnels.set(serverKey, {
                localPort,
                remoteHost,
                remotePort,
                status: 'active',
                server: tcpServer, // Store the server so we can close it later
                createdAt: new Date()
            });

            // Reset reconnect attempts on success
            this.reconnectAttempts.set(serverKey, 0);

            // Set up error handlers
            ssh.connection.on('error', (error) => {
                logger.error(`[SSH Tunnel] Connection error for ${serverKey}:`, error);
                this.handleDisconnect(serverKey, remoteHost, localPort, remotePort);
            });

            ssh.connection.on('end', () => {
                logger.warn(`[SSH Tunnel] Connection ended for ${serverKey}`);
                this.handleDisconnect(serverKey, remoteHost, localPort, remotePort);
            });

            logger.info(`[SSH Tunnel] ✅ Tunnel established: ${serverKey}`, {
                localPort,
                remoteHost,
                remotePort,
                mapping: `localhost:${localPort} → ${remoteHost}:${remotePort}`
            });

            return { success: true, localPort };

        } catch (error) {
            logger.error(`[SSH Tunnel] ❌ Failed to create tunnel for ${serverKey}:`, {
                error: error.message,
                remoteHost,
                localPort
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Handle tunnel disconnection and attempt reconnect
     */
    async handleDisconnect(serverKey, remoteHost, localPort, remotePort) {
        const tunnel = this.tunnels.get(serverKey);
        if (tunnel) {
            tunnel.status = 'disconnected';
            if (tunnel.server) {
                try {
                    tunnel.server.close();
                } catch (e) {
                    // Ignore close errors
                }
            }
        }

        // Clean up connection
        const ssh = this.connections.get(serverKey);
        if (ssh) {
            try {
                ssh.dispose();
            } catch (e) {
                // Ignore disposal errors
            }
            this.connections.delete(serverKey);
        }

        // Attempt reconnection
        const attempts = this.reconnectAttempts.get(serverKey) || 0;

        if (attempts < this.maxReconnectAttempts) {
            this.reconnectAttempts.set(serverKey, attempts + 1);

            logger.info(`[SSH Tunnel] Attempting to reconnect ${serverKey} (attempt ${attempts + 1}/${this.maxReconnectAttempts})...`);

            setTimeout(async () => {
                const result = await this.createTunnel(serverKey, remoteHost, localPort, remotePort);

                if (!result.success) {
                    logger.error(`[SSH Tunnel] Reconnection failed for ${serverKey}`);
                }
            }, this.reconnectDelay);
        } else {
            logger.error(`[SSH Tunnel] Max reconnection attempts reached for ${serverKey}. Manual intervention required.`);
        }
    }

    /**
     * Close tunnel for specific server
     */
    async closeTunnel(serverKey) {
        const tunnel = this.tunnels.get(serverKey);
        if (tunnel && tunnel.server) {
            try {
                tunnel.server.close();
            } catch (e) {}
        }

        const ssh = this.connections.get(serverKey);

        if (ssh) {
            try {
                ssh.dispose();
                logger.info(`[SSH Tunnel] Closed tunnel for ${serverKey}`);
            } catch (error) {
                logger.error(`[SSH Tunnel] Error closing tunnel for ${serverKey}:`, error);
            }

            this.connections.delete(serverKey);
        }

        this.tunnels.delete(serverKey);
        this.reconnectAttempts.delete(serverKey);
    }

    /**
     * Close all tunnels (for graceful shutdown)
     */
    async closeAllTunnels() {
        logger.info('[SSH Tunnel] Closing all tunnels...');

        for (const [serverKey, tunnel] of this.tunnels) {
            if (tunnel && tunnel.server) {
                try { tunnel.server.close(); } catch (e) {}
            }
        }

        for (const [serverKey, ssh] of this.connections) {
            try {
                ssh.dispose();
                logger.info(`[SSH Tunnel] Closed tunnel for ${serverKey}`);
            } catch (error) {
                logger.error(`[SSH Tunnel] Error closing tunnel for ${serverKey}:`, error);
            }
        }

        this.connections.clear();
        this.tunnels.clear();
        this.reconnectAttempts.clear();
    }

    /**
     * Get tunnel information for a server
     */
    getTunnelInfo(serverKey) {
        return this.tunnels.get(serverKey);
    }

    /**
     * Get status of all tunnels
     */
    getAllTunnelsStatus() {
        const status = {};

        for (const [serverKey, tunnel] of this.tunnels) {
            status[serverKey] = {
                ...tunnel,
                connected: this.connections.has(serverKey)
            };
        }

        return status;
    }

    /**
     * Check if tunnel is active and healthy
     */
    isTunnelActive(serverKey) {
        const tunnel = this.tunnels.get(serverKey);
        const connection = this.connections.get(serverKey);

        return tunnel?.status === 'active' && connection !== undefined;
    }
}

// Export singleton instance
module.exports = new SSHTunnelManager();
