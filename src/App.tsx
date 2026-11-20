import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildInsights, detectSubscriptions, futureValue } from './lib/detect';
import { formatDay } from './lib/dates';
import { usd, usd0 } from './lib/format';
import { buildIcs } from './lib/ics';
import { parseCsv } from './lib/parse';
import { renderReceiptPng } from './lib/receipt';
import { generateSampleCsv, SAMPLE_END } from './lib/sample';
import type { Transaction } from './lib/types';
import { Findings } from './components/Findings';
import { Receipt } from './components/Receipt';
import { Simulator } from './components/Simulator';
import { SubTable } from './components/SubTable';
import { Upcoming, upcomingTotal } from './components/Upcoming';

const REPO_URL = 'https://github.com/chung45678/Portfolio-project';
const RATE = 0.07;

interface Source {
  kind: 'sample' | 'file';
  name: string;
  transactions: Transaction[];
  asOf: number;
  warnings: string[];
}

function loadSample(): Source {
  const { transactions, warnings } = parseCsv(generateSampleCsv());
  return { kind: 'sample', name: 'Sample chequing account, Nov 2024 – Nov 2026', transactions, asOf: SAMPLE_END, warnings };
}

function store<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: fine, it's only a convenience */
  }
}

// When hosted as a claude.ai Artifact, downloads must go through the viewer's `downloads`
// capability. Everywhere else (GitHub Pages, local dev) a plain link download works.
type DownloadsApi = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };
type ClaudeHost = { use: (name: string) => Promise<unknown> };
const claudeHost = () => (globalThis as unknown as { claude?: ClaudeHost }).claude;
const isArtifact = () => typeof claudeHost()?.use === 'function';

