// Translation build for The Orange Pill.
//
// English (index.html + the t('…') strings in js/main.js) is the single source.
//
//   node tools/i18n.mjs extract   → i18n/en.json: every translatable string, keyed by a hash of its English text
//   node tools/i18n.mjs status    → how many strings each language is missing
//   node tools/i18n.mjs build     → <lang>/index.html for every language, plus hreflang links, sitemap.xml and robots.txt
//
// A translation file (i18n/es.json, …) maps the same keys to translated text. Inline markup inside a
// string (<strong>, <em>, <br>, <span …>) must be kept. Missing keys fall back to English, so after
// editing English text, run `extract`, then `status`, then translate the new keys.
import { parseHTML } from 'linkedom';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'index.html');
const JS = path.join(ROOT, 'js', 'main.js');
const DIR = path.join(ROOT, 'i18n');

export const LANGS = {
  en: { name: 'English' },
  es: { name: 'Español' },
  pt: { name: 'Português' },
  fr: { name: 'Français' },
  de: { name: 'Deutsch' },
  pl: { name: 'Polski' },
  ru: { name: 'Русский', css: 'fonts-ru.css', serif: "'Playfair Display', 'Fraunces', Georgia, serif" },
  tr: { name: 'Türkçe' },
  // Chinese and Japanese use the visitor's built-in system fonts (CJK web fonts are several MB)
  zh: { name: '中文', serif: "'Fraunces', 'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', 'SimSun', serif", sans: "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif", cjk: true },
  ja: { name: '日本語', serif: "'Fraunces', 'Hiragino Mincho ProN', 'Yu Mincho', 'YuMincho', 'Noto Serif CJK JP', 'Source Han Serif JP', serif", sans: "'Inter', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'YuGothic', 'Meiryo', 'Noto Sans CJK JP', sans-serif", cjk: true },
  hi: { name: 'हिन्दी', css: 'fonts-hi.css', serif: "'Fraunces', 'Noto Serif Devanagari', serif", sans: "'Inter', 'Noto Sans Devanagari', sans-serif", cjk: true },
};

// standalone pages that are listed in the sitemap but not translated
const EXTRA = ['video/'];

const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT', 'TEMPLATE', 'AUDIO', 'CANVAS']);
const ATTRS = ['aria-label', 'alt', 'title', 'placeholder', 'data-toc', 'data-chapter'];
const META = ['description', 'og:title', 'og:description', 'og:image:alt', 'twitter:title', 'twitter:description'];
const norm = s => s.replace(/\s+/g, ' ').trim();
const key = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const hasLetter = s => /\p{L}/u.test(s);
const read = f => fs.readFileSync(f, 'utf8');
const readJSON = f => (fs.existsSync(f) ? JSON.parse(read(f)) : {});

/** Visits every translatable string in document order. */
function collect(doc, visit) {
  const title = doc.querySelector('title');
  if (title) visit({ el: title, kind: 'text', en: norm(title.textContent) });
  for (const m of doc.querySelectorAll('meta')) {
    const k = m.getAttribute('name') || m.getAttribute('property');
    if (META.includes(k)) visit({ el: m, kind: 'attr', attr: 'content', en: norm(m.getAttribute('content')) });
  }
  (function walk(el) {
    if (SKIP.has(el.tagName.toUpperCase()) || el.getAttribute('translate') === 'no') return;
    for (const a of ATTRS) {
      if (el.hasAttribute(a)) {
        const v = norm(el.getAttribute(a));
        if (hasLetter(v)) visit({ el, kind: 'attr', attr: a, en: v });
      }
    }
    const directText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (directText && el.tagName !== 'BODY' && hasLetter(el.textContent)) {
      visit({ el, kind: 'html', en: norm(el.innerHTML) });
      return;
    }
    for (const c of el.children) walk(c);
  })(doc.body);
}

