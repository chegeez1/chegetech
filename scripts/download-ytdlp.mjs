#!/usr/bin/env node
/**
 * download-ytdlp.mjs
 * Downloads the yt-dlp binary during build so it is available at runtime.
 * Uses the GitHub releases CDN (not the API) to avoid rate-limit errors.
 */
import { createWriteStream, existsSync, mkdirSync, chmodSync } from "fs";
import { get } from "https";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Where download-routes.ts looks first
const BIN_DIR  = join(ROOT, "node_modules", "youtube-dl-exec", "bin");
const BIN_PATH = join(BIN_DIR, "yt-dlp");

// Direct CDN URL — no GitHub API call, no rate limits
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const request = (u) =>
      get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} downloading yt-dlp`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", reject);
      }).on("error", reject);
    request(url);
  });
}

async function main() {
  if (existsSync(BIN_PATH)) {
    console.log("yt-dlp already present, skipping download.");
    return;
  }
  console.log("Downloading yt-dlp binary...");
  mkdirSync(BIN_DIR, { recursive: true });
  try {
    await download(YTDLP_URL, BIN_PATH);
    chmodSync(BIN_PATH, 0o755);
    console.log("yt-dlp downloaded and ready at", BIN_PATH);
  } catch (err) {
    console.error("Failed to download yt-dlp:", err.message);
    console.warn("Downloader feature will not work without yt-dlp.");
    // Do NOT exit(1) — let the rest of the build continue
  }
}

main();
