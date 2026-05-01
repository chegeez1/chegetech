/**
 * esimScraper.ts (v4)
 * Scrapes receivesms.co — no Cloudflare, plain HTTPS.
 *
 * Fix in v4: explicit gzip/brotli decompression via zlib.
 * Without this, Node.js https.get receives compressed bytes that look like
 * binary garbage — the regex finds nothing even though the page is fine.
 */

import * as https from 'https';
import * as zlib  from 'zlib';

const FETCH_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',   // ask for compression…
};

function fetchHtml(url: string, redirects = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000, headers: FETCH_HEADERS }, (res) => {

      // Follow redirects (Location may be relative or absolute)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        if (redirects > 0) return fetchHtml(next, redirects - 1).then(resolve).catch(reject);
        return reject(new Error('Too many redirects'));
      }
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      // …and decompress it ourselves so the regex sees plain text
      const enc = (res.headers['content-encoding'] || '').toLowerCase();
      let stream: NodeJS.ReadableStream = res;
      if      (enc === 'gzip')    stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (enc === 'br')      stream = res.pipe(zlib.createBrotliDecompress());

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end',  ()             => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const COUNTRY_NAMES: Record<string, string> = {
  at:'Austria', be:'Belgium', br:'Brazil', ca:'Canada', ch:'Switzerland',
  cn:'China', cz:'Czech Republic', de:'Germany', dk:'Denmark', ee:'Estonia',
  es:'Spain', fi:'Finland', fr:'France', gb:'United Kingdom', gr:'Greece',
  hr:'Croatia', hu:'Hungary', id:'Indonesia', ie:'Ireland', il:'Israel',
  'in':'India', it:'Italy', jp:'Japan', kr:'South Korea', lv:'Latvia',
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
    const seen   = new Set<string>();

    // Primary: match href + number in the same card block
    const blockRx = /href="(\/([a-z]{2})-phone-number\/(\d+)\/)"[\s\S]{1,800}?<strong>(\+[\d\s\-().]+)<\/strong>/g;
    let m: RegExpExecArray | null;
    while ((m = blockRx.exec(html)) !== null) {
      const [, , cc, id, raw] = m;
      const digits = raw.replace(/\D/g, '');
      if (seen.has(digits) || digits.length < 8) continue;
      seen.add(digits);
      const country = COUNTRY_NAMES[cc] ?? cc.toUpperCase();
      numbers.push({ number: raw.trim(), country, digits, slug: `${cc}-phone-number/${id}`, source: 'esimplus' });
    }

    // Fallback: just extract all <strong>+…</strong> tags
    if (numbers.length === 0) {
      console.log('[receivesms.co] blockRx matched 0 — trying simpleRx fallback');
      const simpleRx = /<strong>(\+[\d\s\-().]{7,20})<\/strong>/g;
      while ((m = simpleRx.exec(html)) !== null) {
        const raw = m[1]; const digits = raw.replace(/\D/g, '');
        if (seen.has(digits) || digits.length < 8) continue;
        seen.add(digits);
        numbers.push({ number: raw.trim(), country: 'International', digits, slug: digits, source: 'esimplus' });
      }
    }

    console.log(`[receivesms.co] scraped ${numbers.length} numbers (HTML: ${html.length} bytes)`);
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
    const html     = await fetchHtml(`https://receivesms.co/${slug}/`);
    const messages: EsimMessage[] = [];
    const articleRx = /<article[^>]*entry-card[^>]*>([\s\S]*?)<\/article>/g;
    let m: RegExpExecArray | null;
    while ((m = articleRx.exec(html)) !== null) {
      const block   = m[1];
      const senderM = /class="from-link"[^>]*>([^<]+)<\/a>/i.exec(block);
      const bodyM   = /class="sms"[^>]*>([\s\S]*?)<\/div>/i.exec(block);
      const timeM   = /class="muted"[^>]*>([^<]+)<\/span>/i.exec(block);
      if (!bodyM) continue;
      messages.push({
        sender: senderM?.[1]?.trim() ?? '',
        body:   bodyM[1].replace(/<[^>]*>/g, '').replace(/&#\d+;/g, "'").trim(),
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
