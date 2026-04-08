const mongoose = require("mongoose");

const { LANGUAGE_LABELS } = require("./locales/messages");
const DonationEvent = require("./models/DonationEvent");
const DownloadEvent = require("./models/DownloadEvent");
const User = require("./models/User");
const { getPlatformLabel, getSupportedPlatformList } = require("./utils/platform");

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

const state = {
  userList: [],
};

function getDisplayName(user = {}) {
  return (
    user.firstName ||
    user.name ||
    user.username ||
    (user.telegramId || user.id ? `User ${user.telegramId || user.id}` : "Unknown User")
  );
}

function pruneActiveUsers() {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  state.userList = state.userList.filter((user) => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return Number.isFinite(lastSeen) && lastSeen >= cutoff;
  });

  return state.userList;
}

function recordUserActivity(user = {}, extra = {}) {
  const id = Number(user.id ?? user.telegramId);

  if (!Number.isFinite(id)) {
    return pruneActiveUsers();
  }

  pruneActiveUsers();

  const entry = {
    id,
    name: getDisplayName(user),
    username: user.username || null,
    lastSeen: new Date().toISOString(),
    lastLink: extra.lastLink || null,
  };

  state.userList = [
    entry,
    ...state.userList.filter((current) => current.id !== id),
  ].slice(0, 48);

  return state.userList;
}

function buildDateWindow(days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));

    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      date,
    };
  });
}

function mapCountRows(rows = [], keys, labelGetter) {
  const counts = new Map(rows.map((row) => [row._id || "unknown", row.total || 0]));

  return keys.map((key) => ({
    key,
    label: labelGetter(key),
    count: counts.get(key) || 0,
  }));
}

function serializeUser(user = {}, donationSummary = {}) {
  return {
    telegramId: user.telegramId,
    name: getDisplayName(user),
    username: user.username || null,
    preferredLanguage: user.preferredLanguage || "en",
    downloads: user.downloads || 0,
    videoDownloads: user.videoDownloads || 0,
    audioDownloads: user.audioDownloads || 0,
    linkRequests: user.linkRequests || 0,
    failedDownloads: user.failedDownloads || 0,
    lastLink: user.lastLink || null,
    lastPlatform: user.lastPlatform || null,
    lastMediaType: user.lastMediaType || null,
    joinedAt: user.joinedAt ? new Date(user.joinedAt).toISOString() : null,
    lastActive: user.lastActive ? new Date(user.lastActive).toISOString() : null,
    lastDownloadAt: user.lastDownloadAt ? new Date(user.lastDownloadAt).toISOString() : null,
    isBlocked: Boolean(user.isBlocked),
    blockedAt: user.blockedAt ? new Date(user.blockedAt).toISOString() : null,
    donationsCount: donationSummary.donationsCount || 0,
    successfulDonations: donationSummary.successfulDonations || 0,
    totalDonatedUsd: donationSummary.totalDonatedUsd || 0,
    totalDonatedKhr: donationSummary.totalDonatedKhr || 0,
    lastDonationAt: donationSummary.lastDonationAt
      ? new Date(donationSummary.lastDonationAt).toISOString()
      : null,
  };
}

function serializeDownload(download = {}) {
  return {
    telegramId: download.telegramId,
    name: getDisplayName(download),
    username: download.username || null,
    sourceUrl: download.sourceUrl || null,
    platform: download.platform || null,
    mediaType: download.mediaType || null,
    language: download.language || "en",
    title: download.title || "Media request",
    fileName: download.fileName || null,
    fileSizeBytes: typeof download.fileSizeBytes === "number" ? download.fileSizeBytes : null,
    sizeMB: typeof download.sizeMB === "number" ? download.sizeMB : null,
    status: download.status || "success",
    errorMessage: download.errorMessage || null,
    createdAt: download.createdAt ? new Date(download.createdAt).toISOString() : null,
  };
}

