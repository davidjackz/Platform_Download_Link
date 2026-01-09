// downloader.js
const axios = require("axios");
const https = require("https");

// 🚀 PERFORMANCE: Keep connections alive
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
});

const client = axios.create({ httpsAgent });

async function getTikTokData(url) {
  try {
    // Using public API for demo
    const apiUrl = `https://tikwm.com/api/?url=${url}&hd=1`;
    const response = await client.get(apiUrl);

    if (response.data.code === 0) {
      const videoUrl = response.data.data.play;

      // Fast HEAD request to check size
      const head = await client.head(videoUrl);
      const sizeBytes = head.headers["content-length"];
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

      return {
        status: "success",
        videoUrl: videoUrl,
        cover: response.data.data.cover,
        author: response.data.data.author.nickname,
        title: response.data.data.title,
        sizeMB: parseFloat(sizeMB),
      };
    } else {
      return { status: "error", message: "Video not found or private." };
    }
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

module.exports = { getTikTokData, client };
