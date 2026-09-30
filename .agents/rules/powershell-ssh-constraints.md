---
trigger: always_on
---

# PowerShell + SSH Server Deployment Constraints

## Shell Environment: Windows PowerShell (NOT bash/zsh)

This user is on **Windows with PowerShell** connecting to an **Ubuntu Oracle Cloud server** via SSH.

### NEVER do in PowerShell run_command:
- Use `&&` or `||` to chain commands — PowerShell parser rejects them
- Use `$variable` syntax inside SSH strings — PowerShell expands `$` before sending
- Use heredoc `cat << EOF` via SSH — breaks completely in PowerShell  
- Use single-quoted Python `-c '...'` with special chars in SSH — quoting escaping breaks
- Use `python3 -c "..."` with complex multi-line code — always breaks in PowerShell SSH

### ALWAYS for server file operations:
1. **Write Python script locally** to scratch dir (`C:\Users\INTERWARE\.gemini\antigravity\brain\<conv-id>\scratch\`)
2. **SCP the file** to server: `scp -i "KEY" FILE ubuntu@IP:/tmp/script.py`
3. **SSH to run it**: `ssh -i "KEY" ubuntu@IP "python3 /tmp/script.py 2>&1"`
4. Each step is a SEPARATE run_command call — never chain with &&

### Code Deployments vs Scratch Scripts:
- **Project Code Deployments:** ALWAYS use git. Commit and push locally (`git push origin branch`), then SSH to the server and pull (`git pull origin branch`), followed by builds/restarts. NEVER use SCP for source code updates.
- **Scratch Scripts (Database fixes, one-off server admin):** Follow the "ALWAYS for server file operations" SCP method above.

### SSH Key and Server:
```
KEY: D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key
SERVER: ubuntu@129.154.255.90
DOMAIN: newsbuzz.site (Cloudflare)
```

### MongoDB via SSH from PowerShell:
- `$` in mongosh JS breaks PowerShell variable expansion inside SSH strings
- ALWAYS pipe JS through Python subprocess: write a .py file that calls subprocess + mongosh
- Never use `--eval "..."` with `$` in PowerShell SSH

### PM2 commands (safe to run directly):
```bash
ssh -i "KEY" ubuntu@IP "pm2 restart ai-news-frontend && pm2 save"
```
These are safe because no special characters conflict with PowerShell.

### Python inline that IS safe in SSH from PowerShell:
```
ssh ... ubuntu@IP "python3 -c \"import os; print(os.getcwd())\""
```
Only safe for very simple one-liners without single quotes or dollar signs.
