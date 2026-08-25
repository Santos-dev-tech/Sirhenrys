/* ---------------------------------------------------------------------------
   The dark-mode sweep.

     node tools/darktest.js            (needs python tools/serve.py 8100)
     node tools/darktest.js --light    also sweep the light theme

   Walks every route of both halves of the app, in both themes, at desktop and
   phone, and measures the WCAG 2.1 contrast of every element that actually paints
   text — against the first ancestor that actually paints a background, because a
   transparent parent tells you nothing.

   Why a whole tool for this: the theme is a swap of custom properties, and that
   only reaches colours that were written as custom properties. site.css has
   forty-odd hard-coded ones - a cream scrim over the hero, a white bar behind the
   header, #fff on filled buttons - and each of those is invisible to the swap and
   invisible to a spot check. Two of them shipped: white text on a cream wash, and
   a near-white header with near-white text on it.

   Reports each failure once per unique signature (tag + classes + the two colours)
   so one bad rule appearing in ninety cards is one line, not ninety.

   Exit code is the number of distinct failures.
--------------------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const signInAs = require('./signin');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:8100';
const OUT = path.join(__dirname, '..', '_shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ROUTES = ['/', '/shop', '/shop?cat=suits', '/bespoke', '/wedding', '/corporate',
                '/lookbook', '/stores', '/about', '/contact', '/faq', '/privacy',
                '/appointments', '/search?q=linen', '/cart', '/checkout', '/account'];
const ADMIN = ['/admin/dashboard', '/admin/pos', '/admin/orders', '/admin/inventory',
               '/admin/products', '/admin/customers', '/admin/alterations',
               '/admin/analytics', '/admin/settings'];

/* The measuring function, injected once and reused. Kept as a string because it
   has to run in the page and be callable route after route. */
const PROBE = `
window.__contrast = function () {
  const rgbOf = str => {
    const n = (str.match(/[\\d.]+/g) || []).map(Number);
    if (n.length < 3) return null;
    return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
  };
  const over = (fg, bg) => ({           // composite a translucent layer onto what is behind
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1
  });
  const lum = c => {
    const f = [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b);
    return +(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2));
  };

  /* Walk up stacking the painted layers, so a 12% wash over a photo over a page
     background composites the way the eye sees it rather than the way the DOM
     lists it. Stops at the first fully opaque layer. */
  const backdrop = el => {
    const layers = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      const nr = n.getBoundingClientRect();
      const c = rgbOf(cs.backgroundColor);
      let opaque = false;
      if (c && c.a > 0.001) { layers.push(c); opaque = c.a >= 0.999; }

      /* ::before AND ::after: the hero's wash is a ::before, the category tile's
         dark gradient is an ::after. But only if the pseudo actually COVERS the
         text - the nav's hover underline is a 1px ::after filled with bronze, and
         counting that as the backdrop reported every nav link at 2:1. */
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(n, pseudo);
        if (!ps || ps.content === 'none' || ps.position !== 'absolute') continue;
        const ph = parseFloat(ps.height), pw = parseFloat(ps.width);
        const insetZero = ps.top === '0px' && ps.bottom === '0px' && ps.left === '0px' && ps.right === '0px';
        const covers = insetZero ||
          (isFinite(ph) && isFinite(pw) && ph >= nr.height * 0.6 && pw >= nr.width * 0.6);
        if (!covers) continue;
        const bc = rgbOf(ps.backgroundColor);
        if (bc && bc.a > 0.001) layers.push(bc);
        if (ps.backgroundImage && ps.backgroundImage !== 'none') layers.push({ gradient: true });
      }

      // a photograph filling this box is not a colour and cannot be measured as one
      const im = n.querySelector && n.querySelector(':scope > img, :scope > picture > img');
      if (im) {
        const ir = im.getBoundingClientRect();
        if (ir.width >= nr.width * 0.9 && ir.height >= nr.height * 0.9) layers.push({ image: true });
      }

      // the opaque break happens LAST, so this element's own overlays still count
      if (opaque) break;
      n = n.parentElement;
    }
    const page = rgbOf(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    let out = page, gradient = false, image = false;
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].gradient) { gradient = true; continue; }
      if (layers[i].image) { image = true; continue; }
      out = over(layers[i], out);
    }
    return { color: out, gradient, image };
  };

  const sig = el => {
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + cls;
  };

  const out = [];
  const seen = new Set();
  document.querySelectorAll('body *').forEach(el => {
    // only elements that themselves paint text
    const hasOwnText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasOwnText) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.15) return;
    // off screen entirely (a parked drawer) is not being read by anybody
    if (r.bottom < -50 || r.right < -50 || r.left > innerWidth + 50) return;

    const fg = rgbOf(cs.color);
    if (!fg || fg.a < 0.15) return;
    const bd = backdrop(el);
    const fgOn = fg.a < 0.999 ? over(fg, bd.color) : fg;
    const size = parseFloat(cs.fontSize), weight = +cs.fontWeight || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fgOn, bd.color);

    const s = sig(el);
    const key = s + '|' + cs.color + '|' + Math.round(bd.color.r) + ',' + Math.round(bd.color.g) + ',' + Math.round(bd.color.b);
    if (seen.has(key)) return;
    seen.add(key);

    /* Text over a photograph has no single background colour, so a ratio against
       one is meaningless. The site's answer for those is a dark gradient plus a
       text-shadow; where either is present this is listed for the eye rather than
       counted, and where neither is it stays a failure. */
    const mitigated = bd.image && (bd.gradient || cs.textShadow !== 'none');
    if (got >= need && !bd.gradient && !bd.image) return;
    if (mitigated && got >= need) return;

    out.push({
      sel: s, ratio: got, need, size: Math.round(size), weight,
      fg: cs.color,
      bg: 'rgb(' + [bd.color.r, bd.color.g, bd.color.b].map(Math.round).join(',') + ')',
      overGradient: bd.gradient, overImage: bd.image, mitigated,
      text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 46)
    });
  });
  return out;
};
`;

