---
name: claude-code-proxy-config
description: Constraints for configuring custom API keys (TabiToken/AgentRouter) for the Claude Code VS Code extension
---

# Claude Code Extension Configuration

When configuring the Claude Code VS Code extension to use custom endpoints (like TabiToken):

1. **Use `ANTHROPIC_AUTH_TOKEN`:** You MUST use `ANTHROPIC_AUTH_TOKEN` inside the `claudeCode.environmentVariables` array in `settings.json`.
2. **Override Model Caching:** You MUST pin all internal model selections to a model the gateway actually supports (e.g., `claude-opus-5`). If you don't, background requests will fail with 403s and trigger the OAuth login loop.
3. **Settings Format:** Use the following complete payload in VS Code's `settings.json`:
   ```json
   "claudeCode.environmentVariables": [
       { "name": "ANTHROPIC_BASE_URL", "value": "https://tabitoken.com" },
       { "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-your-key-here" },
       { "name": "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY", "value": "1" },
       { "name": "ANTHROPIC_MODEL", "value": "claude-opus-5" },
       { "name": "ANTHROPIC_SMALL_FAST_MODEL", "value": "claude-opus-5" },
       { "name": "CLAUDE_CODE_SUBAGENT_MODEL", "value": "claude-opus-5" },
       { "name": "ANTHROPIC_DEFAULT_OPUS_MODEL", "value": "claude-opus-5" },
       { "name": "ANTHROPIC_DEFAULT_SONNET_MODEL", "value": "claude-opus-5" },
       { "name": "ANTHROPIC_DEFAULT_HAIKU_MODEL", "value": "claude-opus-5" }
   ]
   ```
4. **Avoid `/model`:** Never use the `/model` slash command in the extension to pick standard models, as this will cache an unsupported model and break the extension again.
