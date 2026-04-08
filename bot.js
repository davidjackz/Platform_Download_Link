const TelegramBot = require("node-telegram-bot-api");
const { BakongKHQR, khqrData } = require("bakong-khqr");
const QRCode = require("qrcode");
const { createCanvas, loadImage } = require("canvas");

const {
  MediaServiceError,
  detectPlatform,
  extractFirstSupportedUrl,
  inferMediaType,
  normalizeLanguage,
  prepareMediaDownload,
} = require("./downloader");
const { DEFAULT_LANGUAGE, LANGUAGE_LABELS, t } = require("./locales/messages");
const {
  emitDashboardUpdate,
  recordUserActivity,
  state,
} = require("./dashboard-data");
const {
  getOrCreateUser,
  recordDownloadRequest,
  recordFailedDownload,
  recordSuccessfulDownload,
  setPreferredLanguage,
} = require("./services/user-service");
const {
  createDonationEvent,
  updateDonationEvent,
} = require("./services/donation-service");
const {
  BakongApiError,
  classifyTransactionStatus,
  checkTransactionStatusByMd5,
  isBakongVerificationConfigured,
} = require("./services/bakong-service");
const {
  findReusableMedia,
  removeReusableMedia,
  saveReusableMedia,
  touchReusableMedia,
} = require("./services/media-cache-service");

require("dotenv").config();

const BAKONG_ACCOUNT = process.env.BAKONG_ACCOUNT_ID;
const MERCHANT_NAME = process.env.MERCHANT_NAME || "Lorn David";
const PAYWAY_LINK = process.env.PAYWAY_LINK || "https://link.payway.com.kh/ABAPAYFB405176Y";
const GITHUB_LINK = process.env.GITHUB_LINK || "https://github.com/davidjackz0505-arch/botdownloadtiktok";
const SUPPORT_LINK = process.env.SUPPORT_LINK || "https://t.me/Tutuvid";

const DONATION_EXPIRY_MS = 3 * 60 * 1000;
const DONATION_POLL_MS = 3 * 1000;
const DONATION_POLL_SLOW_MS = 5 * 1000;
const DONATION_FAST_WINDOW_MS = 45 * 1000;
const DONATION_PRESETS = {
  usd: [1, 3, 5],
  khr: [500, 1000, 4000, 10000, 20000],
};
const DOWNLOAD_CONCURRENCY = Math.max(1, Number(process.env.DOWNLOAD_CONCURRENCY || 2));
const MAX_PENDING_DOWNLOADS = Math.max(
  DOWNLOAD_CONCURRENCY,
  Number(process.env.MAX_PENDING_DOWNLOADS || 20)
);

const pendingDonations = new Map();
const pendingDownloadJobs = [];
const activeDownloadJobs = new Map();
const reservedDownloadUsers = new Set();

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trimCaptionUrl(url = "", maxLength = 900) {
  return url.length > maxLength ? `${url.slice(0, maxLength - 3)}...` : url;
}

function buildCaption(language, sourceUrl) {
  return [
    buildSectionTitle("🔗", language === "km" ? "តំណប្រភព" : "Source Link"),
    `<i>${escapeHtml(trimCaptionUrl(sourceUrl))}</i>`,
  ].join("\n");
}

