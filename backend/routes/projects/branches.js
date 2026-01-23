const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth, requireProjectAccess } = require('../../middleware/auth');
const github = require('../../services/github');
const logger = require('../../utils/logger');

// GET /api/projects/:id/branches - Get repository branches
router.get('/', requireAuth, requireProjectAccess('viewer'), async (req, res) => {
    try {
        const project = req.project;
        const user = req.user;

        if (!project.repository || !project.repository.fullName) {
            return res.status(400).json({
                success: false,
                error: 'Project does not have a connected repository'
            });
        }

        // Fetch branches from GitHub
        const [owner, repo] = project.repository.fullName.split('/');

        try {
            const octokit = await github.getAuthenticatedClient(user);
            const { data: branches } = await octokit.repos.listBranches({
                owner,
                repo,
                per_page: 100
            });

            res.json({
                success: true,
                branches: branches.map(b => ({
                    name: b.name,
                    commit: {
                        sha: b.commit.sha,
                        url: b.commit.url
                    },
                    protected: b.protected
                }))
            });
        } catch (githubError) {
            logger.error('GitHub API error:', githubError);

            // Fallback to common branches
            res.json({
                success: true,
                branches: [
                    { name: 'main', commit: { sha: '', url: '' } },
                    { name: 'master', commit: { sha: '', url: '' } },
                    { name: 'develop', commit: { sha: '', url: '' } },
                    { name: project.repository.branch || 'main', commit: { sha: '', url: '' } }
                ].filter((b, i, arr) => arr.findIndex(x => x.name === b.name) === i) // Unique
            });
        }
    } catch (error) {
        logger.error('Get branches error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch branches'
        });
    }
});

module.exports = router;
