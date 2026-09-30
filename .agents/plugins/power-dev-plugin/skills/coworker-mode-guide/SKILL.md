---
name: coworker-mode-guide
description: >-
  Activate this skill when working in Coworker mode, or when the user asks 
  about long-running tasks, overnight goals, parallel subagents, scheduled tasks, 
  or how to orchestrate complex multi-step coding workflows. 
  Explains when to use Coworker vs Code mode and how to prompt each.
---

# Coworker Mode vs Code Mode — Complete Guide

## What Each Mode Is

### 🤝 Coworker Mode
- Runs **long, multi-step tasks** autonomously
- Can spawn **subagents** in parallel (research + coding simultaneously)
- Has access to **browser, memory, MCP servers, skills**
- Best for: "Do everything for this feature end-to-end"
- Think of it as: **a senior dev who plans → researches → codes → deploys → verifies**

### 💻 Code Mode  
- Focused **inline code editing** in your open file
- Faster, lower latency
- Best for: targeted edits, quick fixes, refactors
- Think of it as: **autocomplete on steroids**

---

## When to Use Which

| Situation | Use |
|---|---|
| "Fix this syntax error" | **Code** |
| "Add a button to this component" | **Code** |
| "Refactor this function" | **Code** |
| "Build the entire auth system" | **Coworker** |
| "Research + implement Redis caching" | **Coworker** |
| "Deploy, check logs, fix the bug" | **Coworker** |
| "Run all tests and fix failures" | **Coworker** |
| "Set up MCP servers" | **Coworker** |
| Overnight autonomous task | **Coworker + /goal** |

---

## How to Prompt Each Mode Effectively

### Coworker — Powerful Prompts
Give it **full context + desired outcome**. Let it plan.

✅ Good:
```
Research the best way to add Redis caching to our Next.js API routes.
Check the current backend structure first, look at docs online, 
then implement it, deploy to server, check logs, and screenshot the result.
```

✅ With /goal (overnight):
```
/goal Add complete payment webhook handling for Stripe and EasyPaisa.
Research their APIs, implement backend routes, add frontend status UI,
deploy via SSH, run tests, verify on https://newsbuzz.site
```

✅ Parallel research:
```
While you implement the MongoDB aggregation, also research if 
there's a faster approach using Atlas Search. Compare both and 
pick the best one.
```

❌ Bad (too vague):
```
make the site faster
```

❌ Bad (micromanaging):
```
First open file X, then change line 42, then save, then...
```

### Code Mode — Sharp Prompts
Be **exact** about what to change and where.

✅ Good:
```
In this function, replace the forEach with a Promise.all so 
the API calls run in parallel
```

✅ Good:
```
Add TypeScript types for the `userData` parameter — it should be 
{ id: string; email: string; role: 'admin' | 'user' }
```

❌ Bad:
```
improve this
```

---

## MCP Servers — What They Give You

| MCP Server | What It Does | Use When |
|---|---|---|
| `memory` | Persistent knowledge graph across sessions | Always — stores your project facts |
| `puppeteer` | Browser automation, screenshots, console errors | Verifying live site, testing UI |
| `sequentialthinking` | Forces step-by-step reasoning | Complex multi-file bugs |
| `fetch` | Reads live web pages / docs | Researching APIs before coding |
| `github` | PRs, issues, commits, code review | Git workflow integration |
| `filesystem` | Deep file operations, search | Large codebase navigation |
| `brave-search` | Web search | Finding solutions, docs |

### How to Trigger MCP in Prompts
Just describe what you need — the agent picks the right MCP tool:
```
"Check the official Next.js docs for App Router caching"
→ Uses fetch MCP to read https://nextjs.org/docs/...

"Screenshot the live site and check for errors"  
→ Uses puppeteer MCP

"Remember that our MongoDB collection is called 'articles'"
→ Uses memory MCP to store this fact

"Search for the fix for PM2 ENOENT error on Ubuntu"
→ Uses brave-search MCP
```

---

## Skills — What They Give You

| Skill | Activates When |
|---|---|
| `deep-research-before-code` | Starting any complex feature — research first |
| `ssh-deploy-and-monitor` | Deploying, checking logs, restarting PM2 |
| `live-preview-verifier` | Verifying site after deploy |
| `test-runner` | Running tests locally or remotely |

Skills load **automatically** when relevant — you don't need to type their name.
But you CAN explicitly say: "Use the ssh-deploy-and-monitor skill"

---

## Power Combinations

### 🔥 Full Feature Cycle (Best Practice)
```
1. Coworker: "Research [topic] online first, then implement..."
   → deep-research-before-code skill activates
   → fetch/brave-search MCP used
   
2. Coworker: Writes and edits files locally
   → filesystem MCP for large searches
   
3. Coworker: "Deploy this to the server"
   → ssh-deploy-and-monitor skill activates
   → Python SCP scripts + SSH commands
   
4. Coworker: "Check if it works"
   → live-preview-verifier skill activates
   → puppeteer MCP screenshots site
   
5. Memory MCP stores: what was deployed, what broke, what fixed it
```

### 🔥 Overnight /goal Prompt Template
```
/goal 
Context: [Brief description of the project and current state]
Task: [What needs to be built/fixed]
Research: [What to look up online before coding]
Deploy: [Yes/No — deploy to server after coding]
Verify: [Take screenshot, run tests, check logs]
Constraints: [Any limits — don't touch X, use Y approach]
```

---

## Tips for Complex Tasks

1. **Always mention the constraint** — "We're on Windows PowerShell + Ubuntu SSH"
2. **Reference this project** — "Our backend is at `backend/services/`"
3. **Ask for research first** — "Research before coding"
4. **Ask for verification** — "After deploying, screenshot the live site"
5. **Use /goal for big tasks** — It forces the agent to not stop until done
6. **Use memory** — "Remember this for next time: [fact]"
