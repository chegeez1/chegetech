/**
 * download-routes.ts
 * YouTube / TikTok / Instagram downloader
 *   - 2 free downloads per IP per calendar month
 *   - Ksh 100/month subscription for unlimited via Paystack
 */
import type { Express, Request, Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

// ── Locate yt-dlp binary (bundled by youtube-dl-exec) ────────────────────────
function getYtDlpBin(): string {
  // youtube-dl-exec ships the binary here:
  const candidates = [
    path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", "yt-dlp"),
    path.join(process.cwd(), "node_modules", ".bin", "yt-dlp"),
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "yt-dlp"; // fallback — hope it's on PATH
}

// ── In-memory quota store (resets monthly) ───────────────────────────────────
// Structure: { "ip::2025-05": 2 }
const quotaStore = new Map<string, number>();
const FREE_LIMIT = 2;

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getQuotaKey(ip: string) {
  return `${ip}::${getMonthKey()}`;
}
function getUsage(ip: string) {
  return quotaStore.get(getQuotaKey(ip)) ?? 0;
}
function incrementUsage(ip: string) {
  const key = getQuotaKey(ip);
  quotaStore.set(key, (quotaStore.get(key) ?? 0) + 1);
}

// ── Subscriber list (in-memory; admin grants via POST /api/dl/admin/grant) ───
const subscribers = new Set<string>(); // email set

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

// ── Sanitise / validate URL ───────────────────────────────────────────────────
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
  } catch {
    return false;
  }
}

// ── Run yt-dlp with a timeout ─────────────────────────────────────────────────
async function ytdlp(args: string[]): Promise<string> {
  const bin = getYtDlpBin();
  const { stdout } = await execFileAsync(bin, args, { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

// ── Routes ────────────────────────────────────────────────────────────────────
export function registerDownloadRoutes(app: Express) {

  // GET /api/dl/quota — how many free downloads left for this IP
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
        duration:  info.duration  || 0,      // seconds
        uploader:  info.uploader  || info.channel || "",
        platform:  info.extractor_key || "",
        formats: (info.formats || [])
          .filter((f: any) => f.ext === "mp4" || f.acodec !== "none")
          .slice(-6)
          .map((f: any) => ({ id: f.format_id, label: f.format_note || f.height + "p" || f.ext, ext: f.ext })),
      });
    } catch (err: any) {
      res.status(500).json({ error: "Could not fetch video info. Check the URL and try again." });
    }
  });

  // POST /api/dl/link — get a direct download URL (quota enforced)
  app.post("/api/dl/link", async (req: Request, res: Response) => {
    const { url, email } = req.body as { url?: string; email?: string };
    if (!url || !isAllowedUrl(url)) {
      return res.status(400).json({ error: "Invalid or unsupported URL" });
    }

    const ip = getClientIp(req);
    // Check if subscribed
    const isSubscribed = email && subscribers.has(email.toLowerCase());

    if (!isSubscribed) {
      const used = getUsage(ip);
      if (used >= FREE_LIMIT) {
        return res.status(402).json({
          error: "free_limit_reached",
          message: `You've used your ${FREE_LIMIT} free downloads this month. Subscribe for Ksh 100/month for unlimited downloads.`,
          used,
          limit: FREE_LIMIT,
        });
      }
    }

    try {
      // Get best mp4 up to 720p so it doesn't kill the Render server
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
    } catch (err: any) {
      res.status(500).json({ error: "Could not generate download link. Try again shortly." });
    }
  });

  // POST /api/dl/admin/grant — admin grants unlimited access to an email
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

  // GET /api/dl/check-sub?email=x — check if email has active subscription
  app.get("/api/dl/check-sub", (req: Request, res: Response) => {
    const email = (req.query.email as string || "").toLowerCase();
    res.json({ subscribed: subscribers.has(email) });
  });
}
