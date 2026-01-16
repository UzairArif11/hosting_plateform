/**
 * Multi-Git Provider Support
 * Abstracts git operations to support GitHub, GitLab, Bitbucket
 */

const axios = require('axios');
const logger = require('../utils/logger');

class GitProvider {
    constructor(repositoryUrl) {
        this.repositoryUrl = repositoryUrl;
        this.provider = this.detectProvider(repositoryUrl);
    }

    detectProvider(url) {
        if (url.includes('github.com')) return 'github';
        if (url.includes('gitlab.com')) return 'gitlab';
        if (url.includes('bitbucket.org')) return 'bitbucket';
        return 'unknown';
    }

    parseRepoInfo(url) {
        // Extract owner and repo from URL
        // GitHub: https://github.com/owner/repo
        // GitLab: https://gitlab.com/owner/repo
        const match = url.match(/[:/]([^/]+)\/([^/]+?)(\.git)?$/);
        if (!match) throw new Error('Invalid repository URL');

        return {
            owner: match[1],
            repo: match[2].replace('.git', '')
        };
    }

    async getRepositoryInfo(token) {
        const { owner, repo } = this.parseRepoInfo(this.repositoryUrl);

        switch (this.provider) {
            case 'github':
                return this.getGitHubInfo(owner, repo, token);
            case 'gitlab':
                return this.getGitLabInfo(owner, repo, token);
            default:
                throw new Error(`Unsupported provider: ${this.provider}`);
        }
    }

    async getGitHubInfo(owner, repo, token) {
        try {
            const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: { Authorization: `token ${token}` }
            });

            return {
                id: res.data.id,
                name: res.data.name,
                fullName: res.data.full_name,
                private: res.data.private,
                defaultBranch: res.data.default_branch,
                cloneUrl: res.data.clone_url,
                sshUrl: res.data.ssh_url
            };
        } catch (error) {
            logger.error('GitHub API error:', error.message);
            throw new Error('Failed to fetch GitHub repository info');
        }
    }

    async getGitLabInfo(owner, repo, token) {
        try {
            const projectPath = encodeURIComponent(`${owner}/${repo}`);
            const res = await axios.get(`https://gitlab.com/api/v4/projects/${projectPath}`, {
                headers: { 'PRIVATE-TOKEN': token }
            });

            return {
                id: res.data.id,
                name: res.data.name,
                fullName: res.data.path_with_namespace,
                private: res.data.visibility !== 'public',
                defaultBranch: res.data.default_branch,
                cloneUrl: res.data.http_url_to_repo,
                sshUrl: res.data.ssh_url_to_repo
            };
        } catch (error) {
            logger.error('GitLab API error:', error.message);
            throw new Error('Failed to fetch GitLab repository info');
        }
    }

    async listBranches(token) {
        const { owner, repo } = this.parseRepoInfo(this.repositoryUrl);

        switch (this.provider) {
            case 'github':
                return this.listGitHubBranches(owner, repo, token);
            case 'gitlab':
                return this.listGitLabBranches(owner, repo, token);
            default:
                return ['main']; // Fallback
        }
    }

    async listGitHubBranches(owner, repo, token) {
        try {
            const res = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/branches`,
                { headers: { Authorization: `token ${token}` } }
            );
            return res.data.map(b => b.name);
        } catch (error) {
            logger.error('Failed to list GitHub branches:', error.message);
            return ['main', 'master'];
        }
    }

    async listGitLabBranches(owner, repo, token) {
        try {
            const projectPath = encodeURIComponent(`${owner}/${repo}`);
            const res = await axios.get(
                `https://gitlab.com/api/v4/projects/${projectPath}/repository/branches`,
                { headers: { 'PRIVATE-TOKEN': token } }
            );
            return res.data.map(b => b.name);
        } catch (error) {
            logger.error('Failed to list GitLab branches:', error.message);
            return ['main', 'master'];
        }
    }
}

// Export factory function
module.exports = {
    createGitProvider: (repositoryUrl) => new GitProvider(repositoryUrl),

    // Legacy exports for backward compatibility
    getRepositoryInfo: async (owner, repo, token) => {
        const url = `https://github.com/${owner}/${repo}`;
        const provider = new GitProvider(url);
        return provider.getRepositoryInfo(token);
    },

    listRepositories: async (token) => {
        // GitHub only for now
        try {
            const res = await axios.get('https://api.github.com/user/repos', {
                headers: { Authorization: `token ${token}` },
                params: { per_page: 100, sort: 'updated' }
            });
            return res.data;
        } catch (error) {
            logger.error('Failed to list repositories:', error.message);
            return [];
        }
    }
};
