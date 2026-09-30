---
name: deep-research-before-code
description: >-
  Activate this skill before starting ANY complex coding task that involves
  new libraries, APIs, deployment configs, or unfamiliar patterns.
  This skill guides the agent to: research the web first, read live docs,
  check GitHub issues, find best practices, THEN write code.
  Use when the user says "research first", "check docs", "find the best way", 
  or when the task involves third-party APIs, npm packages, or cloud services.
---

# Deep Research Before Code — Skill

## When to Use
- User asks to integrate a new npm package or API
- User reports a bug that might be a known issue upstream
- Task involves cloud/server config (nginx, PM2, MongoDB, Next.js)
- Unfamiliar library or pattern is needed
- Need to verify correct environment variables or API schemas

## Research Workflow (Run in Order)

### Step 1 — Query Memory Graph
```
Query the memory MCP server for any related entities on the topic.
Look for: past bugs, past API keys, config patterns, known failures.
```

### Step 2 — Web Search for Current Best Practices
Use the `brave-search` MCP tool (if available) or `search_web` to:
- Search: `"<library> best practices 2025 site:github.com OR site:docs.npmjs.com"`
- Search: `"<error message> fix site:stackoverflow.com OR site:github.com/issues"`
- Always check if there is a **newer version** than what is installed locally

### Step 3 — Fetch Live Documentation
Use the `fetch` MCP tool or `read_url_content` to read:
- Official docs page for the package/API
- GitHub README if the package is on GitHub
- Changelog to check for breaking changes vs the installed version

```
fetch_url: https://www.npmjs.com/package/<package-name>
fetch_url: https://github.com/<org>/<repo>#readme
```

### Step 4 — Check Current Project Version
Run locally:
```powershell
cat D:\work\platform\frontend\package.json
cat D:\work\platform\backend\package.json
```
Compare installed versions vs latest. Note any major version gaps.

### Step 5 — Summarize Research Findings
Before writing a single line of code, output a **Research Summary** block:
```
## Research Summary
- Package: <name> v<installed> → latest: v<latest>
- Breaking changes: <yes/no — details>
- Correct API / config pattern: <paste snippet>
- Known issues: <any open GitHub issues relevant to our setup>
- Decision: <what approach we will take and why>
```

### Step 6 — Then Write Code
Only after the Research Summary is confirmed, proceed to implement.
Always reference the exact API signature found in docs.

## Tips
- Never assume an API signature from memory — always verify against live docs
- When researching MongoDB or Next.js, also check official GitHub Discussions
- For SSH server issues, search `ubuntu PM2 <topic> site:stackoverflow.com`
