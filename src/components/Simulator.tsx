import { futureValue } from '../lib/detect';
import { usd, usd0 } from '../lib/format';

interface Props {
  monthlySaved: number;
  cutCount: number;
  years: number;
  setYears: (n: number) => void;
  rate: number;
}

/** Opportunity cost of what you cut: monthly savings invested at a fixed return. */
export function Simulator({ monthlySaved, cutCount, years, setYears, rate }: Props) {
  const fv = futureValue(monthlySaved, years, rate);
  const contributed = monthlySaved * 12 * years;

  // Chart: invested value vs. plain savings, year by year
  const W = 460;
  const H = 170;
  const pad = { l: 46, r: 10, t: 10, b: 22 };
  const pts = Array.from({ length: years + 1 }, (_, y) => ({ y, fv: futureValue(monthlySaved, y, rate), saved: monthlySaved * 12 * y }));
  const max = Math.max(1, ...pts.map((p) => p.fv));
  const niceMax = niceCeil(max);
  const x = (y: number) => pad.l + (y / Math.max(1, years)) * (W - pad.l - pad.r);
  const yy = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b);
  const line = (k: 'fv' | 'saved') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.y).toFixed(1)},${yy(p[k]).toFixed(1)}`).join(' ');
  const area = `${line('fv')} L${x(years)},${yy(0)} L${x(0)},${yy(0)} Z`;
  const ticks = [0, 0.5, 1].map((f) => f * niceMax);
  const xTicks = years <= 10 ? [0, Math.round(years / 2), years] : [0, 10, 20, years].filter((v, i, a) => v <= years && a.indexOf(v) === i);

  return (
    <div className="sim">
      <div className="sim-figures">
        <div>
          <div className="label">Cut so far</div>
          <div className="big num">{usd(monthlySaved * 12)}<span className="sub" style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>/yr</span></div>
        </div>
        <div>
          <div className="label">Invested for {years} yrs at {Math.round(rate * 100)}%</div>
          <div className="big num ok">{usd0(fv)}</div>
        </div>
      </div>
      {cutCount === 0 ? (
        <p className="sim-hint">Flip the switches in the table below to cancel subscriptions and watch what that money could grow into.</p>
      ) : (
        <div className="sim-chart" aria-label={`Chart: ${usd0(fv)} after ${years} years versus ${usd0(contributed)} saved without investing`}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img">
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid" x1={pad.l} x2={W - pad.r} y1={yy(t)} y2={yy(t)} />
                <text className="axis" x={pad.l - 6} y={yy(t) + 3} textAnchor="end">
                  {compact(t)}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} className="axis" x={x(t)} y={H - 6} textAnchor={t === 0 ? 'start' : t === years ? 'end' : 'middle'}>
                {t === 0 ? 'now' : `${t}y`}
              </text>
            ))}
            <path d={area} fill="var(--ok-soft)" />
            <path d={line('saved')} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 3" />
            <path d={line('fv')} fill="none" stroke="var(--ok)" strokeWidth="2" />
            <circle cx={x(years)} cy={yy(fv)} r="4" fill="var(--ok)" />
          </svg>
          <p className="sim-hint">
            Green: invested monthly. Dashed: kept as cash ({usd0(contributed)}). The gap is {usd0(fv - contributed)} of growth.
          </p>
        </div>
      )}
      <div className="sim-controls">
        <label htmlFor="years">
          <span>Time horizon</span>
          <span className="num">{years} years</span>
        </label>
        <input id="years" type="range" min={1} max={40} value={years} onChange={(e) => setYears(Number(e.target.value))} />
      </div>
    </div>
  );
}

function niceCeil(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function compact(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k`;
  return `$${Math.round(v)}`;
}
