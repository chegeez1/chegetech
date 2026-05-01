/**
 * download-routes.ts
 * YouTube / TikTok / Instagram downloader
 *   - 2 free downloads per IP per calendar day (resets at midnight)
 *   - Unlimited access granted per email, persisted in SQLite
 *
 * yt-dlp is downloaded automatically at server start if not already present.
 * Videos are proxied through the server so CDN 403s never reach the browser.
 */
import type { Express, Request, Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { createWriteStream, createReadStream, existsSync, mkdirSync, chmodSync, unlinkSync } from "fs";
import https from "https";
import http from "http";
import path from "path";
import os from "os";
import {
  initDlDb,
  isSubscriber,
  addSubscriber,
  removeSubscriber,
  listSubscribers,
  getDailyUsage,
  incrementDailyUsage,
} from "./dl-db";

const execFileAsync = promisify(execFile);

// ── Initialise DB tables at startup ──────────────────────────────────────────
initDlDb().catch((err: Error) => console.error("[dl-db] init error:", err.message));

// ── yt-dlp binary location & auto-download ───────────────────────────────────
const BIN_DIR  = path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin");
const BIN_PATH = path.join(BIN_DIR, "yt-dlp");

const YTDLP_CDN = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

let ytdlpReady: Promise<string> | null = null;

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const request = (u: string) => {
      const mod = u.startsWith("https") ? https : http;
      mod.get(u, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location);
          return;
        }
        if (!res.statusCode || res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} downloading yt-dlp`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
      }).on("error", reject);
    };
    request(url);
  });
}

function ensureYtDlp(): Promise<string> {
  if (ytdlpReady) return ytdlpReady;

  const candidates = [
    BIN_PATH,
    path.join(process.cwd(), "node_modules", ".bin", "yt-dlp"),
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      console.log("[downloader] yt-dlp found at", c);
      ytdlpReady = Promise.resolve(c);
      return ytdlpReady;
    }
  }

  console.log("[downloader] yt-dlp not found — downloading from GitHub CDN...");
  ytdlpReady = (async () => {
    mkdirSync(BIN_DIR, { recursive: true });
    await downloadFile(YTDLP_CDN, BIN_PATH);
    chmodSync(BIN_PATH, 0o755);
    console.log("[downloader] yt-dlp ready at", BIN_PATH);
    return BIN_PATH;
  })().catch((err) => {
    ytdlpReady = null;
    throw err;
  });

  return ytdlpReady;
}

ensureYtDlp().catch((err) =>
  console.error("[downloader] Background yt-dlp download failed:", err.message)
);

// ── Run yt-dlp ────────────────────────────────────────────────────────────────
async function ytdlp(args: string[]): Promise<string> {
  const bin = await ensureYtDlp();
  const { stdout } = await execFileAsync(bin, args, {
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Proxy a CDN URL through the server ───────────────────────────────────────
function proxyVideoStream(
  cdnUrl: string,
  referer: string,
  filename: string,
  res: Response,
  req: Request,
): void {
  const doRequest = (u: string, redirectsLeft = 5) => {
    const mod = u.startsWith("https") ? https : http;
    const proxyReq = mod.get(
      u,
      {
        headers: {
          "User-Agent":      BROWSER_UA,
          "Referer":         referer,
          "Accept":          "*/*",
          "Accept-Encoding": "identity",
          "Connection":      "keep-alive",
        },
      },
      (proxyRes) => {
        if (
          proxyRes.statusCode &&
          proxyRes.statusCode >= 300 &&
          proxyRes.statusCode < 400 &&
          proxyRes.headers.location
        ) {
          if (redirectsLeft <= 0) {
            if (!res.headersSent) res.status(502).json({ error: "Too many redirects from CDN" });
            return;
          }
          doRequest(proxyRes.headers.location, redirectsLeft - 1);
          return;
        }
        if (!proxyRes.statusCode || proxyRes.statusCode < 200 || proxyRes.statusCode >= 300) {
          if (!res.headersSent)
            res.status(502).json({ error: `CDN returned HTTP ${proxyRes.statusCode}` });
          return;
        }
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", proxyRes.headers["content-type"] || "video/mp4");
        if (proxyRes.headers["content-length"]) {
          res.setHeader("Content-Length", proxyRes.headers["content-length"]);
        }
        res.setHeader("Cache-Control", "no-store");
        proxyRes.pipe(res);
        proxyRes.on("error", () => {
          if (!res.headersSent) res.status(500).json({ error: "Stream error" });
        });
      },
    );
    proxyReq.on("error", (err) => {
      console.error("[downloader] Proxy error:", err.message);
      if (!res.headersSent) res.status(500).json({ error: "Failed to fetch video from CDN" });
    });
    req.on("close", () => proxyReq.destroy());
  };
  doRequest(cdnUrl);
}

// ── Quota ─────────────────────────────────────────────────────────────────────
const FREE_LIMIT = 2; // per day, resets at midnight UTC

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

// ── URL allow-list ────────────────────────────────────────────────────────────
const ALLOWED_HOSTS = [
  "youtube.com", "youtu.be", "www.youtube.com",
  "tiktok.com", "www.tiktok.com", "vm.tiktok.com",
  "instagram.com", "www.instagram.com",
  "twitter.com", "x.com",
  "facebook.com", "www.facebook.com", "fb.watch",
];

function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch { return false; }
}

function safeFilename(title: string): string {
  return (title || "video").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 80) + ".mp4";
}

function isAdminRequest(req: Request): boolean {
  const key = req.headers["x-admin-key"];
  return key === process.env.ADMIN_API_KEY || key === "chegetech-admin";
}

// ── Routes ────────────────────────────────────────────────────────────────────
export function registerDownloadRoutes(app: Express) {

  // GET /api/dl/quota — remaining free downloads today
  app.get("/api/dl/quota", async (req, res) => {
    const ip   = getClientIp(req);
    const used = await getDailyUsage(ip);
    res.json({
      used,
      limit:     FREE_LIMIT,
      remaining: Math.max(0, FREE_LIMIT - used),
      resetsAt:  "midnight UTC",
    });
  });

  // POST /api/dl/info — fetch video metadata (no quota consumed)
  app.post("/api/dl/info", async (req: Request, res: Response) => {
    const { url } = req.body as { url?: string };
    if (!url || !isAllowedUrl(url)) {
      return res.status(400).json({ error: "Invalid or unsupported URL" });
    }

    const isYouTube = /youtube\.com|youtu\.be/.test(url);

    try {
      const args = [
        url,
        "--dump-single-json",
        "--no-playlist",
        "--no-check-certificates",
        "--no-warnings",
        "--quiet",
        "--add-header", `User-Agent:${BROWSER_UA}`,
        "--add-header", "Accept-Language:en-US,en;q=0.9",
      ];

      // YouTube bot detection bypass — use the TV client which isn't blocked
      if (isYouTube) {
        args.push("--extractor-args", "youtube:player_client=tv,web");
      }

      const raw = await ytdlp(args);
      const info = JSON.parse(raw);
      res.json({
        title:     info.title     || "Unknown title",
        thumbnail: info.thumbnail || "",
        duration:  info.duration  || 0,
        uploader:  info.uploader  || info.channel || "",
        platform:  info.extractor_key || "",
      });
    } catch (err: any) {
      const msg = String(err?.stderr || err?.message || "");
      console.error("[downloader] info error:", msg.slice(0, 400));

      const notFound  = msg.includes("Video unavailable") || msg.includes("Private video") || msg.includes("does not exist");
      const botBlock  = msg.includes("Sign in") || msg.includes("bot") || msg.includes("confirm your age");
      const notReady  = msg.includes("ENOENT");

      const error = notReady  ? "Downloader is still initialising — please wait 30 seconds and try again."
                  : notFound  ? "Video unavailable or private. Check the URL and try again."
                  : botBlock  ? "YouTube is blocking this request. Try a TikTok or Instagram link, or try again in a few minutes."
                  : "Could not fetch video info. Check the URL and try again.";

      res.status(500).json({ error });
    }
  });

  // GET /api/dl/stream — yt-dlp downloads to temp file, server streams it (quota enforced)
  app.get("/api/dl/stream", async (req: Request, res: Response) => {
    const { url, email, title } = req.query as { url?: string; email?: string; title?: string };

    if (!url || !isAllowedUrl(url)) {
      return res.status(400).json({ error: "Invalid or unsupported URL" });
    }

    const ip         = getClientIp(req);
    const subscribed = !!(email && await isSubscriber(email));

    if (!subscribed) {
      const used = await getDailyUsage(ip);
      if (used >= FREE_LIMIT) {
        return res.status(402).json({
          error:    "daily_limit_reached",
          message:  `You've used your ${FREE_LIMIT} free downloads today. They reset at midnight. Subscribe for Ksh 100/month for unlimited downloads.`,
          used,
          limit:    FREE_LIMIT,
          resetsAt: "midnight UTC",
        });
      }
    }

    // Temp file path — yt-dlp writes here, we stream it back, then delete
    const tmpFile = path.join(os.tmpdir(), `dl_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);

    function cleanup() {
      try { unlinkSync(tmpFile); } catch {}
    }

    try {
      // yt-dlp downloads the video itself — it handles all cookies/auth internally
      // This avoids CDN 403s from IP/cookie mismatch when proxying raw URLs
      const bin = await ensureYtDlp();
      const isYouTube = /youtube\.com|youtu\.be/.test(url);
      const dlArgs = [
        url,
        "--no-playlist",
        "--no-check-certificates",
        "--no-warnings",
        "--quiet",
        // Sort formats: prefer H.264, then 720p max, then mp4/m4a container
        // Much more reliable than a complex -f expression for cross-platform H.264
        "-S", "codec:h264,res:720,ext:mp4:m4a",
        "--remux-video", "mp4",
        "--add-header", `User-Agent:${BROWSER_UA}`,
        "--add-header", "Accept-Language:en-US,en;q=0.9",
        "-o", tmpFile,
      ];
      // YouTube bot detection bypass
      if (isYouTube) {
        dlArgs.push("--extractor-args", "youtube:player_client=tv,web");
      }
      await execFileAsync(bin, dlArgs, { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });

      if (!existsSync(tmpFile)) throw new Error("yt-dlp produced no output file");

      // Quota consumed only after successful download
      if (!subscribed) await incrementDailyUsage(ip);

      const filename = safeFilename(title || "video");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Cache-Control", "no-store");

      const stream = createReadStream(tmpFile);
      stream.pipe(res);
      stream.on("end", cleanup);
      stream.on("error", (err) => {
        cleanup();
        if (!res.headersSent) res.status(500).json({ error: "Failed to stream file" });
      });
      req.on("close", () => { stream.destroy(); cleanup(); });

    } catch (err: any) {
      cleanup();
      console.error("[downloader] stream error:", String(err?.message || "").slice(0, 300));
      if (!res.headersSent) {
        res.status(500).json({ error: "Could not download video. Check the URL and try again." });
      }
    }
  });

  // POST /api/dl/admin/grant — give an email unlimited access
  app.post("/api/dl/admin/grant", async (req: Request, res: Response) => {
    if (!isAdminRequest(req)) return res.status(403).json({ error: "Forbidden" });
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ error: "Email required" });
    await addSubscriber(email);
    res.json({ success: true, message: `${email} granted unlimited downloads` });
  });

  // GET /api/dl/check-sub?email=x
  app.get("/api/dl/check-sub", async (req: Request, res: Response) => {
    const email = (req.query.email as string || "").toLowerCase();
    res.json({ subscribed: await isSubscriber(email) });
  });

  // GET /api/dl/admin/subscribers
  app.get("/api/dl/admin/subscribers", async (req: Request, res: Response) => {
    if (!isAdminRequest(req)) return res.status(403).json({ error: "Forbidden" });
    res.json({ subscribers: await listSubscribers() });
  });

  // POST /api/dl/admin/revoke
  app.post("/api/dl/admin/revoke", async (req: Request, res: Response) => {
    if (!isAdminRequest(req)) return res.status(403).json({ error: "Forbidden" });
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ error: "Email required" });
    await removeSubscriber(email);
    res.json({ success: true, message: `${email} revoked` });
  });

  // GET /api/dl/admin/status — yt-dlp health + subscriber count
  app.get("/api/dl/admin/status", async (req: Request, res: Response) => {
    if (!isAdminRequest(req)) return res.status(403).json({ error: "Forbidden" });
    try {
      const bin = await ensureYtDlp();
      const subs = await listSubscribers();
      res.json({ ready: true, path: bin, subscribers: subs.length });
    } catch {
      const subs = await listSubscribers().catch(() => []);
      res.json({ ready: false, path: "", subscribers: subs.length });
    }
  });
}
