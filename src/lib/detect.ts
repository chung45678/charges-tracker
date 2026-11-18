import { identify } from './merchants';
import type { Cadence, Category, PriceChange, Subscription, Transaction } from './types';

export const AVG_MONTH = 30.4375;

interface CadenceSpec {
  cadence: Cadence;
  days: number;
  tolerance: number; // allowed drift per interval, in days
  minCharges: number;
}

/** Banks post on weekends/holidays late and months vary 28–31 days, so each cadence gets a drift window. */
export const CADENCES: CadenceSpec[] = [
  { cadence: 'weekly', days: 7, tolerance: 1.5, minCharges: 4 },
  { cadence: 'biweekly', days: 14, tolerance: 2.5, minCharges: 3 },
  { cadence: 'monthly', days: AVG_MONTH, tolerance: 4, minCharges: 3 },
  { cadence: 'quarterly', days: 91.3, tolerance: 8, minCharges: 2 },
  { cadence: 'yearly', days: 365.25, tolerance: 12, minCharges: 2 },
];

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Split a merchant's charges into amount clusters, so one Apple descriptor carrying
 * both a $2.99 iCloud plan and a $10.99 Music plan becomes two series.
 * Clusters chain neighbours within 30%, so a $15.49 → $17.99 price hike stays in one series.
 */
export function clusterByAmount(txs: Transaction[]): Transaction[][] {
  const sorted = [...txs].sort((a, b) => a.amount - b.amount);
  const clusters: Transaction[][] = [];
  for (const t of sorted) {
    const last = clusters[clusters.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && t.amount <= prev.amount * 1.3 + 0.5) last.push(t);
    else clusters.push([t]);
  }
  return clusters.map((c) => c.sort((a, b) => a.day - b.day));
}

/** Charges that land within 3 days of each other for the same amount: likely double-billed. */
function splitDuplicates(txs: Transaction[], periodDays: number): { series: Transaction[]; duplicates: Transaction[][] } {
  if (periodDays < 20) return { series: txs, duplicates: [] };
  const series: Transaction[] = [];
  const duplicates: Transaction[][] = [];
  for (const t of txs) {
    const prev = series[series.length - 1];
    if (prev && t.day - prev.day <= 3 && Math.abs(t.amount - prev.amount) < 0.01) {
      const group = duplicates.find((g) => g[0] === prev);
      if (group) group.push(t);
      else duplicates.push([prev, t]);
    } else series.push(t);
  }
  return { series, duplicates };
}

export interface SeriesFit {
  spec: CadenceSpec;
  intervalScore: number;
  amountScore: number;
  confidence: number;
}

/** How well does this sorted series match a fixed cadence? Missed months (2x interval) count as half a hit. */
export function fitCadence(txs: Transaction[]): SeriesFit | null {
  if (txs.length < 2) return null;
  const gaps = txs.slice(1).map((t, i) => t.day - txs[i].day);
  const g = median(gaps);
  const spec = CADENCES.find((c) => Math.abs(g - c.days) <= c.tolerance * 1.5);
  if (!spec || txs.length < spec.minCharges) return null;

  let hits = 0;
  for (const gap of gaps) {
    const k = Math.max(1, Math.round(gap / spec.days));
    const drift = Math.abs(gap - k * spec.days);
    if (drift <= spec.tolerance * Math.sqrt(k)) hits += k === 1 ? 1 : 0.5;
  }
  const intervalScore = hits / gaps.length;

  const amounts = txs.map((t) => t.amount);
  const med = median(amounts);
  const mad = median(amounts.map((a) => Math.abs(a - med)));
  const amountScore = med > 0 ? Math.max(0, 1 - mad / med) : 0;

  const volume = Math.min(1, txs.length / (spec.days > 60 ? 2 : 6));
  const confidence = 0.55 * intervalScore + 0.3 * amountScore + 0.15 * volume;
  return { spec, intervalScore, amountScore, confidence };
}

/**
 * Step changes in price that stuck for the following charge. Compared against the last
 * *settled* price, so a one-month blip ($10, $12, $10) is ignored.
 */
