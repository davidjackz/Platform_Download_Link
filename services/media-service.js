const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");

const {
  detectPlatform,
  getPlatformLabel,
  inferMediaType,
  normalizeUrl,
} = require("../utils/platform");
const {
  MediaRuntimeError,
  ensureMediaRuntime,
} = require("./runtime-tools");

const MAX_FILE_SIZE_BYTES = 48 * 1024 * 1024;
const VIDEO_FORMAT_SELECTOR = "best[ext=mp4][height<=720]/best[height<=720]/best";
const IGNORED_DOWNLOAD_SUFFIXES = [
  ".info.json",
  ".description",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".part",
  ".temp",
  ".vtt",
  ".srt",
  ".ass",
  ".lrc",
];

class MediaServiceError extends Error {
  constructor(message, code = "MEDIA_ERROR", details = null) {
    super(message);
    this.name = "MediaServiceError";
    this.code = code;
    this.details = details;
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new MediaServiceError(
        stderr.trim() || stdout.trim() || `Command failed with code ${code}`,
        "COMMAND_FAILED",
        { command, code }
      ));
    });
  });
}

async function safeRemove(targetPath) {
  if (!targetPath) {
    return;
  }

  await fs.promises.rm(targetPath, { recursive: true, force: true }).catch(() => {});
}

async function findDownloadArtifacts(directoryPath, mediaType) {
  const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(directoryPath, entry.name));

  const infoPath = files.find((filePath) => filePath.toLowerCase().endsWith(".info.json")) || null;
  const candidates = files.filter((filePath) => {
    const lowerPath = filePath.toLowerCase();
    return !IGNORED_DOWNLOAD_SUFFIXES.some((suffix) => lowerPath.endsWith(suffix));
  });
  const preferredExtension = mediaType === "audio" ? ".mp3" : ".mp4";
  const mediaPath = candidates.find((filePath) => filePath.toLowerCase().endsWith(preferredExtension))
    || candidates[0];

  if (!mediaPath) {
    throw new MediaServiceError("The downloader did not create an output file.", "FILE_NOT_FOUND");
  }

  return {
    mediaPath,
    infoPath,
  };
}

async function readMetadataFromInfoFile(infoPath, fallbackTitle) {
  if (!infoPath) {
    return {
      title: fallbackTitle,
      uploader: null,
    };
  }

  try {
    const raw = await fs.promises.readFile(infoPath, "utf8");
    const metadata = JSON.parse(raw);

    return {
      title: metadata.title || metadata.fulltitle || fallbackTitle,
      uploader: metadata.uploader || metadata.channel || metadata.artist || null,
    };
  } catch (error) {
    return {
      title: fallbackTitle,
      uploader: null,
    };
  }
}

function buildDownloadArgs({ mediaType, outputTemplate, url }) {
  const commonArgs = [
    "--no-playlist",
    "--no-warnings",
    "--restrict-filenames",
    "--write-info-json",
    "--output",
    outputTemplate,
  ];

  if (mediaType === "audio") {
    return [
      ...commonArgs,
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      url,
    ];
  }

  return [
    ...commonArgs,
    "--format",
    VIDEO_FORMAT_SELECTOR,
    "--max-filesize",
    "48M",
    url,
  ];
}

function buildDirectUrlArgs(url) {
  return [
    "--no-playlist",
    "--no-warnings",
    "--format",
    VIDEO_FORMAT_SELECTOR,
    "--get-url",
    url,
  ];
}

function classifyError(error) {
  if (error instanceof MediaServiceError) {
    return error;
  }

  if (error instanceof MediaRuntimeError) {
    return new MediaServiceError(error.message, "MISSING_DEPENDENCY", error.details);
  }

  const message = String(error && error.message ? error.message : error);

  if (/requested format is not available|private|sign in|members only/i.test(message)) {
    return new MediaServiceError(message, "UNAVAILABLE");
  }

  if (/file is larger than|max-filesize/i.test(message)) {
    return new MediaServiceError(message, "FILE_TOO_LARGE");
  }

  return new MediaServiceError(message, "MEDIA_ERROR");
}

async function prepareMediaDownload(inputUrl) {
  const sourceUrl = normalizeUrl(inputUrl);
  const platform = detectPlatform(sourceUrl);

  if (!sourceUrl || !platform) {
    throw new MediaServiceError("Unsupported URL.", "UNSUPPORTED_URL");
  }

  const mediaType = inferMediaType(platform.key);
  const runtime = await ensureMediaRuntime({ audioRequired: mediaType === "audio" });
  const ytDlpBinary = runtime.ytDlpBinary;
  const ffmpegBinary = runtime.ffmpegBinary;
  const tempDirectory = path.join(os.tmpdir(), `botdownload-${randomUUID()}`);
  await fs.promises.mkdir(tempDirectory, { recursive: true });

  const outputTemplate = path.join(tempDirectory, "%(id)s.%(ext)s");
  const args = buildDownloadArgs({
    mediaType,
    outputTemplate,
    url: sourceUrl,
  });

  if (ffmpegBinary) {
    args.unshift("--ffmpeg-location", ffmpegBinary);
  }

  try {
    await runCommand(ytDlpBinary, args);
    const { mediaPath: filePath, infoPath } = await findDownloadArtifacts(tempDirectory, mediaType);
    const stats = await fs.promises.stat(filePath);
    const metadata = await readMetadataFromInfoFile(
      infoPath,
      `${getPlatformLabel(platform.key)} media`
    );

    if (stats.size > MAX_FILE_SIZE_BYTES) {
      throw new MediaServiceError(
        "Downloaded file is larger than Telegram bot upload limits.",
        "FILE_TOO_LARGE"
      );
    }

    return {
      sourceUrl,
      filePath,
      fileName: path.basename(filePath),
      fileSizeBytes: stats.size,
      title: metadata.title,
      uploader: metadata.uploader,
      platform: platform.key,
      platformLabel: getPlatformLabel(platform.key),
      mediaType,
      cleanup: () => safeRemove(tempDirectory),
    };
  } catch (error) {
    await safeRemove(tempDirectory);
    throw classifyError(error);
  }
}

async function resolveDirectMediaUrl(inputUrl) {
  const sourceUrl = normalizeUrl(inputUrl);
  const platform = detectPlatform(sourceUrl);

  if (!sourceUrl || !platform) {
    throw new MediaServiceError("Unsupported URL.", "UNSUPPORTED_URL");
  }

  const mediaType = inferMediaType(platform.key);
  if (mediaType !== "video") {
    return null;
  }

  const runtime = await ensureMediaRuntime({ audioRequired: false });
  const ytDlpBinary = runtime.ytDlpBinary;
  const { stdout } = await runCommand(ytDlpBinary, buildDirectUrlArgs(sourceUrl));
  const directUrl = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!directUrl) {
    throw new MediaServiceError("Unable to resolve direct media URL.", "DIRECT_URL_MISSING");
  }

  return {
    sourceUrl,
    directUrl,
    platform: platform.key,
    platformLabel: getPlatformLabel(platform.key),
    mediaType,
  };
}

module.exports = {
  MAX_FILE_SIZE_BYTES,
  MediaServiceError,
  prepareMediaDownload,
  resolveDirectMediaUrl,
};
