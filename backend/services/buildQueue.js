const Queue = require('bull');
const logger = require('../utils/logger');
const buildExecutor = require('./buildExecutor');
const websocket = require('./websocket');

// Create build queue with Redis
const buildQueue = new Queue('deployments', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200 // Keep last 200 failed jobs
    }
});

// Configurable build concurrency (default: 2 parallel builds)
const BUILD_CONCURRENCY = parseInt(process.env.BUILD_CONCURRENCY, 10) || 2;

// Job processor with configurable concurrency
buildQueue.process(BUILD_CONCURRENCY, async (job) => {
    const { deploymentId, projectId, userId } = job.data;

    logger.info(`Processing deployment job: ${deploymentId}`, {
        jobId: job.id,
        projectId,
        userId
    });

    try {
        // Update job progress
        await job.progress(0);

        // Emit initial status
        websocket.emitDeploymentStatus(deploymentId, 'building', {
            progress: 0,
            message: 'Starting deployment...'
        });

        // Execute build
        const result = await buildExecutor.executeBuild(deploymentId, {
            onProgress: async (progress) => {
                await job.progress(progress);

                // Emit progress via WebSocket
                websocket.emitDeploymentProgress(deploymentId, progress);
            },
            onLog: async (level, message) => {
                logger.info(`[${deploymentId}] ${message}`);

                // Emit log via WebSocket
                websocket.emitDeploymentLog(deploymentId, {
                    level,
                    message
                });
            }
        });

        await job.progress(100);

        // Save deployment URL to database (already done in buildExecutor, but ensure sync)
        const Deployment = require('../models/Deployment');
        const deployment = await Deployment.findById(deploymentId);

        if (deployment) {
            deployment.status = 'success';
            deployment.completedAt = new Date();
            if (result.url) deployment.deploymentUrl = result.url;
            await deployment.save();
        }

        // Emit completion with URL
        websocket.emitDeploymentStatus(deploymentId, 'success', {
            progress: 100,
            url: result.url,
            status: 'success', // Explicitly include status
            deploymentId: deploymentId, // Explicitly include deploymentId
            message: 'Deployment successful!'
        });

        logger.info(`Deployment completed successfully: ${deploymentId}`);
        return result;

    } catch (error) {
        logger.error(`Deployment failed: ${deploymentId}`, {
            error: error.message,
            stack: error.stack
        });

        // Emit failure status
        websocket.emitDeploymentStatus(deploymentId, 'failed', {
            error: error.message,
            message: `Deployment failed: ${error.message}`
        });

        throw error;
    }
});

// Event handlers

buildQueue.on('completed', (job, result) => {
    logger.info(`Job completed: ${job.id}`, {
        deploymentId: job.data.deploymentId,
        duration: Date.now() - job.timestamp
    });
});

buildQueue.on('failed', (job, error) => {
    logger.error(`Job failed: ${job.id}`, {
        deploymentId: job.data.deploymentId,
        error: error.message,
        attempts: job.attemptsMade
    });
});

buildQueue.on('stalled', async (job) => {
    logger.warn(`Job stalled: ${job.id}`, {
        deploymentId: job.data.deploymentId
    });

    try {
        const Deployment = require('../models/Deployment');
        const deployment = await Deployment.findById(job.data.deploymentId);
        if (deployment && ['queued', 'building', 'deploying'].includes(deployment.status)) {
            await deployment.updateStatus('failed', { error: { message: 'Job stalled (process likely crashed)' } });
            websocket.emitDeploymentStatus(deployment._id, 'failed', {
                error: 'Build process was interrupted',
                message: 'Internal error: The build process was interrupted. Please try again.'
            });
        }
    } catch (e) {
        logger.error('Failed to handle stalled job cleanup:', e);
    }
});

buildQueue.on('error', (error) => {
    logger.error('Queue error:', error);
});

// Queue management functions

/**
 * Add deployment to build queue
 */
