/* ==========================================================================
   The Orange Pill — interactions
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  root.classList.remove('no-js');

  // Translations: localized pages inject window.I18N_JS ({ english: translated }).
  // Strings are keyed by their English text, so English is always the fallback.
  const I18N = window.I18N_JS || {};
  const t = (en, vars) => {
    let str = I18N[en] ?? en;
    if (vars) for (const k in vars) str = str.split('{' + k + '}').join(vars[k]);
    return str;
  };

  /* ------------------------------------------------------------------
     Slides, chapters, navigation
     ------------------------------------------------------------------ */
  const slides = $$('.slide');
  const N = slides.length;
  let current = 0;
  let chapter = 'Prologue';

  slides.forEach((s, i) => {
    if (!s.id) s.id = 's' + (i + 1);
    if (s.dataset.chapter) chapter = s.dataset.chapter;
    s.dataset.chapterLabel = chapter;
  });

  // Deep links to runtime-assigned ids (#s15) can't be resolved by the browser on load
  const startHash = decodeURIComponent(location.hash.slice(1));
  const startSlide = startHash && document.getElementById(startHash);
  if (startSlide && startSlide.classList.contains('slide')) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    root.style.scrollBehavior = 'auto';
    startSlide.scrollIntoView({ block: 'start' });
    requestAnimationFrame(() => { root.style.scrollBehavior = ''; });
  }

  // Dots
  const dots = $('#dots');
  slides.forEach((s, i) => {
    const b = document.createElement('button');
    const title = s.dataset.toc || (s.querySelector('h1, h2')?.textContent || '').trim();
    b.dataset.label = title.length > 46 ? title.slice(0, 44) + '…' : title;
    b.setAttribute('aria-label', t('Slide {n}: {title}', { n: i + 1, title }));
    if (s.dataset.toc) b.classList.add('chap');
    b.addEventListener('click', () => go(i));
    dots.appendChild(b);
  });
  const dotBtns = $$('button', dots);

  // Menu
  const menu = $('#menu');
  const menuList = $('#menu-list');
  const roman = ['Prologue', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'Epilogue'];
  let ci = 0;
  slides.forEach((s, i) => {
    if (i !== 0 && !s.dataset.toc) return;
    const li = document.createElement('li');
    li.style.setProperty('--i', ci);
    const label = i === 0 ? t('The Orange Pill') : s.dataset.toc;
    const num = i === 0 ? '00' : (roman[ci] === 'Epilogue' ? '—' : roman[ci]);
    li.innerHTML = `<a href="#${s.id}" data-idx="${i}"><span>${num}</span>${label}</a>`;
    menuList.appendChild(li);
    ci++;
  });
  menuList.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    closeMenu();
    go(+a.dataset.idx);
  });

  let lastFocus = null;
  function openMenu() {
    lastFocus = document.activeElement;
    menu.hidden = false;
    $$('a', menuList).forEach(a => {
      const idx = +a.dataset.idx;
      const next = $$('a', menuList).map(x => +x.dataset.idx).filter(x => x > idx)[0] ?? N;
      a.classList.toggle('current', current >= idx && current < next);
    });
    requestAnimationFrame(() => { menu.classList.add('open'); $('.menu-close').focus(); });
  }
  function closeMenu() {
    menu.classList.remove('open');
    setTimeout(() => { menu.hidden = true; }, 300);
    lastFocus?.focus?.();
  }
  $$('[data-open-menu]').forEach(b => b.addEventListener('click', openMenu));
  $$('[data-close-menu]').forEach(b => b.addEventListener('click', closeMenu));
  menu.addEventListener('click', e => { if (e.target === menu) closeMenu(); });

  function go(i) {
    i = clamp(i, 0, N - 1);
    slides[i].scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  function next() {
    const r = slides[current].getBoundingClientRect();
    // Tall slide (mobile): page through it before moving on
    if (r.bottom > innerHeight + 24) window.scrollBy({ top: innerHeight * 0.85, behavior: reduced ? 'auto' : 'smooth' });
    else go(current + 1);
  }
  function prev() {
    const r = slides[current].getBoundingClientRect();
    if (r.top < -24) window.scrollBy({ top: -innerHeight * 0.85, behavior: reduced ? 'auto' : 'smooth' });
    else go(current - 1);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    const dir = b.dataset.go;
    if (dir === 'next') next();
    else if (dir === 'prev') prev();
    else if (dir === 'first') go(0);
  });

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!menu.hidden) { if (e.key === 'Escape') closeMenu(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    const onButton = tag === 'button' || tag === 'summary' || tag === 'a';
    switch (e.key) {
      case 'ArrowDown': case 'PageDown': case 'ArrowRight': e.preventDefault(); next(); break;
      case ' ': if (onButton) return; e.preventDefault(); e.shiftKey ? prev() : next(); break;
      case 'ArrowUp': case 'PageUp': case 'ArrowLeft': e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); go(0); break;
      case 'End': e.preventDefault(); go(N - 1); break;
      case 'm': case 'M': openMenu(); break;
      case 's': case 'S': toggleSound(); break;
      case 'f': case 'F':
        if (document.fullscreenElement) document.exitFullscreen?.();
        else root.requestFullscreen?.().catch(() => {});
        break;
    }
  });

  // Active slide = the one crossing the vertical centre of the viewport
  const hudChapter = $('#hud-chapter');
  const hudCount = $('#hud-count');
  const bar = $('#progress span');
  function setActive(i) {
    if (i === current && slides[i].classList.contains('active')) return;
    slides[current]?.classList.remove('active');
    current = i;
    const s = slides[i];
    s.classList.add('active');
    root.dataset.mood = s.dataset.mood || 'orange';
    dotBtns.forEach((d, k) => d.classList.toggle('active', k === i));
    hudCount.textContent = `${String(i + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
    bar.style.width = (N > 1 ? (i / (N - 1)) * 100 : 100) + '%';
    const label = s.dataset.chapterLabel;
    if (hudChapter.textContent !== label) {
      hudChapter.classList.add('swap');
      setTimeout(() => { hudChapter.textContent = label; hudChapter.classList.remove('swap'); }, 250);
    }
    if (history.replaceState) history.replaceState(null, '', '#' + s.id);
  }
  const activeObs = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) setActive(slides.indexOf(en.target)); });
  }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
  slides.forEach(s => activeObs.observe(s));

  // Reveal on enter (once) + lazy init of slide widgets
  const inits = {};
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const s = en.target;
      s.classList.add('in');
      revealObs.unobserve(s);
      const fn = inits[s.id];
      if (fn) setTimeout(fn, 250);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  slides.forEach(s => revealObs.observe(s));

  /* ------------------------------------------------------------------
     Background: subtle orange "digital rain" (Matrix style).
     Scrolling briefly speeds it up; it dims in the "broken money" chapters.
     ------------------------------------------------------------------ */
  (function rain() {
    const cv = $('#rain');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789₿₿';
    const MOOD_ALPHA = { cold: 0.55, gold: 0.75, orange: 1 };
    let W, H, size, cols, drops = [], speeds = [], boost = 0, lastY = scrollY, lastT = 0, alpha = 1;
    const pick = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    function resize() {
      W = cv.width = innerWidth;
      H = cv.height = innerHeight;
      size = W < 700 ? 14 : 16;
      cols = Math.ceil(W / size);
      drops = Array.from({ length: cols }, () => Math.random() * -H / size);
      speeds = Array.from({ length: cols }, () => 0.18 + Math.random() * 0.4);
      ctx.font = `${size}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'top';
    }
    function draw(dt) {
      // fade previous frames toward transparent, leaving trails
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${0.06 * dt})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      alpha += ((MOOD_ALPHA[root.dataset.mood] || 1) - alpha) * 0.05;
      for (let i = 0; i < cols; i++) {
        const prev = Math.floor(drops[i]);
        drops[i] += speeds[i] * dt * (1 + boost);
        const row = Math.floor(drops[i]);
        if (row === prev) continue;                         // characters snap to a grid
        const x = i * size;
        if (prev >= 0) {                                    // the old head becomes trail
          ctx.clearRect(x, prev * size, size, size);
          ctx.fillStyle = `rgba(247,147,26,${0.7 * alpha})`;
          ctx.fillText(pick(), x, prev * size);
        }
        if (row >= 0) {
          ctx.clearRect(x, row * size, size, size);
          ctx.fillStyle = `rgba(255,214,160,${alpha})`;     // bright head
          ctx.fillText(pick(), x, row * size);
        }
        if (row * size > H && Math.random() > 0.96) drops[i] = Math.random() * -24;
      }
      boost *= 0.92;
    }
    function frame(now) {
      if (!document.hidden && now - lastT > 33) {        // ~30 fps is plenty for a background
        const dt = lastT ? Math.min(3, (now - lastT) / 33) : 1;
        lastT = now;
        draw(dt);
      }
      requestAnimationFrame(frame);
    }
    resize();
    addEventListener('resize', debounce(resize, 200));
    addEventListener('scroll', () => {
      const dy = Math.abs(scrollY - lastY);
      lastY = scrollY;
      boost = Math.min(5, boost + dy / 60);
    }, { passive: true });
    if (reduced) {                                          // one still frame
      for (let k = 0; k < 40; k++) draw(1);
    } else {
      requestAnimationFrame(frame);
    }
  })();

  /* ------------------------------------------------------------------
     Icons
     ------------------------------------------------------------------ */
  const ICONS = {
    scarce: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l4-6 4 6z"/>',
    durable: '<path d="M12 2.5 20 6v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    portable: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>',
    divisible: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    verify: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/><path d="m8 11 2 2 4-4"/>',
    fungible: '<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>',
    free: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/><circle cx="12" cy="16" r="1.2"/>',
  };
  $$('[data-icon]').forEach(i => {
    i.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[i.dataset.icon] || ''}</svg>`;
  });

  /* ------------------------------------------------------------------
     Ice cube inflation calculator
     ------------------------------------------------------------------ */
  (function calc() {
    const amt = $('#calc-amount'), yrs = $('#calc-years');
    if (!amt) return;
    let rate = 0.031;
    const segBtns = $$('#icecube .seg button');
    segBtns.forEach(b => b.addEventListener('click', () => {
      segBtns.forEach(x => x.setAttribute('aria-checked', String(x === b)));
      rate = +b.dataset.rate;
      update();
    }));
    function update() {
      const a = Math.max(0, +amt.value || 0);
      const y = +yrs.value;
      const keep = 1 / Math.pow(1 + rate, y);
      $('#calc-years-out').textContent = y;
      $('#calc-years-out2').textContent = y;
      $('#calc-amount-out').textContent = '$' + fmt(a);
      $('#calc-real').textContent = '$' + fmt(a * keep);
      $('#calc-lost').textContent = Math.round((1 - keep) * 100) + '%';
      yrs.style.setProperty('--p', ((y - 1) / 49) * 100 + '%');
      const s = Math.sqrt(keep);
      $('#ice-cube').style.transform = `scale(${s.toFixed(3)})`;
      const p = $('#ice-puddle');
      p.style.rx = (60 + 100 * (1 - keep)) + 'px';
      p.style.ry = (14 + 14 * (1 - keep)) + 'px';
    }
    amt.addEventListener('input', update);
    yrs.addEventListener('input', update);
    update();
  })();

  /* ------------------------------------------------------------------
     Chart helpers (plain SVG, sized to the container in real pixels
     so text stays legible at every width)
     ------------------------------------------------------------------ */
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function svgFor(box, h) {
    box.innerHTML = '';
    const w = Math.max(280, box.clientWidth);
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    box.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'tip';
    box.appendChild(tip);
    return { svg, w, h, tip };
  }
  function showTip(tip, x, y, html) {
    tip.innerHTML = html;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.classList.add('on');
  }
  function drawLine(path, animate) {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = animate ? len : 0;
    path.classList.add('draw');
    if (animate) requestAnimationFrame(() => requestAnimationFrame(() => { path.style.strokeDashoffset = 0; }));
  }

  /**
   * Generic line chart with crosshair tooltip.
   * opts: { data:[[x,y]], x:[min,max], y:[min,max], xTicks, yTicks, fx, fy, tip(x,y), ann:[{x,label}], endLabel, color, height, extra(ctx) }
   */
  function lineChart(box, opts, animate) {
    if (!box) return;
    const narrow = box.clientWidth < 560;
    const H = opts.height ? opts.height(box.clientWidth) : clamp(box.clientWidth * 0.4, 230, 360);
    const { svg, w, h, tip } = svgFor(box, H);
    const m = { l: narrow ? 44 : 56, r: narrow ? 14 : 28, t: 26, b: 30 };
    const X = v => m.l + ((v - opts.x[0]) / (opts.x[1] - opts.x[0])) * (w - m.l - m.r);
    const Y = v => m.t + (1 - (v - opts.y[0]) / (opts.y[1] - opts.y[0])) * (h - m.t - m.b);
    const color = opts.color || 'var(--accent)';

    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    const defs = el('defs', {}, svg);
    const lg = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': 'currentColor', 'stop-opacity': 0.28 }, lg);
    el('stop', { offset: 1, 'stop-color': 'currentColor', 'stop-opacity': 0 }, lg);
    svg.style.color = color;

    opts.yTicks.forEach(v => {
      el('line', { class: 'grid-line', x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v) }, svg);
      const t = el('text', { class: 'axis-t', x: m.l - 10, y: Y(v) + 4, 'text-anchor': 'end' }, svg);
      t.textContent = opts.fy(v);
    });
    (narrow && opts.xTicksNarrow ? opts.xTicksNarrow : opts.xTicks).forEach(v => {
      const t = el('text', { class: 'axis-t', x: X(v), y: h - 8, 'text-anchor': 'middle' }, svg);
      t.textContent = opts.fx(v);
    });

    (opts.ann || []).forEach(a => {
      el('line', { class: 'ann-line', x1: X(a.x), x2: X(a.x), y1: m.t - 6, y2: h - m.b }, svg);
      if (!narrow || a.short) {
        const t = el('text', { class: 'ann-t', x: X(a.x) + 6, y: m.t + 4 + (a.dy || 0) }, svg);
        t.textContent = narrow ? a.short : a.label;
      }
    });

    const d = opts.data.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
    const last = opts.data[opts.data.length - 1];
    const first = opts.data[0];
    el('path', { class: 'area', d: `${d} L${X(last[0])} ${Y(opts.y[0])} L${X(first[0])} ${Y(opts.y[0])} Z`, fill: `url(#${gid})` }, svg);
    const line = el('path', { class: 'line', d, stroke: 'currentColor' }, svg);
    drawLine(line, animate);
    setTimeout(() => box.classList.add('drawn'), animate ? 50 : 0);

    if (opts.extra) opts.extra({ svg, X, Y, w, h, m, narrow });

    if (opts.endLabel) {
      el('circle', { class: 'dot', cx: X(last[0]), cy: Y(last[1]), r: 5, fill: 'currentColor' }, svg);
      const t = el('text', { class: 'lbl-t', x: X(last[0]) - 10, y: Y(last[1]) - 12, 'text-anchor': 'end' }, svg);
      t.textContent = opts.endLabel;
    }

    // Hover layer
    const cross = el('line', { class: 'cross', y1: m.t, y2: h - m.b, opacity: 0 }, svg);
    const hdot = el('circle', { class: 'dot', r: 5, fill: 'currentColor', opacity: 0 }, svg);
    const hit = el('rect', { x: m.l, y: 0, width: w - m.l - m.r, height: h, fill: 'transparent' }, svg);
    const move = ev => {
      const rect = svg.getBoundingClientRect();
      const px = (ev.clientX - rect.left) * (w / rect.width);
      const xv = opts.x[0] + ((px - m.l) / (w - m.l - m.r)) * (opts.x[1] - opts.x[0]);
      const p = opts.sample ? opts.sample(xv) : nearest(opts.data, xv);
      if (!p) return;
      const cx = X(p[0]), cy = Y(p[1]);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('opacity', 1);
      hdot.setAttribute('cx', cx); hdot.setAttribute('cy', cy); hdot.setAttribute('opacity', 1);
      showTip(tip, cx * (rect.width / w), cy * (rect.height / h), opts.tip(p[0], p[1]));
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { tip.classList.remove('on'); cross.setAttribute('opacity', 0); hdot.setAttribute('opacity', 0); });
  }
  function nearest(data, xv) {
    let best = data[0], bd = Infinity;
    for (const p of data) { const dd = Math.abs(p[0] - xv); if (dd < bd) { bd = dd; best = p; } }
    return best;
  }

  /* ---------- Chart: purchasing power of $1 since 1913 ---------- */
  const CPI = [[1913, 9.9], [1916, 10.9], [1918, 15.1], [1920, 20.0], [1925, 17.5], [1929, 17.1], [1933, 13.0], [1935, 13.7], [1940, 14.0], [1945, 18.0], [1948, 24.1], [1950, 24.1], [1955, 26.8], [1960, 29.6], [1965, 31.5], [1971, 40.5], [1975, 53.8], [1980, 82.4], [1985, 107.6], [1990, 130.7], [1995, 152.4], [2000, 172.2], [2005, 195.3], [2010, 218.1], [2015, 237.0], [2020, 258.8], [2022, 292.7], [2024, 313.7]];
  const PP = CPI.map(([y, c]) => [y, 9.9 / c]);
  function chartPP(animate) {
    lineChart($('#chart-pp'), {
      data: PP, x: [1913, 2024], y: [0, 1],
      xTicks: [1913, 1930, 1950, 1971, 1990, 2010, 2024],
      xTicksNarrow: [1913, 1950, 1990, 2024],
      yTicks: [0, 0.25, 0.5, 0.75, 1], fy: v => '$' + v.toFixed(2), fx: v => v,
      ann: [{ x: 1933, label: t('1933 · gold confiscated'), short: '1933' }, { x: 1971, label: t('1971 · gold link cut'), short: '1971' }],
      endLabel: '$0.03',
      tip: (x, y) => `<b>$${y.toFixed(2)}</b>${t('{year} · value of a 1913 dollar', { year: x })}`,
    }, animate);
  }

  /* ---------- Chart: M2 money supply (bars) ---------- */
  const M2 = [[1960, 0.30], [1965, 0.46], [1970, 0.59], [1975, 0.92], [1980, 1.54], [1985, 2.33], [1990, 3.17], [1995, 3.49], [2000, 4.66], [2005, 6.42], [2010, 8.49], [2015, 11.7], [2020, 15.4], [2025, 21.5]];
  function chartM2(animate) {
    const box = $('#chart-m2');
    if (!box) return;
    const narrow = box.clientWidth < 520;
    const { svg, w, h, tip } = svgFor(box, clamp(box.clientWidth * 0.62, 240, 380));
    const m = { l: 44, r: 8, t: 28, b: 28 };
    const band = (w - m.l - m.r) / M2.length;
    const bw = Math.max(6, band - 2 - band * 0.28);
    const Y = v => m.t + (1 - v / 24) * (h - m.t - m.b);
    svg.style.color = 'var(--accent)';
    [0, 5, 10, 15, 20].forEach(v => {
      el('line', { class: 'grid-line', x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v) }, svg);
      el('text', { class: 'axis-t', x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg).textContent = '$' + v + 'T';
    });
    M2.forEach(([yr, v], i) => {
      const x = m.l + i * band + (band - bw) / 2;
      const y0 = Y(0), y1 = Y(v), r = Math.min(4, bw / 2, y0 - y1);
      const d = `M${x} ${y0} L${x} ${y1 + r} Q${x} ${y1} ${x + r} ${y1} L${x + bw - r} ${y1} Q${x + bw} ${y1} ${x + bw} ${y1 + r} L${x + bw} ${y0} Z`;
      const p = el('path', { class: 'bar', d, fill: 'currentColor', opacity: yr >= 2020 ? 1 : 0.62 }, svg);
      if (animate) {
        p.style.transform = 'scaleY(0)';
        p.style.transitionDelay = (i * 60) + 'ms';
        requestAnimationFrame(() => requestAnimationFrame(() => { p.style.transform = 'scaleY(1)'; }));
      }
      if (!narrow || i % 2 === 0 || i === M2.length - 1) {
        el('text', { class: 'axis-t', x: x + bw / 2, y: h - 8, 'text-anchor': 'middle' }, svg).textContent = narrow ? "'" + String(yr).slice(2) : yr;
      }
      const hit = el('rect', { x: m.l + i * band, y: m.t, width: band, height: h - m.t - m.b, fill: 'transparent' }, svg);
      const show = () => showTip(tip, (x + bw / 2) * (svg.getBoundingClientRect().width / w), y1 * (svg.getBoundingClientRect().height / h), `<b>${t('{amount} trillion', { amount: '$' + v.toFixed(2) })}</b>${t('M2 · January {year}', { year: yr })}`);
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerdown', show);
      hit.addEventListener('pointerleave', () => tip.classList.remove('on'));
    });
    const lastX = m.l + (M2.length - 1) * band + band / 2;
    el('text', { class: 'lbl-t', x: lastX, y: Y(21.5) - 10, 'text-anchor': 'end' }, svg).textContent = '$21.5T';
    el('text', { class: 'lbl-s', x: m.l + band / 2 - bw / 2, y: Y(0.3) - 10 }, svg).textContent = '$0.3T';
  }

  /* ---------- Bitcoin supply schedule ---------- */
  const DAY = 864e5;
  const HALVINGS = [Date.UTC(2009, 0, 3), Date.UTC(2012, 10, 28), Date.UTC(2016, 6, 9), Date.UTC(2020, 4, 11), Date.UTC(2024, 3, 20)];
  const EPOCH_MS = 210000 * 600000;
  const epochStart = i => i < HALVINGS.length ? HALVINGS[i] : HALVINGS[HALVINGS.length - 1] + (i - HALVINGS.length + 1) * EPOCH_MS;
  function supplyAtTime(t) {
    let s = 0;
    for (let i = 0; i < 34; i++) {
      const a = epochStart(i), b = epochStart(i + 1), coins = 210000 * 50 / 2 ** i;
      if (t >= b) { s += coins; continue; }
      if (t > a) s += coins * (t - a) / (b - a);
      break;
    }
    return Math.min(s, 20999999.9769);
  }
  function supplyAtHeight(h) {
    let s = 0, left = h + 1;
    for (let i = 0; i < 34 && left > 0; i++) {
      const n = Math.min(left, 210000);
      s += n * Math.floor(50e8 / 2 ** i) / 1e8;
      left -= n;
    }
    return s;
  }
  const yearToMs = y => Date.UTC(Math.floor(y), 0, 1) + (y % 1) * 365.25 * DAY;
  const msToYear = t => { const d = new Date(t); const y = d.getUTCFullYear(); return y + (t - Date.UTC(y, 0, 1)) / (365.25 * DAY); };

  function chartSupply(animate) {
    const data = [];
    for (let y = 2009; y <= 2140; y += 0.25) data.push([y, supplyAtTime(yearToMs(y)) / 1e6]);
    const nowY = msToYear(Date.now());
    const nowS = supplyAtTime(Date.now()) / 1e6;
    lineChart($('#chart-supply'), {
      data, x: [2009, 2140], y: [0, 22],
      height: w => clamp(w * 0.3, 200, 300),
      xTicks: [2009, 2020, 2040, 2060, 2080, 2100, 2120, 2140],
      xTicksNarrow: [2009, 2060, 2100, 2140],
      yTicks: [0, 5, 10, 15, 21], fy: v => v + 'M', fx: v => v,
      color: 'var(--orange)',
      sample: xv => { const y = clamp(xv, 2009, 2140); return [y, supplyAtTime(yearToMs(y)) / 1e6]; },
      tip: (x, y) => `<b>${fmt(y, 2)}M BTC</b>${t('{year} · {pct}% mined', { year: Math.floor(x), pct: (y / 21 * 100).toFixed(1) })}`,
      extra: ({ svg, X, Y, w, m, narrow }) => {
        el('line', { x1: m.l, x2: w - m.r, y1: Y(21), y2: Y(21), stroke: 'var(--orange)', 'stroke-dasharray': '4 5', opacity: 0.5 }, svg);
        el('text', { class: 'ann-t', x: w - m.r, y: Y(21) - 8, 'text-anchor': 'end' }, svg).textContent = t('Hard cap · 21,000,000');
        HALVINGS.slice(1).forEach(t => {
          const y = msToYear(t);
          el('circle', { cx: X(y), cy: Y(supplyAtTime(t) / 1e6), r: 3, fill: 'var(--bg)', stroke: 'var(--orange)', 'stroke-width': 1.5 }, svg);
        });
        el('line', { class: 'ann-line', x1: X(nowY), x2: X(nowY), y1: Y(nowS), y2: Y(0) }, svg);
        const lab = el('text', { class: 'lbl-t', x: X(nowY) + 10, y: Y(nowS) + 30 }, svg);
        lab.textContent = t('Today · {pct}% mined', { pct: (nowS / 21 * 100).toFixed(1) });
        if (!narrow) {
          el('text', { class: 'ann-t', x: X(2016), y: Y(4) }, svg).textContent = t('○ halvings: 2012 · 2016 · 2020 · 2024 …');
        }
      },
    }, animate);
  }

  // Live supply counter (estimate from schedule, refined by the real block height if reachable)
  (function liveSupply() {
    const vEl = $('#live-supply'), pEl = $('#live-pct'), hEl = $('#live-height');
    if (!vEl) return;
    let anchor = null; // { t, height }
    const HALVING_4 = Date.UTC(2024, 3, 20, 0, 9);
    function estHeight(t) {
      if (anchor) return anchor.height + (t - anchor.t) / 600000;
      return 840000 + (t - HALVING_4) / 600000;
    }
    function tick() {
      const t = Date.now();
      const hgt = estHeight(t);
      const whole = Math.floor(hgt);
      const s = supplyAtHeight(whole - 1) + (hgt - whole) * (50 / 2 ** Math.floor(whole / 210000));
      vEl.textContent = fmt(s, 3);
      pEl.textContent = (s / 21e6 * 100).toFixed(2) + '%';
      hEl.textContent = fmt(whole);
    }
    tick();
    setInterval(tick, 1000);
    const ctl = 'AbortController' in window ? new AbortController() : null;
    setTimeout(() => ctl?.abort(), 5000);
    fetch('https://mempool.space/api/blocks/tip/height', { signal: ctl?.signal })
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(txt => { const h = parseInt(txt, 10); if (h > 800000) { anchor = { t: Date.now(), height: h + 0.5 }; tick(); } })
      .catch(() => {});
  })();

  /* ---------- Chart: yearly new supply (hardness) ---------- */
  const HARD = [
    { k: t('US dollar'), s: t('M2, avg since 1960'), v: 6.8, c: 'var(--red)' },
    { k: t('Gold'), s: t('new mine supply'), v: 1.7, c: 'var(--gold)' },
    { k: 'Bitcoin', s: '2024–2028', v: 0.83, c: 'var(--orange)' },
    { k: 'Bitcoin', s: '2028–2032', v: 0.40, c: 'var(--orange)' },
    { k: 'Bitcoin', s: t('after ~2140'), v: 0, c: 'var(--orange)' },
  ];
  function chartHard(animate) {
    const box = $('#chart-hard');
    if (!box) return;
    const rowH = 58;
    const { svg, w, h } = svgFor(box, HARD.length * rowH + 10);
    const narrow = w < 460;
    const lw = narrow ? 138 : 170;
    const max = 7.5;
    const X = v => lw + (v / max) * (w - lw - 60);
    HARD.forEach((d, i) => {
      const y = i * rowH + 12;
      el('text', { class: 'lbl-t', x: 0, y: y + 14 }, svg).textContent = d.k;
      el('text', { class: 'axis-t', x: 0, y: y + 32 }, svg).textContent = d.s;
      el('rect', { x: lw, y: y + 4, width: w - lw - 60, height: 26, rx: 4, fill: 'rgba(255,255,255,.035)' }, svg);
      const bw = Math.max(d.v > 0 ? 4 : 0, X(d.v) - lw);
      const r = el('rect', { class: 'hbar', x: lw, y: y + 4, width: bw, height: 26, rx: 4, fill: d.c }, svg);
      if (animate) {
        r.style.transform = 'scaleX(0)';
        r.style.transitionDelay = (i * 140) + 'ms';
        requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transform = 'scaleX(1)'; }));
      }
      el('text', { class: 'lbl-t', x: lw + bw + 10, y: y + 22 }, svg).textContent = d.v === 0 ? '0%' : (d.v < 1 ? '~' + d.v.toFixed(1) : '~' + d.v) + '%';
    });
  }

  // Register chart inits (first reveal animates) and re-render on resize
  const chartRegistry = [
    ['purchasing', chartPP], ['m2', chartM2], ['supply', chartSupply], ['hardness', chartHard],
  ];
  const drawn = new Set();
  chartRegistry.forEach(([id, fn]) => {
    inits[id] = () => { fn(!reduced); drawn.add(id); };
  });
  let lastW = innerWidth;
  addEventListener('resize', debounce(() => {
    if (Math.abs(innerWidth - lastW) < 2) return;
    lastW = innerWidth;
    chartRegistry.forEach(([id, fn]) => { if (drawn.has(id)) fn(false); });
  }, 180));

  /* ------------------------------------------------------------------
     Glass beads
     ------------------------------------------------------------------ */
  inits[slides.find(s => s.querySelector('.bead-strand'))?.id] = () => {
    const box = $('.bead-strand');
    if (!box || box.childElementCount) return;
    const cols = [
      ['#2f6fb5', '#9cc3f0'], ['#b8322a', '#f08a6e'], ['#e3b65a', '#fff0b8'], ['#2f8f6b', '#9ee0bf'],
      ['#e9e2d4', '#ffffff'], ['#6b3fa0', '#c9a6f2'], ['#14161a', '#5a5f6a'],
    ];
    const n = 30;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const rx = 40 + Math.sin(i * 1.7) * 1.5, ry = 34 + Math.cos(i * 2.3) * 1.5;
      const x = 50 + Math.cos(a) * rx, y = 52 + Math.sin(a) * ry + (Math.sin(a) > 0 ? Math.sin(a) * 6 : 0);
      const [c1, c2] = cols[i % cols.length];
      const s = 7 + (i % 3) * 1.4;
      const b = document.createElement('span');
      b.className = 'bead';
      b.style.cssText = `left:${x}%;top:${y}%;width:${s}%;height:${s * 0.82}%;animation-delay:${i * 40}ms;background:repeating-linear-gradient(${(i * 37) % 180}deg, ${c1} 0 22%, ${c2} 22% 30%, ${c1} 30% 52%);`;
      box.appendChild(b);
    }
  };

  /* ------------------------------------------------------------------
     SHA-256 (synchronous, for the mining demo)
     ------------------------------------------------------------------ */
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const W64 = new Uint32Array(64);
  const enc = new TextEncoder();
  function sha256(str) {
    const bytes = enc.encode(str);
    const l = bytes.length;
    const total = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total);
    buf.set(bytes);
    buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(l / 0x20000000));
    dv.setUint32(total - 4, (l << 3) >>> 0);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
        h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = W64;
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  window.__sha256 = sha256; // handy for checking in the console

  /* ------------------------------------------------------------------
     Mining demo
     ------------------------------------------------------------------ */
  (function miner() {
    const box = $('.miner');
    if (!box) return;
    const data = $('#mine-data'), nonceEl = $('#mine-nonce'), hashEl = $('#mine-hash'),
          status = $('#mine-status'), btn = $('#mine-btn'), vbtn = $('#verify-btn');
    let diff = 4, running = false, nonce = 0, found = null, t0 = 0;
    const segBtns = $$('.miner .seg button');
    segBtns.forEach(b => b.addEventListener('click', () => {
      segBtns.forEach(x => x.setAttribute('aria-checked', String(x === b)));
      diff = +b.dataset.diff;
      reset();
    }));
    const payload = n => `${data.value}|nonce:${n}`;
    const target = () => '0'.repeat(diff);
    function paint(hash, ok) {
      const z = hash.match(/^0*/)[0].length;
      hashEl.innerHTML = `<span class="${ok ? 'z' : ''}">${hash.slice(0, z)}</span>${hash.slice(z)}`;
    }
    function reset() {
      running = false; found = null; nonce = 0;
      box.classList.remove('found');
      btn.textContent = t('Start mining');
      vbtn.disabled = true;
      nonceEl.textContent = '0';
      hashEl.textContent = '–';
      status.textContent = t('Press start. Your browser will guess until it finds a valid hash.');
    }
    function loop() {
      if (!running) return;
      const tgt = target();
      const end = nonce + 4000;
      let h;
      for (; nonce < end; nonce++) {
        h = sha256(payload(nonce));
        if (h.startsWith(tgt)) {
          running = false;
          found = { nonce, hash: h, data: data.value };
          const secs = (performance.now() - t0) / 1000;
          nonceEl.textContent = fmt(nonce);
          paint(h, true);
          box.classList.add('found');
          btn.textContent = t('Mine again');
          vbtn.disabled = false;
          status.innerHTML = t('<span class="pos">Block found!</span> It took <strong>{n}</strong> guesses in {s}s. Now verify it, or edit the data and see what breaks.', { n: fmt(nonce + 1), s: secs.toFixed(2) });
          return;
        }
      }
      nonceEl.textContent = fmt(nonce);
      paint(h, false);
      status.textContent = t('Guessing… {n} hashes per second', { n: fmt(Math.round(nonce / Math.max(0.001, (performance.now() - t0) / 1000))) });
      requestAnimationFrame(loop);
    }
    btn.addEventListener('click', () => {
      if (running) { running = false; btn.textContent = t('Resume mining'); status.textContent = t('Paused.'); return; }
      if (found) { nonce = 0; found = null; box.classList.remove('found'); vbtn.disabled = true; }
      running = true; t0 = performance.now() - (nonce ? 1 : 0);
      btn.textContent = '■ ' + t('Stop');
      loop();
    });
    vbtn.addEventListener('click', () => {
      if (!found) return;
      const t = performance.now();
      const h = sha256(payload(found.nonce));
      const ms = performance.now() - t;
      const ok = h.startsWith(target());
      paint(h, ok);
      status.innerHTML = ok
        ? t('<span class="pos">✓ Valid.</span> Checked with <strong>one</strong> hash in {time}. Finding it took {n}. That asymmetry is the whole trick.', { time: ms < 0.1 ? t('a fraction of a millisecond') : ms.toFixed(2) + ' ms', n: fmt(found.nonce + 1) })
        : t('<span class="neg">✗ Invalid.</span> The data changed, so the old proof no longer fits. Every node would reject this block.');
    });
    data.addEventListener('input', () => {
      if (running) { running = false; }
      if (!found) { reset(); return; }
      const h = sha256(payload(found.nonce));
      const ok = h.startsWith(target());
      paint(h, ok);
      box.classList.toggle('found', ok);
      btn.textContent = t('Re-mine');
      status.innerHTML = ok
        ? t('<span class="pos">Still valid.</span>')
        : t('<span class="neg">Tampered!</span> Same nonce, one edit, completely different hash. Re-mining is the only way to fix it, and on the real network that means outrunning everyone.');
    });
  })();

  /* ------------------------------------------------------------------
     Seed phrase illustration
     ------------------------------------------------------------------ */
  (function seed() {
    const grid = $('#seed-grid');
    if (!grid) return;
    const WORDS = 'ocean lemon rocket garden silver thunder orange planet tribe honey castle maple river canyon eagle forest island jungle kitten ladder marble nephew orbit piano rabbit saddle tiger umbrella valley wagon yellow zebra anchor bamboo cactus dolphin fossil galaxy harvest ivory jacket kingdom lunar mirror noble oxygen pepper puzzle raven shadow symbol tunnel velvet winter brave crystal dragon energy frost glove hammer satoshi'.split(' ').filter(w => w !== 'satoshi');
    function shuffle() {
      const pool = WORDS.slice();
      const out = [];
      for (let i = 0; i < 12; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      grid.innerHTML = out.map((w, i) => `<li style="--i:${i}">${w}</li>`).join('');
    }
    shuffle();
    $('#seed-btn').addEventListener('click', shuffle);
  })();

  /* ------------------------------------------------------------------
     Comparison matrix
     ------------------------------------------------------------------ */
  (function matrix() {
    const table = $('#matrix');
    if (!table) return;
    const COLS = [
      { k: t('Cash'), s: t('Fiat money') },
      { k: t('Gold'), s: t('Physical') },
      { k: t('Real estate'), s: t('Land, buildings') },
      { k: t('Stocks'), s: t('Equities') },
      { k: t('Bitcoin'), s: t('Digital, sound'), btc: true },
    ];
    const ROWS = [
      [t('Scarcity'), [[1, t('Unlimited printing')], [3, t('~1.7% new per year')], [2, t('More can be built')], [2, t('Dilution, new issues')], [3, t('Fixed at 21M')]]],
      [t('Portability'), [[2, t('Needs permission')], [1, t('Heavy, guarded')], [1, t('Immovable')], [2, t('Through brokers')], [3, t('12 words, global')]]],
      [t('Divisibility'), [[3, t('Down to cents')], [2, t('Hard to split')], [1, t("Can't sell a room")], [3, t('Fractional shares')], [3, t('100M sats each')]]],
      [t('Verifiability'), [[2, t('Counterfeits exist')], [1, t('Fake bars exist')], [2, t('Lawyers, registries')], [2, t('Trust the auditors')], [3, t('Anyone, in seconds')]]],
      [t('Seizure resistance'), [[1, t('Freezes, bail-ins')], [2, t('Confiscated in 1933')], [1, t('Taxed, expropriated')], [1, t('Held by custodians')], [3, t('Self-custody')]]],
      [t('No middleman needed'), [[1, t('Bank, central bank')], [3, t('If you hold it')], [2, t('Title, state, tax')], [1, t('Managers, brokers')], [3, t('In self-custody')]]],
      [t('Cost to hold'), [[1, t('Inflation tax')], [2, t('Vaults, insurance')], [1, t('Taxes, upkeep')], [2, t('Fees, dilution')], [3, t('Near zero')]]],
      [t('Open 24/7, global'), [[2, t('Bank hours')], [1, t('Slow, physical')], [1, t('Months to sell')], [2, t('Market hours')], [3, '24/7/365']]],
      [t('Price stability today'), [[3, t('Short-term')], [3, t('Mature market')], [3, t('Mostly')], [2, t('Cyclical')], [1, t('Volatile (young)')]]],
      [t('Track record'), [[2, t('Decades')], [3, t('5,000 years')], [3, t('Centuries')], [3, t('Centuries')], [2, t('Since 2009')]]],
    ];
    const VERDICT = [
      t('A melting ice cube. Great for spending, terrible for saving. It is designed to lose purchasing power every year.'),
      t("The hardest money for 5,000 years. But you can't email it, it's hard to verify, and governments have confiscated it before."),
      t("Shelter turned into a savings account. Illiquid, taxed and immovable, and you can't sell a bedroom to buy groceries."),
      t('A claim on businesses that others run. Valuable, but diluted and custodied, and part of the "growth" is just money losing value.'),
      t('Scarcer than gold, more portable than cash, divisible like stocks, and the only one you can truly own without anyone\'s permission. The trade-offs: volatility while it grows up, and the responsibility of holding your own keys.'),
    ];
    const mq = matchMedia('(max-width: 760px)');
    let order = [0, 1, 2, 3, 4];
    const pips = r => `<span class="pips" data-r="${r}" aria-hidden="true"><i></i><i></i><i></i></span>`;
    const word = r => ['', t('weak'), t('fair'), t('strong')][r];
    function render() {
    order = mq.matches ? [4, 0, 1, 2, 3] : [0, 1, 2, 3, 4];
    table.innerHTML = `
      <caption class="sr-only" style="position:absolute;left:-9999px">${t('Comparison of cash, gold, real estate, stocks and bitcoin')}</caption>
      <thead><tr><th scope="col" style="padding:14px;font-family:var(--mono);font-size:.68rem;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;font-weight:500">${t('Property')}</th>
        ${order.map(i => { const c = COLS[i]; return `<th scope="col" data-col="${i}" class="${c.btc ? 'btc' : ''}"><button type="button" data-col="${i}">${c.k}<small>${c.s}</small></button></th>`; }).join('')}
      </tr></thead>
      <tbody>${ROWS.map(([name, cells]) => `<tr><th scope="row">${name}</th>${order.map(i => { const [r, t] = cells[i]; return `<td data-col="${i}" class="${COLS[i].btc ? 'btc' : ''}"><span class="cell">${pips(r)}<span>${t}<span style="position:absolute;left:-9999px"> (${word(r)})</span></span></span></td>`; }).join('')}</tr>`).join('')}
      </tbody>`;
    }
    render();
    const verdict = $('#verdict');
    function select(i) {
      $$('[data-col]', table).forEach(c => c.classList.toggle('sel', +c.dataset.col === i));
      verdict.classList.toggle('is-btc', !!COLS[i].btc);
      verdict.innerHTML = `<h3 class="swap">${COLS[i].k}</h3><p class="swap">${VERDICT[i]}</p>`;
    }
    table.addEventListener('click', e => {
      const c = e.target.closest('[data-col]');
      if (c) select(+c.dataset.col);
    });
    table.addEventListener('pointerover', e => {
      const c = e.target.closest('thead [data-col]');
      if (c && matchMedia('(hover: hover)').matches) select(+c.dataset.col);
    });
    select(4);
    let selected = 4;
    table.addEventListener('click', e => { const c = e.target.closest('[data-col]'); if (c) selected = +c.dataset.col; });
    mq.addEventListener?.('change', () => { render(); select(selected); });
  })();

  /* ------------------------------------------------------------------
     Language picker — keeps the current slide when switching
     ------------------------------------------------------------------ */
  (function languages() {
    const btn = $('#lang-btn'), pop = $('#lang-pop');
    if (!btn || !pop) return;
    const lang = (root.lang || 'en').slice(0, 2);
    $('#lang-code').textContent = lang.toUpperCase();
    $$('a', pop).forEach(a => a.setAttribute('aria-current', String(a.dataset.lang === lang)));
    const open = on => {
      pop.hidden = !on;
      btn.setAttribute('aria-expanded', String(on));
      if (on) requestAnimationFrame(() => pop.classList.add('open')); else pop.classList.remove('open');
    };
    btn.addEventListener('click', e => { e.stopPropagation(); open(pop.hidden); });
    pop.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      try { localStorage.setItem('op-lang', a.dataset.lang); } catch (_) { /* storage blocked */ }
      location.href = a.getAttribute('href') + location.hash;
    });
    document.addEventListener('click', e => { if (!pop.hidden && !e.target.closest('.lang-wrap')) open(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) open(false); });
  })();

  /* ------------------------------------------------------------------
     Music: plays assets/music/soundtrack.mp3 if it exists (off until asked).
     The controls stay hidden until the file is found. Playback goes through
     Web Audio so the loop is sample-accurate (an <audio loop> leaves a gap);
     the plain <audio> element is the fallback.
     ------------------------------------------------------------------ */
  const music = $('#music');
  const soundBtn = $('#sound-btn');
  const soundHints = $$('[data-sound-toggle]');
  const MUSIC_VOLUME = 0.45;
  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null, gain = null, loading = null, on = false, fadeTimer = null;
  function setSoundUI(state) {
    soundBtn.setAttribute('aria-pressed', String(state));
    soundBtn.querySelector('.sound-label').textContent = state ? t('Music on') : t('Music off');
    soundHints.forEach(b => {
      b.setAttribute('aria-pressed', String(state));
      b.querySelector('span').textContent = state ? t('Music playing · tap to mute') : t('Turn on the music');
    });
  }
  // decode once, find where the sound really starts and ends (MP3 padding), loop exactly that span
  function load() {
    if (loading) return loading;
    loading = fetch(music.getAttribute('src'))
      .then(r => r.arrayBuffer())
      .then(data => new Promise((res, rej) => actx.decodeAudioData(data, res, rej)))
      .then(buf => {
        const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
        const loud = i => chans.some(d => Math.abs(d[i]) > 0.002);
        let a = 0, z = buf.length - 1;
        while (a < z && !loud(a)) a++;
        while (z > a && !loud(z)) z--;
        const src = actx.createBufferSource();
        src.buffer = buf; src.loop = true;
        src.loopStart = a / buf.sampleRate; src.loopEnd = (z + 1) / buf.sampleRate;
        src.connect(gain); src.start(0, src.loopStart);
      });
    return loading;
  }
  function fadeTo(v, sec) {
    const now = actx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(v, now + sec);
  }
  function fadeElement(to, ms, done) {
    clearInterval(fadeTimer);
    const from = music.volume, start = performance.now();
    fadeTimer = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / ms);
      music.volume = from + (to - from) * p;
      if (p >= 1) { clearInterval(fadeTimer); done?.(); }
    }, 30);
  }
  function toggleSound() {
    if (!music || soundBtn.hidden) return;
    on = !on;
    setSoundUI(on);
    if (!AC) {                                   // fallback: plain <audio loop>
      if (on) { music.volume = 0; music.play().then(() => fadeElement(MUSIC_VOLUME, 1500)).catch(() => { on = false; setSoundUI(false); }); }
      else fadeElement(0, 800, () => music.pause());
      return;
    }
    if (on) {
      if (!actx) {                               // created inside the click so mobile browsers allow sound
        actx = new AC();
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* iOS: play even on silent */ }
        gain = actx.createGain(); gain.gain.value = 0; gain.connect(actx.destination);
      }
      actx.resume().then(load).then(() => { if (on) fadeTo(MUSIC_VOLUME, 1.5); })
        .catch(() => { on = false; setSoundUI(false); });
    } else if (actx) {
      fadeTo(0, .8);
      setTimeout(() => { if (!on) actx.suspend(); }, 850);
    }
  }
  if (music) {
    fetch(music.getAttribute('src'), { method: 'HEAD' })
      .then(r => { if (r.ok) { soundBtn.hidden = false; soundHints.forEach(b => { b.hidden = false; }); } })
      .catch(() => {});
  }
  soundBtn?.addEventListener('click', toggleSound);
  soundHints.forEach(b => b.addEventListener('click', toggleSound));

  /* ------------------------------------------------------------------
     Hero pill: gentle 3D tilt toward the pointer
     ------------------------------------------------------------------ */
  (function tilt() {
    const stage = $('.pill-stage'), pill = $('#pill-tilt'), hero = $('.hero');
    if (!stage || !pill || reduced || !matchMedia('(hover: hover)').matches) return;
    hero.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const dx = clamp((e.clientX - (r.left + r.width / 2)) / r.width, -1, 1);
      const dy = clamp((e.clientY - (r.top + r.height / 2)) / r.height, -1, 1);
      pill.style.setProperty('--ty', (dx * 20).toFixed(2) + 'deg');
      pill.style.setProperty('--tx', (-dy * 16).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', () => {
      pill.style.setProperty('--tx', '0deg');
      pill.style.setProperty('--ty', '0deg');
    });
  })();

  /* ------------------------------------------------------------------
     Share
     ------------------------------------------------------------------ */
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('on'), 2200);
  }
  const shareUrl = () => document.querySelector('link[rel=canonical]')?.href || location.href.split('#')[0];
  const shareText = t("You're not bad with money. Your money is bad. 🟠 A free 20-minute interactive presentation on inflation, money and bitcoin:");
  $$('[data-share]').forEach(a => {
    const u = encodeURIComponent(shareUrl()), t = encodeURIComponent(shareText);
    const links = {
      x: `https://x.com/intent/post?text=${t}&url=${u}`,
      telegram: `https://t.me/share/url?url=${u}&text=${t}`,
      whatsapp: `https://wa.me/?text=${t}%20${u}`,
    };
    if (links[a.dataset.share]) a.href = links[a.dataset.share];
    else a.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(shareUrl()); toast(t('Link copied. Pass it on 🧡')); } catch (_) { toast(shareUrl()); }
    });
  });
  $('#share-btn')?.addEventListener('click', async () => {
    const url = shareUrl();
    const data = { title: t('The Orange Pill'), text: shareText, url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(url);
      toast(t('Link copied. Pass it on 🧡'));
    } catch (_) { /* user cancelled */ }
  });

  /* ------------------------------------------------------------------
     utils
     ------------------------------------------------------------------ */
  function debounce(fn, ms) {
    let h;
    return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
  }
})();
