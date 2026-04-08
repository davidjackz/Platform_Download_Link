const mongoose = require("mongoose");

const downloadEventSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, index: true },
  firstName: { type: String, default: null },
  username: { type: String, default: null },
  sourceUrl: { type: String, required: true },
  platform: { type: String, default: null, index: true },
  mediaType: { type: String, enum: ["video", "audio", null], default: null },
  language: { type: String, enum: ["en", "km", null], default: null },
  title: { type: String, default: null },
  fileName: { type: String, default: null },
  fileSizeBytes: { type: Number, default: null },
  sizeMB: { type: Number, default: null },
  status: { type: String, enum: ["success", "failed"], default: "success", index: true },
  errorMessage: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});

downloadEventSchema.index({ telegramId: 1, createdAt: -1 });
downloadEventSchema.index({ platform: 1, status: 1, createdAt: -1 });
downloadEventSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("DownloadEvent", downloadEventSchema);
