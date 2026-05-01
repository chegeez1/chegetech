/**
 * esimScraper.ts (v3)
 * Previously used Puppeteer to bypass Cloudflare on esimplus.me.
 * esimplus.me returns 403 for all non-browser clients — not viable on Render free tier.
 *
 * This version scrapes receivesms.co instead:
 *   - No Cloudflare, no browser, plain HTTPS fetch
 *   - 20-30 international numbers (EU, Asia, Americas)
 *   - Full SMS message parsing (sender, body, time)
 *   - Cached 10 min for numbers, 1 min for messages
 */

import * as https from 'https';

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 18000, headers: FETCH_HEADERS }, (res) => {
      // Follow one redirect (3xx)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk: string) => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const COUNTRY_NAMES: Record<string, string> = {
  at:'Austria', be:'Belgium', br:'Brazil', ca:'Canada', ch:'Switzerland',
  cn:'China', cz:'Czech Republic', de:'Germany', dk:'Denmark', ee:'Estonia',
  es:'Spain', fi:'Finland', fr:'France', gb:'United Kingdom', gr:'Greece',
  hr:'Croatia', hu:'Hungary', id:'Indonesia', ie:'Ireland', il:'Israel',
  in:'India', it:'Italy', jp:'Japan', kr:'South Korea', lv:'Latvia',
  lt:'Lithuania', mx:'Mexico', nl:'Netherlands', no:'Norway', pl:'Poland',
  pt:'Portugal', ro:'Romania', ru:'Russia', se:'Sweden', si:'Slovenia',
  sk:'Slovakia', tr:'Turkey', ua:'Ukraine', us:'United States', za:'South Africa',
};

// ── Number list ──────────────────────────────────────────────────────────────
let numCache: { data: EsimNumber[]; ts: number } | null = null;
const NUM_TTL = 10 * 60_000;

export interface EsimNumber {
  number:  string;
  country: string;
  digits:  string;
  slug:    string;
  source:  string;
}

export async function scrapeEsimplusNumbers(): Promise<EsimNumber[]> {
  if (numCache && Date.now() - numCache.ts < NUM_TTL) return numCache.data;
  try {
    const html = await fetchHtml('https://receivesms.co/active-numbers');
    const numbers: EsimNumber[] = [];
    const seen = new Set<string>();

    // Pattern: href="/cc-phone-number/id/" ... <strong>+number</strong>
    const blockRx = /href="(\/([a-z]{2})-phone-number\/(\d+)\/)"[\s\S]{1,600}?<strong>(\+[\d\s\-().]+)<\/strong>/g;
    let m: RegExpExecArray | null;
    while ((m = blockRx.exec(html)) !== null) {
      const [, href, cc, id, raw] = m;
      const digits = raw.replace(/\D/g, '');
      if (seen.has(digits) || digits.length < 8) continue;
      seen.add(digits);
      const country = COUNTRY_NAMES[cc] ?? cc.toUpperCase();
      numbers.push({ number: raw.trim(), country, digits, slug: `${cc}-phone-number/${id}`, source: 'esimplus' });
    }

    // Fallback: simpler extraction if block regex fails
    if (numbers.length === 0) {
      const numRx = /<strong>(\+[\d\s\-().]{7,20})<\/strong>/g;
      while ((m = numRx.exec(html)) !== null) {
        const raw = m[1]; const digits = raw.replace(/\D/g, '');
        if (seen.has(digits) || digits.length < 8) continue;
        seen.add(digits);
        numbers.push({ number: raw.trim(), country: 'International', digits, slug: digits, source: 'esimplus' });
      }
    }

    console.log(`[receivesms.co] scraped ${numbers.length} numbers`);
    numCache = { data: numbers, ts: Date.now() };
    return numbers;
  } catch (err: any) {
    console.error('[receivesms.co] scrapeEsimplusNumbers error:', err.message);
    return numCache?.data ?? [];
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
  try {
    const html = await fetchHtml(`https://receivesms.co/${slug}/`);
    const messages: EsimMessage[] = [];

    // Each SMS is in <article class="entry-card">
    const articleRx = /<article[^>]*entry-card[^>]*>([\s\S]*?)<\/article>/g;
    let m: RegExpExecArray | null;
    while ((m = articleRx.exec(html)) !== null) {
      const block = m[1];
      const senderM  = /class="from-link"[^>]*>([^<]+)<\/a>/i.exec(block);
      const bodyM    = /class="sms"[^>]*>([\s\S]*?)<\/div>/i.exec(block);
      const timeM    = /class="muted"[^>]*>([^<]+)<\/span>/i.exec(block);
      if (!bodyM) continue;
      messages.push({
        sender: senderM?.[1]?.trim() ?? '',
        body:   bodyM[1].replace(/<[^>]*>/g, '').replace(/&#0*39;/g, "'").trim(),
        time:   timeM?.[1]?.trim() ?? '',
      });
    }

    console.log(`[receivesms.co] messages for ${slug}: ${messages.length}`);
    msgCache.set(slug, { data: messages, ts: Date.now() });
    return messages;
  } catch (err: any) {
    console.error('[receivesms.co] scrapeEsimplusMessages error:', err.message);
    return [];
  }
}
