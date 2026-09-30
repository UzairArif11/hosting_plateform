# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-09-30

### Added
- Open-source release under MIT license
- Comprehensive README with architecture documentation
- Security policy (SECURITY.md)
- Contributing guidelines (CONTRIBUTING.md)
- Code of Conduct (CODE_OF_CONDUCT.md)
- GitHub Actions CI pipeline (lint, test, build, security audit)
- Input validation via express-validator on all API endpoints
- SSH tunnel architecture for secure remote Docker access
- Multi-server deployment support
- Subscription plans with configurable billing periods
- Payment integration (Paddle, manual payments)
- GitHub and Google OAuth authentication
- Real-time deployment logs via WebSocket
- Template system for quick project bootstrapping
- Team collaboration with invitations
- Resource enforcement (CPU, RAM, storage limits)
- Custom domain support with automatic Nginx configuration
- Account lifecycle management (suspension, deletion, recovery)

### Security
- Removed insecure default passwords from docker-compose.yml
- Replaced hardcoded JWT secret fallbacks with mandatory environment variable
- Docker API access secured via SSH tunnels (no direct exposure)
- Rate limiting on all API endpoints
- Helmet.js security headers
- httpOnly secure session cookies
- Input sanitization middleware
- Branch name validation to prevent command injection

### Fixed
- Removed production domain references from example files
- Fixed placeholder author in package.json
- Cleaned up PostCSS obfuscation code
