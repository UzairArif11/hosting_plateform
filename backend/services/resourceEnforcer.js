const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const Deployment = require('../models/Deployment');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const Server = require('../models/Server');
const { ORACLE_SERVERS } = require('./containerOrchestrator');
const { resolveSSHKey, resolveHost } = require('../utils/serverResolver');

let enforcementInterval = null;
const lastEmailSent = new Map(); // Key: userId-type, Value: timestamp


// Start Enforcement Loop
const startEnforcement = () => {
    if (enforcementInterval) return;
    logger.info('🛡️ Starting Resource Enforcement Service (Interval: 5m)');

    // Check every 5 minutes
    enforcementInterval = setInterval(runEnforcementCycle, 5 * 60 * 1000);
    // Run immediately on start
    runEnforcementCycle();
};

const runEnforcementCycle = async () => {
    try {
        const users = await User.find({
            containerName: { $exists: true, $ne: null },
            assignedServer: { $exists: true }
        });

        logger.info(`🛡️ running enforcement for ${users.length} active users`);

        for (const user of users) {
            await checkUserResources(user);
        }
    } catch (error) {
        logger.error('Resource enforcement cycle failed:', error);
    }
};

const checkUserResources = async (user) => {
    // Admin accounts and override users are exempt from resource enforcement
    // Admins run demo deployments across all templates and must not be killed
    if (user.role === 'admin') {
        return;
    }
    if (user.adminOverride && user.adminOverride.enabled) {
        return;
    }
    const ssh = new NodeSSH();
    try {

        const { assignedServer: serverKey, containerName } = user;

        // Resolve Server Host (dynamic — DB-backed cache → env fallback)
        const host = resolveHost(serverKey);

        // Connect
        const keyPath = resolveSSHKey(serverKey);
        if (!keyPath) {
            logger.warn(`SSH Key not found for ${serverKey}`);
            return;
        }

        const keyContent = fs.readFileSync(keyPath, 'utf8');
        await ssh.connect({
            host: host,
            username: process.env.SSH_USERNAME || 'ubuntu',
            privateKey: keyContent
        });

        // 1. Get PM2 Stats (RAM)
        // pm2 jlist returns JSON array
        const pm2Cmd = `docker exec ${containerName} pm2 jlist`;
        const pm2Result = await ssh.execCommand(pm2Cmd);
        let processes = [];
        try {
            if (pm2Result.code === 0 && pm2Result.stdout) {
                // Find valid JSON part (sometimes PM2 outputs logs)
                const jsonStr = pm2Result.stdout.substring(pm2Result.stdout.indexOf('['));
                processes = JSON.parse(jsonStr);
            }
        } catch (e) {
            logger.warn(`Failed to parse PM2 list for ${user.email}:`, e.message);
        }

        // 2. Get Storage Stats
        // du -sk returns size in KB
        const storageCmd = `docker exec ${containerName} du -sk /app/projects/*`;
        const storageResult = await ssh.execCommand(storageCmd);
        const folderSizes = []; // { path, sizeKB, projectId }
        if (storageResult.code === 0 && storageResult.stdout) {
            const lines = storageResult.stdout.trim().split('\n');
            for (const line of lines) {
                const [size, path] = line.split('\t');
                if (path) {
                    const projectId = path.split('/').pop();
                    folderSizes.push({ projectId, sizeKB: parseInt(size) || 0 });
                }
            }
        }

        // 3. Calculate Totals & Limits
        const limits = user.resourceAllocation || { ram: 1, storage: 10 };
        const maxRamBytes = limits.ram * 1024 * 1024 * 1024;
        const maxStorageBytes = limits.storage * 1024 * 1024 * 1024;

        // --- RAM ENFORCEMENT ---
        // Sum total RAM used by all PM2 processes
        // Grace period: skip killing processes that started less than 5 minutes ago
        // (Next.js startup spike is temporary and should not trigger enforcement)
        const STARTUP_GRACE_MS = 5 * 60 * 1000; // 5 minutes
        const now = Date.now();

        let totalRamUsage = 0;
        const processUsage = [];

        processes.forEach(p => {
            const mem = p.monit ? p.monit.memory : 0;
            totalRamUsage += mem;
            const startedAt = p.pm2_env?.created_at || 0;
            const ageMs = now - startedAt;
            const inGracePeriod = ageMs < STARTUP_GRACE_MS;
            processUsage.push({ name: p.name, mem, pm_id: p.pm_id, inGracePeriod, ageMs });
        });

        // Determine Thresholds (Admin Configurable)
        let warnPercent = 80;
        let stopPercent = 90;
        try {
            const settings = await Settings.getSettings();
            if (settings.resourceLimits) {
                warnPercent = settings.resourceLimits.warnThreshold;
                stopPercent = settings.resourceLimits.stopThreshold;
            }
        } catch (e) { }

        const warnThreshold = warnPercent / 100;
        const stopThreshold = stopPercent / 100;

        const ramRatio = totalRamUsage / maxRamBytes;

        if (ramRatio > stopThreshold) {
            // Only kill from processes that have passed the startup grace period
            const matureProcesses = processUsage.filter(p => !p.inGracePeriod);
            if (matureProcesses.length === 0) {
                // All processes are in grace period - log and skip enforcement this cycle
                logger.info(`RAM overload for ${user.email} but all processes in startup grace period - skipping kill`);
            } else {
                // STOP HIGHEST CONSUMER (from mature processes only)
                const highest = matureProcesses.sort((a, b) => b.mem - a.mem)[0];
                if (highest) {
                    await killProcess(ssh, containerName, highest, user, 'RAM', totalRamUsage, maxRamBytes);
                }
            }
        } else if (ramRatio > warnThreshold) {
            // WARN
            await sendWarning(user, 'RAM', totalRamUsage, maxRamBytes, ramRatio * 100);
        }


        // --- STORAGE ENFORCEMENT ---
        let totalStorageKB = 0;
        folderSizes.forEach(f => totalStorageKB += f.sizeKB);
        const totalStorageBytes = totalStorageKB * 1024;
        const storageRatio = totalStorageBytes / maxStorageBytes;

        if (storageRatio > stopThreshold) {
            // STOP & DELETE HIGHEST STORAGE USER
            const highest = folderSizes.sort((a, b) => b.sizeKB - a.sizeKB)[0];
            if (highest) {
                await killStorage(ssh, containerName, highest, user, totalStorageBytes, maxStorageBytes);
            }
        } else if (storageRatio > warnThreshold) {
            await sendWarning(user, 'Storage', totalStorageBytes, maxStorageBytes, storageRatio * 100);
        }

    } catch (err) {
        // Ignore timeouts/connection errors to avoid spam
        if (!err.message?.includes('Timed out')) {
            logger.error(`Enforcement error for ${user.email}:`, err);
        }
    } finally {
        ssh.dispose();
    }
};