async function saveFile(name: string, blob: Blob) {
  if (isArtifact()) {
    const downloads = (await claudeHost()!.use('downloads').catch(() => null)) as DownloadsApi | null;
    if (downloads) {
      await downloads.save({ filename: name, data: blob }).catch(() => undefined);
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function App() {
  const [source, setSource] = useState<Source>(loadSample);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [hourlyWage, setHourlyWage] = useState<number>(() => store('snip.wage', 17.6));
  const [years, setYears] = useState<number>(() => store('snip.years', 10));
  const [cancelled, setCancelled] = useState<Set<string>>(new Set());
  const [png, setPng] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [inArtifact, setInArtifact] = useState(isArtifact);
  useEffect(() => {
    const t = setTimeout(() => setInArtifact(isArtifact()), 300);
    return () => clearTimeout(t);
  }, []);

  const subs = useMemo(() => detectSubscriptions(source.transactions, { asOf: source.asOf }), [source]);
  const insights = useMemo(() => buildInsights(subs, source.asOf), [subs, source.asOf]);

  // Open the sample in a realistic state: two overlapping services already switched off.
  useEffect(() => {
    if (source.kind === 'sample') {
      setCancelled(new Set(subs.filter((s) => s.active && (s.name === 'Disney+' || s.name === 'Uber One')).map((s) => s.id)));
    } else setCancelled(new Set());
  }, [source, subs]);

  useEffect(() => save('snip.wage', hourlyWage), [hourlyWage]);
  useEffect(() => save('snip.years', years), [years]);

  const active = subs.filter((s) => s.active);
  const monthly = active.reduce((a, s) => a + s.monthly, 0);
  const yearly = monthly * 12;
  const cut = active.filter((s) => cancelled.has(s.id));
  const monthlySaved = cut.reduce((a, s) => a + s.monthly, 0);
  const invested = futureValue(monthlySaved, years, RATE);
  const hours = yearly / Math.max(1, hourlyWage);
  const urgent = insights.filter((i) => i.severity === 'high');
  const recoverable = urgent.reduce((a, i) => a + i.value, 0);
  const next = upcomingTotal(subs, source.asOf, cancelled);
  const spend = source.transactions.reduce((a, t) => a + t.amount, 0);
  const spanDays = source.transactions.length ? source.transactions[source.transactions.length - 1].day - source.transactions[0].day + 1 : 1;
  const shareOfSpend = (monthly / ((spend / spanDays) * 30.4375)) * 100;

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (file.size > 20 * 1024 * 1024) {
      setError('That file is over 20 MB. Export a shorter date range and try again.');
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const asOf = parsed.transactions[parsed.transactions.length - 1].day;
      setSource({ kind: 'file', name: file.name, transactions: parsed.transactions, asOf, warnings: parsed.warnings });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  }, []);

  const toggle = (id: string) =>
    setCancelled((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const makePng = async () => {
    const kept = subs.filter((s) => !cancelled.has(s.id));
    setPng(await renderReceiptPng({ subs: kept, asOf: source.asOf, hourlyWage, invested, years }));
  };

  const downloadPng = async () => {
    if (!png) return;
    const blob = await (await fetch(png)).blob();
    saveFile('snip-receipt.png', blob);
  };

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <div className="brand">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M12.5 19.5L25 3.5M19.5 19.5L7 3.5" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" /><circle cx="9" cy="23.5" r="4.6" fill="var(--highlight)" stroke="var(--ink)" strokeWidth="2.2" /><circle cx="23" cy="23.5" r="4.6" fill="var(--highlight)" stroke="var(--ink)" strokeWidth="2.2" />
            </svg>
            Snip
          </div>
          <div className="toplinks">
            <span className="pill">
              <span className="dot" aria-hidden="true" />
              Runs in your browser. Nothing is uploaded.
            </span>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="wrap hero">
          <div>
            <div className="eyebrow">Subscription audit · from a bank CSV</div>
            <h1>
              Find the subscriptions <span className="hl">worth cutting.</span>
            </h1>
            <p className="lede">
              Drop in a statement export. Snip finds every recurring charge, catches price hikes and double charges, and shows what cutting
              them is worth. No bank login, no sign-up.
            </p>
            <div className="hero-actions">
              <div
                className={`drop${over ? ' over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
              >
                <div className="drop-text">
                  <strong>Drop a CSV statement here</strong>
                  <span>Works with most bank and credit card exports. Your file never leaves this tab.</span>
                </div>
                <button className="btn" onClick={() => fileInput.current?.click()}>
                  Choose file
                </button>
                <input
                  ref={fileInput}
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <div className="source-line">
                {source.kind === 'sample' ? <span className="tag sample">Sample data</span> : <span className="tag">Your file</span>}
                <span>
                  {source.name} · {source.transactions.length.toLocaleString()} payments read
                  {source.warnings.length ? ` · ${source.warnings.join(' ')}` : ''}
                </span>
                {source.kind === 'file' && (
                  <button className="linkbtn" onClick={() => setSource(loadSample())}>
                    Back to sample
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="receipt-col">
            <Receipt subs={subs} cancelled={cancelled} asOf={source.asOf} hourlyWage={hourlyWage} invested={invested} years={years} />
            <div className="receipt-actions">
              <button className="btn" onClick={makePng}>
                Save receipt as image
              </button>
              {!inArtifact && (
              <button className="btn ghost" onClick={() => saveFile('snip-renewals.ics', new Blob([buildIcs(subs.filter((s) => !cancelled.has(s.id)))], { type: 'text/calendar' }))}>
                Add renewals to calendar
              </button>
              )}
            </div>
          </div>
        </section>

        <section className="wrap">
          <div className="summary">
            <div className="stat">
              <div className="label">Subscriptions</div>
              <div className="value">{active.length}</div>
              <div className="sub">{subs.length - active.length} already stopped</div>
            </div>
            <div className="stat">
              <div className="label">Per year</div>
              <div className="value">
                <span className="hl">{usd0(yearly)}</span>
              </div>
              <div className="sub">
                {usd(monthly)}/mo · {Number.isFinite(shareOfSpend) ? `${shareOfSpend.toFixed(0)}% of all spending` : ''}
              </div>
            </div>
            <div className="stat">
              <div className="label">Hours of work</div>
              <div className="value">{Math.round(hours)} h</div>
              <div className="sub wage">
                <label htmlFor="wage">at</label>
                <input
                  id="wage"
                  type="number"
                  min={1}
                  step={0.25}
                  value={hourlyWage}
                  onChange={(e) => setHourlyWage(Math.max(1, Number(e.target.value) || 1))}
                />
                <span>/hr</span>
              </div>
            </div>
            <div className="stat">
              <div className="label">Worth fixing</div>
              <div className="value" style={{ color: urgent.length ? 'var(--danger)' : undefined }}>
                {urgent.length}
              </div>
              <div className="sub">{urgent.length ? `${usd(recoverable)} in hikes and refunds` : 'Nothing urgent'}</div>
            </div>
          </div>
        </section>

        <section className="wrap section">
          <div className="split">
            <div>
              <div className="section-head">
                <h2>What to act on</h2>
                <p>Sorted by money at stake</p>
              </div>
              <Findings insights={insights} />
            </div>
            <div>
              <div className="section-head">
                <h2>Cancel simulator</h2>
                <p>{cut.length ? `${cut.length} cut${source.kind === 'sample' ? ' (example)' : ''}` : 'Nothing cut yet'}</p>
              </div>
              <Simulator monthlySaved={monthlySaved} cutCount={cut.length} years={years} setYears={setYears} rate={RATE} />
            </div>
          </div>
        </section>

        <section className="wrap section">
          <div className="section-head">
            <h2>Every recurring charge</h2>
            <p>Tap a name to see each charge. Flip a switch to try cancelling it.</p>
          </div>
          <SubTable subs={subs} cancelled={cancelled} toggle={toggle} />
        </section>

        <section className="wrap section">
          <div className="section-head">
            <h2>Next 45 days</h2>
            <p>
              <span className="num">{next.count}</span> charges · <span className="num">{usd(next.total)}</span> leaving after{' '}
              {formatDay(source.asOf, { month: 'short', day: 'numeric' })}
            </p>
          </div>
          <Upcoming subs={subs} asOf={source.asOf} cancelled={cancelled} />
        </section>

        <section className="wrap section">
          <div className="section-head">
            <h2>How it works</h2>
          </div>
          <div className="how">
            <div>
              <h3>Clean up merchant names</h3>
              <p>
                Bank descriptors are noisy. <code>SQ *BLUE BOTTLE #0423 CA</code> and <code>NETFLIX.COM 866-579</code> are stripped of
                processor prefixes, store numbers and reference codes, then matched against known services so variants group together.
              </p>
            </div>
            <div>
              <h3>Score each series for rhythm</h3>
              <p>
                Charges are split into price clusters, then tested against weekly, biweekly, monthly, quarterly and yearly cadences with a
                drift window for weekends and short months. A score blends timing, price stability and history length. Weekly grocery runs
                fail on price stability.
              </p>
            </div>
            <div>
              <h3>Flag what’s worth cutting</h3>
              <p>
                Within each series: price steps that stuck, same-amount charges within 3 days, a small first charge before full price,
                overlapping services in one category, and annual renewals coming up in the next 60 days.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span>Snip is a portfolio project. Not financial advice. Investment figures assume a fixed {Math.round(RATE * 100)}% annual return.</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            View the code
          </a>
        </div>
      </footer>

      {png && (
        <div className="modal-back" onClick={() => setPng(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Receipt image" onClick={(e) => e.stopPropagation()}>
            <img src={png} alt="Your Snip subscription receipt" />
            <p>Right-click or long-press the image to save or share it, or use Download. Only subscriptions you kept are printed.</p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setPng(null)}>
                Close
              </button>
              <button className="btn" onClick={downloadPng}>
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