function serializeDonation(donation = {}) {
  return {
    telegramId: donation.telegramId,
    name: getDisplayName(donation),
    username: donation.username || null,
    preferredLanguage: donation.preferredLanguage || "en",
    merchantName: donation.merchantName || null,
    amount: donation.amount || 0,
    currencyCode: donation.currencyCode || "usd",
    billNumber: donation.billNumber || null,
    md5: donation.md5 || null,
    paywayLink: donation.paywayLink || null,
    status: donation.status || "pending",
    transactionHash: donation.transactionHash || null,
    errorMessage: donation.errorMessage || null,
    createdAt: donation.createdAt ? new Date(donation.createdAt).toISOString() : null,
    expiresAt: donation.expiresAt ? new Date(donation.expiresAt).toISOString() : null,
    paidAt: donation.paidAt ? new Date(donation.paidAt).toISOString() : null,
    lastCheckedAt: donation.lastCheckedAt ? new Date(donation.lastCheckedAt).toISOString() : null,
  };
}

function buildFallbackDashboard() {
  pruneActiveUsers();

  return {
    stats: {
      totalUsers: 0,
      blockedUsers: 0,
      totalDownloads: 0,
      videoDownloads: 0,
      audioDownloads: 0,
      linkRequests: 0,
      failedDownloads: 0,
      successRate: 0,
      activeNow: state.userList.length,
      totalDonations: 0,
      successfulDonations: 0,
      pendingDonations: 0,
      expiredDonations: 0,
      failedDonationStates: 0,
      totalDonatedUsd: 0,
      totalDonatedKhr: 0,
      donationSuccessRate: 0,
    },
    charts: {
      labels: [],
      downloads: [],
      failures: [],
      signups: [],
      donationsCreated: [],
      donationsPaid: [],
    },
    breakdowns: {
      platforms: getSupportedPlatformList().map((platform) => ({
        key: platform.key,
        label: platform.label,
        count: 0,
      })),
      mediaTypes: [
        { key: "video", label: "Video", count: 0 },
        { key: "audio", label: "Audio / MP3", count: 0 },
      ],
      languages: Object.entries(LANGUAGE_LABELS).map(([key, label]) => ({
        key,
        label,
        count: 0,
      })),
      donationStatuses: [
        { key: "pending", label: "Pending", count: 0 },
        { key: "success", label: "Success", count: 0 },
        { key: "failed", label: "Failed", count: 0 },
        { key: "expired", label: "Expired", count: 0 },
        { key: "auth_error", label: "Auth error", count: 0 },
      ],
      donationCurrencies: [
        { key: "usd", label: "USD", count: 0 },
        { key: "khr", label: "KHR", count: 0 },
      ],
    },
    activeUsers: state.userList.map((entry) => ({
      id: entry.id,
      name: entry.name,
      username: entry.username || null,
      preferredLanguage: "en",
      lastSeen: entry.lastSeen,
      lastLink: entry.lastLink || null,
      downloads: 0,
      isBlocked: false,
      donationsCount: 0,
      totalDonatedUsd: 0,
      totalDonatedKhr: 0,
    })),
    users: [],
    topUsers: [],
    recentDownloads: [],
    donations: [],
    recentDonations: [],
    generatedAt: new Date().toISOString(),
  };
}

