const MS_PER_DAY = 86_400_000;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function toDay(y: number, m: number, d: number): number | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const t = Date.UTC(y, m - 1, d);
  const check = new Date(t);
  if (check.getUTCMonth() !== m - 1) return null; // e.g. Feb 30
  return Math.round(t / MS_PER_DAY);
}

export function dayToDate(day: number): Date {
  return new Date(day * MS_PER_DAY);
}

export function formatDay(day: number, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }): string {
  return dayToDate(day).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

export function isoDay(day: number): string {
  return dayToDate(day).toISOString().slice(0, 10);
}

export type DateOrder = 'mdy' | 'dmy';

/**
 * Parses the date formats banks actually export:
 * 2026-01-05, 2026/01/05, 01/05/2026, 05/01/2026 (dmy), 1/5/26, Jan 5 2026, 5 Jan 2026, 05-Jan-2026, 20260105.
 */
export function parseDate(raw: string, order: DateOrder = 'mdy'): number | null {
  const s = raw.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (!s) return null;
  let m: RegExpMatchArray | null;

  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return toDay(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return toDay(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    let y = +m[3];
    if (y < 100) y += 2000;
    const [a, b] = [+m[1], +m[2]];
    return order === 'dmy' ? toDay(y, b, a) : toDay(y, a, b);
  }
  if ((m = s.match(/^([a-z]{3})[a-z]*\.? (\d{1,2}) (\d{4})/))) {
    const mi = MONTHS.indexOf(m[1]);
    return mi < 0 ? null : toDay(+m[3], mi + 1, +m[2]);
  }
  if ((m = s.match(/^(\d{1,2})[ -]([a-z]{3})[a-z]*\.?[ -](\d{2,4})/))) {
    const mi = MONTHS.indexOf(m[2]);
    let y = +m[3];
    if (y < 100) y += 2000;
    return mi < 0 ? null : toDay(y, mi + 1, +m[1]);
  }
  return null;
}

/** If any value has a first number > 12 in a d/d/y date, the file is day-first. */
export function detectDateOrder(samples: string[]): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const s of samples) {
    const m = s.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    if (+m[2] > 12) mdy++;
  }
  return dmy > mdy ? 'dmy' : 'mdy';
}
