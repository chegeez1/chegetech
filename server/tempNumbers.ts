import axios from 'axios';

const CACHE_TTL = 50_000;

export interface TempNumber {
  number: string;
  country: string;
  digits: string;
  source: string;
}

export interface SmsMessage {
  sender: string;
  time: string;
  body: string;
}

let numbersCache: { data: TempNumber[]; ts: number } | null = null;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' };

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
}
function allMatches(html: string, re: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = []; let m;
  while ((m = re.exec(html))) results.push(m);
  return results;
}

// ── sms-online.co — CONFIRMED WORKING ────────────────────────────────────────
// HTML structure confirmed:
//   <h4 class="number-boxes-item-number">+1 201-857-7757</h4>
//   <h5 class="number-boxes-item-country">United States</h5>
//   <a href="https://sms-online.co/receive-free-sms/12018577757" ...>Open</a>
async function scrapeSmsonline(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://sms-online.co/receive-free-sms', { headers: HEADERS, timeout: 14000 });
  const numbers: TempNumber[] = [];
  const numRe = /<h4 class="number-boxes-item-number">([^<]+)<\/h4>\s*<h5 class="number-boxes-item-country">([^<]+)<\/h5>\s*<a href="https:\/\/sms-online\.co\/receive-free-sms\/(\d+)"/gi;
  for (const m of allMatches(html, numRe)) {
    const display = m[1].trim();
    const country = m[2].trim();
    const digits = m[3].trim();
    numbers.push({ number: display, country, digits, source: 'sms-online' });
  }
  // Fallback: get digits from href pattern if above misses
  if (numbers.length === 0) {
    const hrefRe = /href="https:\/\/sms-online\.co\/receive-free-sms\/(\d{8,15})"/gi;
    for (const m of allMatches(html, hrefRe)) {
      const digits = m[1];
      numbers.push({ number: '+' + digits, country: 'Unknown', digits, source: 'sms-online' });
    }
  }
  return numbers;
}

async function scrapeSmsonlineMessages(digits: string): Promise<SmsMessage[]> {
  const { data: html } = await axios.get(`https://sms-online.co/receive-free-sms/${digits}`, { headers: HEADERS, timeout: 14000 });
  const msgs: SmsMessage[] = [];
  // Table rows with sender, message, time
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  for (const rowM of allMatches(html, rowRe)) {
    const cells = allMatches(rowM[1], cellRe).map(c => stripHtml(c[1]));
    if (cells.length >= 3 && cells[0] && cells[0] !== 'Sender' && cells[0] !== 'From') {
      msgs.push({ sender: cells[0], body: cells[1] || '', time: cells[2] || '' });
    }
  }
  return msgs;
}

// ── Additional scrapers (graceful fallback if blocked) ─────────────────────
async function tryReceiveSmss(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://receive-smss.com/', { headers: HEADERS, timeout: 12000 });
  const nums: TempNumber[] = [];
  const re = /href="\/sms\/(\+?(\d{8,15}))\/"[^>]*>[\s\S]{0,500}?<h4[^>]*>([^<]+)<\/h4>[\s\S]{0,200}?<h5[^>]*>([^<]+)<\/h5>/gi;
  for (const m of allMatches(html, re)) {
    nums.push({ number: m[3].trim(), country: m[4].trim(), digits: m[2], source: 'rscc' });
  }
  // Fallback: just links
  if (nums.length === 0) {
    const linkRe = /href="\/sms\/\+?(\d{8,15})\/"/gi;
    for (const m of allMatches(html, linkRe)) {
      nums.push({ number: '+' + m[1], country: 'USA', digits: m[1], source: 'rscc' });
    }
  }
  return nums.slice(0, 20);
}

async function tryReceiveSmssMessages(digits: string): Promise<SmsMessage[]> {
  const { data: html } = await axios.get(`https://receive-smss.com/sms/${digits}/`, { headers: HEADERS, timeout: 12000 });
  const msgs: SmsMessage[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  for (const rowM of allMatches(html, rowRe)) {
    const cells = allMatches(rowM[1], cellRe).map(c => stripHtml(c[1]));
    if (cells.length >= 3 && cells[0] && cells[0] !== 'Sender') {
      msgs.push({ sender: cells[0], body: cells[1] || '', time: cells[2] || '' });
    }
  }
  return msgs;
}

async function tryReceiveSmsCc(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://receive-sms.cc/', { headers: HEADERS, timeout: 12000 });
  const nums: TempNumber[] = [];
  const re = /href="\/((\d{8,15}))\/"[^>]*>[\s\S]{0,400}?<\/a>/gi;
  for (const m of allMatches(html, re)) {
    nums.push({ number: '+' + m[2], country: 'USA', digits: m[2], source: 'rscc2' });
  }
  return nums.slice(0, 20);
}

async function tryReceiveSmsCcMessages(digits: string): Promise<SmsMessage[]> {
  const { data: html } = await axios.get(`https://receive-sms.cc/${digits}/`, { headers: HEADERS, timeout: 12000 });
  const msgs: SmsMessage[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  for (const rowM of allMatches(html, rowRe)) {
    const cells = allMatches(rowM[1], cellRe).map(c => stripHtml(c[1]));
    if (cells.length >= 3 && cells[0] && cells[0] !== 'From') {
      msgs.push({ sender: cells[0], body: cells[1] || '', time: cells[2] || '' });
    }
  }
  return msgs;
}

// ── Aggregator ─────────────────────────────────────────────────────────────
export async function getFreeNumbers(): Promise<TempNumber[]> {
  if (numbersCache && Date.now() - numbersCache.ts < CACHE_TTL) return numbersCache.data;

  const results = await Promise.allSettled([
    scrapeSmsonline(),
    tryReceiveSmss(),
    tryReceiveSmsCc(),
  ]);

  const seen = new Set<string>();
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

export async function getNumberMessages(digits: string, source: string): Promise<SmsMessage[]> {
  try {
    switch (source) {
      case 'sms-online': return await scrapeSmsonlineMessages(digits);
      case 'rscc':       return await tryReceiveSmssMessages(digits);
      case 'rscc2':      return await tryReceiveSmsCcMessages(digits);
      default:           return await scrapeSmsonlineMessages(digits);
    }
  } catch { return []; }
}
