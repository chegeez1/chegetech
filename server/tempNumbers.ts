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
const HTML_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();
}
function between(s: string, a: string, b: string): string {
  const i = s.indexOf(a); if (i < 0) return '';
  const j = s.indexOf(b, i + a.length); if (j < 0) return '';
  return s.slice(i + a.length, j);
}
function allBetween(s: string, a: string, b: string): string[] {
  const res: string[] = []; let pos = 0;
  while (true) { const i = s.indexOf(a, pos); if (i < 0) break; const j = s.indexOf(b, i + a.length); if (j < 0) break; res.push(s.slice(i + a.length, j)); pos = j + b.length; }
  return res;
}

// ── esimplus.me (PRIMARY) ─────────────────────────────────────────────────────
// esimplus.me lists free numbers at /free-phone-number and per-country pages
async function scrapeEsimplus(): Promise<TempNumber[]> {
  const numbers: TempNumber[] = [];
  const seen = new Set<string>();

  // Fetch the main free numbers listing page
  const { data: html } = await axios.get('https://esimplus.me/free-phone-number', {
    headers: HTML_HEADERS, timeout: 14000,
  });

  // esimplus.me renders number cards — links like /free-phone-number/+15551234567
  // Also try: href="/receive-sms/..." patterns
  const patterns = [
    /href="\/free-phone-number\/([+\d]{8,16})"/gi,
    /href="\/receive-sms\/([+\d]{8,16})"/gi,
    /"phoneNumber"\s*:\s*"([+\d]{8,16})"/gi,
    /"number"\s*:\s*"([+\d]{8,16})"/gi,
    /\+(\d{10,14})/g,
  ];

  // Try JSON data embedded in page (Next.js __NEXT_DATA__ pattern)
  const nextData = between(html, '__NEXT_DATA__" type="application/json">', '</script>');
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData);
      const str = JSON.stringify(parsed);
      const numRe = /"(\+\d{10,14})"/g; let m;
      const countryRe = /"country(?:Name|Code)?"\s*:\s*"([^"]+)"/g;
      const countries: string[] = []; let cm;
      while ((cm = countryRe.exec(str))) countries.push(cm[1]);
      let ci = 0;
      while ((m = numRe.exec(str))) {
        const num = m[1]; const digits = num.replace('+','');
        if (!seen.has(digits) && digits.length >= 9) {
          seen.add(digits);
          numbers.push({ number: num, country: countries[ci] || 'USA', digits, source: 'esimplus' });
          ci++;
        }
      }
    } catch {}
  }

  // Fallback: regex on raw HTML
  if (numbers.length < 5) {
    for (const pattern of patterns.slice(0, 3)) {
      let m;
      while ((m = pattern.exec(html))) {
        const raw = m[1]; const digits = raw.replace('+','');
        if (digits.length < 9 || seen.has(digits)) continue;
        seen.add(digits);
        const num = raw.startsWith('+') ? raw : '+' + raw;
        numbers.push({ number: num, country: 'USA', digits, source: 'esimplus' });
      }
    }
  }

  // Try country-specific pages for more numbers
  if (numbers.length < 10) {
    const countryPages = [
      { slug: 'united-states', country: 'United States' },
      { slug: 'united-kingdom', country: 'United Kingdom' },
      { slug: 'canada', country: 'Canada' },
      { slug: 'sweden', country: 'Sweden' },
      { slug: 'netherlands', country: 'Netherlands' },
    ];
    await Promise.allSettled(countryPages.map(async ({ slug, country }) => {
      try {
        const { data: cHtml } = await axios.get(`https://esimplus.me/free-phone-number/${slug}`, {
          headers: HTML_HEADERS, timeout: 10000,
        });
        const re = /href="\/free-phone-number\/([+\d]{8,16})"/gi; let m;
        while ((m = re.exec(cHtml))) {
          const raw = m[1]; const digits = raw.replace('+','');
          if (seen.has(digits) || digits.length < 9) continue;
          seen.add(digits);
          const num = raw.startsWith('+') ? raw : '+' + raw;
          numbers.push({ number: num, country, digits, source: 'esimplus' });
        }
        // Also try JSON in country page
        const nd = between(cHtml, '__NEXT_DATA__" type="application/json">', '</script>');
        if (nd) {
          const numRe = /"(\+\d{10,14})"/g; let nm;
          const parsed = JSON.parse(nd); const str = JSON.stringify(parsed);
          while ((nm = numRe.exec(str))) {
            const num = nm[1]; const digits = num.replace('+','');
            if (!seen.has(digits)) { seen.add(digits); numbers.push({ number: num, country, digits, source: 'esimplus' }); }
          }
        }
      } catch {}
    }));
  }

  return numbers.slice(0, 30);
}

