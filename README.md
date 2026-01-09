Here is a professional, clean, and comprehensive README.md file for your project. You can copy-paste this directly into a file named README.md in your project folder before uploading to GitHub.

Markdown

# 🚀 Node.js TikTok Downloader Bot & Dashboard

A high-performance Telegram Bot that downloads TikTok videos without watermarks. It features a real-time web dashboard, handles large files via streaming, and includes a "Cyberpunk" style UI.

![Project Status](https://img.shields.io/badge/Status-Active-success)
![Node](https://img.shields.io/badge/Node.js-v18%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

* **🎥 No Watermark:** Downloads high-quality video streams directly from TikTok.
* **⚡ Real-Time Dashboard:** View live stats (downloads, active users) updated instantly via WebSockets (`Socket.io`).
* **🚀 Smart Large File Handling:**
    * Files **< 50MB**: Sent directly to Telegram.
    * Files **> 50MB**: Generates a high-speed streaming link (bypassing Telegram limits).
* **⏳ Progress Animation:** Simulates a download progress bar in the Telegram chat (1% → 100%).
* **🧹 Auto-Cleanup:** Temporary streaming links are automatically deleted after 5 minutes to save server memory.
* **📱 Responsive UI:** Dashboard looks great on Mobile, Tablet, and Desktop.

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Bot API:** `node-telegram-bot-api`
* **Real-time:** Socket.io
* **Frontend:** EJS, TailwindCSS (CDN)
* **HTTP Client:** Axios (with HTTPS Agent optimization)

---

## 📂 Project Structure

```text
├── bot.js            # Telegram Bot logic (Animations, Commands, Handling)
├── downloader.js     # TikTok API extractor & Size checker
├── server.js         # Express Server, Socket.io, & Stream Routing
├── views/
│   └── dashboard.ejs # The Real-time Web Dashboard
├── public/           # Static assets (optional)
├── .env              # Environment variables
└── package.json      # Dependencies
🚀 Installation & Local Setup
1. Clone the Repository
Bash

git clone [https://github.com/YOUR_USERNAME/tiktok-bot-node.git](https://github.com/YOUR_USERNAME/tiktok-bot-node.git)
cd tiktok-bot-node
2. Install Dependencies
Bash

npm install
3. Configure Environment
Create a .env file in the root directory:

Ini, TOML

TELEGRAM_TOKEN=your_telegram_bot_token_here
RENDER_EXTERNAL_URL=http://localhost:3000
PORT=3000
Note: Get your token from @BotFather on Telegram.

4. Run the Bot
Bash

npm start
The console will show ⚠️ Local Mode: POLLING.

Open http://localhost:3000 to see the dashboard.

Send a TikTok link to your bot to test!

🌍 Deployment (Render.com)
This project is optimized for Render Web Services.

Push your code to GitHub.

Go to Render Dashboard.

Click New + -> Web Service.

Connect your repository.

Settings:

Runtime: Node

Build Command: npm install

Start Command: node server.js

Environment Variables:

TELEGRAM_TOKEN: Your Bot Token.

RENDER_EXTERNAL_URL: The URL Render assigns you (e.g., https://your-app.onrender.com).

Deploy! The bot will automatically switch to WEBHOOK mode.
