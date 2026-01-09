// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { setupBot, state } = require("./bot");
const { client } = require("./downloader");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(bodyParser.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public"))); // For static assets if needed

const TOKEN = process.env.TELEGRAM_TOKEN;
const DOMAIN = process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
const PORT = process.env.PORT || 3000;

// --- MEMORY MANAGEMENT ---
// Stores temporary links: { id: "url" }
const tempDownloads = new Map();

const createTempLink = (videoUrl) => {
  const id = uuidv4();
  tempDownloads.set(id, videoUrl);

  // 🗑️ AUTO DELETE: Expire link after 5 minutes
  setTimeout(() => {
    if (tempDownloads.has(id)) {
      tempDownloads.delete(id);
      console.log(`[System] Link Expired/Deleted: ${id}`);
    }
  }, 5 * 60 * 1000);

  return `${DOMAIN}/stream/${id}`;
};

// Initialize Bot
const bot = setupBot(TOKEN, DOMAIN, createTempLink, io);

// --- ROUTES ---

// 1. Dashboard (Responsive UI)
app.get("/", (req, res) => {
  res.render("dashboard", {
    stats: state.stats,
    users: state.userList,
    uptime: process.uptime(),
  });
});

// 2. Telegram Webhook
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// 3. Smart Streamer (Handles >50MB Files)
app.get("/stream/:id", async (req, res) => {
  const id = req.params.id;
  const videoUrl = tempDownloads.get(id);

  if (!videoUrl) {
    // Pretty Error Page
    return res.status(404).send(`
            <body style="background:#111; color:#fff; font-family:sans-serif; text-align:center; padding:50px;">
                <h1>❌ Link Expired</h1>
                <p>For privacy and server health, download links are auto-deleted after 5 minutes.</p>
                <p>Please request the video again in the bot.</p>
            </body>
        `);
  }

  try {
    const response = await client({
      method: "GET",
      url: videoUrl,
      responseType: "stream",
    });

    // Force browser to download instead of play
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tiktok_video_${id.split("-")[0]}.mp4"`
    );
    res.setHeader("Content-Type", "video/mp4");
    response.data.pipe(res);
  } catch (error) {
    res.status(500).send("Source Error: Could not stream video.");
  }
});

server.listen(PORT, () => {
  console.log(`🚀 System Online: ${DOMAIN}`);
});
