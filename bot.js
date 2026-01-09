// bot.js
const TelegramBot = require("node-telegram-bot-api");
const { getTikTokData } = require("./downloader");

// Global State
const state = {
  stats: { downloads: 0, total_users: 0, bytes_processed: 0 },
  userList: [],
};

// 🛡️ HELPER: Fixes names/titles that break Telegram
const escapeMarkdown = (text) => {
  if (!text) return "";
  return text.replace(/[_*[\]()~>#+=|{}.!-]/g, "\\$&");
};

// ⏱️ HELPER: Sleep function for animation
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const firstName = escapeMarkdown(msg.from.first_name || "Friend");

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
      const welcomeMsg = `
👋 **Hi, ${firstName}!** I am your **TikTok Downloader Bot**. 
I remove watermarks and let you download videos in HD.

✨ **Features:**
• 🚫 No Watermark
• ⚡ Super Fast
• 📂 Handles Large Files (>50MB)

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