function jsStrings() {
  const out = [];
  const re = /\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
  for (const m of read(JS).matchAll(re)) out.push(m[2].replace(/\\(['"\\])/g, '$1'));
  return [...new Set(out)];
}

function extract() {
  const { document } = parseHTML(read(SRC));
  const en = {};
  collect(document, ({ en: text }) => { en[key(text)] = text; });
  for (const s of jsStrings()) en[key(s)] = s;
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'en.json'), JSON.stringify(en, null, 1) + '\n');
  const words = Object.values(en).join(' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  console.log(`i18n/en.json: ${Object.keys(en).length} strings, ~${words} words`);
  return en;
}

function status() {
  const en = extract();
  for (const lang of Object.keys(LANGS).filter(l => l !== 'en')) {
    const dict = readJSON(path.join(DIR, `${lang}.json`));
    const missing = Object.keys(en).filter(k => !dict[k]);
    const stale = Object.keys(dict).filter(k => !en[k]);
    console.log(`${lang}: ${Object.keys(en).length - missing.length}/${Object.keys(en).length} translated` + (stale.length ? `, ${stale.length} unused` : ''));
  }
}

function siteUrl(doc) {
  return doc.querySelector('link[rel="canonical"]').getAttribute('href').replace(/\/?$/, '/');
}

function alternates(url) {
  return Object.keys(LANGS).map(l => `<link rel="alternate" hreflang="${l}" href="${url}${l === 'en' ? '' : l + '/'}">`).join('\n  ')
    + `\n  <link rel="alternate" hreflang="x-default" href="${url}">`;
}

function build() {
  const en = extract();
  let src = read(SRC);
  const url = siteUrl(parseHTML(src).document);

  // hreflang block in the English source (idempotent)
  const block = `<!-- i18n:alternates -->\n  ${alternates(url)}\n  <!-- /i18n:alternates -->`;
  if (src.includes('<!-- i18n:alternates -->')) src = src.replace(/<!-- i18n:alternates -->[\s\S]*?<!-- \/i18n:alternates -->/, block);
  else src = src.replace(/(<link rel="canonical"[^>]*>)/, `$1\n  ${block}`);
  fs.writeFileSync(SRC, src);

  const js = jsStrings();
  for (const [lang, cfg] of Object.entries(LANGS)) {
    if (lang === 'en') continue;
    const dict = readJSON(path.join(DIR, `${lang}.json`));
    const { document } = parseHTML(src);
    let done = 0, missing = 0;
    collect(document, ({ el, kind, attr, en: text }) => {
      const tr = dict[key(text)];
      if (!tr) { missing++; return; }
      done++;
      if (kind === 'html') el.innerHTML = tr;
      else if (kind === 'attr') el.setAttribute(attr, tr);
      else el.textContent = tr;
    });
    const html = document.documentElement;
    html.setAttribute('lang', lang);

    // relative URLs move one level up
    for (const el of document.querySelectorAll('[href], [src]')) {
      for (const a of ['href', 'src']) {
        const v = el.getAttribute(a);
        if (v == null || /^(https?:|mailto:|data:|#|\/|javascript:)/.test(v)) continue;
        el.setAttribute(a, v === './' ? '../' : '../' + v);
      }
    }
    const here = `${url}${lang}/`;
    document.querySelector('link[rel="canonical"]').setAttribute('href', here);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', here);
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', lang);
    const ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) {
      const data = JSON.parse(ld.textContent);
      Object.assign(data, { inLanguage: lang, url: here, name: dict[key('The Orange Pill')] || data.name });
      ld.textContent = '\n  ' + JSON.stringify(data, null, 2).replace(/\n/g, '\n  ') + '\n  ';
    }

    // fonts for scripts the Latin fonts don't cover
    const head = document.querySelector('head');
    const css = document.querySelector('link[rel="stylesheet"][href$="style.css"]');
    let extra = '';
    if (cfg.css) extra += `<link rel="stylesheet" href="../css/${cfg.css}">\n  `;   // this language's own fonts, loaded only on its page
    const vars = [cfg.serif && `--serif: ${cfg.serif};`, cfg.sans && `--sans: ${cfg.sans};`].filter(Boolean).join(' ');
    let style = vars ? `:root { ${vars} }` : '';
    if (cfg.cjk) style += ' em, .o, .accent, .display em, .hero-sub em, blockquote p { font-style: normal; } h1, .display, .mega, .punch, .big-line, .hero-sub, .numeral { letter-spacing: 0; } h1 { line-height: 1.08; } .display, .chapter .display { line-height: 1.22; } .hero-sub, .punch, .big-line { line-height: 1.35; } .kicker, .mono, .src { letter-spacing: .06em; }';
    if (style) extra += `<style>${style}</style>\n  `;
    if (extra) {
      const tpl = parseHTML(`<html><head>${extra}</head></html>`).document.querySelector('head');
      for (const n of [...tpl.childNodes]) head.insertBefore(n, css.nextSibling);
    }

    // translated JS strings, keyed by their English text
    const map = {};
    for (const s of js) { const tr = dict[key(s)]; if (tr) map[s] = tr; }
    const main = document.querySelector('script[src$="js/main.js"]');
    const inject = parseHTML(`<html><body><script>window.I18N_JS = ${JSON.stringify(map).replace(/</g, '\\u003c')};</script></body></html>`).document.querySelector('script');
    main.parentNode.insertBefore(inject, main);
    const hash = crypto.createHash('sha256').update(inject.textContent).digest('base64');
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (csp) csp.setAttribute('content', csp.getAttribute('content').replace("script-src 'self'", `script-src 'self' 'sha256-${hash}'`));

    fs.mkdirSync(path.join(ROOT, lang), { recursive: true });
    fs.writeFileSync(path.join(ROOT, lang, 'index.html'), document.toString());
    console.log(`${lang}/index.html  ${done} translated, ${missing} missing`);
  }

  // sitemap with language alternates
  const urls = Object.keys(LANGS).map(l => `${url}${l === 'en' ? '' : l + '/'}`);
  const links = Object.keys(LANGS).map((l, i) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urls[i]}"/>`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(u => `  <url>\n    <loc>${u}</loc>\n${links}\n  </url>`).join('\n')}
${EXTRA.map(p => `  <url>\n    <loc>${url}${p}</loc>\n  </url>`).join('\n')}
</urlset>
`);
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${url}sitemap.xml\n`);
  console.log('sitemap.xml and robots.txt updated');
}

const cmd = process.argv[2];
if (cmd === 'extract') extract();
else if (cmd === 'status') status();
else if (cmd === 'build') build();
else console.log('usage: node tools/i18n.mjs extract | status | build');
