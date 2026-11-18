import Papa from 'papaparse';
import { detectDateOrder, parseDate } from './dates';
import type { Transaction } from './types';

export interface ColumnMap {
  date: number;
  description: number;
  amount?: number;
  debit?: number;
  credit?: number;
}

export interface ParseResult {
  transactions: Transaction[];
  columns: ColumnMap;
  headers: string[];
  rowsRead: number;
  rowsSkipped: number;
  /** true when the single amount column used negative numbers for spending */
  flippedSign: boolean;
  warnings: string[];
}

const DATE_HINT = /(^|\b)(date|posted|posting|trans(action)?\s*date|booking)/i;
const DESC_HINT = /(description|merchant|payee|name|details|memo|narrative|particulars|reference|transaction$)/i;
const AMOUNT_HINT = /^(amount|amt|transaction amount|value|amount \(.*\))$/i;
const DEBIT_HINT = /(debit|withdrawal|withdrawals|money out|paid out|outflow|charge)/i;
const CREDIT_HINT = /(credit|deposit|deposits|money in|paid in|inflow|payment)/i;

/** "$1,234.56", "(12.00)", "-12", "12.00 DR", "€12,50" → number */
export function parseAmount(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/\s?dr$/i.test(s)) { neg = true; s = s.replace(/\s?dr$/i, ''); }
  s = s.replace(/\s?cr$/i, '');
  s = s.replace(/[^\d.,\-+]/g, '');
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  s = s.replace(/^\+/, '');
  // European "1.234,56" or "12,50"
  if (/,\d{2}$/.test(s) && !/\.\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!s || isNaN(Number(s))) return null;
  const n = Number(s);
  return neg ? -n : n;
}

function score(values: string[], test: (v: string) => boolean): number {
  const filled = values.filter((v) => v && v.trim());
  if (!filled.length) return 0;
  return filled.filter(test).length / filled.length;
}

/** Find columns by header name first, then by what the data looks like. */
export function detectColumns(headers: string[], rows: string[][]): ColumnMap | null {
  const col = (i: number) => rows.slice(0, 200).map((r) => r[i] ?? '');
  const idx = headers.map((_, i) => i);

  const dateScores = idx.map((i) => score(col(i), (v) => parseDate(v) !== null));
  let date = idx.find((i) => DATE_HINT.test(headers[i]) && dateScores[i] > 0.8);
  if (date === undefined) date = idx.filter((i) => dateScores[i] > 0.8).sort((a, b) => dateScores[b] - dateScores[a])[0];
  if (date === undefined) return null;

  const numScores = idx.map((i) => score(col(i), (v) => parseAmount(v) !== null));
  let amount = idx.find((i) => i !== date && AMOUNT_HINT.test(headers[i].trim()));
  const debit = idx.find((i) => i !== date && DEBIT_HINT.test(headers[i]) && numScores[i] > 0);
  const credit = idx.find((i) => i !== date && i !== debit && CREDIT_HINT.test(headers[i]) && !DEBIT_HINT.test(headers[i]));
  if (amount === undefined && debit === undefined) {
    amount = idx.filter((i) => i !== date && numScores[i] > 0.9 && !/balance/i.test(headers[i]))[0];
  }

  const textScore = (i: number) => {
    const vs = col(i).filter(Boolean);
    if (!vs.length) return 0;
    const letters = vs.filter((v) => /[a-z]{3,}/i.test(v)).length / vs.length;
    const variety = new Set(vs).size / vs.length;
    return letters * (0.5 + variety);
  };
  const used = new Set([date, amount, debit, credit]);
  let description = idx.find((i) => !used.has(i) && DESC_HINT.test(headers[i]) && textScore(i) > 0.3);
  if (description === undefined) description = idx.filter((i) => !used.has(i)).sort((a, b) => textScore(b) - textScore(a))[0];
  if (description === undefined || (amount === undefined && debit === undefined)) return null;

  return { date, description, amount, debit, credit };
}

/** Some banks put account info above the real header row. Find the first row that looks like a header. */
function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i];
    if (r.length >= 3 && r.some((c) => DATE_HINT.test(c)) && r.some((c) => /amount|debit|withdraw/i.test(c))) return i;
  }
  return 0;
}

export function parseCsv(text: string): ParseResult {
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: 'greedy' });
  const all = parsed.data.filter((r) => r.some((c) => c.trim()));
  const warnings: string[] = [];
  if (all.length < 2) throw new Error('That file has no rows. Export your statement as CSV and try again.');

  let headerRow = findHeaderRow(all);
  let headers = all[headerRow].map((h) => h.trim());
  let body = all.slice(headerRow + 1);
  // Headerless file: first row is already data.
  if (parseDate(headers[0]) !== null || headers.some((h) => parseDate(h) !== null)) {
    headers = headers.map((_, i) => `Column ${i + 1}`);
    body = all.slice(headerRow);
    headerRow = -1;
  }

  const columns = detectColumns(headers, body);
  if (!columns) {
    throw new Error("Couldn't find date, description and amount columns. Make sure the CSV has a header row with those fields.");
  }

  const order = detectDateOrder(body.slice(0, 300).map((r) => r[columns.date] ?? ''));
  let raw: { day: number; description: string; signed: number }[] = [];
  let skipped = 0;
  for (const r of body) {
    const day = parseDate(r[columns.date] ?? '', order);
    const description = (r[columns.description] ?? '').trim();
    let signed: number | null;
    if (columns.amount !== undefined) {
      signed = parseAmount(r[columns.amount]);
    } else {
      const d = parseAmount(r[columns.debit!]);
      const c = columns.credit !== undefined ? parseAmount(r[columns.credit]) : null;
      signed = d ? -Math.abs(d) : c ? Math.abs(c) : null;
    }
    if (day === null || signed === null || !description) { skipped++; continue; }
    raw.push({ day, description, signed });
  }

  // Bank exports use negatives for spending; credit card exports use positives. Majority wins.
  let flippedSign = false;
  if (columns.amount !== undefined) {
    const negatives = raw.filter((t) => t.signed < 0).length;
    flippedSign = negatives >= raw.length / 2;
  } else {
    flippedSign = true; // debit column was stored as negative above
  }
  const transactions: Transaction[] = raw
    .map((t) => ({ day: t.day, description: t.description, amount: flippedSign ? -t.signed : t.signed }))
    .filter((t) => t.amount > 0)
    .map((t) => ({ ...t, amount: Math.round(t.amount * 100) / 100 }))
    .sort((a, b) => a.day - b.day);

  if (skipped > 0) warnings.push(`Skipped ${skipped} row${skipped === 1 ? '' : 's'} with a missing date or amount.`);
  if (!transactions.length) throw new Error('Found no outgoing payments in that file.');
  raw = [];
  return { transactions, columns, headers, rowsRead: body.length, rowsSkipped: skipped, flippedSign, warnings };
}
