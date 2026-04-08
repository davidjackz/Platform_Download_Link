const mongoose = require("mongoose");

const mediaCacheSchema = new mongoose.Schema({
  normalizedUrl: { type: String, required: true },
  platform: { type: String, required: true, index: true },
  mediaType: { type: String, enum: ["video", "audio"], required: true, index: true },
  telegramFileId: { type: String, required: true },
  telegramFileUniqueId: { type: String, default: null },
  title: { type: String, default: null },
  uploader: { type: String, default: null },
  fileName: { type: String, default: null },
  fileSizeBytes: { type: Number, default: null },
  hits: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now, index: true },
});

mediaCacheSchema.index(
  { normalizedUrl: 1, platform: 1, mediaType: 1 },
  { unique: true, name: "media_cache_lookup" }
);

module.exports = mongoose.model("MediaCache", mediaCacheSchema);