function buildBulletList(items = []) {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildFancyList(items = [], icon = "✦") {
  return items.map((item) => `${icon} ${escapeHtml(item)}`).join("\n");
}

function buildSectionTitle(icon, title) {
  return `<u><b>${icon} ${escapeHtml(title)}</b></u>`;
}

function decorateButton(icon, label) {
  return `${icon} ${label}`;
}

function buildInlineNotice(icon, message) {
  return `<b>${icon}</b> <i>${message}</i>`;
}

function buildProgressMessage(icon, title, subtitle) {
  return [
    `<b>${icon} ${escapeHtml(title)}</b>`,
    subtitle ? `<i>${escapeHtml(subtitle)}</i>` : "",
  ].filter(Boolean).join("\n");
}

function getProgressCopy(language, statusKey) {
  const copy = {
    analyzing: {
      icon: "🔎",
      subtitle: language === "km"
        ? "កំពុងអានតំណ និងរៀបចំឯកសារ..."
        : "Reading your link and preparing the best file...",
    },
    downloadingVideo: {
      icon: "🎬",
      subtitle: language === "km"
        ? "កំពុងទាញយកវីដេអូគុណភាពល្អ..."
        : "Fetching the best video version for Telegram...",
    },
    downloadingAudio: {
      icon: "🎵",
      subtitle: language === "km"
        ? "កំពុងបម្លែងវីដេអូទៅជា MP3..."
        : "Converting the source into a clean MP3 file...",
    },
    uploadingVideo: {
      icon: "📤",
      subtitle: language === "km"
        ? "កំពុងផ្ញើវីដេអូទៅអ្នក..."
        : "Uploading your video now...",
    },
    uploadingAudio: {
      icon: "📤",
      subtitle: language === "km"
        ? "កំពុងផ្ញើ MP3 ទៅអ្នក..."
        : "Uploading your MP3 now...",
    },
  }[statusKey];

  if (!copy) {
    return t(language, `status.${statusKey}`);
  }

  return buildProgressMessage(copy.icon, t(language, `status.${statusKey}`), copy.subtitle);
}

function buildSourceText(language) {
  return [
    buildSectionTitle("💻", language === "km" ? "កូដប្រភព" : "Source Code"),
    language === "km"
      ? "<i>មើលកូដ ប្រើបន្ត ឬចូលរួមអភិវឌ្ឍន៍ជាមួយគម្រោងនេះ។</i>"
      : "<i>Review the codebase, fork it, or contribute improvements to the project.</i>",
    `<b>🔗 ${language === "km" ? "បើក Repository" : "Open Repository"}:</b> <a href="${escapeHtml(GITHUB_LINK)}">${escapeHtml(GITHUB_LINK)}</a>`,
  ].filter(Boolean).join("\n\n");
}

function buildContactText(language) {
  return [
    buildSectionTitle("💬", language === "km" ? "ទំនាក់ទំនង និងជំនួយ" : "Support & Contact"),
    language === "km"
      ? "<i>ត្រូវការជំនួយ ឬចង់ស្នើមុខងារថ្មី សូមទាក់ទងមកក្រុមគាំទ្រ។</i>"
      : "<i>Need help, a bug fix, or a new feature request? Reach out directly.</i>",
    `<b>🔗 ${language === "km" ? "ទាក់ទង Support" : "Contact Support"}:</b> <a href="${escapeHtml(SUPPORT_LINK)}">${escapeHtml(SUPPORT_LINK)}</a>`,
  ].filter(Boolean).join("\n\n");
}

function getQueueCopy(language, key, variables = {}) {
  const messages = {
    queuedTitle: language === "km" ? "កំពុងរង់ចាំជួរ" : "Queued for Processing",
    queuedBody: language === "km"
      ? `សំណើរបស់អ្នកស្ថិតនៅជួរលេខ ${variables.position || 1}។`
      : `Your request is waiting in queue position ${variables.position || 1}.`,
    busy: language === "km"
      ? "សូមរង់ចាំឱ្យការទាញយកមុនរបស់អ្នកបញ្ចប់សិន។"
      : "Please wait until your current download finishes.",
    full: language === "km"
      ? "បូតកំពុងមមាញឹកខ្លាំង។ សូមព្យាយាមម្តងទៀតបន្តិចក្រោយ។"
      : "The bot is busy right now. Please try again in a moment.",
    reusingCache: language === "km"
      ? "កំពុងប្រើឯកសារដែលបានរក្សាទុករួច ដើម្បីផ្ញើឱ្យបានលឿនជាងមុន..."
      : "Reusing a cached Telegram file for faster delivery...",
    restartingDownload: language === "km"
      ? "ឯកសារចាស់ប្រើមិនបានទេ។ កំពុងទាញយកឯកសារថ្មី..."
      : "The cached file is no longer reusable. Downloading a fresh copy...",
  };

  return messages[key] || "";
}

function buildQueuedJobMessage(language, position) {
  return buildProgressMessage(
    "⏳",
    getQueueCopy(language, "queuedTitle"),
    getQueueCopy(language, "queuedBody", { position })
  );
}

function extractTelegramMediaReference(message, mediaType) {
  const media = mediaType === "audio" ? message?.audio : message?.video;

  if (!media?.file_id) {
    return null;
  }

  return {
    fileId: media.file_id,
    fileUniqueId: media.file_unique_id || null,
  };
}

function canReserveDownloadSlot(userId) {
  if (reservedDownloadUsers.has(userId)) {
    return { ok: false, reason: "busy" };
  }

  if (activeDownloadJobs.size + pendingDownloadJobs.length >= MAX_PENDING_DOWNLOADS) {
    return { ok: false, reason: "full" };
  }

  reservedDownloadUsers.add(userId);
  return { ok: true };
}

function resolveLanguage(userRecord, telegramUser = {}) {
  return (
    userRecord?.preferredLanguage ||
    normalizeLanguage(telegramUser.language_code || DEFAULT_LANGUAGE)
  );
}

function buildWelcomeText(language, name) {
  const intro = t(language, "welcome.intro", { name: escapeHtml(name || "there") });

  return [
    buildSectionTitle("🚀", t(language, "welcome.title")),
    `<i>${intro}</i>`,
    buildSectionTitle("✨", t(language, "welcome.featuresTitle")),
    buildFancyList(t(language, "welcome.features"), "✦"),
    buildSectionTitle("⚡", t(language, "welcome.usageTitle")),
    buildFancyList(t(language, "welcome.usage"), "➜"),
    `🌐 ${t(language, "welcome.languageLine", {
      language: LANGUAGE_LABELS[language] || LANGUAGE_LABELS.en,
    })}`,
    language === "km"
      ? "<i>តំណមួយគត់គ្រប់គ្រាន់ ប៊ុតនឹងរកឃើញវេទិកា និងផ្ញើឯកសារដោយស្វ័យប្រវត្តិ។</i>"
      : "<i>Drop one link and the bot will detect the platform, process it, and send the file automatically.</i>",
  ].join("\n\n");
}

function buildHelpText(language) {
  return [
    buildSectionTitle("🧭", t(language, "help.title")),
    buildFancyList(t(language, "help.body"), "✦"),
    buildSectionTitle("🔗", t(language, "help.supportedTitle")),
    buildFancyList(t(language, "help.supported"), "•"),
    language === "km"
      ? "<i>សូមប្រើតំណសាធារណៈ។ បើឯកសារធំពេក សូមសាកល្បងវីដេអូខ្លីជាងមុន។</i>"
      : "<i>Use public links whenever possible. If Telegram rejects a file size, try a shorter clip.</i>",
  ].join("\n\n");
}

function formatCurrencyCode(currencyType) {
  return currencyType === khqrData.currency.usd ? "USD" : "KHR";
}

function formatCurrencyPresetCode(currencyCode) {
  return currencyCode === "usd" ? khqrData.currency.usd : khqrData.currency.khr;
}

function formatDonationAmount(amount, currencyType) {
  if (currencyType === khqrData.currency.usd) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  }

  return `${new Intl.NumberFormat("en-US").format(amount)} KHR`;
}

function formatDateTime(dateValue) {
  return new Date(dateValue).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDonationPresets(currencyCode) {
  return DONATION_PRESETS[currencyCode] || [];
}

function createMainMenu(language) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: decorateButton("✨", t(language, "buttons.help")), callback_data: "menu_help" },
          { text: decorateButton("🌐", t(language, "buttons.language")), callback_data: "menu_language" },
        ],
        [
          { text: decorateButton("❤️", t(language, "buttons.donate")), callback_data: "menu_donate" },
          { text: decorateButton("💻", t(language, "buttons.source")), url: GITHUB_LINK },
        ],
        [
          { text: decorateButton("💬", t(language, "buttons.support")), url: SUPPORT_LINK },
        ],
      ],
    },
  };
}

function createBackMenu(language) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: decorateButton("⬅️", t(language, "buttons.back")), callback_data: "menu_home" },
          { text: decorateButton("🌐", t(language, "buttons.language")), callback_data: "menu_language" },
        ],
      ],
    },
  };
}

