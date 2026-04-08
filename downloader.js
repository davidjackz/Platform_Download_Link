const { prepareMediaDownload, MediaServiceError, MAX_FILE_SIZE_BYTES } = require("./services/media-service");
const {
  detectPlatform,
  extractFirstSupportedUrl,
  getPlatformLabel,
  inferMediaType,
  isSupportedUrl,
  normalizeLanguage,
} = require("./utils/platform");

module.exports = {
  prepareMediaDownload,
  MediaServiceError,
  MAX_FILE_SIZE_BYTES,
  detectPlatform,
  extractFirstSupportedUrl,
  getPlatformLabel,
  inferMediaType,
  isSupportedUrl,
  normalizeLanguage,
};
