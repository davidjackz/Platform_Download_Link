const mongoose = require("mongoose");

const donationEventSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, index: true },
  firstName: { type: String, default: null },
  username: { type: String, default: null },
  preferredLanguage: { type: String, enum: ["en", "km", null], default: null },
  merchantName: { type: String, default: null },
  amount: { type: Number, required: true },
  currencyCode: { type: String, enum: ["usd", "khr"], required: true, index: true },
  billNumber: { type: String, default: null, index: true },
  md5: { type: String, default: null, unique: true, sparse: true, index: true },
  paywayLink: { type: String, default: null },
  status: {
    type: String,
    enum: ["pending", "success", "failed", "expired", "unsupported", "auth_error"],
    default: "pending",
    index: true,
  },
  expiresAt: { type: Date, default: null, index: true },
  paidAt: { type: Date, default: null, index: true },
  lastCheckedAt: { type: Date, default: null },
  transactionHash: { type: String, default: null },
  errorMessage: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model("DonationEvent", donationEventSchema);