(async () => {
  const sweepLight = process.argv.includes('--light');
  const shots = process.argv.includes('--shots');
  if (shots && !fs.existsSync(OUT)) fs.mkdirSync(OUT);

  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 300000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const p = await b.newPage();
  await p.evaluateOnNewDocument(PROBE);
  /* python tools/serve.py is single-process and this harness pulls a few hundred
     images per run; under that it occasionally takes longer than the 30s default to
     answer a navigation. That is the test server breathing, not the site. */
  p.setDefaultNavigationTimeout(120000);

  const findings = new Map();          // signature -> finding, first one wins
  const record = (where, theme, list) => {
    list.forEach(f => {
      const key = theme + '|' + f.sel + '|' + f.fg + '|' + f.bg;
      if (!findings.has(key)) findings.set(key, { ...f, theme, where });
    });
  };

  const sweep = async (label, theme, routes, width, height) => {
    await p.setViewport({ width, height, deviceScaleFactor: 1 });
    for (const route of routes) {
      await p.evaluate(t => SHUX.theme.set(t), theme);
      await p.evaluate(r => { location.hash = '#' + r; }, route);
      await sleep(route === '/' ? 2200 : 1500);
      // let the header settle over whatever it is sitting on
      await p.evaluate(() => { const L = window.Motion && Motion.lenis && Motion.lenis();
        if (L) L.scrollTo(0, { immediate: true }); });
      await sleep(500);
      const list = await p.evaluate(() => window.__contrast());
      record(`${label} ${route}`, theme, list);
      if (list.length) console.log(`  ${theme} ${width}px ${route.padEnd(20)} ${list.length} finding(s)`);

      // and again a screen down, where the header is over content rather than the hero
      await p.evaluate(() => { const L = window.Motion && Motion.lenis && Motion.lenis();
        if (L) L.scrollTo(900, { immediate: true }); else window.scrollTo(0, 900); });
      await sleep(700);
      const list2 = await p.evaluate(() => window.__contrast());
      record(`${label} ${route} (scrolled)`, theme, list2);
    }
  };

  const themes = sweepLight ? ['dark', 'light'] : ['dark'];

  for (const theme of themes) {
    console.log(`\n--- storefront, ${theme}, 1440px ---`);
    await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await sleep(4500);
    await sweep('shop', theme, ROUTES, 1440, 900);

    console.log(`--- storefront, ${theme}, 390px ---`);
    await sweep('phone', theme, ROUTES, 390, 844);

    console.log(`--- console, ${theme}, 1440px ---`);
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(BASE + '/index.html#/admin', { waitUntil: 'domcontentloaded' });
    await sleep(4500);
    await p.evaluate(t => SHUX.theme.set(t), theme);
    await sleep(400);
    // Clear any session first: sessionStorage survives a same-origin goto, so on the
    // second theme's pass the console was already signed in and this probe was
    // labelling the dashboard as the login card.
    await p.evaluate(() => sessionStorage.clear());
    // p.reload rather than an in-page location.reload(): the second one races, and
    // the next evaluate can land in the old execution context or before ux.js has
    // booted, which is what "SHUX is not defined" was.
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !!window.SHUX && !!window.SH, { timeout: 30000 });
    await sleep(2500);
    await p.evaluate(t => SHUX.theme.set(t), theme);
    await p.evaluate(() => { location.hash = '#/admin'; });
    await sleep(1800);
    // the login card itself, before signing in
    const login = await p.evaluate(() => window.__contrast());
    record('console /admin (login)', theme, login);
    if (login.length) console.log(`  ${theme} 1440px /admin (login)     ${login.length} finding(s)`);
    await signInAs(p, 'ha');
    await sleep(1200);
    for (const route of ADMIN) {
      await p.evaluate(r => { location.hash = '#' + r; }, route);
      await sleep(1400);
      const list = await p.evaluate(() => window.__contrast());
      record('console ' + route, theme, list);
      if (list.length) console.log(`  ${theme} 1440px ${route.padEnd(20)} ${list.length} finding(s)`);
    }
    if (shots) {
      for (const r of ['/', '/shop', '/bespoke', '/faq']) {
        await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' }); await sleep(3500);
        await p.evaluate(t => SHUX.theme.set(t), theme);
        await p.evaluate(x => { location.hash = '#' + x; }, r); await sleep(1800);
        await p.screenshot({ path: path.join(OUT, `dark-${theme}${r.replace(/\W+/g, '-')}.png`) });
      }
    }
  }

  await b.close();

  /* ---------- report ---------- */
  const every = [...findings.values()].sort((a, b) => a.ratio - b.ratio);
  /* Text sitting over photography is judged on the contact sheet, not by a ratio
     against a colour that is not actually behind it. Listed, never counted. */
  const byEye = every.filter(f => f.mitigated);
  const all = every.filter(f => !f.mitigated);
  if (byEye.length) {
    console.log('\n' + byEye.length + ' element(s) sit over photography behind a gradient or a text-shadow.');
    console.log('Colour maths cannot judge these; look at them on the contact sheet:');
    byEye.forEach(f => console.log('  ' + f.theme.padEnd(5) + ' ' + f.sel.padEnd(22) + ' ' + f.where + '  "' + f.text + '"'));
  }
  console.log('\n' + '='.repeat(88));
  if (!all.length) {
    console.log('PASS - every text element measured clears WCAG AA in ' + themes.join(' and '));
    console.log('='.repeat(88));
    process.exit(0);
  }
  console.log(`${all.length} distinct contrast failure(s)\n`);
  for (const f of all) {
    console.log(`${String(f.ratio).padStart(6)}:1  (needs ${f.need})  ${f.theme.padEnd(5)} ${f.sel}`);
    console.log(`             ${f.fg} on ${f.bg}${f.overGradient ? '  [over a gradient scrim]' : ''}`);
    console.log(`             ${f.where}  "${f.text}"`);
  }
  console.log('='.repeat(88));
  console.log(`${all.length} FAILING`);
  process.exit(Math.min(all.length, 250));
})().catch(e => { console.error('harness error:', e); process.exit(99); });
