export const usd = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits });

export const usd0 = (n: number) => usd(n, 0);

export const cadenceLabel: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export const per: Record<string, string> = {
  weekly: '/wk',
  biweekly: '/2wk',
  monthly: '/mo',
  quarterly: '/qtr',
  yearly: '/yr',
};
