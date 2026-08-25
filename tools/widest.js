/* widest.js - what is forcing the layout viewport wider than the phone?
 *
 * navfit.js found innerWidth reporting 607 on a 390px phone: Chrome had zoomed
 * the page out to fit something wide. Every percentage in the CSS is then a
 * percentage of 607, which is how a 30%-inset drawer ends up 425px on a 390px
 * screen. This finds the element that sets that 607.
 *
 * A fixed (non-mobile) viewport does not zoom, so scrollWidth tells the truth.
 * An element only widens the page if no ancestor clips it, so each candidate is
 * walked up to the root looking for overflow-x hidden/clip/auto.
 */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = Number(process.argv[2] || 390);
const ROUTE = process.argv[3] || '/';

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const p = await b.newPage();
  await p.setViewport({ width: W, height: 844, deviceScaleFactor: 1 });
  await p.goto('http://localhost:8100/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3500);
  await p.evaluate(r => { location.hash = r; }, ROUTE);
  await sleep(1200);

  const out = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const name = el => el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');

    /* is this element's overflow clipped by something above it? */
    function clippedBy(el) {
      let n = el.parentElement;
      /* body's own overflow-x:hidden only hides the scrollbar - it does not stop the
         content from setting the page width that mobile Chrome zooms out to fit,
         so body and html do not count as clippers here. */
      while (n && n !== document.body && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        const ox = cs.overflowX;
        if (ox === 'hidden' || ox === 'clip' || ox === 'auto' || ox === 'scroll') return name(n) + ' (overflow-x:' + ox + ')';
        n = n.parentElement;
      }
      return null;
    }

    const guilty = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right <= vw + 1) continue;
      const clip = clippedBy(el);
      if (clip) continue;                       /* contained - innocent */
      guilty.push({
        el: name(el),
        right: Math.round(r.right),
        left: Math.round(r.left),
        w: Math.round(r.width),
        over: Math.round(r.right - vw),
        pos: cs.position,
        minW: cs.minWidth,
        width: cs.width,
        parent: el.parentElement ? name(el.parentElement) : null
      });
    }
    guilty.sort((a, b) => b.right - a.right);

    return {
      vw,
      docScrollW: document.documentElement.scrollWidth,
      bodyScrollW: document.body.scrollWidth,
      viewportMeta: (document.querySelector('meta[name=viewport]') || {}).content || null,
      htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
      guilty: guilty.slice(0, 14)
    };
  });

  console.log('viewport            ' + out.vw + 'px  (meta: ' + out.viewportMeta + ')');
  console.log('html overflow-x     ' + out.htmlOverflowX + '   body overflow-x: ' + out.bodyOverflowX);
  console.log('document scrollWidth ' + out.docScrollW + 'px   body scrollWidth ' + out.bodyScrollW + 'px');
  console.log('overflow            ' + (out.docScrollW > out.vw + 1 ? 'YES, by ' + (out.docScrollW - out.vw) + 'px' : 'none'));
  console.log('\nUNCLIPPED elements past the right edge (these widen the page):');
  if (!out.guilty.length) console.log('  none');
  for (const g of out.guilty) {
    console.log('  ' + g.el);
    console.log('      right ' + g.right + ' (+' + g.over + ')  left ' + g.left + '  width ' + g.w +
      '  position:' + g.pos + '  css width:' + g.width + '  min-width:' + g.minW);
    console.log('      parent: ' + g.parent);
  }
  await b.close();
})();
