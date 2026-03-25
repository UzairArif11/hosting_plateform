const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

/**
 * SSH Tunnel Manager for Secure Docker API Access
 * 
 * Creates and manages SSH tunnels to remote Docker daemons
 * Tunnels: localhost:2376 → EC2:2376, localhost:2377 → EC3:2376
 */
class SSHTunnelManager {
    constructor() {
        this.tunnels = new Map(); // serverKey → { localPort, remoteHost, status, server }
        this.connections = new Map(); // serverKey → SSH connection
        this.reconnectAttempts = new Map(); // serverKey → attempt count
        this.localServers = new Set(); // serverKeys that are on the same machine (no tunnel needed)
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5 seconds

        // Register process exit handlers for graceful cleanup
        const cleanup = () => {
            logger.info('[SSH Tunnel] Process exiting, cleaning up tunnels...');
            this.closeAllTunnelsSync();
        };
        process.on('exit', cleanup);
        process.on('SIGINT', () => { cleanup(); process.exit(0); });
        process.on('SIGTERM', () => { cleanup(); process.exit(0); });
    }

    /**
     * Force-kill any process listening on a specific port
     * Uses OS-level tools (fuser/lsof) to actually terminate the process
     */
    /**
     * Close any existing tunnel server on the given port (our own process only).
     * IMPORTANT: We do NOT use fuser/kill anymore — that was killing the backend itself
     * and causing PM2 to restart infinitely.
     */
    async freePort(port) {
        try {
            // First, close any of our own tunnel servers that might be on this port
            for (const [key, tunnel] of this.tunnels) {
                if (tunnel.localPort === port && tunnel.server) {
                    try {
                        tunnel.server.close();
                        logger.info(`[SSH Tunnel] Closed our own server on port ${port} (${key})`);
                    } catch (e) {}
                }
            }
            
            // Brief wait for the OS to release the port
            await new Promise(r => setTimeout(r, 500));
            return true;
        } catch (err) {
            logger.error(`[SSH Tunnel] freePort error: ${err.message}`);
            return false;
        }
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

            // STEP 0: Close any existing tunnel and kill stale port occupants
            const existingTunnel = this.tunnels.get(serverKey);
            if (existingTunnel) {
                logger.info(`[SSH Tunnel] Closing existing tunnel for ${serverKey} before recreating...`);
                await this.closeTunnel(serverKey);
                await new Promise(r => setTimeout(r, 500));
            }

            // Close any of our own stale servers on this port (safe — no fuser/kill!)
            await this.freePort(localPort);

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
            // SO_REUSEADDR allows the new server to bind even if the old one hasn't fully released
            const tcpServer = net.createServer({ allowHalfOpen: true }, (socket) => {
                if (!ssh.connection) {
                    logger.error(`[SSH Tunnel] SSH connection lost for ${serverKey}, rejecting incoming connection`);
                    return socket.end();
                }
                ssh.connection.forwardOut(
                    '127.0.0.1',
                    socket.remotePort,
                    '127.0.0.1',
                    remotePort,
                    (err, stream) => {
                        if (err) {
                            logger.error(`[SSH Tunnel] Forwarding error for ${serverKey}:`, err.message);
                            return socket.end();
                        }
                        socket.pipe(stream).pipe(socket);
                        
                        // Clean up on close
                        stream.on('close', () => socket.destroy());
                        socket.on('close', () => stream.destroy());
                    }
                );
            });

            // Allow the port to be reused immediately after the server closes
            tcpServer.on('error', (err) => {
                logger.error(`[SSH Tunnel] TCP server error for ${serverKey}:`, err.message);
            });

            // Try to listen with SO_REUSEADDR and retry logic
            try {
                await this._listenWithRetry(tcpServer, localPort, serverKey);
            } catch (listenError) {
                if (listenError.code === 'EADDRINUSE') {
                    logger.warn(`[SSH Tunnel] Port ${localPort} still in use for ${serverKey}. Will use dynamic port as fallback.`);
                    
                    // Use a dynamic port instead of fighting over the fixed port
                    const dynamicPort = localPort + 100 + Math.floor(Math.random() * 100);
                    logger.info(`[SSH Tunnel] Trying dynamic port ${dynamicPort} for ${serverKey}...`);
                    
                    const retryServer = net.createServer({ allowHalfOpen: true }, (socket) => {
                        if (!ssh.connection) {
                            return socket.end();
                        }
                        ssh.connection.forwardOut(
                            '127.0.0.1',
                            socket.remotePort,
                            '127.0.0.1',
                            remotePort,
                            (err, stream) => {
                                if (err) {
                                    logger.error(`[SSH Tunnel] Forwarding error for ${serverKey}:`, err.message);
                                    return socket.end();
                                }
                                socket.pipe(stream).pipe(socket);
                                stream.on('close', () => socket.destroy());
                                socket.on('close', () => stream.destroy());
                            }
                        );
                    });

                    await this._listenWithRetry(retryServer, dynamicPort, serverKey);
                    
                    // Use the retry server with the dynamic port
                    this.connections.set(serverKey, ssh);
                    this.tunnels.set(serverKey, {
                        localPort: dynamicPort,
                        remoteHost,
                        remotePort,
                        status: 'active',
                        server: retryServer,
                        createdAt: new Date()
                    });
                    this.reconnectAttempts.set(serverKey, 0);
                    this._setupSSHHandlers(ssh, serverKey, remoteHost, dynamicPort, remotePort);

                    logger.info(`[SSH Tunnel] ✅ Tunnel established (dynamic port): ${serverKey}`, {
                        localPort: dynamicPort,
                        remoteHost,
                        remotePort,
                        mapping: `localhost:${dynamicPort} → ${remoteHost}:${remotePort}`
                    });

                    return { success: true, localPort: dynamicPort };
                }
                throw listenError;
            }

            // Store connection and tunnel info
            this.connections.set(serverKey, ssh);
            this.tunnels.set(serverKey, {
                localPort,
                remoteHost,
                remotePort,
                status: 'active',
                server: tcpServer,
                createdAt: new Date()
            });

            // Reset reconnect attempts on success
            this.reconnectAttempts.set(serverKey, 0);

            // Set up SSH error/end handlers
            this._setupSSHHandlers(ssh, serverKey, remoteHost, localPort, remotePort);

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
     * Helper: listen on port with a retry after 2 seconds
     */
    async _listenWithRetry(server, port, serverKey, retries = 2) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                await new Promise((resolve, reject) => {
                    server.once('error', reject);
                    server.listen(port, '127.0.0.1', () => {
                        server.removeListener('error', reject);
                        resolve();
                    });
                });
                return; // Success
            } catch (err) {
                if (err.code === 'EADDRINUSE' && attempt < retries) {
                    logger.warn(`[SSH Tunnel] Port ${port} busy for ${serverKey}, retrying in 2s... (attempt ${attempt + 1}/${retries})`);
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    throw err;
                }
            }
        }
    }

    /**
     * Helper: set up SSH connection error & disconnect handlers
     */
    _setupSSHHandlers(ssh, serverKey, remoteHost, localPort, remotePort) {
        ssh.connection.on('error', (error) => {
            logger.error(`[SSH Tunnel] Connection error for ${serverKey}:`, error.message);
            this.handleDisconnect(serverKey, remoteHost, localPort, remotePort);
        });

        ssh.connection.on('end', () => {
            logger.warn(`[SSH Tunnel] Connection ended for ${serverKey}`);
            this.handleDisconnect(serverKey, remoteHost, localPort, remotePort);
        });
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

        this.tunnels.delete(serverKey);

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
     * Synchronous cleanup for process exit handler
     */
    closeAllTunnelsSync() {
        for (const [serverKey, tunnel] of this.tunnels) {
            if (tunnel && tunnel.server) {
                try { tunnel.server.close(); } catch (e) {}
            }
        }

        for (const [serverKey, ssh] of this.connections) {
            try { ssh.dispose(); } catch (e) {}
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

    /**
     * Mark a server as local (same machine as EC1 — no tunnel needed)
     */
    markAsLocal(serverKey) {
        this.localServers.add(serverKey);
        logger.info(`[SSH Tunnel] ${serverKey} marked as local server (no tunnel needed)`);
    }

    /**
     * Check if a server is marked as local
     */
    isMarkedLocal(serverKey) {
        return this.localServers.has(serverKey);
    }
}

// Export singleton instance
module.exports = new SSHTunnelManager();
