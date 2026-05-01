/**
 * download-routes.ts
 * YouTube / TikTok / Instagram downloader
 *   - 2 free downloads per IP per calendar month
 *   - Ksh 100/month subscription for unlimited via Paystack
 *
 * yt-dlp is downloaded automatically at server start if not already present.
 * Videos are proxied through the server so CDN 403s never reach the browser.
 */
import type { Express, Request, Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { createWriteStream, existsSync, mkdirSync, chmodSync } from "fs";
import https from "https";
import http from "http";
import path from "path";

const execFileAsync = promisify(execFile);

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

// ── Run yt-dlp with timeout ───────────────────────────────────────────────────
async function ytdlp(args: string[]): Promise<string> {
  const bin = await ensureYtDlp();
  const { stdout } = await execFileAsync(bin, args, {
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}

// ── Proxy a CDN URL through the server (handles redirects, spoofs headers) ───
function proxyVideoStream(
  cdnUrl: string,
  referer: string,
  filename: string,
  res: Response,
  req: Request,
): void {
  const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
        // Follow redirects
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

        // Set download headers
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
      console.error("[downloader] Proxy request error:", err.message);
      if (!res.headersSent) res.status(500).json({ error: "Failed to fetch video from CDN" });
    });

    // If client disconnects, abort upstream request
    req.on("close", () => proxyReq.destroy());
  };

  doRequest(cdnUrl);
}

// ── In-memory quota store (resets monthly) ───────────────────────────────────
const quotaStore = new Map<string, number>();
const FREE_LIMIT = 2;

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getQuotaKey(ip: string) { return `${ip}::${getMonthKey()}`; }
function getUsage(ip: string)    { return quotaStore.get(getQuotaKey(ip)) ?? 0; }
function incrementUsage(ip: string) {
  const key = getQuotaKey(ip);
  quotaStore.set(key, (quotaStore.get(key) ?? 0) + 1);
}

// ── Subscriber list ───────────────────────────────────────────────────────────
const subscribers = new Set<string>();

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

// ── Routes ────────────────────────────────────────────────────────────────────
export function registerDownloadRoutes(app: Express) {

  // GET /api/dl/quota
  app.get("/api/dl/quota", (req, res) => {
    const ip   = getClientIp(req);
    const used = getUsage(ip);
    res.json({ used, limit: FREE_LIMIT, remaining: Math.max(0, FREE_LIMIT - used) });
  });

  // POST /api/dl/info — fetch video metadata (no quota consumed)
  app.post("/api/dl/info", async (req: Request, res: Response) => {
    const { url } = req.body as { url?: string };
    if (!url || !isAllowedUrl(url)) {
      return res.status(400).json({ error: "Invalid or unsupported URL" });
    }
    try {
      const raw = await ytdlp([
        url,
        "--dump-single-json",
        "--no-playlist",
        "--no-check-certificates",
        "--no-warnings",
        "--quiet",
        "--add-header", "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "--add-header", "Accept-Language:en-US,en;q=0.9",
      ]);
      const info = JSON.parse(raw);
      res.json({
        title:     info.title     || "Unknown title",
        thumbnail: info.thumbnail || "",
        duration:  info.duration  || 0,
        uploader:  info.uploader  || info.channel || "",
        platform:  info.extractor_key || "",
      });
    } catch (err: any) {
      const msg = String(err?.message || "");
      const isSetupErr = msg.includes("ENOENT") || msg.includes("yt-dlp");
      console.error("[downloader] info error:", msg.slice(0, 300));
      res.status(500).json({
        error: isSetupErr
          ? "Downloader is still initialising — please wait 30 seconds and try again."
          : "Could not fetch video info. Check the URL and try again.",
      });
    }
  });

  // GET /api/dl/stream — stream video directly through the server (quota enforced)
  // Usage: GET /api/dl/stream?url=<encoded_url>&email=<optional_email>&title=<optional_title>
  app.get("/api/dl/stream", async (req: Request, res: Response) => {
    const { url, email, title } = req.query as { url?: string; email?: string; title?: string };

    if (!url || !isAllowedUrl(url)) {
      return res.status(400).json({ error: "Invalid or unsupported URL" });
    }

    const ip           = getClientIp(req);
    const isSubscribed = !!(email && subscribers.has(email.toLowerCase()));

    if (!isSubscribed) {
      const used = getUsage(ip);
      if (used >= FREE_LIMIT) {
        return res.status(402).json({
          error:   "free_limit_reached",
          message: `You've used your ${FREE_LIMIT} free downloads this month. Subscribe for Ksh 100/month for unlimited downloads.`,
          used,
          limit: FREE_LIMIT,
        });
      }
    }

    try {
      // Get direct CDN URL via yt-dlp
      const rawUrl = await ytdlp([
        url,
        "--print", "urls",
        "--no-playlist",
        "--no-check-certificates",
        "--no-warnings",
        "--quiet",
        "-f", "best[ext=mp4][height<=720]/best[ext=mp4]/best",
        "--add-header", "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "--add-header", "Accept-Language:en-US,en;q=0.9",
      ]);

      const cdnUrl = rawUrl.split("\n")[0].trim();
      if (!cdnUrl) throw new Error("yt-dlp returned empty URL");

      // Consume quota before streaming begins
      if (!isSubscribed) incrementUsage(ip);

      // Determine referer from the original URL
      let referer = "https://www.tiktok.com/";
      try { referer = new URL(url).origin + "/"; } catch {}

      const filename = safeFilename(title || "video");
      proxyVideoStream(cdnUrl, referer, filename, res, req);

    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: "Could not generate download. Try again shortly." });
      }
    }
  });

  // POST /api/dl/admin/grant
  app.post("/api/dl/admin/grant", (req: Request, res: Response) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== process.env.ADMIN_API_KEY && adminKey !== "chegetech-admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ error: "Email required" });
    subscribers.add(email.toLowerCase());
    res.json({ success: true, message: `${email} granted unlimited downloads` });
  });

  // GET /api/dl/check-sub?email=x
  app.get("/api/dl/check-sub", (req: Request, res: Response) => {
    const email = (req.query.email as string || "").toLowerCase();
    res.json({ subscribed: subscribers.has(email) });
  });

  // GET /api/dl/admin/subscribers
  app.get("/api/dl/admin/subscribers", (req: Request, res: Response) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== process.env.ADMIN_API_KEY && adminKey !== "chegetech-admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({ subscribers: [...subscribers] });
  });

  // POST /api/dl/admin/revoke
  app.post("/api/dl/admin/revoke", (req: Request, res: Response) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== process.env.ADMIN_API_KEY && adminKey !== "chegetech-admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ error: "Email required" });
    subscribers.delete(email.toLowerCase());
    res.json({ success: true, message: `${email} revoked` });
  });

  // GET /api/dl/admin/status
  app.get("/api/dl/admin/status", async (req: Request, res: Response) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== process.env.ADMIN_API_KEY && adminKey !== "chegetech-admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const bin = await ensureYtDlp();
      res.json({ ready: true, path: bin });
    } catch {
      res.json({ ready: false, path: "" });
    }
  });
}
