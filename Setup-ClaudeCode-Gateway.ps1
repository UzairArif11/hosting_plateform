#Requires -Version 5.1
<#
.SYNOPSIS
Configure Claude Code (VS Code extension + CLI) on Windows 11 to run through a
third-party Anthropic-compatible gateway (TabiToken / AgentRouter).

.DESCRIPTION
Fixes the "works on Linux, errors when sending a message on Windows" case.
Root cause: these gateways only serve their own model aliases (claude-opus-5,
claude-opus-4-8, ...). Every standard Anthropic model id -- and the "[1m]"
context suffix -- is rejected with HTTP 403. Claude Code's model selection is
stored per-machine and is NOT carried by VS Code Settings Sync, so the Windows
machine ends up asking for a model the gateway does not have.

What this script does:
1. Probes every gateway/key pair and picks one that is actually live.
2. Confirms a real /v1/messages round-trip BEFORE writing anything.
3. Pins every model slot (main, small/fast, subagent, opus/sonnet/haiku)
   to a model the gateway really serves.
4. Writes %USERPROFILE%\.claude\settings.json (survives Settings Sync and
   also covers the CLI) and patches %APPDATA%\Code\User\settings.json
   (claudeCode.environmentVariables is machine-scoped, so it must be local).
5. Removes a conflicting ANTHROPIC_API_KEY from the Windows environment.

Every file it touches is backed up first. Use -DryRun to preview.
#>
[CmdletBinding()]
param(
    [string[]] $TabiTokenKeys = @(
        'sk-yxQYpjyYRH3HUlHDg2tflNwaoNpyxoshW9wpSdUnL8NlGA35',
        'sk-NptkRUCBvpjRuvTBKQ08kk7BO6ARQQCJH4LafZxaEd6mNtjX',
        'sk-lkhUSX99QIc38jeuz5DFVY4Iu8JcLpMUCeGjDKBtNcpXhQDN',
        'sk-beH2DhVKeEBQ8o66MX5qa43ZGmnFQPNOExdsnIn2HeiG94df',
        'sk-i2mToiFXamzHhPUB2NrsHvPGIbqmv0QqO2LT3wd2ImZT5rJE'
    ),
    [string[]] $AgentRouterKeys = @(
        'sk-ReDvyy2j5ZTsZikiCIRJlPcj1YqhXivMvEN3zcocVG8T705e'
    ),
    [string] $PreferModel = 'claude-opus-5',
    [switch] $NoEnvCleanup,
    [switch] $DryRun
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.ServicePointManager]::SecurityProtocol
} catch { }

$script:UA = 'claude-cli/2.1.246 (external, cli)'
$script:Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:Changes = New-Object System.Collections.ArrayList

function Write-Head { param([string]$m) Write-Host ''; Write-Host "== $m" -ForegroundColor Cyan }
function Write-Ok { param([string]$m) Write-Host "  [ ok ] $m" -ForegroundColor Green }
function Write-Warn { param([string]$m) Write-Host "  [warn] $m" -ForegroundColor Yellow }
function Write-Bad { param([string]$m) Write-Host "  [fail] $m" -ForegroundColor Red }
function Write-Info { param([string]$m) Write-Host "         $m" -ForegroundColor DarkGray }

function Get-Masked {
    param([string]$Key)
    if ([string]::IsNullOrEmpty($Key)) { return '(empty)' }
    if ($Key.Length -le 12) { return ('*' * $Key.Length) }
    return $Key.Substring(0, 8) + '...' + $Key.Substring($Key.Length - 4)
}

function Test-IsAdmin {
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}

function Get-GatewayHeaders {
    param([string]$Key)
    return @{
        'authorization' = "Bearer $Key"
        'anthropic-version' = '2023-06-01'
        'x-app' = 'cli'
    }
}

function Test-GatewayKey {
    param([string]$BaseUrl, [string]$Key)
    try {
        $r = Invoke-RestMethod -Method Get -Uri "$BaseUrl/v1/models" -Headers (Get-GatewayHeaders $Key) -UserAgent $script:UA -TimeoutSec 30
    } catch {
        return $null
    }
    if (-not $r -or -not $r.PSObject.Properties['data']) { return $null }
    $ids = @($r.data | ForEach-Object { $_.id } | Where-Object { $_ })
    if ($ids.Count -eq 0) { return $null }
    return $ids
}

