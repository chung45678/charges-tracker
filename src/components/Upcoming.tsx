import { formatDay } from '../lib/dates';
import { usd } from '../lib/format';
import type { Subscription } from '../lib/types';

/** The next 45 days of charges on one axis, so a cluster of renewals is visible before it hits. */
export function Upcoming({ subs, asOf, cancelled }: { subs: Subscription[]; asOf: number; cancelled: Set<string> }) {
  const DAYS = 45;
  const events: { day: number; sub: Subscription }[] = [];
  for (const s of subs) {
    if (!s.active || cancelled.has(s.id)) continue;
    for (let d = s.nextDay; d <= asOf + DAYS; d += s.periodDays) {
      if (d > asOf) events.push({ day: Math.round(d), sub: s });
    }
  }
  events.sort((a, b) => a.day - b.day);
  const total = events.reduce((a, e) => a + e.sub.amount, 0);

  const W = 960;
  const base = 150;
  const x = (d: number) => 20 + ((d - asOf) / DAYS) * (W - 40);
  // Stagger labels into rows so neighbours never overlap.
  const rowsEnd: number[] = [];
  const placed = events.map((e) => {
    const px = x(e.day);
    let row = rowsEnd.findIndex((end) => px - end > 96);
    if (row === -1) {
      row = rowsEnd.length;
      rowsEnd.push(px);
    } else rowsEnd[row] = px;
    return { ...e, px, row };
  });
  const rowsUsed = Math.max(1, rowsEnd.length);
  const rowH = Math.min(30, (base - 24) / rowsUsed);
  const weekTicks = Array.from({ length: Math.floor(DAYS / 7) + 1 }, (_, i) => asOf + i * 7);

  return (
    <div className="timeline">
      <svg viewBox={`0 0 ${W} ${base + 26}`} role="img" aria-label={`${events.length} charges totalling ${usd(total)} in the next ${DAYS} days`}>
        <line className="baseline" x1={20} x2={W - 20} y1={base} y2={base} />
        {weekTicks.map((d) => (
          <text key={d} className="tick" x={x(d)} y={base + 18} textAnchor="middle">
            {d === asOf ? 'Today' : formatDay(d, { month: 'short', day: 'numeric' })}
          </text>
        ))}
        <line className="today" x1={x(asOf)} x2={x(asOf)} y1={8} y2={base} />
        {placed.map((e, i) => {
          const ly = base - 18 - e.row * rowH;
          const big = e.sub.amount >= 50;
          return (
            <g key={i}>
              <line x1={e.px} x2={e.px} y1={ly + 4} y2={base} stroke="var(--line)" />
              <circle className={`mark${big ? ' big' : ''}`} cx={e.px} cy={base} r={big ? 5 : 3.5} />
              <text className="lbl" x={e.px + 4} y={ly}>
                {e.sub.name.length > 14 ? e.sub.name.slice(0, 13) + '…' : e.sub.name}
              </text>
              <text className="lbl-amt" x={e.px + 4} y={ly + 11}>
                {usd(e.sub.amount)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function upcomingTotal(subs: Subscription[], asOf: number, cancelled: Set<string>, days = 45) {
  let total = 0;
  let count = 0;
  for (const s of subs) {
    if (!s.active || cancelled.has(s.id)) continue;
    for (let d = s.nextDay; d <= asOf + days; d += s.periodDays) {
      if (d > asOf) {
        total += s.amount;
        count++;
      }
    }
  }
  return { total, count };
}
