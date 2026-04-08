const DownloadEvent = require("../models/DownloadEvent");
const User = require("../models/User");
const { inferMediaType, normalizeLanguage } = require("../utils/platform");

function getIdentity(user = {}) {
  return {
    telegramId: Number(user.id),
    firstName: user.first_name || null,
    username: user.username || null,
  };
}

async function upsertTelegramUser(user = {}, options = {}) {
  const identity = getIdentity(user);

  if (!Number.isFinite(identity.telegramId)) {
    return null;
  }

  const preferredLanguage = normalizeLanguage(
    options.preferredLanguage || user.language_code || "en"
  );

  const setValues = {
    firstName: identity.firstName,
    username: identity.username,
    lastActive: new Date(),
    ...options.set,
  };

  const setOnInsertValues = {
    joinedAt: new Date(),
  };

  if (options.setOnInsert) {
    Object.assign(setOnInsertValues, options.setOnInsert);
  }

  if (
    !Object.prototype.hasOwnProperty.call(setValues, "preferredLanguage") &&
    !Object.prototype.hasOwnProperty.call(setOnInsertValues, "preferredLanguage")
  ) {
    setOnInsertValues.preferredLanguage = preferredLanguage;
  }

  const update = {
    $set: setValues,
    $setOnInsert: setOnInsertValues,
  };

  if (options.inc && Object.keys(options.inc).length > 0) {
    update.$inc = options.inc;
  }

  return User.findOneAndUpdate(
    { telegramId: identity.telegramId },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function getOrCreateUser(user = {}) {
  return upsertTelegramUser(user);
}

async function setPreferredLanguage(user = {}, language) {
  return upsertTelegramUser(user, {
    set: { preferredLanguage: normalizeLanguage(language) },
  });
}

async function recordDownloadRequest(user = {}, payload = {}) {
  return upsertTelegramUser(user, {
    set: {
      lastLink: payload.sourceUrl || null,
      lastPlatform: payload.platform || null,
      preferredLanguage: normalizeLanguage(payload.language || user.language_code || "en"),
    },
    inc: {
      linkRequests: 1,
    },
  });
}

async function recordSuccessfulDownload(user = {}, payload = {}) {
  const mediaType = payload.mediaType || inferMediaType(payload.platform);
  const language = normalizeLanguage(payload.language || user.language_code || "en");
  const inc = {
    downloads: 1,
  };

  if (payload.platform) {
    inc[`platformStats.${payload.platform}`] = 1;
  }

  if (mediaType === "audio") {
    inc.audioDownloads = 1;
  } else {
    inc.videoDownloads = 1;
  }

  const updatedUser = await upsertTelegramUser(user, {
    set: {
      preferredLanguage: language,
      lastLink: payload.sourceUrl || null,
      lastPlatform: payload.platform || null,
      lastMediaType: mediaType,
      lastDownloadAt: new Date(),
    },
    inc,
  });

  const identity = getIdentity(user);
  if (Number.isFinite(identity.telegramId)) {
    await DownloadEvent.create({
      telegramId: identity.telegramId,
      firstName: identity.firstName,
      username: identity.username,
      sourceUrl: payload.sourceUrl,
      platform: payload.platform || null,
      mediaType,
      language,
      title: payload.title || null,
      fileName: payload.fileName || null,
      fileSizeBytes: payload.fileSizeBytes || null,
      sizeMB: payload.fileSizeBytes
        ? Number((payload.fileSizeBytes / (1024 * 1024)).toFixed(2))
        : null,
      status: "success",
    });
  }

  return updatedUser;
}

async function recordFailedDownload(user = {}, payload = {}) {
  const language = normalizeLanguage(payload.language || user.language_code || "en");

  const updatedUser = await upsertTelegramUser(user, {
    set: {
      preferredLanguage: language,
      lastLink: payload.sourceUrl || null,
      lastPlatform: payload.platform || null,
      lastMediaType: payload.mediaType || null,
    },
    inc: {
      failedDownloads: 1,
    },
  });

  const identity = getIdentity(user);
  if (Number.isFinite(identity.telegramId)) {
    await DownloadEvent.create({
      telegramId: identity.telegramId,
      firstName: identity.firstName,
      username: identity.username,
      sourceUrl: payload.sourceUrl,
      platform: payload.platform || null,
      mediaType: payload.mediaType || null,
      language,
      title: payload.title || null,
      fileName: payload.fileName || null,
      fileSizeBytes: payload.fileSizeBytes || null,
      sizeMB: payload.fileSizeBytes
        ? Number((payload.fileSizeBytes / (1024 * 1024)).toFixed(2))
        : null,
      status: "failed",
      errorMessage: payload.errorMessage || null,
    });
  }

  return updatedUser;
}

module.exports = {
  getOrCreateUser,
  upsertTelegramUser,
  setPreferredLanguage,
  recordDownloadRequest,
  recordSuccessfulDownload,
  recordFailedDownload,
};
