/* Measures how quickly the scrubbed video settles on its target after the scroll stops,
   and whether continuous (real-feeling) scrolling tracks tightly. */
const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2] || 'http://localhost:8100/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(3000);

  const out = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const sec = document.getElementById('anatomy');
    const v = document.querySelector('.anat-video');
    const total = sec.offsetHeight - innerHeight;
    const res = { fps: null, settle: [], continuous: [] };

    // frame rate of this environment, for context
    let n = 0; const t0 = performance.now();
    await new Promise(r => { const f = () => { n++; performance.now() - t0 < 1000 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
    res.fps = n;

    // how long to settle after a big jump
    for (const p of [0.5, 0.9]) {
      Motion.scrollTo(sec.offsetTop + total * p, { immediate: true });
      const want = +(p * (v.duration - 0.06)).toFixed(2);
      const samples = [];
      for (let i = 0; i < 12; i++) { await wait(250); samples.push(+v.currentTime.toFixed(2)); }
      res.settle.push({ p, want, samples, settledWithin: samples.findIndex(s => Math.abs(s - want) < 0.15) });
    }

    // continuous scroll, the way a person actually reads the section
    Motion.scrollTo(sec.offsetTop, { immediate: true });
    await wait(600);
    for (let i = 0; i <= 20; i++) {
      Motion.scrollTo(sec.offsetTop + total * (i / 20), { immediate: true });
      await wait(120);
      res.continuous.push(+v.currentTime.toFixed(2));
    }
    res.duration = +v.duration.toFixed(2);
    return res;
  });

  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
