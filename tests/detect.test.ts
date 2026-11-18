import { buildInsights, clusterByAmount, detectSubscriptions, findPriceChanges, fitCadence, futureValue } from '../src/lib/detect';
import { toDay } from '../src/lib/dates';
import { parseCsv } from '../src/lib/parse';
import { generateSampleCsv, SAMPLE_END } from '../src/lib/sample';
import type { Transaction } from '../src/lib/types';

const D = (y: number, m: number, d: number) => toDay(y, m, d)!;
const tx = (day: number, amount: number, description = 'TEST'): Transaction => ({ day, amount, description });
const monthly = (n: number, amount: number, desc: string, startMonth = 1) =>
  Array.from({ length: n }, (_, i) => tx(D(2026, startMonth + i, 5), amount, desc));

describe('fitCadence', () => {
  test('monthly with month-length drift', () => {
    expect(fitCadence(monthly(6, 10, 'X'))?.spec.cadence).toBe('monthly');
  });
  test('biweekly', () => {
    const s = Array.from({ length: 8 }, (_, i) => tx(D(2026, 1, 2) + i * 14, 24.99));
    expect(fitCadence(s)?.spec.cadence).toBe('biweekly');
  });
  test('a skipped month still counts as monthly', () => {
    const s = monthly(6, 10, 'X').filter((_, i) => i !== 3);
    const fit = fitCadence(s)!;
    expect(fit.spec.cadence).toBe('monthly');
    expect(fit.intervalScore).toBeGreaterThan(0.8);
  });
  test('random timing is not a cadence', () => {
    const days = [0, 3, 19, 22, 61, 64, 90].map((d) => tx(D(2026, 1, 1) + d, 10));
    const fit = fitCadence(days);
    expect(fit === null || fit.intervalScore < 0.6).toBe(true);
  });
});

test('clusterByAmount keeps price hikes together but splits different plans', () => {
  const c = clusterByAmount([tx(1, 2.99), tx(2, 10.99), tx(3, 15.49), tx(4, 17.99), tx(5, 2.99)]);
  expect(c.map((g) => g.map((t) => t.amount).sort((a, b) => a - b))).toEqual([[2.99, 2.99], [10.99], [15.49, 17.99]]);
});

test('findPriceChanges ignores one-off blips', () => {
  const s = [10, 10, 12, 10, 10, 11, 11].map((a, i) => tx(i * 30, a));
  expect(findPriceChanges(s)).toEqual([{ day: 150, from: 10, to: 11 }]);
});

describe('detectSubscriptions', () => {
  test('ignores a weekly grocery run with varying totals', () => {
    const groceries = Array.from({ length: 30 }, (_, i) => tx(D(2026, 1, 3) + i * 7, 40 + ((i * 37) % 60), 'LOBLAWS #1012'));
    expect(detectSubscriptions(groceries)).toHaveLength(0);
  });

  test('marks a subscription that stopped as inactive', () => {
    const subs = detectSubscriptions([...monthly(4, 9.99, 'HULU 877'), tx(D(2026, 11, 1), 3, 'COFFEE')], { asOf: D(2026, 11, 1) });
    expect(subs[0]).toMatchObject({ name: 'Hulu', active: false });
  });

  test('flags a double charge without breaking the series', () => {
    const s = [...monthly(6, 11.99, 'Spotify P2C9'), tx(D(2026, 3, 6), 11.99, 'Spotify P2D0')];
    const [sub] = detectSubscriptions(s);
    expect(sub.cadence).toBe('monthly');
    expect(sub.duplicates).toHaveLength(1);
  });

  test('two Amazon orders a year apart are not an annual plan', () => {
    const orders = [tx(D(2025, 3, 14), 53.06, 'AMZN Mktp CA*AAA111'), tx(D(2026, 3, 14), 58, 'AMZN Mktp CA*BBB222')];
    const noise = Array.from({ length: 20 }, (_, i) => tx(D(2025, 1, 1) + i * 17, 20 + i, 'AMZN Mktp CA*X' + i));
    expect(detectSubscriptions([...orders, ...noise])).toHaveLength(0);
  });
});

describe('the demo statement', () => {
  const { transactions } = parseCsv(generateSampleCsv());
  const subs = detectSubscriptions(transactions, { asOf: SAMPLE_END });
  const byName = Object.fromEntries(subs.map((s) => [s.name, s]));

  test('finds every planted subscription and nothing else', () => {
    expect(Object.keys(byName).sort()).toEqual(
      ['Amazon Prime', 'Apple iCloud', 'Audible', 'ChatGPT Plus', 'Claude Pro', 'Disney+', 'Duolingo', 'Goodlife Fitness', 'Hulu', 'Netflix', 'Peloton Membership', 'Rogers', 'Spotify', 'Uber One', 'YouTube Premium'].sort(),
    );
  });
  test('gets the details right', () => {
    expect(byName['Netflix'].priceChanges).toEqual([{ day: expect.any(Number), from: 15.49, to: 17.99 }]);
    expect(byName['Goodlife Fitness'].cadence).toBe('biweekly');
    expect(byName['Amazon Prime'].cadence).toBe('yearly');
    expect(byName['Audible'].trialConverted).toBe(true);
    expect(byName['Spotify'].duplicates).toHaveLength(1);
    expect(byName['Hulu'].active).toBe(false);
  });
  test('insights lead with money you can get back', () => {
    const insights = buildInsights(subs, SAMPLE_END);
    expect(insights[0].severity).toBe('high');
    expect(insights.some((i) => i.kind === 'annual-soon' && i.title.includes('Amazon Prime'))).toBe(true);
  });
});

test('futureValue matches the annuity formula', () => {
  expect(futureValue(100, 10, 0.07)).toBeCloseTo(17308.48, 0);
  expect(futureValue(100, 1, 0)).toBe(1200);
});
