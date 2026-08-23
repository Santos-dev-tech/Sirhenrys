/* Walks the dressing sequence down and then back up, proving frames advance forward
   on scroll-down and reverse on scroll-up. */
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
  await sleep(3500);

  const out = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const sec = document.getElementById('anatomy');
    const all = [...document.querySelectorAll('.anat-f')];
    const total = sec.offsetHeight - innerHeight;
    const cur = () => { const on = document.querySelector('.anat-f.on'); return on ? all.indexOf(on) : -1; };

    const down = [], up = [], cams = [];
    for (let i = 0; i <= 10; i++) {
      Motion.scrollTo(sec.offsetTop + total * (i / 10), { immediate: true });
      await wait(320); down.push(cur());
      // the camera transform moved to .anat-cam, which .anat-stage clips
      const st = document.querySelector('.anat-cam') || document.querySelector('.anat-stage');
      cams.push(getComputedStyle(st).transform.replace(/matrix\(([^,]+).*/, '$1') + '@' + st.style.transformOrigin);
    }
    for (let i = 10; i >= 0; i--) {
      Motion.scrollTo(sec.offsetTop + total * (i / 10), { immediate: true });
      await wait(320); up.push(cur());
    }
    const rising = down.every((v, i) => i === 0 || v >= down[i - 1]);
    const falling = up.every((v, i) => i === 0 || v <= up[i - 1]);
    return {
      framesTotal: all.length,
      loaded: all.filter(f => f.complete && f.naturalWidth > 0).length,
      scrollDown: down, scrollUp: up,
      forwardOnDown: rising, reverseOnUp: falling,
      distinctFramesSeen: new Set(down.concat(up)).size,
      camera: cams
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
