param(
  [ValidateSet("user", "project")]
  [string] $Scope = "user",
  [switch] $Force,
  [switch] $RemoveLegacyMethodology
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$PluginSourceRoot = if ($env:AIVV_PLUGIN_SOURCE_ROOT) {
  $env:AIVV_PLUGIN_SOURCE_ROOT
} else {
  Join-Path $RepoRoot "plugin"
}

if (-not (Test-Path (Join-Path $PluginSourceRoot "skills")) -or -not (Test-Path (Join-Path $PluginSourceRoot ".aivv"))) {
  throw "AIVV plugin source root is incomplete: $PluginSourceRoot"
}

$RequiredSourceDirectories = @(
  "skills/aivv",
  "skills/aivv-fix",
  "skills/aivv-calibrate",
  "skills/aivv-view",
  "skills/methodology",
  ".aivv",
  "skills",
  "tools"
)
$RequiredSourceFiles = @(
  ".aivv/prompts/reviewer-role.md",
  ".aivv/prompts/investigator-role.md"
)
foreach ($RelativePath in $RequiredSourceDirectories) {
  $Source = Join-Path $PluginSourceRoot $RelativePath
  if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
    throw "Missing AIVV source directory: $Source"
  }
}
foreach ($RelativePath in $RequiredSourceFiles) {
  $Source = Join-Path $PluginSourceRoot $RelativePath
  if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "Missing AIVV source file: $Source"
  }
  if ((Get-Content -LiteralPath $Source -Raw).Contains("'''")) {
    throw "Cannot embed triple-single-quote sequence in TOML developer_instructions: $Source"
  }
}

if ($Scope -eq "user" -and $env:CODEX_HOME) {
  $CodexRoot = $env:CODEX_HOME
} elseif ($Scope -eq "user") {
  $CodexRoot = Join-Path $HOME ".codex"
} else {
  $CodexRoot = Join-Path $RepoRoot ".codex"
}
if ($env:AIVV_CODEX_ROOT_OVERRIDE) {
  $CodexRoot = $env:AIVV_CODEX_ROOT_OVERRIDE
}

$SkillsDest = Join-Path $CodexRoot "skills"
$AgentsDest = Join-Path $CodexRoot "agents"
$RuntimeDest = Join-Path $CodexRoot "aivv-runtime"

$ReplacementRelativePaths = @(
  "skills/aivv",
  "skills/aivv-fix",
  "skills/aivv-calibrate",
  "skills/aivv-view",
  "skills/aivv-methodology",
  "aivv-runtime/.aivv",
  "aivv-runtime/skills",
  "aivv-runtime/tools",
  "agents/aivv-reviewer.toml",
  "agents/aivv-investigator.toml"
)
$BackupRelativePaths = [System.Collections.Generic.List[string]]::new()
$Conflicts = [System.Collections.Generic.List[string]]::new()

foreach ($RelativePath in $ReplacementRelativePaths) {
  $Destination = Join-Path $CodexRoot $RelativePath
  if (Test-Path -LiteralPath $Destination) {
    if ($Force) {
      $BackupRelativePaths.Add($RelativePath)
    } else {
      $Conflicts.Add($Destination)
    }
  }
}

if ($Force) {
  $LegacySupportEntries = @(
    @{ RelativePath = "skills/.aivv"; Marker = "methodology.md" },
    @{ RelativePath = "skills/skills"; Marker = "aivv/SKILL.md" },
    @{ RelativePath = "skills/tools"; Marker = "dispatch.mjs" }
  )
  foreach ($Entry in $LegacySupportEntries) {
    $Destination = Join-Path $CodexRoot $Entry.RelativePath
    if ((Test-Path -LiteralPath $Destination) -and (Test-Path -LiteralPath (Join-Path $Destination $Entry.Marker))) {
      $BackupRelativePaths.Add($Entry.RelativePath)
    }
  }
}

$LegacyMethodology = Join-Path $SkillsDest "methodology"
if ($RemoveLegacyMethodology -and (Test-Path -LiteralPath $LegacyMethodology)) {
  $BackupRelativePaths.Add("skills/methodology")
}