async function scrapeEsimplusMessages(digits: string): Promise<SmsMessage[]> {
  const num = '+' + digits;
  const urls = [
    `https://esimplus.me/free-phone-number/${num}`,
    `https://esimplus.me/receive-sms/${num}`,
  ];

  for (const url of urls) {
    try {
      const { data: html } = await axios.get(url, { headers: HTML_HEADERS, timeout: 12000 });
      const msgs: SmsMessage[] = [];

      // Try __NEXT_DATA__ JSON first
      const nextData = between(html, '__NEXT_DATA__" type="application/json">', '</script>');
      if (nextData) {
        const parsed = JSON.parse(nextData);
        const str = JSON.stringify(parsed);
        // Look for messages array
        const msgsSection = between(str, '"messages":[', ']');
        if (msgsSection) {
          const items = msgsSection.split('},{');
          for (const item of items) {
            const sender = between(item, '"sender":"', '"') || between(item, '"from":"', '"') || between(item, '"senderNumber":"', '"');
            const body = between(item, '"text":"', '"') || between(item, '"body":"', '"') || between(item, '"message":"', '"');
            const time = between(item, '"receivedAt":"', '"') || between(item, '"createdAt":"', '"') || between(item, '"time":"', '"');
            if (sender && body) msgs.push({ sender, time: time?.slice(0, 16).replace('T', ' ') || '', body });
          }
        }
      }

      // Fallback: HTML table rows
      if (msgs.length === 0) {
        const rows = allBetween(html, '<tr', '</tr>');
        for (const row of rows) {
          const cells = allBetween(row, '<td', '</td>').map(c => stripTags(c));
          if (cells.length >= 2) {
            const [sender, body, time] = cells;
            if (sender && body && sender !== 'Sender' && body.length > 1) {
              msgs.push({ sender: sender.trim(), time: time?.trim() || '', body: body.trim() });
            }
          }
        }
      }

      if (msgs.length > 0) return msgs;
    } catch {}
  }
  return [];
}

// ── receive-smss.com ──────────────────────────────────────────────────────────
async function scrapeReceiveSmss(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://receive-smss.com/', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  const linkRe = /href="\/sms\/(\+?[\d]{7,15})\/"/gi;
  const countryRe = /<h5[^>]*>(.*?)<\/h5>/gi;
  const links: string[] = []; let m;
  while ((m = linkRe.exec(html))) links.push(m[1]);
  const countries: string[] = []; let cm;
  while ((cm = countryRe.exec(html))) countries.push(stripTags(cm[1]));
  links.forEach((digits, i) => {
    const d = digits.replace('+','');
    numbers.push({ number: '+' + d, country: countries[i] || 'United States', digits: d, source: 'rscc' });
  });
  return numbers.slice(0, 20);
}

async function scrapeReceiveSmssMessages(digits: string): Promise<SmsMessage[]> {
  const { data: html } = await axios.get(`https://receive-smss.com/sms/${digits}/`, { headers: HTML_HEADERS, timeout: 12000 });
  const msgs: SmsMessage[] = [];
  const rows = allBetween(html, '<tr', '</tr>');
  for (const row of rows) {
    const cells = allBetween(row, '<td', '</td>').map(c => stripTags(c));
    if (cells.length >= 3) {
      const [sender, body, time] = cells;
      if (sender && body && body.length > 1 && sender !== 'Sender') msgs.push({ sender: sender.trim(), time: time?.trim() || '', body: body.trim() });
    }
  }
  return msgs;
}

// ── sms-online.co ─────────────────────────────────────────────────────────────
async function scrapeSmsonline(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://sms-online.co/receive-free-sms', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  const re = /href="\/receive-free-sms\/(\d{7,15})"[^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html))) {
    const digits = m[1]; const inner = m[2];
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
      if (sender && body && sender !== 'From' && body.length > 1) msgs.push({ sender: sender.trim(), time: time?.trim() || '', body: body.trim() });
    }
  }
  return msgs;
}