const sendWarning = async (user, type, used, limit, percent) => {
    const key = `${user._id}-${type}-warn`;
    const now = Date.now();
    // Throttle emails (1 hour)
    if (lastEmailSent.has(key) && (now - lastEmailSent.get(key) < 3600000)) return;

    lastEmailSent.set(key, now);

    // Create Notification
    const message = `Your ${type} usage is at ${percent.toFixed(1)}% (${formatBytes(used)} / ${formatBytes(limit)}). If it exceeds limits, deployments may be stopped.`;
    await Notification.create({
        userId: user._id,
        title: `High ${type} Usage Warning`,
        message,
        type: 'warning',
        resourceType: type.toLowerCase()
    });

    // Send Email (respects user email preferences)
    if (user.preferences?.notifications?.resources !== false) {
        await sendEmail(user.email, `⚠️ High ${type} Usage Alert`, message);
    }
};

const killProcess = async (ssh, containerName, proc, user, type, used, limit) => {
    logger.warn(`🛑 Killing process ${proc.name} for user ${user.email} due to ${type} overload.`);

    // Stop PM2
    await ssh.execCommand(`docker exec ${containerName} pm2 delete ${proc.name}`); // name is usually projectId

    // Update DB
    // Assuming proc.name is projectId
    const projectId = proc.name;
    let projectDetails = "";

    try {
        const project = await Project.findById(projectId);
        if (project) {
            projectDetails = `Project: ${project.name}`;
            // Mark only the latest active deployment as stopped (not all of them)
            await Deployment.findOneAndUpdate(
                { projectId: project._id, status: 'success' },
                { status: 'failed', failureReason: `${type} resource limit exceeded` },
                { sort: { createdAt: -1 } } // Only the most recent
            );
        }
    } catch (e) { }

    // Notify
    const message = `We stopped deployment ${projectDetails} because your ${type} usage reached critical levels (${formatBytes(used)} / ${formatBytes(limit)}). Please upgrade your plan.`;

    await Notification.create({
        userId: user._id,
        title: `Deployment Stopped (${type} Overload)`,
        message,
        type: 'error',
        resourceType: type.toLowerCase()
    });

    await sendEmail(user.email, `🛑 Deployment Stopped: Resource Limit Exceeded`, message);
};

const killStorage = async (ssh, containerName, folder, user, used, limit) => {
    logger.warn(`🛑 Deleting project ${folder.projectId} for user ${user.email} due to Storage overload.`);

    // 1. Stop PM2 (if running)
    await ssh.execCommand(`docker exec ${containerName} pm2 delete ${folder.projectId}`);

    // 2. Delete File Content (Aggressive but requested)
    // "stop and del that proccess... removed becuse its used more resourses ram or storage"
    // To free storage we must delete files.
    // We'll delete /app/projects/ID
    await ssh.execCommand(`docker exec ${containerName} rm -rf /app/projects/${folder.projectId}`);

    // Notify
    const message = `We removed deployment/files for Project ID ${folder.projectId} because Storage usage reached critical levels (${formatBytes(used)} / ${formatBytes(limit)}).`;

    await Notification.create({
        userId: user._id,
        title: `Deployment Removed (Storage Overload)`,
        message,
        type: 'error',
        resourceType: 'storage'
    });

    await sendEmail(user.email, `🛑 Deployment Removed: Storage Limit Exceeded`, message);
};

const sendEmail = async (to, subject, text) => {
    try {
        const settings = await Settings.getSettings();
        if (settings.alertConfig?.enabled && settings.alertConfig?.email && settings.alertConfig?.password) {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || undefined,
                port: process.env.SMTP_PORT || undefined,
                secure: process.env.SMTP_SECURE === 'true',
                service: !process.env.SMTP_HOST ? 'gmail' : undefined,
                auth: { user: settings.alertConfig.email, pass: settings.alertConfig.password }
            });

            // Send to User AND Admin
            await transporter.sendMail({
                from: settings.alertConfig.email,
                to: [to, settings.alertConfig.email], // User + Admin
                subject: `[Platform Alert] ${subject}`,
                text
            });
        }
    } catch (e) {
        logger.error('Failed to send enforcement email:', e);
    }
};

const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

module.exports = { startEnforcement };
