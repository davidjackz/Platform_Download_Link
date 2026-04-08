const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const IS_WINDOWS = process.platform === "win32";

class MediaRuntimeError extends Error {
  constructor(message, code = "MEDIA_RUNTIME_ERROR", details = null) {
    super(message);
    this.name = "MediaRuntimeError";
    this.code = code;
    this.details = details;
  }
}

function buildCandidates(tool) {
  const envVar = tool === "ytdlp" ? "YTDLP_BIN" : "FFMPEG_BIN";
  const executableNames = tool === "ytdlp"
    ? [IS_WINDOWS ? "yt-dlp.exe" : "yt-dlp", "yt-dlp"]
    : [IS_WINDOWS ? "ffmpeg.exe" : "ffmpeg", "ffmpeg"];

  const repoCandidates = tool === "ytdlp"
    ? [
        path.join(ROOT_DIR, "bin", executableNames[0]),
        path.join(ROOT_DIR, "vendor", executableNames[0]),
      ]
    : [
        path.join(ROOT_DIR, "bin", executableNames[0]),
        path.join(ROOT_DIR, "bin", "ffmpeg", "bin", executableNames[0]),
        path.join(ROOT_DIR, "vendor", executableNames[0]),
      ];

  return Array.from(
    new Set([
      process.env[envVar],
      ...repoCandidates,
      ...executableNames,
    ].filter(Boolean))
  );
}

function canAttempt(candidate) {
  if (!candidate) {
    return false;
  }

  if (path.isAbsolute(candidate) || candidate.includes(path.sep)) {
    return fs.existsSync(candidate);
  }

  return true;
}

function isFileCandidate(candidate) {
  return Boolean(candidate) && (path.isAbsolute(candidate) || candidate.includes(path.sep));
}

function probeBinary(command, args = ["--version"]) {
  return new Promise((resolve) => {
    let child;

    try {
      child = spawn(command, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({
        ok: false,
        error: error.message || String(error),
      });
      return;
    }

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        error: error.message || String(error),
      });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          ok: true,
          version: (stdout || stderr).trim().split(/\r?\n/)[0] || "unknown version",
        });
        return;
      }

      resolve({
        ok: false,
        error: (stderr || stdout).trim() || `Exited with code ${code}`,
      });
    });
  });
}

async function resolveToolBinary(tool) {
  const candidates = buildCandidates(tool);
  const attempts = [];

  for (const candidate of candidates) {
    if (!canAttempt(candidate)) {
      attempts.push({ candidate, ok: false, error: "Path does not exist" });
      continue;
    }

    const result = await probeBinary(candidate);
    attempts.push({ candidate, ...result });

    if (result.ok) {
      return {
        ok: true,
        binary: candidate,
        version: result.version,
        attempts,
      };
    }

    if (
      tool === "ffmpeg" &&
      isFileCandidate(candidate) &&
      fs.existsSync(candidate)
    ) {
      return {
        ok: true,
        binary: candidate,
        version: "present (path exists; runtime probe skipped)",
        attempts,
      };
    }
  }

  return {
    ok: false,
    binary: null,
    version: null,
    attempts,
  };
}

async function getMediaRuntimeStatus() {
  const [ytDlp, ffmpeg] = await Promise.all([
    resolveToolBinary("ytdlp"),
    resolveToolBinary("ffmpeg"),
  ]);

  return {
    ytDlp,
    ffmpeg,
  };
}

async function ensureMediaRuntime(options = {}) {
  const { audioRequired = false } = options;
  const status = await getMediaRuntimeStatus();

  if (!status.ytDlp.ok) {
    throw new MediaRuntimeError(
      "yt-dlp is missing. Set YTDLP_BIN or install yt-dlp on PATH or in ./bin.",
      "MISSING_YTDLP",
      status.ytDlp
    );
  }

  if (audioRequired && !status.ffmpeg.ok) {
    throw new MediaRuntimeError(
      "ffmpeg is missing. Set FFMPEG_BIN or install ffmpeg on PATH or in ./bin.",
      "MISSING_FFMPEG",
      status.ffmpeg
    );
  }

  return {
    ytDlpBinary: status.ytDlp.binary,
    ffmpegBinary: status.ffmpeg.ok ? status.ffmpeg.binary : null,
    status,
  };
}

function summarizeStatus(status) {
  return {
    ytDlp: status.ytDlp.ok
      ? `ready (${status.ytDlp.binary})`
      : "missing",
    ffmpeg: status.ffmpeg.ok
      ? `ready (${status.ffmpeg.binary})`
      : "missing",
  };
}

async function logMediaRuntimeStatus(logger = console) {
  const status = await getMediaRuntimeStatus();
  const summary = summarizeStatus(status);

  logger.log(`[media-runtime] yt-dlp: ${summary.ytDlp}`);
  logger.log(`[media-runtime] ffmpeg: ${summary.ffmpeg}`);

  if (!status.ytDlp.ok || !status.ffmpeg.ok) {
    logger.warn(
      "[media-runtime] Install helpers: npm run setup:media:windows or npm run setup:media:linux"
    );
    logger.warn(
      "[media-runtime] You can also set YTDLP_BIN and FFMPEG_BIN to custom binary paths."
    );
  }

  return status;
}

module.exports = {
  MediaRuntimeError,
  getMediaRuntimeStatus,
  ensureMediaRuntime,
  logMediaRuntimeStatus,
};
