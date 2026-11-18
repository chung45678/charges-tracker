import type { Category } from './types';

/** Payment-processor and bank noise that sits in front of the real merchant name. */
const PREFIXES = [
  /^(pos|ach|debit|credit)\s+(card\s+)?(purchase|payment|debit|withdrawal)?\s*/,
  /^purchase\s+(authorized\s+on\s+[\d/]+\s*)?/,
  /^recurring\s+(payment|charge|debit)?\s*/,
  /^checkcard\s+\d*\s*/,
  /^visa\s+(debit\s+)?/,
  /^card\s+\d+\s*/,
  /^(sq|tst|sp|pp|py|ppl|paypal|in|dd|bt)\s?\*\s*/,
  /^paypal\s+/,
  /^google\s?\*\s*/,
  /^apl\*\s*/,
  /^www\./,
];

interface Known {
  match: RegExp;
  name: string;
  category: Category;
}

/** Common merchants so that NETFLIX.COM 866-579-7172 CA and Netflix Inc collapse into one series. */
export const KNOWN: Known[] = [
  { match: /netflix/, name: 'Netflix', category: 'Video' },
  { match: /disney\s?(plus|\+)|disneyplus/, name: 'Disney+', category: 'Video' },
  { match: /hulu/, name: 'Hulu', category: 'Video' },
  { match: /\bmax\b|hbo\s?max/, name: 'Max', category: 'Video' },
  { match: /paramount/, name: 'Paramount+', category: 'Video' },
  { match: /crunchyroll/, name: 'Crunchyroll', category: 'Video' },
  { match: /youtube|yt\s?premium/, name: 'YouTube Premium', category: 'Video' },
  { match: /prime\s?video|amzn\s?prime|amazon\s?prime|prime\s?membership/, name: 'Amazon Prime', category: 'Shopping' },
  { match: /spotify/, name: 'Spotify', category: 'Music & Audio' },
  { match: /apple\s?music/, name: 'Apple Music', category: 'Music & Audio' },
  { match: /audible/, name: 'Audible', category: 'Books & News' },
  { match: /tidal/, name: 'Tidal', category: 'Music & Audio' },
  { match: /dropbox/, name: 'Dropbox', category: 'Cloud & Storage' },
  { match: /google\s?(one|storage)/, name: 'Google One', category: 'Cloud & Storage' },
  { match: /openai|chatgpt/, name: 'ChatGPT Plus', category: 'Software & AI' },
  { match: /claude\.ai|anthropic/, name: 'Claude Pro', category: 'Software & AI' },
  { match: /notion/, name: 'Notion', category: 'Software & AI' },
  { match: /adobe/, name: 'Adobe', category: 'Software & AI' },
  { match: /canva/, name: 'Canva', category: 'Software & AI' },
  { match: /github/, name: 'GitHub', category: 'Software & AI' },
  { match: /microsoft|msft|office\s?365/, name: 'Microsoft 365', category: 'Software & AI' },
  { match: /figma/, name: 'Figma', category: 'Software & AI' },
  { match: /duolingo/, name: 'Duolingo', category: 'Learning' },
  { match: /grammarly/, name: 'Grammarly', category: 'Software & AI' },
  { match: /coursera|masterclass|brilliant|skillshare|quizlet|chegg/, name: '', category: 'Learning' },
  { match: /planet\s?fit|goodlife|la\s?fitness|equinox|anytime\s?fitness|\bgym\b/, name: '', category: 'Fitness' },
  { match: /peloton|strava|classpass|myfitnesspal/, name: '', category: 'Fitness' },
  { match: /nyt|new\s?york\s?times|wsj|economist|substack|medium\.com|globe\s?and\s?mail/, name: '', category: 'Books & News' },
  { match: /xbox|playstation|psn|nintendo|steam|game\s?pass/, name: '', category: 'Gaming' },
  { match: /uber\s*\*?\s*one/, name: 'Uber One', category: 'Food & Delivery' },
  { match: /dashpass/, name: 'DashPass', category: 'Food & Delivery' },
  { match: /doordash|skip\s?the|instacart|hellofresh/, name: '', category: 'Food & Delivery' },
  { match: /rogers|bell\s|telus|fido|koodo|verizon|at&t|t-mobile|comcast|xfinity|freedom\s?mobile|virgin\s?plus/, name: '', category: 'Phone & Internet' },
  { match: /insurance|geico|state\s?farm|allstate|lemonade|intact|desjardins/, name: '', category: 'Insurance' },
  // Generic Apple billing goes last so app-specific descriptors (DUOLINGO APPLE.COM/BILL) win.
  { match: /icloud|apple\.com\/bill|apple\s?services/, name: 'Apple iCloud', category: 'Cloud & Storage' },
];

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length <= 3 && /^[a-z]+$/.test(w) && ['of', 'and', 'the'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Reduce a raw bank descriptor to a stable merchant key.
 * "SQ *BLUE BOTTLE COFFEE #0423 SAN FRANCISCO CA" → "blue bottle coffee"
 */
export function merchantKey(description: string): string {
  let s = description.toLowerCase();
  for (const p of PREFIXES) s = s.replace(p, '');
  // AMZN Mktp US*2K3JF4 → amzn mktp us
  s = s.replace(/\*[a-z0-9]{4,}\b/g, ' ');
  s = s.replace(/\*/g, ' ');
  s = s.replace(/https?:\/\//g, '');
  s = s.replace(/\.(com|net|io|ai|co|ca|tv)\b(\/\S*)?/g, ' ');
  s = s.replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, ' '); // embedded dates
  s = s.replace(/[#]?\b[a-z]*\d[\w-]*\b/g, ' '); // store numbers, refs, phone numbers
  s = s.replace(/[^a-z&+' ]/g, ' ');
  s = s.replace(/\b(inc|llc|ltd|corp|co|us|usa|ca|on|ny|bc|qc|ab|tx|wa|payment|subscription|monthly|recurring|bill|online|digital|services?)\b/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  const words = s.split(' ').filter(Boolean).slice(0, 3);
  return words.join(' ') || description.toLowerCase().trim();
}

export function identify(description: string): { key: string; name: string; category: Category } {
  const lower = description.toLowerCase();
  const key = merchantKey(description);
  for (const k of KNOWN) {
    if (k.match.test(lower) || k.match.test(key)) {
      const name = k.name || titleCase(key);
      return { key: k.name ? k.name.toLowerCase() : key, name, category: k.category };
    }
  }
  return { key, name: titleCase(key), category: 'Other' };
}
