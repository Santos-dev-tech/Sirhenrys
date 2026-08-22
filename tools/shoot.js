/* Headless screenshots so the build can actually be looked at.
   Drives the real Chrome via puppeteer-core (no bundled Chromium download).

   node tools/shoot.js <url> [outDir]

   Captures the hero, the dressing sequence at five scrub positions, the collection
   room, and a few commerce pages, then reports anything broken it finds on the way. */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2] || 'http://localhost:8100/index.html';
const outDir = process.argv[3] || path.join(__dirname, '..', '..', '_shots');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required',
           '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--hide-scrollbars', '--force-device-scale-factor=1']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
  page.on('requestfailed', r => errors.push('failed: ' + r.url().slice(0, 90)));

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(3500);   // let fonts, textures and video metadata settle

  const shot = async (name) => {
    const f = path.join(outDir, name + '.jpg');
    await page.screenshot({ path: f, type: 'jpeg', quality: 82 });
    return name;
  };

  const scrollTo = async (y) => {
    await page.evaluate(y => {
      if (window.Motion && Motion.scrollTo) Motion.scrollTo(y, { immediate: true });
      else window.scrollTo(0, y);
    }, y);
    await sleep(900);
  };

  const report = { url, shots: [], facts: {}, errors: [] };

  // --- geometry of the page, so section positions are stated not guessed
  report.facts = await page.evaluate(() => {
    const q = s => document.querySelector(s);
    const sec = document.getElementById('anatomy');
    const room = q('.room');
    const v = q('.anat-video');
    return {
      pageHeight: document.body.scrollHeight,
      anatomyTop: sec ? sec.offsetTop : null,
      anatomyHeight: sec ? sec.offsetHeight : null,
      roomTop: room ? room.offsetTop : null,
      videoInline: v ? (v.getAttribute('src') || '').startsWith('data:') : null,
      videoDims: v ? v.videoWidth + 'x' + v.videoHeight : null,
      videoSeekable: v && v.seekable.length ? +v.seekable.end(0).toFixed(2) : null,
      webgl: (() => { const c = q('.room-canvas'); return c ? !!(c.getContext('webgl2') || c.getContext('webgl')) : null; })(),
      hidden: document.hidden
    };
  });

  await shot('01-hero'); report.shots.push('01-hero');

  // --- every sequence frame must actually be decoded, or the scrub shows gaps
  report.sequence = await page.evaluate(async () => {
    const all = [...document.querySelectorAll('.anat-f')];
    await new Promise(r => setTimeout(r, 2500));
    const loaded = all.filter(f => f.complete && f.naturalWidth > 0).length;
    return { frames: all.length, loaded, missing: all.length - loaded };
  });

  // --- motion-layer health: reveals must animate AND never strand content invisible
  report.motion = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const all = document.querySelectorAll('[data-reveal]');
    const before = document.querySelectorAll('[data-reveal].in').length;
    // ease-scroll through the whole page so every observer fires
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.Motion ? Motion.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
      await wait(60);
    }
    await wait(3000);   // let the fail-safe run too
    const after = document.querySelectorAll('[data-reveal].in').length;
    const stuck = [...document.querySelectorAll('[data-reveal]:not(.in)')]
      .filter(e => e.getBoundingClientRect().width > 0)
      .map(e => e.className.split(' ')[0] || e.tagName).slice(0, 6);
    // anything actually invisible on screen is a hard failure
    const invisible = [...document.querySelectorAll('[data-reveal]')]
      .filter(e => +getComputedStyle(e).opacity < 0.05).length;
    return {
      revealTargets: all.length, revealedAtStart: before, revealedAfterScroll: after,
      stillHidden: stuck, invisibleAfterPass: invisible,
      lenisClasses: document.documentElement.className,
      staggerContainers: document.querySelectorAll('[data-stagger]').length
    };
  });
  await scrollTo(0);

  // --- the dressing sequence, sampled across its scroll range
  const sec = report.facts;
  if (sec.anatomyTop != null) {
    const total = sec.anatomyHeight - 900;
    for (const [i, p] of [0, 0.25, 0.5, 0.75, 0.98].entries()) {
      await scrollTo(sec.anatomyTop + total * p);
      const state = await page.evaluate(() => {
        const on = document.querySelector('.anat-stage .anat-f.on');
        const all = [...document.querySelectorAll('.anat-stage .anat-f')];
        const c = document.querySelector('.anat-count');
        return {
          frame: on ? all.indexOf(on) : null, of: all.length,
          src: on ? (on.currentSrc || on.src).split('/').pop() : null,
          loaded: on ? on.naturalWidth > 0 : null,
          count: c ? c.textContent.trim() : null
        };
      });
      const n = '02-dressing-' + i + '-p' + String(p).replace('.', '');
      await shot(n);
      report.shots.push(n + '  [frame ' + state.frame + '/' + state.of + ' ' + state.src +
                        ' loaded=' + state.loaded + ', step ' + state.count + ']');
    }
  }

  // --- the collection room
  if (sec.roomTop != null) {
    await scrollTo(sec.roomTop + 60);
    await sleep(1200);
    await shot('03-room'); report.shots.push('03-room');
    // drag it sideways to prove the rail moves
    await page.evaluate(() => { const c = document.querySelector('.room-canvas'); if (!c) return;
      const r = c.getBoundingClientRect();
      c.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width * 0.7, clientY: r.top + r.height / 2, bubbles: true, pointerId: 1 }));
      c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * 0.2, clientY: r.top + r.height / 2, bubbles: true, pointerId: 1 }));
      c.dispatchEvent(new PointerEvent('pointerup', { clientX: r.left + r.width * 0.2, clientY: r.top + r.height / 2, bubbles: true, pointerId: 1 }));
    });
    await sleep(1400);
    await shot('04-room-dragged'); report.shots.push('04-room-dragged');
  }

  // --- the rest of the page
  await scrollTo(sec.pageHeight * 0.55); await shot('05-mid'); report.shots.push('05-mid');
  await scrollTo(sec.pageHeight * 0.8);  await shot('06-lower'); report.shots.push('06-lower');
  await scrollTo(sec.pageHeight);        await shot('07-footer'); report.shots.push('07-footer');

  // --- commerce routes
  for (const [name, hash] of [['08-shop', '#/shop'], ['09-product', '#/product/carlo-navy'],
                              ['10-bespoke', '#/bespoke'], ['11-wedding', '#/wedding']]) {
    await page.evaluate(h => { location.hash = h; }, hash);
    await sleep(1500);
    await scrollTo(0);
    await shot(name); report.shots.push(name);
  }

  report.errors = [...new Set(errors)].slice(0, 20);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error('SHOOT FAILED:', e.message); process.exit(1); });
