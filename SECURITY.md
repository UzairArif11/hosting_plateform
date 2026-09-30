# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainer at:

- **Email:** uzairarifkhan1@gmail.com
- **Subject:** `[SECURITY] hosting_platform — <brief description>`

### What to include

- A description of the vulnerability
- Steps to reproduce the issue
- Impact assessment
- Suggested fix (if any)

### Response timeline

- **Acknowledgment:** within 48 hours
- **Initial assessment:** within 7 days
- **Patch release:** within 30 days for critical issues

## Security Best Practices for Operators

1. **Never commit `.env` files** — use `.env.example` as a reference
2. **Rotate all secrets** before going to production (JWT_SECRET, SESSION_SECRET, database passwords)
3. **Set strong, unique passwords** for MongoDB and Redis (no defaults)
4. **Keep SSH keys secure** — never commit private keys to the repository
5. **Enable GitHub secret scanning** and Dependabot alerts
6. **Use HTTPS** in production with valid TLS certificates
7. **Restrict Docker daemon access** — SSH tunnels are used instead of exposing the Docker API

## Architecture Security Notes

- Docker access uses SSH tunnels (local port forwarding) — never exposed directly
- Authentication uses JWT with mandatory `JWT_SECRET` environment variable (no fallback)
- Rate limiting is enforced on all API endpoints
- Helmet.js provides HTTP security headers
- CORS is restricted to the configured `FRONTEND_URL`
- Session cookies use `httpOnly` and `secure` flags in production
