/* stickytest.js - did overflow-x:clip on <html> cost us the sticky header or Lenis?
 *
 * This is the regression the fix could plausibly have caused, so it is measured
 * rather than assumed. overflow-x:HIDDEN on one axis forces the other axis to auto,
 * which makes the root a scroll container: position:sticky then sticks to a scroller
 * that never scrolls, and Lenis drives the wrong element. overflow-x:CLIP pairs with
 * visible and creates no scroll container - that is the whole reason clip was chosen.
 *
 * Proof, not reasoning: scroll down, then read the header's box.
 *
 * Run: node tools/stickytest.js       (server on 8100)
 */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

  for (const vp of [{ w: 1440, h: 900, mob: false, name: 'desktop 1440px' },
                    { w: 375, h: 812, mob: true, name: 'phone 375px' }]) {
    console.log('\n---- ' + vp.name + ' ----');
    const p = await b.newPage();
    await p.setViewport({ width: vp.w, height: vp.h, isMobile: vp.mob, hasTouch: vp.mob, deviceScaleFactor: vp.mob ? 2 : 1 });
    await p.goto('http://localhost:8100/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3500);

    const root = await p.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const bs = getComputedStyle(document.body);
      return {
        htmlX: cs.overflowX, htmlY: cs.overflowY,
        bodyX: bs.overflowX, bodyY: bs.overflowY,
        lenis: !!(window.Motion && window.Motion.lenis) || document.documentElement.classList.contains('lenis'),
        scroller: document.scrollingElement === document.documentElement ? 'documentElement' : 'other'
      };
    });
    say(root.htmlX === 'clip', 'html overflow-x is clip', 'html ' + root.htmlX + '/' + root.htmlY + '   body ' + root.bodyX + '/' + root.bodyY);
    say(root.htmlY === 'visible', 'html overflow-y stayed visible (no scroll container was created)',
      'overflow-y: ' + root.htmlY + '  -  hidden here would mean sticky is broken');
    say(root.scroller === 'documentElement', 'the document is still the scroller', root.scroller);

    /* scroll a long way down and see whether the header came with us */
    const before = await p.evaluate(() => {
      const r = document.querySelector('.hdr').getBoundingClientRect();
      return { top: Math.round(r.top), h: Math.round(r.height) };
    });
    await p.evaluate(() => {
      if (window.Motion && Motion.scrollTo) Motion.scrollTo(2200, { immediate: true });
      else window.scrollTo(0, 2200);
    });
    await sleep(900);
    const after = await p.evaluate(() => {
      const r = document.querySelector('.hdr').getBoundingClientRect();
      return {
        top: Math.round(r.top), h: Math.round(r.height),
        y: Math.round(window.scrollY || document.documentElement.scrollTop),
        shrunk: document.querySelector('.hdr').classList.contains('shrunk')
      };
    });
    say(after.y > 400, 'the page actually scrolled', 'scrollY ' + after.y + ' (was ' + before.top + ' at rest)');
    say(after.top <= 1 && after.top >= -1, 'the header is still stuck to the top after scrolling',
      'header top ' + after.top + 'px at scrollY ' + after.y + '  (sticky would read ~0; a broken sticky reads a large negative)');
    say(after.shrunk, 'the header still condenses once you leave the hero', '.hdr.shrunk = ' + after.shrunk);

    /* and the page still must not be wider than the device */
    const w = await p.evaluate(() => ({ inner: window.innerWidth, doc: document.documentElement.scrollWidth }));
    say(w.inner <= vp.w + 1, 'layout viewport is still the device width', 'innerWidth ' + w.inner + ' vs ' + vp.w);
    await p.close();
  }

  console.log('\n==========================================================');
  console.log(fails.length ? fails.length + ' FAILING:\n  ' + fails.join('\n  ')
    : 'PASS - sticky header and the scroller survived overflow-x:clip');
  console.log('==========================================================');
  await b.close();
  process.exit(fails.length);
})();