function Test-GatewaySend {
    param([string]$BaseUrl, [string]$Key, [string]$Model)
    $payload = @{
        model = $Model
        max_tokens = 8
        messages = @(@{ role = 'user'; content = 'hi' })
    } | ConvertTo-Json -Depth 6 -Compress
    try {
        $null = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/messages" -Headers (Get-GatewayHeaders $Key) -UserAgent $script:UA -ContentType 'application/json' -Body $payload -TimeoutSec 90
        return $true
    } catch {
        $code = ''
        try { $code = [int]$_.Exception.Response.StatusCode } catch { }
        Write-Info ("send test for '{0}' failed{1}" -f $Model, $(if ($code) { " (HTTP $code)" } else { '' }))
        return $false
    }
}

function Select-BestModel {
    param([string[]]$Models, [string]$Prefer)
    if ($Models -contains $Prefer) { return $Prefer }
    $plain = @($Models | Where-Object { $_ -notmatch 'thinking' } | Sort-Object -Descending)
    if ($plain.Count -gt 0) { return $plain[0] }
    return (@($Models | Sort-Object -Descending))[0]
}

function Remove-JsonComments {
    param([string]$Text)
    $sb = New-Object System.Text.StringBuilder
    $inString = $false; $escaped = $false; $i = 0
    while ($i -lt $Text.Length) {
        $c = $Text[$i]
        if ($inString) {
            [void]$sb.Append($c)
            if ($escaped) { $escaped = $false }
            elseif ($c -eq '\') { $escaped = $true }
            elseif ($c -eq '"') { $inString = $false }
            $i++; continue
        }
        if ($c -eq '"') { $inString = $true; [void]$sb.Append($c); $i++; continue }
        if ($c -eq '/' -and ($i + 1) -lt $Text.Length) {
            if ($Text[$i + 1] -eq '/') {
                while ($i -lt $Text.Length -and $Text[$i] -ne "`n") { $i++ }
                continue
            }
            if ($Text[$i + 1] -eq '*') {
                $i += 2
                while (($i + 1) -lt $Text.Length -and -not ($Text[$i] -eq '*' -and $Text[$i + 1] -eq '/')) { $i++ }
                $i += 2; continue
            }
        }
        [void]$sb.Append($c); $i++
    }
    return $sb.ToString()
}

function ConvertTo-OrderedDict {
    param($Node)
    if ($null -eq $Node) { return $null }
    if ($Node -is [System.Management.Automation.PSCustomObject]) {
        $d = [ordered]@{}
        foreach ($p in $Node.PSObject.Properties) { $d[$p.Name] = ConvertTo-OrderedDict $p.Value }
        return $d
    }
    if ($Node -is [System.Collections.IEnumerable] -and $Node -isnot [string]) {
        return @($Node | ForEach-Object { ConvertTo-OrderedDict $_ })
    }
    return $Node
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return [ordered]@{} }
    $raw = [IO.File]::ReadAllText($Path)
    if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
    if ([string]::IsNullOrWhiteSpace($raw)) { return [ordered]@{} }
    foreach ($candidate in @(
        $raw,
        (Remove-JsonComments $raw),
        ((Remove-JsonComments $raw) -replace ',(\s*[}\]])', '$1'))) {
        try {
            $parsed = ConvertTo-OrderedDict (ConvertFrom-Json $candidate)
            if ($parsed -isnot [System.Collections.IDictionary]) {
                throw "'$Path' does not contain a JSON object at the top level."
            }
            return $parsed
        } catch [System.ArgumentException] { throw } catch { }
    }
    throw "Could not parse '$Path' as JSON. Fix or rename it, then re-run."
}

function Write-JsonFile {
    param([string]$Path, $Data)
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        if (-not $DryRun) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Write-Info "create directory $dir"
    }
    if (Test-Path -LiteralPath $Path) {
        $bak = "$Path.bak-$script:Stamp"
        if (-not $DryRun) { Copy-Item -LiteralPath $Path -Destination $bak -Force }
        Write-Info "backup -> $bak"
    }
    $json = $Data | ConvertTo-Json -Depth 25
    if ($DryRun) {
        Write-Info "would write $Path"
        return
    }
    [IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
    [void]$script:Changes.Add($Path)
}

Write-Host ''
Write-Host ' Claude Code - gateway setup for Windows 11' -ForegroundColor White
Write-Host ' -------------------------------------------' -ForegroundColor DarkGray