async function addDeployment(deploymentId, projectId, userId, options = {}) {
    const jobOptions = {
        priority: options.priority || 10,
        delay: options.delay || 0,
        jobId: `deployment-${deploymentId}`,
        attempts: 1,  // Disable retries - user can manually retry
        removeOnComplete: false,
        removeOnFail: false
    };

    const job = await buildQueue.add({
        deploymentId,
        projectId,
        userId,
        ...options
    }, jobOptions);

    // Get position if available (some Bull versions don't have this method)
    let position = 'unknown';
    try {
        if (typeof job.getPosition === 'function') {
            position = await job.getPosition();
        }
    } catch (e) {
        // Ignore if getPosition fails
    }

    logger.info(`Deployment added to queue: ${deploymentId}`, {
        jobId: job.id,
        position
    });

    return job;
}

/**
 * Get job status
 */
async function getJobStatus(deploymentId) {
    const jobId = `deployment-${deploymentId}`;
    const job = await buildQueue.getJob(jobId);

    if (!job) {
        return null;
    }

    const state = await job.getState();
    const progress = job.progress();
    const position = await job.getPosition();

    return {
        id: job.id,
        state,
        progress,
        position,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason
    };
}

/**
 * Cancel deployment
 */
async function cancelDeployment(deploymentId) {
    const jobId = `deployment-${deploymentId}`;
    const job = await buildQueue.getJob(jobId);

    if (!job) {
        throw new Error('Job not found');
    }

    const state = await job.getState();

    if (state === 'completed' || state === 'failed') {
        throw new Error(`Cannot cancel ${state} job`);
    }

    await job.remove();
    logger.info(`Deployment cancelled: ${deploymentId}`);

    return true;
}

/**
 * Retry failed deployment
 */
async function retryDeployment(deploymentId, projectId, userId) {
    const jobId = `deployment-${deploymentId}`;
    const oldJob = await buildQueue.getJob(jobId);

    if (oldJob) {
        await oldJob.remove();
    }

    return addDeployment(deploymentId, projectId, userId, {
        priority: 5 // Higher priority for retries
    });
}

/**
 * Get queue stats
 */
async function getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        buildQueue.getWaitingCount(),
        buildQueue.getActiveCount(),
        buildQueue.getCompletedCount(),
        buildQueue.getFailedCount(),
        buildQueue.getDelayedCount()
    ]);

    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
    };
}

/**
 * Get active jobs
 */
async function getActiveJobs() {
    const jobs = await buildQueue.getActive();

    return Promise.all(jobs.map(async (job) => ({
        id: job.id,
        deploymentId: job.data.deploymentId,
        projectId: job.data.projectId,
        userId: job.data.userId,
        progress: job.progress(),
        processedOn: job.processedOn,
        attemptsMade: job.attemptsMade
    })));
}

/**
 * Get waiting jobs
 */
async function getWaitingJobs() {
    const jobs = await buildQueue.getWaiting();

    return Promise.all(jobs.map(async (job) => ({
        id: job.id,
        deploymentId: job.data.deploymentId,
        projectId: job.data.projectId,
        userId: job.data.userId,
        position: await job.getPosition(),
        timestamp: job.timestamp
    })));
}

/**
 * Clean old jobs
 */
async function cleanOldJobs(grace = 7 * 24 * 60 * 60 * 1000) { // 7 days
    const cleaned = await buildQueue.clean(grace, 'completed');
    logger.info(`Cleaned ${cleaned.length} old completed jobs`);

    const cleanedFailed = await buildQueue.clean(grace, 'failed');
    logger.info(`Cleaned ${cleanedFailed.length} old failed jobs`);

    return {
        completed: cleaned.length,
        failed: cleanedFailed.length
    };
}

/**
 * Pause queue
 */
async function pauseQueue() {
    await buildQueue.pause();
    logger.info('Build queue paused');
    return true;
}

/**
 * Resume queue
 */
async function resumeQueue() {
    await buildQueue.resume();
    logger.info('Build queue resumed');
    return true;
}

/**
 * Close queue gracefully
 */
async function closeQueue() {
    await buildQueue.close();
    logger.info('Build queue closed');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing build queue...');
    await closeQueue();
});

module.exports = {
    buildQueue,
    addDeployment,
    getJobStatus,
    cancelDeployment,
    retryDeployment,
    getQueueStats,
    getActiveJobs,
    getWaitingJobs,
    cleanOldJobs,
    pauseQueue,
    resumeQueue,
    closeQueue
};
