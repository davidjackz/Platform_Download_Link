const mongoose = require("mongoose");

const platformStatsSchema = new mongoose.Schema(
  {
    tiktok: { type: Number, default: 0 },
    facebook: { type: Number, default: 0 },
    instagram: { type: Number, default: 0 },
    youtube: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  firstName: { type: String, default: null },
  username: { type: String, default: null },
  preferredLanguage: { type: String, enum: ["en", "km"], default: "en" },
  joinedAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  downloads: { type: Number, default: 0 },
  videoDownloads: { type: Number, default: 0 },
  audioDownloads: { type: Number, default: 0 },
  linkRequests: { type: Number, default: 0 },
  failedDownloads: { type: Number, default: 0 },
  lastLink: { type: String, default: null },
  lastPlatform: { type: String, default: null },
  lastMediaType: { type: String, enum: ["video", "audio", null], default: null },
  lastDownloadAt: { type: Date, default: null },
  isBlocked: { type: Boolean, default: false },
  blockedAt: { type: Date, default: null },
  platformStats: { type: platformStatsSchema, default: () => ({}) },
});

userSchema.index({ username: 1 }, { sparse: true });
userSchema.index({ isBlocked: 1, lastActive: -1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ downloads: -1, lastActive: -1 });
userSchema.index({ joinedAt: -1 });

module.exports = mongoose.model("User", userSchema);
