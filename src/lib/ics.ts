import type { Subscription } from './types';
import { isoDay } from './dates';

/** One all-day reminder per active subscription, 2 days before its next charge. */
export function buildIcs(subs: Subscription[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Leaky//Subscription reminders//EN', 'CALSCALE:GREGORIAN'];
  for (const s of subs.filter((x) => x.active)) {
    const start = isoDay(s.nextDay - 2).replace(/-/g, '');
    const end = isoDay(s.nextDay - 1).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id.replace(/[^a-z0-9]/gi, '')}-${start}@leaky`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${s.name} charges $${s.amount.toFixed(2)} in 2 days`,
      'DESCRIPTION:Keep it or cancel it? Reminder from Leaky.',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
