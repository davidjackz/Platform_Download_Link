process.env.UV_THREADPOOL_SIZE = 128;

require("dotenv").config();

const compression = require("compression");
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const path = require("path");
const { Server } = require("socket.io");

const { setupBot } = require("./bot");
const { buildFallbackDashboard, emitDashboardUpdate, getDashboardData } = require("./dashboard-data");
const User = require("./models/User");
const { logMediaRuntimeStatus } = require("./services/runtime-tools");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const TOKEN = process.env.TELEGRAM_TOKEN;
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

mongoose
  .connect(process.env.MONGO_URI, { maxPoolSize: 100 })
  .then(() => console.log("DB connected"))
  .catch((error) => console.error("DB connection error", error));

logMediaRuntimeStatus(console).catch((error) => {
  console.error("Media runtime check failed", error.message || error);
});

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/dashboard.css", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.css"));
});

app.get("/dashboard.js", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.js"));
});

const bot = setupBot(TOKEN, DOMAIN, null, io);

io.on("connection", (socket) => {
  emitDashboardUpdate(socket).catch((error) => {
    console.error("Initial dashboard sync failed:", error.message);
  });
});

setInterval(() => {
  emitDashboardUpdate(io).catch((error) => {
    console.error("Scheduled dashboard sync failed:", error.message);
  });
}, 60000);

app.get("/", async (req, res) => {
  try {
    const dashboardData = await getDashboardData();

    res.render("dashboard", {
      dashboardData,
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("Dashboard render failed", error);

    res.render("dashboard", {
      dashboardData: buildFallbackDashboard(),
      uptime: process.uptime(),
    });
  }
});

async function setUserBlockStatus(req, res, isBlocked) {
  const telegramId = Number(req.params.telegramId);

  if (!Number.isFinite(telegramId)) {
    res.status(400).json({ ok: false, message: "Invalid Telegram ID." });
    return;
  }

  const user = await User.findOneAndUpdate(
    { telegramId },
    {
      $set: {
        isBlocked,
        blockedAt: isBlocked ? new Date() : null,
      },
    },
    { new: true }
  ).lean();

  if (!user) {
    res.status(404).json({ ok: false, message: "User not found." });
    return;
  }

  await emitDashboardUpdate(io, { forceFresh: true });
  res.json({ ok: true, telegramId, isBlocked });
}

app.post("/api/users/:telegramId/block", async (req, res) => {
  try {
    await setUserBlockStatus(req, res, true);
  } catch (error) {
    console.error("Block action failed", error);
    res.status(500).json({ ok: false, message: "Unable to block user." });
  }
});

app.post("/api/users/:telegramId/unblock", async (req, res) => {
  try {
    await setUserBlockStatus(req, res, false);
  } catch (error) {
    console.error("Unblock action failed", error);
    res.status(500).json({ ok: false, message: "Unable to unblock user." });
  }
});

app.post("/bot:token", (req, res) => {
  if (req.params.token !== TOKEN) {
    res.sendStatus(403);
    return;
  }

  bot.processUpdate(req.body);
  res.sendStatus(200);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection", reason);
});

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  if (typeof bot.registerWebhook === "function") {
    try {
      await bot.registerWebhook();
      console.log("Webhook registration completed.");
    } catch (error) {
      console.error("Failed to register webhook:", error.message || error);
    }
  }
});
