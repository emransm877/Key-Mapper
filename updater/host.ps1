# Native messaging host: Chrome sends {"cmd":"update"}; we download the latest
# code from GitHub and copy it over this extension folder.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Repo = 'emransm877/Key-Mapper'
$Branch = 'main'

$stdin = [Console]::OpenStandardInput()
$stdout = [Console]::OpenStandardOutput()

function Read-Message {
  $lenBytes = New-Object byte[] 4
  $got = 0
  while ($got -lt 4) {
    $read = $stdin.Read($lenBytes, $got, 4 - $got)
    if ($read -eq 0) {
      if ($got -eq 0) { return $null }
      throw 'Truncated native message header'
    }
    $got += $read
  }
  $len = [BitConverter]::ToInt32($lenBytes, 0)
  if ($len -le 0 -or $len -gt 1048576) { throw 'Invalid native message length' }
  $buf = New-Object byte[] $len
  $got = 0
  while ($got -lt $len) {
    $read = $stdin.Read($buf, $got, $len - $got)
    if ($read -eq 0) { throw 'Truncated native message body' }
    $got += $read
  }
  return [Text.Encoding]::UTF8.GetString($buf) | ConvertFrom-Json
}

function Send-Message($obj) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
  $stdout.Write([BitConverter]::GetBytes($bytes.Length), 0, 4)
  $stdout.Write($bytes, 0, $bytes.Length)
  $stdout.Flush()
}

try {
  $msg = Read-Message
  $extDir = Split-Path $PSScriptRoot -Parent
  if (-not $msg -or $msg.cmd -ne 'update') { Send-Message @{ ok = $false; error = 'unknown command' }; exit }

  $tmp = Join-Path $env:TEMP ('km-update-' + [guid]::NewGuid())
  New-Item -ItemType Directory $tmp | Out-Null
  $zip = Join-Path $tmp 'src.zip'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest "https://codeload.github.com/$Repo/zip/refs/heads/$Branch" -OutFile $zip -UseBasicParsing
  Expand-Archive $zip -DestinationPath $tmp
  $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
  if (-not (Test-Path (Join-Path $src.FullName 'manifest.json'))) { throw 'download has no manifest.json' }

  Copy-Item (Join-Path $src.FullName '*') $extDir -Recurse -Force
  $version = (Get-Content (Join-Path $extDir 'manifest.json') -Raw | ConvertFrom-Json).version
  Remove-Item $tmp -Recurse -Force
  Send-Message @{ ok = $true; version = $version }
} catch {
  Send-Message @{ ok = $false; error = $_.Exception.Message }
}
