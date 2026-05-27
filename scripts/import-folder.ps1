# Bulk-import a directory tree of markdown recipes to Firestore.
# Wraps scripts/import-folder.mjs. See scripts/README.md for setup.
#
# Usage:
#   .\scripts\import-folder.ps1 -Path "C:\recipes" -Uid "abc123uid"

param(
  [Parameter(Mandatory = $true)][string]$Path,
  [Parameter(Mandatory = $true)][string]$Uid
)

node "$PSScriptRoot/import-folder.mjs" $Path $Uid
