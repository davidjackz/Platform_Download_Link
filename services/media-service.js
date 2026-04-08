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

async function readMetadata(ytDlpBinary, url) {
  const { stdout } = await runCommand(ytDlpBinary, [
    "--dump-single-json",
    "--skip-download",
    "--no-playlist",
    "--no-warnings",
    url,
  ]);

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new MediaServiceError("Unable to parse media metadata.", "BAD_METADATA");
  }
}

async function findSingleFile(directoryPath) {
  const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  const fileEntry = entries.find((entry) => entry.isFile());

  if (!fileEntry) {
    throw new MediaServiceError("The downloader did not create an output file.", "FILE_NOT_FOUND");
  }

  return path.join(directoryPath, fileEntry.name);
}

function buildDownloadArgs({ mediaType, outputTemplate, url }) {
  if (mediaType === "audio") {
    return [
      "--no-playlist",
      "--no-warnings",
      "--restrict-filenames",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--output",
      outputTemplate,
      url,
    ];
  }

  return [
    "--no-playlist",
    "--no-warnings",
    "--restrict-filenames",
    "--format",
    "best[ext=mp4][height<=720]/best[height<=720]/best",
    "--max-filesize",
    "48M",
    "--output",
    outputTemplate,
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

  const metadata = await readMetadata(ytDlpBinary, sourceUrl);
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
    const filePath = await findSingleFile(tempDirectory);
    const stats = await fs.promises.stat(filePath);

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
      title: metadata.title || metadata.fulltitle || `${getPlatformLabel(platform.key)} media`,
      uploader: metadata.uploader || metadata.channel || metadata.artist || null,
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

module.exports = {
  MAX_FILE_SIZE_BYTES,
  MediaServiceError,
  prepareMediaDownload,
};
