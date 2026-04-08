param(
  [switch]$SkipFfmpeg
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$binDir = Join-Path $repoRoot "bin"
$ffmpegRoot = Join-Path $binDir "ffmpeg"
$ffmpegZip = Join-Path $binDir "ffmpeg-release-essentials.zip"
$ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"

New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$ytDlpTarget = Join-Path $binDir "yt-dlp.exe"
$ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"

Write-Host "Downloading yt-dlp to $ytDlpTarget"
Invoke-WebRequest -Uri $ytDlpUrl -OutFile $ytDlpTarget

if ($SkipFfmpeg) {
  Write-Host "Skipping ffmpeg installation."
  exit 0
}

if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
  Write-Host "ffmpeg already available on PATH."
  exit 0
}

if (Get-Command winget -ErrorAction SilentlyContinue) {
  try {
    Write-Host "Installing ffmpeg with winget..."
    winget install -e --id Gyan.FFmpeg
    Write-Host "ffmpeg installation command completed."
    exit 0
  } catch {
    Write-Warning "winget install failed, falling back to portable ffmpeg download."
  }
}

Write-Host "Downloading portable ffmpeg build to $ffmpegZip"
Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegZip

if (Test-Path $ffmpegRoot) {
  Remove-Item -Recurse -Force $ffmpegRoot
}

New-Item -ItemType Directory -Force -Path $ffmpegRoot | Out-Null
Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegRoot -Force
Remove-Item -Force $ffmpegZip

$ffmpegExe = Get-ChildItem -Path $ffmpegRoot -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1

if (-not $ffmpegExe) {
  throw "Portable ffmpeg download completed, but ffmpeg.exe was not found after extraction."
}

Write-Host "Portable ffmpeg installed at $($ffmpegExe.FullName)"
Write-Host "You can now run: npm run check:media-tools"
