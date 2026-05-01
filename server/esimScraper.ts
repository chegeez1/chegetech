/**
 * esimScraper.ts — Cloudflare bypass for esimplus.me
 *
 * Uses @sparticuz/chromium (optimised for 512MB RAM containers, same as Lambda)
 * + puppeteer-extra stealth plugin to pass Cloudflare JS challenge.
 *
 * Why sparticuz instead of full puppeteer?
 *  - Render free tier = 512MB RAM. Full Chromium needs ~300MB alone.
 *  - @sparticuz/chromium is a stripped, compressed build (< 50MB) that runs
 *    comfortably within the same 512MB limit used by AWS Lambda functions.
 */

import chromium         from '@sparticuz/chromium';
import puppeteerExtra   from 'puppeteer-extra';
import StealthPlugin    from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer-core';

puppeteerExtra.use(StealthPlugin());

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser;

  const executablePath = await chromium.executablePath();
  console.log('[esimScraper] chromium path:', executablePath);
  console.log('[esimScraper] chromium.headless:', chromium.headless);

  browser = await (puppeteerExtra as any).launch({
    args: [
      ...chromium.args,
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  (browser as Browser).on('disconnected', () => {
    console.log('[esimScraper] browser disconnected — will relaunch on next call');
    browser = null;
  });

  return browser as Browser;
}

async function openPage(url: string): Promise<Page> {
  const b    = await getBrowser();
  const page = await b.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 50_000 });

  const title = await page.title();
  if (/just a moment|checking/i.test(title)) {
    console.log('[esimScraper] CF challenge detected, waiting…');
    await page.waitForFunction(
      () => !/just a moment|checking/i.test(document.title),
      { timeout: 40_000, polling: 1500 }
    );
    await page.waitForNetworkIdle({ idleTime: 2000, timeout: 15_000 }).catch(() => {});
    console.log('[esimScraper] CF passed, title now:', await page.title());
  }
  return page;
}

// ── Number list ──────────────────────────────────────────────────────────────
let numCache: { data: EsimNumber[]; ts: number } | null = null;
const NUM_TTL = 10 * 60_000;

export interface EsimNumber {
  number: string;
  country: string;
  digits: string;
  slug: string;
  source: string;
}

export async function scrapeEsimplusNumbers(): Promise<EsimNumber[]> {
  if (numCache && Date.now() - numCache.ts < NUM_TTL) return numCache.data;

  let page: Page | undefined;
  try {
    page = await openPage('https://esimplus.me/temporary-numbers');
    await page.waitForSelector('a[href*="/temporary-numbers/"]', { timeout: 25_000 });

    const numbers: EsimNumber[] = await page.evaluate(() => {
      const seen  = new Set<string>();
      const items: any[] = [];
      document.querySelectorAll<HTMLAnchorElement>('a[href*="/temporary-numbers/"]').forEach(el => {
        const href  = el.getAttribute('href') || '';
        const match = href.match(/\/temporary-numbers\/([a-z-]+)\/(\d{8,15})/);
        if (!match) return;
        const digits = match[2];
        const slug   = `${match[1]}/${digits}`;
        if (seen.has(digits)) return;
        seen.add(digits);
        const card   = el.closest('div, article, li, section') ?? el.parentElement ?? el;
        const text   = card?.textContent || '';
        const numM   = text.match(/\+[\d\s\-().]{7,20}/);
        const number = numM ? numM[0].trim() : '+' + digits;
        const country = match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        items.push({ number, country, digits, slug, source: 'esimplus' });
      });
      return items;
    });

    console.log(`[esimScraper] scraped ${numbers.length} esimplus numbers`);
    numCache = { data: numbers, ts: Date.now() };
    return numbers;
  } catch (err: any) {
    console.error('[esimScraper] scrapeEsimplusNumbers error:', err?.message);
    return numCache?.data ?? [];
  } finally {
    await page?.close().catch(() => {});
  }
}

// ── Messages ─────────────────────────────────────────────────────────────────
const msgCache = new Map<string, { data: EsimMessage[]; ts: number }>();
const MSG_TTL  = 60_000;

export interface EsimMessage {
  sender: string;
  body:   string;
  time:   string;
}

export async function scrapeEsimplusMessages(slug: string): Promise<EsimMessage[]> {
  const cached = msgCache.get(slug);
  if (cached && Date.now() - cached.ts < MSG_TTL) return cached.data;

  let page: Page | undefined;
  try {
    page = await openPage(`https://esimplus.me/temporary-numbers/${slug}`);
    await new Promise(r => setTimeout(r, 2000));

    const messages: EsimMessage[] = await page.evaluate(() => {
      const msgs: any[] = [];
      const seen = new Set<string>();
      document.querySelectorAll('div, p, span').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.length < 15 || text.length > 600) return;
        if (seen.has(text)) return;
        if (!/\d{4,8}|verification|code|confirm|password|otp|pin/i.test(text)) return;
        const cls = el.className?.toLowerCase() || '';
        if (/nav|header|footer|button|menu/.test(cls)) return;
        seen.add(text);
        const parent   = el.parentElement;
        const senderEl = parent?.querySelector?.('[class*="sender"],[class*="from"],[class*="number"],[class*="phone"]');
        const timeEl   = parent?.querySelector?.('[class*="time"],[class*="ago"],[class*="date"]');
        msgs.push({
          sender: senderEl?.textContent?.trim() || '',
          body:   text,
          time:   timeEl?.textContent?.trim()   || '',
        });
      });
      return msgs.slice(0, 30);
    });

    msgCache.set(slug, { data: messages, ts: Date.now() });
    return messages;
  } catch (err: any) {
    console.error('[esimScraper] scrapeEsimplusMessages error:', err?.message);
    return [];
  } finally {
    await page?.close().catch(() => {});
  }
}
