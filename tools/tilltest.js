/* tilltest.js - is the till usable on a phone?
 *
 * The report was that the console looks squeezed on a phone, the till worst of all,
 * and that the scan field sits beside the basket instead of above it.
 *
 * The suspicion to test is a specificity bug rather than a missing rule. admin.css
 * carries `.ad .pos{grid-template-columns:1fr 400px}` (0-2-0) and, in its phone media
 * query, `.pos{grid-template-columns:1fr}` (0-1-0). A media query adds no specificity,
 * so the narrow rule loses and the two-column till survives onto a 375px screen with
 * a 400px basket beside it.
 *
 * So this reads the COMPUTED grid rather than trusting the stylesheet, and measures
 * the scan field and the basket as boxes.
 *
 * Run: node tools/tilltest.js       (server on 8100)
 */
const puppeteer = require('puppeteer-core');
const signInAs = require('./signin');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WIDTHS = [430, 390, 375, 360, 320];

const fails = [];
const say = (ok, label, detail) => {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (detail) console.log('        ' + detail);
  if (!ok) fails.push(label);
};

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });

  for (const W of WIDTHS) {
    console.log('\n==================== till at ' + W + 'px ====================');
    const p = await b.newPage();
    await p.setViewport({ width: W, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await p.goto('http://localhost:8100/index.html#/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3200);
    const who = await signInAs(p, 'ha');
    if (!who.ok) { say(false, W + 'px  signed into the console', JSON.stringify(who)); await p.close(); continue; }
    await p.evaluate(() => { location.hash = '/admin/pos'; });
    await sleep(1400);

    const m = await p.evaluate(dw => {
      const box = sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) };
      };
      const pos = document.querySelector('.pos');
      const cs = pos ? getComputedStyle(pos) : null;
      const scan = box('#posScan'), basket = box('.pos-basket');
      /* anything in the console wider than the screen */
      const over = [];
      for (const el of document.querySelectorAll('#ad *')) {
        const c = getComputedStyle(el);
        if (c.display === 'none' || c.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        if (r.right <= dw + 1) continue;
        const n = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
          (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        if (!over.some(o => o.startsWith(n))) over.push(n + ' +' + Math.round(r.right - dw));
      }
      return {
        cols: cs ? cs.gridTemplateColumns : null,
        scan, basket,
        innerW: window.innerWidth,
        docW: document.documentElement.scrollWidth,
        over: over.slice(0, 6)
      };
    }, W);

    say(m.innerW <= W + 1, W + 'px  console layout viewport is the phone width',
      'innerWidth ' + m.innerW + ' vs device ' + W + (m.over.length ? '\n        past the edge: ' + m.over.join(', ') : ''));

    const oneCol = m.cols && m.cols.trim().split(/\s+/).length === 1;
    say(oneCol, W + 'px  the till is ONE column', 'grid-template-columns: ' + m.cols);

    if (m.scan && m.basket) {
      say(m.scan.top + m.scan.h <= m.basket.top + 2, W + 'px  the scan field sits ABOVE the basket',
        'scan bottom ' + (m.scan.top + m.scan.h) + ', basket top ' + m.basket.top);
      say(m.scan.h >= 48, W + 'px  the scan field is a comfortable target',
        m.scan.w + 'x' + m.scan.h + ' (want >=48 tall)');
      say(m.scan.w >= W * 0.6, W + 'px  the scan field has room to read a long SKU',
        m.scan.w + 'px wide on a ' + W + 'px screen (want >=' + Math.round(W * 0.6) + ')');
      say(m.basket.w <= W + 1, W + 'px  the basket fits the screen',
        m.basket.w + 'px basket, right edge ' + m.basket.right);
    } else {
      say(false, W + 'px  found the scan field and the basket', 'scan=' + JSON.stringify(m.scan) + ' basket=' + JSON.stringify(m.basket));
    }
    await p.close();
  }

  console.log('\n==========================================================');
  console.log(fails.length ? fails.length + ' FAILING:\n  ' + fails.join('\n  ')
    : 'PASS - the till stacks, the scan field is above the basket, and both fit');
  console.log('==========================================================');
  await b.close();
  process.exit(fails.length);
})();
