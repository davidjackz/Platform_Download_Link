const TelegramBot = require("node-telegram-bot-api");
const { BakongKHQR, khqrData } = require("bakong-khqr");
const QRCode = require("qrcode");
const { createCanvas, loadImage } = require("canvas");
const { getTikTokData } = require("./downloader");
const User = require("./models/User");
require("dotenv").config();

// CONFIG
const BAKONG_ACCOUNT = process.env.BAKONG_ACCOUNT_ID;
const MERCHANT_NAME = process.env.MERCHANT_NAME || "Lorn David";
const PAYWAY_LINK = "https://link.payway.com.kh/ABAPAYFB405176Y";

// Global State
const state = { stats: { downloads: 0, total_users: 0 }, userList: [] };

// Helper: Escape Markdown
const escapeMarkdown = (text) =>
  text ? text.replace(/[_*[\]()~>#+=|{}.!-]/g, "\\$&") : "";

// --- 🎨 KHQR CARD GENERATOR ---
async function generateKHQRCard(qrText, name, currencyType) {
  const width = 600,
    height = 900;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Red Header
  ctx.fillStyle = "#EE282D";
  ctx.fillRect(0, 0, width, 160);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 80px Arial";
  ctx.textAlign = "center";
  ctx.fillText("KHQR", width / 2, 110);

  // QR
  const qrBuffer = await QRCode.toBuffer(qrText, { width: 450, margin: 1 });
  const qrImage = await loadImage(qrBuffer);
  ctx.drawImage(qrImage, (width - 450) / 2, 220, 450, 450);

  // Text
  ctx.fillStyle = "#000000";
  ctx.font = "bold 35px Arial";
  ctx.fillText(name, width / 2, 730);
  ctx.fillStyle = "#555555";
  ctx.font = "30px Arial";
  ctx.fillText(
    currencyType === khqrData.currency.usd ? "USD ($)" : "KHR (៛)",
    width / 2,
    780
  );

  // Footer
  ctx.fillStyle = "#EE282D";
  ctx.font = "bold 25px Arial";
  ctx.fillText("Powered by Bakong", width / 2, 850);

  return canvas.toBuffer();
}

const setupBot = (token, domain, createTempLink, io) => {
  let bot;

  if (domain.includes("localhost") || domain.startsWith("http:")) {
    console.log("⚠️  Local Mode: POLLING");
    bot = new TelegramBot(token, { polling: true });
    bot.deleteWebHook().catch(() => {});
  } else {
    console.log("🌍 Cloud Mode: WEBHOOK");
    bot = new TelegramBot(token);
    bot.setWebHook(`${domain}/bot${token}`);
  }

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;

    // --- 1. USER TRACKING ---
    const existingUser = state.userList.find((u) => u.id === chatId);
    if (!existingUser) {
      state.userList.push({
        id: chatId,
        name: msg.from.first_name || "User",
        last_seen: new Date(),
      });
      state.stats.total_users++;
    } else {
      existingUser.last_seen = new Date();
      state.userList = state.userList.filter((u) => u.id !== chatId);
      state.userList.unshift(existingUser);
    }
    if (state.userList.length > 50) state.userList.pop();
    if (io) io.emit("update_stats", state);

    // --- 2. COMMANDS ---
    if (text === "/start") {
      const name = escapeMarkdown(msg.from.first_name);
      const welcome = `
👋 **Hello ${name}!**

I am **Nexus**, your professional TikTok Downloader.

✨ **Features:**
• 🚫 No Watermark
• ⚡ Ultra-Fast Speed
• ♾️ Unlimited Downloads
• 📱 HD Quality

👇 **Just paste a TikTok link to begin!**
            `;
      try {
        await bot.sendMessage(chatId, welcomeMsg, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "📊 Live Dashboard", url: domain }]],
          },
        });
      } catch (e) {
        bot.sendMessage(chatId, welcomeMsg.replace(/\*/g, ""));
      }
      return;
    }

    // --- 3. VIDEO PROCESSING ---
    if (text.includes("tiktok.com")) {
      const sentMsg = await bot.sendMessage(
        chatId,
        "🔍 **Analyzing Link...**",
        { parse_mode: "Markdown" }
      );
      const msgId = sentMsg.message_id; // Save ID to edit it later

      const data = await getTikTokData(text);

      if (data.status === "success") {
        state.stats.downloads++;
        if (io) io.emit("update_stats", state);

        const cleanAuthor = escapeMarkdown(data.author);
        const cleanTitle = escapeMarkdown(data.title);

        // CASE A: LARGE FILE (>50MB)
        if (data.sizeMB > 50) {
          const link = createTempLink(data.videoUrl);
          await bot.editMessageText(
            `📦 **Large Video Detected (${data.sizeMB} MB)**\n\n` +
              `To keep Telegram fast, I generated a high-speed link for you.\n` +
              `⏳ *Link expires in 5 minutes.*\n\n` +
              `👇 **Tap to Download:**`,
            {
              chat_id: chatId,
              message_id: msgId,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [[{ text: "🚀 Download Video", url: link }]],
              },
            }
          );
        }
        // CASE B: NORMAL FILE (WITH ANIMATION)
        else {
          // 🎬 START ANIMATION LOOP
          const steps = [
            "⏳ **Downloading: [░░░░░░░░░░] 1%**",
            "⏳ **Downloading: [███░░░░░░░] 25%**",
            "⏳ **Downloading: [█████░░░░░] 50%**",
            "⏳ **Downloading: [███████░░░] 75%**",
            "⏳ **Downloading: [█████████░] 95%**",
            "✅ **Complete! Uploading...**",
          ];

          for (const step of steps) {
            try {
              // Edit the message to show new progress
              await bot.editMessageText(step, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: "Markdown",
              });
              // Wait 500ms between updates (prevents "Too Many Requests" error)
              await sleep(500);
            } catch (err) {
              // If user deletes chat during animation, ignore error
            }
          }

          // 🚀 SEND THE FILE
          try {
            await bot.sendVideo(chatId, data.videoUrl, {
              caption: `🎬 *${cleanAuthor}*\n${cleanTitle}\n\n✨ *Downloaded by @nodevid_bot*`,
              parse_mode: "Markdown",
            });
            bot.deleteMessage(chatId, msgId); // Delete the "Loading..." message
          } catch (e) {
            console.error("Upload Error:", e.message);
            // Fallback
            await bot.sendVideo(chatId, data.videoUrl, {
              caption: `🎬 ${data.author}\n${data.title}\n\n✨ Downloaded by @nodevid_bot`,
            });
            bot.deleteMessage(chatId, msgId);
          }
        }
      } else {
        bot.editMessageText(
          "❌ **Oops!** Could not find that video. Is it private?",
          { chat_id: chatId, message_id: msgId, parse_mode: "Markdown" }
        );
      }
    }
  });

  return bot;
};

module.exports = { setupBot, state };