function createLanguageMenu(language) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: decorateButton("🇺🇸", t(language, "buttons.english")), callback_data: "language_set_en" },
          { text: decorateButton("🇰🇭", t(language, "buttons.khmer")), callback_data: "language_set_km" },
        ],
        [{ text: decorateButton("⬅️", t(language, "buttons.back")), callback_data: "menu_home" }],
      ],
    },
  };
}

function createDonateMenu(language) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: decorateButton("💵", t(language, "buttons.usd")), callback_data: "donate_currency_usd" },
          { text: decorateButton("៛", t(language, "buttons.khr")), callback_data: "donate_currency_khr" },
        ],
        [{ text: decorateButton("⬅️", t(language, "buttons.back")), callback_data: "menu_home" }],
      ],
    },
  };
}

function createDonateAmountMenu(language, currencyCode) {
  const presets = getDonationPresets(currencyCode);
  const rows = [];

  for (let index = 0; index < presets.length; index += 2) {
    const pair = presets.slice(index, index + 2).map((amount) => ({
      text: decorateButton("💸", formatDonationAmount(amount, formatCurrencyPresetCode(currencyCode))),
      callback_data: `donate_amount_${currencyCode}_${amount}`,
    }));

    rows.push(pair);
  }

  rows.push([{ text: decorateButton("⬅️", t(language, "buttons.back")), callback_data: "menu_donate" }]);

  return {
    reply_markup: {
      inline_keyboard: rows,
    },
  };
}

function createDonationStatusMenu(language, md5) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: decorateButton("✅", t(language, "buttons.checkPayment")), callback_data: `donate_check_${md5}` }],
        [{ text: decorateButton("⬅️", t(language, "buttons.back")), callback_data: "menu_home" }],
      ],
    },
  };
}

let dashboardSyncTimer = null;
let dashboardSyncInFlight = false;
let dashboardSyncRequested = false;

function syncDashboard(io, delay = 400) {
  if (!io) {
    return;
  }

  dashboardSyncRequested = true;

  if (dashboardSyncTimer || dashboardSyncInFlight) {
    return;
  }

  dashboardSyncTimer = setTimeout(async () => {
    dashboardSyncTimer = null;

    if (!dashboardSyncRequested) {
      return;
    }

    dashboardSyncRequested = false;
    dashboardSyncInFlight = true;

    try {
      await emitDashboardUpdate(io);
    } catch (error) {
      console.error("Dashboard sync failed:", error.message);
    } finally {
      dashboardSyncInFlight = false;

      if (dashboardSyncRequested) {
        syncDashboard(io, delay);
      }
    }
  }, delay);
}

function runInBackground(task, label) {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error(`${label} failed:`, error.message || error);
    });
}

async function sendCachedMedia(bot, job, cachedMedia) {
  try {
    await safeEditMessage(
      bot,
      job.chatId,
      job.statusMessageId,
      buildProgressMessage(
        "⚡",
        job.language === "km" ? "កំពុងផ្ញើឯកសារដែលបានរក្សាទុក" : "Sending Cached File",
        getQueueCopy(job.language, "reusingCache")
      )
    );

    if (job.mediaType === "audio") {
      return await bot.sendAudio(job.chatId, cachedMedia.telegramFileId, {
        caption: buildCaption(job.language, job.trackedUrl),
        parse_mode: "HTML",
        title: cachedMedia.title || undefined,
        performer: cachedMedia.uploader || undefined,
      });
    }

    return await bot.sendVideo(job.chatId, cachedMedia.telegramFileId, {
      caption: buildCaption(job.language, job.trackedUrl),
      parse_mode: "HTML",
      supports_streaming: true,
    });
  } catch (error) {
    const errorMessage = String(error?.message || error || "");

    if (/wrong file identifier|file reference|invalid file|file_id/i.test(errorMessage)) {
      await removeReusableMedia(cachedMedia._id).catch(() => {});
      await safeEditMessage(
        bot,
        job.chatId,
        job.statusMessageId,
        buildProgressMessage(
          "🔄",
          job.language === "km" ? "កំពុងទាញយកឯកសារថ្មី" : "Downloading Fresh Copy",
          getQueueCopy(job.language, "restartingDownload")
        )
      );
      return null;
    }

    throw error;
  }
}

