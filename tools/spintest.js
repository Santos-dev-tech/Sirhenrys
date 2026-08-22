/* Confirms the 360 viewer loads every angle and rotates in both directions. */
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
    const start = cur();
    await drag(r.width*0.8);   const right = cur();
    await drag(-r.width*1.6);  const left  = cur();
    return {
      present:true, frames:fr.length,
      loaded: fr.filter(f=>f.complete && f.naturalWidth>0).length,
      srcs: fr.map(f=>(f.currentSrc||f.src).split('/').pop()),
      start, afterDragRight:right, afterDragLeft:left,
      rotatesRight: right!==start, rotatesLeft: left!==right,
      degLabel: (box.querySelector('[data-spin-deg]')||{}).textContent
    };
  });
  out.errors = [...new Set(errs)];
  console.log(JSON.stringify(out,null,1));
  await b.close();
})().catch(e=>{ console.error('FAILED:',e.message); process.exit(1); });
