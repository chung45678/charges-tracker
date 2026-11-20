import { Fragment, useState } from 'react';
import { formatDay } from '../lib/dates';
import { cadenceLabel, per, usd } from '../lib/format';
import type { Subscription } from '../lib/types';

interface Props {
  subs: Subscription[];
  cancelled: Set<string>;
  toggle: (id: string) => void;
}

function Spark({ sub }: { sub: Subscription }) {
  const W = 92;
  const H = 26;
  const pts = sub.charges.slice(-14);
  const vals = pts.map((c) => c.amount);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || max * 0.2 || 1;
  const x = (i: number) => (pts.length === 1 ? W / 2 : 2 + (i / (pts.length - 1)) * (W - 6));
  const y = (v: number) => H - 4 - ((v - (min - span * 0.25)) / (span * 1.5)) * (H - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.amount).toFixed(1)}`).join(' ');
  const up = sub.priceChanges.some((p) => p.to > p.from);
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path className="area" d={`${d} L${x(pts.length - 1)},${H} L${x(0)},${H} Z`} />
      <path className="line" d={d} />
      <circle className={`end${up ? ' up' : ''}`} cx={x(pts.length - 1)} cy={y(vals[vals.length - 1])} r="2.6" />
    </svg>
  );
}

export function SubTable({ subs, cancelled, toggle }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  if (!subs.length) return <div className="table-wrap empty">No recurring charges found in this file.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cancel?</th>
            <th>Subscription</th>
            <th>Billing</th>
            <th className="right">Charge</th>
            <th className="right">Per year</th>
            <th>Price history</th>
            <th>Next charge</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => {
            const isCut = cancelled.has(s.id);
            const hike = s.priceChanges.find((p) => p.to > p.from);
            return (
              <Fragment key={s.id}>
                <tr className={`${s.active ? '' : 'inactive'}${isCut ? ' cancelled' : ''}`}>
                  <td>
                    {s.active ? (
                      <button
                        className="toggle"
                        role="switch"
                        aria-checked={isCut}
                        aria-label={`Cancel ${s.name}`}
                        onClick={() => toggle(s.id)}
                      />
                    ) : (
                      <span className="chip ok">Stopped</span>
                    )}
                  </td>
                  <td>
                    <button className="expand" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
                      <div className="sub-name">{s.name}</div>
                      <div className="sub-meta">
                        {s.category} · {s.charges.length} charges · {Math.round(s.confidence * 100)}% match
                      </div>
                    </button>
                    <div className="chips">
                      {hike && <span className="chip danger">+{Math.round(((hike.to - hike.from) / hike.from) * 100)}% price</span>}
                      {s.duplicates.length > 0 && <span className="chip danger">Double charge</span>}
                      {s.trialConverted && <span className="chip warn">Trial converted</span>}
                    </div>
                  </td>
                  <td>{cadenceLabel[s.cadence]}</td>
                  <td className="right num">
                    {usd(s.amount)}
                    <span className="sub-meta">{per[s.cadence]}</span>
                  </td>
                  <td className="right num">{s.active ? <span className={s.yearly >= 150 ? 'hl' : ''}>{usd(s.yearly)}</span> : '—'}</td>
                  <td>
                    <Spark sub={s} />
                  </td>
                  <td className="num">
                    {s.active ? formatDay(s.nextDay, { month: 'short', day: 'numeric' }) : `Last ${formatDay(s.lastDay, { month: 'short', year: 'numeric' })}`}
                  </td>
                </tr>
                {open === s.id && (
                  <tr className="history">
                    <td colSpan={7}>
                      <div className="history-list">
                        {s.charges.map((c, i) => {
                          const isDup = s.duplicates.some((g) => g.slice(1).includes(c));
                          const isTrial = s.trialConverted && i === 0;
                          return (
                            <span key={i} className={isDup ? 'dup' : isTrial ? 'trial' : ''} title={c.description}>
                              {formatDay(c.day, { month: 'short', day: 'numeric', year: '2-digit' })} · {usd(c.amount)}
                              {isDup ? ' · dup' : isTrial ? ' · trial' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