if ($DryRun) { Write-Warn 'DryRun: nothing will be written.' }

Write-Head 'Environment'
Write-Info ("PowerShell {0} on {1}" -f $PSVersionTable.PSVersion, [Environment]::OSVersion.VersionString)
if ($env:OS -ne 'Windows_NT') {
    Write-Bad 'This script is for Windows. Run it on the Windows 11 laptop.'
    exit 1
}

$codeUserDir = Join-Path $env:APPDATA 'Code\User'
$codeSettings = Join-Path $codeUserDir 'settings.json'
$claudeDir = Join-Path $env:USERPROFILE '.claude'
$claudeSet = Join-Path $claudeDir 'settings.json'

if (Test-Path -LiteralPath $codeUserDir) { Write-Ok "VS Code user dir: $codeUserDir" }
else { Write-Warn "VS Code user dir not found ($codeUserDir) - it will be created." }

$extRoot = Join-Path $env:USERPROFILE '.vscode\extensions'
if (Test-Path -LiteralPath $extRoot) {
    $exts = @(Get-ChildItem -LiteralPath $extRoot -Directory -Filter 'anthropic.claude-code-*' -ErrorAction SilentlyContinue)
    if ($exts.Count -eq 0) {
        Write-Warn 'Claude Code extension not installed. Install "Anthropic.claude-code" from the Marketplace.'
    } else {
        foreach ($e in $exts) {
            $exe = Join-Path $e.FullName 'resources\native-binary\claude.exe'
            $alt = Join-Path $e.FullName 'resources\native-binaries\win32-x64\claude.exe'
            if ((Test-Path -LiteralPath $exe) -or (Test-Path -LiteralPath $alt)) {
                Write-Ok "extension ok: $($e.Name)"
            } elseif ($e.Name -match 'linux|darwin') {
                Write-Bad "$($e.Name) is a non-Windows build - uninstall it and reinstall from the Marketplace on this machine."
            } else {
                Write-Warn "$($e.Name): no claude.exe found under resources\ - reinstall the extension."
            }
        }
    }
} else {
    Write-Warn "No $extRoot - VS Code extensions directory missing."
}

Write-Head 'Probing gateways and keys'
$candidates = New-Object System.Collections.ArrayList
foreach ($k in $TabiTokenKeys) { if ($k) { [void]$candidates.Add([pscustomobject]@{ Name='tabitoken'; BaseUrl='https://tabitoken.com'; Key=$k }) } }
foreach ($k in $AgentRouterKeys) { if ($k) { [void]$candidates.Add([pscustomobject]@{ Name='agentrouter'; BaseUrl='https://agentrouter.org'; Key=$k }) } }

if ($candidates.Count -eq 0) {
    Write-Bad 'No keys supplied. Pass -TabiTokenKeys / -AgentRouterKeys.'
    exit 1
}

$chosen = $null
foreach ($c in $candidates) {
    $label = '{0,-12} {1}' -f $c.Name, (Get-Masked $c.Key)
    $models = Test-GatewayKey -BaseUrl $c.BaseUrl -Key $c.Key
    if (-not $models) { Write-Bad "$label unreachable / rejected"; continue }
    
    $model = Select-BestModel -Models $models -Prefer $PreferModel
    Write-Ok "$label live"
    Write-Info ("models: {0}" -f ($models -join ', '))
    
    if (Test-GatewaySend -BaseUrl $c.BaseUrl -Key $c.Key -Model $model) {
        Write-Ok "send test passed on '$model'"
        $chosen = [pscustomobject]@{ Name=$c.Name; BaseUrl=$c.BaseUrl; Key=$c.Key; Model=$model; Models=$models }
        break
    }
    Write-Warn "$label lists models but will not serve '$model' - trying next key"
}

if (-not $chosen) {
    Write-Host ''
    Write-Bad 'No gateway/key combination completed a request.'
    Write-Info 'All keys may be exhausted, or the network is blocking the gateway.'
    Write-Info 'Rotate your keys and re-run with -TabiTokenKeys ''sk-newkey''.'
    exit 1
}

Write-Head 'Selected'
Write-Info "gateway : $($chosen.Name) ($($chosen.BaseUrl))"
Write-Info "key : $(Get-Masked $chosen.Key)"
Write-Info "model : $($chosen.Model)"

