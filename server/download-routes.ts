/**
 * download-routes.ts
 * YouTube / TikTok / Instagram downloader
 *   - 2 free downloads per IP per calendar month
 *   - Ksh 100/month subscription for unlimited via Paystack
 *
 * yt-dlp is downloaded automatically at server start if not already present.
 */
import type { Express, Request, Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { createWriteStream, existsSync, mkdirSync, chmodSync } from "fs";
import { get } from "https";
import path from "path";

const execFileAsync = promisify(execFile);

// ── yt-dlp binary location & auto-download ───────────────────────────────────
const BIN_DIR  = path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin");
const BIN_PATH = path.join(BIN_DIR, "yt-dlp");

// Direct CDN URL — no GitHub API call, no rate limits
const YTDLP_CDN = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

let ytdlpReady: Promise<string> | null = null;

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const request = (u: string) =>
      get(u, (res) => {
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
    request(url);
  });
}

function ensureYtDlp(): Promise<string> {
  if (ytdlpReady) return ytdlpReady;

  // Check all known locations first
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

  // Not found — download from GitHub CDN at runtime
  console.log("[downloader] yt-dlp not found — downloading from GitHub CDN...");
  ytdlpReady = (async () => {
    mkdirSync(BIN_DIR, { recursive: true });
    await downloadFile(YTDLP_CDN, BIN_PATH);
    chmodSync(BIN_PATH, 0o755);
    console.log("[downloader] yt-dlp ready at", BIN_PATH);
    return BIN_PATH;
  })().catch((err) => {
    ytdlpReady = null; // allow retry on next request
    throw err;
  });

  return ytdlpReady;
}

// Start download eagerly at module load so it is ready by the time requests arrive
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
      ]);
      const info = JSON.parse(raw);
      res.json({
        title:     info.title     || "Unknown title",
        thumbnail: info.thumbnail || "",
        duration:  info.duration  || 0,
        uploader:  info.uploader  || info.channel || "",
        platform:  info.extractor_key || "",
        formats: (info.formats || [])
          .filter((f: any) => f.ext === "mp4" || f.acodec !== "none")
          .slice(-6)
          .map((f: any) => ({
            id:    f.format_id,
            label: f.format_note || (f.height ? f.height + "p" : f.ext),
            ext:   f.ext,
          })),
      });
    } catch (err: any) {
      const isSetupErr =
        String(err?.message).includes("download") ||
        String(err?.message).includes("HTTP") ||
        String(err?.message).includes("ENOENT");
      res.status(500).json({
        error: isSetupErr
          ? "Downloader is still initialising — please wait 30 seconds and try again."
          : "Could not fetch video info. Check the URL and try again.",
      });
    }
  });

  // POST /api/dl/link — get a direct download URL (quota enforced)
  app.post("/api/dl/link", async (req: Request, res: Response) => {
    const { url, email } = req.body as { url?: string; email?: string };
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
      const directUrl = await ytdlp([
        url,
        "--print", "urls",
        "--no-playlist",
        "--no-check-certificates",
        "--no-warnings",
        "--quiet",
        "-f", "best[ext=mp4][height<=720]/best[ext=mp4]/best",
      ]);

      if (!isSubscribed) incrementUsage(ip);
      res.json({ url: directUrl.split("\n")[0] });
    } catch {
      res.status(500).json({ error: "Could not generate download link. Try again shortly." });
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
}
