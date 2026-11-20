import { formatDay } from '../lib/dates';
import { usd, usd0 } from '../lib/format';
import type { Subscription } from '../lib/types';

interface Props {
  subs: Subscription[];
  cancelled: Set<string>;
  asOf: number;
  hourlyWage: number;
  invested: number;
  years: number;
}

/** The share card. Cancelled items in the simulator print struck through, so the receipt tells the before/after story. */
export function Receipt({ subs, cancelled, asOf, hourlyWage, invested, years }: Props) {
  const active = subs.filter((s) => s.active).sort((a, b) => b.monthly - a.monthly);
  const kept = active.filter((s) => !cancelled.has(s.id));
  const monthly = kept.reduce((a, s) => a + s.monthly, 0);
  const yearly = monthly * 12;
  return (
    <div className="receipt" role="img" aria-label={`Receipt: ${kept.length} subscriptions costing ${usd(yearly)} per year`}>
      <div className="r-head">
        <b>snip</b>
        <span>SUBSCRIPTION AUDIT</span>
        <span>{formatDay(asOf, { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}</span>
      </div>
      <hr className="r-rule" />
      <div className="r-row">
        <span>
          <b>ITEM</b>
        </span>
        <span>
          <b>PER MONTH</b>
        </span>
      </div>
      {active.map((s) => (
        <div key={s.id} className={`r-row${cancelled.has(s.id) ? ' strike' : ''}`}>
          <span>{s.name}</span>
          <span>{usd(s.monthly)}</span>
        </div>
      ))}
      <hr className="r-rule" />
      <div className="r-row">
        <span>SUBTOTAL ({kept.length} ITEMS)</span>
        <span>{usd(monthly)}</span>
      </div>
      <div className="r-row r-total">
        <span>TOTAL PER YEAR</span>
        <span>{usd(yearly)}</span>
      </div>
      <div className="r-row">
        <span>HOURS OF WORK</span>
        <span>
          {Math.round(yearly / hourlyWage)} H @ {usd(hourlyWage)}
        </span>
      </div>
      {cancelled.size > 0 && (
        <div className="r-row">
          <span>
            CUT · INVESTED {years} YRS
          </span>
          <span>{usd0(invested)}</span>
        </div>
      )}
      <div className="r-bar" aria-hidden="true" />
      <div className="r-foot">
        THANK YOU FOR YOUR
        <br />
        RECURRING BUSINESS
      </div>
    </div>
  );
}
