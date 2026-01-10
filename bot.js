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

  // 1. Initialize Bot (Local vs Cloud)
  if (domain.includes("localhost") || domain.startsWith("http:")) {
    console.log("⚠️  Local Mode: POLLING");
    bot = new TelegramBot(token, { polling: true });
    bot.deleteWebHook().catch(() => {});
  } else {
    console.log("🌍 Cloud Mode: WEBHOOK");
    bot = new TelegramBot(token);
    bot.setWebHook(`${domain}/bot${token}`);
  }

  // 2. Set the Blue "Menu" Button in Telegram
  bot.setMyCommands([
    { command: "start", description: "Restart & Main Menu" },
    { command: "contact", description: "Contact the Developer" },
    { command: "source", description: "Get Source Code" },
    { command: "donate", description: "Buy me a Coffee" },
  ]);

  // 3. Main Message Handler
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const firstName = escapeMarkdown(msg.from.first_name || "Friend");

    if (!text) return;

    // --- USER TRACKING (Dashboard Logic) ---
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

    // ==============================================
    //               🤖 COMMANDS
    // ==============================================

    // Command: /start
    if (text === "/start") {
      const welcomeMsg = `
👋 **Hi, ${firstName}!** I am your **TikTok Downloader Bot**. 
I remove watermarks and let you download videos in HD.

✨ **Features:**
• 🚫 No Watermark
• ⚡ Super Fast
• 📂 Handles Large Files (>50MB)

👇 **Use the buttons below or paste a link:**
            `;
      try {
        await bot.sendMessage(chatId, welcomeMsg, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "👨‍💻 Source Code", url: "https://github.com/lorndavid/botdownloadtiktok" },
                { text: "💬 Contact Me", url: "https://t.me/Tutuvid" },
              ],
              [{ text: "☕ Buy Me A Coffee", url: "https://link.payway.com.kh/ABAPAYFB405176Y" }],
            ],
          },
        });
      } catch (e) {
        bot.sendMessage(chatId, welcomeMsg.replace(/\*/g, ""));
      }
      return;
    }

    // Command: /contact
    if (text === "/contact") {
      await bot.sendMessage(chatId, "💬 **Contact The Owner:**\n\n👤 @Tutuvid\n🔗 https://t.me/Tutuvid", { parse_mode: 'Markdown' });
      return;
    }

    // Command: /source
    if (text === "/source" || text === "/github") {
      await bot.sendMessage(chatId, "👨‍💻 **Open Source:**\n\nStar the repo here:\nhttps://github.com/lorndavid/botdownloadtiktok");
      return;
    }

    //Command: Buy Me A Coffee
    if (text === "/donate"){
      await bot.sendMessage(chatId, "Help me but a coffee to do more open source code !!\n\n click now: https://link.payway.com.kh/ABAPAYFB405176Y ");
      return;
    }

    // ==============================================
    //            🎥 VIDEO PROCESSING
    // ==============================================
    if (text.includes("tiktok.com")) {
      const sentMsg = await bot.sendMessage(
        chatId,
        "🔍 **Analyzing Link...**",
        { parse_mode: "Markdown" }
      );
      const msgId = sentMsg.message_id;

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
          // 1. DOWNLOAD ANIMATION LOOP
          const steps = [
            "⏳ **Downloading: [░░░░░░░░░░] 1%**",
            "⏳ **Downloading: [███░░░░░░░] 25%**",
            "⏳ **Downloading: [█████░░░░░] 50%**",
            "⏳ **Downloading: [███████░░░] 75%**",
            "⏳ **Downloading: [█████████░] 95%**",
            "☁️ **Processing Complete...**",
          ];

          for (const step of steps) {
            try {
              await bot.editMessageText(step, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: "Markdown",
              });
              await sleep(400); // Faster updates
            } catch (err) { }
          }

          // 2. HEADER ANIMATION (The "Sending video..." status at top of chat)
          await bot.editMessageText("☁️ **Uploading to Telegram...**", {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: "Markdown",
          });
          
          // 🚀 This command makes the top bar say "sending video..."
          bot.sendChatAction(chatId, 'upload_video'); 

          // 3. SEND THE FILE
          try {
            await bot.sendVideo(chatId, data.videoUrl, {
              caption: `🎬 *${cleanAuthor}*\n${cleanTitle}\n\n✨ *Downloaded by @nodevid_bot*`,
              parse_mode: "Markdown",
            });
            bot.deleteMessage(chatId, msgId); // Clean up status message
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