async function processDownloadJob(bot, job, io) {
  let preparedMedia = null;

  try {
    const cachedMedia = await findReusableMedia(job.trackedUrl, job.platform.key, job.mediaType);

    if (cachedMedia) {
      const cachedMessage = await sendCachedMedia(bot, job, cachedMedia);

      if (cachedMessage) {
        await safeDeleteMessage(bot, job.chatId, job.statusMessageId);

        runInBackground(async () => {
          await touchReusableMedia(cachedMedia._id);
          await recordSuccessfulDownload(job.sender, {
            sourceUrl: job.trackedUrl,
            platform: job.platform.key,
            mediaType: job.mediaType,
            title: cachedMedia.title,
            fileName: cachedMedia.fileName,
            fileSizeBytes: cachedMedia.fileSizeBytes,
            language: job.language,
          });
          syncDashboard(io);
        }, "Cached media tracking");

        return;
      }
    }

    await safeEditMessage(
      bot,
      job.chatId,
      job.statusMessageId,
      [
        getProgressCopy(job.language, "analyzing"),
        "",
        getProgressCopy(job.language, job.mediaType === "audio" ? "downloadingAudio" : "downloadingVideo"),
      ].join("\n")
    );

    preparedMedia = await prepareMediaDownload(job.trackedUrl);

    await safeEditMessage(
      bot,
      job.chatId,
      job.statusMessageId,
      getProgressCopy(job.language, preparedMedia.mediaType === "audio" ? "uploadingAudio" : "uploadingVideo")
    );

    await bot.sendChatAction(
      job.chatId,
      preparedMedia.mediaType === "audio" ? "upload_audio" : "upload_video"
    );

    let sentMessage;
    if (preparedMedia.mediaType === "audio") {
      sentMessage = await bot.sendAudio(job.chatId, preparedMedia.filePath, {
        caption: buildCaption(job.language, job.trackedUrl),
        parse_mode: "HTML",
        title: preparedMedia.title || undefined,
        performer: preparedMedia.uploader || undefined,
      });
    } else {
      sentMessage = await bot.sendVideo(job.chatId, preparedMedia.filePath, {
        caption: buildCaption(job.language, job.trackedUrl),
        parse_mode: "HTML",
        supports_streaming: true,
      });
    }

    await safeDeleteMessage(bot, job.chatId, job.statusMessageId);

    const telegramMedia = extractTelegramMediaReference(sentMessage, preparedMedia.mediaType);
    if (telegramMedia?.fileId) {
      runInBackground(async () => {
        await saveReusableMedia({
          url: job.trackedUrl,
          platform: preparedMedia.platform,
          mediaType: preparedMedia.mediaType,
          telegramFileId: telegramMedia.fileId,
          telegramFileUniqueId: telegramMedia.fileUniqueId,
          title: preparedMedia.title,
          uploader: preparedMedia.uploader,
          fileName: preparedMedia.fileName,
          fileSizeBytes: preparedMedia.fileSizeBytes,
        });
      }, "Reusable media cache save");
    }

    runInBackground(async () => {
      await recordSuccessfulDownload(job.sender, {
        sourceUrl: job.trackedUrl,
        platform: preparedMedia.platform,
        mediaType: preparedMedia.mediaType,
        title: preparedMedia.title,
        fileName: preparedMedia.fileName,
        fileSizeBytes: preparedMedia.fileSizeBytes,
        language: job.language,
      });
      syncDashboard(io);
    }, "Successful download tracking");
  } catch (error) {
    console.error(error);

    runInBackground(async () => {
      await recordFailedDownload(job.sender, {
        sourceUrl: job.trackedUrl,
        platform: job.platform.key,
        mediaType: job.mediaType,
        title: `${job.platform.label} request failed`,
        fileName: preparedMedia?.fileName || null,
        fileSizeBytes: preparedMedia?.fileSizeBytes || null,
        language: job.language,
        errorMessage: error.message || String(error),
      });
      syncDashboard(io);
    }, "Failed download tracking");

    const errorMessage = resolveErrorMessage(job.language, error);
    const edited = await safeEditMessage(
      bot,
      job.chatId,
      job.statusMessageId,
      buildInlineNotice("⚠️", errorMessage)
    );

    if (!edited) {
      await bot.sendMessage(job.chatId, buildInlineNotice("⚠️", errorMessage), { parse_mode: "HTML" });
    }
  } finally {
    if (preparedMedia?.cleanup) {
      await preparedMedia.cleanup();
    }

    syncDashboard(io);
  }
}

function pumpDownloadQueue(bot, io) {
  while (activeDownloadJobs.size < DOWNLOAD_CONCURRENCY && pendingDownloadJobs.length > 0) {
    const job = pendingDownloadJobs.shift();
    activeDownloadJobs.set(job.id, job);

    runInBackground(async () => {
      try {
        await processDownloadJob(bot, job, io);
      } finally {
        activeDownloadJobs.delete(job.id);
        reservedDownloadUsers.delete(job.userId);
        pumpDownloadQueue(bot, io);
      }
    }, `Download job ${job.id}`);
  }
}

function queueDownloadJob(bot, job, io) {
  const isQueued = activeDownloadJobs.size >= DOWNLOAD_CONCURRENCY || pendingDownloadJobs.length > 0;
  const position = pendingDownloadJobs.length + 1;
  pendingDownloadJobs.push(job);
  pumpDownloadQueue(bot, io);

  return {
    position,
    isQueued,
  };
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

async function generateKHQRCard(donation) {
  const width = 840;
  const height = 1280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, width, height);

  ctx.shadowColor = "rgba(15, 23, 42, 0.12)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 14;
  drawRoundedRect(ctx, 54, 54, width - 108, height - 108, 30);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.shadowColor = "transparent";
  drawRoundedRect(ctx, 54, 54, width - 108, height - 108, 30);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const cardX = 54;
  const cardY = 54;
  const cardWidth = width - 108;
  const cardHeight = height - 108;
  const headerHeight = 170;
  const foldSize = 78;
  const qrSize = 560;
  const qrX = Math.round((width - qrSize) / 2);
  const qrY = 550;

  drawRoundedRect(ctx, cardX, cardY, cardWidth, headerHeight, 30);
  ctx.fillStyle = "#ed161b";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 60px Arial";
  ctx.textAlign = "center";
  ctx.fillText("KHQR", width / 2, 157);

  ctx.beginPath();
  ctx.moveTo(cardX + cardWidth - foldSize - 10, cardY + headerHeight);
  ctx.lineTo(cardX + cardWidth, cardY + headerHeight);
  ctx.lineTo(cardX + cardWidth, cardY + headerHeight + foldSize);
  ctx.closePath();
  ctx.fillStyle = "#ed161b";
  ctx.fill();

  const qrBuffer = await QRCode.toBuffer(donation.qrText, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: "H",
  });
  const qrImage = await loadImage(qrBuffer);

  ctx.textAlign = "left";
  ctx.fillStyle = "#111111";
  ctx.font = "48px Arial";
  ctx.fillText(donation.merchantName.toUpperCase(), cardX + 72, 315);

  ctx.font = "bold 80px Arial";
  const cardAmount = donation.currencyType === khqrData.currency.usd
    ? `$${Number(donation.amount).toFixed(2)}`
    : `៛ ${new Intl.NumberFormat("en-US").format(donation.amount)}`;
  ctx.fillText(cardAmount, cardX + 72, 420);

  ctx.beginPath();
  ctx.setLineDash([22, 18]);
  ctx.strokeStyle = "#969696";
  ctx.lineWidth = 3;
  ctx.moveTo(cardX, 500);
  ctx.lineTo(cardX + cardWidth, 500);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  const badgeX = width / 2;
  const badgeY = qrY + qrSize / 2;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 46, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 38, 0, Math.PI * 2);
  ctx.fillStyle = "#c80815";
  ctx.fill();

  ctx.save();
  ctx.translate(badgeX, badgeY);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  const spikes = 8;
  const outerRadius = 22;
  const innerRadius = 16;
  ctx.beginPath();
  for (let index = 0; index < spikes * 2; index += 1) {
    const angle = (Math.PI / spikes) * index - Math.PI / 2;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.stroke();
  ctx.font = "bold 28px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("C", 0, 2);
  ctx.restore();

  ctx.fillStyle = "#5f5f5f";
  ctx.font = "22px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`Bill ${donation.billNumber}`, width / 2, 1180);
  ctx.fillText(`Valid until ${formatDateTime(donation.expiresAt)}`, width / 2, 1216);

  return canvas.toBuffer();
}

