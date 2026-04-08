const { getMediaRuntimeStatus } = require("../services/runtime-tools");

async function main() {
  const status = await getMediaRuntimeStatus();
  const rows = [
    {
      tool: "yt-dlp",
      ok: status.ytDlp.ok,
      binary: status.ytDlp.binary || "missing",
      version: status.ytDlp.version || "n/a",
    },
    {
      tool: "ffmpeg",
      ok: status.ffmpeg.ok,
      binary: status.ffmpeg.binary || "missing",
      version: status.ffmpeg.version || "n/a",
    },
  ];

  console.log("Media runtime status");
  console.log("====================");

  for (const row of rows) {
    console.log(`${row.tool}: ${row.ok ? "ready" : "missing"}`);
    console.log(`  binary : ${row.binary}`);
    console.log(`  version: ${row.version}`);
  }

  if (!status.ytDlp.ok || !status.ffmpeg.ok) {
    console.log("");
    console.log("Setup help");
    console.log("----------");
    console.log(`Windows: npm run setup:media:windows`);
    console.log(`Linux  : npm run setup:media:linux`);
    console.log(`Env vars: YTDLP_BIN and FFMPEG_BIN`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
