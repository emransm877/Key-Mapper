# Key Mapper - one-step setup (Windows, no admin needed). Run with:
#   powershell -ExecutionPolicy Bypass -c "iwr -useb https://raw.githubusercontent.com/emransm877/Key-Mapper/main/setup.ps1 | iex"
# - Already loaded in Chrome/Edge? It finds that folder and just turns on one-click updates.
# - Not installed? It downloads the extension, walks you through "Load unpacked", then turns on updates.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Repo = 'emransm877/Key-Mapper'
$HostName = 'com.keymapper.updater'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Every loaded copy of this extension in Chrome/Edge (all profiles): @{ id; path }
function Find-Installs {
  $found = @()
  foreach ($root in "$env:LOCALAPPDATA\Google\Chrome\User Data", "$env:LOCALAPPDATA\Microsoft\Edge\User Data") {
    if (-not (Test-Path $root)) { continue }
    $files = Get-ChildItem $root -Recurse -Depth 1 -File -Include 'Secure Preferences', 'Preferences' -ErrorAction SilentlyContinue
    foreach ($f in $files) {
      try { $settings = (Get-Content $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json).extensions.settings } catch { continue }
      if (-not $settings) { continue }
      foreach ($p in $settings.PSObject.Properties) {
        $path = $p.Value.path
        if (-not $path -or -not [IO.Path]::IsPathRooted($path)) { continue }
        $path = [IO.Path]::GetFullPath($path).TrimEnd('\')
        $man = Join-Path $path 'manifest.json'
        if ((Test-Path (Join-Path $path 'updater\host.bat')) -and (Test-Path $man) -and
            ((Get-Content $man -Raw | ConvertFrom-Json).name -eq 'Key Mapper')) {
          $found += [pscustomobject]@{ id = $p.Name; path = $path }
        }
      }
    }
  }
  @($found | Sort-Object id, path -Unique)
}

$installs = Find-Installs
if ($installs) {
  $Dir = $installs[0].path
  Write-Host "Found Key Mapper in $Dir"
} else {
  $Dir = Join-Path $env:LOCALAPPDATA 'KeyMapper'
  if (-not (Test-Path (Join-Path $Dir 'manifest.json'))) {
    Write-Host "Downloading Key Mapper to $Dir ..."
    $tmp = Join-Path $env:TEMP ('km-setup-' + [guid]::NewGuid())
    New-Item -ItemType Directory $tmp | Out-Null
    Invoke-WebRequest "https://codeload.github.com/$Repo/zip/refs/heads/main" -OutFile "$tmp\src.zip" -UseBasicParsing
    Expand-Archive "$tmp\src.zip" $tmp
    $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
    New-Item -ItemType Directory $Dir -Force | Out-Null
    Copy-Item (Join-Path $src.FullName '*') $Dir -Recurse -Force
    Remove-Item $tmp -Recurse -Force
  }
  Set-Clipboard $Dir
  Write-Host ''
  Write-Host 'Now load it in Chrome (one time):' -ForegroundColor Cyan
  Write-Host '  1. On the page that opens, turn on "Developer mode" (top right).'
  Write-Host '  2. Click "Load unpacked", paste this folder path (already copied) and press Enter:'
  Write-Host "     $Dir" -ForegroundColor Yellow
  try { Start-Process chrome 'chrome://extensions' } catch { Write-Host '  (Open chrome://extensions yourself.)' }
  Write-Host ''
  Write-Host 'Waiting for Chrome to load it (up to 5 minutes)...'
  for ($i = 0; $i -lt 150 -and -not $installs; $i++) { Start-Sleep -Seconds 2; $installs = Find-Installs }
  if (-not $installs) { Write-Host 'Chrome did not report it yet. Load it, then run this command again.' -ForegroundColor Red; exit 1 }
  $Dir = $installs[0].path
}
$ids = @($installs | Where-Object { $_.path -ieq $Dir } | ForEach-Object { $_.id } | Select-Object -Unique)

# Register the updater helper for this Windows user (Chrome + Edge)
$hostManifest = Join-Path $Dir "updater\$HostName.json"
@{
  name = $HostName
  description = 'Key Mapper updater'
  path = (Join-Path $Dir 'updater\host.bat')
  type = 'stdio'
  allowed_origins = @($ids | ForEach-Object { "chrome-extension://$_/" })
} | ConvertTo-Json | Set-Content $hostManifest -Encoding ASCII
foreach ($browser in 'Google\Chrome', 'Microsoft\Edge') {
  $key = "HKCU:\Software\$browser\NativeMessagingHosts\$HostName"
  New-Item $key -Force | Out-Null
  Set-Item $key -Value $hostManifest
}

Write-Host ''
Write-Host 'All set. One-click updates are on: open the extension popup and click "Update now" whenever it shows one.' -ForegroundColor Green
