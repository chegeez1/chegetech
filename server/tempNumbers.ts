import axios from 'axios';

const CACHE_TTL = 50_000; // 50 seconds

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
const HTML_HEADERS = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' };

function stripTags(s: string) { return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').trim(); }
function between(s: string, a: string, b: string): string { const i = s.indexOf(a); if (i < 0) return ''; const j = s.indexOf(b, i + a.length); if (j < 0) return ''; return s.slice(i + a.length, j); }
function allBetween(s: string, a: string, b: string): string[] { const res: string[] = []; let pos = 0; while (true) { const i = s.indexOf(a, pos); if (i < 0) break; const j = s.indexOf(b, i + a.length); if (j < 0) break; res.push(s.slice(i + a.length, j)); pos = j + b.length; } return res; }

// ── receive-smss.com ─────────────────────────────────────────────────────────
async function scrapeReceiveSmss(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://receive-smss.com/', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  // Links like href="/sms/+15551234567/"
  const linkRe = /href="\/sms\/(\+?[\d]{7,15})\/"/gi;
  const countryRe = /<h5[^>]*>(.*?)<\/h5>/gi;
  const links: string[] = []; let m;
  while ((m = linkRe.exec(html))) links.push(m[1]);
  const countries: string[] = []; let cm;
  while ((cm = countryRe.exec(html))) countries.push(stripTags(cm[1]));
  links.forEach((digits, i) => {
    const num = digits.startsWith('+') ? digits : '+' + digits;
    numbers.push({ number: num, country: countries[i] || 'United States', digits: digits.replace('+',''), source: 'rscc' });
  });
  return numbers.slice(0, 20);
}

async function scrapeReceiveSmssMessages(digits: string): Promise<SmsMessage[]> {
  const url = `https://receive-smss.com/sms/${digits}/`;
  const { data: html } = await axios.get(url, { headers: HTML_HEADERS, timeout: 12000 });
  const msgs: SmsMessage[] = [];
  // Table rows: <tr>...<td>SENDER</td><td>MSG</td><td>TIME</td>...
  const rows = allBetween(html, '<tr', '</tr>');
  for (const row of rows) {
    const cells = allBetween(row, '<td', '</td>').map(c => stripTags(between(c, '>', '') || c));
    if (cells.length >= 3) {
      const sender = cells[0].trim();
      const body = cells[1].trim();
      const time = cells[2].trim();
      if (sender && body && body.length > 1 && sender !== 'Sender') {
        msgs.push({ sender, time, body });
      }
    }
  }
  return msgs;
}

// ── sms-online.co ────────────────────────────────────────────────────────────
async function scrapeSmsonline(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://sms-online.co/receive-free-sms', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  const re = /href="\/receive-free-sms\/(\d{7,15})"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const digits = m[1];
    const inner = m[2];
    const country = stripTags(between(inner, 'alt="', '"') || between(inner, '<span', '</span>') || '');
    numbers.push({ number: '+' + digits, country: country || 'USA', digits, source: 'sms-online' });
  }
  return numbers.slice(0, 20);
}

async function scrapeSmsonlineMessages(digits: string): Promise<SmsMessage[]> {
  const { data: html } = await axios.get(`https://sms-online.co/receive-free-sms/${digits}`, { headers: HTML_HEADERS, timeout: 12000 });
  const msgs: SmsMessage[] = [];
  const rows = allBetween(html, '<tr', '</tr>');
  for (const row of rows) {
    const cells = allBetween(row, '<td', '</td>').map(c => stripTags(c));
    if (cells.length >= 3) {
      const [sender, body, time] = cells;
      if (sender && body && sender !== 'From' && body.length > 1) {
        msgs.push({ sender: sender.trim(), time: time?.trim() || '', body: body.trim() });
      }
    }
  }
  return msgs;
}

// ── receivesmsonline.net ──────────────────────────────────────────────────────
async function scrapeRsoi(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://receivesmsonline.net/', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  const re = /href="\/([+\d]{7,16})"[^>]*>([\s\S]{0,300}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1]; const inner = m[2];
    if (!raw.match(/^\+?\d{7,}$/)) continue;
    const digits = raw.replace('+','');
    const num = raw.startsWith('+') ? raw : '+' + raw;
    const country = stripTags(between(inner, 'alt="', '"') || '').trim() || 'Europe';
    numbers.push({ number: num, country, digits, source: 'rsoi' });
  }
  return numbers.slice(0, 20);
}

async function scrapeRsoiMessages(digits: string): Promise<SmsMessage[]> {
  const url = `https://receivesmsonline.net/+${digits}`;
  const { data: html } = await axios.get(url, { headers: HTML_HEADERS, timeout: 12000 });
  const msgs: SmsMessage[] = [];
  const rows = allBetween(html, '<tr', '</tr>');
  for (const row of rows) {
    const cells = allBetween(row, '<td', '</td>').map(c => stripTags(c));
    if (cells.length >= 3) {
      const [sender, body, time] = cells;
      if (sender && body && sender !== 'Sender' && body.length > 1) {
        msgs.push({ sender: sender.trim(), time: time?.trim() || '', body: body.trim() });
      }
    }
  }
  return msgs;
}

