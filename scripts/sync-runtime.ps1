# Optional helper for this machine's full C: drive. Source remains in the workspace.
param([string]$Destination = 'A:\codex-tableline-runtime\app')
$sourceRoot = Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
Get-ChildItem -LiteralPath $sourceRoot -Force |
  Where-Object { $_.Name -notin @('node_modules','.next','.data','.git','test-results','playwright-report') } |
  Copy-Item -Destination $Destination -Recurse -Force
Write-Output "Source copied to $Destination. Dependencies are in its parent directory."
