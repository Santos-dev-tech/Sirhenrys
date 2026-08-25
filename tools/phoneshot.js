/* phoneshot.js - look at the phone header, because numbers missed a colour once before.
 *
 * Writes _shots/ph-*.png: the header and the open drawer, at three phone widths, in
 * both themes, plus the console. A red hairline is drawn down the true device edge so
 * anything sticking out past the screen is visible rather than inferred.
 *
 * Run: node tools/phoneshot.js        (server on 8100)
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, '..', '_shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const made = [];

  for (const W of [430, 375, 320]) {
    for (const theme of ['light', 'dark']) {
      const p = await b.newPage();
      await p.setViewport({ width: W, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await p.goto('http://localhost:8100/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(3800);
      await p.evaluate(t => {
        document.documentElement.setAttribute('data-theme', t);
        if (window.Motion && Motion.retheme) Motion.retheme();
      }, theme);
      await sleep(700);

      /* a hairline down the real device edge - anything past it is off the screen */
      await p.evaluate(w => {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;top:0;bottom:0;left:' + (w - 1) + 'px;width:1px;' +
          'background:#ff2d2d;z-index:99999;pointer-events:none';
        document.body.appendChild(d);
      }, W);

      let f = path.join(OUT, 'ph-' + W + '-' + theme + '-header.png');
      await p.screenshot({ path: f }); made.push(f);

      await p.evaluate(() => document.querySelector('.burger').click());
      await sleep(700);
      f = path.join(OUT, 'ph-' + W + '-' + theme + '-drawer.png');
      await p.screenshot({ path: f }); made.push(f);
      await p.evaluate(() => document.querySelector('.burger').click());
      await sleep(450);

      if (theme === 'dark') {
        await p.evaluate(() => { location.hash = '/admin'; });
        await sleep(1600);
        f = path.join(OUT, 'ph-' + W + '-console.png');
        await p.screenshot({ path: f }); made.push(f);
      }
      await p.close();
    }
  }
  console.log(made.map(m => path.basename(m)).join('\n'));
  console.log('\n' + made.length + ' shots in _shots/');
  await b.close();
})();