// ── receivesmsonline.net ──────────────────────────────────────────────────────
async function scrapeRsoi(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://receivesmsonline.net/', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  const re = /href="\/([+\d]{7,16})"[^>]*>([\s\S]{0,300}?)<\/a>/gi; let m;
  while ((m = re.exec(html))) {
    const raw = m[1]; const inner = m[2];
    if (!raw.match(/^\+?\d{7,}$/)) continue;
    const digits = raw.replace('+','');
    const country = stripTags(between(inner, 'alt="', '"') || '').trim() || 'Europe';
    numbers.push({ number: '+' + digits, country, digits, source: 'rsoi' });
  }
  return numbers.slice(0, 20);
}

async function scrapeRsoiMessages(digits: string): Promise<SmsMessage[]> {
  const { data: html } = await axios.get(`https://receivesmsonline.net/+${digits}`, { headers: HTML_HEADERS, timeout: 12000 });
  const msgs: SmsMessage[] = [];
  const rows = allBetween(html, '<tr', '</tr>');
  for (const row of rows) {
    const cells = allBetween(row, '<td', '</td>').map(c => stripTags(c));
    if (cells.length >= 3) {
      const [sender, body, time] = cells;
      if (sender && body && sender !== 'Sender' && body.length > 1) msgs.push({ sender: sender.trim(), time: time?.trim() || '', body: body.trim() });
    }
  }
  return msgs;
}

// ── receive-sms.cc ────────────────────────────────────────────────────────────
async function scrapeReceiveSmsCc(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://receive-sms.cc/', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  const re = /href="\/(\d{7,15})\/"[^>]*>([\s\S]{0,400}?)<\/a>/gi; let m;
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
      if (sender && body && sender !== 'From' && body.length > 1) msgs.push({ sender: sender.trim(), time: time?.trim() || '', body: body.trim() });
    }
  }
  return msgs;
}

// ── quackr.io ─────────────────────────────────────────────────────────────────
async function scrapeQuackr(): Promise<TempNumber[]> {
  const { data: html } = await axios.get('https://quackr.io/temporary-numbers', { headers: HTML_HEADERS, timeout: 12000 });
  const numbers: TempNumber[] = [];
  const re = /href="\/temporary-numbers\/([+\d]{7,16})"[^>]*>([\s\S]{0,300}?)<\/a>/gi; let m;
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
      if (sender && body && sender !== 'Sender' && body.length > 1) msgs.push({ sender, time, body });
    }
  }
  return msgs;
}

// ── Aggregator ────────────────────────────────────────────────────────────────
export async function getFreeNumbers(): Promise<TempNumber[]> {
  if (numbersCache && Date.now() - numbersCache.ts < CACHE_TTL) return numbersCache.data;

  // esimplus first (primary), then others in parallel
  const [esimplusResult, ...otherResults] = await Promise.allSettled([
    scrapeEsimplus(),
    scrapeReceiveSmss(),
    scrapeSmsonline(),
    scrapeRsoi(),
    scrapeReceiveSmsCc(),
    scrapeQuackr(),
  ]);

  const seen = new Set<string>();
  const numbers: TempNumber[] = [];

  // esimplus numbers come first
  if (esimplusResult.status === 'fulfilled') {
    for (const n of esimplusResult.value) {
      if (!seen.has(n.digits)) { seen.add(n.digits); numbers.push(n); }
    }
  }

  // Then fill from other sources
  for (const r of otherResults) {
    if (r.status === 'fulfilled') {
      for (const n of r.value) {
        if (!seen.has(n.digits)) { seen.add(n.digits); numbers.push(n); }
      }
    }
  }

  numbersCache = { data: numbers, ts: Date.now() };
  return numbers;
}

export async function getNumberMessages(digits: string, source: string): Promise<SmsMessage[]> {
  try {
    switch (source) {
      case 'esimplus':   return await scrapeEsimplusMessages(digits);
      case 'rscc':       return await scrapeReceiveSmssMessages(digits);
      case 'sms-online': return await scrapeSmsonlineMessages(digits);
      case 'rsoi':       return await scrapeRsoiMessages(digits);
      case 'rscc2':      return await scrapeReceiveSmsCcMessages(digits);
      case 'quackr':     return await scrapeQuackrMessages(digits);
      default:           return await scrapeEsimplusMessages(digits);
    }
  } catch { return []; }
}
