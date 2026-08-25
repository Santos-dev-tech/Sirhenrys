/* vptest.js - does the LAYOUT VIEWPORT equal the phone's width?
 *
 * This is the check the other harnesses were missing. They compared the document
 * against window.innerWidth - but innerWidth IS the layout viewport, and mobile
 * Chrome widens the layout viewport to fit content that sticks out. So the page
 * always "fitted": 607px of document inside a 607px viewport on a 375px phone.
 *
 * Every percentage then resolves against 607. That is how .mnav{inset:0 30% 0 0}
 * became a 425px drawer on a 375px screen - the complaint that started this.
 *
 * The honest question is innerWidth vs the DEVICE width, so that is what this asks,
 * on both halves of the app, at four phone widths, with the drawer open and shut.
 *
 * Run: node tools/vptest.js          (server on 8100)
 */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = process.env.SH_BASE || 'http://localhost:8100/index.html';
const WIDTHS = [430, 390, 375, 360, 320];
const ROUTES = ['/', '/shop', '/product/carlo-navy', '/bespoke', '/lookbook', '/appointments', '/checkout', '/account', '/stores', '/contact'];

const fails = [];
function say(ok, label, detail) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (detail) console.log('        ' + detail);
  if (!ok) fails.push(label);
}

/* the widest unclipped thing past the device edge, named.
   body/html are not counted as clippers: body{overflow-x:hidden} only removes the
   scrollbar, it does not stop the content setting the width Chrome zooms out to. */
function culprits(deviceW) {
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
    (typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const clipped = el => {
    let n = el.parentElement;
    while (n && n !== document.body && n !== document.documentElement) {
      if (getComputedStyle(n).overflowX !== 'visible') return true;
      n = n.parentElement;
    }
    return false;
  };
  const out = [], seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.right <= deviceW + 1) continue;
    if (clipped(el)) continue;
    const k = name(el);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k + ' \u2192 right ' + Math.round(r.right) + ' (+' + Math.round(r.right - deviceW) + ')');
  }
  return out.slice(0, 5);
}

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });

  for (const W of WIDTHS) {
    console.log('\n==================== ' + W + 'px phone ====================');
    const p = await b.newPage();
    await p.setViewport({ width: W, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3500);
    await p.evaluate(f => { window.__cul = eval('(' + f + ')'); }, culprits.toString());

    for (const h of ROUTES) {
      await p.evaluate(r => { location.hash = r; }, h);
      await sleep(650);
      const r = await p.evaluate(dw => ({
        inner: window.innerWidth,
        client: document.documentElement.clientWidth,
        doc: document.documentElement.scrollWidth,
        cul: window.__cul(dw)
      }), W);
      say(r.inner <= W + 1,
        W + 'px  ' + h + '  layout viewport is the phone\'s width',
        'innerWidth ' + r.inner + ' vs device ' + W + (r.inner > W ? '  \u2190 zoomed out by ' + (r.inner - W) + 'px' : '') +
        (r.cul.length ? '\n        past the edge: ' + r.cul.join(', ') : ''));
    }

    /* the drawer, open - the thing that was complained about */
    await p.evaluate(() => { location.hash = '/'; });
    await sleep(700);
    await p.evaluate(() => document.querySelector('.burger').click());
    await sleep(600);
    const d = await p.evaluate(() => {
      const m = document.querySelector('.mnav'), r = m.getBoundingClientRect();
      return {
        on: m.classList.contains('on'),
        w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right),
        inner: window.innerWidth, scrollW: m.scrollWidth, clientW: m.clientWidth
      };
    });
    say(d.on, W + 'px  the burger opens the drawer');
    say(d.right <= W + 1, W + 'px  drawer\'s right edge is on the screen',
      'drawer ' + d.w + 'px wide, left ' + d.left + ', right edge ' + d.right + ' on a ' + W + 'px screen');
    say(d.w <= W * 0.92 + 1, W + 'px  drawer leaves a strip of page showing',
      d.w + 'px of a ' + W + 'px screen (' + Math.round(d.w / W * 100) + '%, cap 92%)');
    say(d.scrollW <= d.clientW + 1, W + 'px  nothing inside the drawer overflows it',
      'scrollWidth ' + d.scrollW + ' vs clientWidth ' + d.clientW);
    await p.evaluate(() => document.querySelector('.burger').click());
    await sleep(400);

    /* the console */
    await p.evaluate(() => { location.hash = '/admin'; });
    await sleep(1500);
    const a = await p.evaluate(dw => ({
      inner: window.innerWidth,
      cul: window.__cul(dw),
      side: (() => { const s = document.querySelector('.ad .side'); if (!s) return null; const r = s.getBoundingClientRect(); return { w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) }; })()
    }), W);
    say(a.inner <= W + 1, W + 'px  console  layout viewport is the phone\'s width',
      'innerWidth ' + a.inner + ' vs device ' + W + (a.cul.length ? '\n        past the edge: ' + a.cul.join(', ') : ''));
    if (a.side) say(a.side.w <= W + 1, W + 'px  console sidebar is no wider than the screen',
      a.side.w + 'px sidebar, left ' + a.side.left + ', right ' + a.side.right);
    await p.close();
  }

  console.log('\n==========================================================');
  console.log(fails.length ? fails.length + ' FAILING:\n  ' + fails.join('\n  ')
    : 'PASS - the layout viewport is the phone\'s own width at ' + WIDTHS.join(', ') + 'px,\n       and the drawer sits inside it');
  console.log('==========================================================');
  await b.close();
  process.exit(fails.length);
})();
