// Records the Leaky product demo video by driving the real app in Chromium.
// Every scene is pinned to a timecode from demo/SCRIPT.md so captions and voiceover line up.
//
//   npm run demo                      # builds dist-single/index.html
//   node demo/record.cjs              # writes demo/out/raw.webm + timing.json
//   bash demo/render.sh               # trims, encodes demo/out/leaky-demo.mp4 (+ .srt)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = 'file://' + path.join(ROOT, 'dist-single/index.html');
const OUT = path.join(__dirname, 'out');
const ZOOM = 1.5; // 1280px layout rendered into a 1920x1080 frame
const CSV = fs.readFileSync(path.join(ROOT, 'public/sample-statement.csv'), 'utf8');

// Captions double as the voiceover script. [start, end, text]; *word* = highlighter.
const CAPTIONS = [
  [0.4, 5.6, 'This is two years of my bank account. *1,272 payments.*'],
  [5.8, 10.6, 'Somewhere in here are subscriptions I *forgot I was paying for.*'],
  [10.8, 14.8, 'Finding them by hand? *Not happening.*'],
  [15.4, 19.6, 'So I built *Leaky.* Drop in a statement export…'],
  [19.8, 24.6, '…and it prints every subscription on a *receipt.* In under a second.'],
  [25.0, 30.4, '*$3,211 a year.* That’s 182 hours of work at my wage.'],
  [30.8, 39.6, 'It catches what I’d never notice: *two price hikes* and a *double charge.*'],
  [40.0, 45.6, 'Three video apps and two AI chatbots? *Time to cut a few.*'],
  [46.0, 52.6, '{{INVEST}}'],
  [53.0, 59.6, 'And I get a *receipt worth sharing.*'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.webm')) fs.unlinkSync(path.join(OUT, f));
  const statementFile = path.join(OUT, 'chequing-2024-2026.csv');
  fs.writeFileSync(statementFile, CSV);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
  });
  const tRecord = Date.now();
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ path: path.join(__dirname, 'overlay.css') });
  await page.addScriptTag({ path: path.join(__dirname, 'overlay.js') });
  await page.evaluate(([csv, zoom]) => window.demo.init(csv, zoom), [CSV, ZOOM]);
  await sleep(600);

  const t0 = Date.now();
  const at = async (s) => {
    const wait = t0 + s * 1000 - Date.now();
    if (wait > 0) await sleep(wait);
  };
  const D = (fn, ...args) => page.evaluate(({ fn, args }) => window.demo[fn](...args), { fn, args });

  // Captions run on their own clock.
  let investText = '';
  const captionLoop = (async () => {
    for (const [start, end, text] of CAPTIONS) {
      await at(start);
      await D('caption', text === '{{INVEST}}' ? investText : text);
      await at(end);
      await D('caption', null);
    }
  })();

  // ── 1 · Hook & problem (0:00–0:15) ──────────────────────────────
  await D('statementScroll', 13000);
  await at(9.6);
  await D('statementHighlight');
  await at(15.0);

  // ── 2 · Upload → receipt prints (0:15–0:25) ─────────────────────
  await D('hideResults');
  await D('statementHide');
  await D('cursorShow', 0.5, 0.55);
  await at(16.4);
  await D('cursorTo', '.drop .btn');
  await at(18.6);
  await D('cursorClick');
  await page.setInputFiles('#csv-file', statementFile);
  await sleep(150);
  await D('showResults');
  await at(20.2);
  await D('cursorHide');
  await at(21.6);
  await D('camera', '.receipt .r-total', 1.7, 1300);
  await at(24.4);
  await D('cameraReset', 1000);

  // ── 3 · The number (0:25–0:31) ──────────────────────────────────
  await at(25.0);
  await D('scrollTo', '.summary', 0.34, 1000);
  await at(26.3);
  await D('camera', '.summary .stat:nth-child(2)', 1.9, 1300);
  await at(30.0);
  await D('cameraReset', 900);

  // ── 4 · The leaks (0:31–0:40) ───────────────────────────────────
  await D('scrollTo', '.findings', 0.16, 1100);
  await at(32.3);
  await D('camera', ['.finding:nth-child(1)', '.finding:nth-child(3)'], 1.45, 1300);
  await D('pulse', '.finding:nth-child(1)', 33.8 - 32.3);
  await at(35.2);
  await D('pulse', '.finding:nth-child(2)', 0);
  await at(36.6);
  await D('pulse', '.finding:nth-child(3)', 0);
  await at(39.4);
  await D('cameraReset', 800);

  // ── 5 · Cut and simulate (0:40–0:53) ────────────────────────────
  await at(40.0);
  await D('scrollTo', 'tr:has(button[aria-label="Cancel Disney+"])', 0.3, 1100);
  await D('cursorShow', 0.55, 0.85);
  for (const [i, name] of ['YouTube Premium', 'Disney+', 'Claude Pro'].entries()) {
    await at(41.4 + i * 1.3);
    await D('cursorTo', `button[aria-label="Cancel ${name}"]`);
    await sleep(750);
    await D('cursorClick');
    await page.click(`button[aria-label="Cancel ${name}"]`);
  }
  await at(45.6);
  await D('cursorHide');
  await D('scrollTo', '.sim', 0.12, 1100);
  await at(46.8);
  await D('camera', '.sim', 1.45, 1100);
  await D('slideYears', 10, 25, 2600);
  investText = await page.evaluate(
    () => `Invest that instead: *${document.querySelector('.sim-figures .big.ok').textContent} in 25 years.*`,
  );
  await at(52.6);
  await D('cameraReset', 800);

  // ── 6 · Outcome: the receipt (0:53–1:00) ────────────────────────
  await D('scrollTo', 'body', 0, 1000);
  await at(54.4);
  await D('cursorShow', 0.62, 0.72);
  await D('cursorTo', '.receipt-actions .btn');
  await at(55.8);
  await D('cursorClick');
  await page.click('.receipt-actions .btn');
  await sleep(500);
  await D('cursorHide');
  await at(59.8);

  // ── 7 · End card + CTA (1:00–1:07) ──────────────────────────────
  await D('endCard');
  await at(67.0);
  await captionLoop;

  const offset = (t0 - tRecord) / 1000;
  await ctx.close();
  await browser.close();
  const raw = fs.readdirSync(OUT).find((f) => f.endsWith('.webm'));
  fs.renameSync(path.join(OUT, raw), path.join(OUT, 'raw.webm'));
  const captions = CAPTIONS.map(([s, e, t]) => [s, e, (t === '{{INVEST}}' ? investText : t).replace(/\*/g, '')]);
  fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify({ offset, duration: 67, captions }, null, 2));
  console.log(`recorded; trim offset ${offset.toFixed(2)}s`);
})();
