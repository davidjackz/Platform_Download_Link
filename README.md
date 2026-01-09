# 🚀 Node.js TikTok Downloader Bot & Dashboard

A high-performance **Telegram Bot** that downloads TikTok videos **without watermarks**.  
It features a **real-time web dashboard**, handles **large files via streaming**, and includes a **Cyberpunk-style UI**.

![Project Status](https://img.shields.io/badge/Status-Active-success)
![Node](https://img.shields.io/badge/Node.js-v18%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Features

- **🎥 No Watermark** – Downloads high-quality TikTok videos
- **⚡ Real-Time Dashboard** – Live stats using Socket.io
- **🚀 Smart Large File Handling**
  - Files **< 50MB** → Sent directly to Telegram
  - Files **> 50MB** → Generates a streaming download link
- **⏳ Progress Animation** – Simulated progress (1% → 100%) in Telegram
- **🧹 Auto-Cleanup** – Temporary links deleted after 5 minutes
- **📱 Responsive UI** – Works on mobile, tablet, and desktop

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Bot API:** node-telegram-bot-api
- **Real-time:** Socket.io
- **Frontend:** EJS, TailwindCSS (CDN)
- **HTTP Client:** Axios (HTTPS optimized)

---

## 📂 Project Structure

```text
├── bot.js            # Telegram Bot logic
├── downloader.js     # TikTok extractor & size checker
├── server.js         # Express server & Socket.io
├── views/
│   └── dashboard.ejs # Real-time dashboard
├── public/           # Static assets (optional)
├── .env              # Environment variables
├── package.json
└── package-lock.json
