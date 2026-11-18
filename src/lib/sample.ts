import { toDay, dayToDate } from './dates';

/** Deterministic PRNG so the demo statement is identical on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Row { day: number; description: string; amount: number }

export const SAMPLE_START = toDay(2024, 11, 16)!;
export const SAMPLE_END = toDay(2026, 11, 15)!;

function monthlyOn(dom: number, from: number, to: number): number[] {
  const out: number[] = [];
  const d0 = dayToDate(from);
  for (let y = d0.getUTCFullYear(), m = d0.getUTCMonth(); ; m++) {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const day = Math.round(Date.UTC(y, m, Math.min(dom, last)) / 86_400_000);
    if (day > to) break;
    if (day >= from) out.push(day);
  }
  return out;
}

/**
 * Two years of a plausible student/early-career chequing account:
 * planted subscriptions (with a price hike, a double charge, a converted trial,
 * cancelled services, biweekly gym billing and annual renewals) buried in everyday noise.
 */
export function generateSampleCsv(): string {
  const rand = mulberry32(20261118);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const jitter = () => (rand() < 0.25 ? Math.round(rand() * 2) : 0); // weekend posting delays
  const rows: Row[] = [];
  const S = SAMPLE_START;
  const E = SAMPLE_END;
  const add = (day: number, description: string, amount: number) => {
    if (day >= S && day <= E) rows.push({ day, description, amount: -Math.round(amount * 100) / 100 });
  };

  // --- Subscriptions -------------------------------------------------------
  const hike = toDay(2026, 1, 12)!;
  for (const d of monthlyOn(12, S, E)) add(d + jitter(), 'NETFLIX.COM 866-579-7172 CA', d < hike ? 15.49 : 17.99);
  for (const d of monthlyOn(3, S, E)) add(d + jitter(), 'Spotify P2C9A1B3F4', 11.99);
  add(toDay(2026, 8, 4)!, 'Spotify P2D0E7K2L9', 11.99); // double charge
  for (const d of monthlyOn(21, toDay(2025, 6, 1)!, E)) add(d + jitter(), 'DISNEY PLUS 888-905-7888', 13.99);
  for (const d of monthlyOn(27, S, E)) add(d + jitter(), 'GOOGLE *YouTubePremium g.co/helppay#', 13.99);
  for (const d of monthlyOn(9, toDay(2025, 3, 1)!, E)) add(d + jitter(), 'OPENAI *CHATGPT SUBSCR OPENAI.COM CA', 20.0);
  for (const d of monthlyOn(17, toDay(2025, 10, 1)!, E)) add(d + jitter(), 'CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM CA', 20.0);
  for (const d of monthlyOn(1, S, E)) add(d + jitter(), 'APPLE.COM/BILL 866-712-7753 ON', 2.99);
  for (const d of monthlyOn(5, toDay(2025, 9, 1)!, E)) add(d + jitter(), 'UBER   *ONE MEMBERSHIP', 9.99);
  const phoneHike = toDay(2026, 6, 15)!;
  for (const d of monthlyOn(15, S, E)) add(d, 'ROGERS ******4471', d < phoneHike ? 65.0 : 72.0);
  for (let d = toDay(2024, 11, 22)!; d <= E; d += 14) add(d, 'GOODLIFE FITNESS #0231', 24.99);
  add(toDay(2024, 12, 2)!, 'Amazon Prime*RT4KQ2LL0', 99.0);
  add(toDay(2025, 12, 2)!, 'Amazon Prime*BM8WX1ZZ3', 99.0);
  add(toDay(2025, 1, 20)!, 'DUOLINGO APPLE.COM/BILL', 84.99);
  add(toDay(2026, 1, 20)!, 'DUOLINGO APPLE.COM/BILL', 84.99);
  // Trial that quietly converted
  add(toDay(2026, 3, 8)!, 'Audible*1A2B3C4D5', 0.99);
  for (const d of monthlyOn(8, toDay(2026, 4, 1)!, E)) add(d + jitter(), 'Audible*' + Math.floor(rand() * 1e9).toString(36).toUpperCase(), 14.95);
  // Cancelled ones
  for (const d of monthlyOn(24, S, toDay(2025, 4, 30)!)) add(d, 'HULU 877-8244858 CA', 9.99);
  for (const d of monthlyOn(11, toDay(2025, 1, 1)!, toDay(2025, 8, 30)!)) add(d, 'PELOTON* MEMBERSHIP', 12.99);

  // --- Everyday noise ------------------------------------------------------
  const coffee = ['SQ *PILOT COFFEE ROASTERS', 'TIM HORTONS #2214', 'STARBUCKS STORE 04412', 'SQ *SAM JAMES COFFEE BAR'];
  const food = ['DOORDASH*MCDONALDS', 'UBER   *EATS PENDING', 'CHIPOTLE 2891', 'PIZZA PIZZA #118', 'SQ *BANH MI BOYS', 'A&W #1043', 'FRESHII 0221'];
  const grocery = ['LOBLAWS #1012', 'METRO 664', 'NO FRILLS 3109', 'COSTCO WHOLESALE W533'];
  const shops = ['AMZN Mktp CA*', 'SHOPPERS DRUG MART #0841', 'UNIQLO TORONTO EATON', 'INDIGO BOOKS 0042', 'BEST BUY #957', 'WINNERS 0412'];
  const transit = ['PRESTO FARE/T6K2', 'UBER   *TRIP', 'LYFT   *RIDE THU 8PM'];

  for (let d = S; d <= E; d++) {
    const dow = dayToDate(d).getUTCDay();
    if (rand() < 0.55) add(d, pick(coffee), 3.5 + rand() * 4);
    if (rand() < 0.22) add(d, pick(food), 11 + rand() * 24);
    if (rand() < 0.35) add(d, pick(transit), 3.3 + rand() * (rand() < 0.3 ? 25 : 2));
    if (rand() < 0.08) add(d, pick(shops) + (rand() * 1e9).toString(36).slice(0, 6).toUpperCase(), 9 + rand() * 90);
    // Regular weekly grocery run: regular timing, irregular amount. Must NOT be flagged.
    if (dow === 6) add(d, 'LOBLAWS #1012', 38 + rand() * 70);
    else if (rand() < 0.06) add(d, pick(grocery), 8 + rand() * 40);
    if (rand() < 0.03) add(d, 'ESSO CIRCLE K 4412', 30 + rand() * 30);
  }
  // Income
  for (let d = toDay(2024, 11, 22)!; d <= E; d += 14) rows.push({ day: d, description: 'PAYROLL DEPOSIT - CAFE ROSA', amount: 612 + Math.round(rand() * 180) });
  for (const d of monthlyOn(1, S, E)) rows.push({ day: d, description: 'E-TRANSFER RECEIVED', amount: 150 });

  rows.sort((a, b) => a.day - b.day);
  let balance = 1840.22;
  const lines = ['Date,Description,Amount,Balance'];
  for (const r of rows) {
    balance += r.amount;
    const dt = dayToDate(r.day);
    const date = `${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${String(dt.getUTCDate()).padStart(2, '0')}/${dt.getUTCFullYear()}`;
    const desc = r.description.includes(',') ? `"${r.description}"` : r.description;
    lines.push(`${date},${desc},${r.amount.toFixed(2)},${balance.toFixed(2)}`);
  }
  return lines.join('\n');
}
