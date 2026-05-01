/**
 * esimScraper.ts
 * Cloudflare bypass for esimplus.me/temporary-numbers using
 * puppeteer-extra + stealth plugin (mimics a real Chrome browser).
 *
 * Numbers URL scheme:  /temporary-numbers/<country-slug>/<digits>
 * Messages URL scheme: /temporary-numbers/<country-slug>/<digits>
 *
 * Caching: numbers cached 10 min, messages cached 60 s.
 * Browser: singleton — launched once, pages opened per request.
 */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin   from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';

puppeteerExtra.use(StealthPlugin());

const BASE = 'https://esimplus.me';
const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--single-process',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--mute-audio',
];

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser;
  browser = await (puppeteerExtra as any).launch({
    headless: true,
    args: CHROME_ARGS,
    ignoreHTTPSErrors: true,
  });
  browser!.on('disconnected', () => { browser = null; });
  return browser!;
}

/** Open a new page, navigate, wait for CF to clear, return page. */
async function openPage(url: string): Promise<Page> {
  const b    = await getBrowser();
  const page = await b.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  // Navigate — waitUntil networkidle2 lets Cloudflare challenge JS finish
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 40_000 });

  // If still on CF challenge page, wait a bit more
  const title = await page.title();
  if (title.includes('Just a moment') || title.includes('Checking')) {
    await page.waitForFunction(
      () => !document.title.includes('Just a moment') && !document.title.includes('Checking'),
      { timeout: 30_000, polling: 1000 }
    );
    await page.waitForNetworkIdle({ idleTime: 1500, timeout: 15_000 }).catch(() => {});
  }
  return page;
}

// ── Numbers list cache ───────────────────────────────────────────────────────
let numCache: { data: EsimNumber[]; ts: number } | null = null;
const NUM_TTL = 10 * 60_000; // 10 minutes

export interface EsimNumber {
  number: string;
  country: string;
  digits: string;
  slug: string;   // e.g. "united-states/16183688471"
  source: string;
}

export async function scrapeEsimplusNumbers(): Promise<EsimNumber[]> {
  if (numCache && Date.now() - numCache.ts < NUM_TTL) return numCache.data;

  const page = await openPage(`${BASE}/temporary-numbers`);
  try {
    // Wait for number links to appear
    await page.waitForSelector('a[href*="/temporary-numbers/"]', { timeout: 20_000 });

    const numbers: EsimNumber[] = await page.evaluate((base: string) => {
      const seen  = new Set<string>();
      const items: any[] = [];
      document.querySelectorAll<HTMLAnchorElement>('a[href*="/temporary-numbers/"]').forEach(el => {
        const href  = el.getAttribute('href') || '';
        const match = href.match(/\/temporary-numbers\/([a-z-]+)\/(\d{8,15})/);
        if (!match) return;
        const slug    = `${match[1]}/${match[2]}`;
        const digits  = match[2];
        if (seen.has(digits)) return;
        seen.add(digits);
        // Walk up to find the card that contains country + phone number text
        const card = el.closest('div, article, li') ?? el.parentElement ?? el;
        const allText = card?.textContent || '';
        // Phone number pattern: +N NNN-NNN-NNNN or similar
        const numMatch = allText.match(/\+[\d\s\-()]{7,20}/);
        const number   = numMatch ? numMatch[0].trim() : '+' + digits;
        // Country — comes from page text nearby or the href slug
        const country  = match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        items.push({ number, country, digits, slug, source: 'esimplus' });
      });
      return items;
    }, BASE);

    numCache = { data: numbers, ts: Date.now() };
    return numbers;
  } finally {
    await page.close();
  }
}

// ── Message cache (per number) ───────────────────────────────────────────────
const msgCache = new Map<string, { data: EsimMessage[]; ts: number }>();
const MSG_TTL  = 60_000; // 1 minute

export interface EsimMessage {
  sender: string;
  body: string;
  time: string;
}

export async function scrapeEsimplusMessages(slug: string): Promise<EsimMessage[]> {
  const cached = msgCache.get(slug);
  if (cached && Date.now() - cached.ts < MSG_TTL) return cached.data;

  const page = await openPage(`${BASE}/temporary-numbers/${slug}`);
  try {
    // Wait for message content — try several likely selectors
    await Promise.race([
      page.waitForSelector('[class*="message"]',    { timeout: 15_000 }),
      page.waitForSelector('[class*="sms"]',         { timeout: 15_000 }),
      page.waitForSelector('[class*="inbox"]',       { timeout: 15_000 }),
    ]).catch(() => {}); // ok if none found — page might just be empty

    await new Promise(r => setTimeout(r, 1500)); // let dynamic content settle

    const messages: EsimMessage[] = await page.evaluate(() => {
      const msgs: any[] = [];

      // Strategy 1: look for divs/rows that contain a phone-code-like message
      const candidates = Array.from(document.querySelectorAll('div, p, span, li'));
      candidates.forEach(el => {
        const text = el.textContent?.trim() || '';
        // Skip tiny elements and headers
        if (text.length < 10 || text.length > 2000) return;
        // Must look like an SMS body (contains a code, or sentence)
        const looksLikeSms = /\d{4,8}|verification|code|confirm|password|otp|pin/i.test(text);
        if (!looksLikeSms) return;
        // Avoid duplicates already captured by a parent element
        const alreadyCovered = msgs.some(m => m.body === text);
        if (alreadyCovered) return;
        // Try to find sender from a sibling/parent
        const parent = el.parentElement;
        const senderEl = parent?.querySelector('[class*="sender"],[class*="from"],[class*="number"]');
        const timeEl   = parent?.querySelector('[class*="time"],[class*="date"],[class*="ago"]');
        msgs.push({
          sender: senderEl?.textContent?.trim() || '',
          body:   text,
          time:   timeEl?.textContent?.trim()   || '',
        });
      });

      // Strategy 2: scan all text nodes for verification code patterns
      if (msgs.length === 0) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          const t = node.nodeValue?.trim() || '';
          if (t.length < 20 || t.length > 500) continue;
          if (/\d{4,8}|verification|code|confirm/i.test(t)) {
            msgs.push({ sender: '', body: t, time: '' });
          }
        }
      }

      return msgs.slice(0, 30);
    });

    msgCache.set(slug, { data: messages, ts: Date.now() });
    return messages;
  } finally {
    await page.close();
  }
}
