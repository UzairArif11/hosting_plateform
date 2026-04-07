const express = require('express');
const router = express.Router();
const Invitation = require('../models/Invitation');
const Project = require('../models/Project');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const notify = require('../services/notificationService');

// POST /api/projects/:id/invitations - Send invitation
router.post('/projects/:id/invitations', requireAuth, async (req, res) => {
    try {
        const { email, role = 'viewer' } = req.body;
        const projectId = req.params.id;
        const userId = req.user.id;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Verify project exists and user has admin access
        const project = await Project.findById(projectId).populate('owner');
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user is owner or admin collaborator
        const isOwner = project.owner._id.toString() === userId;
        const isAdmin = project.collaborators.some(
            c => c.user.toString() === userId && c.role === 'admin'
        );

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Only project admins can invite members' });
        }

        // CHECK PLAN FEATURE - Team Collaboration
        const owner = await User.findById(project.owner).populate('plan');
        if (!owner || !owner.plan) {
            return res.status(403).json({ error: 'Plan information unavailable' });
        }

        // Check teamCollaboration feature using centralized utility
        const { hasFeature } = require('../utils/featureCheck');
        if (!hasFeature(owner.plan, 'teamCollaboration')) {
            return res.status(403).json({
                error: 'Team collaboration not available in your plan',
                upgradeRequired: true
            });
        }
        
        // Get feature config for collaborator limits
        const collaborationFeature = owner.plan.features?.find(f => 
            (typeof f === 'string' && f === 'teamCollaboration') || 
            (f.name === 'teamCollaboration')
        );

        // Check collaborator limit
        const maxCollaborators = collaborationFeature.config?.maxCollaborators || 5;
        const currentCollaborators = project.collaborators.length;

        if (currentCollaborators >= maxCollaborators) {
            return res.status(403).json({
                error: `Maximum collaborators (${maxCollaborators}) reached for your plan`,
                upgrade: true
            });
        }

        // Check if user is already a collaborator
        const isAlreadyCollaborator = project.collaborators.some(
            c => c.user && c.user.toString() === email // This won't work, we need to check email differently
        );

        // Better: Find user by email first
        const inviteeUser = await User.findOne({ email: email.toLowerCase() });
        if (inviteeUser) {
            // Check if already collaborator
            const alreadyAdded = project.collaborators.some(
                c => c.user.toString() === inviteeUser._id.toString()
            );
            if (alreadyAdded) {
                return res.status(400).json({ error: 'User is already a collaborator' });
            }

            // Check if user is the owner
            if (project.owner._id.toString() === inviteeUser._id.toString()) {
                return res.status(400).json({ error: 'Cannot invite project owner' });
            }
        }

        // Check if there's already a pending invitation
        const existingInvite = await Invitation.findOne({
            projectId,
            email: email.toLowerCase(),
            status: 'pending'
        });

        if (existingInvite) {
            return res.status(400).json({
                error: 'An invitation is already pending for this email',
                token: existingInvite.token // For dev/testing - remove in production
            });
        }

        // Create invitation
        const invitation = await Invitation.create({
            projectId,
            inviterId: userId,
            email: email.toLowerCase(),
            role,
            token: Invitation.generateToken(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${invitation.token}`;

        try {
            const inviter = await User.findById(userId);
            await notify.invitationSent(
                email.toLowerCase(),
                project.name,
                inviter?.displayName || inviter?.username || 'A team member',
                inviteLink
            );
        } catch (emailErr) {
            logger.warn('Invitation email failed (non-fatal):', emailErr.message);
        }

        logger.info('Invitation created', {
            projectId,
            email,
            role,
            inviterId: userId
        });

        res.json({
            success: true,
            invitation: {
                id: invitation._id,
                email: invitation.email,
                role: invitation.role,
                expiresAt: invitation.expiresAt,
                inviteLink // Remove in production after email is implemented
            },
            message: 'Invitation sent successfully'
        });

    } catch (error) {
        logger.error('Send invitation error:', error);
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

// GET /api/invitations/:token - Validate invitation (public)
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const invitation = await Invitation.findOne({ token })
            .populate('projectId', 'name slug')
            .populate('inviterId', 'username email displayName');

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        if (invitation.isExpired()) {
            invitation.status = 'expired';
            await invitation.save();
            return res.status(400).json({ error: 'Invitation has expired' });
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json({ error: `Invitation is ${invitation.status}` });
        }

        res.json({
            success: true,
            invitation: {
                projectName: invitation.projectId.name,
                projectSlug: invitation.projectId.slug,
                role: invitation.role,
                inviterName: invitation.inviterId.displayName || invitation.inviterId.username,
                email: invitation.email,
                expiresAt: invitation.expiresAt
            }
        });

    } catch (error) {
        logger.error('Validate invitation error:', error);
        res.status(500).json({ error: 'Failed to validate invitation' });
    }
});

// POST /api/invitations/:token/accept - Accept invitation (requires auth)
router.post('/:token/accept', requireAuth, async (req, res) => {
    try {
        const { token } = req.params;
        const userId = req.user.id;

        const invitation = await Invitation.findOne({ token }).populate('projectId');

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify user email matches invitation
        const user = await User.findById(userId);
        if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
            return res.status(403).json({
                error: 'This invitation was sent to a different email address'
            });
        }

        // Accept the invitation
        await invitation.accept(userId);

        // Add user to project collaborators
        const project = invitation.projectId;

        // Check if already added (race condition safety)
        const alreadyAdded = project.collaborators.some(
            c => c.user.toString() === userId
        );

        if (!alreadyAdded) {
            project.collaborators.push({
                user: userId,
                role: invitation.role,
                addedAt: new Date()
            });
            await project.save();
        }

        logger.info('Invitation accepted', {
            projectId: project._id,
            userId,
            role: invitation.role
        });

        res.json({
            success: true,
            project: {
                id: project._id,
                name: project.name,
                slug: project.slug
            },
            role: invitation.role,
            message: 'Successfully joined the project'
        });

    } catch (error) {
        logger.error('Accept invitation error:', error);
        res.status(500).json({ error: error.message || 'Failed to accept invitation' });
    }
});

// GET /api/projects/:id/invitations - List pending invitations (admin only)
router.get('/projects/:id/invitations', requireAuth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check admin access
        const isOwner = project.owner.toString() === userId;
        const isAdmin = project.collaborators.some(
            c => c.user.toString() === userId && c.role === 'admin'
        );

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const invitations = await Invitation.find({
            projectId,
            status: 'pending'
        }).populate('inviterId', 'username displayName');

        res.json({
            success: true,
            invitations: invitations.map(inv => ({
                id: inv._id,
                email: inv.email,
                role: inv.role,
                invitedBy: inv.inviterId.displayName || inv.inviterId.username,
                createdAt: inv.createdAt,
                expiresAt: inv.expiresAt
            }))
        });

    } catch (error) {
        logger.error('List invitations error:', error);
        res.status(500).json({ error: 'Failed to list invitations' });
    }
});

// DELETE /api/invitations/:id - Cancel invitation
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const invitationId = req.params.id;
        const userId = req.user.id;

        const invitation = await Invitation.findById(invitationId).populate('projectId');
        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        const project = invitation.projectId;

        // Check if user is owner or admin
        const isOwner = project.owner.toString() === userId;
        const isAdmin = project.collaborators.some(
            c => c.user.toString() === userId && c.role === 'admin'
        );

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        invitation.status = 'cancelled';
        await invitation.save();

        res.json({
            success: true,
            message: 'Invitation cancelled'
        });

    } catch (error) {
        logger.error('Cancel invitation error:', error);
        res.status(500).json({ error: 'Failed to cancel invitation' });
    }
});

module.exports = router;
