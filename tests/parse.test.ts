import { parseAmount, parseCsv } from '../src/lib/parse';

describe('parseAmount', () => {
  test.each([
    ['12.50', 12.5],
    ['$1,234.56', 1234.56],
    ['-12', -12],
    ['(12.00)', -12],
    ['12.00 DR', -12],
    ['12.00 CR', 12],
    ['€12,50', 12.5],
    ['1.234,56', 1234.56],
    ['+5', 5],
  ])('%s → %d', (input, expected) => expect(parseAmount(input)).toBeCloseTo(expected));
  test('garbage is null', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('n/a')).toBeNull();
  });
});

describe('parseCsv', () => {
  test('bank export: negative = spending, income dropped', () => {
    const r = parseCsv(`Date,Description,Amount,Balance
01/03/2026,Spotify P2C9,-11.99,100.00
01/04/2026,PAYROLL,800.00,900.00
01/05/2026,"STARBUCKS, TORONTO",-5.25,894.75`);
    expect(r.flippedSign).toBe(true);
    expect(r.transactions).toHaveLength(2);
    expect(r.transactions[1]).toMatchObject({ description: 'STARBUCKS, TORONTO', amount: 5.25 });
  });

  test('credit card export: positive = spending, payments dropped', () => {
    const r = parseCsv(`Transaction Date,Post Date,Description,Category,Type,Amount
2026-01-03,2026-01-04,NETFLIX.COM,Entertainment,Sale,15.49
2026-01-05,2026-01-05,STARBUCKS,Food,Sale,6.10
2026-01-10,2026-01-10,PAYMENT THANK YOU,,Payment,-500.00`);
    expect(r.flippedSign).toBe(false);
    expect(r.transactions.map((t) => t.amount)).toEqual([15.49, 6.1]);
  });

  test('separate debit / credit columns and a preamble', () => {
    const r = parseCsv(`Account,Chequing 1234
Statement period,Jan 2026

Date,Transaction Details,Withdrawals,Deposits,Balance
15 Jan 2026,ROGERS ******4471,65.00,,1000.00
16 Jan 2026,E-TRANSFER RECEIVED,,150.00,1150.00`);
    expect(r.headers[1]).toBe('Transaction Details');
    expect(r.transactions).toEqual([{ day: expect.any(Number), description: 'ROGERS ******4471', amount: 65 }]);
  });

  test('headerless file', () => {
    const r = parseCsv(`2026-01-03,NETFLIX.COM,-15.49
2026-02-03,NETFLIX.COM,-15.49`);
    expect(r.transactions).toHaveLength(2);
  });

  test('explains a file without usable columns', () => {
    expect(() => parseCsv('name,age\nbob,4\nsue,5')).toThrow(/date, description and amount/);
  });
});