async function safeEditMessage(bot, chatId, messageId, text, options = {}) {
  if (!messageId) {
    return null;
  }

  try {
    return await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...options,
    });
  } catch (error) {
    if (/message is not modified/i.test(error.message || "")) {
      return null;
    }

    return null;
  }
}

async function safeEditReplyMarkup(bot, chatId, messageId, replyMarkup) {
  if (!messageId) {
    return null;
  }

  try {
    return await bot.editMessageReplyMarkup(replyMarkup, {
      chat_id: chatId,
      message_id: messageId,
    });
  } catch (error) {
    return null;
  }
}

async function safeDeleteMessage(bot, chatId, messageId) {
  if (!messageId) {
    return null;
  }

  try {
    return await bot.deleteMessage(chatId, messageId);
  } catch (error) {
    return null;
  }
}

async function sendOrEdit(bot, chatId, messageId, text, options = {}) {
  const edited = await safeEditMessage(bot, chatId, messageId, text, options);
  if (edited) {
    return edited;
  }

  return bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...options,
  });
}

function resolveErrorMessage(language, error) {
  const errorMessage = String(error?.message || "");

  if (!(error instanceof MediaServiceError)) {
    return t(language, "status.genericError");
  }

  if (
    error.code === "MISSING_DEPENDENCY" ||
    /not installed|not available on path/i.test(errorMessage)
  ) {
    return t(language, "status.toolMissing");
  }

  if (
    error.code === "FILE_TOO_LARGE" ||
    /larger than|max-filesize/i.test(errorMessage)
  ) {
    return t(language, "status.fileTooLarge");
  }

  if (error.code === "UNSUPPORTED_URL") {
    return t(language, "status.unsupported");
  }

  if (
    error.code === "UNAVAILABLE" ||
    error.code === "BAD_METADATA" ||
    /private|sign in|members only|requested format is not available|unavailable/i.test(errorMessage)
  ) {
    return t(language, "status.privateLink");
  }

  return t(language, "status.genericError");
}

function buildDonationCaption(language, donation, includeSuccess = false) {
  const autoHint = language === "km"
    ? "ប្រព័ន្ធនឹងពិនិត្យការទូទាត់ស្វ័យប្រវត្តិរៀងរាល់ 3 វិនាទី ហើយ QR នេះមានសុពលភាព 3 នាទី។"
    : "Payment is checked automatically every 3 seconds and this QR is valid for 3 minutes.";

  const lines = [
    buildSectionTitle("❤️", t(language, "status.donateIntro")),
    `<i>${escapeHtml(autoHint)}</i>`,
    "",
    `<b>💸 ${language === "km" ? "ចំនួនទឹកប្រាក់" : "Amount"}:</b> ${formatDonationAmount(donation.amount, donation.currencyType)}`,
    `<b>💱 ${language === "km" ? "រូបិយប័ណ្ណ" : "Currency"}:</b> ${formatCurrencyCode(donation.currencyType)}`,
    `<b>🧾 ${language === "km" ? "លេខបង្កាន់ដៃ" : "Bill"}:</b> ${escapeHtml(donation.billNumber)}`,
    `<b>⏳ ${language === "km" ? "ផុតកំណត់" : "Expires"}:</b> ${escapeHtml(formatDateTime(donation.expiresAt))}`,
    `<b>🔗 PayWay:</b> ${escapeHtml(PAYWAY_LINK)}`,
  ];

  if (!isBakongVerificationConfigured()) {
    lines.splice(2, 0, buildInlineNotice("⚠️", t(language, "status.donateVerificationUnavailable")));
  }

  if (includeSuccess) {
    lines.push(
      "",
      `<b>✅ ${t(language, "status.donateSuccess", {
        name: escapeHtml(donation.firstName || "friend"),
      })}</b>`
    );
  }

  return lines.join("\n");
}

function clearDonationSession(md5) {
  const session = pendingDonations.get(md5);
  if (session?.timer) {
    clearInterval(session.timer);
  }
  if (session?.expiryTimer) {
    clearTimeout(session.expiryTimer);
  }
  pendingDonations.delete(md5);
}

function stopDonationPolling(md5) {
  const session = pendingDonations.get(md5);

  if (!session?.timer) {
    return;
  }

  clearInterval(session.timer);
  pendingDonations.set(md5, {
    ...session,
    timer: null,
  });
}