if ($Conflicts.Count -gt 0) {
  $ConflictList = $Conflicts -join [Environment]::NewLine
  throw "Existing AIVV destinations found; no files were changed:`n$ConflictList`nRerun with -Force to back up and replace them."
}

$BackupRoot = $null
if ($BackupRelativePaths.Count -gt 0) {
  $BackupId = "$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmss'))-$PID-$([Guid]::NewGuid().ToString('N'))"
  $BackupRoot = Join-Path $CodexRoot ".aivv-install-backup-$BackupId"
  New-Item -ItemType Directory -Path $BackupRoot | Out-Null

  foreach ($RelativePath in $BackupRelativePaths) {
    $Source = Join-Path $CodexRoot $RelativePath
    $BackupDestination = Join-Path (Join-Path $BackupRoot "previous") $RelativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $BackupDestination) | Out-Null
    Copy-Item -Recurse -Force -LiteralPath $Source -Destination $BackupDestination
  }

  @(
    "Original Codex root: $CodexRoot",
    "Each entry under previous/ mirrors its original relative path under the Codex root.",
    "To restore an entry, copy it back to that same relative path."
  ) | Set-Content -LiteralPath (Join-Path $BackupRoot "README.txt") -Encoding utf8
  Write-Host "Backed up existing AIVV destinations to $BackupRoot"
}

New-Item -ItemType Directory -Force -Path $SkillsDest, $AgentsDest, $RuntimeDest | Out-Null

function Copy-CodexSkill {
  param(
    [string] $SourceName,
    [string] $DestName,
    [string] $Description,
    [string[]] $ToolDependencies,
    [switch] $RenameFrontmatter
  )

  $Source = Join-Path $PluginSourceRoot "skills\$SourceName"
  $Dest = Join-Path $SkillsDest $DestName

  if (-not (Test-Path $Source)) {
    throw "Missing source skill: $Source"
  }

  if (Test-Path $Dest) {
    if (-not $Force) {
      throw "Destination exists: $Dest (rerun with -Force to replace)"
    }
    Remove-Item -Recurse -Force -LiteralPath $Dest
  }

  Copy-Item -Recurse -LiteralPath $Source -Destination $Dest
  Copy-Item -Recurse -LiteralPath (Join-Path $PluginSourceRoot ".aivv") -Destination (Join-Path $Dest ".aivv")

  if ($RenameFrontmatter) {
    $SkillFile = Join-Path $Dest "SKILL.md"
    $Text = Get-Content -LiteralPath $SkillFile -Raw
    $Text = $Text -replace "(?m)^name:\s+methodology\s*$", "name: aivv-methodology"
    Set-Content -LiteralPath $SkillFile -Value $Text -Encoding utf8
  }

  $MetaDir = Join-Path $Dest "agents"
  New-Item -ItemType Directory -Force -Path $MetaDir | Out-Null

  $Yaml = @(
    "name: $DestName",
    "description: $Description",
    "invocation_policy: explicit",
    "tool_dependencies:"
  ) + ($ToolDependencies | ForEach-Object { "  - $_" })

  Set-Content -LiteralPath (Join-Path $MetaDir "openai.yaml") -Value $Yaml -Encoding utf8
}

function Copy-CodexSupportDirectory {
  param(
    [string] $RelativePath
  )

  $Source = Join-Path $PluginSourceRoot $RelativePath
  $Dest = Join-Path $RuntimeDest $RelativePath

  if (-not (Test-Path $Source)) {
    throw "Missing support directory: $Source"
  }

  if (Test-Path $Dest) {
    if (-not $Force) {
      throw "Support destination exists: $Dest (rerun with -Force to replace)"
    }
    Remove-Item -Recurse -Force -LiteralPath $Dest
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dest) | Out-Null
  Copy-Item -Recurse -LiteralPath $Source -Destination $Dest
}

function Remove-LegacySupportDirectory {
  param(
    [string] $Path,
    [string] $Marker
  )

  if (-not (Test-Path $Path)) {
    return
  }

  $MarkerPath = Join-Path $Path $Marker
  if (Test-Path $MarkerPath) {
    Remove-Item -Recurse -Force -LiteralPath $Path
  } else {
    Write-Warning "Skipping non-AIVV-looking legacy support path: $Path"
  }
}

