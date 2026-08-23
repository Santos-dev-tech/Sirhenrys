/* Confirms the 360 viewer loads every angle, turns on its own, crossfades between
   adjacent angles, and still rotates in both directions when dragged. */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars'] });
  const page = await b.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,120)); });
  await page.goto('http://localhost:8100/index.html#/product/carlo-navy', { waitUntil:'domcontentloaded', timeout:60000 });
  await sleep(3500);
  const out = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const box = document.querySelector('[data-spin]');
    if (!box) return { present:false };
    const fr = [...box.querySelectorAll('.spin-f')];
    const cur = () => fr.findIndex(f => f.classList.contains('on'));
    const r = box.getBoundingClientRect();
    const drag = async (dx) => {
      box.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true,pointerId:1}));
      for (let i=1;i<=6;i++){ box.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+r.width/2+dx*i/6,clientY:r.top+r.height/2,bubbles:true,pointerId:1})); await wait(70); }
      box.dispatchEvent(new PointerEvent('pointerup',{clientX:r.left+r.width/2+dx,clientY:r.top+r.height/2,bubbles:true,pointerId:1}));
      await wait(500);
    };
    // It should be turning without anyone touching it, and crossfading while it does.
    // Measured as total angular advance rather than a count of distinct angle indices:
    // headless swiftshader runs slowly enough that the dt clamp throttles the idle clock,
    // so counting indices under-reports something that is plainly moving. Reconstructing
    // the fractional position from the two visible opacities does not care about frame rate.
    const posNow = () => {
      const on = fr.map((f, i) => [i, +(f.style.opacity || 0)]).filter(x => x[1] > 0.001)
                   .sort((a, b) => b[1] - a[1]);
      if (!on.length) return null;
      if (on.length === 1) return on[0][0];
      const [a, b] = on;
      // the pair is adjacent (mod N); the fraction is how far it has crossed to the later one
      const later = ((b[0] - a[0] + fr.length) % fr.length) === 1 ? b[0] : a[0];
      const earlier = later === b[0] ? a[0] : b[0];
      const frac = fr[later].style.opacity ? +fr[later].style.opacity : 0;
      return earlier + frac;
    };
    const idle = [], partials = [];
    for (let i = 0; i < 12; i++) {
      idle.push(posNow());
      partials.push(fr.filter(f => { const a = +(f.style.opacity || 0); return a > 0.02 && a < 0.98; }).length);
      await wait(700);
    }
    let advance = 0;
    for (let i = 1; i < idle.length; i++) {
      if (idle[i] == null || idle[i-1] == null) continue;
      let d = idle[i] - idle[i-1];
      if (d < -0.5) d += fr.length;          // wrapped past the last angle
      if (d > 0) advance += d;
    }
    const anglesAdvanced = +advance.toFixed(2);
    const idleAdvanced = advance > 0.5;
    const crossfades = partials.some(n => n === 2);

    // Drag distances must not be near a whole number of turns. A full box width is
    // N*1.35 = 10.8 frames, so 0.8 of it is 8.64 - a complete revolution plus a fraction,
    // which lands back where it started and reads as "did not rotate".
    const start = cur();
    await drag(r.width*0.30);   const right = cur();   // ~3.2 angles clockwise
    await drag(-r.width*0.60);  const left  = cur();   // ~6.5 angles the other way
    return {
      present:true, frames:fr.length,
      loaded: fr.filter(f=>f.complete && f.naturalWidth>0).length,
      srcs: fr.map(f=>(f.currentSrc||f.src).split('/').pop()),
      idleWalk: idle.map(v => v == null ? null : +v.toFixed(2)), anglesAdvanced, idleAdvanced, crossfades,
      start, afterDragRight:right, afterDragLeft:left,
      rotatesRight: right!==start, rotatesLeft: left!==right,
      degLabel: (box.querySelector('[data-spin-deg]')||{}).textContent
    };
  });
  out.errors = [...new Set(errs)];
  console.log(JSON.stringify(out,null,1));
  await b.close();
})().catch(e=>{ console.error('FAILED:',e.message); process.exit(1); });