async function finalizeDonationSuccess(bot, session) {
  await safeDeleteMessage(bot, session.chatId, session.photoMessageId);

  await bot.sendMessage(
    session.chatId,
    [
      buildSectionTitle("✅", session.language === "km" ? "ការទូទាត់ជោគជ័យ" : "Payment Confirmed"),
      t(session.language, "status.donateSuccess", {
        name: escapeHtml(session.firstName || "friend"),
      }),
      "",
      `<b>💸 ${session.language === "km" ? "ចំនួនទឹកប្រាក់" : "Amount"}:</b> ${formatDonationAmount(session.amount, session.currencyType)}`,
      `<b>🧾 ${session.language === "km" ? "លេខបង្កាន់ដៃ" : "Bill"}:</b> ${escapeHtml(session.billNumber)}`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
}

async function finalizeDonationExpired(bot, session, io) {
  await updateDonationEvent(session.md5, {
    status: "expired",
    lastCheckedAt: new Date(),
    errorMessage: "Donation session expired before payment confirmation.",
  }).catch(() => {});
  clearDonationSession(session.md5);
  await safeDeleteMessage(bot, session.chatId, session.photoMessageId);
  await bot.sendMessage(session.chatId, t(session.language, "status.donateExpired"), {
    parse_mode: "HTML",
  }).catch(() => {});
  await syncDashboard(io);
}

async function finalizeDonationFailed(bot, session, message) {
  await updateDonationEvent(session.md5, {
    status: "failed",
    lastCheckedAt: new Date(),
    errorMessage: message,
  }).catch(() => {});
  clearDonationSession(session.md5);
  await safeDeleteMessage(bot, session.chatId, session.photoMessageId);
  return {
    state: "failed",
    callbackText: message,
  };
}

async function checkDonationStatus(bot, md5, io) {
  const session = pendingDonations.get(md5);

  if (!session) {
    return { state: "expired", callbackText: t("en", "status.donateExpired") };
  }

  if (Date.now() > session.expiresAt) {
    await finalizeDonationExpired(bot, session, io);
    return {
      state: "expired",
      callbackText: t(session.language, "status.donateExpired"),
    };
  }

  if (!isBakongVerificationConfigured()) {
    return {
      state: "unavailable",
      callbackText: t(session.language, "status.donateVerificationUnavailable"),
    };
  }

  try {
    const payload = await checkTransactionStatusByMd5(md5);
    const status = classifyTransactionStatus(payload);

    if (status.state === "success") {
      await updateDonationEvent(md5, {
        status: "success",
        paidAt: new Date(),
        lastCheckedAt: new Date(),
        transactionHash: status.transaction?.hash || null,
        errorMessage: null,
      }).catch(() => {});
      clearDonationSession(md5);
      await finalizeDonationSuccess(bot, session);
      await syncDashboard(io);
      return {
        state: "success",
        callbackText: t(session.language, "status.donateSuccessShort"),
      };
    }

    if (status.state === "failed") {
      return finalizeDonationFailed(bot, session, t(session.language, "status.donateFailed"));
    }

    if (status.state === "unsupported") {
      await updateDonationEvent(md5, {
        status: "unsupported",
        lastCheckedAt: new Date(),
        errorMessage: t(session.language, "status.donateUnsupported"),
      }).catch(() => {});
      clearDonationSession(md5);
      await safeDeleteMessage(bot, session.chatId, session.photoMessageId);
      return {
        state: "unsupported",
        callbackText: t(session.language, "status.donateUnsupported"),
      };
    }

    if (status.state === "pending") {
      return {
        state: "pending",
        callbackText: t(session.language, "status.donatePending"),
      };
    }

    return {
      state: "error",
      callbackText: t(session.language, "status.genericError"),
    };
  } catch (error) {
    console.error("Bakong transaction check failed:", error.message || error);

    if (
      error instanceof BakongApiError &&
      ["MISSING_TOKEN", "MISSING_EMAIL", "UNAUTHORIZED", "TOKEN_RENEW_FAILED"].includes(error.code)
    ) {
      await updateDonationEvent(md5, {
        status: "auth_error",
        lastCheckedAt: new Date(),
        errorMessage: error.message || t(session.language, "status.donateVerificationAuthError"),
      }).catch(() => {});
      return {
        state: "auth_error",
        callbackText: t(session.language, "status.donateVerificationAuthError"),
      };
    }

    return {
      state: "error",
      callbackText: t(session.language, "status.genericError"),
    };
  }
}

async function runDonationStatusCheck(bot, md5, io) {
  const session = pendingDonations.get(md5);

  if (!session) {
    return { state: "expired", callbackText: t("en", "status.donateExpired") };
  }

  if (session.checking) {
    return {
      state: "pending",
      callbackText: t(session.language, "status.donatePending"),
    };
  }

  pendingDonations.set(md5, {
    ...session,
    checking: true,
  });

  try {
    return await checkDonationStatus(bot, md5, io);
  } finally {
    const latest = pendingDonations.get(md5);
    if (latest) {
      pendingDonations.set(md5, {
        ...latest,
        checking: false,
      });
    }
  }
}

function scheduleDonationCheck(bot, session, io) {
  const scheduleNextPoll = () => {
    const latest = pendingDonations.get(session.md5);
    if (!latest) {
      return null;
    }

    const elapsed = Date.now() - latest.startedAt;
    const nextDelay = elapsed >= DONATION_FAST_WINDOW_MS ? DONATION_POLL_SLOW_MS : DONATION_POLL_MS;

    return setTimeout(async () => {
      const result = await runDonationStatusCheck(bot, session.md5, io);

      if (["success", "failed", "expired", "unsupported"].includes(result.state)) {
        clearDonationSession(session.md5);
        return;
      }

      if (result.state === "auth_error") {
        stopDonationPolling(session.md5);
        return;
      }

      const current = pendingDonations.get(session.md5);
      if (current) {
        pendingDonations.set(session.md5, {
          ...current,
          timer: scheduleNextPoll(),
        });
      }
    }, nextDelay);
  };

  const timer = isBakongVerificationConfigured() ? scheduleNextPoll() : null;

  const expiryDelay = Math.max(session.expiresAt - Date.now(), 0);
  const expiryTimer = setTimeout(async () => {
    const latest = pendingDonations.get(session.md5);
    if (!latest) {
      return;
    }

    await finalizeDonationExpired(bot, latest, io);
  }, expiryDelay);

  pendingDonations.set(session.md5, {
    ...session,
    startedAt: session.startedAt || Date.now(),
    timer,
    expiryTimer,
    checking: false,
  });
}

async function showHome(bot, chatId, sender, language, messageId) {
  return sendOrEdit(
    bot,
    chatId,
    messageId,
    buildWelcomeText(language, sender.first_name || sender.username || "there"),
    createMainMenu(language)
  );
}

async function showHelp(bot, chatId, language, messageId) {
  return sendOrEdit(
    bot,
    chatId,
    messageId,
    buildHelpText(language),
    createBackMenu(language)
  );
}

async function showLanguagePicker(bot, chatId, language, messageId) {
  return sendOrEdit(
    bot,
    chatId,
    messageId,
    [
      buildSectionTitle("🌐", t(language, "status.chooseLanguage")),
      `<i>${language === "km" ? "ប្តូរភាសាប្រព័ន្ធសម្រាប់សារ និងម៉ឺនុយទាំងអស់។" : "Switch the bot language for every menu and reply."}</i>`,
    ].join("\n\n"),
    createLanguageMenu(language)
  );
}

async function showDonateMenu(bot, chatId, language, messageId) {
  return sendOrEdit(
    bot,
    chatId,
    messageId,
    [
      buildSectionTitle("❤️", t(language, "status.chooseCurrency")),
      `<i>${t(language, "status.donateIntro")}</i>`,
      buildInlineNotice("⏱️", language === "km"
        ? "បន្ទាប់ពីបង្កើត KHQR ប្រព័ន្ធនឹងពិនិត្យការទូទាត់ដោយស្វ័យប្រវត្តិ។"
        : "Once the KHQR card is created, payment will be checked automatically."),
    ].join("\n\n"),
    createDonateMenu(language)
  );
}

const setupBot = (token, domain, createTempLink, io) => {
  let bot;
  const bakong = new BakongKHQR();
  const isCloudMode = Boolean(domain && !domain.includes("localhost"));

  if (isCloudMode) {
    console.log("CLOUD MODE: Webhook active");
    bot = new TelegramBot(token);
  } else {
    console.log("LOCAL MODE: Polling active");
    bot = new TelegramBot(token, { polling: true });
    bot.deleteWebHook().catch(() => {});
  }

  bot.registerWebhook = async () => {
    if (!isCloudMode) {
      return null;
    }

    const webhookUrl = `${domain}/bot${token}`;
    console.log(`Registering webhook at ${webhookUrl}`);

    return bot.setWebHook(webhookUrl, {
      drop_pending_updates: true,
    });
  };

  bot.on("polling_error", (error) => {
    console.error("Telegram polling error:", error.code || error.message || error);
  });

  bot.on("webhook_error", (error) => {
    console.error("Telegram webhook error:", error.message || error);
  });

  bot.setMyCommands([
    { command: "start", description: "Show welcome and features" },
    { command: "help", description: "Show supported platforms" },
    { command: "language", description: "Change bot language" },
    { command: "donate", description: "Support the bot" },
    { command: "source", description: "Open source repository" },
    { command: "contact", description: "Support contact" },
  ]).catch((error) => {
    console.error("Failed to set bot commands:", error.code || error.message || error);
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const sender = msg.from || {};
    const text = (msg.text || msg.caption || "").trim();

    if (!sender.id) {
      return;
    }

    const trackedUrl = extractFirstSupportedUrl(text);
    const currentUser = await getOrCreateUser(sender);
    const language = resolveLanguage(currentUser, sender);

    recordUserActivity(
      { id: sender.id, firstName: sender.first_name, username: sender.username },
      { lastLink: trackedUrl || currentUser?.lastLink || null }
    );

    if (currentUser?.isBlocked) {
      await bot.sendMessage(chatId, buildInlineNotice("⛔", t(language, "status.blocked")), {
        parse_mode: "HTML",
      });
      await syncDashboard(io);
      return;
    }

    if (!text) {
      await syncDashboard(io);
      return;
    }

    if (/^\/start\b/i.test(text)) {
      await showHome(bot, chatId, sender, language);
      await syncDashboard(io);
      return;
    }

    if (/^\/help\b/i.test(text)) {
      await showHelp(bot, chatId, language);
      await syncDashboard(io);
      return;
    }

    if (/^\/language\b/i.test(text)) {
      await showLanguagePicker(bot, chatId, language);
      await syncDashboard(io);
      return;
    }

    if (/^\/donate\b/i.test(text)) {
      await showDonateMenu(bot, chatId, language);
      await syncDashboard(io);
      return;
    }

    if (/^\/source\b/i.test(text)) {
      await bot.sendMessage(chatId, buildSourceText(language), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      await syncDashboard(io);
      return;
    }

    if (/^\/contact\b/i.test(text)) {
      await bot.sendMessage(chatId, buildContactText(language), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      await syncDashboard(io);
      return;
    }

    if (!trackedUrl) {
      await bot.sendMessage(chatId, buildInlineNotice("🔗", t(language, "status.noLink")), {
        parse_mode: "HTML",
      });
      await syncDashboard(io);
      return;
    }

    const platform = detectPlatform(trackedUrl);
    if (!platform) {
      await bot.sendMessage(chatId, buildInlineNotice("⚠️", t(language, "status.unsupported")), {
        parse_mode: "HTML",
      });
      await syncDashboard(io);
      return;
    }

    const reservation = canReserveDownloadSlot(sender.id);
    if (!reservation.ok) {
      await bot.sendMessage(
        chatId,
        buildInlineNotice(
          reservation.reason === "busy" ? "⏳" : "🚦",
          getQueueCopy(language, reservation.reason)
        ),
        { parse_mode: "HTML" }
      );
      await syncDashboard(io);
      return;
    }

    const mediaType = inferMediaType(platform.key);

    try {
      const statusMessage = await bot.sendMessage(
        chatId,
        [
          getProgressCopy(language, "analyzing"),
          "",
          getProgressCopy(language, mediaType === "audio" ? "downloadingAudio" : "downloadingVideo"),
        ].join("\n"),
        { parse_mode: "HTML" }
      );

      runInBackground(async () => {
        await recordDownloadRequest(sender, {
          sourceUrl: trackedUrl,
          platform: platform.key,
          language,
        });
        syncDashboard(io);
      }, "Download request tracking");

      const queuedJob = queueDownloadJob(bot, {
        id: `${sender.id}-${Date.now()}`,
        userId: sender.id,
        chatId,
        sender,
        trackedUrl,
        platform,
        language,
        mediaType,
        statusMessageId: statusMessage.message_id,
      }, io);

      if (queuedJob.isQueued) {
        await safeEditMessage(
          bot,
          chatId,
          statusMessage.message_id,
          buildQueuedJobMessage(language, queuedJob.position)
        );
      }
    } catch (error) {
      reservedDownloadUsers.delete(sender.id);
      console.error("Failed to queue download job:", error);
      await bot.sendMessage(chatId, buildInlineNotice("⚠️", t(language, "status.genericError")), {
        parse_mode: "HTML",
      }).catch(() => {});
    }
  });

  bot.on("callback_query", async (query) => {
    const message = query.message;
    const sender = query.from || {};
    const action = query.data;

    if (!message || !sender.id) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const chatId = message.chat.id;
    const currentUser = await getOrCreateUser(sender);
    const language = resolveLanguage(currentUser, sender);

    recordUserActivity(
      { id: sender.id, firstName: sender.first_name, username: sender.username },
      { lastLink: currentUser?.lastLink || null }
    );

    if (currentUser?.isBlocked) {
      await bot.answerCallbackQuery(query.id, {
        text: t(language, "status.blocked"),
        show_alert: true,
      });
      await syncDashboard(io);
      return;
    }

    if (action === "menu_home") {
      await showHome(bot, chatId, sender, language, message.message_id);
      await bot.answerCallbackQuery(query.id).catch(() => {});
      await syncDashboard(io);
      return;
    }

    if (action === "menu_help") {
      await showHelp(bot, chatId, language, message.message_id);
      await bot.answerCallbackQuery(query.id).catch(() => {});
      await syncDashboard(io);
      return;
    }

    if (action === "menu_language") {
      await showLanguagePicker(bot, chatId, language, message.message_id);
      await bot.answerCallbackQuery(query.id).catch(() => {});
      await syncDashboard(io);
      return;
    }

    if (action === "menu_donate") {
      await showDonateMenu(bot, chatId, language, message.message_id);
      await bot.answerCallbackQuery(query.id).catch(() => {});
      await syncDashboard(io);
      return;
    }

    if (action === "language_set_en" || action === "language_set_km") {
      const nextLanguage = action.endsWith("_km") ? "km" : "en";
      await setPreferredLanguage(sender, nextLanguage);
      await bot.answerCallbackQuery(query.id, {
        text: t(nextLanguage, "status.languageUpdated"),
      });
      await showHome(bot, chatId, sender, nextLanguage, message.message_id);
      await syncDashboard(io);
      return;
    }

    if (action === "donate_currency_usd" || action === "donate_currency_khr") {
      const currencyCode = action.endsWith("_usd") ? "usd" : "khr";
      await sendOrEdit(
        bot,
        chatId,
        message.message_id,
        [
          buildSectionTitle("💸", t(language, "status.chooseAmount")),
          `<i>${language === "km" ? "ជ្រើសរើសចំនួនទឹកប្រាក់ដែលអ្នកចង់គាំទ្របូត។" : "Pick the amount you want to support the bot with."}</i>`,
        ].join("\n\n"),
        createDonateAmountMenu(language, currencyCode)
      );
      await bot.answerCallbackQuery(query.id).catch(() => {});
      await syncDashboard(io);
      return;
    }

    const amountMatch = action.match(/^donate_amount_(usd|khr)_(\d+)$/);
    if (amountMatch) {
      const currencyCode = amountMatch[1];
      const amount = Number(amountMatch[2]);
      const currencyType = formatCurrencyPresetCode(currencyCode);
      const expiresAt = Date.now() + DONATION_EXPIRY_MS;
      const billNumber = `DN-${Date.now().toString(36).toUpperCase().slice(-8)}`;

      try {
        if (!BAKONG_ACCOUNT) {
          await bot.answerCallbackQuery(query.id, {
            text: t(language, "status.qrError"),
            show_alert: true,
          });
          await syncDashboard(io);
          return;
        }

        const khqr = bakong.generateIndividual({
          bakongAccountID: BAKONG_ACCOUNT,
          merchantName: MERCHANT_NAME,
          merchantCity: "Phnom Penh",
          acquiringBank: "Bakong",
          currency: currencyType,
          amount,
          billNumber,
          expirationTimestamp: expiresAt,
          merchantCategoryCode: "5999",
          purposeOfTransaction: "Support bot",
        });

        if (khqr.status.code === 0 && khqr.data?.qr && khqr.data?.md5) {
          const donation = {
            amount,
            billNumber,
            currencyCode,
            currencyType,
            expiresAt,
            firstName: sender.first_name || sender.username || "friend",
            merchantName: MERCHANT_NAME,
            qrText: khqr.data.qr,
            md5: khqr.data.md5,
          };

          const card = await generateKHQRCard(donation);
          const sentPhoto = await bot.sendPhoto(chatId, card, {
            caption: buildDonationCaption(language, donation),
            parse_mode: "HTML",
            ...createDonationStatusMenu(language, donation.md5),
          });

          await createDonationEvent(sender, {
            ...donation,
            language,
            paywayLink: PAYWAY_LINK,
            status: "pending",
          }).catch((error) => {
            console.error("Failed to persist donation event:", error.message || error);
          });

          await safeDeleteMessage(bot, chatId, message.message_id);

          scheduleDonationCheck(
            bot,
            {
              ...donation,
              chatId,
              language,
              photoMessageId: sentPhoto.message_id,
            },
            io
          );

          await bot.answerCallbackQuery(query.id).catch(() => {});
        } else {
          await bot.answerCallbackQuery(query.id, {
            text: t(language, "status.qrError"),
            show_alert: true,
          });
        }
      } catch (error) {
        console.error("Failed to create KHQR donation:", error);
        await bot.answerCallbackQuery(query.id, {
          text: t(language, "status.qrError"),
          show_alert: true,
        });
      }

      await syncDashboard(io);
      return;
    }

    const donateCheckMatch = action.match(/^donate_check_([a-f0-9]{32})$/i);
    if (donateCheckMatch) {
      const result = await runDonationStatusCheck(bot, donateCheckMatch[1], io);

      await bot.answerCallbackQuery(query.id, {
        text: result.callbackText,
        show_alert: result.state !== "pending" && result.state !== "success",
      }).catch(() => {});

      await syncDashboard(io);
      return;
    }

    await bot.answerCallbackQuery(query.id).catch(() => {});
    await syncDashboard(io);
  });

  return bot;
};

module.exports = { setupBot, state };
