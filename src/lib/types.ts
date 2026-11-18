/** A single outgoing payment. `day` is days since 1970-01-01 (UTC) so date math stays integer-only. */
export interface Transaction {
  day: number;
  description: string;
  amount: number; // always positive: money that left the account
}

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PriceChange {
  day: number;
  from: number;
  to: number;
}

export interface Subscription {
  id: string;
  name: string;
  category: Category;
  cadence: Cadence;
  periodDays: number;
  /** Most recent charge amount: what you pay now. */
  amount: number;
  monthly: number;
  yearly: number;
  charges: Transaction[];
  firstDay: number;
  lastDay: number;
  nextDay: number;
  active: boolean;
  confidence: number; // 0..1
  priceChanges: PriceChange[];
  duplicates: Transaction[][]; // groups of suspected double charges
  trialConverted: boolean;
}

export type Category =
  | 'Video'
  | 'Music & Audio'
  | 'Software & AI'
  | 'Cloud & Storage'
  | 'Fitness'
  | 'Books & News'
  | 'Learning'
  | 'Gaming'
  | 'Food & Delivery'
  | 'Phone & Internet'
  | 'Insurance'
  | 'Shopping'
  | 'Other';
