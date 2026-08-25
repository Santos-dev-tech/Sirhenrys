/* navfit.js - does the interface FIT on a phone?
 *
 * The complaint was "the nav is far bigger than the page". Clicking around proves
 * nothing (see the 0x0 burger in HANDOVER), so this measures, at three phone
 * widths, on both halves of the app:
 *
 *   - document.scrollWidth vs innerWidth        (horizontal overflow of the page)
 *   - every element whose box sticks out past the right edge, named
 *   - the header, its inner row, and the burger
 *   - the mnav drawer OPEN: its width vs the viewport, and whether its content
 *     is taller than it can scroll
 *   - the console sidebar OPEN: same questions
 *
 * Run: node tools/navfit.js            (server on 8100)
 */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://localhost:8100/index.html';
const WIDTHS = [430, 390, 360, 320];
const ROUTES = ['/', '/shop', '/product/carlo-navy', '/bespoke', '/lookbook', '/checkout', '/account', '/stores'];

/* runs in the page: name everything that pokes out past the viewport */
function probe() {
  const vw = window.innerWidth;
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    /* a drawer parked off-screen left is not overflow */
    if (r.right <= vw + 1) continue;
    if (cs.position === 'fixed' && r.left >= vw) continue;
    const name = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ el: name, right: Math.round(r.right), w: Math.round(r.width), over: Math.round(r.right - vw) });
  }
  return {
    docW: document.documentElement.scrollWidth,
    bodyW: document.body.scrollWidth,
    vw,
    overflow: document.documentElement.scrollWidth > vw + 1,
    culprits: out.sort((a, b) => b.over - a.over).slice(0, 8)
  };
}

function boxOf(sel) {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top),
    display: cs.display, position: cs.position,
    scrollH: el.scrollHeight, clientH: el.clientHeight,
    scrollW: el.scrollWidth, clientW: el.clientWidth
  };
}

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const fails = [];
  const say = (ok, label, detail) => {
    console.log((ok ? 'PASS  ' : 'FAIL  ') + label);
    if (detail) console.log('        ' + detail);
    if (!ok) fails.push(label);
  };

  for (const width of WIDTHS) {
    console.log('\n==================== ' + width + 'px ====================');
    const p = await b.newPage();
    await p.setViewport({ width, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3500);
    await p.evaluate(f => { window.__probe = eval('(' + f + ')'); }, probe.toString());
    await p.evaluate(f => { window.__box = eval('(' + f + ')'); }, boxOf.toString());

    /* ---- storefront routes, nav closed ---- */
    for (const h of ROUTES) {
      await p.evaluate(r => { location.hash = r; }, h);
      await sleep(700);
      const res = await p.evaluate(() => window.__probe());
      say(!res.overflow, 'storefront ' + h + ' fits the viewport',
        res.docW + 'px doc vs ' + res.vw + 'px screen' +
        (res.culprits.length ? '  |  worst: ' + res.culprits.map(c => c.el + ' +' + c.over).join(', ') : ''));
    }

    /* ---- header furniture ---- */
    await p.evaluate(() => { location.hash = '/'; });
    await sleep(700);
    const hdr = await p.evaluate(() => ({
      hdr: window.__box('.hdr'), inner: window.__box('.hdr-in'),
      burger: window.__box('.burger'), nav: window.__box('.nav'),
      acts: window.__box('.hdr-acts') || window.__box('.acts')
    }));
    const h = hdr.hdr, hi = hdr.inner;
    say(!!h && h.w <= width + 1, 'header is no wider than the screen',
      h ? h.w + 'px header on a ' + width + 'px screen' : 'no .hdr found');
    say(!!hi && hi.h <= 96, 'header row is a sane height on a phone',
      hi ? hi.h + 'px tall (cap 96)' : 'no .hdr-in');
    say(!!hdr.burger && hdr.burger.w >= 40 && hdr.burger.h >= 40, 'burger is a real tap target',
      hdr.burger ? hdr.burger.w + 'x' + hdr.burger.h : 'burger missing');
    say(!hdr.nav || hdr.nav.display === 'none', 'desktop .nav is not painting on a phone',
      hdr.nav ? 'display:' + hdr.nav.display + ' w=' + hdr.nav.w : 'no .nav');

    /* ---- the drawer, OPEN ---- */
    await p.evaluate(() => document.querySelector('.burger').click());
    await sleep(650);
    const dr = await p.evaluate(() => ({
      mnav: window.__box('.mnav'),
      open: document.querySelector('.mnav').classList.contains('on'),
      page: window.__probe()
    }));
    const m = dr.mnav;
    say(dr.open, 'the burger opens the drawer', 'mnav.on = ' + dr.open);
    say(!!m && m.w <= width + 1 && m.left >= -1, 'drawer sits inside the screen',
      m ? m.w + 'px wide at left ' + m.left + ', right edge ' + m.right + ' on a ' + width + 'px screen' : 'no .mnav');
    say(!!m && m.scrollW <= m.clientW + 1, 'nothing in the drawer overflows it sideways',
      m ? 'scrollWidth ' + m.scrollW + ' vs clientWidth ' + m.clientW : '');
    say(!!m && m.h <= 844 + 1, 'drawer is no taller than the screen',
      m ? m.h + 'px tall on an 844px screen' : '');
    say(!dr.page.overflow, 'page does not overflow with the drawer open',
      dr.page.docW + 'px doc vs ' + dr.page.vw + 'px screen' +
      (dr.page.culprits.length ? '  |  ' + dr.page.culprits.map(c => c.el + ' +' + c.over).join(', ') : ''));
    await p.evaluate(() => document.querySelector('.burger').click());
    await sleep(450);

    /* ---- the console ---- */
    await p.evaluate(() => { location.hash = '/admin'; });
    await sleep(1400);
    const ad = await p.evaluate(() => ({
      page: window.__probe(),
      side: window.__box('.ad .side'),
      main: window.__box('.ad .main'),
      toggle: window.__box('.mtoggle'),
      locked: document.getElementById('ad').classList.contains('locked')
    }));
    say(!ad.page.overflow, 'console fits the viewport',
      ad.page.docW + 'px doc vs ' + ad.page.vw + 'px screen' +
      (ad.page.culprits.length ? '  |  ' + ad.page.culprits.map(c => c.el + ' +' + c.over).join(', ') : ''));
    if (ad.side) {
      say(ad.side.left <= -100 || ad.side.right <= width + 1, 'console sidebar is parked off-screen or fits',
        'left ' + ad.side.left + ', width ' + ad.side.w + ', right ' + ad.side.right);
      say(ad.side.w <= width + 1, 'console sidebar is no wider than the screen',
        ad.side.w + 'px sidebar on a ' + width + 'px screen');
    }
    await p.close();
  }

  console.log('\n==========================================================');
  console.log(fails.length ? fails.length + ' FAILING:\n  ' + fails.join('\n  ')
    : 'PASS - the interface fits at ' + WIDTHS.join(', ') + 'px');
  console.log('==========================================================');
  await b.close();
  process.exit(fails.length);
})();
