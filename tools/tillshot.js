/* tillshot.js - look at the till on a phone, with a basket that actually has lines in it.
 *
 * tilltest.js measures an empty till, because .pos-line only exists once something has
 * been scanned - so the row layout it checks is the one nobody sees. This fills the
 * basket through the real UI (type into the scan field, click a result) and shoots it.
 *
 * Writes _shots/till-*.png. A red hairline marks the true device edge.
 *
 * Run: node tools/tillshot.js       (server on 8100)
 */
const puppeteer = require('puppeteer-core');
const signInAs = require('./signin');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, '..', '_shots');

async function fillBasket(p, n) {
  for (const term of ['suit', 'shirt', 'blazer'].slice(0, n)) {
    await p.evaluate(t => {
      const i = document.querySelector('#posScan');
      i.value = t;
      i.dispatchEvent(new Event('input', { bubbles: true }));
    }, term);
    await sleep(600);
    const hit = await p.evaluate(() => {
      const b = document.querySelector('.pos-hit:not(:disabled)');
      if (!b) return false;
      b.click();
      return true;
    });
    if (!hit) continue;
    await sleep(500);
  }
  return p.evaluate(() => document.querySelectorAll('.pos-line').length);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const made = [];

  for (const W of [390, 320]) {
    for (const theme of ['light', 'dark']) {
      const p = await b.newPage();
      await p.setViewport({ width: W, height: 860, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await p.goto('http://localhost:8100/index.html#/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(3200);
      /* the consent bar is fixed to the bottom and sits over the basket rows,
         which are the thing being looked at - answer it the way a user would */
      await p.evaluate(() => {
        const btn = [...document.querySelectorAll('.cc button, .cc .btn')]
          .find(b => /decline/i.test(b.textContent || ''));
        if (btn) btn.click();
      });
      await sleep(400);
      await signInAs(p, 'ha');
      await p.evaluate(t => {
        document.documentElement.setAttribute('data-theme', t);
        location.hash = '/admin/pos';
      }, theme);
      await sleep(1500);

      const lines = await fillBasket(p, 3);
      await p.evaluate(w => {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;top:0;bottom:0;left:' + (w - 1) + 'px;width:1px;background:#ff2d2d;z-index:99999;pointer-events:none';
        document.body.appendChild(d);
      }, W);
      await sleep(300);

      const f = path.join(OUT, 'till-' + W + '-' + theme + '.png');
      await p.screenshot({ path: f, fullPage: true });
      made.push(path.basename(f) + '  (' + lines + ' basket lines)');
      await p.close();
    }
  }
  console.log(made.join('\n'));
  await b.close();
})();
