import { detectDateOrder, isoDay, parseDate } from '../src/lib/dates';

const iso = (s: string, o?: 'mdy' | 'dmy') => {
  const d = parseDate(s, o);
  return d === null ? null : isoDay(d);
};

describe('parseDate', () => {
  test.each([
    ['2026-01-05', '2026-01-05'],
    ['2026/01/05', '2026-01-05'],
    ['01/05/2026', '2026-01-05'],
    ['1/5/26', '2026-01-05'],
    ['Jan 5, 2026', '2026-01-05'],
    ['January 5 2026', '2026-01-05'],
    ['5 Jan 2026', '2026-01-05'],
    ['05-Jan-2026', '2026-01-05'],
    ['20260105', '2026-01-05'],
    ['2026-01-05T10:22:00Z', '2026-01-05'],
  ])('%s', (input, expected) => expect(iso(input)).toBe(expected));

  test('day-first when asked', () => expect(iso('05/01/2026', 'dmy')).toBe('2026-01-05'));
  test('rejects impossible dates', () => {
    expect(parseDate('02/30/2026')).toBeNull();
    expect(parseDate('hello')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

test('detectDateOrder spots day-first files', () => {
  expect(detectDateOrder(['03/04/2026', '25/04/2026'])).toBe('dmy');
  expect(detectDateOrder(['03/04/2026', '04/25/2026'])).toBe('mdy');
});
