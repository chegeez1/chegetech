import { exec, spawn, type ChildProcess } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import net from "net";
import http from "http";
import { runQuery, runMutation, dbType } from "./storage";

const execAsync = promisify(exec);

// ── Config ────────────────────────────────────────────────────────────────
export const BASE_DEPLOY_DIR = path.join(process.cwd(), ".chegetech-deployments");

function getPublicDomain(): string {
  const domainsEnv = process.env["REPLIT_DOMAINS"] ?? "";
  const all = domainsEnv.split(",").map(d => d.trim()).filter(Boolean);
  const prod = all.find(d => d.endsWith(".replit.app"));
  return prod ?? process.env["REPLIT_DEV_DOMAIN"] ?? "localhost:5000";
}

export function buildLiveUrl(reference: string): string {
  return `https://${getPublicDomain()}/bot-preview/${reference}/`;
}

// ── Metadata persistence ─────────────────────────────────────────────────
interface DeployMeta {
  type: "static" | "process";
  staticDir?: string;
  startCommand?: string;
  port?: number;
  deployDir: string;
  reference: string;
}

function metaPath(deployDir: string): string {
  return path.join(deployDir, ".chegetech-meta.json");
}

async function writeMeta(deployDir: string, meta: DeployMeta): Promise<void> {
  await fs.writeFile(metaPath(deployDir), JSON.stringify(meta, null, 2), "utf-8");
}

async function readMeta(deployDir: string): Promise<DeployMeta | null> {
  try {
    const raw = await fs.readFile(metaPath(deployDir), "utf-8");
    return JSON.parse(raw) as DeployMeta;
  } catch {
    return null;
  }
}

// ── Port health check ────────────────────────────────────────────────────
function isPortAlive(port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (result: boolean) => { sock.destroy(); resolve(result); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(port, "127.0.0.1");
  });
}

// ── In-memory running bots registry ──────────────────────────────────────
export interface RunningBot {
  type: "static" | "process";
  staticDir?: string;
  port?: number;
  process?: ChildProcess;
  reference: string;
}

const runningBots = new Map<string, RunningBot>();
let nextPort = 26000;

export function getRunningBot(ref: string): RunningBot | undefined {
  return runningBots.get(ref);
}

export function getAllRunningBots(): Map<string, RunningBot> {
  return runningBots;
}

function allocatePort(): number {
  return nextPort++;
}

async function ensureBaseDir(): Promise<void> {
  await fs.mkdir(BASE_DEPLOY_DIR, { recursive: true });
}

// ── Runtime detection ───────────────────────────────────────────────────
async function detectRuntimeFromFiles(dir: string): Promise<{
  runtime: "static" | "nodejs" | "unknown";
  hasBuildScript: boolean;
  buildOutputDir: string | null;
  startCommand: string | null;
}> {
  const pkgPath = path.join(dir, "package.json");
  const indexHtml = path.join(dir, "index.html");

  if (existsSync(pkgPath)) {
    try {
      const raw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw) as { scripts?: Record<string, string>; main?: string };
      const scripts = pkg.scripts ?? {};
      const hasBuild = !!scripts["build"];

      let buildOutputDir: string | null = null;
      if (hasBuild) {
        const buildCmd = scripts["build"] ?? "";
        if (buildCmd.includes("next")) buildOutputDir = "out";
        else if (buildCmd.includes("vite") || buildCmd.includes("react-scripts")) buildOutputDir = "dist";
        else buildOutputDir = "dist";
      }

      const startCommand = scripts["start"]
        ? "npm start"
        : scripts["dev"]
        ? "npm run dev"
        : pkg.main
        ? `node ${pkg.main}`
        : "node index.js";

      return { runtime: "nodejs", hasBuildScript: hasBuild, buildOutputDir, startCommand };
    } catch {
      return { runtime: "nodejs", hasBuildScript: false, buildOutputDir: null, startCommand: "node index.js" };
    }
  }

  if (existsSync(indexHtml)) {
    return { runtime: "static", hasBuildScript: false, buildOutputDir: null, startCommand: null };
  }

  try {
    const files = await fs.readdir(dir);
    if (files.some(f => f.endsWith(".html"))) {
      return { runtime: "static", hasBuildScript: false, buildOutputDir: null, startCommand: null };
    }
  } catch { /* ignore */ }

  return { runtime: "unknown", hasBuildScript: false, buildOutputDir: null, startCommand: null };
}

