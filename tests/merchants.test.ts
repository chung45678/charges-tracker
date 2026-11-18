import { identify, merchantKey } from '../src/lib/merchants';

test.each([
  ['SQ *BLUE BOTTLE COFFEE #0423 SAN FRANCISCO CA', 'blue bottle coffee'],
  ['TST* JOES PIZZA 123', 'joes pizza'],
  ['PURCHASE AUTHORIZED ON 01/05 GOODLIFE FITNESS #0231', 'goodlife fitness'],
  ['AMZN Mktp CA*2K3JF4', 'amzn mktp'],
])('merchantKey(%s)', (raw, key) => expect(merchantKey(raw)).toBe(key));

test('different descriptors for the same service collapse', () => {
  const a = identify('NETFLIX.COM 866-579-7172 CA');
  const b = identify('Netflix Inc Los Gatos');
  expect(a.key).toBe(b.key);
  expect(a).toMatchObject({ name: 'Netflix', category: 'Video' });
});

test('app-specific Apple billing beats generic Apple billing', () => {
  expect(identify('DUOLINGO APPLE.COM/BILL').name).toBe('Duolingo');
  expect(identify('APPLE.COM/BILL 866-712-7753 ON').name).toBe('Apple iCloud');
});

test('unknown merchants get a readable name', () => {
  expect(identify('SQ *SAM JAMES COFFEE BAR').name).toBe('Sam James Coffee');
});
