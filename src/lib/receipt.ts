import type { Subscription } from './types';
import { formatDay } from './dates';
import { usd, usd0 } from './format';

export interface ReceiptData {
  subs: Subscription[];
  asOf: number;
  hourlyWage: number;
  invested: number;
  years: number;
}

/** Draws the subscription receipt onto a canvas for PNG export. Mirrors the on-page <Receipt>. */
export async function renderReceiptPng(data: ReceiptData): Promise<string> {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts API unavailable: system mono is fine */
  }
  const active = data.subs.filter((s) => s.active).sort((a, b) => b.monthly - a.monthly);
  const W = 420;
  const scale = 3;
  const lineH = 22;
  const H = 380 + active.length * lineH;
  const c = document.createElement('canvas');
  c.width = W * scale;
  c.height = H * scale;
  const g = c.getContext('2d')!;
  g.scale(scale, scale);

  g.fillStyle = '#FBFBF8';
  g.fillRect(0, 0, W, H);
  // Torn bottom edge
  g.fillStyle = '#E8E9EC';
  for (let x = 0; x < W; x += 12) {
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x + 6, H - 6);
    g.lineTo(x + 12, H);
    g.fill();
  }

  const mono = (size: number, weight = 400) => `${weight} ${size}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  const ink = '#14161B';
  g.fillStyle = ink;
  let y = 44;
  const center = (t: string, font: string) => {
    g.font = font;
    g.fillText(t, (W - g.measureText(t).width) / 2, y);
  };
  const row = (l: string, r: string, font = mono(13)) => {
    g.font = font;
    g.fillText(l.length > 30 ? l.slice(0, 29) + '…' : l, 28, y);
    g.fillText(r, W - 28 - g.measureText(r).width, y);
  };
  const rule = () => {
    g.font = mono(13);
    g.fillText('-'.repeat(46), 28, y);
  };

  center('snip', mono(26, 700));
  y += 22;
  center('SUBSCRIPTION AUDIT', mono(12, 500));
  y += 18;
  center(formatDay(data.asOf, { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase(), mono(12));
  y += 24;
  rule();
  y += 22;
  row('ITEM', 'PER MONTH', mono(12, 600));
  y += lineH;
  for (const s of active) {
    row(s.name.toUpperCase(), usd(s.monthly));
    y += lineH;
  }
  rule();
  y += 24;
  const monthly = active.reduce((a, s) => a + s.monthly, 0);
  row(`SUBTOTAL (${active.length} ITEMS)`, usd(monthly));
  y += lineH;
  // Highlighter mark behind the total
  g.fillStyle = '#FFE14D';
  g.fillRect(22, y - 16, W - 44, 22);
  g.fillStyle = ink;
  row('TOTAL PER YEAR', usd(monthly * 12), mono(15, 700));
  y += lineH + 4;
  row('HOURS OF WORK', `${Math.round((monthly * 12) / data.hourlyWage)} H @ ${usd(data.hourlyWage)}`);
  y += lineH;
  row(`IF INVESTED ${data.years} YRS @7%`, usd0(data.invested));
  y += 30;

  // Barcode (deterministic from the total, so the same audit always prints the same code)
  let x = 60;
  let seed = Math.round(monthly * 100);
  while (x < W - 60) {
    seed = (seed * 9301 + 49297) % 233280;
    const w = 1 + (seed % 3);
    g.fillRect(x, y, w, 40);
    x += w + 1 + ((seed >> 3) % 3);
  }
  y += 62;
  center('THANK YOU FOR YOUR', mono(12));
  y += 16;
  center('RECURRING BUSINESS', mono(12));
  y += 22;
  g.fillStyle = '#5D6472';
  center('made with snip · runs in your browser', mono(10));
  return c.toDataURL('image/png');
}
