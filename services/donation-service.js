const DonationEvent = require("../models/DonationEvent");

function getIdentity(user = {}) {
  const telegramId = Number(user.id ?? user.telegramId);

  return {
    telegramId,
    firstName: user.first_name || user.firstName || null,
    username: user.username || null,
  };
}

async function createDonationEvent(user = {}, payload = {}) {
  const identity = getIdentity(user);

  if (!Number.isFinite(identity.telegramId)) {
    return null;
  }

  return DonationEvent.create({
    telegramId: identity.telegramId,
    firstName: identity.firstName,
    username: identity.username,
    preferredLanguage: payload.language || null,
    merchantName: payload.merchantName || null,
    amount: Number(payload.amount) || 0,
    currencyCode: payload.currencyCode || "usd",
    billNumber: payload.billNumber || null,
    md5: payload.md5 || null,
    paywayLink: payload.paywayLink || null,
    status: payload.status || "pending",
    expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    paidAt: payload.paidAt ? new Date(payload.paidAt) : null,
    lastCheckedAt: payload.lastCheckedAt ? new Date(payload.lastCheckedAt) : null,
    transactionHash: payload.transactionHash || null,
    errorMessage: payload.errorMessage || null,
  });
}

async function updateDonationEvent(md5, updates = {}) {
  if (!md5) {
    return null;
  }

  const nextSet = {};
  const allowedFields = [
    "status",
    "paidAt",
    "lastCheckedAt",
    "transactionHash",
    "errorMessage",
  ];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      nextSet[field] = updates[field];
    }
  }

  if (!Object.keys(nextSet).length) {
    return DonationEvent.findOne({ md5 }).lean();
  }

  return DonationEvent.findOneAndUpdate(
    { md5 },
    { $set: nextSet },
    { new: true }
  ).lean();
}

module.exports = {
  createDonationEvent,
  updateDonationEvent,
};
