---
name: claude-code-windows-config
description: Constraints for configuring custom Anthropic API keys for the Claude Code VS Code extension on Windows
---

# Claude Code Extension on Windows

When configuring the Claude Code VS Code extension to use custom endpoints (like TabiToken) on **Windows**, `settings.json` and system variables are often ignored due to cached OAuth states, lingering processes, and Node TLS issues.

### Mandatory Configuration Steps:
1. **Purge Cached OAuth & Hardcode:** Edit `C:\Users\<Username>\.claude.json`. Delete the `"oauthAccount"` block entirely. Set `"primaryApiKey"` and `"apiEndpoint"` manually.
2. **Disable Node TLS Rejection:** Set the Windows User environment variable `NODE_TLS_REJECT_UNAUTHORIZED=0` to prevent the Node.js extension host from rejecting the proxy's SSL certificate.
3. **Hard Kill VS Code:** After updating any environment variables, you **must** forcefully kill all VS Code processes (`taskkill /IM Code.exe /F` or `Stop-Process -Name Code -Force`). Standard window closures leave background processes alive, preventing environment variable inheritance.