export function findPriceChanges(txs: Transaction[]): PriceChange[] {
  const out: PriceChange[] = [];
  if (!txs.length) return out;
  let settled = txs[0].amount;
  for (let i = 1; i < txs.length; i++) {
    const now = txs[i].amount;
    const next = txs[i + 1]?.amount;
    const changed = Math.abs(now - settled) >= 0.5 && Math.abs(now - settled) / settled >= 0.03;
    const stuck = next === undefined || Math.abs(next - now) < 0.01;
    if (changed && stuck) {
      out.push({ day: txs[i].day, from: settled, to: now });
      settled = now;
    }
  }
  return out;
}

export interface DetectOptions {
  /** Last day covered by the statement. Defaults to the latest transaction. */
  asOf?: number;
  minConfidence?: number;
}

export function detectSubscriptions(transactions: Transaction[], opts: DetectOptions = {}): Subscription[] {
  const asOf = opts.asOf ?? Math.max(...transactions.map((t) => t.day));
  const minConfidence = opts.minConfidence ?? 0.72;

  const groups = new Map<string, { name: string; category: Category; txs: Transaction[] }>();
  for (const t of transactions) {
    const id = identify(t.description);
    const g = groups.get(id.key) ?? { name: id.name, category: id.category, txs: [] };
    g.txs.push(t);
    groups.set(id.key, g);
  }

  const subs: Subscription[] = [];
  for (const [key, group] of groups) {
    const clusters = clusterByAmount(group.txs);
    clusters.forEach((cluster, ci) => {
      if (cluster.length < 2) return;
      // Detect cadence on the de-duplicated series, then re-attach duplicates as findings.
      const rough = fitCadence(cluster);
      const periodGuess = rough?.spec.days ?? AVG_MONTH;
      const { series, duplicates } = splitDuplicates(cluster, periodGuess);
      const fit = fitCadence(series);
      if (!fit || fit.confidence < minConfidence || fit.intervalScore < 0.6) return;
      // Real subscriptions are fixed-price. A weekly grocery run is regular but its amount wanders.
      const minAmountScore = fit.spec.days < 20 ? 0.92 : 0.75;
      if (fit.amountScore < minAmountScore) return;
      // Two charges a year apart is weak evidence. Demand a near-identical price, and a merchant
      // that isn't mostly one-off purchases (two Amazon orders 12 months apart are not a subscription).
      if (series.length === 2) {
        const [a, b] = series.map((t) => t.amount);
        if (Math.abs(a - b) / Math.max(a, b) > 0.01) return;
        if (group.txs.length > series.length * 2) return;
      }

      const { spec } = fit;
      // A small charge from the same merchant one period before the series started = trial that converted.
      const seriesMedian = median(series.map((t) => t.amount));
      const trial = group.txs.find(
        (t) =>
          t.amount < seriesMedian * 0.25 &&
          t.day < series[0].day &&
          series[0].day - t.day <= spec.days + spec.tolerance * 2,
      );
      const last = series[series.length - 1];
      const nextDay = Math.round(last.day + spec.days);
      const active = asOf - last.day <= spec.days + spec.tolerance * 2;
      const trialConverted = Boolean(trial);
      const amount = last.amount;
      const monthly = amount * (AVG_MONTH / spec.days);
      const multi = clusters.filter((c) => c.length >= 2).length > 1;

      subs.push({
        id: `${key}#${ci}`,
        name: multi ? `${group.name} (${formatPlain(amount)})` : group.name,
        category: group.category,
        cadence: spec.cadence,
        periodDays: spec.days,
        amount,
        monthly,
        yearly: monthly * 12,
        charges: [...(trial ? [trial] : []), ...series, ...duplicates.flatMap((d) => d.slice(1))].sort((a, b) => a.day - b.day),
        firstDay: trial?.day ?? series[0].day,
        lastDay: last.day,
        nextDay,
        active,
        confidence: fit.confidence,
        priceChanges: findPriceChanges(series),
        duplicates,
        trialConverted,
      });
    });
  }
  return subs.sort((a, b) => Number(b.active) - Number(a.active) || b.yearly - a.yearly);
}

function formatPlain(n: number): string {
  return `$${n.toFixed(2)}`;
}

