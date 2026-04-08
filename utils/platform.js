const PLATFORM_RULES = [
  {
    key: "youtube",
    label: "YouTube",
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?[^\s]+/i,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/[^\s]+/i,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/[^\s]+/i,
    ],
  },
  {
    key: "tiktok",
    label: "TikTok",
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?(?:vm\.)?tiktok\.com\/[^\s]+/i,
    ],
  },
  {
    key: "facebook",
    label: "Facebook",
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\s]+/i,
      /(?:https?:\/\/)?fb\.watch\/[^\s]+/i,
    ],
  },
  {
    key: "instagram",
    label: "Instagram",
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|p)\/[^\s]+/i,
    ],
  },
];

const SUPPORTED_LANGUAGE_CODES = ["en", "km"];

function normalizeLanguage(code) {
  const value = String(code || "").toLowerCase();

  if (value.startsWith("km") || value.startsWith("kh")) {
    return "km";
  }

  return "en";
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  const cleaned = String(rawUrl)
    .trim()
    .replace(/[)>.,]+$/g, "")
    .replace(/^<|>$/g, "");

  if (!cleaned) {
    return null;
  }

  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }

  if (/^www\./i.test(cleaned)) {
    return `https://${cleaned}`;
  }

  if (/(youtube\.com|youtu\.be|tiktok\.com|facebook\.com|fb\.watch|instagram\.com)/i.test(cleaned)) {
    return `https://${cleaned}`;
  }

  return cleaned;
}

function extractUrls(text = "") {
  const tokens = String(text).match(/((?:https?:\/\/|www\.)[^\s]+|(?:youtube\.com|youtu\.be|tiktok\.com|facebook\.com|fb\.watch|instagram\.com)\/[^\s]+)/gi);

  if (!tokens) {
    return [];
  }

  return tokens.map(normalizeUrl).filter(Boolean);
}

function detectPlatform(url = "") {
  const normalized = normalizeUrl(url);

  if (!normalized) {
    return null;
  }

  return PLATFORM_RULES.find((platform) =>
    platform.patterns.some((pattern) => pattern.test(normalized))
  ) || null;
}

function getPlatformLabel(platformKey) {
  const match = PLATFORM_RULES.find((platform) => platform.key === platformKey);
  return match ? match.label : "Unknown";
}

function isSupportedUrl(url) {
  return Boolean(detectPlatform(url));
}

function extractFirstSupportedUrl(text = "") {
  const urls = extractUrls(text);
  return urls.find((url) => isSupportedUrl(url)) || null;
}

function inferMediaType(platformKey) {
  return platformKey === "youtube" ? "audio" : "video";
}

function getSupportedPlatformList() {
  return PLATFORM_RULES.map(({ key, label }) => ({ key, label }));
}

module.exports = {
  PLATFORM_RULES,
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguage,
  normalizeUrl,
  extractUrls,
  detectPlatform,
  getPlatformLabel,
  isSupportedUrl,
  extractFirstSupportedUrl,
  inferMediaType,
  getSupportedPlatformList,
};
