# Local static server for the built site.
# Uses only Windows PowerShell, so the desktop shortcut works without Node installed.
# Chinese messages live in scripts/messages.zh.json (read as UTF-8) because
# Windows PowerShell 5.1 reads .ps1 files as ANSI unless they carry a BOM.
param(
  [int]$Port = 4321,
  # Used by automation: start the server without opening a browser.
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dist = Join-Path $root 'dist'
$entry = Join-Path $dist 'index.html'

$messages = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'messages.zh.json') | ConvertFrom-Json

function Show-Message([string]$Text) {
  try {
    Add-Type -AssemblyName PresentationFramework -ErrorAction Stop
    [System.Windows.MessageBox]::Show($Text, 'Tarot Site') | Out-Null
  } catch {
    Write-Host $Text
  }
}

if (-not (Test-Path -LiteralPath $entry)) {
  Show-Message ($messages.missingBuild -replace '\{root\}', $root)
  exit 1
}

$url = "http://localhost:$Port/"

# If the site is already served, just open the browser again.
try {
  $probe = [System.Net.Sockets.TcpClient]::new()
  $probe.Connect('127.0.0.1', $Port)
  $probe.Close()
  if (-not $NoBrowser) { Start-Process $url }
  exit 0
} catch {
  # Port is free, keep starting the server.
}

$mime = @{
  '.html'        = 'text/html; charset=utf-8'
  '.json'        = 'application/json; charset=utf-8'
  '.js'          = 'text/javascript; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.svg'         = 'image/svg+xml'
  '.ico'         = 'image/x-icon'
  '.png'         = 'image/png'
  '.webp'        = 'image/webp'
  '.webmanifest' = 'application/manifest+json'
  '.woff2'       = 'font/woff2'
  '.txt'         = 'text/plain; charset=utf-8'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($url)

try {
  $listener.Start()
} catch {
  Show-Message ($messages.startFailed -replace '\{error\}', $_.Exception.Message)
  exit 1
}

if (-not $NoBrowser) { Start-Process $url }
Write-Host ($messages.started -replace '\{url\}', $url)
Write-Host $messages.stopHint

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  try {
    $relative = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }

    $target = $null
    foreach ($candidate in @($relative, (Join-Path $relative 'index.html'))) {
      $full = [System.IO.Path]::GetFullPath((Join-Path $dist $candidate))
      if (-not $full.StartsWith($dist, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
      if (Test-Path -LiteralPath $full -PathType Leaf) { $target = $full; break }
    }

    if (-not $target) {
      $response.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
    } else {
      $extension = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
      if ($mime.ContainsKey($extension)) {
        $response.ContentType = $mime[$extension]
      } else {
        $response.ContentType = 'application/octet-stream'
      }
      if ($target -like '*\img\cards\*') {
        $response.Headers.Add('Cache-Control', 'public, max-age=31536000, immutable')
      }
      $bytes = [System.IO.File]::ReadAllBytes($target)
    }

    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $response.StatusCode = 500
  } finally {
    $response.OutputStream.Close()
  }
}