// ── receive-sms.cc ────────────────────────────────────────────────────────────
async function scrapeReceiveSmsCc(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://receive-sms.cc/', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  const re = /href="\/(\d{7,15})\/"[^>]*>([\s\S]{0,400}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const digits = m[1]; const inner = m[2];
    const country = stripTags(between(inner, 'alt="', '"') || between(inner, '<p', '</p>') || '').trim() || 'USA';
    numbers.push({ number: '+' + digits, country, digits, source: 'rscc2' });
  }
  return numbers.slice(0, 20);
}

async function scrapeReceiveSmsCcMessages(digits: string): Promise<SmsMessage[]> {
  const { data: html } = await axios.get(`https://receive-sms.cc/${digits}/`, { headers: HTML_HEADERS, timeout: 12000 });
  const msgs: SmsMessage[] = [];
  const rows = allBetween(html, '<tr', '</tr>');
  for (const row of rows) {
    const cells = allBetween(row, '<td', '</td>').map(c => stripTags(c));
    if (cells.length >= 3) {
      const [sender, body, time] = cells;
      if (sender && body && sender !== 'From' && body.length > 1) {
        msgs.push({ sender: sender.trim(), time: time?.trim() || '', body: body.trim() });
      }
    }
  }
  return msgs;
}

// ── quackr.io ─────────────────────────────────────────────────────────────────
async function scrapeQuackr(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://quackr.io/temporary-numbers', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  const re = /href="\/temporary-numbers\/([+\d]{7,16})"[^>]*>([\s\S]{0,300}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1]; const inner = m[2];
    const digits = raw.replace('+','');
    const num = raw.startsWith('+') ? raw : '+' + raw;
    const country = stripTags(between(inner, 'alt="', '"') || between(inner, '<p', '</p>') || '').trim() || 'Unknown';
    numbers.push({ number: num, country, digits, source: 'quackr' });
  }
  return numbers.slice(0, 15);
}

async function scrapeQuackrMessages(digits: string): Promise<SmsMessage[]> {
  const { data: html } = await axios.get(`https://quackr.io/temporary-numbers/+${digits}`, { headers: HTML_HEADERS, timeout: 12000 });
  const msgs: SmsMessage[] = [];
  const rows = allBetween(html, '<tr', '</tr>');
  for (const row of rows) {
    const cells = allBetween(row, '<td', '</td>').map(c => stripTags(c));
    if (cells.length >= 2) {
      const sender = cells[0]?.trim(); const body = cells[1]?.trim(); const time = cells[2]?.trim() || '';
      if (sender && body && sender !== 'Sender' && body.length > 1) {
        msgs.push({ sender, time, body });
      }
    }
  }
  return msgs;
}

// ── temporary-phone-number.com ────────────────────────────────────────────────
async function scrapeTempPhone(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://temporary-phone-number.com/', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  const re = /href="\/(\d{7,15})\/"[^>]*>([\s\S]{0,300}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const digits = m[1]; const inner = m[2];
    if (digits.length < 7) continue;
    const country = stripTags(between(inner, 'alt="', '"') || '').trim() || 'USA';
    numbers.push({ number: '+' + digits, country, digits, source: 'tmpph' });
  }
  return numbers.slice(0, 15);
}

async function scrapeTempPhoneMessages(digits: string): Promise<SmsMessage[]> {
  const { data: html } = await axios.get(`https://temporary-phone-number.com/${digits}/`, { headers: HTML_HEADERS, timeout: 12000 });
  const msgs: SmsMessage[] = [];
  const rows = allBetween(html, '<tr', '</tr>');
  for (const row of rows) {
    const cells = allBetween(row, '<td', '</td>').map(c => stripTags(c));
    if (cells.length >= 3) {
      const [sender, body, time] = cells;
      if (sender && body && sender !== 'From' && body.length > 1) {
        msgs.push({ sender: sender.trim(), time: time?.trim() || '', body: body.trim() });
      }
    }
  }
  return msgs;
}

// ── Aggregator ────────────────────────────────────────────────────────────────
export async function getFreeNumbers(): Promise<TempNumber[]> {
  if (numbersCache && Date.now() - numbersCache.ts < CACHE_TTL) {
    return numbersCache.data;
  }

  const results = await Promise.allSettled([
    scrapeReceiveSmss(),
    scrapeSmsonline(),
    scrapeRsoi(),
    scrapeReceiveSmsCc(),
    scrapeQuackr(),
    scrapeTempPhone(),
  ]);

  const seen = new Set<string>();
  const numbers: TempNumber[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const n of r.value) {
        if (!seen.has(n.digits)) {
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
      case 'rscc':    return await scrapeReceiveSmssMessages(digits);
      case 'sms-online': return await scrapeSmsonlineMessages(digits);
      case 'rsoi':    return await scrapeRsoiMessages(digits);
      case 'rscc2':   return await scrapeReceiveSmsCcMessages(digits);
      case 'quackr':  return await scrapeQuackrMessages(digits);
      case 'tmpph':   return await scrapeTempPhoneMessages(digits);
      default:        return await scrapeReceiveSmssMessages(digits);
    }
  } catch {
    return [];
  }
}
