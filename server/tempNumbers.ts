import axios from 'axios';

const CACHE_TTL = 60_000; // 1 minute

export interface TempNumber {
  number: string;
  country: string;
  digits: string;
  source: string;
  slug: string;  // for message page URL construction
}

export interface SmsMessage {
  sender: string;
  time: string;
  body: string;
}

let numbersCache: { data: TempNumber[]; ts: number } | null = null;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

function allMatches(html: string, re: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) results.push(m);
  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// SOURCE 1: sms-online.co  (confirmed working — numbers in static HTML)
// Number structure:
//   <h4 class="number-boxes-item-number">+1 201-857-7757</h4>
//   <h5 class="number-boxes-item-country">United States</h5>
//   <a href="https://sms-online.co/receive-free-sms/12018577757" ...>Open</a>
// ────────────────────────────────────────────────────────────────────────────
async function scrapeSmsonline(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://sms-online.co/receive-free-sms', { headers: HEADERS, timeout: 14000 });
  const numbers: TempNumber[] = [];
  // Primary pattern: full block per number
  const re = /<h4 class="number-boxes-item-number">([^<]+)<\/h4>\s*<h5 class="number-boxes-item-country">([^<]+)<\/h5>\s*<a href="https:\/\/sms-online\.co\/receive-free-sms\/(\d+)"/gi;
  for (const m of allMatches(html, re)) {
    const display = m[1].trim();
    const country = m[2].trim();
    const digits  = m[3].trim();
    numbers.push({ number: display, country, digits, source: 'sms-online', slug: digits });
  }
  // Fallback: href only
  if (numbers.length === 0) {
    const linkRe = /href="https:\/\/sms-online\.co\/receive-free-sms\/(\d{8,15})"/gi;
    for (const m of allMatches(html, linkRe)) {
      const d = m[1];
      numbers.push({ number: '+' + d, country: 'Unknown', digits: d, source: 'sms-online', slug: d });
    }
  }
  return numbers;
}

async function scrapeSmsonlineMessages(digits: string): Promise<SmsMessage[]> {
  // sms-online.co messages are in a table on the number's detail page
  const { data: html } = await axios.get(
    `https://sms-online.co/receive-free-sms/${digits}`,
    { headers: HEADERS, timeout: 14000 }
  );
  const msgs: SmsMessage[] = [];
  const rowRe  = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  for (const rowM of allMatches(html, rowRe)) {
    const cells = allMatches(rowM[1], cellRe).map(c => stripHtml(c[1]));
    if (cells.length >= 3 && cells[0] && !['Sender','From','sender','from'].includes(cells[0])) {
      msgs.push({ sender: cells[0], body: cells[1] || '', time: cells[2] || '' });
    }
  }
  return msgs;
}

// ────────────────────────────────────────────────────────────────────────────
// SOURCE 2: receive-sms-online.info  (confirmed working)
// Number structure:
//   <a href="46731299509-Sweden" class="block text-2xl ...">+46731299509</a>
// Message API (JSON):
//   GET /get_sms_register.php?phone=<digits>
//   Header: X-Alt-Data: <unix_timestamp_seconds>
//   Response: [{"mesaje_id":N,"telefon":"sender","mesaj":"body","data":"datetime","telefon_id":"..."}]
// ────────────────────────────────────────────────────────────────────────────
async function scrapeRSOI(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://receive-sms-online.info/', { headers: HEADERS, timeout: 14000 });
  const numbers: TempNumber[] = [];
  // Pattern: href="46731299509-Sweden" then +46731299509 inside the <a>
  const re = /href="(\d{8,15})-([A-Za-z]+)"[^>]*>\s*\+(\d{8,15})/gi;
  for (const m of allMatches(html, re)) {
    const digits  = m[1];
    const country = m[2].replace(/([A-Z])/g, ' $1').trim(); // "UnitedStates" → "United States"
    const num     = '+' + m[3];
    numbers.push({ number: num, country, digits, source: 'rsoi', slug: `${digits}-${m[2]}` });
  }
  // Fallback: just grab href slugs
  if (numbers.length === 0) {
    const linkRe = /href="(\d{8,15})-([A-Za-z]+)"/gi;
    for (const m of allMatches(html, linkRe)) {
      numbers.push({ number: '+' + m[1], country: m[2], digits: m[1], source: 'rsoi', slug: `${m[1]}-${m[2]}` });
    }
  }
  return numbers;
}

