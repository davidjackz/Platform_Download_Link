#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/bin"

mkdir -p "$BIN_DIR"

echo "Downloading yt-dlp into $BIN_DIR"
curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" -o "$BIN_DIR/yt-dlp"
chmod +x "$BIN_DIR/yt-dlp"

if command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg already available on PATH"
  exit 0
fi

if command -v dnf >/dev/null 2>&1; then
  echo "Installing ffmpeg with dnf"
  sudo dnf install -y ffmpeg
  exit 0
fi

if command -v apt-get >/dev/null 2>&1; then
  echo "Installing ffmpeg with apt-get"
  sudo apt-get update
  sudo apt-get install -y ffmpeg
  exit 0
fi

if command -v yum >/dev/null 2>&1; then
  echo "Installing ffmpeg with yum"
  sudo yum install -y ffmpeg
  exit 0
fi

echo "ffmpeg was not installed automatically."
echo "Install ffmpeg manually and set FFMPEG_BIN if needed."
