/* hdrfloor.js - what inside the header row will not shrink?
 *
 * .hdr-in has a min-content width of 575px. Plus 2x16px of .wrap padding that is
 * the 607px layout viewport every phone was being zoomed out to. This prints the
 * floor of each child of the header row, and of each child of those, so the one
 * holding it open is named rather than guessed at.
 */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = Number(process.argv[2] || 375);

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const p = await b.newPage();
  await p.setViewport({ width: W, height: 844, deviceScaleFactor: 1 });
  await p.goto('http://localhost:8100/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3500);

  const out = await p.evaluate(() => {
    const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-99999px;top:0;width:min-content;visibility:hidden';
    document.body.appendChild(probe);
    const floor = el => {
      const c = el.cloneNode(true);
      c.style.width = 'min-content'; c.style.maxWidth = 'none';
      probe.appendChild(c);
      const w = Math.round(c.getBoundingClientRect().width);
      probe.removeChild(c);
      return w;
    };

    const rows = [];
    const walk = (el, depth) => {
      for (const ch of el.children) {
        const cs = getComputedStyle(ch);
        const r = ch.getBoundingClientRect();
        rows.push({
          indent: '  '.repeat(depth),
          el: name(ch),
          floor: floor(ch),
          rendered: Math.round(r.width),
          display: cs.display,
          shrink: cs.flexShrink,
          basis: cs.flexBasis,
          gap: cs.gap,
          ws: cs.whiteSpace
        });
        if (depth < 2 && cs.display !== 'none') walk(ch, depth + 1);
      }
    };
    const hdrIn = document.querySelector('.hdr-in');
    const res = { hdrInFloor: floor(hdrIn), rows: [] };
    walk(hdrIn, 0);
    res.rows = rows;
    probe.remove();
    return res;
  });

  console.log('.hdr-in floor: ' + out.hdrInFloor + 'px\n');
  for (const r of out.rows) {
    console.log(r.indent + r.el.padEnd(34 - r.indent.length) +
      ' floor ' + String(r.floor).padStart(5) + 'px   rendered ' + String(r.rendered).padStart(4) + 'px' +
      '   display:' + r.display + (r.display !== 'none' ? '  shrink:' + r.shrink + '  basis:' + r.basis + '  ws:' + r.ws : ''));
  }
  await b.close();
})();
