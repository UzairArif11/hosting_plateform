const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const Project = require('../models/Project');
const User = require('../models/User'); // Ensure User model is loaded
const { requireAuth, requireProjectAccess } = require('../middleware/auth');
const logger = require('../utils/logger');
// Simple IP-to-Country lookup (mock/placeholder if geoip-lite not available, but usually we'd add it)
// For now, we'll try to use headers from Nginx or a simple lookup if possible.
// Note: In a real deploy, 'x-forwarded-for' or specific geo headers from load balancer (Cloudflare/AWS) are best.
const MockGeo = {
    lookup: (ip) => ({ country: 'US' })
};

// POST /api/analytics/collect
// Public endpoint - called by the tracking script
router.post('/collect', async (req, res) => {
    try {
        const { projectId, path, referrer, visitorId, browser, os, device, screenWidth } = req.body;

        if (!projectId || !visitorId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ error: 'Invalid Project ID format' });
        }

        // 1. Load Project and Owner to check Plan Limits
        // Optimization: Cache this or use a lightweight check if possible. 
        // For now, standard DB query.
        const project = await Project.findById(projectId).populate({
            path: 'owner',
            populate: { path: 'plan' }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // 2. CHECK PLAN FEATURE
        // "admin have power to give feutre to any plain or remove"
        const owner = project.owner;

        // Safety check if owner or plan is missing (shouldn't happen for active projects)
        if (!owner || !owner.plan) {
            // Default to allow or block? Block to save load.
            return res.status(403).json({ error: 'Plan status unknown' });
        }

        // Check analytics feature using centralized utility
        const { hasFeature } = require('../utils/featureCheck');

        // If analytics is strictly disabled for this plan
        if (!hasFeature(owner?.plan, 'analytics')) {
            // We return 200 to not break the client script with errors, but we DO NOT save the event.
            // This effectively "removes" the feature load from the DB layer.
            return res.status(200).json({ success: true, ignored: true });
        }

        // 3. Check Retention/Limits (Optional optimization)
        // const maxEvents = analyticsFeature.config?.maxEventsPerMonth || 10000;
        // ... check current month count ...

        // 4. Determine Country (from IP)
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

        // Real GeoIP lookup
        let country = 'Unknown';
        try {
            const geoip = require('geoip-lite');
            const geo = geoip.lookup(ip);
            if (geo && geo.country) {
                country = geo.country;
            }
        } catch (error) {
            logger.warn('GeoIP lookup failed:', error.message);
        }

        // 5. Save Event
        await AnalyticsEvent.create({
            projectId,
            visitorId, // Created by client fingerprinting usually
            path,
            referrer: referrer || 'Direct',
            browser,
            os,
            device,
            country,
            timestamp: new Date()
        });

        res.status(200).json({ success: true });

    } catch (error) {
        // Don't log full error stack for harmless analytics noise
        logger.warn('Analytics collect error:', error.message);
        res.status(500).json({ error: 'Internal error' });
    }
});

// GET /api/projects/:id/analytics/summary
// Protected - used by Dashboard
router.get('/projects/:id/analytics/summary', requireProjectAccess('viewer'), async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        const project = req.project; // Populated by middleware

        // 1. Check if user has access to VIEW analytics (could be plan restricted too)
        // If the PROJECT OWNER's plan doesn't have analytics, we shouldn't show data
        const owner = await User.findById(project.owner).populate('plan');
        const { hasFeature } = require('../utils/featureCheck');

        if (!hasFeature(owner.plan, 'analytics')) {
            return res.status(403).json({
                error: 'Analytics not enabled for this project plan',
                plan: owner.plan?.name || 'Unknown',
                upgradeRequired: true
            });
        }

        // 2. Calculate Date Range
        const now = new Date();
        let startDate = new Date();

        // Default 24h
        if (timeframe === '7d') startDate.setDate(now.getDate() - 7);
        else if (timeframe === '30d') startDate.setDate(now.getDate() - 30);
        else startDate.setHours(now.getHours() - 24);

        // 3. Aggregate Data
        // Aggregate Page Views by hour/day
        const matchStage = {
            projectId: project._id,
            timestamp: { $gte: startDate }
        };

        const stats = await AnalyticsEvent.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: timeframe === '24h' ? "%Y-%m-%d %H:00" : "%Y-%m-%d",
                            date: "$timestamp"
                        }
                    },
                    visitors: { $addToSet: "$visitorId" }, // approx unique visitors
                    pageViews: { $sum: 1 }
                }
            },
            {
                $project: {
                    date: "$_id",
                    visitors: { $size: "$visitors" },
                    pageViews: 1,
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);

        // Get Top breakdowns
        const getTop = async (field) => {
            return AnalyticsEvent.aggregate([
                { $match: matchStage },
                { $group: { _id: `$${field}`, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);
        };

        const [topPaths, topReferrers, topDevices, topCountries] = await Promise.all([
            getTop('path'),
            getTop('referrer'),
            getTop('device'),
            getTop('country')
        ]);

        res.json({
            success: true,
            data: {
                chart: stats,
                top: {
                    paths: topPaths,
                    referrers: topReferrers,
                    devices: topDevices,
                    countries: topCountries
                }
            }
        });

    } catch (error) {
        logger.error('Analytics summary error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// GET /api/analytics/global - Get aggregated stats across all user projects
router.get('/global', requireAuth, async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        const userId = req.user.id;

        // Get all projects owned by user
        const projects = await Project.find({ owner: userId }).select('_id');
        const projectIds = projects.map(p => p._id);

        if (projectIds.length === 0) {
            return res.json({
                success: true,
                data: {
                    totalDeployments: 0,
                    totalPageViews: 0,
                    totalVisitors: 0,
                    chart: []
                }
            });
        }

        // Calculate date range
        const now = new Date();
        let startDate = new Date();
        if (timeframe === '7d') startDate.setDate(now.getDate() - 7);
        else if (timeframe === '30d') startDate.setDate(now.getDate() - 30);
        else startDate.setHours(now.getHours() - 24);

        const matchStage = {
            projectId: { $in: projectIds },
            timestamp: { $gte: startDate }
        };

        // Get aggregated stats
        const [chartData, totalStats] = await Promise.all([
            AnalyticsEvent.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: timeframe === '24h' ? "%Y-%m-%d %H:00" : "%Y-%m-%d",
                                date: "$timestamp"
                            }
                        },
                        visitors: { $addToSet: "$visitorId" },
                        pageViews: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        date: "$_id",
                        visitors: { $size: "$visitors" },
                        pageViews: 1,
                        _id: 0
                    }
                },
                { $sort: { date: 1 } }
            ]),
            AnalyticsEvent.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalPageViews: { $sum: 1 },
                        uniqueVisitors: { $addToSet: "$visitorId" }
                    }
                },
                {
                    $project: {
                        totalPageViews: 1,
                        totalVisitors: { $size: "$uniqueVisitors" }
                    }
                }
            ])
        ]);

        // Get deployment count from Deployment model
        const Deployment = require('../models/Deployment');
        const deploymentCount = await Deployment.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate }
        });

        const stats = totalStats[0] || { totalPageViews: 0, totalVisitors: 0 };

        res.json({
            success: true,
            data: {
                totalDeployments: deploymentCount,
                totalPageViews: stats.totalPageViews,
                totalVisitors: stats.totalVisitors,
                chart: chartData
            }
        });

    } catch (error) {
        logger.error('Global analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

module.exports = router;
