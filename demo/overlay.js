// In-page helpers the recorder calls: captions, cursor, camera, the hook statement, the end card.
// Geometry: the page is CSS-zoomed, so getBoundingClientRect() is in screen px and
// anything we position or translate in CSS px is divided by the zoom.
(() => {
  let Z = 1;
  let scrollK = 1;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tween = (ms, fn) =>
    new Promise((res) => {
      const s = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - s) / ms);
        fn(ease(t));
        if (t < 1) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
  const rectOf = (sel) => {
    const list = (Array.isArray(sel) ? sel : [sel]).map((s) => $(s).getBoundingClientRect());
    const l = Math.min(...list.map((r) => r.left));
    const t = Math.min(...list.map((r) => r.top));
    const r = Math.max(...list.map((r) => r.right));
    const b = Math.max(...list.map((r) => r.bottom));
    return { left: l, top: t, width: r - l, height: b - t, cx: (l + r) / 2, cy: (t + b) / 2 };
  };
  const SUBS = /netflix|spotify|disney|youtube|openai|claude\.ai|apple\.com|uber\s+\*one|rogers|goodlife|audible|amazon prime|duolingo/i;
  const money = (n) => (n < 0 ? '−' : '+') + '$' + Math.abs(n).toFixed(2);

  const demo = {
    init(csv, zoom) {
      Z = zoom;
      document.documentElement.style.zoom = String(zoom);
      document.documentElement.classList.add('demo');
      // Measure how scrollTo units map to screen px under zoom.
      const before = document.body.getBoundingClientRect().top;
      window.scrollTo(0, 100);
      const after = document.body.getBoundingClientRect().top;
      scrollK = (before - after) / 100 || 1;
      window.scrollTo(0, 0);

      // Hook: a plain, unbranded online-banking activity list.
      const rows = csv.trim().split('\n').slice(1).reverse().slice(0, 170);
      const st = el('div', 'demo-statement');
      const list = rows
        .map((line) => {
          const m = line.match(/^([^,]+),("?)(.*)\2,(-?[\d.]+),(-?[\d.]+)$/);
          if (!m) return '';
          const amt = Number(m[4]);
          const [mo, d, y] = m[1].split('/');
          const date = new Date(Date.UTC(+y, +mo - 1, +d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
          return `<div class="st-row${SUBS.test(m[3]) && amt < 0 ? ' sub' : ''}"><span class="st-date">${date}</span><span class="st-desc">${m[3]}</span><span class="st-amt ${amt < 0 ? 'out' : 'in'}">${money(amt)}</span><span class="st-bal">$${Number(m[5]).toFixed(2)}</span></div>`;
        })
        .join('');
      st.innerHTML = `
        <div class="st-top"><div class="st-acct"><b>Chequing</b> ••4471</div><div class="st-bal-big">Available balance <b>$1,204.87</b></div></div>
        <div class="st-head"><span>Date</span><span>Description</span><span>Amount</span><span>Balance</span></div>
        <div class="st-viewport"><div class="st-list">${list}</div></div>
        <div class="st-count">Showing 170 of 1,272 transactions</div>`;
      document.body.appendChild(st);

      document.body.appendChild(el('div', 'demo-caption'));
      document.body.appendChild(
        el('div', 'demo-cursor', '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 2l15 9-7 1.6L8.6 20z" fill="#14161B" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'),
      );
      const root = $('#root');
      root.style.transformOrigin = '0 0';
    },

    statementScroll(ms) {
      const list = $('.st-list');
      const vp = $('.st-viewport');
      const dist = (list.scrollHeight - vp.clientHeight) * 0.55;
      list.style.transition = `transform ${ms}ms cubic-bezier(.45,.05,.55,.95)`;
      requestAnimationFrame(() => (list.style.transform = `translateY(${-dist}px)`));
    },
    statementHighlight() {
      // Light up every subscription row, nearest-to-view first, so the screen fills with yellow.
      const vp = $('.st-viewport').getBoundingClientRect();
      const mid = vp.top + vp.height / 2;
      const rows = [...document.querySelectorAll('.st-row.sub')].sort(
        (a, b) => Math.abs(a.getBoundingClientRect().top - mid) - Math.abs(b.getBoundingClientRect().top - mid),
      );
      rows.forEach((r, i) => setTimeout(() => r.classList.add('lit'), Math.min(i, 30) * 70));
    },
    statementHide() {
      $('.demo-statement').remove();
    },

    hideResults() {
      const s = el('style', null, '.receipt-col, main > section:not(:first-child), .source-line, footer { visibility: hidden !important }');
      s.id = 'demo-hide';
      document.head.appendChild(s);
    },
    showResults() {
      $('#demo-hide')?.remove();
      const r = $('.receipt');
      r.style.animation = 'none';
      void r.offsetWidth;
      r.style.animation = '';
    },

    caption(text) {
      const c = $('.demo-caption');
      if (!text) {
        c.classList.remove('on');
        return;
      }
      c.innerHTML = text.replace(/\*([^*]+)\*/g, '<mark>$1</mark>');
      c.classList.add('on');
    },

    cursorShow(fx, fy) {
      const c = $('.demo-cursor');
      c.style.transition = 'none';
      c.style.left = (fx * innerWidth) / Z + 'px';
      c.style.top = (fy * innerHeight) / Z + 'px';
      c.classList.add('on');
    },
    cursorTo(sel) {
      const r = rectOf(sel);
      const c = $('.demo-cursor');
      c.style.transition = 'left 650ms cubic-bezier(.3,.7,.2,1), top 650ms cubic-bezier(.3,.7,.2,1), opacity .3s';
      c.style.left = r.cx / Z + 'px';
      c.style.top = r.cy / Z + 'px';
    },
    cursorClick() {
      const c = $('.demo-cursor');
      const ring = el('span', 'demo-ring');
      c.appendChild(ring);
      c.classList.add('press');
      setTimeout(() => c.classList.remove('press'), 160);
      setTimeout(() => ring.remove(), 700);
    },
    cursorHide() {
      $('.demo-cursor').classList.remove('on');
    },

    async scrollTo(sel, frac, ms) {
      const startY = window.scrollY;
      const top = sel === 'body' ? -startY * scrollK : $(sel).getBoundingClientRect().top - frac * innerHeight;
      const target = Math.max(0, startY + top / scrollK);
      await tween(ms, (t) => window.scrollTo(0, startY + (target - startY) * t));
    },

    camera(sel, scale, ms) {
      if (String(sel).startsWith('.modal')) {
        const m = $('.modal');
        m.style.transition = `transform ${ms}ms cubic-bezier(.4,0,.2,1)`;
        m.style.transform = `scale(${scale})`;
        return;
      }
      const root = $('#root');
      const rr = root.getBoundingClientRect();
      const r = rectOf(sel);
      const ox = (r.cx - rr.left) / Z;
      const oy = (r.cy - rr.top) / Z;
      const dx = (innerWidth / 2 - r.cx) / Z;
      const dy = (innerHeight * 0.44 - r.cy) / Z;
      root.style.transition = 'none';
      root.style.transformOrigin = `${ox}px ${oy}px`;
      void root.offsetWidth;
      root.style.transition = `transform ${ms}ms cubic-bezier(.4,0,.2,1)`;
      root.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    },
    cameraReset(ms) {
      const root = $('#root');
      root.style.transition = `transform ${ms}ms cubic-bezier(.4,0,.2,1)`;
      root.style.transform = 'none';
    },
    pulse(sel) {
      const n = $(sel);
      n.classList.add('demo-pulse');
    },

    async slideYears(from, to, ms) {
      const input = $('#years');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      let last = from;
      await tween(ms, (t) => {
        const v = Math.round(from + (to - from) * t);
        if (v === last) return;
        last = v;
        setter.call(input, String(v));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },

    endCard() {
      const e = el(
        'div',
        'demo-end',
        `<div class="end-inner">
          <svg viewBox="0 0 32 32" width="72" height="72"><path d="M16 3C16 3 6 15 6 21a10 10 0 0 0 20 0C26 15 16 3 16 3z" fill="#FFE14D" stroke="#14161B" stroke-width="2.2"/></svg>
          <h1>Leaky</h1>
          <p class="end-tag">Find the money <mark>leaking out</mark> of your account.</p>
          <p class="end-meta">Free · runs in your browser · nothing is uploaded</p>
          <p class="end-url">github.com/chung45678/Portfolio-project</p>
        </div>`,
      );
      document.body.appendChild(e);
      requestAnimationFrame(() => e.classList.add('on'));
    },
  };
  window.demo = demo;
})();