async function getDashboardData() {
  pruneActiveUsers();

  if (mongoose.connection.readyState !== 1) {
    return buildFallbackDashboard();
  }

  const dateWindow = buildDateWindow(7);
  const since = dateWindow[0].date;
  const activeIds = state.userList.map((user) => user.id);

  const [
    aggregateRows,
    totalUsers,
    blockedUsers,
    users,
    topUsers,
    recentDownloads,
    signupRows,
    downloadRows,
    failureRows,
    platformRows,
    mediaRows,
    languageRows,
    activeUserRows,
    donations,
    donationAggregateRows,
    donationCreatedRows,
    donationPaidRows,
    donationStatusRows,
    donationCurrencyRows,
    donationUserRows,
  ] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: null,
          downloads: { $sum: { $ifNull: ["$downloads", 0] } },
          videoDownloads: { $sum: { $ifNull: ["$videoDownloads", 0] } },
          audioDownloads: { $sum: { $ifNull: ["$audioDownloads", 0] } },
          linkRequests: { $sum: { $ifNull: ["$linkRequests", 0] } },
          failedDownloads: { $sum: { $ifNull: ["$failedDownloads", 0] } },
        },
      },
    ]),
    User.countDocuments(),
    User.countDocuments({ isBlocked: true }),
    User.find().sort({ lastActive: -1, downloads: -1 }).lean(),
    User.find().sort({ downloads: -1, lastActive: -1 }).limit(8).lean(),
    DownloadEvent.find().sort({ createdAt: -1 }).limit(18).lean(),
    User.aggregate([
      { $match: { joinedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$joinedAt" } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    DownloadEvent.aggregate([
      { $match: { createdAt: { $gte: since }, status: "success" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    DownloadEvent.aggregate([
      { $match: { createdAt: { $gte: since }, status: "failed" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    DownloadEvent.aggregate([
      { $match: { status: "success", platform: { $ne: null } } },
      { $group: { _id: "$platform", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    DownloadEvent.aggregate([
      { $match: { status: "success", mediaType: { $ne: null } } },
      { $group: { _id: "$mediaType", total: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $group: { _id: "$preferredLanguage", total: { $sum: 1 } } },
    ]),
    activeIds.length
      ? User.find({ telegramId: { $in: activeIds } }).lean()
      : Promise.resolve([]),
    DonationEvent.find().sort({ createdAt: -1 }).lean(),
    DonationEvent.aggregate([
      {
        $group: {
          _id: null,
          totalDonations: { $sum: 1 },
          successfulDonations: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          pendingDonations: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          expiredDonations: {
            $sum: { $cond: [{ $eq: ["$status", "expired"] }, 1, 0] },
          },
          failedDonations: {
            $sum: {
              $cond: [
                { $in: ["$status", ["failed", "unsupported", "auth_error"]] },
                1,
                0,
              ],
            },
          },
          totalDonatedUsd: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "success"] },
                    { $eq: ["$currencyCode", "usd"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          totalDonatedKhr: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "success"] },
                    { $eq: ["$currencyCode", "khr"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]),
    DonationEvent.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    DonationEvent.aggregate([
      { $match: { status: "success", paidAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    DonationEvent.aggregate([
      { $group: { _id: "$status", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    DonationEvent.aggregate([
      { $group: { _id: "$currencyCode", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    DonationEvent.aggregate([
      {
        $group: {
          _id: "$telegramId",
          donationsCount: { $sum: 1 },
          successfulDonations: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          totalDonatedUsd: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "success"] },
                    { $eq: ["$currencyCode", "usd"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          totalDonatedKhr: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "success"] },
                    { $eq: ["$currencyCode", "khr"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          lastDonationAt: { $max: "$createdAt" },
        },
      },
    ]),
  ]);

  const aggregate = aggregateRows[0] || {
    downloads: 0,
    videoDownloads: 0,
    audioDownloads: 0,
    linkRequests: 0,
    failedDownloads: 0,
  };

  const donationAggregate = donationAggregateRows[0] || {
    totalDonations: 0,
    successfulDonations: 0,
    pendingDonations: 0,
    expiredDonations: 0,
    failedDonations: 0,
    totalDonatedUsd: 0,
    totalDonatedKhr: 0,
  };

  const signupMap = new Map(signupRows.map((item) => [item._id, item.total]));
  const downloadMap = new Map(downloadRows.map((item) => [item._id, item.total]));
  const failureMap = new Map(failureRows.map((item) => [item._id, item.total]));
  const donationCreatedMap = new Map(donationCreatedRows.map((item) => [item._id, item.total]));
  const donationPaidMap = new Map(donationPaidRows.map((item) => [item._id, item.total]));
  const activeUserMap = new Map(activeUserRows.map((user) => [user.telegramId, user]));
  const donationUserMap = new Map(donationUserRows.map((row) => [row._id, row]));

  const activeUsers = state.userList.map((entry) => {
    const dbUser = activeUserMap.get(entry.id) || {};
    const donationSummary = donationUserMap.get(entry.id) || {};

    return {
      id: entry.id,
      name: entry.name,
      username: entry.username || dbUser.username || null,
      preferredLanguage: dbUser.preferredLanguage || "en",
      lastSeen: entry.lastSeen,
      lastLink: entry.lastLink || dbUser.lastLink || null,
      downloads: dbUser.downloads || 0,
      lastPlatform: dbUser.lastPlatform || null,
      isBlocked: Boolean(dbUser.isBlocked),
      donationsCount: donationSummary.donationsCount || 0,
      totalDonatedUsd: donationSummary.totalDonatedUsd || 0,
      totalDonatedKhr: donationSummary.totalDonatedKhr || 0,
    };
  });

  const totalDownloads = aggregate.downloads || 0;
  const linkRequests = aggregate.linkRequests || 0;
  const failedDownloads = aggregate.failedDownloads || 0;
  const successRate = linkRequests > 0 ? Math.round((totalDownloads / linkRequests) * 100) : 0;
  const totalDonations = donationAggregate.totalDonations || 0;
  const successfulDonations = donationAggregate.successfulDonations || 0;
  const donationSuccessRate = totalDonations > 0
    ? Math.round((successfulDonations / totalDonations) * 100)
    : 0;

  return {
    stats: {
      totalUsers,
      blockedUsers,
      totalDownloads,
      videoDownloads: aggregate.videoDownloads || 0,
      audioDownloads: aggregate.audioDownloads || 0,
      linkRequests,
      failedDownloads,
      successRate,
      activeNow: activeUsers.length,
      totalDonations,
      successfulDonations,
      pendingDonations: donationAggregate.pendingDonations || 0,
      expiredDonations: donationAggregate.expiredDonations || 0,
      failedDonationStates: donationAggregate.failedDonations || 0,
      totalDonatedUsd: donationAggregate.totalDonatedUsd || 0,
      totalDonatedKhr: donationAggregate.totalDonatedKhr || 0,
      donationSuccessRate,
    },
    charts: {
      labels: dateWindow.map((item) => item.label),
      downloads: dateWindow.map((item) => downloadMap.get(item.key) || 0),
      failures: dateWindow.map((item) => failureMap.get(item.key) || 0),
      signups: dateWindow.map((item) => signupMap.get(item.key) || 0),
      donationsCreated: dateWindow.map((item) => donationCreatedMap.get(item.key) || 0),
      donationsPaid: dateWindow.map((item) => donationPaidMap.get(item.key) || 0),
    },
    breakdowns: {
      platforms: mapCountRows(
        platformRows,
        getSupportedPlatformList().map((platform) => platform.key),
        (key) => getPlatformLabel(key)
      ),
      mediaTypes: mapCountRows(mediaRows, ["video", "audio"], (key) =>
        key === "audio" ? "Audio / MP3" : "Video"
      ),
      languages: mapCountRows(languageRows, Object.keys(LANGUAGE_LABELS), (key) =>
        LANGUAGE_LABELS[key] || key
      ),
      donationStatuses: mapCountRows(
        donationStatusRows,
        ["pending", "success", "failed", "expired", "unsupported", "auth_error"],
        (key) => ({
          pending: "Pending",
          success: "Success",
          failed: "Failed",
          expired: "Expired",
          unsupported: "Unsupported",
          auth_error: "Auth error",
        }[key] || key)
      ),
      donationCurrencies: mapCountRows(
        donationCurrencyRows,
        ["usd", "khr"],
        (key) => key.toUpperCase()
      ),
    },
    activeUsers,
    users: users.map((user) => serializeUser(user, donationUserMap.get(user.telegramId) || {})),
    topUsers: topUsers.map((user) => serializeUser(user, donationUserMap.get(user.telegramId) || {})),
    recentDownloads: recentDownloads.map(serializeDownload),
    donations: donations.map(serializeDonation),
    recentDonations: donations.slice(0, 12).map(serializeDonation),
    generatedAt: new Date().toISOString(),
  };
}

async function emitDashboardUpdate(emitter) {
  const payload = await getDashboardData();

  if (emitter && typeof emitter.emit === "function") {
    emitter.emit("update_stats", payload);
  }

  return payload;
}

module.exports = {
  buildFallbackDashboard,
  state,
  recordUserActivity,
  getDashboardData,
  emitDashboardUpdate,
};
