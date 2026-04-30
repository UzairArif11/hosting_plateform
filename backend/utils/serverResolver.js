/**
 * serverResolver.js — Single source of truth for resolving server host, SSH key,
 * and other server-specific config.  ALL files should use these helpers instead of
 * hardcoded process.env.EC2_SERVER_IP / process.env.SSH_EC2_KEY chains.
 *
 * Resolution order:
 *   1. ORACLE_SERVERS in-memory cache (populated from Server DB model)
 *   2. Legacy env var fallback (SSH_{KEY}_KEY, {KEY}_SERVER_IP)
 *
 * After admin sets up servers via the UI, the DB values take priority.
 */

const logger = require('./logger');

// Lazy-load to avoid circular deps at module-parse time
let _orcRef = null;
function getOracleServers() {
    if (!_orcRef) {
        _orcRef = require('../services/containerOrchestrator').ORACLE_SERVERS;
    }
    return _orcRef;
}

/**
 * Resolve the SSH private key **file path** for a server key (e.g. 'EC2').
 *
 * Priority:
 *   1. server.sshKeyEnvVar  → process.env[sshKeyEnvVar]  (DB-driven)
 *   2. server.sshKey        → literal path stored in DB
 *   3. process.env[`SSH_${serverKey}_KEY`]                (legacy fallback)
 */
function resolveSSHKey(serverKey) {
    if (!serverKey) return null;
    const servers = getOracleServers();
    const srv = servers[serverKey];

    // 1. DB: env var name stored in Server document
    if (srv?.sshKeyEnvVar && process.env[srv.sshKeyEnvVar]) {
        return process.env[srv.sshKeyEnvVar];
    }

    // 2. DB: direct path stored in Server document
    if (srv?.sshKey) return srv.sshKey;

    // 3. Legacy env var
    const legacyEnv = `SSH_${serverKey.toUpperCase()}_KEY`;
    if (process.env[legacyEnv]) return process.env[legacyEnv];

    logger.warn(`[serverResolver] No SSH key found for ${serverKey}`);
    return null;
}

/**
 * Resolve the IP / hostname for a server key.
 *
 * Priority:
 *   1. ORACLE_SERVERS[serverKey].host  (DB cache)
 *   2. process.env[`${serverKey}_SERVER_IP`]  (legacy)
 */
function resolveHost(serverKey) {
    if (!serverKey) return null;
    const servers = getOracleServers();
    if (servers[serverKey]?.host) return servers[serverKey].host;

    const legacyEnv = `${serverKey.toUpperCase()}_SERVER_IP`;
    if (process.env[legacyEnv]) return process.env[legacyEnv];

    return null;
}

/**
 * Get the SSH username (almost always 'ubuntu').
 */
function resolveSSHUser() {
    return process.env.SSH_USERNAME || 'ubuntu';
}

/**
 * Build a full SSH config object for node-ssh .connect().
 */
function getSSHConfig(serverKey) {
    const host = resolveHost(serverKey);
    const keyPath = resolveSSHKey(serverKey);
    const username = resolveSSHUser();

    if (!host)    throw new Error(`No host found for server ${serverKey}`);
    if (!keyPath) throw new Error(`No SSH key found for server ${serverKey}`);

    const fs = require('fs');
    return {
        host,
        username,
        privateKey: fs.readFileSync(keyPath, 'utf8'),
        readyTimeout: 10000,
        keepaliveInterval: 5000
    };
}

/**
 * Get the domain assigned to a server key (from DB cache).
 */
function resolveDomain(serverKey) {
    const servers = getOracleServers();
    return servers[serverKey]?.domain || '';
}

module.exports = {
    resolveSSHKey,
    resolveHost,
    resolveSSHUser,
    getSSHConfig,
    resolveDomain
};