async function scrapeRSOIMessages(digits: string): Promise<SmsMessage[]> {
  const n = Math.round(Date.now() / 1000).toString();
  const { data } = await axios.get(
    `https://receive-sms-online.info/get_sms_register.php?phone=${digits}`,
    {
      headers: {
        ...HEADERS,
        'X-Alt-Data': n,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://receive-sms-online.info/`,
      },
      timeout: 12000,
    }
  );
  const arr: Array<{ telefon: string; mesaj: string; data: string }> = typeof data === 'string' ? JSON.parse(data) : data;
  return arr
    .filter(m => m.telefon !== 'xxx' && m.mesaj !== 'no result')
    .map(m => ({ sender: m.telefon, body: m.mesaj || '(protected — sign in to view)', time: m.data }));
}

// ────────────────────────────────────────────────────────────────────────────
// SOURCE 3: sms-receive.net  (confirmed working)
// Same URL scheme as receive-sms-online.info (likely same backend)
// Number structure:
//   <a href="447403504888-UnitedKingdom" ...>
//     United Kingdom
//     +447403504888
//   </a>
// Message API: GET /get_sms_register.php?phone=<digits>  (X-Alt-Data: unix_ts)
// ────────────────────────────────────────────────────────────────────────────
async function scrapeSmsReceiveNet(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://sms-receive.net/', { headers: HEADERS, timeout: 14000 });
  const numbers: TempNumber[] = [];
  const re = /href="(\d{8,15})-([A-Za-z]+)"[\s\S]{0,600}?\+(\d{8,15})/gi;
  for (const m of allMatches(html, re)) {
    const digits  = m[1];
    const country = m[2].replace(/([A-Z])/g, ' $1').trim();
    const num     = '+' + m[3];
    if (!numbers.find(n => n.digits === digits)) {
      numbers.push({ number: num, country, digits, source: 'sms-receive', slug: `${digits}-${m[2]}` });
    }
  }
  // Fallback
  if (numbers.length === 0) {
    const linkRe = /href="(\d{8,15})-([A-Za-z]+)"/gi;
    for (const m of allMatches(html, linkRe)) {
      if (!numbers.find(n => n.digits === m[1])) {
        numbers.push({ number: '+' + m[1], country: m[2], digits: m[1], source: 'sms-receive', slug: `${m[1]}-${m[2]}` });
      }
    }
  }
  return numbers;
}

async function scrapeSmsReceiveNetMessages(digits: string, slug: string): Promise<SmsMessage[]> {
  const n = Math.round(Date.now() / 1000).toString();
  const { data } = await axios.get(
    `https://sms-receive.net/get_sms_register.php?phone=${digits}`,
    {
      headers: {
        ...HEADERS,
        'X-Alt-Data': n,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://sms-receive.net/${slug}`,
      },
      timeout: 12000,
    }
  );
  const arr: Array<{ telefon: string; mesaj: string; data: string }> = typeof data === 'string' ? JSON.parse(data) : data;
  return arr
    .filter(m => m.mesaj && m.mesaj !== '####')
    .map(m => ({ sender: m.telefon, body: m.mesaj, time: m.data }))
    .concat(
      arr
        .filter(m => m.mesaj === '####')
        .map(m => ({ sender: m.telefon, body: '(protected — sign in to view)', time: m.data }))
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Aggregator
// ────────────────────────────────────────────────────────────────────────────
export async function getFreeNumbers(): Promise<TempNumber[]> {
  if (numbersCache && Date.now() - numbersCache.ts < CACHE_TTL) return numbersCache.data;

  // Import esimplus scraper lazily (puppeteer loads slowly)
  const { scrapeEsimplusNumbers } = await import('./esimScraper.js');

  const results = await Promise.allSettled([
    scrapeEsimplusNumbers(),
    scrapeSmsonline(),
    scrapeRSOI(),
    scrapeSmsReceiveNet(),
  ]);

  const seen    = new Set<string>();
  const numbers: TempNumber[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const n of r.value) {
        if (n.digits && !seen.has(n.digits)) {
          seen.add(n.digits);
          numbers.push(n);
        }
      }
    }
  }

  numbersCache = { data: numbers, ts: Date.now() };
  return numbers;
}

export async function getNumberMessages(digits: string, source: string, slug?: string): Promise<SmsMessage[]> {
  try {
    if (source === 'esimplus') {
      const { scrapeEsimplusMessages } = await import('./esimScraper.js');
      return await scrapeEsimplusMessages(slug ?? digits);
    }
    switch (source) {
      case 'sms-online':   return await scrapeSmsonlineMessages(digits);
      case 'rsoi':         return await scrapeRSOIMessages(digits);
      case 'sms-receive':  return await scrapeSmsReceiveNetMessages(digits, slug ?? digits);
      default:             return await scrapeSmsonlineMessages(digits);
    }
  } catch (err) {
    return [];
  }
}
