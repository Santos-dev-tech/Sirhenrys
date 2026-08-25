/* seed.js - which element has an intrinsic width the phone cannot shrink?
 *
 * The first two probes kept naming #veil and .hdr-act, both of which are just
 * inset:0 / flex:1 things filling whatever the viewport already is. Consequences,
 * not the cause. The cause is constant at 607px across 320-430px devices, so it is
 * something with a fixed or min-content width that refuses to shrink.
 *
 * So: a fixed (non-mobile) viewport, no auto-widening, and report elements by
 * MIN-CONTENT width rather than by rendered box - an element that fills a wide
 * viewport has a small min-content width; the guilty one does not.
 */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = Number(process.argv[2] || 375);
const ROUTE = process.argv[3] || '/';

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const p = await b.newPage();
  await p.setViewport({ width: W, height: 844, deviceScaleFactor: 1 });
  await p.goto('http://localhost:8100/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3500);
  await p.evaluate(r => { location.hash = r; }, ROUTE);
  await sleep(1200);

  const out = await p.evaluate(vw => {
    const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');

    /* measure min-content by cloning into a shrink-to-fit box, so a flex:1
       element that merely fills the row reports its real floor */
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-99999px;top:0;width:min-content;visibility:hidden';
    document.body.appendChild(probe);

    const rows = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      /* skip the off-screen drawers' interiors - handled separately */
      let mc = 0;
      try {
        const c = el.cloneNode(true);
        c.style.width = 'min-content';
        c.style.maxWidth = 'none';
        probe.appendChild(c);
        mc = Math.round(c.getBoundingClientRect().width);
        probe.removeChild(c);
      } catch (e) { mc = -1; }
      if (mc <= vw) continue;
      rows.push({
        el: name(el), minContent: mc, rendered: Math.round(r.width),
        pos: cs.position, cssW: cs.width, cssMinW: cs.minWidth,
        parent: el.parentElement ? name(el.parentElement) : null,
        depth: (() => { let d = 0, n = el; while (n.parentElement) { d++; n = n.parentElement } return d; })()
      });
    }
    probe.remove();
    /* the shallowest, widest one is the origin of the problem */
    rows.sort((a, b) => a.depth - b.depth || b.minContent - a.minContent);
    return { vw, docW: document.documentElement.scrollWidth, rows: rows.slice(0, 12) };
  }, W);

  console.log('viewport ' + out.vw + 'px, document ' + out.docW + 'px\n');
  console.log('Elements whose MIN-CONTENT width exceeds the phone (shallowest first):');
  if (!out.rows.length) console.log('  none');
  for (const r of out.rows) {
    console.log('  [depth ' + r.depth + '] ' + r.el);
    console.log('        min-content ' + r.minContent + 'px  (rendered ' + r.rendered + 'px)  position:' + r.pos +
      '  css width:' + r.cssW + '  min-width:' + r.cssMinW);
    console.log('        parent: ' + r.parent);
  }
  await b.close();
})();
