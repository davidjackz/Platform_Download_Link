const MediaCache = require("../models/MediaCache");
const { normalizeUrl } = require("../utils/platform");

function normalizeCacheUrl(url) {
  return normalizeUrl(url || "");
}

async function findReusableMedia(url, platform, mediaType) {
  const normalizedUrl = normalizeCacheUrl(url);

  if (!normalizedUrl || !platform || !mediaType) {
    return null;
  }

  return MediaCache.findOne({
    normalizedUrl,
    platform,
    mediaType,
  }).lean();
}

async function touchReusableMedia(id) {
  if (!id) {
    return null;
  }

  return MediaCache.findByIdAndUpdate(
    id,
    {
      $inc: { hits: 1 },
      $set: { lastUsedAt: new Date() },
    },
    { new: true }
  ).lean();
}

async function removeReusableMedia(id) {
  if (!id) {
    return null;
  }

  return MediaCache.findByIdAndDelete(id).lean();
}

async function saveReusableMedia(payload = {}) {
  const normalizedUrl = normalizeCacheUrl(payload.url);

  if (!normalizedUrl || !payload.platform || !payload.mediaType || !payload.telegramFileId) {
    return null;
  }

  return MediaCache.findOneAndUpdate(
    {
      normalizedUrl,
      platform: payload.platform,
      mediaType: payload.mediaType,
    },
    {
      $set: {
        telegramFileId: payload.telegramFileId,
        telegramFileUniqueId: payload.telegramFileUniqueId || null,
        title: payload.title || null,
        uploader: payload.uploader || null,
        fileName: payload.fileName || null,
        fileSizeBytes: payload.fileSizeBytes || null,
        lastUsedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
      $inc: {
        hits: 1,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

module.exports = {
  findReusableMedia,
  touchReusableMedia,
  removeReusableMedia,
  saveReusableMedia,
};