export interface Insight {
  kind: 'price-hike' | 'duplicate' | 'overlap' | 'trial' | 'stopped' | 'annual-soon';
  severity: 'high' | 'medium' | 'info';
  title: string;
  detail: string;
  /** Money involved per year (or once, for refunds), used to sort insights. */
  value: number;
  subIds: string[];
}

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function buildInsights(subs: Subscription[], asOf: number): Insight[] {
  const out: Insight[] = [];
  const active = subs.filter((s) => s.active);

  for (const s of active) {
    for (const p of s.priceChanges) {
      if (p.to <= p.from) continue;
      const yearlyDelta = (p.to - p.from) * (365.25 / s.periodDays);
      const pct = Math.round(((p.to - p.from) / p.from) * 100);
      out.push({
        kind: 'price-hike',
        severity: 'high',
        title: `${s.name} raised its price ${pct}%`,
        detail: `${money(p.from)} → ${money(p.to)}. That's ${money(yearlyDelta)} more per year, and nobody asked you.`,
        value: yearlyDelta,
        subIds: [s.id],
      });
    }
  }
  for (const s of subs) {
    for (const d of s.duplicates) {
      const extra = d.slice(1).reduce((a, t) => a + t.amount, 0);
      out.push({
        kind: 'duplicate',
        severity: 'high',
        title: `Possible double charge from ${s.name}`,
        detail: `${d.length} charges of ${money(d[0].amount)} within ${d[d.length - 1].day - d[0].day + 1} days. Worth a refund request for ${money(extra)}.`,
        value: extra,
        subIds: [s.id],
      });
    }
  }
  const byCat = new Map<Category, Subscription[]>();
  for (const s of active) {
    if (s.category === 'Other' || s.category === 'Phone & Internet' || s.category === 'Insurance') continue;
    byCat.set(s.category, [...(byCat.get(s.category) ?? []), s]);
  }
  for (const [cat, list] of byCat) {
    if (list.length < 2) continue;
    const yearly = list.reduce((a, s) => a + s.yearly, 0);
    const cheapest = [...list].sort((a, b) => a.yearly - b.yearly)[0];
    out.push({
      kind: 'overlap',
      severity: 'medium',
      title: `${list.length} ${cat} subscriptions running at once`,
      detail: `${list.map((s) => s.name).join(', ')} cost ${money(yearly)}/yr together. Keeping just one (e.g. ${cheapest.name}) saves ${money(yearly - cheapest.yearly)}/yr.`,
      value: yearly - cheapest.yearly,
      subIds: list.map((s) => s.id),
    });
  }
  for (const s of active.filter((x) => x.trialConverted)) {
    out.push({
      kind: 'trial',
      severity: 'medium',
      title: `${s.name} started as a free or cheap trial`,
      detail: `First charge was ${money(s.charges[0].amount)}, now ${money(s.amount)} every ${s.cadence.replace('ly', '')}. Still using it?`,
      value: s.yearly,
      subIds: [s.id],
    });
  }
  for (const s of active) {
    if (s.cadence !== 'yearly' && s.cadence !== 'quarterly') continue;
    const days = s.nextDay - asOf;
    if (days >= 0 && days <= 60) {
      out.push({
        kind: 'annual-soon',
        severity: 'info',
        title: `${s.name} renews in ${days} days`,
        detail: `${money(s.amount)} lands around ${new Date(s.nextDay * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}. Decide before it does.`,
        value: s.amount,
        subIds: [s.id],
      });
    }
  }
  const stopped = subs.filter((s) => !s.active);
  if (stopped.length) {
    const saved = stopped.reduce((a, s) => a + s.yearly, 0);
    out.push({
      kind: 'stopped',
      severity: 'info',
      title: `${stopped.length} subscription${stopped.length > 1 ? 's' : ''} already stopped`,
      detail: `${stopped.map((s) => s.name).join(', ')}. Good call: that's ${money(saved)}/yr you're no longer paying.`,
      value: 0,
      subIds: stopped.map((s) => s.id),
    });
  }
  const rank = { high: 0, medium: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || b.value - a.value);
}

/** Future value of investing `monthly` every month for `years` at `rate` annual return. */
export function futureValue(monthly: number, years: number, rate = 0.07): number {
  const r = rate / 12;
  const n = years * 12;
  return r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
}