async function findBuildOutput(dir: string, candidate: string | null): Promise<string | null> {
  const candidates = [candidate, "dist", "build", "out", ".next", "public", "_site"].filter(Boolean) as string[];
  for (const c of candidates) {
    const full = path.join(dir, c);
    if (existsSync(full)) {
      try {
        const files = await fs.readdir(full);
        if (files.length > 0) return full;
      } catch { /* continue */ }
    }
  }
  return null;
}

// ── Main deploy function (replaces VPS-based deploy) ─────────────────────
export async function deployBot(
  reference: string,
  repoUrl: string,
  envVars: Record<string, string>
): Promise<{ success: boolean; liveUrl?: string; error?: string; deployType?: "static" | "process"; port?: number }> {
  await ensureBaseDir();
  const deployDir = path.join(BASE_DEPLOY_DIR, reference);

  try {
    // Clean up any previous clone
    if (existsSync(deployDir)) {
      await fs.rm(deployDir, { recursive: true, force: true });
    }

    // Clone repo
    console.log(`[Bot Deploy] Cloning ${repoUrl} ...`);
    const { stdout: cloneOut, stderr: cloneErr, code: cloneCode } = await execAsync(
      `git clone --depth 1 ${repoUrl} ${deployDir}`,
      { maxBuffer: 50 * 1024 * 1024 }
    );
    if (cloneCode !== 0 && !existsSync(deployDir)) {
      throw new Error(`git clone failed: ${cloneErr || cloneOut}`);
    }
    console.log(`[Bot Deploy] ✓ Repo cloned to ${deployDir}`);

    // Write .env file
    const envLines = Object.entries(envVars)
      .map(([k, v]) => `${k}=${String(v).replace(/\r?\n/g, "\\n")}`)
      .join("\n");
    await fs.writeFile(path.join(deployDir, ".env"), envLines, "utf-8");
    console.log(`[Bot Deploy] ✓ .env written`);

    // Detect runtime
    const { runtime, hasBuildScript, buildOutputDir, startCommand } = await detectRuntimeFromFiles(deployDir);
    console.log(`[Bot Deploy] Detected runtime: ${runtime}`);

    let serveDir: string | null = null;
    let processPort: number | null = null;

    if (runtime === "nodejs") {
      // npm install
      console.log(`[Bot Deploy] Running npm install...`);
      const { stdout: installOut, stderr: installErr, code: installCode } = await execAsync(
        `cd ${deployDir} && npm install --prefer-offline 2>&1`,
        { maxBuffer: 50 * 1024 * 1024 }
      );
      console.log(`[Bot Deploy] npm install (exit=${installCode}): ${installOut.slice(0, 200)}`);
      if (installCode !== 0) {
        throw new Error(`npm install failed: ${installErr || installOut}`);
      }

      if (hasBuildScript) {
        console.log(`[Bot Deploy] Running npm run build...`);
        const { stdout: buildOut, stderr: buildErr, code: buildCode } = await execAsync(
          `cd ${deployDir} && npm run build 2>&1`,
          { maxBuffer: 50 * 1024 * 1024 }
        );
        console.log(`[Bot Deploy] npm run build (exit=${buildCode}): ${buildOut.slice(0, 200)}`);

        const outDir = await findBuildOutput(deployDir, buildOutputDir);
        if (outDir) {
          serveDir = outDir;
          console.log(`[Bot Deploy] ✓ Build output at ${path.relative(deployDir, outDir)}`);
        } else {
          serveDir = deployDir;
          console.log(`[Bot Deploy] ⚠ No build output found, serving from root`);
        }
      } else {
        // Server app - spawn it as a child process
        processPort = allocatePort();
        const env = { ...process.env, PORT: String(processPort), NODE_ENV: "production" };
        const [cmd, ...args] = (startCommand ?? "node index.js").split(" ");
        const child = spawn(cmd, args, { cwd: deployDir, env, detached: false });

        runningBots.set(reference, {
          type: "process",
          port: processPort,
          process: child,
          reference,
        });

        child.stdout?.on("data", (chunk: Buffer | string) => {
          String(chunk).split("\n").filter(Boolean).slice(0, 5)
            .forEach(line => console.log(`[Bot ${reference}] ${line}`));
        });

        child.stderr?.on("data", (chunk: Buffer | string) => {
          String(chunk).split("\n").filter(Boolean).slice(0, 5)
            .forEach(line => console.error(`[Bot ${reference}] ${line}`));
        });

        child.on("exit", (code) => {
          console.log(`[Bot ${reference}] Process exited with code ${code}`);
        });

        await new Promise<void>(r => setTimeout(r, 2500));
        console.log(`[Bot Deploy] ✓ Server listening on port ${processPort}`);
      }
    } else {
      // Static or unknown
      const indexPath = path.join(deployDir, "index.html");
      if (existsSync(indexPath)) {
        console.log(`[Bot Deploy] ✓ Static site ready`);
      } else {
        try {
          const files = await fs.readdir(deployDir);
          console.log(`[Bot Deploy] Files: ${files.slice(0, 10).join(", ")}`);
        } catch { /* ignore */ }
      }
      serveDir = deployDir;
    }

    // Register and persist
    const liveUrl = buildLiveUrl(reference);
    if (serveDir) {
      runningBots.set(reference, { type: "static", staticDir: serveDir, reference });
      await writeMeta(deployDir, { type: "static", staticDir: serveDir, deployDir, reference });
    } else if (processPort) {
      await writeMeta(deployDir, {
        type: "process",
        startCommand: startCommand ?? "node index.js",
        port: processPort,
        deployDir,
        reference,
      });
    }

    console.log(`[Bot Deploy] ✓ Deployment live at: ${liveUrl}`);
    return { success: true, liveUrl, deployType: serveDir ? "static" : "process", port: processPort ?? undefined };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Bot Deploy] ✗ ${reference}: ${msg}`);
    return { success: false, error: msg };
  }
}

// ── Teardown ───────────────────────────────────────────────────────────────
export async function teardownBot(reference: string): Promise<void> {
  const registered = runningBots.get(reference);
  if (registered) {
    if (registered.type === "process" && registered.process) {
      registered.process.kill("SIGTERM");
      await new Promise<void>(r => setTimeout(r, 2000));
      if (!registered.process.killed) registered.process.kill("SIGKILL");
    }
    runningBots.delete(reference);
  }

  const deployDir = path.join(BASE_DEPLOY_DIR, reference);
  if (existsSync(deployDir)) {
    await fs.rm(deployDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Recovery on startup ──────────────────────────────────────────────────
export async function recoverBots(): Promise<void> {
  console.log("[Bot Deploy] Recovering bots from disk...");
  try {
    const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
    const rows: any[] = await runQuery(
      `SELECT * FROM bot_orders WHERE status = 'deployed' ORDER BY created_at DESC`
    ).catch(() => []);

    let recovered = 0;
    for (const order of rows) {
      const deployDir = path.join(BASE_DEPLOY_DIR, order.reference);
      if (!existsSync(deployDir)) continue;

      const meta = await readMeta(deployDir);
      if (!meta) {
        const indexPath = path.join(deployDir, "index.html");
        if (existsSync(indexPath)) {
          runningBots.set(order.reference, { type: "static", staticDir: deployDir, reference: order.reference });
          recovered++;
        }
        continue;
      }

      if (meta.type === "static" && meta.staticDir && existsSync(meta.staticDir)) {
        runningBots.set(order.reference, { type: "static", staticDir: meta.staticDir, reference: order.reference });
        recovered++;
      } else if (meta.type === "process" && meta.port) {
        const alive = await isPortAlive(meta.port);
        if (alive) {
          runningBots.set(order.reference, { type: "process", port: meta.port, reference: order.reference });
          if (meta.port >= nextPort) nextPort = meta.port + 1;
          recovered++;
        } else {
          // Re-spawn
          try {
            const env = { ...process.env, PORT: String(meta.port), NODE_ENV: "production" };
            const [cmd, ...args] = (meta.startCommand ?? "node index.js").split(" ");
            const child = spawn(cmd, args, { cwd: meta.deployDir, env, detached: false });
            runningBots.set(order.reference, {
              type: "process",
              port: meta.port,
              process: child,
              reference: order.reference,
            });
            if (meta.port >= nextPort) nextPort = meta.port + 1;
            await new Promise<void>(r => setTimeout(r, 2000));
            recovered++;
            console.log(`[Bot Deploy] Re-spawned ${order.reference}`);
          } catch (err) {
            console.warn(`[Bot Deploy] Failed to re-spawn ${order.reference}:`, err);
            await runMutation(
              `UPDATE bot_orders SET status = 'deploy_failed', updated_at = ${updNow} WHERE reference = ?`,
              [order.reference]
            ).catch(() => {});
          }
        }
      }
    }

    console.log(`[Bot Deploy] Recovered ${recovered}/${rows.length} bots`);
  } catch (err) {
    console.error("[Bot Deploy] Recovery failed:", err);
  }
}

// ── Health check ───────────────────────────────────────────────────────────
export function startHealthCheck(): void {
  const INTERVAL_MS = 2 * 60 * 1000;

  const check = async () => {
    try {
      const rows: any[] = await runQuery(
        `SELECT * FROM bot_orders WHERE status = 'deployed'`
      ).catch(() => []);

      for (const order of rows) {
        const registered = runningBots.get(order.reference);
        if (!registered) {
          const deployDir = path.join(BASE_DEPLOY_DIR, order.reference);
          if (!existsSync(deployDir)) continue;
          const meta = await readMeta(deployDir);
          if (!meta) continue;

          if (meta.type === "static" && meta.staticDir && existsSync(meta.staticDir)) {
            runningBots.set(order.reference, { type: "static", staticDir: meta.staticDir, reference: order.reference });
          } else if (meta.type === "process" && meta.port) {
            const alive = await isPortAlive(meta.port);
            if (alive) {
              runningBots.set(order.reference, { type: "process", port: meta.port, reference: order.reference });
            }
          }
          continue;
        }

        if (registered.type === "process" && registered.port) {
          const alive = await isPortAlive(registered.port);
          if (!alive) {
            const meta = await readMeta(path.join(BASE_DEPLOY_DIR, order.reference));
            if (meta && meta.type === "process") {
              const env = { ...process.env, PORT: String(meta.port), NODE_ENV: "production" };
              const [cmd, ...args] = (meta.startCommand ?? "node index.js").split(" ");
              const child = spawn(cmd, args, { cwd: meta.deployDir, env, detached: false });
              runningBots.set(order.reference, {
                type: "process",
                port: meta.port,
                process: child,
                reference: order.reference,
              });
              console.log(`[Bot Deploy] Health check: re-spawned ${order.reference}`);
            }
          }
        }
      }
    } catch (err) {
      console.error("[Bot Deploy] Health check error:", err);
    }
  };

  setInterval(check, INTERVAL_MS);
  console.log("[Bot Deploy] Health check started (every 2 min)");
}

// ── Preview middleware ───────────────────────────────────────────────────
export async function serveBotPreview(req: any, res: any, next: any): Promise<void> {
  const match = req.path.match(/^\/bot-preview\/([^/]+)\/?(.*)?$/);
  if (!match) return next();

  const reference = match[1];
  const subPath = match[2] || "index.html";

  // Try to recover from disk if not in memory
  const registered = runningBots.get(reference);
  if (!registered) {
    const deployDir = path.join(BASE_DEPLOY_DIR, reference);
    if (existsSync(deployDir)) {
      const meta = await readMeta(deployDir);
      if (meta?.type === "static" && meta.staticDir && existsSync(meta.staticDir)) {
        runningBots.set(reference, { type: "static", staticDir: meta.staticDir, reference });
      }
    }
  }

  const bot = runningBots.get(reference);
  if (!bot) {
    return res.status(404).send("Bot not found or not running");
  }

  if (bot.type === "static" && bot.staticDir) {
    const filePath = path.join(bot.staticDir, subPath);
    if (existsSync(filePath)) {
      return res.sendFile(path.resolve(filePath));
    }
    const indexPath = path.join(bot.staticDir, "index.html");
    if (existsSync(indexPath)) {
      return res.sendFile(path.resolve(indexPath));
    }
    return res.status(404).send("File not found");
  }

  if (bot.type === "process" && bot.port) {
    const proxyReq = http.request(
      { hostname: "127.0.0.1", port: bot.port, path: "/" + subPath, method: req.method, headers: req.headers },
      (proxyRes: any) => {
        res.status(proxyRes.statusCode || 200);
        Object.entries(proxyRes.headers).forEach(([k, v]) => { if (v) res.setHeader(k, v as any); });
        proxyRes.pipe(res);
      }
    );
    proxyReq.on("error", () => res.status(502).send("Bot process unreachable"));
    req.pipe(proxyReq);
    return;
  }

  next();
}