$envMap = [ordered]@{
    'ANTHROPIC_BASE_URL' = $chosen.BaseUrl
    'ANTHROPIC_AUTH_TOKEN' = $chosen.Key
    'CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY' = '1'
    'ANTHROPIC_MODEL' = $chosen.Model
    'ANTHROPIC_SMALL_FAST_MODEL' = $chosen.Model
    'CLAUDE_CODE_SUBAGENT_MODEL' = $chosen.Model
    'ANTHROPIC_DEFAULT_OPUS_MODEL' = $chosen.Model
    'ANTHROPIC_DEFAULT_SONNET_MODEL' = $chosen.Model
    'ANTHROPIC_DEFAULT_HAIKU_MODEL' = $chosen.Model
}

Write-Head 'Writing .claude\settings.json'
$cs = Read-JsonFile $claudeSet
$block = [ordered]@{}
foreach ($k in $envMap.Keys) { $block[$k] = $envMap[$k] }

if ($cs.Contains('env') -and $cs['env'] -is [System.Collections.IDictionary]) {
    foreach ($k in @($cs['env'].Keys)) { if (-not $block.Contains($k)) { $block[$k] = $cs['env'][$k] } }
}
$cs['env'] = $block
$cs['model'] = $chosen.Model
Write-JsonFile -Path $claudeSet -Data $cs
Write-Ok $claudeSet

Write-Head 'Patching VS Code user settings.json'
$vs = Read-JsonFile $codeSettings
$vsEnv = New-Object System.Collections.ArrayList
foreach ($k in $envMap.Keys) { [void]$vsEnv.Add([ordered]@{ name = $k; value = $envMap[$k] }) }
$vs['claudeCode.environmentVariables'] = @($vsEnv)

if (-not $vs.Contains('claudeCode.disableLoginPrompt')) { $vs['claudeCode.disableLoginPrompt'] = $true }

if ($vs.Contains('manual_key_swapping_guide')) {
    $vs.Remove('manual_key_swapping_guide')
    Write-Info 'removed manual_key_swapping_guide (not a VS Code setting)'
}
Write-JsonFile -Path $codeSettings -Data $vs
Write-Ok $codeSettings

if ($NoEnvCleanup) {
    Write-Head 'Skipping environment cleanup (-NoEnvCleanup)'
} else {
    Write-Head 'Checking Windows environment variables'
    $conflicts = @('ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN',
                   'ANTHROPIC_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL',
                   'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX')
    $found = $false
    foreach ($scope in @('User', 'Machine')) {
        foreach ($n in $conflicts) {
            $v = $null
            try { $v = [Environment]::GetEnvironmentVariable($n, $scope) } catch { continue }
            if ([string]::IsNullOrEmpty($v)) { continue }
            $found = $true
            if ($scope -eq 'Machine' -and -not (Test-IsAdmin)) {
                Write-Warn "$n is set at Machine scope - re-run as Administrator to clear it."
                continue
            }
            if ($DryRun) { Write-Info "would clear $n ($scope)"; continue }
            [Environment]::SetEnvironmentVariable($n, $null, $scope)
            Write-Ok "cleared $n ($scope scope)"
        }
    }
    if (-not $found) { Write-Ok 'no conflicting ANTHROPIC_* / CLAUDE_CODE_USE_* variables set' }
}

$claudeJson = Join-Path $env:USERPROFILE '.claude.json'
if (Test-Path -LiteralPath $claudeJson) {
    Write-Info "note: $claudeJson holds this machine's cached model choice (now overridden by ANTHROPIC_MODEL)"
}

Write-Head 'Done'
Write-Host (" gateway : {0}" -f $chosen.BaseUrl)
Write-Host (" model   : {0}" -f $chosen.Model)
if ($script:Changes.Count -gt 0) {
    Write-Host ' written :'
    foreach ($f in $script:Changes) { Write-Host "   $f" }
}
Write-Host ''
Write-Host ' Next steps' -ForegroundColor White
Write-Host ' 1. Close VS Code completely (every window), then reopen it.' -ForegroundColor Gray
Write-Host ' 2. Open the Claude Code panel and send "hi".' -ForegroundColor Gray
Write-Host ' 3. Run /status - it should show ANTHROPIC_AUTH_TOKEN as the auth' -ForegroundColor Gray
Write-Host "    source and $($chosen.BaseUrl) as the endpoint." -ForegroundColor Gray
Write-Host ''
exit 0