function New-CodexAgentToml {
  param(
    [string] $Name,
    [string] $Description,
    [string] $PromptPath,
    [string] $OutPath
  )

  $Prompt = Get-Content -LiteralPath $PromptPath -Raw

  if ($Prompt.Contains("'''")) {
    throw "Cannot embed triple-single-quote sequence in TOML developer_instructions: $PromptPath"
  }

  $Body = @"
Read the portable role definition below and follow it exactly. You are running under Codex, not Claude Code.

Codex-specific constraints:
- You are read-only: do not edit, create, delete, move, or overwrite files.
- Use shell commands only for inspection, search, and git reads; never run commands that modify workspace state.
- Do not spawn subagents.
- If web browsing is required by the host policy, use primary sources and cite them in your result.
- Return the structured output requested by the portable role.

Portable role definition:

$Prompt
"@

  $Toml = @"
name = "$Name"
description = "$Description"
sandbox_mode = "read-only"
developer_instructions = '''
$Body
'''
"@

  Set-Content -LiteralPath $OutPath -Value $Toml -Encoding utf8
}

Copy-CodexSkill `
  -SourceName "aivv" `
  -DestName "aivv" `
  -Description "AIVV IV&V review orchestration skill" `
  -ToolDependencies @("apply_patch", "shell_command", "spawn_agent")

Copy-CodexSkill `
  -SourceName "aivv-fix" `
  -DestName "aivv-fix" `
  -Description "AIVV finding investigation and remediation skill" `
  -ToolDependencies @("apply_patch", "shell_command", "spawn_agent")

Copy-CodexSkill `
  -SourceName "aivv-calibrate" `
  -DestName "aivv-calibrate" `
  -Description "AIVV calibration corpus visualization skill (read-only)" `
  -ToolDependencies @("shell_command")

Copy-CodexSkill `
  -SourceName "aivv-view" `
  -DestName "aivv-view" `
  -Description "AIVV read-only findings viewer skill" `
  -ToolDependencies @("shell_command")

Copy-CodexSkill `
  -SourceName "methodology" `
  -DestName "aivv-methodology" `
  -Description "AIVV methodology support skill" `
  -ToolDependencies @("shell_command") `
  -RenameFrontmatter

if ($Force) {
  Remove-LegacySupportDirectory -Path (Join-Path $SkillsDest ".aivv") -Marker "methodology.md"
  Remove-LegacySupportDirectory -Path (Join-Path $SkillsDest "skills") -Marker "aivv/SKILL.md"
  Remove-LegacySupportDirectory -Path (Join-Path $SkillsDest "tools") -Marker "dispatch.mjs"
}

Copy-CodexSupportDirectory -RelativePath ".aivv"
Copy-CodexSupportDirectory -RelativePath "skills"
Copy-CodexSupportDirectory -RelativePath "tools"

if ($RemoveLegacyMethodology) {
  $Legacy = Join-Path $SkillsDest "methodology"
  if (Test-Path $Legacy) {
    Remove-Item -Recurse -Force -LiteralPath $Legacy
  }
}

New-CodexAgentToml `
  -Name "aivv-reviewer" `
  -Description "AIVV general advisory reviewer for session work, artifacts, plans, and decisions. Read-only." `
  -PromptPath (Join-Path $PluginSourceRoot ".aivv\prompts\reviewer-role.md") `
  -OutPath (Join-Path $AgentsDest "aivv-reviewer.toml")

New-CodexAgentToml `
  -Name "aivv-investigator" `
  -Description "AIVV root-cause investigator for review findings. Read-only." `
  -PromptPath (Join-Path $PluginSourceRoot ".aivv\prompts\investigator-role.md") `
  -OutPath (Join-Path $AgentsDest "aivv-investigator.toml")

Write-Host "Installed AIVV Codex skills into $SkillsDest"
Write-Host "Installed AIVV Codex subagents into $AgentsDest"
Write-Host "Installed AIVV Codex runtime support into $RuntimeDest/{.aivv,skills,tools}"
Write-Host "Restart Codex to pick up new skills and subagents."
