import type { Insight } from '../lib/detect';
import { usd } from '../lib/format';

const SEV_LABEL = { high: 'Leak', medium: 'Review', info: 'Heads up' } as const;

export function Findings({ insights }: { insights: Insight[] }) {
  if (!insights.length) {
    return <div className="empty">No leaks found. Your subscriptions look tidy.</div>;
  }
  return (
    <div className="findings">
      {insights.map((i, n) => (
        <article key={n} className={`finding ${i.severity}`}>
          <div className="stripe" aria-hidden="true" />
          <div>
            <h3>
              <span className={`sev ${i.severity}`}>{SEV_LABEL[i.severity]}</span>
              {i.title}
            </h3>
            <p>{i.detail}</p>
          </div>
          {i.value > 0 && (
            <div className="amt">
              {usd(i.value)}
              <small>{i.kind === 'duplicate' ? 'refund' : i.kind === 'annual-soon' ? 'due' : 'per year'}</small>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
