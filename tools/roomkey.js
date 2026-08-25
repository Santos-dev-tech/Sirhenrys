/* Look at what the collection room's chroma key is actually leaving behind.

     node tools/roomkey.js

   Renders the lookbook in both themes, reads the WebGL canvas back (the renderer
   is created with preserveDrawingBuffer for exactly this), and measures the
   residue: how much of the frame is neither the page colour nor a garment, but
   the studio ground the key was supposed to remove.

   Writes _shots/roomkey-*.png so it can be looked at as well as counted.
*/
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:8100';
const OUT = path.join(__dirname, '..', '_shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 300000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const p = await b.newPage();
  /* python tools/serve.py is single-process and this harness pulls a few hundred
     images per run; under that it occasionally takes longer than the 30s default to
     answer a navigation. That is the test server breathing, not the site. */
  p.setDefaultNavigationTimeout(120000);
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.SHUX && !!window.Motion);
  await sleep(4200);
  await p.evaluate(() => localStorage.setItem('sirhenrys.consent', 'no'));

  for (const theme of ['dark', 'light']) {
    await p.evaluate(t => SHUX.theme.set(t), theme);
    await p.evaluate(() => { location.hash = '#/lookbook'; });
    await sleep(11000);   // SwiftShader takes its time loading 12 plate textures

    const stats = await p.evaluate(() => {
      const cv = document.querySelector('.room-canvas');
      if (!cv) return { error: 'no canvas' };
      const page = getComputedStyle(document.documentElement)
        .getPropertyValue('--room-bg').trim();
      // read the drawing buffer back
      const gl = cv.getContext('webgl2') || cv.getContext('webgl');
      const w = cv.width, h = cv.height;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);

      const hex = page.replace('#', '');
      const bg = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));

      /* Three buckets:
           page      - within 10 of the room colour, i.e. correctly keyed away
           garment   - far from the page colour AND not near-neutral-bright
           residue   - near-neutral and bright, but NOT the page colour: this is
                       the studio ground the key failed to remove
         Sampled on a grid rather than every pixel; 1 in 16 is plenty for a ratio. */
      let page_ = 0, garment = 0, residue = 0, total = 0;
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const i = (y * w + x) * 4;
          const r = buf[i], g = buf[i + 1], bl = buf[i + 2];
          total++;
          const dPage = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(bl - bg[2]);
          if (dPage < 24) { page_++; continue; }
          const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
          const neutral = mx - mn < 26;
          const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
          // brighter than the page by a clear margin, and grey
          const pageLum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];
          if (neutral && lum > pageLum + 40) residue++;
          else garment++;
        }
      }
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        roomBg: page, canvas: w + 'x' + h, sampled: total,
        pagePct: +(page_ / total * 100).toFixed(1),
        garmentPct: +(garment / total * 100).toFixed(1),
        residuePct: +(residue / total * 100).toFixed(1)
      };
    });
    console.log(JSON.stringify(stats));
    await p.screenshot({ path: path.join(OUT, 'roomkey-' + theme + '.png') });

    // and a close crop on the centre garment, which is the one being looked at
    const el = await p.$('.room-canvas');
    const box = await el.boundingBox();
    await p.screenshot({
      path: path.join(OUT, 'roomkey-' + theme + '-crop.png'),
      clip: { x: box.x + box.width * 0.30, y: box.y + box.height * 0.10,
              width: box.width * 0.40, height: box.height * 0.80 }
    });
  }

  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
