# Create desktop and start-menu shortcuts for the local tarot site.
# ASCII-only source: Windows PowerShell 5.1 reads .ps1 as ANSI, so the Chinese
# display name is taken from scripts/messages.zh.json read as UTF-8.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$launcherName = ([char]0x542F + [char]0x52A8 + [char]0x5854 + [char]0x7F57 + [char]0x724C + '.bat')
$target = Join-Path $root $launcherName
$icon = Join-Path $root 'assets\tarot.ico'

$messages = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'messages.zh.json') | ConvertFrom-Json

if (-not (Test-Path -LiteralPath $target)) {
  throw "Launcher not found: $target"
}

$shell = New-Object -ComObject WScript.Shell

function New-TarotLink([string]$Path) {
  $link = $shell.CreateShortcut($Path)
  $link.TargetPath = $target
  $link.WorkingDirectory = $root
  $link.Description = $messages.shortcutDescription
  if (Test-Path -LiteralPath $icon) { $link.IconLocation = "$icon,0" }
  $link.WindowStyle = 7
  $link.Save()
  return $Path
}

$desktop = [Environment]::GetFolderPath('Desktop')
$created = @(New-TarotLink (Join-Path $desktop ($messages.shortcutName + '.lnk')))

try {
  $startMenu = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'
  if (Test-Path -LiteralPath $startMenu) {
    $created += New-TarotLink (Join-Path $startMenu ($messages.shortcutName + '.lnk'))
  }
} catch {
  # Ignore start-menu problems: the desktop entry is already created.
}

Write-Host 'Shortcuts created:'
$created | ForEach-Object { Write-Host "  - $_" }
