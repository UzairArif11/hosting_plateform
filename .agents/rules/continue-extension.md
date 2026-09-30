# Continue Extension Configuration (v2.0+)

## 1. Schema Header
When creating or editing the `config.yaml` file for Continue extension (versions 2.0 and above), you MUST include the schema header at the root level. Failing to include these will result in a strict "Continue (config error)" and no models will be displayed.

```yaml
name: Main Config
version: 1.0.0
schema: v1
```

## 2. Model Definition Schema
You MUST use the `name:` key for model names in the `models` list. Do NOT use the `title:` key.

- ✅ Correct: `- name: Gemini 3.1 Pro (High)`
- ❌ Incorrect: `- title: Gemini 3.1 Pro (High)`

## 3. Roles
Continue 2.0 uses the `roles` array under each model to dictate what tasks the model can perform (e.g., `[chat, edit, apply, autocomplete, summarize]`). Do not use top-level keys like `tabAutocompleteModel`.

## 4. Context Providers
You can add built-in context providers under the `context` key at the root level (e.g., `- provider: url`).

## 5. MCP Servers
When configuring `mcpServers`, you MUST define it as a dictionary (object) where keys are server names, NOT as a list of objects.
- ✅ Correct:
```yaml
mcpServers:
  puppeteer:
    command: npx
```
- ❌ Incorrect:
```yaml
mcpServers:
  - name: puppeteer
    command: npx
```
