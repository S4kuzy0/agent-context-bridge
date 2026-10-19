$ErrorActionPreference = 'Stop'
$bridgePath = Split-Path -Parent $PSScriptRoot
$state = Get-Content -LiteralPath (Join-Path $bridgePath 'installation.local.json') -Raw | ConvertFrom-Json

# Check every target before changing any of them; preserve concurrent or later edits.
foreach ($change in $state.changes) {
  if (!(Test-Path -LiteralPath $change.path)) { throw "Target no longer exists; merge manually: $($change.path)" }
  if ((Get-FileHash -LiteralPath $change.path).Hash -ne $change.installedHash) {
    throw "Target changed since installation; preserve and merge it manually: $($change.path)"
  }
  if ($change.existed -and !(Test-Path -LiteralPath $change.backup)) { throw "Backup missing: $($change.backup)" }
}
$module = Get-Item -Force -LiteralPath $state.modulePath
if ($module.LinkType -ne 'Junction' -or $module.Target -ne $state.moduleTarget) { throw 'Module link has changed; preserve it.' }

foreach ($change in $state.changes) {
  if ($change.existed) { Copy-Item -LiteralPath $change.backup -Destination $change.path -Force }
  else { Remove-Item -LiteralPath $change.path }
}
# Remove only the exact module junction, never its target or the bridge project.
Remove-Item -LiteralPath $state.modulePath
Write-Output 'Local integration restored. Reload the two applications to use the restored configuration. Bridge source and backups are preserved.'
